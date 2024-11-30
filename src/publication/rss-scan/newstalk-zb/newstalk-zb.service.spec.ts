import { Test, TestingModule } from '@nestjs/testing';
import { NewstalkZBService } from './newstalk-zb.service';

describe('NewstalkZBService', () => {
  let service: NewstalkZBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewstalkZBService]
    }).compile();

    service = module.get<NewstalkZBService>(NewstalkZBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
