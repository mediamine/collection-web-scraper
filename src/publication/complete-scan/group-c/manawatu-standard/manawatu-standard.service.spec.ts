import { Test, TestingModule } from '@nestjs/testing';
import { ManawatuStandardSubscriptionService } from './manawatu-standard.service';

describe('ManawatuStandardSubscriptionService', () => {
  let service: ManawatuStandardSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManawatuStandardSubscriptionService]
    }).compile();

    service = module.get<ManawatuStandardSubscriptionService>(ManawatuStandardSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
