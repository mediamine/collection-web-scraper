import { Module } from '@nestjs/common';
import { PlaywrightService } from 'src/browser';
import { NEWS_ITEM_SOURCE_OTAGO_DAILY_TIMES } from 'src/constant/feedScrapers';
import { WinstonLoggerService } from 'src/logger';
import { OtagoDailyTimesService } from 'src/publication/page-text-scan-v2';
import { PageTextScanV2Service } from './page-text-scan-v2.service';

@Module({
  providers: [
    WinstonLoggerService,
    PlaywrightService,
    PageTextScanV2Service,
    { provide: NEWS_ITEM_SOURCE_OTAGO_DAILY_TIMES, useClass: OtagoDailyTimesService }
  ],
  exports: [PageTextScanV2Service, NEWS_ITEM_SOURCE_OTAGO_DAILY_TIMES]
})
export class PageTextScanV2Module {}
