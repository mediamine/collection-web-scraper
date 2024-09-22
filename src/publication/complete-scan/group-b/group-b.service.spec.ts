import { Test, TestingModule } from '@nestjs/testing';
import { GroupBService } from './group-b.service';

describe('GroupBService', () => {
  let service: GroupBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupBService]
    }).compile();

    service = module.get<GroupBService>(GroupBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
