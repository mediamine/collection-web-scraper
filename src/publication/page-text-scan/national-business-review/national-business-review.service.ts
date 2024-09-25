import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class NationalBusinessReviewService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({ page }: AuthenticateFnProps) {
    await page.getByRole('link', { name: 'Log in' }).click();
    await page.getByPlaceholder('Email address').fill(this.configService.get('NBR_LOGIN_USERNAME'));
    await page.getByPlaceholder('Password').fill(this.configService.get('NBR_LOGIN_PASSWORD'));
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('.toggle-menu.header-toggle-menu').waitFor();
  }

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url);
    await page.locator('div.article-content').waitFor();

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-content p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    await page.getByRole('link', { name: 'My Account' }).click();
    await page.getByRole('link', { name: 'Log out' }).click();
    await page.locator('.toggle-menu.header-toggle-menu').waitFor();
  }
}
