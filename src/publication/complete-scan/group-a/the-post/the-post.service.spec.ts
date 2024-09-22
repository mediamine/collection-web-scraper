import { Test, TestingModule } from '@nestjs/testing';
import { ThePostService } from './the-post.service';

describe('ThePostService', () => {
  let service: ThePostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePostService]
    }).compile();

    service = module.get<ThePostService>(ThePostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
