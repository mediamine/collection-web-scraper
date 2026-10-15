import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupEService } from '../group-e.service';
import { ThePress3Service } from './the-press.service';

describeSectionScraper(ThePress3Service, GroupEService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'Opinion', 'South Island', 'Business', 'Politics', 'Sport', 'World news']
});
