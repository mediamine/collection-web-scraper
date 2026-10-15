import * as Parser from 'rss-parser';
import { createServiceModule } from 'src/testing/scraper-testing';
import { RssParserService } from './rss-parser.service';

jest.mock('rss-parser', () => jest.fn().mockImplementation(() => ({ parseURL: jest.fn() })));

const ParserMock = Parser as unknown as jest.Mock;

describe('RssParserService', () => {
  let service: RssParserService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];

  beforeEach(async () => {
    ({ service, logger } = await createServiceModule(RssParserService));
  });

  it('sets its logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith(RssParserService.name);
  });

  it("sends a browser's User-Agent, as Beehive's bot protection answers rss-parser's own with an HTML challenge", () => {
    expect(ParserMock).toHaveBeenCalledTimes(1);
    expect(ParserMock).toHaveBeenCalledWith({
      headers: {
        'User-Agent': expect.stringMatching(/^Mozilla\/5\.0 .*Chrome\/[\d.]+ Safari\/[\d.]+$/),
        Accept: expect.stringContaining('application/rss+xml')
      }
    });
    expect(ParserMock.mock.calls[0][0].headers['User-Agent']).not.toContain('rss-parser');
  });

  it('parses a feed url', async () => {
    const feed = { items: [{ title: 'One' }] };
    const { parseURL } = ParserMock.mock.results[0].value;
    parseURL.mockResolvedValue(feed);

    await expect(service.parseURL('https://www.beehive.govt.nz/rss.xml')).resolves.toBe(feed);
    expect(parseURL).toHaveBeenCalledWith('https://www.beehive.govt.nz/rss.xml');
  });

  it('propagates a feed that cannot be parsed', async () => {
    ParserMock.mock.results[0].value.parseURL.mockRejectedValue(new Error('Attribute without value'));

    await expect(service.parseURL('https://www.beehive.govt.nz/rss.xml')).rejects.toThrow('Attribute without value');
  });
});
