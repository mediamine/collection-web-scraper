import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupDService } from '../group-d.service';
import { WaikatoTimes2Service } from './waikato-times.service';

describeSectionScraper(WaikatoTimes2Service, GroupDService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'Politics', 'History', 'World news', 'Sport']
});
