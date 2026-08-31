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
    // Going straight to the login form avoids depending on the header's log in control, which the
    // workflow may not have on screen — it opens a news_item link directly, not the home page.
    await page.goto('https://www.nbr.co.nz/Security/login/?BackURL=%2F', { waitUntil: 'domcontentloaded' });

    await page.locator('input[name="Email"]').fill(this.configService.get('NBR_LOGIN_USERNAME'));
    await page.locator('input[name="Password"]').fill(this.configService.get('NBR_LOGIN_PASSWORD'));
    // The submit control is an <input type="submit" value="Log in">, not a button element
    await page.locator('input[type="submit"][name="action_doLogin"]').click();

    // Signed in, the header swaps the log in link for a My Account link. Note .toggle-menu is present
    // either way, so it is not a usable signal.
    await page
      .getByRole('link', { name: /my account/i })
      .first()
      .waitFor();
  }

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('div.article-content').waitFor();

    // Article Text. Signed out this returns only the opening teaser (~290 chars), so a short result
    // here means the session was lost rather than the article being short.
    const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-content p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    // Best effort: NBR sessions are tied to one shared subscriber account, so releasing it matters,
    // but a failure here must not fail the run.
    try {
      await page
        .getByRole('link', { name: /my account/i })
        .first()
        .click();
      await page
        .getByRole('link', { name: /log ?out|sign ?out/i })
        .first()
        .click();
      await page
        .getByRole('link', { name: /log ?in/i })
        .first()
        .waitFor();
    } catch (e) {
      this.logger.warn(`Failed to sign out of National Business Review. Exception: ${e.message}`);
    }
  }
}
