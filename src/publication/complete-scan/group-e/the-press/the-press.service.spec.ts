import { Test, TestingModule } from '@nestjs/testing';
import { ThePress3Service } from './the-press.service';

describe('ThePress3Service', () => {
  let service: ThePress3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePress3Service]
    }).compile();

    service = module.get<ThePress3Service>(ThePress3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
