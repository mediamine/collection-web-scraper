import { Test, TestingModule } from '@nestjs/testing';
import { BeehiveService } from './beehive.service';

describe('BeehiveService', () => {
  let service: BeehiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BeehiveService]
    }).compile();

    service = module.get<BeehiveService>(BeehiveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
