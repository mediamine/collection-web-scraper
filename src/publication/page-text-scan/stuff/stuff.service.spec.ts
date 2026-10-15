import { createMockPage, MockPage, role } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { StuffService } from './stuff.service';

const ARTICLE_URL = 'https://www.stuff.co.nz/nz-news/one';
const CLOSE_AD = role('button', 'Close Ad');

describe('StuffService', () => {
  let service: StuffService;
  let page: MockPage;

  beforeEach(async () => {
    ({ service } = await createServiceModule(StuffService));
    page = createMockPage();
  });

  it('is scraped signed out, so authenticate and logout do nothing', async () => {
    await expect(service.authenticate({ page })).resolves.toBeUndefined();
    await expect(service.logout({ page })).resolves.toBeUndefined();
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('discovers no links of its own', async () => {
    await expect(service.scanHome({ page, url: ARTICLE_URL })).resolves.toEqual([]);
  });

  describe('scanArticle', () => {
    it('reads div.content-groups paragraphs when the page has them', async () => {
      page = createMockPage({
        'div.content-groups': { count: 1 },
        'div.content-groups p': { allTextContents: ['First. ', 'Second.'] },
        'div[data-testid="body-paragraph"] > p': { allTextContents: ['Unused.'] }
      });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'First. Second.' });
      expect(page.goto).toHaveBeenCalledWith(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
      expect(page.locatorFor('div.content-groups, div[data-testid="body-paragraph"]').waitFor).toHaveBeenCalled();
    });

    it('falls back to the body-paragraph layout without div.content-groups', async () => {
      page = createMockPage({ 'div[data-testid="body-paragraph"] > p': { allTextContents: ['Only. ', 'Layout.'] } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'Only. Layout.' });
    });

    it('closes the ad overlay when one is showing', async () => {
      page = createMockPage({ [CLOSE_AD]: { isVisible: true } });

      await service.scanArticle({ page, url: ARTICLE_URL });

      expect(page.locatorFor(CLOSE_AD).click).toHaveBeenCalled();
    });

    it('leaves the page alone when no ad is showing', async () => {
      await service.scanArticle({ page, url: ARTICLE_URL });

      expect(page.locatorFor(CLOSE_AD).click).not.toHaveBeenCalled();
    });

    it("returns blank text for Stuff's error page without waiting for an article body", async () => {
      page = createMockPage({ 'div.common-error-display': { isVisible: true } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: '' });
      expect(page.locatorFor('div.content-groups, div[data-testid="body-paragraph"]').waitFor).not.toHaveBeenCalled();
    });
  });
});
