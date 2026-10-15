import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { ManawatuStandardSubscription2Service } from './manawatu-standard.service';

describeEmptySubclass(ManawatuStandardSubscription2Service, GroupFService);
