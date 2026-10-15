import { role } from 'src/testing/mock-playwright';
import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupDService } from '../group-d.service';
import { ThePost2Service } from './the-post.service';

describeSectionScraper(ThePost2Service, GroupDService, {
  anchor: role('button', 'Toggle navigation menu'),
  sections: ['NZ news', 'Politics', 'Business', 'Culture', 'Opinion', 'Sport', 'World']
});
