import { Test, TestingModule } from '@nestjs/testing';
import { MarlboroughExpressSubscription2Service } from './marlborough-express.service';

describe('MarlboroughExpressSubscription2Service', () => {
  let service: MarlboroughExpressSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarlboroughExpressSubscription2Service]
    }).compile();

    service = module.get<MarlboroughExpressSubscription2Service>(MarlboroughExpressSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
