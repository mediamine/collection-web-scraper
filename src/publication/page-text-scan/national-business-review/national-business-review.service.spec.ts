import { createMockPage, MockPage, role } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { NationalBusinessReviewService } from './national-business-review.service';

const ARTICLE_URL = 'https://www.nbr.co.nz/markets/one';
const MY_ACCOUNT = role('link', /my account/i);
const SIGN_OUT = role('link', /log ?out|sign ?out/i);
const SIGN_IN = role('link', /log ?in/i);

describe('NationalBusinessReviewService', () => {
  let service: NationalBusinessReviewService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(NationalBusinessReviewService, {
      config: { NBR_LOGIN_USERNAME: 'subscriber@example.co.nz', NBR_LOGIN_PASSWORD: 'secret' }
    }));
    page = createMockPage();
  });

  describe('authenticate', () => {
    it('signs in on the login page with the NBR credentials', async () => {
      await service.authenticate({ page });

      expect(page.goto).toHaveBeenCalledWith('https://www.nbr.co.nz/Security/login/?BackURL=%2F', { waitUntil: 'domcontentloaded' });
      expect(page.locatorFor('input[name="Email"]').fill).toHaveBeenCalledWith('subscriber@example.co.nz');
      expect(page.locatorFor('input[name="Password"]').fill).toHaveBeenCalledWith('secret');
      expect(page.locatorFor('input[type="submit"][name="action_doLogin"]').click).toHaveBeenCalled();
    });

    it('treats the My Account link as proof of a session', async () => {
      page = createMockPage({ [MY_ACCOUNT]: { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.authenticate({ page })).rejects.toThrow('Timeout 60000ms exceeded');
    });
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

  describe('logout', () => {
    it('signs out through the account menu', async () => {
      await service.logout({ page });

      expect(page.locatorFor(MY_ACCOUNT).click).toHaveBeenCalled();
      expect(page.locatorFor(SIGN_OUT).click).toHaveBeenCalled();
      expect(page.locatorFor(SIGN_IN).waitFor).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('only warns when signing out fails, so the run carries on', async () => {
      page = createMockPage({ [SIGN_OUT]: { rejects: { click: new Error('Element is not visible') } } });

      await expect(service.logout({ page })).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('Failed to sign out of National Business Review. Exception: Element is not visible');
    });
  });
});
