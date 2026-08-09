import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

// Otago Daily Times premium articles are locked behind a Piano paywall: logged out, the article page
// renders no .article-body at all, so 0 chars come back. A substantial text length here therefore
// proves the Piano login worked and the subscription is live.
const MIN_PAGE_TEXT_CHAR_COUNT = 500;

type TeaserLinkProps = ArticleLinkProps & { premium: boolean };

[{ name: 'Otago Daily Times', url: 'https://www.odt.co.nz', section: '/news/dunedin' }].forEach(({ name, url, section }) => {
  // This is the path the page-text-scan-v2 workflow itself takes: it opens a news_item link directly,
  // never the home page, so authenticating has to work from the subscription dialog.
  test(`testing ${name} at ${url} signing in from the subscription dialog`, async ({ page }) => {
    const article = await pickPremiumArticle({ page, url: `${url}${section}` });

    await page.goto(article.link, { waitUntil: 'domcontentloaded' });

    // Opening a premium article directly pops Piano's subscription offer. Assert it really showed, so
    // this test can't silently degrade into the header sign in path that the next test covers.
    await page.locator('iframe[id^="offer-"]').waitFor();
    expect(await page.locator('iframe[id^="offer-"]').count()).toBeGreaterThan(0);

    await authenticate({ page });

    const { text } = await scanArticle({ page, url: article.link });
    console.log(`Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logout({ page });
  });

  // The fallback path: no subscription dialog is shown, so the header control is the way in. Happens
  // whenever the first link the workflow opens is a free article.
  test(`testing ${name} at ${url} signing in from the header`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(await page.locator('iframe[id^="offer-"]').count()).toBe(0);

    await authenticate({ page });

    const article = await pickPremiumArticle({ page, url: `${url}${section}` });

    const { text } = await scanArticle({ page, url: article.link });
    console.log(`Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logout({ page });
  });
});

async function pickPremiumArticle({ page, url }: ScanFnProps): Promise<TeaserLinkProps> {
  const articles = await getLinks({ page, url });
  expect(articles.length).toBeGreaterThan(0);

  // Only the premium articles exercise the paywall, which is the point of this suite
  const premiumArticles = articles.filter((a) => a.premium);
  console.log(`Found ${articles.length} articles on ${url}, ${premiumArticles.length} of them premium.`);
  expect(premiumArticles.length).toBeGreaterThan(0);

  // Pick a random premium article from the list returned
  const article = premiumArticles[Math.floor(Math.random() * premiumArticles.length)];
  console.log(`Picked premium article: ${article.link}`);

  return article;
}

async function authenticate({ page }: AuthenticateFnProps) {
  // The header control renders on every page, signed in or out — only its label changes — so it is the
  // cheapest thing to wait on before reading auth state.
  await page.locator('div.sign-in-button button').first().waitFor();

  if ((await page.getByRole('button', { name: /sign out/i }).count()) > 0) {
    console.log('Already signed in.');
    return;
  }

  // Piano injects its subscription offer asynchronously, so give it a chance to show up before
  // deciding which way in to use. On a premium article it appears; elsewhere it never does.
  const offerDialog = page.locator('iframe[id^="offer-"]');
  await offerDialog.waitFor({ timeout: 15000 }).catch(() => {});

  if ((await offerDialog.count()) > 0) {
    // "Already a subscriber? Sign in" inside the offer dialog swaps it for the login form
    console.log('Signing in via the subscription dialog.');
    await page.frameLocator('iframe[id^="offer-"]').locator('a.sign-in-bold').click();
  } else {
    console.log('Signing in via the header.');
    await page.locator('div.sign-in-button button').first().click();
  }

  // Either way the Piano ID login form lands in its own iframe, id-prefixed piano-id. Match on that
  // rather than on .tp-modal iframe, which also matches the offer dialog, or on the src, which
  // contains the id host on both iframes.
  const piano = page.frameLocator('iframe[id^="piano-id"]');
  await piano.locator('input[name="email"]').fill(process.env['ODT_LOGIN_USERNAME']);
  // Note the password input carries no name attribute, so it has to be matched on type
  await piano.locator('input[type="password"]').fill(process.env['ODT_LOGIN_PASSWORD']);
  await piano
    .locator('button.btn', { hasText: /sign in/i })
    .first()
    .click();

  // The header swaps SIGN IN for SIGN OUT once authenticated
  await page
    .getByRole('button', { name: /sign out/i })
    .first()
    .waitFor();
}

async function getLinks({ page, url }: ScanFnProps): Promise<Array<TeaserLinkProps>> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the section listing to load
  await page.locator('div.default-section-list div.teaser').first().waitFor();

  // Find all article teasers in the section listing
  const teasers = [...(await page.locator('div.default-section-list div.teaser').all())];

  // Extract & return all links, titles & descriptions for each article. Note ODT hrefs are absolute,
  // and not every teaser carries a description.
  const articles = await Promise.all(
    teasers.map(async (teaser) => {
      const title = teaser.locator('h3.teaser-title > a').first();
      const description = teaser.locator('div.teaser-text > a').first();

      if ((await title.count()) === 0) return null;

      return {
        link: (await title.getAttribute('href')) as string,
        title: await title.innerText(),
        description: (await description.count()) > 0 ? await description.innerText() : '',
        premium: ((await teaser.getAttribute('class')) ?? '').includes('teaser-premium')
      };
    })
  );

  return articles.filter((a) => a && a.link) as Array<TeaserLinkProps>;
}

async function scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Free articles render the body as div#article-body, paywalled ones as div#article_body_paywall.
  // Both carry the article-body class, so match on that rather than on either id.
  await page.locator('div.article-body').first().waitFor();

  // Article Text. :not(.paywallbox) drops the paywall prompt Piano can inject into the body.
  const textContents: Array<string> = ([] as Array<string>).concat(
    await page.locator('div.article-body p:not(.paywallbox)').allTextContents()
  );

  return {
    text: textContents.join('')
  };
}

async function logout({ page }: AuthenticateFnProps) {
  // Piano tracks concurrent sessions per subscriber account, so release this one. Note the same
  // div.sign-in-button wrapper is used signed in or out, so assert on the button label coming back.
  await page
    .getByRole('button', { name: /sign out/i })
    .first()
    .click();
  await page
    .getByRole('button', { name: /sign in/i })
    .first()
    .waitFor();
}
