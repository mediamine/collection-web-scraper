import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { ManawatuStandardService } from './manawatu-standard.service';

describeEmptySubclass(ManawatuStandardService, GroupBService);
