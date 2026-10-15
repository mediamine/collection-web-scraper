import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupEService } from '../group-e.service';
import { WaikatoTimes3Service } from './waikato-times.service';

describeSectionScraper(WaikatoTimes3Service, GroupEService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'History', 'World news', 'Sport']
});
