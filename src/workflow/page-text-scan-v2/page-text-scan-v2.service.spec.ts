import { Test, TestingModule } from '@nestjs/testing';
import { PageTextScanV2Service } from './page-text-scan-v2.service';

describe('PageTextScanV2Service', () => {
  let service: PageTextScanV2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageTextScanV2Service]
    }).compile();

    service = module.get<PageTextScanV2Service>(PageTextScanV2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
