import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { TimaruHeraldService } from './timaru-herald.service';

describeEmptySubclass(TimaruHeraldService, GroupBService);
