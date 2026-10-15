import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupAService } from '../group-a.service';
import { ThePressService } from './the-press.service';

describeSectionScraper(ThePressService, GroupAService, {
  anchor: '#mastheads_menu',
  sections: ['NZ news', 'Opinion', 'South Island', 'Business', 'Sport', 'World news']
});
