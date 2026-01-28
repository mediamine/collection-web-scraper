import { Test, TestingModule } from '@nestjs/testing';
import { ThePress2Service } from './the-press.service';

describe('ThePressService', () => {
  let service: ThePress2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThePress2Service]
    }).compile();

    service = module.get<ThePress2Service>(ThePress2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
