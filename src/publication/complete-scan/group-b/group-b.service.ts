import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class GroupBService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({}: AuthenticateFnProps) {}

  async getLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    // TODO: temp. hardcoding till a better solution is found
    url = 'https://www.stuff.co.nz';

    // Wait for page to load
    await page.locator('div[data-testid="grid-row"] [data-testid="grid-card-content"] > a').first().waitFor();

    // Find all article links in every grid row
    const articles = [...(await page.locator('div[data-testid="grid-row"] [data-testid="grid-card-content"] > a').all())];

    // Extract & return all links, titles & descriptions for each article
    return await Promise.all(
      articles.map(async (article) => {
        const link = `${url}${await article.getAttribute('href')}`;
        const title = (await article.locator(page.locator('h3')).innerText()) as string;
        // The cards carry no standfirst, only the headline, so it doubles as the description
        return { link, title, description: title };
      })
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
    await page.goto(url);
    await page.locator('#ionContentElement').waitFor();

    if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
      await page.getByRole('button', { name: 'Close Ad' }).click();
    }

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.content-groups p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
