import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class GroupEService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) { }

  async authenticate({ page }: AuthenticateFnProps) {
    await this.logger.debug('Starting authenticate');

    await page.getByTestId('login-button').click();
    await page.getByRole('textbox', { name: 'Email address' }).fill(process.env['STUFF_LOGIN_USERNAME']);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env['STUFF_LOGIN_PASSWORD']);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();

    await page.reload();
  }

  async getLinks({ page, url }: ScanFnProps, section: string): Promise<Array<ArticleLinkProps>> {
    await this.logger.debug('Starting getLinks');

    // Navigate to the section page
    await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();
    await page.getByRole('button', { name: 'Toggle navigation menu' }).click();

    await page.getByRole('link', { name: section, exact: true }).first().waitFor();
    await page.getByRole('link', { name: section, exact: true }).first().click();

    // Wait for page to load
    await page.locator('div[data-testid="box-container"]').first().waitFor();

    // Find all articles under each sub-section
    const articles = [...(await page.locator('div[data-testid="box-container"] article').all())];

    // Extract & return all links, titles & descriptions for each article
    // TODO: Skip the pages having /cartoon in the urls
    return await Promise.all(
      articles.map(async (article) => {
        let link = '';
        try {
          link = await article.locator(page.locator('div[data-testid="grid-card-content"] > a').first()).getAttribute('href');
        } catch (e) {
          await this.logger.error('Unable to resolve article link');
        }
        let title = '';
        try {
          title = await article.locator(page.locator('h3')).innerText();
        } catch (e) {
          await this.logger.error('Unable to resolve article title');
        }
        return ({
          link: `${url}${link}`,
          title,
          description: ''
        })
      })
    );
  }

  async scanHome({ }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await this.logger.debug('Starting scanArticle');

    await page.goto(url, { timeout: 60000 });
    await page.locator('section.page-content').waitFor();

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(
      await page.locator('div.text-block > p').allTextContents(),
      await page.locator('div.text-block > div.paywall > p').allTextContents(),
      await page.locator('div[data-testid="body-paragraph"] > p').allTextContents(),
    );

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    await this.logger.debug('Starting logout');

    await page.reload();

    await page.getByTestId('dropdown-button').click();
    await page.getByRole('link', { name: 'Sign Out' }).click();
    await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();
  }
}
