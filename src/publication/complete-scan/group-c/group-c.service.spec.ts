import { Test, TestingModule } from '@nestjs/testing';
import { GroupCService } from './group-c.service';

describe('GroupCService', () => {
  let service: GroupCService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupCService]
    }).compile();

    service = module.get<GroupCService>(GroupCService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
