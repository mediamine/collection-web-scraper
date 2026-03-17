import { Test, TestingModule } from '@nestjs/testing';
import { NelsonMailSubscription2Service } from './nelson-mail.service';

describe('NelsonMailSubscription2Service', () => {
  let service: NelsonMailSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NelsonMailSubscription2Service]
    }).compile();

    service = module.get<NelsonMailSubscription2Service>(NelsonMailSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
