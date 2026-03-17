import { Test, TestingModule } from '@nestjs/testing';
import { ManawatuStandardSubscription2Service } from './manawatu-standard.service';

describe('ManawatuStandardSubscription2Service', () => {
  let service: ManawatuStandardSubscription2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManawatuStandardSubscription2Service]
    }).compile();

    service = module.get<ManawatuStandardSubscription2Service>(ManawatuStandardSubscription2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
