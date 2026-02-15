import { Test, TestingModule } from '@nestjs/testing';
import { GroupEService } from './group-e.service';

describe('GroupEService', () => {
  let service: GroupEService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupEService]
    }).compile();

    service = module.get<GroupEService>(GroupEService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
