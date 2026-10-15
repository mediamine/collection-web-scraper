import { createMockPage, MockPage } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { BusinessDeskService } from './business-desk.service';

const ARTICLE_URL = 'https://businessdesk.co.nz/article/markets/one';

describe('BusinessDeskService', () => {
  let service: BusinessDeskService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(BusinessDeskService));
    page = createMockPage();
  });

  it('is scraped anonymously, so authenticate and logout do nothing', async () => {
    await expect(service.authenticate({ page })).resolves.toBeUndefined();
    await expect(service.logout({ page })).resolves.toBeUndefined();
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('discovers no links of its own', async () => {
    await expect(service.scanHome({ page, url: ARTICLE_URL })).resolves.toEqual([]);
  });

  describe('scanArticle', () => {
    it('waits for either the article body or the paywall teaser', async () => {
      page = createMockPage({ 'div.article-body': { count: 1 } });

      await service.scanArticle({ page, url: ARTICLE_URL });

      expect(page.goto).toHaveBeenCalledWith(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
      expect(page.locatorFor('div.article-body, div.paywall').waitFor).toHaveBeenCalled();
    });

    it('joins the paragraphs of a free article', async () => {
      page = createMockPage({
        'div.article-body': { count: 1, children: { p: { allTextContents: ['First. ', 'Second.'] } } },
        'div.paywall': { count: 1, innerText: 'Teaser' }
      });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'First. Second.' });
    });

    it('falls back to the teaser text of a paywalled article', async () => {
      page = createMockPage({ 'div.paywall': { count: 1, innerText: 'The opening lines of the article…' } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'The opening lines of the article…' });
      expect(logger.debug).toHaveBeenCalledWith(`Article is paywalled, persisting the teaser only: ${ARTICLE_URL}`);
    });

    it('fails rather than return blank text when neither is on the page', async () => {
      await expect(service.scanArticle({ page, url: ARTICLE_URL })).rejects.toThrow(
        `No article body or paywall teaser found: ${ARTICLE_URL}`
      );
    });
  });
});
