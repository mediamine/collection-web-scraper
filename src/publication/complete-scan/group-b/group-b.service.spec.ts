import { createMockPage, MockLocatorSpec, MockPage, role } from 'src/testing/mock-playwright';
import { createServiceModule, TEST_URL } from 'src/testing/scraper-testing';
import { GroupBService } from './group-b.service';

const STUFF_URL = 'https://www.stuff.co.nz';

const CARD_LINK = 'div[data-testid="grid-row"] [data-testid="grid-card-content"] > a';

const cardLink = (href: string, title: string): MockLocatorSpec => ({
  getAttribute: href,
  children: { h3: { innerText: title } }
});

describe('GroupBService', () => {
  let service: GroupBService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: MockPage;

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(GroupBService));
    page = createMockPage();
  });

  describe('authenticate', () => {
    it('does nothing, as these sites are scraped signed out', async () => {
      await expect(service.authenticate({ page })).resolves.toBeUndefined();
      expect(page.locator).not.toHaveBeenCalled();
    });
  });

  describe('getLinks', () => {
    beforeEach(() => {
      page = createMockPage({
        [CARD_LINK]: {
          all: [cardLink('/nz-news/one', 'One'), cardLink('/nz-news/two', 'Two'), cardLink('/sport/three', 'Three')]
        }
      });
    });

    it('reads the link and headline of every card in the grid rows, using the headline as the description', async () => {
      const links = await service.getLinks({ page, url: STUFF_URL });

      expect(page.locatorFor(CARD_LINK).waitFor).toHaveBeenCalled();
      expect(links).toEqual([
        { link: `${STUFF_URL}/nz-news/one`, title: 'One', description: 'One' },
        { link: `${STUFF_URL}/nz-news/two`, title: 'Two', description: 'Two' },
        { link: `${STUFF_URL}/sport/three`, title: 'Three', description: 'Three' }
      ]);
    });

    it("builds links on stuff.co.nz whatever the feed's url", async () => {
      const links = await service.getLinks({ page, url: TEST_URL });

      expect(links.map(({ link }) => link)).toEqual([`${STUFF_URL}/nz-news/one`, `${STUFF_URL}/nz-news/two`, `${STUFF_URL}/sport/three`]);
    });

    it('propagates a page with no cards', async () => {
      page = createMockPage({ [CARD_LINK]: { rejects: { waitFor: new Error('Timeout 30000ms exceeded') } } });

      await expect(service.getLinks({ page, url: STUFF_URL })).rejects.toThrow('Timeout 30000ms exceeded');
    });
  });

  describe('scanHome', () => {
    it('collects the links once the page content has loaded', async () => {
      const links = [{ link: `${STUFF_URL}/nz-news/one`, title: 'One', description: 'One' }];
      const getLinks = jest.spyOn(service, 'getLinks').mockResolvedValue(links);

      await expect(service.scanHome({ page, url: STUFF_URL })).resolves.toEqual(links);
      expect(page.locatorFor('section.page-content').waitFor).toHaveBeenCalled();
      expect(getLinks).toHaveBeenCalledWith({ page, url: STUFF_URL });
    });

    it('propagates a home page that never loads', async () => {
      page = createMockPage({ 'section.page-content': { rejects: { waitFor: new Error('Timeout 60000ms exceeded') } } });

      await expect(service.scanHome({ page, url: STUFF_URL })).rejects.toThrow('Timeout 60000ms exceeded');
    });

    it('returns no links when the cards cannot be read', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Grid card missing'));

      await expect(service.scanHome({ page, url: STUFF_URL })).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Grid card missing');
    });

    // Known defect: the failure goes to console.error, so it never reaches the rotated log files
    it.failing('reports a failed scan through the logger', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(service, 'getLinks').mockRejectedValue(new Error('Grid card missing'));

      await service.scanHome({ page, url: STUFF_URL });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('scanArticle', () => {
    it('closes the ad overlay when one is showing, then joins the article paragraphs', async () => {
      page = createMockPage({
        [role('button', 'Close Ad')]: { isVisible: true },
        'div.content-groups p': { allTextContents: ['First. ', 'Second.'] }
      });

      await expect(service.scanArticle({ page, url: `${STUFF_URL}/nz-news/lead` })).resolves.toEqual({ text: 'First. Second.' });
      expect(page.goto).toHaveBeenCalledWith(`${STUFF_URL}/nz-news/lead`);
      expect(page.locatorFor('#ionContentElement').waitFor).toHaveBeenCalled();
      expect(page.locatorFor(role('button', 'Close Ad')).click).toHaveBeenCalled();
    });

    it('leaves the page alone when no ad is showing', async () => {
      page = createMockPage({ 'div.content-groups p': { allTextContents: ['Only.'] } });

      await expect(service.scanArticle({ page, url: `${STUFF_URL}/nz-news/lead` })).resolves.toEqual({ text: 'Only.' });
      expect(page.locatorFor(role('button', 'Close Ad')).click).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('does nothing, as there is no session', async () => {
      await expect(service.logout({ page })).resolves.toBeUndefined();
      expect(page.reload).not.toHaveBeenCalled();
    });
  });
});
