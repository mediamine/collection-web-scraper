import { Test, TestingModule } from '@nestjs/testing';
import { MarlboroughExpressSubscriptionService } from './marlborough-express.service';

describe('MarlboroughExpressSubscriptionService', () => {
  let service: MarlboroughExpressSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarlboroughExpressSubscriptionService]
    }).compile();

    service = module.get<MarlboroughExpressSubscriptionService>(MarlboroughExpressSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
