import { RssParserService } from 'src/browser/rss-parser/rss-parser.service';
import { createMockPage } from 'src/testing/mock-playwright';
import { createServiceModule } from 'src/testing/scraper-testing';
import { NewstalkZBService } from './newstalk-zb.service';

const FEED_URL = 'https://www.newstalkzb.co.nz/rss/news/';

describe('NewstalkZBService', () => {
  let service: NewstalkZBService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let parser: { parseURL: jest.Mock };

  beforeEach(async () => {
    parser = { parseURL: jest.fn() };
    ({ service, logger } = await createServiceModule(NewstalkZBService, { providers: [{ provide: RssParserService, useValue: parser }] }));
  });

  it('sets its logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith(NewstalkZBService.name);
  });

  it('needs no session, so authenticate and logout do nothing', async () => {
    const page = createMockPage();

    await expect(service.authenticate({ page })).resolves.toBeUndefined();
    await expect(service.logout({ page })).resolves.toBeUndefined();
    expect(page.goto).not.toHaveBeenCalled();
  });

  describe('scanHome', () => {
    it("maps every feed item to a link, using the item's content snippet as its description", async () => {
      parser.parseURL.mockResolvedValue({
        items: [
          { link: `${FEED_URL}/one`, title: 'One', contentSnippet: 'First item', content: '<p>First item</p>' },
          { link: `${FEED_URL}/two`, title: 'Two', contentSnippet: undefined }
        ]
      });

      await expect(service.scanHome({ url: FEED_URL })).resolves.toEqual([
        { link: `${FEED_URL}/one`, title: 'One', description: 'First item' },
        { link: `${FEED_URL}/two`, title: 'Two', description: undefined }
      ]);
      expect(parser.parseURL).toHaveBeenCalledWith(FEED_URL);
    });

    it('returns no links for an empty feed', async () => {
      parser.parseURL.mockResolvedValue({ items: [] });

      await expect(service.scanHome({ url: FEED_URL })).resolves.toEqual([]);
    });

    it('propagates a feed that cannot be parsed', async () => {
      parser.parseURL.mockRejectedValue(new Error('Attribute without value'));

      await expect(service.scanHome({ url: FEED_URL })).rejects.toThrow('Attribute without value');
    });
  });

  it('has no article page to scan, as the RSS description is the page text', () => {
    expect(() => service.scanArticle({ url: `${FEED_URL}/one` })).toThrow('Method not implemented.');
  });
});
