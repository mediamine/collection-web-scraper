import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { CompleteScanService } from './workflow/complete-scan/complete-scan.service';

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService,
    private completeScanService: CompleteScanService
  ) {
    this.logger.setContext(AppService.name);
  }

  getHello(): string {
    return 'Hello World!';
  }

  async scrape(): Promise<void> {
    this.logger.log('Scrape');

    try {
      const feedsToIdsCompleteScan: Record<string, Array<string>> = JSON.parse(
        this.configService.get<string>('FEEDS_TO_IDS_COMPLETE_SCAN') ?? '{}'
      );

      const supportedFeeds = Object.entries(feedsToIdsCompleteScan).reduce((memo, [feedType, feedIds]) => {
        feedIds.forEach((f) => {
          memo[f] = feedType;
        });
        return memo;
      }, {});
      this.logger.debug(`Received feeds for complete scans: ${JSON.stringify(supportedFeeds)}`);

      for (const feedId of Object.keys(supportedFeeds)) {
        const feed = await this.prismaService.feed.findUnique({ where: { id: Number(feedId) } });

        await this.completeScanService.scan({ feed, feedScraper: supportedFeeds[feedId] });
      }
    } catch (e) {
      this.logger.error(`Error parsing feed list: FEEDS_TO_IDS_COMPLETE_SCAN. ${e.message}`);
      // return {};
    }

    // this.playwrightService.openBrowser({ url: 'https://www.thepost.co.nz' });
    // return '';
  }
}
