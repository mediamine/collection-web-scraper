import { Test, TestingModule } from '@nestjs/testing';
import { GroupDService } from './group-d.service';

describe('GroupAService', () => {
  let service: GroupDService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupDService]
    }).compile();

    service = module.get<GroupDService>(GroupDService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
