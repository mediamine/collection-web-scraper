import { Global, Module, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DateTime, Settings } from 'luxon';
import { PlaywrightService } from 'src/browser';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { createMockConfig } from './mock-config';
import { createMockLogger } from './mock-logger';
import { createMockPage } from './mock-playwright';
import { createMockPrisma } from './mock-prisma';

export const SCRAPER_TOKEN = 'Test Scraper';

// Pins luxon's clock, which the workflows read for news item dates and their one month candidate window
export const pinClock = (iso: string) => {
  const now = DateTime.fromISO(iso);
  beforeEach(() => {
    Settings.now = () => now.toMillis();
  });
  afterEach(() => {
    Settings.now = () => Date.now();
  });
  return {
    nowISO: () => DateTime.now().toISO(),
    monthAgoISO: () => DateTime.now().minus({ month: 1 }).toISO()
  };
};

export const createMockScraper = () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  scanHome: jest.fn().mockResolvedValue([]),
  scanArticle: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined)
});

// Compiles a workflow service against mocks, with a mock scraper registered under SCRAPER_TOKEN for the
// workflow's ModuleRef lookup to find, just as a real scraper is under its feedScrapers.ts token.
export const createWorkflowModule = async <T>(Service: Type<T>, { config = {} }: { config?: Record<string, string> } = {}) => {
  const logger = createMockLogger();
  const prisma = createMockPrisma();
  const scraper = createMockScraper();
  const page = createMockPage();
  const playwright = { openBrowser: jest.fn().mockResolvedValue({ page }), closeBrowser: jest.fn().mockResolvedValue(undefined) };

  const providers: Provider[] = [
    Service,
    { provide: WinstonLoggerService, useValue: logger },
    { provide: PrismaService, useValue: prisma },
    { provide: PlaywrightService, useValue: playwright },
    { provide: ConfigService, useValue: createMockConfig(config) },
    { provide: SCRAPER_TOKEN, useValue: scraper }
  ];
  const moduleRef = await Test.createTestingModule({ providers }).compile();

  return { service: moduleRef.get(Service), logger, prisma, scraper, page, playwright };
};

// Stands in for the global ConfigModule and PrismaModule that AppModule provides, so a workflow module can
// be compiled on its own.
const createGlobalMocksModule = () => {
  @Global()
  @Module({
    providers: [
      { provide: ConfigService, useValue: createMockConfig() },
      { provide: PrismaService, useValue: createMockPrisma() }
    ],
    exports: [ConfigService, PrismaService]
  })
  class GlobalMocksModule {}

  return GlobalMocksModule;
};

// Compiles a real workflow module with its real scrapers, swapping out only what would touch the outside
// world: the database, the env, and the logger's rotating files.
export const compileWorkflowModule = (WorkflowModule: Type<unknown>) =>
  Test.createTestingModule({ imports: [createGlobalMocksModule(), WorkflowModule] })
    .overrideProvider(WinstonLoggerService)
    .useValue(createMockLogger())
    .compile();

export type WorkflowMocks<T> = Awaited<ReturnType<typeof createWorkflowModule<T>>>;
