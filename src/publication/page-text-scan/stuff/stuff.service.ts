import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class StuffService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {}

  async authenticate({}: AuthenticateFnProps) {}

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url);
    await page.locator('.ion-page').waitFor();

    if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
      await page.getByRole('button', { name: 'Close Ad' }).click();
    }

    if (await page.locator('div.common-error-display').isVisible()) {
      return {
        text: ''
      };
    }

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.stuff-article-content > p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
