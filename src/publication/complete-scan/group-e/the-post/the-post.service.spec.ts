import { Test, TestingModule } from '@nestjs/testing';
import { ThePost3Service } from './the-post.service';

describe('ThePost3Service', () => {
  let service: ThePost3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePost3Service]
    }).compile();

    service = module.get<ThePost3Service>(ThePost3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
