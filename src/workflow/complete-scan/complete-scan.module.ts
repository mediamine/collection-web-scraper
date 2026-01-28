import { Module } from '@nestjs/common';
import { PlaywrightService } from 'src/browser';
import {
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD,
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_NELSON_MAIL,
  NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_THE_POST,
  NEWS_ITEM_SOURCE_THE_POST_2,
  NEWS_ITEM_SOURCE_THE_PRESS,
  NEWS_ITEM_SOURCE_THE_PRESS_2,
  NEWS_ITEM_SOURCE_TIMARU_HERALD,
  NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES_2,
  NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION
} from 'src/constant/feedScrapers';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import {
  ManawatuStandardService,
  ManawatuStandardSubscriptionService,
  MarlboroughExpressService,
  MarlboroughExpressSubscriptionService,
  NelsonMailService,
  NelsonMailSubscriptionService,
  SouthlandTimesService,
  SouthlandTimesSubscriptionService,
  SundayStarTimesSubscriptionService,
  TaranakiDailyNewsService,
  TaranakiDailyNewsSubscriptionService,
  ThePost2Service,
  ThePostService,
  ThePress2Service,
  ThePressService,
  TimaruHeraldService,
  TimaruHeraldSubscriptionService,
  WaikatoTimes2Service,
  WaikatoTimesService,
  WairarapaTimesAgeSubscriptionService
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
    { provide: NEWS_ITEM_SOURCE_TIMARU_HERALD, useClass: TimaruHeraldService },
    { provide: NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION, useClass: ManawatuStandardSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION, useClass: MarlboroughExpressSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION, useClass: NelsonMailSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION, useClass: SouthlandTimesSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION, useClass: SundayStarTimesSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION, useClass: TaranakiDailyNewsSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION, useClass: TimaruHeraldSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION, useClass: WairarapaTimesAgeSubscriptionService },
    { provide: NEWS_ITEM_SOURCE_THE_POST_2, useClass: ThePost2Service },
    { provide: NEWS_ITEM_SOURCE_THE_PRESS_2, useClass: ThePress2Service },
    { provide: NEWS_ITEM_SOURCE_WAIKATO_TIMES_2, useClass: WaikatoTimes2Service }
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
    NEWS_ITEM_SOURCE_TIMARU_HERALD,
    NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION,
    NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION
  ]
})
export class CompleteScanModule {}
