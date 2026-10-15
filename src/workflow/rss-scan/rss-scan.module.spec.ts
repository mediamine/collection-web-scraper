import { TestingModule } from '@nestjs/testing';
import { NEWS_ITEM_SOURCE_BEEHIVE, NEWS_ITEM_SOURCE_NEWSTALK_ZB } from 'src/constant/feedScrapers';
import { BeehiveService, NewstalkZBService } from 'src/publication/rss-scan';
import { compileWorkflowModule } from 'src/testing/workflow-testing';
import { RssScanModule } from './rss-scan.module';
import { RssScanService } from './rss-scan.service';

describe('RssScanModule', () => {
  let moduleRef: TestingModule;
  let service: RssScanService;

  beforeAll(async () => {
    moduleRef = await compileWorkflowModule(RssScanModule);
    service = moduleRef.get(RssScanService);
  });

  it('provides the workflow service', () => {
    expect(service).toBeInstanceOf(RssScanService);
  });

  // The workflow finds a feed's scraper by the token string in its FEEDS_TO_IDS_* config, through its own
  // ModuleRef, so this is the lookup production makes
  it.each([
    [NEWS_ITEM_SOURCE_NEWSTALK_ZB, NewstalkZBService],
    [NEWS_ITEM_SOURCE_BEEHIVE, BeehiveService]
  ])('resolves the %s token to its scraper', (token, Scraper) => {
    expect(service['moduleRef'].get(token, { strict: false })).toBeInstanceOf(Scraper);
  });
});
