import { Test, TestingModule } from '@nestjs/testing';
import { SundayStarTimesSubscriptionService } from './sunday-star-times.service';

describe('SundayStarTimesSubscriptionService', () => {
  let service: SundayStarTimesSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SundayStarTimesSubscriptionService]
    }).compile();

    service = module.get<SundayStarTimesSubscriptionService>(SundayStarTimesSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
