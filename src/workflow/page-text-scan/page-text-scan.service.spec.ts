import { MockPage } from 'src/testing/mock-playwright';
import { createWorkflowModule, pinClock, SCRAPER_TOKEN, WorkflowMocks } from 'src/testing/workflow-testing';
import { PageTextScanService } from './page-text-scan.service';

const feed = { id: 9, name: 'National Business Review', url: 'https://www.nbr.co.nz' };

describe('PageTextScanService', () => {
  const clock = pinClock('2026-10-07T07:00:00.000+13:00');
  let service: PageTextScanService;
  let mocks: WorkflowMocks<PageTextScanService>;
  let page: MockPage;

  beforeEach(async () => {
    mocks = await createWorkflowModule(PageTextScanService);
    ({ service, page } = mocks);
    mocks.scraper.scanArticle.mockImplementation(async ({ url }) => ({ text: `Text of ${url}` }));
  });

  const scan = () => service.scan({ feed, feedScraper: SCRAPER_TOKEN });
  const candidates = (...rows: Array<{ id: number; link: string | null }>) =>
    mocks.prisma.news_item.findMany.mockResolvedValueOnce(rows.map(({ id, link }) => ({ id: BigInt(id), link })));

  it('sets its logger context', () => {
    expect(mocks.logger.setContext).toHaveBeenCalledWith(PageTextScanService.name);
  });

  it("looks up the feed's news items from the last month with blank or null page text", async () => {
    await scan();

    const window = { feed_fk: feed.id, date_downloaded: { gte: clock.monthAgoISO() } };
    expect(mocks.prisma.news_item.findMany.mock.calls).toEqual([
      [{ where: { ...window, page_text: '' } }],
      [{ where: { ...window, page_text: null } }]
    ]);
  });

  it('opens no browser when no news item needs page text', async () => {
    await scan();

    expect(mocks.playwright.openBrowser).not.toHaveBeenCalled();
    expect(mocks.prisma.feed.update).not.toHaveBeenCalled();
  });

  it('opens the browser on the first news item, signs in, fills every page text and signs out', async () => {
    candidates({ id: 1, link: `${feed.url}/one` });
    candidates({ id: 2, link: `${feed.url}/two` });

    await scan();

    expect(mocks.playwright.openBrowser).toHaveBeenCalledWith({ url: `${feed.url}/one` });
    expect(mocks.scraper.authenticate).toHaveBeenCalledWith({ page });
    expect(mocks.prisma.news_item.update.mock.calls).toEqual([
      [{ where: { id: BigInt(1) }, data: { page_text: `Text of ${feed.url}/one` } }],
      [{ where: { id: BigInt(2) }, data: { page_text: `Text of ${feed.url}/two` } }]
    ]);
    expect(mocks.prisma.feed.update).toHaveBeenCalledWith({ where: { id: feed.id }, data: { last_download_date: expect.any(Date) } });
    expect(mocks.scraper.logout).toHaveBeenCalledWith({ page });
    expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
  });

  it('skips BusinessDesk journalist pages and news items without a link', async () => {
    candidates(
      { id: 1, link: `${feed.url}/one` },
      { id: 2, link: 'https://businessdesk.co.nz/journalist/jane-doe' },
      { id: 3, link: null }
    );

    await scan();

    expect(mocks.scraper.scanArticle).toHaveBeenCalledTimes(1);
    expect(mocks.scraper.scanArticle).toHaveBeenCalledWith({ page, url: `${feed.url}/one` });
  });

  it('logs an article that fails to scan and carries on with the rest', async () => {
    candidates({ id: 1, link: `${feed.url}/one` }, { id: 2, link: `${feed.url}/two` });
    mocks.scraper.scanArticle.mockRejectedValueOnce(new Error('Timeout 60000ms exceeded'));

    await scan();

    expect(mocks.logger.error).toHaveBeenCalledWith(`Error scanning text for ${feed.url}/one. Exception: Timeout 60000ms exceeded`);
    expect(mocks.prisma.news_item.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.news_item.update).toHaveBeenCalledWith({
      where: { id: BigInt(2) },
      data: { page_text: `Text of ${feed.url}/two` }
    });
  });

  it('still closes the browser when the scan fails', async () => {
    candidates({ id: 1, link: `${feed.url}/one` });
    mocks.scraper.authenticate.mockRejectedValue(new Error('Sign in failed'));

    await expect(scan()).resolves.toBeUndefined();

    expect(mocks.prisma.news_item.update).not.toHaveBeenCalled();
    expect(mocks.playwright.closeBrowser).toHaveBeenCalled();
  });

  // Known defect: v1 opens the browser on candidates[0].link only, so one link-less row at the top skips the
  // whole feed. v2 looks for the first candidate that has a link.
  it.failing('opens the browser on the first news item that has a link', async () => {
    candidates({ id: 1, link: null }, { id: 2, link: `${feed.url}/two` });

    await scan();

    expect(mocks.playwright.openBrowser).toHaveBeenCalledWith({ url: `${feed.url}/two` });
  });

  // Known defect: the catch block is empty, so a feed that fails outright leaves no trace in the logs
  it.failing('logs a failed scan', async () => {
    candidates({ id: 1, link: `${feed.url}/one` });
    mocks.scraper.authenticate.mockRejectedValue(new Error('Sign in failed'));

    await scan();

    expect(mocks.logger.error).toHaveBeenCalledWith(expect.stringContaining('Sign in failed'));
  });
});
