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

    // A free article renders the full body as div.article-body; a paywalled one renders none of it and
    // shows a truncated teaser in div.paywall instead. Wait for whichever this article has.
    await page.locator('div.article-body, div.paywall').first().waitFor();

    const articleBody = page.locator('div.article-body');
    if ((await articleBody.count()) > 0) {
      // Article Text
      const textContents: Array<string> = ([] as Array<string>).concat(await articleBody.locator('p').allTextContents());

      return {
        text: textContents.join('')
      };
    }

    // The teaser is raw text directly inside div.paywall, with no <p> children to collect
    const paywall = page.locator('div.paywall');
    if ((await paywall.count()) > 0) {
      this.logger.debug(`Article is paywalled, persisting the teaser only: ${url}`);

      return {
        text: await paywall.first().innerText()
      };
    }

    // Returning '' here would blank any page text the News Item already has, so fail instead and let
    // the workflow log it and move on.
    throw new Error(`No article body or paywall teaser found: ${url}`);
  }

  async logout({}: AuthenticateFnProps) {}
}
