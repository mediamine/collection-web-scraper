import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { uniqBy } from 'lodash';
import { DateTime } from 'luxon';
import { PlaywrightService } from 'src/browser';
import { PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT } from 'src/constant';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { ScannerProps } from 'src/publication/types';
import { isPageTextScanV2ExcludedConditions } from './excluded-conditions';

@Injectable()
export class PageTextScanV2Service {
  constructor(
    private readonly moduleRef: ModuleRef,
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService,
    private playwrightService: PlaywrightService
  ) {
    this.logger.setContext(PageTextScanV2Service.name);
  }

  async scan({ feed: { id, name, url }, feedScraper }): Promise<void> {
    try {
      this.logger.log(`Invoked ${this.scan.name} with ${JSON.stringify({ id, name, url })} of type: ${feedScraper}`);

      const minCharCount = Number(this.configService.get<string>(PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT, '0')) || 0;
      if (minCharCount === 0) {
        this.logger.warn(`${PAGE_TEXT_SCAN_V2_MIN_CHAR_COUNT} is not set, so only News Items with blank Page Text will be scanned.`);
      }

      const windowStart = DateTime.now().minus({ month: 1 });
      const existingNewsItemsQuery = { feed_fk: id, date_downloaded: { gte: windowStart.toISO()! } };

      const newsItemsWithNoPageText = [
        ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: '' } })),
        ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: null } }))
      ];

      // Prisma's query API has no string length filter, so the short page text pass needs raw SQL. It
      // returns ids only, which are re-hydrated below so every bucket holds full news_item rows. The
      // page text checks keep this bucket from overlapping the blank one above.
      const shortPageTextIds =
        minCharCount > 0
          ? await this.prismaService.$queryRaw<Array<{ id: bigint }>>`
              SELECT id FROM news_item
              WHERE feed_fk = ${id}
                AND date_downloaded >= ${windowStart.toJSDate()}
                AND page_text IS NOT NULL
                AND char_length(page_text) > 0
                AND char_length(page_text) < ${minCharCount}`
          : [];
      const newsItemsWithShortPageText = await this.prismaService.news_item.findMany({
        where: { id: { in: shortPageTextIds.map(({ id }) => id) } }
      });

      const existingNewsItemHashWithNoPageText = uniqBy([...newsItemsWithNoPageText, ...newsItemsWithShortPageText], 'id');
      this.logger.log(
        `Found ${newsItemsWithNoPageText.length} News Items with blank Page Text & ` +
        `${newsItemsWithShortPageText.length} with fewer than ${minCharCount} characters.`
      );

      if (existingNewsItemHashWithNoPageText.length > 0) {
        // Any of the links will do to open the browser on, but a null one would abort the whole session
        const newsItemWithLink = existingNewsItemHashWithNoPageText.find((newsItem) => newsItem.link);

        if (newsItemWithLink) {
          this.logger.log('Opening a browser instance.');
          const { page } = await this.playwrightService.openBrowser({ url: newsItemWithLink.link });

          const feedScraperService = this.moduleRef.get<ScannerProps>(feedScraper, { strict: false });
          await feedScraperService.authenticate({ page });

          this.logger.log(`Scraping article pages for News Items: [${existingNewsItemHashWithNoPageText.map((ni) => ni.id)}]`);
          for (const [, newsItem] of existingNewsItemHashWithNoPageText.entries()) {
            const { id, link, page_text } = newsItem;
            if (link && isPageTextScanV2ExcludedConditions(link)) {
              try {
                const { text } = await feedScraperService.scanArticle({ page, url: link });

                // Never let a failed re-scrape wipe page text we already have
                if (!text && page_text) {
                  this.logger.warn(`Skipped News Item: ${id}, as the scrape came back empty but it already has Page Text.`);
                  continue;
                }

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
        }
      }
    } catch (e) {
      this.logger.error(e.message);
    } finally {
      await this.playwrightService.closeBrowser();
    }
  }
}
