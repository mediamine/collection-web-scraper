import { Test, TestingModule } from '@nestjs/testing';
import { ThePressService } from './the-press.service';

describe('ThePressService', () => {
  let service: ThePressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePressService]
    }).compile();

    service = module.get<ThePressService>(ThePressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
