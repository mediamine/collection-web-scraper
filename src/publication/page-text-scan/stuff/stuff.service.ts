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
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
      await page.getByRole('button', { name: 'Close Ad' }).click();
    }

    if (await page.locator('div.common-error-display').isVisible()) {
      return {
        text: ''
      };
    }

    // Standard articles wrap paragraphs in div[data-testid="body-paragraph"], but live blogs don't use
    // it at all — div.content-groups covers both, so prefer it and keep the other as a fallback.
    await page.locator('div.content-groups, div[data-testid="body-paragraph"]').first().waitFor();

    const contentGroups = page.locator('div.content-groups');
    const selector = (await contentGroups.count()) > 0 ? 'div.content-groups p' : 'div[data-testid="body-paragraph"] > p';

    // Article Text
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator(selector).allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
