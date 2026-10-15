import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import {
  FEEDS_TO_IDS_COMPLETE_SCAN,
  FEEDS_TO_IDS_PAGE_TEXT_SCAN,
  FEEDS_TO_IDS_PAGE_TEXT_SCAN_V2,
  FEEDS_TO_IDS_RSS_SCAN,
  WORKFLOW,
  WORKFLOW_COMPLETE_SCAN,
  WORKFLOW_PAGE_TEXT_SCAN,
  WORKFLOW_PAGE_TEXT_SCAN_V2,
  WORKFLOW_RSS_SCAN
} from './constant';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { createMockConfig } from './testing/mock-config';
import { createMockLogger } from './testing/mock-logger';
import { createMockPrisma } from './testing/mock-prisma';
import { CompleteScanService, PageTextScanService, PageTextScanV2Service, RssScanService } from './workflow';

const workflows = [
  [WORKFLOW_COMPLETE_SCAN, FEEDS_TO_IDS_COMPLETE_SCAN, CompleteScanService, 'complete scans'],
  [WORKFLOW_PAGE_TEXT_SCAN, FEEDS_TO_IDS_PAGE_TEXT_SCAN, PageTextScanService, 'page text scans'],
  [WORKFLOW_PAGE_TEXT_SCAN_V2, FEEDS_TO_IDS_PAGE_TEXT_SCAN_V2, PageTextScanV2Service, 'page text scans v2'],
  [WORKFLOW_RSS_SCAN, FEEDS_TO_IDS_RSS_SCAN, RssScanService, 'rss scans']
] as const;

const feedRow = (id: number) => ({ id, name: `Feed ${id}`, url: `https://feed-${id}.example.co.nz` });

describe('AppService', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let prisma: ReturnType<typeof createMockPrisma>;
  let scanners: Map<unknown, { scan: jest.Mock }>;

  const createService = async (config: Record<string, string>) => {
    logger = createMockLogger();
    prisma = createMockPrisma();
    prisma.feed.findUnique.mockImplementation(async ({ where: { id } }) => feedRow(id));
    scanners = new Map(workflows.map(([, , Workflow]) => [Workflow, { scan: jest.fn().mockResolvedValue(undefined) }]));

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: ConfigService, useValue: createMockConfig(config) },
        { provide: WinstonLoggerService, useValue: logger },
        { provide: PrismaService, useValue: prisma },
        ...workflows.map(([, , Workflow]) => ({ provide: Workflow, useValue: scanners.get(Workflow) }))
      ]
    }).compile();

    return moduleRef.get(AppService);
  };

  it('sets its logger context', async () => {
    await createService({});

    expect(logger.setContext).toHaveBeenCalledWith(AppService.name);
  });

  describe.each(workflows)('%s', (workflow, feedsKey, Workflow, label) => {
    const scanFor = () => scanners.get(Workflow).scan;

    it(`scans every feed in ${feedsKey} with the scraper it is mapped to`, async () => {
      const service = await createService({
        [WORKFLOW]: workflow,
        [feedsKey]: JSON.stringify({ 'Scraper A': ['1', '2'], 'Scraper B': ['3'] })
      });

      await service.scrape();

      expect(prisma.feed.findUnique.mock.calls).toEqual([[{ where: { id: 1 } }], [{ where: { id: 2 } }], [{ where: { id: 3 } }]]);
      expect(scanFor().mock.calls).toEqual([
        [{ feed: feedRow(1), feedScraper: 'Scraper A' }],
        [{ feed: feedRow(2), feedScraper: 'Scraper A' }],
        [{ feed: feedRow(3), feedScraper: 'Scraper B' }]
      ]);
      expect(logger.debug).toHaveBeenCalledWith(`Received feeds for ${label}: {"1":"Scraper A","2":"Scraper A","3":"Scraper B"}`);
    });

    it('runs no other workflow', async () => {
      const service = await createService({ [WORKFLOW]: workflow, [feedsKey]: JSON.stringify({ 'Scraper A': ['1'] }) });

      await service.scrape();

      for (const [Other, { scan }] of scanners) {
        if (Other !== Workflow) expect(scan).not.toHaveBeenCalled();
      }
    });

    it('maps a feed listed under two scrapers to the last one', async () => {
      const service = await createService({ [WORKFLOW]: workflow, [feedsKey]: JSON.stringify({ 'Scraper A': ['1'], 'Scraper B': ['1'] }) });

      await service.scrape();

      expect(scanFor().mock.calls).toEqual([[{ feed: feedRow(1), feedScraper: 'Scraper B' }]]);
    });

    it('logs a feed that fails to scan and carries on with the rest', async () => {
      const service = await createService({ [WORKFLOW]: workflow, [feedsKey]: JSON.stringify({ 'Scraper A': ['1', '2'] }) });
      scanFor().mockRejectedValueOnce(new Error('Browser closed'));

      await service.scrape();

      expect(logger.error).toHaveBeenCalledWith('Failed scan for: Feed 1. Browser closed');
      expect(scanFor()).toHaveBeenCalledTimes(2);
    });

    it('scans nothing when no feeds are configured', async () => {
      const service = await createService({ [WORKFLOW]: workflow });

      await service.scrape();

      expect(prisma.feed.findUnique).not.toHaveBeenCalled();
      expect(scanFor()).not.toHaveBeenCalled();
    });

    it('logs feed config that is not valid JSON', async () => {
      const service = await createService({ [WORKFLOW]: workflow, [feedsKey]: '{"Scraper A": ["1"' });

      await service.scrape();

      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^Error parsing feed list: ${feedsKey}\\. `)));
      expect(scanFor()).not.toHaveBeenCalled();
    });

    // Known defect: a feed id with no feed row reaches scan as null, and the catch block's `feed.name` then throws
    // too. That escapes to the outer catch, which skips every remaining feed and blames the feed list.
    // (Feeds run in ascending id order, as integer-like object keys always iterate that way.)
    it.failing('carries on with the remaining feeds when a feed id has no row', async () => {
      const service = await createService({ [WORKFLOW]: workflow, [feedsKey]: JSON.stringify({ 'Scraper A': ['2', '1'] }) });
      prisma.feed.findUnique.mockImplementation(async ({ where: { id } }) => (id === 1 ? null : feedRow(id)));
      // Like the real workflows, which destructure { feed: { id, name, url } }
      scanFor().mockImplementation(async ({ feed: { id } }) => id);

      await service.scrape();

      expect(scanFor()).toHaveBeenCalledWith({ feed: feedRow(2), feedScraper: 'Scraper A' });
    });
  });

  it.each([undefined, 'WORKFLOW_UNKNOWN'])('does nothing for the workflow %s', async (workflow) => {
    const service = await createService(workflow ? { [WORKFLOW]: workflow } : {});

    await service.scrape();

    expect(logger.log).toHaveBeenCalledWith('Invoking a scraping session');
    expect(prisma.feed.findUnique).not.toHaveBeenCalled();
    for (const { scan } of scanners.values()) expect(scan).not.toHaveBeenCalled();
  });
});
