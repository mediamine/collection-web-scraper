import { Test, TestingModule } from '@nestjs/testing';
import { CompleteScanService } from './complete-scan.service';

describe('CompleteScanService', () => {
  let service: CompleteScanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompleteScanService]
    }).compile();

    service = module.get<CompleteScanService>(CompleteScanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
