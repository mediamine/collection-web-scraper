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

  // BusinessDesk is scraped anonymously, so there is deliberately no login flow
  async authenticate({}: AuthenticateFnProps) {}

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Every article is first served as a truncated teaser (section.article__body.premium-content), then
    // the paywall script decides. A free article flips to section.full-content and reveals every
    // paragraph; a paywalled one gets the #zephr-html-paywall prompt and stays truncated. Reading before
    // that decision would cut a free article short, so wait for either outcome.
    await page.locator('section.article__body.full-content, #zephr-html-paywall').first().waitFor({ state: 'attached' });

    // Article Text. A paywalled article still holds every paragraph in the DOM, hiding all but the teaser
    // with display:none, and textContent reads straight through that. :visible keeps only the paragraphs
    // that are rendered, which is what an anonymous reader sees and all this scrape is after.
    const textContents: Array<string> = await page.locator('section.article__body p:visible').allTextContents();

    // Returning '' here would blank any page text the News Item already has, so fail instead and let
    // the workflow log it and move on.
    if (textContents.length === 0) {
      throw new Error(`No article text found: ${url}`);
    }

    if ((await page.locator('#zephr-html-paywall').count()) > 0) {
      this.logger.debug(`Article is paywalled, persisting the teaser only: ${url}`);
    }

    return {
      text: textContents.join('')
    };
  }

  async logout({}: AuthenticateFnProps) {}
}
