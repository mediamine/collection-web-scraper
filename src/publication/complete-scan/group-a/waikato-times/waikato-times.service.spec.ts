import { Test, TestingModule } from '@nestjs/testing';
import { WaikatoTimesService } from './waikato-times.service';

describe('WaikatoTimesService', () => {
  let service: WaikatoTimesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaikatoTimesService]
    }).compile();

    service = module.get<WaikatoTimesService>(WaikatoTimesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
