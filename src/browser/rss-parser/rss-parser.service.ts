import { Injectable } from '@nestjs/common';
import * as Parser from 'rss-parser'; // ref: https://github.com/dsyncerek/pwa-rss-reader/blob/master/server/src/modules/rss/rss.service.ts#L2
import { WinstonLoggerService } from 'src/logger';

@Injectable()
export class RssParserService {
  private parser: Parser = new Parser({});

  constructor(private logger: WinstonLoggerService) {
    this.logger.setContext(RssParserService.name);
  }

  async parseURL(url) {
    return this.parser.parseURL(url);
  }
}
