import { createMockPage, MockLocatorSpec, MockPage, role, testId } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupDService } from './group-d.service';

const NAV_TOGGLE = role('button', 'Toggle navigation menu');

const card = (href: string, title: string, description: string): MockLocatorSpec => ({
  children: {
    a: { getAttribute: href },
    'ion-card-title': { innerText: title },
    'ion-card-content > .sf-desc': { innerText: description }
  }
});

describe('GroupDService', () => {
  const originalEnv = process.env;
  let service: GroupDService;
  let page: MockPage;

  beforeEach(async () => {
    process.env = { ...originalEnv, STUFF_LOGIN_USERNAME: 'reader@example.co.nz', STUFF_LOGIN_PASSWORD: 'secret' };
    ({ service } = await createServiceModule(GroupDService));
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

    it('does not reload when the sign in never completes', async () => {
      page = createMockPage({ [NAV_TOGGLE]: { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.authenticate({ page })).rejects.toThrow('Timeout 60000ms exceeded');
      expect(page.reload).not.toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    it('opens the section from the navigation menu and reads every story card on it', async () => {
      page = createMockPage({
        'div.story-list-medium-container ion-card': { all: [card('/politics/one', 'One', 'First story')] },
        'div.list-stories-frame > div.stories-block ion-card': { all: [card('/politics/two', 'Two', 'Second story')] }
      });

      const links = await service.getLinks({ page, url: TEST_URL }, 'Politics');

      expect(page.locatorFor(NAV_TOGGLE).click).toHaveBeenCalled();
      expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'Politics', exact: true });
      expect(page.locatorFor(role('link', 'Politics')).click).toHaveBeenCalled();
      expect(page.locatorFor('div.story-list-medium-container').waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${TEST_URL}/politics/one`, title: 'One', description: 'First story' },
        { link: `${TEST_URL}/politics/two`, title: 'Two', description: 'Second story' }
      ]);
    });
  });

  describe('scanHome', () => {
    it('visits no sections itself, leaving that to each publication', async () => {
      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
    });
  });

  describe('scanArticle', () => {
    it('joins the free and the paywalled paragraphs of the article', async () => {
      page = createMockPage({
        'div.text-block > p': { allTextContents: ['First. '] },
        'div.text-block > div.paywall > p': { allTextContents: ['Second.'] }
      });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/politics/one` })).resolves.toEqual({ text: 'First. Second.' });
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
