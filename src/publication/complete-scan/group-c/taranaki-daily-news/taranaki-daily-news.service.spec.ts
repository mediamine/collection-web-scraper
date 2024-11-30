import { Test, TestingModule } from '@nestjs/testing';
import { TaranakiDailyNewsSubscriptionService } from './taranaki-daily-news.service';

describe('TaranakiDailyNewsSubscriptionService', () => {
  let service: TaranakiDailyNewsSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaranakiDailyNewsSubscriptionService]
    }).compile();

    service = module.get<TaranakiDailyNewsSubscriptionService>(TaranakiDailyNewsSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
