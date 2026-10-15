import { createMockPage, MockLocatorSpec, MockPage, role, testId } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupEService } from './group-e.service';

const NAV_TOGGLE = role('button', 'Toggle navigation menu');
const CARD_LINK = 'div[data-testid="grid-card-content"] > a';

const article = ({ href, title }: { href: string | Error; title: string | Error }): MockLocatorSpec => ({
  children: {
    [CARD_LINK]: href instanceof Error ? { rejects: { getAttribute: href } } : { getAttribute: href },
    h3: title instanceof Error ? { rejects: { innerText: title } } : { innerText: title }
  }
});

describe('GroupEService', () => {
  const originalEnv = process.env;
  let service: GroupEService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    process.env = { ...originalEnv, STUFF_LOGIN_USERNAME: 'reader@example.co.nz', STUFF_LOGIN_PASSWORD: 'secret' };
    ({ service, logger } = await createServiceModule(GroupEService));
    page = createMockPage();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('authenticate', () => {
    it('signs in with the Stuff credentials from the environment, then reloads', async () => {
      await service.authenticate({ page });

      expect(page.locatorFor(testId('login-button')).click).toHaveBeenCalled();
      expect(page.locatorFor(role('textbox', 'Email address')).fill).toHaveBeenCalledWith('reader@example.co.nz');
      expect(page.locatorFor(role('textbox', 'Password')).fill).toHaveBeenCalledWith('secret');
      expect(page.locatorFor(role('button', 'Log in')).click).toHaveBeenCalled();
      expect(page.locatorFor(NAV_TOGGLE).waitFor).toHaveBeenCalled();
      expect(page.reload).toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    it('opens the section from the navigation menu and reads every article box on it', async () => {
      page = createMockPage({
        'div[data-testid="box-container"] article': {
          all: [article({ href: '/politics/one', title: 'One' }), article({ href: '/politics/two', title: 'Two' })]
        }
      });

      const links = await service.getLinks({ page, url: TEST_URL }, 'Politics');

      expect(page.locatorFor(NAV_TOGGLE).click).toHaveBeenCalled();
      expect(page.locatorFor(role('link', 'Politics')).click).toHaveBeenCalled();
      expect(page.locatorFor('div[data-testid="box-container"]').waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${TEST_URL}/politics/one`, title: 'One', description: '' },
        { link: `${TEST_URL}/politics/two`, title: 'Two', description: '' }
      ]);
    });

    it('keeps an article whose link cannot be read, logging the failure', async () => {
      page = createMockPage({
        'div[data-testid="box-container"] article': { all: [article({ href: new Error('detached'), title: 'One' })] }
      });

      await expect(service.getLinks({ page, url: TEST_URL }, 'Politics')).resolves.toEqual([
        { link: TEST_URL, title: 'One', description: '' }
      ]);
      expect(logger.error).toHaveBeenCalledWith('Unable to resolve article link');
    });

    it('keeps an article whose title cannot be read, logging the failure', async () => {
      page = createMockPage({
        'div[data-testid="box-container"] article': { all: [article({ href: '/politics/one', title: new Error('detached') })] }
      });

      await expect(service.getLinks({ page, url: TEST_URL }, 'Politics')).resolves.toEqual([
        { link: `${TEST_URL}/politics/one`, title: '', description: '' }
      ]);
      expect(logger.error).toHaveBeenCalledWith('Unable to resolve article title');
    });
  });

  describe('scanHome', () => {
    it('visits no sections itself, leaving that to each publication', async () => {
      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
    });
  });

  describe('scanArticle', () => {
    it('joins the paragraphs of every article body layout', async () => {
      page = createMockPage({
        'div.text-block > p': { allTextContents: ['First. '] },
        'div.text-block > div.paywall > p': { allTextContents: ['Second. '] },
        'div[data-testid="body-paragraph"] > p': { allTextContents: ['Third.'] }
      });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/politics/one` })).resolves.toEqual({ text: 'First. Second. Third.' });
      expect(page.goto).toHaveBeenCalledWith(`${TEST_URL}/politics/one`, { timeout: 60000 });
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('signs out through the account dropdown', async () => {
      await service.logout({ page });

      expect(page.reload).toHaveBeenCalled();
      expect(page.locatorFor(testId('dropdown-button')).click).toHaveBeenCalled();
      expect(page.locatorFor(role('link', 'Sign Out')).click).toHaveBeenCalled();
      expect(page.locatorFor(NAV_TOGGLE).waitFor).toHaveBeenCalled();
    });
  });
});
