import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class GroupCService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({}: AuthenticateFnProps) {}

  async getLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    // Wait for page to load
    await page.locator('div.story-list-medium-container').first().waitFor();
    await page.locator('div.list-stories-frame > div.stories-block').waitFor();

    // Find all articles under each sub-section
    const articles = [
      ...(await page.locator('div.story-list-medium-container ion-card').all()),
      ...(await page.locator('div.list-stories-frame > div.stories-block ion-card').all())
    ];

    // Extract & return all links, titles & descriptions for each article
    // TODO: Skip the pages having /cartoon in the urls
    return await Promise.all(
      articles.map(async (article) => ({
        link: `${url}${await article.locator(page.locator('a').first()).getAttribute('href')}`,
        title: (await article.locator(page.locator('ion-card-title')).innerText()) as string,
        description: (await article.locator(page.locator('ion-card-content > .sf-desc')).innerText()) as string
      }))
    );
  }

  async scanHome({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    await page.locator('section.page-content').waitFor();

    try {
      // Create a list of all links
      const newsItems: Array<ArticleLinkProps> = ([] as Array<ArticleLinkProps>).concat(await this.getLinks({ page, url }));

      return newsItems;
    } catch (e: any) {
      console.error(e.message);
      return [];
    }
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { timeout: 60000 });
    await page.locator('section.page-content').waitFor();

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(
      await page.locator('div.text-block > p').allTextContents(),
      await page.locator('div.text-block > div.paywall > p').allTextContents()
    );

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
