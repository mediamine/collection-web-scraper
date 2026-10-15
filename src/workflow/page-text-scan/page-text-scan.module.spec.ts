import { TestingModule } from '@nestjs/testing';
import {
  NEWS_ITEM_SOURCE_BUSINESS_DESK,
  NEWS_ITEM_SOURCE_NATIONAL_BUSINESS_REVIEW,
  NEWS_ITEM_SOURCE_STUFF
} from 'src/constant/feedScrapers';
import { BusinessDeskService, NationalBusinessReviewService, StuffService } from 'src/publication/page-text-scan';
import { compileWorkflowModule } from 'src/testing/workflow-testing';
import { PageTextScanModule } from './page-text-scan.module';
import { PageTextScanService } from './page-text-scan.service';

describe('PageTextScanModule', () => {
  let moduleRef: TestingModule;
  let service: PageTextScanService;

  beforeAll(async () => {
    moduleRef = await compileWorkflowModule(PageTextScanModule);
    service = moduleRef.get(PageTextScanService);
  });

  it('provides the workflow service', () => {
    expect(service).toBeInstanceOf(PageTextScanService);
  });

  // The workflow finds a feed's scraper by the token string in its FEEDS_TO_IDS_* config, through its own
  // ModuleRef, so this is the lookup production makes
  it.each([
    [NEWS_ITEM_SOURCE_BUSINESS_DESK, BusinessDeskService],
    [NEWS_ITEM_SOURCE_NATIONAL_BUSINESS_REVIEW, NationalBusinessReviewService],
    [NEWS_ITEM_SOURCE_STUFF, StuffService]
  ])('resolves the %s token to its scraper', (token, Scraper) => {
    expect(service['moduleRef'].get(token, { strict: false })).toBeInstanceOf(Scraper);
  });
});
