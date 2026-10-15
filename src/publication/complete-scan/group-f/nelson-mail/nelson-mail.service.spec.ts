import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupFService } from '../group-f.service';
import { NelsonMailSubscription2Service } from './nelson-mail.service';

describeEmptySubclass(NelsonMailSubscription2Service, GroupFService);
