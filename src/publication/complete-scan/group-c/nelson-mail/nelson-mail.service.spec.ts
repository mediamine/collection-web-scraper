import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupCService } from '../group-c.service';
import { NelsonMailSubscriptionService } from './nelson-mail.service';

describeEmptySubclass(NelsonMailSubscriptionService, GroupCService);
