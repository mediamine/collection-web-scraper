import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { ManawatuStandardSubscriptionService } from './manawatu-standard.service';

describeEmptySubclass(ManawatuStandardSubscriptionService, GroupCService);
