import { Test, TestingModule } from '@nestjs/testing';
import { WairarapaTimesAgeSubscription2Service } from './wairarapa-times-age.service';

describe('WairarapaTimesAgeSubscription2Service', () => {
  let service: WairarapaTimesAgeSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WairarapaTimesAgeSubscription2Service]
    }).compile();

    service = module.get<WairarapaTimesAgeSubscription2Service>(WairarapaTimesAgeSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
