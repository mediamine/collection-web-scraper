import { createMockPage, hasText, inFrame, MockPage, role } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { OtagoDailyTimesService } from './otago-daily-times.service';

const ARTICLE_URL = 'https://www.odt.co.nz/news/dunedin/one';
const ARTICLE_BODY = 'div.article-body p:not(.paywallbox)';
const HEADER_SIGN_IN = 'div.sign-in-button button';
const OFFER = 'iframe[id^="offer-"]';
const PIANO = 'iframe[id^="piano-id"]';
const SIGN_OUT = role('button', /sign out/i);

describe('OtagoDailyTimesService', () => {
  let service: OtagoDailyTimesService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(OtagoDailyTimesService, {
      config: { ODT_LOGIN_USERNAME: 'subscriber@example.co.nz', ODT_LOGIN_PASSWORD: 'secret' }
    }));
    page = createMockPage();
  });

  it('sets its logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith(OtagoDailyTimesService.name);
  });

  describe('authenticate', () => {
    const expectPianoSignIn = () => {
      expect(page.locatorFor(inFrame(PIANO, 'input[name="email"]')).fill).toHaveBeenCalledWith('subscriber@example.co.nz');
      expect(page.locatorFor(inFrame(PIANO, 'input[type="password"]')).fill).toHaveBeenCalledWith('secret');
      expect(page.locatorFor(hasText(inFrame(PIANO, 'button.btn'), /sign in/i)).click).toHaveBeenCalled();
      expect(page.locatorFor(SIGN_OUT).waitFor).toHaveBeenCalled();
    };

    it('does nothing when the header already offers to sign out', async () => {
      page = createMockPage({ [SIGN_OUT]: { count: 1 } });

      await service.authenticate({ page });

      expect(page.locatorFor(HEADER_SIGN_IN).waitFor).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Already signed in to Otago Daily Times.');
      expect(page.frameLocator).not.toHaveBeenCalled();
    });

    it('signs in through the subscription offer dialog on a premium article', async () => {
      page = createMockPage({ [OFFER]: { count: 1 } });

      await service.authenticate({ page });

      expect(page.locatorFor(OFFER).waitFor).toHaveBeenCalledWith({ timeout: 15000 });
      expect(page.locatorFor(inFrame(OFFER, 'a.sign-in-bold')).click).toHaveBeenCalled();
      expect(page.locatorFor(HEADER_SIGN_IN).click).not.toHaveBeenCalled();
      expectPianoSignIn();
    });

    it('signs in through the header when no offer dialog shows up', async () => {
      page = createMockPage({ [OFFER]: { rejects: { waitFor: new Error('Timeout 15000ms exceeded') } } });

      await service.authenticate({ page });

      expect(page.locatorFor(HEADER_SIGN_IN).click).toHaveBeenCalled();
      expect(page.locatorFor(inFrame(OFFER, 'a.sign-in-bold')).click).not.toHaveBeenCalled();
      expectPianoSignIn();
    });

    it('treats the sign out button as proof of a session', async () => {
      page = createMockPage({ [SIGN_OUT]: { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.authenticate({ page })).rejects.toThrow('Timeout 60000ms exceeded');
    });
  });

  it('discovers no links of its own', async () => {
    await expect(service.scanHome({ page, url: ARTICLE_URL })).resolves.toEqual([]);
  });

  describe('scanArticle', () => {
    let now: jest.SpyInstance;

    beforeEach(() => {
      now = jest.spyOn(Date, 'now').mockReturnValue(0);
    });

    it('waits for the body to stop growing before reading it', async () => {
      page
        .locatorFor(ARTICLE_BODY)
        .allTextContents.mockResolvedValueOnce([])
        .mockResolvedValueOnce(['Standfirst. '])
        .mockResolvedValue(['Standfirst. ', 'The rest of the article.']);

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'Standfirst. The rest of the article.' });

      expect(page.goto).toHaveBeenCalledWith(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
      // Three reads while the body fills, then three more of the same length before it counts as settled
      expect(page.locatorFor(ARTICLE_BODY).allTextContents).toHaveBeenCalledTimes(6);
      expect(page.waitForTimeout).toHaveBeenCalledTimes(5);
      expect(page.waitForTimeout).toHaveBeenCalledWith(250);
    });

    it('settles after the next three reads when the body is complete on the first', async () => {
      page.locatorFor(ARTICLE_BODY).allTextContents.mockResolvedValue(['Complete.']);

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'Complete.' });
      expect(page.locatorFor(ARTICLE_BODY).allTextContents).toHaveBeenCalledTimes(4);
    });

    it('keeps what rendered once 20 seconds pass without the body settling', async () => {
      now.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(20000);
      page.locatorFor(ARTICLE_BODY).allTextContents.mockResolvedValue(['Still loading']);

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).resolves.toEqual({ text: 'Still loading' });
      expect(page.locatorFor(ARTICLE_BODY).allTextContents).toHaveBeenCalledTimes(1);
    });

    it('refuses an article whose body never filled', async () => {
      now.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(20000);

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).rejects.toThrow(
        `Article body never filled — not entitled or paywall-locked: ${ARTICLE_URL}`
      );
    });

    it('refuses a teaser while the subscription offer is still on screen', async () => {
      page = createMockPage({ [OFFER]: { count: 1 }, [ARTICLE_BODY]: { allTextContents: ['Teaser only.'] } });

      await expect(service.scanArticle({ page, url: ARTICLE_URL })).rejects.toThrow(
        `Subscription offer still showing — session is not entitled: ${ARTICLE_URL}`
      );
    });
  });

  describe('logout', () => {
    it('signs out through the header', async () => {
      await service.logout({ page });

      expect(page.locatorFor(SIGN_OUT).click).toHaveBeenCalled();
      expect(page.locatorFor(role('button', /sign in/i)).waitFor).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('only warns when signing out fails, so the run carries on', async () => {
      page = createMockPage({ [SIGN_OUT]: { rejects: { click: new Error('Element is not visible') } } });

      await expect(service.logout({ page })).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('Failed to sign out of Otago Daily Times. Exception: Element is not visible');
    });
  });
});
