import { Test, TestingModule } from '@nestjs/testing';
import { SundayStarTimesSubscription2Service } from './sunday-star-times.service';

describe('SundayStarTimesSubscription2Service', () => {
  let service: SundayStarTimesSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SundayStarTimesSubscription2Service]
    }).compile();

    service = module.get<SundayStarTimesSubscription2Service>(SundayStarTimesSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
