import { createMockPage, MockPage } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { BusinessDeskService } from './business-desk.service';

const ARTICLE_URL = 'https://www.businessdesk.co.nz/markets/one/ABCDEFGHIJKLMNOPQRSTUVWXYZ/';
const PAYWALL_DECISION = 'section.article__body.full-content, #zephr-html-paywall';
const RENDERED_PARAGRAPHS = 'section.article__body p:visible';
const PAYWALL_PROMPT = '#zephr-html-paywall';

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
    it('waits for the paywall to decide before reading, so a free article is not cut short', async () => {
      page = createMockPage({ [RENDERED_PARAGRAPHS]: { allTextContents: ['Full body.'] } });

      await service.scanArticle({ page, url: ARTICLE_URL });

      expect(page.goto).toHaveBeenCalledWith(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
      expect(page.locatorFor(PAYWALL_DECISION).waitFor).toHaveBeenCalledWith({ state: 'attached' });
    });

    it('joins the rendered paragraphs of a free article', async () => {
      page = createMockPage({ [RENDERED_PARAGRAPHS]: { allTextContents: ['First. ', 'Second.'] } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'First. Second.' });
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('persists only the rendered teaser of a paywalled article, not the hidden paragraphs', async () => {
      page = createMockPage({
        [RENDERED_PARAGRAPHS]: { allTextContents: ['The opening lines. ', 'And the second.'] },
        [PAYWALL_PROMPT]: { count: 1 }
      });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'The opening lines. And the second.' });
      expect(logger.debug).toHaveBeenCalledWith(`Article is paywalled, persisting the teaser only: ${ARTICLE_URL}`);
      // Hidden paragraphs are in the DOM but must never be read, so the unfiltered paragraphs aren't queried
      expect(page.locator).not.toHaveBeenCalledWith('section.article__body p');
    });

    it('fails rather than return blank text when no paragraph is rendered', async () => {
      await expect(service.scanArticle({ page, url: ARTICLE_URL })).rejects.toThrow(`No article text found: ${ARTICLE_URL}`);
    });
  });
});
