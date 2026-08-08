import { Test, TestingModule } from '@nestjs/testing';
import { OtagoDailyTimesService } from './otago-daily-times.service';

describe('OtagoDailyTimesService', () => {
  let service: OtagoDailyTimesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtagoDailyTimesService]
    }).compile();

    service = module.get<OtagoDailyTimesService>(OtagoDailyTimesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
