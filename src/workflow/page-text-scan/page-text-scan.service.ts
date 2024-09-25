import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { DateTime } from 'luxon';
import { PlaywrightService } from 'src/browser';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { ScannerProps } from 'src/publication/types';

@Injectable()
export class PageTextScanService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService,
    private playwrightService: PlaywrightService
  ) {
    this.logger.setContext(PageTextScanService.name);
  }

  async scan({ feed: { id, name, url }, feedScraper }): Promise<void> {
    this.logger.log(`Invoked ${this.scan.name} with ${JSON.stringify({ id, name, url })} of type: ${feedScraper}`);

    const existingNewsItemsQuery = { feed_fk: id, date_downloaded: { gte: DateTime.now().minus({ month: 1 }).toISO()! } };
    const existingNewsItemHashWithNoPageText = [
      ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: '' } })),
      ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: null } }))
    ];

    if (existingNewsItemHashWithNoPageText.length > 0) {
      const { link } = existingNewsItemHashWithNoPageText[0];

      if (link) {
        this.logger.log('Opening a browser instance.');
        const { page } = await this.playwrightService.openBrowser({ url: link });

        const feedScraperService = this.moduleRef.get<ScannerProps>(feedScraper, { strict: false });
        await feedScraperService.authenticate({ page });

        this.logger.log(`Scraping article pages for News Items: [${existingNewsItemHashWithNoPageText.map((ni) => ni.id)}]`);
        for (const [, newsItem] of existingNewsItemHashWithNoPageText.entries()) {
          const { id, link } = newsItem;
          if (link) {
            try {
              const { text } = await feedScraperService.scanArticle({ page, url: link });
              this.logger.log(`Persisting Page Text: ${text.slice(0, 25)}... for News Item: ${id}`);
              await this.prismaService.news_item.update({
                where: { id },
                data: { page_text: text }
              });
            } catch (e) {
              this.logger.error(`Error scanning text for ${link}. Exception: ${e.message}`);
            }
          }
        }

        this.logger.debug('Update Last Download Date in db.');
        await this.prismaService.feed.update({
          where: { id },
          data: { last_download_date: new Date() }
        });

        this.logger.debug('Logging out the browser session.');
        await feedScraperService.logout({ page });

        await this.playwrightService.closeBrowser();
      }
    }
  }
}
