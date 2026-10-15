import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;
  let connect: jest.SpyInstance;
  let disconnect: jest.SpyInstance;

  beforeEach(async () => {
    connect = jest.spyOn(PrismaClient.prototype, '$connect').mockResolvedValue(undefined);
    disconnect = jest.spyOn(PrismaClient.prototype, '$disconnect').mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    service = moduleRef.get(PrismaService);
  });

  it('is a Prisma client', () => {
    expect(service).toBeInstanceOf(PrismaClient);
  });

  it('connects when the module starts', async () => {
    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed, releasing the connection pool', async () => {
    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates a database it cannot reach', async () => {
    connect.mockRejectedValue(new Error("Can't reach database server"));

    await expect(service.onModuleInit()).rejects.toThrow("Can't reach database server");
  });
});
