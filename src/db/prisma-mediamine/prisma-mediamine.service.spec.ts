import { Test, TestingModule } from '@nestjs/testing';
import { PrismaMediamineService } from './prisma-mediamine.service';

describe('PrismaMediamineService', () => {
  let service: PrismaMediamineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaMediamineService]
    }).compile();

    service = module.get<PrismaMediamineService>(PrismaMediamineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
