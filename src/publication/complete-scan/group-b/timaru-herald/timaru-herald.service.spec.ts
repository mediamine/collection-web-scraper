import { Test, TestingModule } from '@nestjs/testing';
import { TimaruHeraldService } from './timaru-herald.service';

describe('TimaruHeraldService', () => {
  let service: TimaruHeraldService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimaruHeraldService]
    }).compile();

    service = module.get<TimaruHeraldService>(TimaruHeraldService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
