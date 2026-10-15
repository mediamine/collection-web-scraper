import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupEService } from '../group-e.service';
import { ThePost3Service } from './the-post.service';

describeSectionScraper(ThePost3Service, GroupEService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'Politics', 'Business', 'Culture', 'Opinion', 'Sport', 'World']
});
