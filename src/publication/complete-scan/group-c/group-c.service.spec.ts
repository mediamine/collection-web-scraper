import { createMockPage, MockLocatorSpec, MockPage } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupCService } from './group-c.service';

const card = (href: string, title: string, description: string): MockLocatorSpec => ({
  children: {
    a: { getAttribute: href },
    'ion-card-title': { innerText: title },
    'ion-card-content > .sf-desc': { innerText: description }
  }
});

describe('GroupCService', () => {
  let service: GroupCService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(GroupCService));
    page = createMockPage();
  });

  describe('authenticate', () => {
    it('does nothing, as these sites are scraped signed out', async () => {
      await expect(service.authenticate({ page })).resolves.toBeUndefined();
      expect(page.locator).not.toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    it('reads every story card on the page', async () => {
      page = createMockPage({
        'div.story-list-medium-container ion-card': { all: [card('/nz-news/one', 'One', 'First story')] },
        'div.list-stories-frame > div.stories-block ion-card': { all: [card('/nz-news/two', 'Two', 'Second story')] }
      });

      const links = await service.getLinks({ page, url: TEST_URL });

      expect(page.locatorFor('div.story-list-medium-container').waitFor).toHaveBeenCalled();
      expect(page.locatorFor('div.list-stories-frame > div.stories-block').waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${TEST_URL}/nz-news/one`, title: 'One', description: 'First story' },
        { link: `${TEST_URL}/nz-news/two`, title: 'Two', description: 'Second story' }
      ]);
    });

    it('returns no links for a page without story cards', async () => {
      await expect(service.getLinks({ page, url: TEST_URL })).resolves.toEqual([]);
    });
  });

  describe('scanHome', () => {
    it('collects the links once the page content has loaded', async () => {
      const links = [{ link: `${TEST_URL}/nz-news/one`, title: 'One', description: 'First story' }];
      const getLinks = jest.spyOn(service, 'getLinks').mockResolvedValue(links);

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual(links);
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
      expect(getLinks).toHaveBeenCalledWith({ page, url: TEST_URL });
    });

    it('propagates a home page that never loads', async () => {
      page = createMockPage({ 'section.page-content': { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.scanHome({ page, url: TEST_URL })).rejects.toThrow('Timeout 60000ms exceeded');
    });

    it('returns no links when the story cards cannot be read', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Story list missing'));

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Story list missing');
    });

    // Known defect: the failure goes to console.error, so it never reaches the rotated log files
    it.failing('reports a failed scan through the logger', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Story list missing'));

      await service.scanHome({ page, url: TEST_URL });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('scanArticle', () => {
    it('joins the free and the paywalled paragraphs of the article', async () => {
      page = createMockPage({
        'div.text-block > p': { allTextContents: ['First. '] },
        'div.text-block > div.paywall > p': { allTextContents: ['Second.'] }
      });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/nz-news/one` })).resolves.toEqual({ text: 'First. Second.' });
      expect(page.goto).toHaveBeenCalledWith(`${TEST_URL}/nz-news/one`, { timeout: 60000 });
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('does nothing, as there is no session', async () => {
      await expect(service.logout({ page })).resolves.toBeUndefined();
      expect(page.reload).not.toHaveBeenCalled();
    });
  });
});
