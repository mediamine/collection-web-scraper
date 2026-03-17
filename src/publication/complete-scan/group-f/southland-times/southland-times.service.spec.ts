import { Test, TestingModule } from '@nestjs/testing';
import { SouthlandTimesSubscription2Service } from './southland-times.service';

describe('SouthlandTimesSubscription2Service', () => {
  let service: SouthlandTimesSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SouthlandTimesSubscription2Service]
    }).compile();

    service = module.get<SouthlandTimesSubscription2Service>(SouthlandTimesSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
