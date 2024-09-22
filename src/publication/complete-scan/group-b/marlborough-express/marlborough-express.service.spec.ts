import { Test, TestingModule } from '@nestjs/testing';
import { MarlboroughExpressService } from './marlborough-express.service';

describe('MarlboroughExpressService', () => {
  let service: MarlboroughExpressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarlboroughExpressService]
    }).compile();

    service = module.get<MarlboroughExpressService>(MarlboroughExpressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
