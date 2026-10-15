import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { SundayStarTimesSubscriptionService } from './sunday-star-times.service';

describeEmptySubclass(SundayStarTimesSubscriptionService, GroupCService);
