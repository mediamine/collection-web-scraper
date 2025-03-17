import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import hashIt from 'hash-it';
import { uniqBy } from 'lodash';
import { DateTime } from 'luxon';
import { PrismaService } from 'src/db';
import { WinstonLoggerService } from 'src/logger';
import { ScannerProps } from 'src/publication/types';

@Injectable()
export class RssScanService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private logger: WinstonLoggerService,
    private prismaService: PrismaService
  ) {
    this.logger.setContext(RssScanService.name);
  }

  async scan({ feed: { id, name, url }, feedScraper }): Promise<void> {
    try {
      this.logger.log(`Invoked ${this.scan.name} with ${JSON.stringify({ id, name, url })} of type: ${feedScraper}`);

      const feedScraperService = this.moduleRef.get<ScannerProps>(feedScraper, { strict: false });

      this.logger.debug('Scraping home pages for links.');
      const $newsItems = uniqBy(await feedScraperService.scanHome({ url }), 'link');

      this.logger.debug('Find highest newsItem id in db.');
      const newsItemMaxId = await this.prismaService.news_item.findFirstOrThrow({ orderBy: { id: 'desc' } });
      for (const [index, $newsItem] of $newsItems.entries()) {
        const hashcode = hashIt(id.toString() + $newsItem.title + $newsItem.link + $newsItem.description);
        const existingNewsItemHash = await this.prismaService.news_item.findMany({ where: { hashcode } });

        // If no existing duplicate item is found
        if (existingNewsItemHash.length === 0) {
          const date = DateTime.now().toISO();
          await this.prismaService.news_item.create({
            data: {
              id: BigInt(newsItemMaxId.id ?? 0) + BigInt(index + 1),
              link: $newsItem.link,
              title: $newsItem.title,
              description: $newsItem.description,
              source: name,
              date,
              date_downloaded: date,
              feed_fk: id,
              hashcode,
              page_text: ''
            }
          });
          this.logger.debug(`Created News Item with title: ${$newsItem.title.slice(0, 25)}...`);
        }
      }

      this.logger.debug(`Fetching News Items with blank page text for feed id: ${id}`);
      const existingNewsItemsQuery = { feed_fk: id, date_downloaded: { gte: DateTime.now().minus({ month: 1 }).toISO()! } };
      const existingNewsItemHashWithNoPageText = [
        ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: '' } })),
        ...(await this.prismaService.news_item.findMany({ where: { ...existingNewsItemsQuery, page_text: null } }))
      ];

      this.logger.log(`Scraping article pages for News Items: [${existingNewsItemHashWithNoPageText.map((ni) => ni.id)}]`);
      for (const [, newsItem] of existingNewsItemHashWithNoPageText.entries()) {
        const { id, link } = newsItem;
        if (link) {
          try {
            const text = newsItem.description;
            this.logger.log(`Persisting Page Text: ${text.slice(0, 15)}...${text.slice(-15)} for News Item: ${id}`);
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
    } catch (e) {
      this.logger.error(e.message);
    }
  }
}
