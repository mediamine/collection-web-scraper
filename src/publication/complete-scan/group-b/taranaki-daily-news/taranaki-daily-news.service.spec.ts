import { Test, TestingModule } from '@nestjs/testing';
import { TaranakiDailyNewsService } from './taranaki-daily-news.service';

describe('TaranakiDailyNewsService', () => {
  let service: TaranakiDailyNewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaranakiDailyNewsService]
    }).compile();

    service = module.get<TaranakiDailyNewsService>(TaranakiDailyNewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
