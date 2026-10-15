import { DateTime } from 'luxon';
import { PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT } from 'src/constant';
import { MockPage } from 'src/testing/mock-playwright';
import { createWorkflowModule, pinClock, SCRAPER_TOKEN, WorkflowMocks } from 'src/testing/workflow-testing';
import { PageTextScanV2Service } from './page-text-scan-v2.service';

const feed = { id: 11, name: 'Otago Daily Times', url: 'https://www.odt.co.nz' };
const DISABLED_WARNING = `${PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT} is not set, so only News Items with blank Page Text will be scanned.`;

interface Row {
  id: number;
  link?: string | null;
  page_text?: string | null;
  date?: Date | null;
  date_downloaded?: Date | null;
}

const row = ({ id, link = `${feed.url}/${id}`, page_text = '', date = null, date_downloaded = null }: Row) => ({
  id: BigInt(id),
  link,
  page_text,
  date,
  date_downloaded
});

describe('PageTextScanV2Service', () => {
  const clock = pinClock('2026-10-07T07:00:00.000+13:00');
  let service: PageTextScanV2Service;
  let mocks: WorkflowMocks<PageTextScanV2Service>;
  let page: MockPage;

  const create = async (minCharCount?: string) => {
    mocks = await createWorkflowModule(PageTextScanV2Service, {
      config: minCharCount === undefined ? {} : { [PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT]: minCharCount }
    });
    ({ service, page } = mocks);
    mocks.scraper.scanArticle.mockImplementation(async ({ url }) => ({ text: `Text of ${url}` }));
  };

  // The three candidate passes, in the order the workflow runs them: blank, null, then short page text
  const candidates = ({ blank = [], none = [], short = [] }: { blank?: Row[]; none?: Row[]; short?: Row[] }) =>
    mocks.prisma.news_item.findMany
      .mockResolvedValueOnce(blank.map(row))
      .mockResolvedValueOnce(none.map(row))
      .mockResolvedValueOnce(short.map(row));

  const scan = () => service.scan({ feed, feedScraper: SCRAPER_TOKEN });

  beforeEach(() => create('500'));

  it('sets its logger context', () => {
    expect(mocks.logger.setContext).toHaveBeenCalledWith(PageTextScanV2Service.name);
  });

  describe('finding candidates', () => {
    it("looks up the feed's news items from the last month with blank or null page text", async () => {
      await scan();

      const window = { feed_fk: feed.id, date_downloaded: { gte: clock.monthAgoISO() } };
      expect(mocks.prisma.news_item.findMany).toHaveBeenNthCalledWith(1, { where: { ...window, page_text: '' } });
      expect(mocks.prisma.news_item.findMany).toHaveBeenNthCalledWith(2, { where: { ...window, page_text: null } });
    });

    it('also finds page text shorter than the threshold, by raw SQL, and loads those rows by id', async () => {
      mocks.prisma.$queryRaw.mockResolvedValue([{ id: BigInt(5) }, { id: BigInt(6) }]);

      await scan();

      const [strings, feedId, windowStart, minCharCount] = mocks.prisma.$queryRaw.mock.calls[0];
      expect(strings.join('?')).toMatch(/char_length\(page_text\) > 0\s+AND char_length\(page_text\) < \?/);
      expect(feedId).toBe(feed.id);
      expect(windowStart).toEqual(DateTime.now().minus({ month: 1 }).toJSDate());
      expect(minCharCount).toBe(500);
      expect(mocks.prisma.news_item.findMany).toHaveBeenNthCalledWith(3, { where: { id: { in: [BigInt(5), BigInt(6)] } } });
      expect(mocks.logger.warn).not.toHaveBeenCalledWith(DISABLED_WARNING);
    });

    it.each([undefined, '0', 'not a number'])('warns and skips the short text pass when the threshold is %s', async (minCharCount) => {
      await create(minCharCount);

      await scan();

      expect(mocks.logger.warn).toHaveBeenCalledWith(DISABLED_WARNING);
      expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
      expect(mocks.prisma.news_item.findMany).toHaveBeenNthCalledWith(3, { where: { id: { in: [] } } });
    });

    // Known defect: a negative threshold disables the short text pass, but without the warning that 0 gets
    it.failing('warns that the short text pass is off when the threshold is negative', async () => {
      await create('-5');

      await scan();

      expect(mocks.logger.warn).toHaveBeenCalledWith(DISABLED_WARNING);
    });

    it('scans a news item found by more than one pass only once', async () => {
      candidates({ blank: [{ id: 1 }], short: [{ id: 1 }, { id: 2, page_text: 'Teaser' }] });

      await scan();

      expect(mocks.scraper.scanArticle.mock.calls).toEqual([[{ page, url: `${feed.url}/1` }], [{ page, url: `${feed.url}/2` }]]);
    });
  });

  describe('scanning', () => {
    it('opens no browser when no news item needs page text', async () => {
      await scan();

      expect(mocks.playwright.openBrowser).not.toHaveBeenCalled();
      expect(mocks.prisma.feed.update).not.toHaveBeenCalled();
    });

    it('opens no browser when none of the news items has a link', async () => {
      candidates({ blank: [{ id: 1, link: null }] });

      await scan();

      expect(mocks.playwright.openBrowser).not.toHaveBeenCalled();
    });

    it('opens the browser on the first news item that has a link', async () => {
      candidates({ blank: [{ id: 1, link: null }, { id: 2 }] });

      await scan();

      expect(mocks.playwright.openBrowser).toHaveBeenCalledWith({ url: `${feed.url}/2` });
    });

    it('signs in, fills every page text, stamps the feed and signs out', async () => {
      candidates({ blank: [{ id: 1 }], none: [{ id: 2, page_text: null }], short: [{ id: 3, page_text: 'Teaser' }] });

      await scan();

      expect(mocks.scraper.authenticate).toHaveBeenCalledWith({ page });
      expect(mocks.prisma.news_item.update.mock.calls).toEqual(
        [1, 2, 3].map((id) => [{ where: { id: BigInt(id) }, data: { page_text: `Text of ${feed.url}/${id}` } }])
      );
      expect(mocks.prisma.feed.update).toHaveBeenCalledWith({ where: { id: feed.id }, data: { last_download_date: expect.any(Date) } });
      expect(mocks.scraper.logout).toHaveBeenCalledWith({ page });
      expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
    });

    it('skips a link that embeds a second url', async () => {
      candidates({ blank: [{ id: 1, link: `${feed.url}/https://elsewhere.co.nz` }, { id: 2 }] });

      await scan();

      expect(mocks.scraper.scanArticle).toHaveBeenCalledTimes(1);
      expect(mocks.scraper.scanArticle).toHaveBeenCalledWith({ page, url: `${feed.url}/2` });
    });

    it('never lets an empty scrape wipe page text a news item already has', async () => {
      candidates({ short: [{ id: 5, page_text: 'Teaser' }] });
      mocks.scraper.scanArticle.mockResolvedValue({ text: '' });

      await scan();

      expect(mocks.prisma.news_item.update).not.toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalledWith('Skipped News Item: 5, as the scrape came back empty but it already has Page Text.');
    });

    it('writes an empty scrape over a news item with no page text yet', async () => {
      candidates({ blank: [{ id: 1 }] });
      mocks.scraper.scanArticle.mockResolvedValue({ text: '' });

      await scan();

      expect(mocks.prisma.news_item.update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { page_text: '' } });
    });

    it('logs an article that fails to scan and carries on with the rest', async () => {
      candidates({ blank: [{ id: 1 }, { id: 2 }] });
      mocks.scraper.scanArticle.mockRejectedValueOnce(new Error('Article body never filled'));

      await scan();

      expect(mocks.logger.error).toHaveBeenCalledWith(`Error scanning text for ${feed.url}/1. Exception: Article body never filled`);
      expect(mocks.prisma.news_item.update).toHaveBeenCalledTimes(1);
    });

    it('logs a failed scan and still closes the browser', async () => {
      mocks.prisma.news_item.findMany.mockRejectedValue(new Error('Connection terminated'));

      await expect(scan()).resolves.toBeUndefined();

      expect(mocks.logger.error).toHaveBeenCalledWith('Connection terminated');
      expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
    });
  });

  describe('realigning the download date', () => {
    const october = (day: number) => new Date(`2026-10-0${day}T00:00:00.000Z`);

    // Realigning is its own write, ahead of the scrape, so it survives a scrape that yields nothing
    it.each([
      ['the article is dated after its download', { date: october(5), date_downloaded: october(1) }, [{ date_downloaded: october(5) }]],
      ['the download date is missing', { date: october(5), date_downloaded: null }, [{ date_downloaded: october(5) }]],
      ['the article is dated before its download', { date: october(1), date_downloaded: october(5) }, []],
      ['the article has no date', { date: null, date_downloaded: october(5) }, []]
    ])('when %s', async (_, dates, realignments) => {
      candidates({ blank: [{ id: 1, ...dates }] });

      await scan();

      expect(mocks.prisma.news_item.update.mock.calls).toEqual([
        ...realignments.map((data) => [{ where: { id: BigInt(1) }, data }]),
        [{ where: { id: BigInt(1) }, data: { page_text: `Text of ${feed.url}/1` } }]
      ]);
    });

    it('realigns even when the scrape is empty and the existing page text is kept', async () => {
      candidates({ short: [{ id: 5, page_text: 'Teaser', date: october(5), date_downloaded: october(1) }] });
      mocks.scraper.scanArticle.mockResolvedValue({ text: '' });

      await scan();

      expect(mocks.prisma.news_item.update.mock.calls).toEqual([[{ where: { id: BigInt(5) }, data: { date_downloaded: october(5) } }]]);
    });

    it('realigns even when the article fails to scan', async () => {
      candidates({ blank: [{ id: 1, date: october(5), date_downloaded: october(1) }] });
      mocks.scraper.scanArticle.mockRejectedValue(new Error('Article body never filled'));

      await scan();

      expect(mocks.prisma.news_item.update.mock.calls).toEqual([[{ where: { id: BigInt(1) }, data: { date_downloaded: october(5) } }]]);
    });

    it('logs the date it advances to', async () => {
      candidates({ blank: [{ id: 1, date: october(5), date_downloaded: october(1) }] });

      await scan();

      expect(mocks.logger.log).toHaveBeenCalledWith(
        'Advancing Date Downloaded to the article Date: 2026-10-05T00:00:00.000Z for News Item: 1'
      );
    });
  });
});
