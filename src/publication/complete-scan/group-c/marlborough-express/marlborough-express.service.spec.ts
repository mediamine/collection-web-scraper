import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { MarlboroughExpressSubscriptionService } from './marlborough-express.service';

describeEmptySubclass(MarlboroughExpressSubscriptionService, GroupCService);
