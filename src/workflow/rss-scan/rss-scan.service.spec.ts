import { Test, TestingModule } from '@nestjs/testing';
import { RssScanService } from './rss-scan.service';

describe('RSSScanService', () => {
  let service: RssScanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RssScanService]
    }).compile();

    service = module.get<RssScanService>(RssScanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
