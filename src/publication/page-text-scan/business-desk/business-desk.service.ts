import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class BusinessDeskService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({ page }: AuthenticateFnProps) {
    await page.getByRole('link', { name: 'Login' }).waitFor();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.locator('input[name="email"]').fill(this.configService.get('BD_LOGIN_USERNAME'));
    await page.locator('input[name="password"]').fill(this.configService.get('BD_LOGIN_PASSWORD'));
    await page.getByRole('button', { name: 'Login' }).click();
    await page.locator('.menu-button').waitFor();
  }

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url);
    await page.locator('div.article-body').waitFor();

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-body p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    await page.getByRole('link', { name: 'My Account' }).waitFor();
    await page.getByRole('link', { name: 'My Account' }).click();
    await page.getByRole('main').getByRole('link', { name: 'Logout' }).click();
    await page.locator('.menu-button').waitFor();
  }
}
