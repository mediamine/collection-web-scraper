import { Test, TestingModule } from '@nestjs/testing';
import { ManawatuStandardService } from './manawatu-standard.service';

describe('ManawatuStandardService', () => {
  let service: ManawatuStandardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManawatuStandardService]
    }).compile();

    service = module.get<ManawatuStandardService>(ManawatuStandardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
