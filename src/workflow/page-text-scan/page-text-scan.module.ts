import { Module } from '@nestjs/common';
import { PlaywrightService } from 'src/browser';
import {
  NEWS_ITEM_SOURCE_BUSINESS_DESK,
  NEWS_ITEM_SOURCE_NATIONAL_BUSINESS_REVIEW,
  NEWS_ITEM_SOURCE_STUFF
} from 'src/constant/feedScrapers';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { BusinessDeskService, NationalBusinessReviewService, StuffService } from 'src/publication/page-text-scan';
import { PageTextScanService } from './page-text-scan.service';

@Module({
  providers: [
    WinstonLoggerService,
    PrismaService,
    PlaywrightService,
    PageTextScanService,
    { provide: NEWS_ITEM_SOURCE_BUSINESS_DESK, useClass: BusinessDeskService },
    { provide: NEWS_ITEM_SOURCE_NATIONAL_BUSINESS_REVIEW, useClass: NationalBusinessReviewService },
    { provide: NEWS_ITEM_SOURCE_STUFF, useClass: StuffService }
  ],
  exports: [PageTextScanService, NEWS_ITEM_SOURCE_BUSINESS_DESK, NEWS_ITEM_SOURCE_NATIONAL_BUSINESS_REVIEW, NEWS_ITEM_SOURCE_STUFF]
})
export class PageTextScanModule {}
