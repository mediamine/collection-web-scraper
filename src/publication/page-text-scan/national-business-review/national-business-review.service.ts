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

  // National Business Review is scraped anonymously, so there is deliberately no login flow
  async authenticate({}: AuthenticateFnProps) {}

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('div.article-content').waitFor();

    // Article Text. Read anonymously, a paywalled article returns only the opening teaser (~290 chars).
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-content p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
