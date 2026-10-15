import { describeEmptySubclass } from 'src/testing/scraper-testing';
import { GroupBService } from '../group-b.service';
import { NelsonMailService } from './nelson-mail.service';

describeEmptySubclass(NelsonMailService, GroupBService);
