import { Injectable } from '@nestjs/common';
import * as Parser from 'rss-parser'; // ref: https://github.com/dsyncerek/pwa-rss-reader/blob/master/server/src/modules/rss/rss.service.ts#L2
import { WinstonLoggerService } from 'src/logger';

// Beehive sits behind Imperva Incapsula, which answers rss-parser's default 'User-Agent: rss-parser' with
// a ~1KB HTML bot challenge instead of the feed. xml2js then rejects that page with a sax error such as
// "Attribute without value ... Char: >". A browser User-Agent is served the real feed. Newstalk ZB serves
// XML to any client, so these headers are harmless there.
const RSS_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8'
};

@Injectable()
export class RssParserService {
  // rss-parser merges these over its own defaults, so they replace its bot-like User-Agent
  private parser: Parser = new Parser({ headers: RSS_REQUEST_HEADERS });

  constructor(private logger: WinstonLoggerService) {
    this.logger.setContext(RssParserService.name);
  }

  async parseURL(url: string) {
    return this.parser.parseURL(url);
  }
}
