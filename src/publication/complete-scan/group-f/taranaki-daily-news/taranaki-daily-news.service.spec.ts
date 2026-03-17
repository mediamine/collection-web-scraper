import { Test, TestingModule } from '@nestjs/testing';
import { TaranakiDailyNewsSubscription2Service } from './taranaki-daily-news.service';

describe('TaranakiDailyNewsSubscription2Service', () => {
  let service: TaranakiDailyNewsSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaranakiDailyNewsSubscription2Service]
    }).compile();

    service = module.get<TaranakiDailyNewsSubscription2Service>(TaranakiDailyNewsSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
