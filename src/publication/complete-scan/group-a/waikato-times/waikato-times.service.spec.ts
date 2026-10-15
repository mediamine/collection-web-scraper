import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupAService } from '../group-a.service';
import { WaikatoTimesService } from './waikato-times.service';

describeSectionScraper(WaikatoTimesService, GroupAService, {
  anchor: '#mastheads_menu',
  sections: ['News', 'Politics', 'Business', 'History', 'World news', 'Sport']
});
