import { Test, TestingModule } from '@nestjs/testing';
import { GroupAService } from './group-a.service';

describe('GroupAService', () => {
  let service: GroupAService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupAService]
    }).compile();

    service = module.get<GroupAService>(GroupAService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
