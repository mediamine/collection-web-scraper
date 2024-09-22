import { Test, TestingModule } from '@nestjs/testing';
import { SouthlandTimesService } from './southland-times.service';

describe('SouthlandTimesService', () => {
  let service: SouthlandTimesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SouthlandTimesService]
    }).compile();

    service = module.get<SouthlandTimesService>(SouthlandTimesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
