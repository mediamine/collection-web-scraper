import { Test, TestingModule } from '@nestjs/testing';
import { ThePost2Service } from './the-post.service';

describe('ThePostService', () => {
  let service: ThePost2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePost2Service]
    }).compile();

    service = module.get<ThePost2Service>(ThePost2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
