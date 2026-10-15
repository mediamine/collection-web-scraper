import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { SouthlandTimesSubscription2Service } from './southland-times.service';

describeEmptySubclass(SouthlandTimesSubscription2Service, GroupFService);
