import { createMockPage, MockPage } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { NationalBusinessReviewService } from './national-business-review.service';

const ARTICLE_URL = 'https://www.nbr.co.nz/markets/one';

describe('NationalBusinessReviewService', () => {
  let service: NationalBusinessReviewService;
  let page: MockPage;

  beforeEach(async () => {
    ({ service } = await createServiceModule(NationalBusinessReviewService));
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
    it('joins the paragraphs of the article', async () => {
      page = createMockPage({ 'div.article-content p': { allTextContents: ['First. ', 'Second.'] } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'First. Second.' });
      expect(page.goto).toHaveBeenCalledWith(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
      expect(page.locatorFor('div.article-content').waitFor).toHaveBeenCalled();
    });
  });
});
