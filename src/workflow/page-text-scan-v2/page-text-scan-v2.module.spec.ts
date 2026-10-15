import { TestingModule } from '@nestjs/testing';
import { NEWS_ITEM_SOURCE_OTAGO_DAILY_TIMES } from 'src/constant/feedScrapers';
import { OtagoDailyTimesService } from 'src/publication/page-text-scan-v2';
import { compileWorkflowModule } from 'src/testing/workflow-testing';
import { PageTextScanV2Module } from './page-text-scan-v2.module';
import { PageTextScanV2Service } from './page-text-scan-v2.service';

describe('PageTextScanV2Module', () => {
  let moduleRef: TestingModule;
  let service: PageTextScanV2Service;

  beforeAll(async () => {
    moduleRef = await compileWorkflowModule(PageTextScanV2Module);
    service = moduleRef.get(PageTextScanV2Service);
  });

  it('provides the workflow service', () => {
    expect(service).toBeInstanceOf(PageTextScanV2Service);
  });

  // The workflow finds a feed's scraper by the token string in its FEEDS_TO_IDS_* config, through its own
  // ModuleRef, so this is the lookup production makes
  it.each([[NEWS_ITEM_SOURCE_OTAGO_DAILY_TIMES, OtagoDailyTimesService]])('resolves the %s token to its scraper', (token, Scraper) => {
    expect(service['moduleRef'].get(token, { strict: false })).toBeInstanceOf(Scraper);
  });
});
