import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class GroupAService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({ page }: AuthenticateFnProps) {
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.getByLabel('Email address').fill(this.configService.get('STUFF_LOGIN_USERNAME'));
    await page.getByLabel('Password').fill(this.configService.get('STUFF_LOGIN_PASSWORD'));
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('#mastheads_menu').waitFor();
  }

  async getLinks({ page, url }: ScanFnProps, section: string): Promise<Array<ArticleLinkProps>> {
    await page.reload();

    // Navigate to the section page
    await page.locator('#mastheads_menu').waitFor();
    await page.locator('#mastheads_menu').click();

    await page.getByRole('link', { name: section, exact: true }).waitFor();
    await page.getByRole('link', { name: section, exact: true }).click();

    // Wait for page to load
    await page.locator('div.story-list-medium-container').waitFor();
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

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url);
    await page.locator('section.page-content').waitFor();

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(
      await page.locator('div.content-block > p').allTextContents(),
      await page.locator('div.content-block > div.paywall > p').allTextContents()
    );

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    await page.getByRole('button', { name: 'M', exact: true }).waitFor();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out' }).click();
    await page.locator('#mastheads_menu').waitFor();
  }
}
