import { Test, TestingModule } from '@nestjs/testing';
import { BusinessDeskService } from './business-desk.service';

describe('BusinessDesk', () => {
  let service: BusinessDeskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessDeskService]
    }).compile();

    service = module.get<BusinessDeskService>(BusinessDeskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
