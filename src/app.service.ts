import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FEEDS_TO_IDS_COMPLETE_SCAN,
  FEEDS_TO_IDS_PAGE_TEXT_SCAN,
  WORKFLOW,
  WORKFLOW_COMPLETE_SCAN,
  WORKFLOW_PAGE_TEXT_SCAN
} from './constant';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { PageTextScanService } from './workflow';
import { CompleteScanService } from './workflow/complete-scan/complete-scan.service';

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService,
    private completeScanService: CompleteScanService,
    private pageTextScanService: PageTextScanService
  ) {
    this.logger.setContext(AppService.name);
  }

  async scrape(): Promise<void> {
    this.logger.log('Invoking a scraping session');

    const workflow = this.configService.get<string>(WORKFLOW) ?? '';

    switch (workflow) {
      case WORKFLOW_COMPLETE_SCAN:
        try {
          const feedsToIdsCompleteScan: Record<string, Array<string>> = JSON.parse(
            this.configService.get<string>(FEEDS_TO_IDS_COMPLETE_SCAN) ?? '{}'
          );

          const feeds = Object.entries(feedsToIdsCompleteScan).reduce((memo, [feedType, feedIds]) => {
            feedIds.forEach((f) => {
              memo[f] = feedType;
            });
            return memo;
          }, {});
          this.logger.debug(`Received feeds for complete scans: ${JSON.stringify(feeds)}`);

          for (const feedId of Object.keys(feeds)) {
            const feed = await this.prismaService.feed.findUnique({ where: { id: Number(feedId) } });

            await this.completeScanService.scan({ feed, feedScraper: feeds[feedId] });
          }
        } catch (e) {
          this.logger.error(`Error parsing feed list: ${FEEDS_TO_IDS_COMPLETE_SCAN}. ${e.message}`);
        }
        break;

      case WORKFLOW_PAGE_TEXT_SCAN:
        try {
          const feedsToIdsPageTextScan: Record<string, Array<string>> = JSON.parse(
            this.configService.get<string>(FEEDS_TO_IDS_PAGE_TEXT_SCAN) ?? '{}'
          );

          const feeds = Object.entries(feedsToIdsPageTextScan).reduce((memo, [feedType, feedIds]) => {
            feedIds.forEach((f) => {
              memo[f] = feedType;
            });
            return memo;
          }, {});
          this.logger.debug(`Received feeds for page text scans: ${JSON.stringify(feeds)}`);

          for (const feedId of Object.keys(feeds)) {
            const feed = await this.prismaService.feed.findUnique({ where: { id: Number(feedId) } });

            await this.pageTextScanService.scan({ feed, feedScraper: feeds[feedId] });
          }
        } catch (e) {
          this.logger.error(`Error parsing feed list: ${FEEDS_TO_IDS_PAGE_TEXT_SCAN}. ${e.message}`);
        }
        break;

      default:
    }
  }
}
