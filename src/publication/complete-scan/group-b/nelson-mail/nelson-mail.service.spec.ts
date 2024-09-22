import { Test, TestingModule } from '@nestjs/testing';
import { NelsonMailService } from './nelson-mail.service';

describe('NelsonMailService', () => {
  let service: NelsonMailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NelsonMailService]
    }).compile();

    service = module.get<NelsonMailService>(NelsonMailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
