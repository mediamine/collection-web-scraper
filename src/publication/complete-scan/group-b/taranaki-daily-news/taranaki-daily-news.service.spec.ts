import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { TaranakiDailyNewsService } from './taranaki-daily-news.service';

describeEmptySubclass(TaranakiDailyNewsService, GroupBService);
