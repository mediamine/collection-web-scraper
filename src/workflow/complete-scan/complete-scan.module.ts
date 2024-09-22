import { Module } from '@nestjs/common';
import { PlaywrightService } from 'src/browser';
import {
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS,
  NEWS_ITEM_SOURCE_NELSON_MAIL,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS,
  NEWS_ITEM_SOURCE_THE_POST,
  NEWS_ITEM_SOURCE_THE_PRESS,
  NEWS_ITEM_SOURCE_TIMARU_HERALD,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES
} from 'src/constant/feedScrapers';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import {
  ManawatuStandardService,
  MarlboroughExpressService,
  NelsonMailService,
  SouthlandTimesService,
  TaranakiDailyNewsService,
  ThePostService,
  ThePressService,
  TimaruHeraldService,
  WaikatoTimesService
} from 'src/publication/complete-scan';
import { CompleteScanService } from './complete-scan.service';

@Module({
  providers: [
    WinstonLoggerService,
    PrismaService,
    PlaywrightService,
    CompleteScanService,
    { provide: NEWS_ITEM_SOURCE_THE_POST, useClass: ThePostService },
    { provide: NEWS_ITEM_SOURCE_THE_PRESS, useClass: ThePressService },
    { provide: NEWS_ITEM_SOURCE_WAIKATO_TIMES, useClass: WaikatoTimesService },
    { provide: NEWS_ITEM_SOURCE_MANAWATU_STANDARD, useClass: ManawatuStandardService },
    { provide: NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS, useClass: MarlboroughExpressService },
    { provide: NEWS_ITEM_SOURCE_NELSON_MAIL, useClass: NelsonMailService },
    { provide: NEWS_ITEM_SOURCE_SOUTHLAND_TIMES, useClass: SouthlandTimesService },
    { provide: NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS, useClass: TaranakiDailyNewsService },
    { provide: NEWS_ITEM_SOURCE_TIMARU_HERALD, useClass: TimaruHeraldService }
  ],
  exports: [
    CompleteScanService,
    NEWS_ITEM_SOURCE_THE_POST,
    NEWS_ITEM_SOURCE_THE_PRESS,
    NEWS_ITEM_SOURCE_WAIKATO_TIMES,
    NEWS_ITEM_SOURCE_MANAWATU_STANDARD,
    NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS,
    NEWS_ITEM_SOURCE_NELSON_MAIL,
    NEWS_ITEM_SOURCE_SOUTHLAND_TIMES,
    NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS,
    NEWS_ITEM_SOURCE_TIMARU_HERALD
  ]
})
export class CompleteScanModule {}
