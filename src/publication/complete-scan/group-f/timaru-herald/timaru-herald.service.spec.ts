import { Test, TestingModule } from '@nestjs/testing';
import { TimaruHeraldSubscription2Service } from './timaru-herald.service';

describe('TimaruHeraldSubscription2Service', () => {
  let service: TimaruHeraldSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimaruHeraldSubscription2Service]
    }).compile();

    service = module.get<TimaruHeraldSubscription2Service>(TimaruHeraldSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
