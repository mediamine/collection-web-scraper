import { describeSectionScraper } from 'src/testing/scraper-testing';
import { GroupAService } from '../group-a.service';
import { ThePostService } from './the-post.service';

describeSectionScraper(ThePostService, GroupAService, {
  anchor: '#mastheads_menu',
  sections: ['Politics', 'Business Report', 'National news', 'Opinion', 'Sport', 'World news']
});
