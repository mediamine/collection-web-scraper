import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { WairarapaTimesAgeSubscriptionService } from './wairarapa-times-age.service';

describeEmptySubclass(WairarapaTimesAgeSubscriptionService, GroupCService);
