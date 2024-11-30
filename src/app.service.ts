import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FEEDS_TO_IDS_COMPLETE_SCAN,
  FEEDS_TO_IDS_PAGE_TEXT_SCAN,
  FEEDS_TO_IDS_RSS_SCAN,
  WORKFLOW,
  WORKFLOW_COMPLETE_SCAN,
  WORKFLOW_PAGE_TEXT_SCAN,
  WORKFLOW_RSS_SCAN
} from './constant';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { CompleteScanService, PageTextScanService, RssScanService } from './workflow';

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService,
    private completeScanService: CompleteScanService,
    private pageTextScanService: PageTextScanService,
    private rssScanService: RssScanService
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

            try {
              await this.completeScanService.scan({ feed, feedScraper: feeds[feedId] });
            } catch (e) {
              this.logger.error(`Failed scan for: ${feed.name}. ${e.message}`);
            }
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

            try {
              await this.pageTextScanService.scan({ feed, feedScraper: feeds[feedId] });
            } catch (e) {
              this.logger.error(`Failed scan for: ${feed.name}. ${e.message}`);
            }
          }
        } catch (e) {
          this.logger.error(`Error parsing feed list: ${FEEDS_TO_IDS_PAGE_TEXT_SCAN}. ${e.message}`);
        }
        break;

      case WORKFLOW_RSS_SCAN:
        try {
          const feedsToIdsRSSScan: Record<string, Array<string>> = JSON.parse(
            this.configService.get<string>(FEEDS_TO_IDS_RSS_SCAN) ?? '{}'
          );

          const feeds = Object.entries(feedsToIdsRSSScan).reduce((memo, [feedType, feedIds]) => {
            feedIds.forEach((f) => {
              memo[f] = feedType;
            });
            return memo;
          }, {});
          this.logger.debug(`Received feeds for rss scans: ${JSON.stringify(feeds)}`);

          for (const feedId of Object.keys(feeds)) {
            const feed = await this.prismaService.feed.findUnique({ where: { id: Number(feedId) } });

            try {
              await this.rssScanService.scan({ feed, feedScraper: feeds[feedId] });
            } catch (e) {
              this.logger.error(`Failed scan for: ${feed.name}. ${e.message}`);
            }
          }
        } catch (e) {
          this.logger.error(`Error parsing feed list: ${FEEDS_TO_IDS_RSS_SCAN}. ${e.message}`);
        }
        break;

      default:
    }
  }
}
