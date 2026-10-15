import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { TimaruHeraldSubscriptionService } from './timaru-herald.service';

describeEmptySubclass(TimaruHeraldSubscriptionService, GroupCService);
