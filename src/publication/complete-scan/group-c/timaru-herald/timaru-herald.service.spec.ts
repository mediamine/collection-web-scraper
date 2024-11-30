import { Test, TestingModule } from '@nestjs/testing';
import { TimaruHeraldSubscriptionService } from './timaru-herald.service';

describe('TimaruHeraldSubscriptionService', () => {
  let service: TimaruHeraldSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimaruHeraldSubscriptionService]
    }).compile();

    service = module.get<TimaruHeraldSubscriptionService>(TimaruHeraldSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
