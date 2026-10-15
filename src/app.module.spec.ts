import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import * as feedScrapers from './constant/feedScrapers';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { createMockLogger } from './testing/mock-logger';
import { createMockPrisma } from './testing/mock-prisma';

const { NEWS_ITEM_SOURCE_INSURANCE_BUSINESS, ...scraperTokens } = feedScrapers;

describe('AppModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createMockPrisma())
      .overrideProvider(WinstonLoggerService)
      .useValue(createMockLogger())
      .compile();
  });

  it('wires AppService up with all four workflows', () => {
    expect(moduleRef.get(AppService)).toBeInstanceOf(AppService);
  });

  it.each(Object.entries(scraperTokens))('has a scraper registered for %s', (_, token) => {
    const scraper = moduleRef.get(token, { strict: false });

    for (const method of ['authenticate', 'scanHome', 'scanArticle', 'logout']) {
      expect(scraper[method]).toEqual(expect.any(Function));
    }
  });

  it('has no scraper for Insurance Business, so a feed mapped to it would fail to scan', () => {
    expect(() => moduleRef.get(NEWS_ITEM_SOURCE_INSURANCE_BUSINESS, { strict: false })).toThrow();
  });
});
