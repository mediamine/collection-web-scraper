import { Test, TestingModule } from '@nestjs/testing';
import { WairarapaTimesAgeSubscriptionService } from './wairarapa-times-age.service';

describe('WairarapaTimesAgeSubscriptionService', () => {
  let service: WairarapaTimesAgeSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WairarapaTimesAgeSubscriptionService]
    }).compile();

    service = module.get<WairarapaTimesAgeSubscriptionService>(WairarapaTimesAgeSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
