import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupDService } from '../group-d.service';
import { ThePress2Service } from './the-press.service';

describeSectionScraper(ThePress2Service, GroupDService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'Opinion', 'South Island', 'Business', 'Politics', 'Sport', 'World news']
});
