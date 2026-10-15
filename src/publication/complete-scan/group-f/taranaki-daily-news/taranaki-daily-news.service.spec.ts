import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { TaranakiDailyNewsSubscription2Service } from './taranaki-daily-news.service';

describeEmptySubclass(TaranakiDailyNewsSubscription2Service, GroupFService);
