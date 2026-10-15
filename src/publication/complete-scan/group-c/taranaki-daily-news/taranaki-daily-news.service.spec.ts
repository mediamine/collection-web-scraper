import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { TaranakiDailyNewsSubscriptionService } from './taranaki-daily-news.service';

describeEmptySubclass(TaranakiDailyNewsSubscriptionService, GroupCService);
