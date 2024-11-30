import { Module } from '@nestjs/common';
import { PlaywrightService } from 'src/browser';
import { RssParserService } from 'src/browser/rss-parser/rss-parser.service';
import { NEWS_ITEM_SOURCE_NEWSTALK_ZB } from 'src/constant/feedScrapers';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { NewstalkZBService } from 'src/publication/rss-scan';
import { RssScanService } from './rss-scan.service';

@Module({
  providers: [
    WinstonLoggerService,
    PrismaService,
    PlaywrightService,
    RssParserService,
    RssScanService,
    { provide: NEWS_ITEM_SOURCE_NEWSTALK_ZB, useClass: NewstalkZBService }
  ],
  exports: [RssScanService, NEWS_ITEM_SOURCE_NEWSTALK_ZB]
})
export class RssScanModule {}
