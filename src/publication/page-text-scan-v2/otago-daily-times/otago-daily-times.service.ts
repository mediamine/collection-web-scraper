import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

// Piano fills the body in one write, but not necessarily by the first read: a locked or metered page
// renders only a lead/teaser paragraph. Reading on the first non-empty poll truncated articles to their
// standfirst, so the body is read only once its length has settled.
const ARTICLE_BODY_SELECTOR = 'div.article-body p:not(.paywallbox)';
const BODY_SETTLE_POLL_MS = 250;
const BODY_SETTLE_POLLS = 3;
const BODY_SETTLE_TIMEOUT_MS = 20000;

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

    // This workflow opens a news_item link directly, so on a premium article Piano pops a subscription
    // offer dialog instead of leaving the header as the way in. It is injected asynchronously, so give
    // it a chance to show up before falling back to the header control.
    const offerDialog = page.locator('iframe[id^="offer-"]');
    await offerDialog.waitFor({ timeout: 15000 }).catch(() => {});

    if ((await offerDialog.count()) > 0) {
      // "Already a subscriber? Sign in" inside the offer dialog swaps it for the login form
      this.logger.log('Signing in to Otago Daily Times via the subscription dialog.');
      await page.frameLocator('iframe[id^="offer-"]').locator('a.sign-in-bold').click();
    } else {
      this.logger.log('Signing in to Otago Daily Times via the header.');
      await page.locator('div.sign-in-button button').first().click();
    }

    // Either way the Piano ID login form lands in its own iframe, id-prefixed piano-id. Match on that
    // rather than on .tp-modal iframe, which also matches the offer dialog, or on the src, which
    // contains the id host on both iframes. Note the password input carries no name attribute, so it
    // has to be matched on type.
    const piano = page.frameLocator('iframe[id^="piano-id"]');
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

  async scanHome({}: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    return [];
  }

  async scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Free articles render the body as div#article-body, paywalled ones as div#article_body_paywall.
    // Both carry the article-body class, so match on that rather than on either id.
    //
    // ODT serves the container EMPTY and Piano fills it client-side only once entitlement is confirmed,
    // so neither the element's presence nor a first non-empty read proves the body is complete.
    const text = await this.readSettledArticleText({ page });

    // A subscription offer still on screen means this session was never entitled, so whatever rendered
    // is a teaser — refuse it rather than persist a truncated body over a News Item.
    if ((await page.locator('iframe[id^="offer-"]').count()) > 0) {
      throw new Error(`Subscription offer still showing — session is not entitled: ${url}`);
    }

    if (text.length === 0) {
      throw new Error(`Article body never filled — not entitled or paywall-locked: ${url}`);
    }

    return { text };
  }

  // Article Text. :not(.paywallbox) drops the paywall prompt Piano can inject into the body. Polls until
  // the joined length holds steady, so a body still being written isn't mistaken for a complete one.
  private async readSettledArticleText({ page }: AuthenticateFnProps): Promise<string> {
    const deadline = Date.now() + BODY_SETTLE_TIMEOUT_MS;
    let text = '';
    let previousLength = -1;
    let unchangedPolls = 0;

    while (Date.now() < deadline) {
      text = (await page.locator(ARTICLE_BODY_SELECTOR).allTextContents()).join('');

      if (text.length > 0 && text.length === previousLength) {
        if (++unchangedPolls >= BODY_SETTLE_POLLS) return text;
      } else {
        unchangedPolls = 0;
      }

      previousLength = text.length;
      await page.waitForTimeout(BODY_SETTLE_POLL_MS);
    }

    return text;
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
