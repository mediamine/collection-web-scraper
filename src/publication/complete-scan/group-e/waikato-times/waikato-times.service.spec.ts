import { Test, TestingModule } from '@nestjs/testing';
import { WaikatoTimes2Service } from './waikato-times.service';

describe('WaikatoTimes2Service', () => {
  let service: WaikatoTimes2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaikatoTimes2Service]
    }).compile();

    service = module.get<WaikatoTimes2Service>(WaikatoTimes2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
