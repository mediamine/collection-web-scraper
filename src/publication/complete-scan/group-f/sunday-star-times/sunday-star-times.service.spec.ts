import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { SundayStarTimesSubscription2Service } from './sunday-star-times.service';

describeEmptySubclass(SundayStarTimesSubscription2Service, GroupFService);
