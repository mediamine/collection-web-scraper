import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { SouthlandTimesSubscriptionService } from './southland-times.service';

describeEmptySubclass(SouthlandTimesSubscriptionService, GroupCService);
