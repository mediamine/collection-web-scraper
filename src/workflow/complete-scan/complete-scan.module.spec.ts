import { TestingModule } from '@nestjs/testing';
import {
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD,
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_NELSON_MAIL,
  NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_THE_POST,
  NEWS_ITEM_SOURCE_THE_POST_2,
  NEWS_ITEM_SOURCE_THE_POST_3,
  NEWS_ITEM_SOURCE_THE_PRESS,
  NEWS_ITEM_SOURCE_THE_PRESS_2,
  NEWS_ITEM_SOURCE_THE_PRESS_3,
  NEWS_ITEM_SOURCE_TIMARU_HERALD,
  NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION_2,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES_2,
  NEWS_ITEM_SOURCE_WAIKATO_TIMES_3,
  NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION,
  NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION_2
} from 'src/constant/feedScrapers';
import {
  ManawatuStandardService,
  ManawatuStandardSubscription2Service,
  ManawatuStandardSubscriptionService,
  MarlboroughExpressService,
  MarlboroughExpressSubscription2Service,
  MarlboroughExpressSubscriptionService,
  NelsonMailService,
  NelsonMailSubscription2Service,
  NelsonMailSubscriptionService,
  SouthlandTimesService,
  SouthlandTimesSubscription2Service,
  SouthlandTimesSubscriptionService,
  SundayStarTimesSubscription2Service,
  SundayStarTimesSubscriptionService,
  TaranakiDailyNewsService,
  TaranakiDailyNewsSubscription2Service,
  TaranakiDailyNewsSubscriptionService,
  ThePost2Service,
  ThePost3Service,
  ThePostService,
  ThePress2Service,
  ThePress3Service,
  ThePressService,
  TimaruHeraldService,
  TimaruHeraldSubscription2Service,
  TimaruHeraldSubscriptionService,
  WaikatoTimes2Service,
  WaikatoTimes3Service,
  WaikatoTimesService,
  WairarapaTimesAgeSubscription2Service,
  WairarapaTimesAgeSubscriptionService
} from 'src/publication/complete-scan';
import { compileWorkflowModule } from 'src/testing/workflow-testing';
import { CompleteScanModule } from './complete-scan.module';
import { CompleteScanService } from './complete-scan.service';

describe('CompleteScanModule', () => {
  let moduleRef: TestingModule;
  let service: CompleteScanService;

  beforeAll(async () => {
    moduleRef = await compileWorkflowModule(CompleteScanModule);
    service = moduleRef.get(CompleteScanService);
  });

  it('provides the workflow service', () => {
    expect(service).toBeInstanceOf(CompleteScanService);
  });

  // The workflow finds a feed's scraper by the token string in its FEEDS_TO_IDS_* config, through its own
  // ModuleRef, so this is the lookup production makes
  it.each([
    [NEWS_ITEM_SOURCE_THE_POST, ThePostService],
    [NEWS_ITEM_SOURCE_THE_PRESS, ThePressService],
    [NEWS_ITEM_SOURCE_WAIKATO_TIMES, WaikatoTimesService],
    [NEWS_ITEM_SOURCE_MANAWATU_STANDARD, ManawatuStandardService],
    [NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS, MarlboroughExpressService],
    [NEWS_ITEM_SOURCE_NELSON_MAIL, NelsonMailService],
    [NEWS_ITEM_SOURCE_SOUTHLAND_TIMES, SouthlandTimesService],
    [NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS, TaranakiDailyNewsService],
    [NEWS_ITEM_SOURCE_TIMARU_HERALD, TimaruHeraldService],
    [NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION, ManawatuStandardSubscriptionService],
    [NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION, MarlboroughExpressSubscriptionService],
    [NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION, NelsonMailSubscriptionService],
    [NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION, SouthlandTimesSubscriptionService],
    [NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION, SundayStarTimesSubscriptionService],
    [NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION, TaranakiDailyNewsSubscriptionService],
    [NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION, TimaruHeraldSubscriptionService],
    [NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION, WairarapaTimesAgeSubscriptionService],
    [NEWS_ITEM_SOURCE_THE_POST_2, ThePost2Service],
    [NEWS_ITEM_SOURCE_THE_PRESS_2, ThePress2Service],
    [NEWS_ITEM_SOURCE_WAIKATO_TIMES_2, WaikatoTimes2Service],
    [NEWS_ITEM_SOURCE_THE_POST_3, ThePost3Service],
    [NEWS_ITEM_SOURCE_THE_PRESS_3, ThePress3Service],
    [NEWS_ITEM_SOURCE_WAIKATO_TIMES_3, WaikatoTimes3Service],
    [NEWS_ITEM_SOURCE_MANAWATU_STANDARD_SUBSCRIPTION_2, ManawatuStandardSubscription2Service],
    [NEWS_ITEM_SOURCE_MARLBOROUGH_EXPRESS_SUBSCRIPTION_2, MarlboroughExpressSubscription2Service],
    [NEWS_ITEM_SOURCE_NELSON_MAIL_SUBSCRIPTION_2, NelsonMailSubscription2Service],
    [NEWS_ITEM_SOURCE_SOUTHLAND_TIMES_SUBSCRIPTION_2, SouthlandTimesSubscription2Service],
    [NEWS_ITEM_SOURCE_SUNDAY_STAR_TIMES_SUBSCRIPTION_2, SundayStarTimesSubscription2Service],
    [NEWS_ITEM_SOURCE_TARANAKI_DAILY_NEWS_SUBSCRIPTION_2, TaranakiDailyNewsSubscription2Service],
    [NEWS_ITEM_SOURCE_TIMARU_HERALD_SUBSCRIPTION_2, TimaruHeraldSubscription2Service],
    [NEWS_ITEM_SOURCE_WAIRARAPA_TIMES_AGE_SUBSCRIPTION_2, WairarapaTimesAgeSubscription2Service]
  ])('resolves the %s token to its scraper', (token, Scraper) => {
    expect(service['moduleRef'].get(token, { strict: false })).toBeInstanceOf(Scraper);
  });
});
