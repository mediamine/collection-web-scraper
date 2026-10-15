import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { SouthlandTimesService } from './southland-times.service';

describeEmptySubclass(SouthlandTimesService, GroupBService);
