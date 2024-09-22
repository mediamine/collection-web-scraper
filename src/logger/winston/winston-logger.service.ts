import { ConsoleLogger, Injectable, LoggerService, Scope } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

const { combine, printf, timestamp, colorize } = format;

const WINSTON_DEFAULT_OPTIONS = {
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
};

@Injectable({ scope: Scope.TRANSIENT })
export class WinstonLoggerService extends ConsoleLogger implements LoggerService {
  private readonly winston = createLogger({
    level: 'info',
    format: combine(
      colorize(),
      timestamp(),
      printf(({ message, timestamp }) => `${timestamp}: ${message}`)
    ),
    transports: [
      new transports.DailyRotateFile({
        ...WINSTON_DEFAULT_OPTIONS,
        filename: './logs/error-%DATE%.log',
        level: 'error'
      }),
      new transports.DailyRotateFile({
        ...WINSTON_DEFAULT_OPTIONS,
        filename: './logs/info-%DATE%.log',
        level: 'info'
      }),
      new transports.DailyRotateFile({
        ...WINSTON_DEFAULT_OPTIONS,
        filename: './logs/debug-%DATE%.log',
        level: 'debug'
      })
    ]
  });

  /**
   * Write a 'log' level log.
   * @param message
   * @param optionalParams
   */
  log(message: any, ...optionalParams: any[]) {
    this.winston.info(message);
    super.log(message, ...optionalParams);
  }

  /**
   * Write a 'fatal' level log.
   * @param message
   * @param optionalParams
   */
  fatal(message: any, ...optionalParams: any[]) {
    this.winston.error(message);
    super.fatal(message, ...optionalParams);
  }

  /**
   * Write an 'error' level log.
   * @param message
   * @param optionalParams
   */
  error(message: any, ...optionalParams: any[]) {
    this.winston.error(message);
    super.error(message, ...optionalParams);
  }

  /**
   * Write a 'warn' level log.
   * @param message
   * @param optionalParams
   */
  warn(message: any, ...optionalParams: any[]) {
    this.winston.warn(message);
    super.warn(message, ...optionalParams);
  }

  /**
   * Write a 'debug' level log.
   * @param message
   * @param optionalParams
   */
  debug(message: any, ...optionalParams: any[]) {
    this.winston.debug(message);
    super.debug(message, ...optionalParams);
  }

  /**
   * Write a 'verbose' level log.
   * @param message
   * @param optionalParams
   */
  verbose(message: any, ...optionalParams: any[]) {
    this.winston.debug(message);
    super.verbose(message, ...optionalParams);
  }
}
