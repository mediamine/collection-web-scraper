import { Test, TestingModule } from '@nestjs/testing';
import { NelsonMailSubscriptionService } from './nelson-mail.service';

describe('NelsonMailSubscriptionService', () => {
  let service: NelsonMailSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NelsonMailSubscriptionService]
    }).compile();

    service = module.get<NelsonMailSubscriptionService>(NelsonMailSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
