import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { MarlboroughExpressService } from './marlborough-express.service';

describeEmptySubclass(MarlboroughExpressService, GroupBService);
