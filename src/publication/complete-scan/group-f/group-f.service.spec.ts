import { Test, TestingModule } from '@nestjs/testing';
import { GroupFService } from './group-f.service';

describe('GroupCService', () => {
  let service: GroupFService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupFService]
    }).compile();

    service = module.get<GroupFService>(GroupFService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
