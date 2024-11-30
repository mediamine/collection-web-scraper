import { Test, TestingModule } from '@nestjs/testing';
import { SouthlandTimesSubscriptionService } from './southland-times.service';

describe('SouthlandTimesSubscriptionService', () => {
  let service: SouthlandTimesSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SouthlandTimesSubscriptionService]
    }).compile();

    service = module.get<SouthlandTimesSubscriptionService>(SouthlandTimesSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
