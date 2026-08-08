import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class OtagoDailyTimesService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    this.logger.setContext(OtagoDailyTimesService.name);
  }

  async authenticate({ page }: AuthenticateFnProps) {
    // The header is client rendered, so wait for the auth control before reading its state. The same
    // div.sign-in-button wrapper is used signed in or out — only the button label changes.
    await page.locator('div.sign-in-button button').first().waitFor();

    if ((await page.getByRole('button', { name: /sign out/i }).count()) > 0) {
      this.logger.log('Already signed in to Otago Daily Times.');
      return;
    }

    await page.locator('div.sign-in-button button').first().click();

    // The Piano ID login form is served from id-au.piano.io inside an iframe in the .tp-modal overlay.
    // Note the password input carries no name attribute, so it has to be matched on type.
    await page.locator('.tp-modal iframe').first().waitFor();
    const piano = page.frameLocator('.tp-modal iframe').first();
    await piano.locator('input[name="email"]').fill(this.configService.get('ODT_LOGIN_USERNAME'));
    await piano.locator('input[type="password"]').fill(this.configService.get('ODT_LOGIN_PASSWORD'));
    await piano
      .locator('button.btn', { hasText: /sign in/i })
      .first()
      .click();

    // The header swaps SIGN IN for SIGN OUT once authenticated. div.sign-in-button stays in the DOM
    // either way, so its presence is not a usable signal.
    await page
      .getByRole('button', { name: /sign out/i })
      .first()
      .waitFor();
  }

  async scanHome({ }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Free articles render the body as div#article-body, paywalled ones as div#article_body_paywall.
    // Both carry the article-body class, so match on that rather than on either id. The body is client
    // rendered, so it has to be waited for. A locked article never renders one, which means the Piano
    // session isn't entitled — throw rather than returning '' so the workflow logs it and leaves any
    // existing page text intact.
    try {
      await page.locator('div.article-body').first().waitFor();
    } catch {
      throw new Error(`No article body found — article is paywall-locked: ${url}`);
    }

    // Article Text. :not(.paywallbox) drops the paywall prompt Piano can inject into the body.
    const textContents: Array<string> = ([] as Array<string>).concat(
      await page.locator('div.article-body p:not(.paywallbox)').allTextContents()
    );

    return {
      text: textContents.join('')
    };
  }

  async logout({ page }: AuthenticateFnProps) {
    // Best effort: Piano tracks concurrent sessions per subscriber account, so release this one if we
    // can, but never fail the run over it.
    try {
      await page
        .getByRole('button', { name: /sign out/i })
        .first()
        .click();
      await page
        .getByRole('button', { name: /sign in/i })
        .first()
        .waitFor();
    } catch (e) {
      this.logger.warn(`Failed to sign out of Otago Daily Times. Exception: ${e.message}`);
    }
  }
}
