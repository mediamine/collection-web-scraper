import { createMockPage, MockLocatorSpec, MockPage } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupFService } from './group-f.service';

const article = (href: string, title: string): MockLocatorSpec => ({
  children: {
    'div[data-testid="grid-card-content"] > a': { getAttribute: href },
    h3: { innerText: title }
  }
});

describe('GroupFService', () => {
  let service: GroupFService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(GroupFService));
    page = createMockPage();
  });

  describe('authenticate', () => {
    it('does nothing, as these sites are scraped signed out', async () => {
      await expect(service.authenticate({ page })).resolves.toBeUndefined();
      expect(page.locator).not.toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    it('reads every article box on the page', async () => {
      page = createMockPage({
        'div[data-testid="box-container"] article': { all: [article('/nz-news/one', 'One'), article('/nz-news/two', 'Two')] }
      });

      const links = await service.getLinks({ page, url: TEST_URL });

      expect(page.locatorFor('div[data-testid="box-container"]').waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${TEST_URL}/nz-news/one`, title: 'One', description: '' },
        { link: `${TEST_URL}/nz-news/two`, title: 'Two', description: '' }
      ]);
    });
  });

  describe('scanHome', () => {
    it('collects the links once the page content has loaded', async () => {
      const links = [{ link: `${TEST_URL}/nz-news/one`, title: 'One', description: '' }];
      const getLinks = jest.spyOn(service, 'getLinks').mockResolvedValue(links);

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual(links);
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
      expect(getLinks).toHaveBeenCalledWith({ page, url: TEST_URL });
    });

    it('propagates a home page that never loads', async () => {
      page = createMockPage({ 'section.page-content': { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.scanHome({ page, url: TEST_URL })).rejects.toThrow('Timeout 60000ms exceeded');
    });

    it('returns no links when the article boxes cannot be read', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Box container missing'));

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Box container missing');
    });

    // Known defect: the failure goes to console.error, so it never reaches the rotated log files
    it.failing('reports a failed scan through the logger', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Box container missing'));

      await service.scanHome({ page, url: TEST_URL });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('scanArticle', () => {
    it('reads the body paragraphs of the article', async () => {
      page = createMockPage({ 'div[data-testid="body-paragraph"] > p': { allTextContents: ['First. ', 'Second.'] } });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/nz-news/one` })).resolves.toEqual({ text: 'First. Second.' });
      expect(page.goto).toHaveBeenCalledWith(`${TEST_URL}/nz-news/one`, { timeout: 60000 });
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
    });

    it('still joins the free and the paywalled paragraphs of the older article layout', async () => {
      page = createMockPage({
        'div.text-block > p': { allTextContents: ['First. '] },
        'div.text-block > div.paywall > p': { allTextContents: ['Second.'] }
      });

      await expect(service.scanArticle({ page, url: `${TEST_URL}/nz-news/one` })).resolves.toEqual({ text: 'First. Second.' });
    });
  });

  describe('logout', () => {
    it('does nothing, as there is no session', async () => {
      await expect(service.logout({ page })).resolves.toBeUndefined();
      expect(page.reload).not.toHaveBeenCalled();
    });
  });
});
