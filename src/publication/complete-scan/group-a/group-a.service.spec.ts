import { createMockPage, label, MockLocatorSpec, MockPage, role } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupAService } from './group-a.service';

const card = (href: string, title: string, description: string): MockLocatorSpec => ({
  children: {
    a: { getAttribute: href },
    'ion-card-title': { innerText: title },
    'ion-card-content > .sf-desc': { innerText: description }
  }
});

describe('GroupAService', () => {
  let service: GroupAService;
  let page: MockPage;

  beforeEach(async () => {
    ({ service } = await createServiceModule(GroupAService, {
      config: { STUFF_LOGIN_USERNAME: 'reader@example.co.nz', STUFF_LOGIN_PASSWORD: 'secret' }
    }));
    page = createMockPage();
  });

  describe('authenticate', () => {
    it('signs in with the Stuff credentials, then reloads once the masthead menu shows', async () => {
      await service.authenticate({ page });

      expect(page.locatorFor(label('Email address')).fill).toHaveBeenCalledWith('reader@example.co.nz');
      expect(page.locatorFor(label('Password')).fill).toHaveBeenCalledWith('secret');
      // "Log In" opens the dialog, then it or its "Log in" twin submits it
      expect(page.locatorFor(role('button', 'Log In')).or).toHaveBeenCalledWith(page.locatorFor(role('button', 'Log in')));
      expect(page.locatorFor(role('button', 'Log In')).click).toHaveBeenCalledTimes(2);
      expect(page.locatorFor('#mastheads_menu').waitFor).toHaveBeenCalled();
      expect(page.reload).toHaveBeenCalled();
    });

    it('does not reload when the sign in never completes', async () => {
      page = createMockPage({ '#mastheads_menu': { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.authenticate({ page })).rejects.toThrow('Timeout 60000ms exceeded');
      expect(page.reload).not.toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    it('opens the section from the masthead menu and reads every story card on it', async () => {
      page = createMockPage({
        'div.story-list-medium-container ion-card': { all: [card('/politics/one', 'One', 'First story')] },
        'div.list-stories-frame > div.stories-block ion-card': {
          all: [card('/politics/two', 'Two', 'Second story'), card('/politics/three', 'Three', 'Third story')]
        }
      });

      const links = await service.getLinks({ page, url: TEST_URL }, 'Politics');

      expect(page.locatorFor('#mastheads_menu').click).toHaveBeenCalled();
      expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'Politics', exact: true });
      expect(page.locatorFor(role('link', 'Politics')).click).toHaveBeenCalled();
      expect(page.locatorFor('div.story-list-medium-container').waitFor).toHaveBeenCalled();
      expect(page.locatorFor('div.list-stories-frame > div.stories-block').waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${TEST_URL}/politics/one`, title: 'One', description: 'First story' },
        { link: `${TEST_URL}/politics/two`, title: 'Two', description: 'Second story' },
        { link: `${TEST_URL}/politics/three`, title: 'Three', description: 'Third story' }
      ]);
    });

    it('returns no links for a section without story cards', async () => {
      await expect(service.getLinks({ page, url: TEST_URL }, 'Politics')).resolves.toEqual([]);
    });

    it('propagates a section that is missing from the menu', async () => {
      page = createMockPage({ [role('link', 'Politics')]: { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.getLinks({ page, url: TEST_URL }, 'Politics')).rejects.toThrow('Timeout 60000ms exceeded');
    });
  });

  describe('scanHome', () => {
    it('visits no sections itself, leaving that to each publication', async () => {
      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
      expect(page.locator).not.toHaveBeenCalled();
    });
  });

  describe('scanArticle', () => {
    it('joins the free and the paywalled paragraphs of the article', async () => {
      page = createMockPage({
        'div.text-block > p': { allTextContents: ['First. ', 'Second. '] },
        'div.text-block > div.paywall > p': { allTextContents: ['Third.'] }
      });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/politics/one` })).resolves.toEqual({ text: 'First. Second. Third.' });
      expect(page.goto).toHaveBeenCalledWith(`${TEST_URL}/politics/one`, { timeout: 60000 });
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
    });

    it('propagates an article page that never renders', async () => {
      page = createMockPage({ 'section.page-content': { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/politics/one` })).rejects.toThrow('Timeout 60000ms exceeded');
    });
  });

  describe('logout', () => {
    it('signs out through the account menu', async () => {
      await service.logout({ page });

      expect(page.reload).toHaveBeenCalled();
      expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'M', exact: true });
      expect(page.locatorFor(role('button', 'M')).click).toHaveBeenCalled();
      expect(page.locatorFor(role('button', 'Log Out')).click).toHaveBeenCalled();
      expect(page.locatorFor('#mastheads_menu').waitFor).toHaveBeenCalled();
    });
  });
});
