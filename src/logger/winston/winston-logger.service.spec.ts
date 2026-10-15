import { ConsoleLogger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLogger, format, transports } from 'winston';
import { WinstonLoggerService } from './winston-logger.service';

// The real transports write rotating files under ./logs, so winston is replaced wholesale
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })),
  format: { combine: jest.fn(), printf: jest.fn(), timestamp: jest.fn(), colorize: jest.fn() },
  transports: { DailyRotateFile: jest.fn() }
}));
jest.mock('winston-daily-rotate-file', () => ({}));

const createLoggerMock = createLogger as jest.Mock;

describe('WinstonLoggerService', () => {
  let service: WinstonLoggerService;
  let winston: Record<'info' | 'error' | 'warn' | 'debug', jest.Mock>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WinstonLoggerService] }).compile();
    // Transient scoped, so each consumer gets its own instance and it has to be resolved, not got
    service = await moduleRef.resolve(WinstonLoggerService);
    winston = createLoggerMock.mock.results[createLoggerMock.mock.results.length - 1].value;
  });

  it('is a Nest console logger', () => {
    expect(service).toBeInstanceOf(ConsoleLogger);
  });

  it('is transient, giving every consumer its own instance and so its own context', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WinstonLoggerService] }).compile();

    expect(await moduleRef.resolve(WinstonLoggerService)).not.toBe(await moduleRef.resolve(WinstonLoggerService));
  });

  it.each([
    ['error', './logs/error-%DATE%.log'],
    ['info', './logs/info-%DATE%.log'],
    ['debug', './logs/debug-%DATE%.log']
  ])('rotates %s logs daily into %s, zipped and kept 14 days', (level, filename) => {
    expect(transports.DailyRotateFile).toHaveBeenCalledWith({ zippedArchive: true, maxSize: '20m', maxFiles: '14d', filename, level });
  });

  it('writes from info level up', () => {
    expect(createLoggerMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'info' }));
  });

  it('prefixes each line with its timestamp', () => {
    const [[template]] = (format.printf as jest.Mock).mock.calls;

    expect(template({ message: 'Invoking a scraping session', timestamp: '2026-10-07T07:00:00.000Z' })).toBe(
      '2026-10-07T07:00:00.000Z: Invoking a scraping session'
    );
  });

  it.each([
    ['log', 'info'],
    ['fatal', 'error'],
    ['error', 'error'],
    ['warn', 'warn'],
    ['debug', 'debug'],
    ['verbose', 'debug']
  ] as const)('writes %s to winston as %s and to the console', (method, winstonLevel) => {
    const consoleMethod = jest.spyOn(ConsoleLogger.prototype, method).mockImplementation(() => undefined);

    service[method]('Scan complete', 'AppService');

    expect(winston[winstonLevel]).toHaveBeenCalledWith('Scan complete');
    expect(consoleMethod).toHaveBeenCalledWith('Scan complete', 'AppService');
  });
});
