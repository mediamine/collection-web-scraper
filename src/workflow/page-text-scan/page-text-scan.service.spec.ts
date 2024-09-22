import { Test, TestingModule } from '@nestjs/testing';
import { PageTextScanService } from './page-text-scan.service';

describe('PageTextScanService', () => {
  let service: PageTextScanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageTextScanService]
    }).compile();

    service = module.get<PageTextScanService>(PageTextScanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
