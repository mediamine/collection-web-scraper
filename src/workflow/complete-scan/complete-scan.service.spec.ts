import hashIt from 'hash-it';
import { MockPage } from 'src/testing/mock-playwright';
import { createWorkflowModule, pinClock, SCRAPER_TOKEN, WorkflowMocks } from 'src/testing/workflow-testing';
import { CompleteScanService } from './complete-scan.service';

const feed = { id: 7, name: 'The Post', url: 'https://www.thepost.co.nz' };
const link = (path: string, title: string) => ({ link: `${feed.url}${path}`, title, description: `About ${title}` });
const hashOf = ({ link, title, description }: ReturnType<typeof link>) => hashIt(`${feed.id}${title}${link}${description}`);

describe('CompleteScanService', () => {
  const clock = pinClock('2026-10-07T07:00:00.000+13:00');
  let service: CompleteScanService;
  let mocks: WorkflowMocks<CompleteScanService>;
  let page: MockPage;

  beforeEach(async () => {
    mocks = await createWorkflowModule(CompleteScanService);
    ({ service, page } = mocks);
    mocks.prisma.news_item.findFirstOrThrow.mockResolvedValue({ id: BigInt(100) });
  });

  const scan = () => service.scan({ feed, feedScraper: SCRAPER_TOKEN });

  it('sets its logger context', () => {
    expect(mocks.logger.setContext).toHaveBeenCalledWith(CompleteScanService.name);
  });

  it("opens the feed's home page, signs in with its scraper and signs out at the end", async () => {
    await scan();

    expect(mocks.playwright.openBrowser).toHaveBeenCalledWith({ url: feed.url });
    expect(mocks.scraper.authenticate).toHaveBeenCalledWith({ page });
    expect(mocks.scraper.scanHome).toHaveBeenCalledWith({ page, url: feed.url });
    expect(mocks.scraper.logout).toHaveBeenCalledWith({ page });
    expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
  });

  describe('discovering news items', () => {
    it('inserts each new link once, numbering it on from the highest news item id', async () => {
      const [one, two] = [link('/one', 'One'), link('/two', 'Two')];
      mocks.scraper.scanHome.mockResolvedValue([one, two, one]);

      await scan();

      expect(mocks.prisma.news_item.findFirstOrThrow).toHaveBeenCalledWith({ orderBy: { id: 'desc' } });
      expect(mocks.prisma.news_item.create.mock.calls).toEqual([
        [
          {
            data: {
              id: BigInt(101),
              ...one,
              source: feed.name,
              date: clock.nowISO(),
              date_downloaded: clock.nowISO(),
              feed_fk: feed.id,
              hashcode: hashOf(one),
              page_text: ''
            }
          }
        ],
        [{ data: expect.objectContaining({ id: BigInt(102), link: two.link, hashcode: hashOf(two) }) }]
      ]);
    });

    it('skips a link already stored, leaving a gap in the ids it numbers', async () => {
      const [stored, fresh] = [link('/stored', 'Stored'), link('/fresh', 'Fresh')];
      mocks.scraper.scanHome.mockResolvedValue([stored, fresh]);
      mocks.prisma.news_item.findMany.mockImplementation(async ({ where }) =>
        where.hashcode === hashOf(stored) ? [{ id: BigInt(50) }] : []
      );

      await scan();

      expect(mocks.prisma.news_item.findMany).toHaveBeenCalledWith({ where: { hashcode: hashOf(stored) } });
      expect(mocks.prisma.news_item.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.news_item.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: BigInt(102), link: fresh.link }) });
    });

    it('numbers from 1 when the highest id is unset', async () => {
      mocks.prisma.news_item.findFirstOrThrow.mockResolvedValue({ id: null });
      mocks.scraper.scanHome.mockResolvedValue([link('/one', 'One')]);

      await scan();

      expect(mocks.prisma.news_item.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: BigInt(1) }) });
    });
  });

  describe('filling page text', () => {
    it("looks up the feed's news items from the last month with blank or null page text", async () => {
      await scan();

      const window = { feed_fk: feed.id, date_downloaded: { gte: clock.monthAgoISO() } };
      expect(mocks.prisma.news_item.findMany).toHaveBeenCalledWith({ where: { ...window, page_text: '' } });
      expect(mocks.prisma.news_item.findMany).toHaveBeenCalledWith({ where: { ...window, page_text: null } });
    });

    it('scans the article of each one and stores its text', async () => {
      mocks.prisma.news_item.findMany
        .mockResolvedValueOnce([{ id: BigInt(1), link: `${feed.url}/one` }])
        .mockResolvedValueOnce([{ id: BigInt(2), link: `${feed.url}/two` }]);
      mocks.scraper.scanArticle.mockImplementation(async ({ url }) => ({ text: `Text of ${url}` }));

      await scan();

      expect(mocks.scraper.scanArticle.mock.calls).toEqual([[{ page, url: `${feed.url}/one` }], [{ page, url: `${feed.url}/two` }]]);
      expect(mocks.prisma.news_item.update.mock.calls).toEqual([
        [{ where: { id: BigInt(1) }, data: { page_text: `Text of ${feed.url}/one` } }],
        [{ where: { id: BigInt(2) }, data: { page_text: `Text of ${feed.url}/two` } }]
      ]);
    });

    it('flags an article whose scrape comes back empty and does not store it', async () => {
      mocks.prisma.news_item.findMany
        .mockResolvedValueOnce([{ id: BigInt(1), link: `${feed.url}/one` }])
        .mockResolvedValueOnce([{ id: BigInt(2), link: `${feed.url}/two` }]);
      mocks.scraper.scanArticle.mockResolvedValueOnce({ text: '' }).mockResolvedValueOnce({ text: 'Two' });

      await scan();

      expect(mocks.logger.warn).toHaveBeenCalledWith(`Skipped News Item: 1, as the scrape of ${feed.url}/one came back empty.`);
      expect(mocks.prisma.news_item.update.mock.calls).toEqual([[{ where: { id: BigInt(2) }, data: { page_text: 'Two' } }]]);
    });

    it('skips news items without a link or with an excluded one', async () => {
      mocks.prisma.news_item.findMany.mockResolvedValueOnce([
        { id: BigInt(1), link: null },
        { id: BigInt(2), link: 'https://www.ensemblemagazine.co.nz/feature' },
        { id: BigInt(3), link: 'https://sponsoredinteractive.stuff.co.nz/campaign' },
        { id: BigInt(4), link: `${feed.url}/https://elsewhere.co.nz` }
      ]);

      await scan();

      expect(mocks.scraper.scanArticle).not.toHaveBeenCalled();
      expect(mocks.prisma.news_item.update).not.toHaveBeenCalled();
    });

    it('logs an article that fails to scan and carries on with the rest', async () => {
      mocks.prisma.news_item.findMany.mockResolvedValueOnce([
        { id: BigInt(1), link: `${feed.url}/one` },
        { id: BigInt(2), link: `${feed.url}/two` }
      ]);
      mocks.scraper.scanArticle.mockRejectedValueOnce(new Error('Timeout 60000ms exceeded')).mockResolvedValueOnce({ text: 'Two' });

      await scan();

      expect(mocks.logger.error).toHaveBeenCalledWith(`Error scanning text for ${feed.url}/one. Exception: Timeout 60000ms exceeded`);
      expect(mocks.prisma.news_item.update).toHaveBeenCalledWith({ where: { id: BigInt(2) }, data: { page_text: 'Two' } });
      expect(mocks.prisma.feed.update).toHaveBeenCalled();
    });
  });

  it("stamps the feed's last download date", async () => {
    await scan();

    expect(mocks.prisma.feed.update).toHaveBeenCalledWith({ where: { id: feed.id }, data: { last_download_date: expect.any(Date) } });
  });

  it('logs a failed scan and still closes the browser', async () => {
    mocks.scraper.authenticate.mockRejectedValue(new Error('Sign in failed'));

    await expect(scan()).resolves.toBeUndefined();

    expect(mocks.logger.error).toHaveBeenCalledWith('Sign in failed');
    expect(mocks.prisma.news_item.create).not.toHaveBeenCalled();
    expect(mocks.prisma.feed.update).not.toHaveBeenCalled();
    expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
  });

  it('logs a feed whose scraper token is not registered', async () => {
    await service.scan({ feed, feedScraper: 'Unregistered Scraper' });

    expect(mocks.logger.error).toHaveBeenCalledWith(expect.stringContaining('Unregistered Scraper'));
    expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
  });
});
