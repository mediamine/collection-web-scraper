import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { MarlboroughExpressSubscription2Service } from './marlborough-express.service';

describeEmptySubclass(MarlboroughExpressSubscription2Service, GroupFService);
