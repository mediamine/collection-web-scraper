import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { TimaruHeraldSubscription2Service } from './timaru-herald.service';

describeEmptySubclass(TimaruHeraldSubscription2Service, GroupFService);
