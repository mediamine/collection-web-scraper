import hashIt from 'hash-it';
import { createWorkflowModule, pinClock, SCRAPER_TOKEN, WorkflowMocks } from 'src/testing/workflow-testing';
import { RssScanService } from './rss-scan.service';

const feed = { id: 3, name: 'Beehive', url: 'https://www.beehive.govt.nz/rss.xml' };
const item = (slug: string, overrides: Partial<{ link: string; title: string; description: string }> = {}) => ({
  link: `https://www.beehive.govt.nz/release/${slug}`,
  title: `Release ${slug}`,
  description: `About ${slug}`,
  ...overrides
});
const hashOf = ({ link, title, description }: ReturnType<typeof item>) => hashIt(`${feed.id}${title}${link}${description}`);

describe('RssScanService', () => {
  const clock = pinClock('2026-10-07T07:00:00.000+13:00');
  let service: RssScanService;
  let mocks: WorkflowMocks<RssScanService>;

  beforeEach(async () => {
    mocks = await createWorkflowModule(RssScanService);
    service = mocks.service;
    mocks.prisma.news_item.findFirstOrThrow.mockResolvedValue({ id: BigInt(200) });
  });

  const scan = () => service.scan({ feed, feedScraper: SCRAPER_TOKEN });
  // Rows for the blank and null page text passes, which run after any inserts
  const pageTextCandidates = (rows: Array<{ id: number; link: string | null; description: string | null }>) => {
    mocks.prisma.news_item.findMany.mockImplementation(async ({ where }) =>
      where.page_text === '' ? rows.map(({ id, ...rest }) => ({ id: BigInt(id), ...rest })) : []
    );
  };

  it('sets its logger context', () => {
    expect(mocks.logger.setContext).toHaveBeenCalledWith(RssScanService.name);
  });

  it('reads the feed without a browser', async () => {
    await scan();

    expect(mocks.scraper.scanHome).toHaveBeenCalledWith({ url: feed.url });
    expect(mocks.scraper.authenticate).not.toHaveBeenCalled();
    expect(mocks.playwright.openBrowser).not.toHaveBeenCalled();
  });

  describe('discovering news items', () => {
    it('warns about a feed with no items', async () => {
      await scan();

      expect(mocks.logger.warn).toHaveBeenCalledWith(`RSS feed returned no items: ${feed.url}`);
    });

    it('inserts each new item once, numbering it on from the highest news item id', async () => {
      const [one, two] = [item('one'), item('two')];
      mocks.scraper.scanHome.mockResolvedValue([one, two, one]);

      await scan();

      expect(mocks.logger.log).toHaveBeenCalledWith('RSS feed returned 2 items.');
      expect(mocks.prisma.news_item.create.mock.calls).toEqual([
        [
          {
            data: {
              id: BigInt(201),
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
        [{ data: expect.objectContaining({ id: BigInt(202), link: two.link, hashcode: hashOf(two) }) }]
      ]);
      expect(mocks.logger.log).toHaveBeenCalledWith('Created 2 new News Items.');
    });

    it('skips an item already stored', async () => {
      const [stored, fresh] = [item('stored'), item('fresh')];
      mocks.scraper.scanHome.mockResolvedValue([stored, fresh]);
      mocks.prisma.news_item.findMany.mockImplementation(async ({ where }) =>
        where.hashcode === hashOf(stored) ? [{ id: BigInt(9) }] : []
      );

      await scan();

      expect(mocks.prisma.news_item.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.news_item.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: BigInt(202), link: fresh.link }) });
      expect(mocks.logger.log).toHaveBeenCalledWith('Created 1 new News Items.');
    });

    it('numbers from 1 when the highest id is unset', async () => {
      mocks.prisma.news_item.findFirstOrThrow.mockResolvedValue({ id: null });
      mocks.scraper.scanHome.mockResolvedValue([item('one')]);

      await scan();

      expect(mocks.prisma.news_item.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: BigInt(1) }) });
    });

    it.each([
      ['link', item('no-link', { link: '' })],
      ['title', item('no-title', { title: '' })]
    ])('skips an item without a %s, with a warning', async (_, malformed) => {
      mocks.scraper.scanHome.mockResolvedValue([malformed, item('fine')]);

      await scan();

      expect(mocks.logger.warn).toHaveBeenCalledWith(`Skipping RSS item without a link or title: ${JSON.stringify(malformed)}`);
      expect(mocks.prisma.news_item.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.news_item.create).toHaveBeenCalledWith({ data: expect.objectContaining({ link: item('fine').link }) });
    });

    it('logs an item that fails to insert and carries on with the rest', async () => {
      const [one, two] = [item('one'), item('two')];
      mocks.scraper.scanHome.mockResolvedValue([one, two]);
      mocks.prisma.news_item.create.mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`hashcode`)'));

      await scan();

      expect(mocks.logger.error).toHaveBeenCalledWith(
        `Error creating News Item for ${one.link}. Exception: Unique constraint failed on the fields: (\`hashcode\`)`
      );
      expect(mocks.prisma.news_item.create).toHaveBeenCalledTimes(2);
      expect(mocks.logger.log).toHaveBeenCalledWith('Created 1 new News Items.');
    });
  });

  describe('filling page text', () => {
    it("looks up the feed's news items from the last month with blank or null page text", async () => {
      await scan();

      const window = { feed_fk: feed.id, date_downloaded: { gte: clock.monthAgoISO() } };
      expect(mocks.prisma.news_item.findMany).toHaveBeenCalledWith({ where: { ...window, page_text: '' } });
      expect(mocks.prisma.news_item.findMany).toHaveBeenCalledWith({ where: { ...window, page_text: null } });
    });

    it("stores each news item's description as its page text", async () => {
      pageTextCandidates([
        { id: 1, link: item('one').link, description: 'The whole release.' },
        { id: 2, link: null, description: 'No link.' }
      ]);

      await scan();

      expect(mocks.prisma.news_item.update.mock.calls).toEqual([[{ where: { id: BigInt(1) }, data: { page_text: 'The whole release.' } }]]);
    });

    it('leaves a news item without a description alone, rather than rewrite it blank every run', async () => {
      pageTextCandidates([{ id: 2, link: item('two').link, description: null }]);

      await scan();

      expect(mocks.prisma.news_item.update).not.toHaveBeenCalled();
      expect(mocks.logger.debug).toHaveBeenCalledWith('No description to persist as Page Text for News Item: 2');
    });

    it('logs a page text that fails to save and carries on with the rest', async () => {
      pageTextCandidates([
        { id: 1, link: item('one').link, description: 'One.' },
        { id: 2, link: item('two').link, description: 'Two.' }
      ]);
      mocks.prisma.news_item.update.mockRejectedValueOnce(new Error('Connection terminated'));

      await scan();

      expect(mocks.logger.error).toHaveBeenCalledWith(`Error scanning text for ${item('one').link}. Exception: Connection terminated`);
      expect(mocks.prisma.news_item.update).toHaveBeenCalledTimes(2);
    });
  });

  it("stamps the feed's last download date", async () => {
    await scan();

    expect(mocks.prisma.feed.update).toHaveBeenCalledWith({ where: { id: feed.id }, data: { last_download_date: expect.any(Date) } });
  });

  it('names the feed when it fails, since a bare parser error does not', async () => {
    mocks.scraper.scanHome.mockRejectedValue(new Error('Attribute without value'));

    await expect(scan()).resolves.toBeUndefined();

    expect(mocks.logger.error).toHaveBeenCalledWith(
      `Failed RSS scan for feed ${feed.id} (${feed.name}) at ${feed.url}. Attribute without value`
    );
    expect(mocks.prisma.feed.update).not.toHaveBeenCalled();
  });
});
