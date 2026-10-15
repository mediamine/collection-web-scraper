import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WinstonLoggerModule, WinstonLoggerService } from 'src/logger';

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({})),
  format: { combine: jest.fn(), printf: jest.fn(), timestamp: jest.fn(), colorize: jest.fn() },
  transports: { DailyRotateFile: jest.fn() }
}));
jest.mock('winston-daily-rotate-file', () => ({}));

@Injectable()
class Consumer {
  constructor(readonly logger: WinstonLoggerService) {}
}

@Module({ providers: [Consumer] })
class ConsumerModule {}

describe('WinstonLoggerModule', () => {
  it('makes the logger injectable in modules that do not import it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WinstonLoggerModule, ConsumerModule] }).compile();

    const consumer = await moduleRef.resolve(Consumer);

    expect(consumer.logger).toBeInstanceOf(WinstonLoggerService);
  });
});
