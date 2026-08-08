import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

// Otago Daily Times premium articles are locked behind a Piano paywall: logged out, the article page
// renders no .article-body at all, so 0 chars come back. A substantial text length here therefore
// proves the Piano login worked and the subscription is live.
const MIN_PAGE_TEXT_CHAR_COUNT = 500;

type TeaserLinkProps = ArticleLinkProps & { premium: boolean };

[{ name: 'Otago Daily Times', url: 'https://www.odt.co.nz', section: '/news/dunedin' }].forEach(({ name, url, section }) => {
  test(`testing ${name} at ${url} on section ${section}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticate({ page });

    const articles = await getLinks({ page, url: `${url}${section}` });
    expect(articles.length).toBeGreaterThan(0);

    // Only the premium articles exercise the paywall, which is the point of this suite
    const premiumArticles = articles.filter((a) => a.premium);
    console.log(`Found ${articles.length} articles on ${section}, ${premiumArticles.length} of them premium.`);
    expect(premiumArticles.length).toBeGreaterThan(0);

    // Pick a random premium article from the list returned
    const article = premiumArticles[Math.floor(Math.random() * premiumArticles.length)];
    console.log(`Scanning premium article: ${article.link}`);

    const { text } = await scanArticle({ page, url: article.link });
    console.log(`Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logout({ page });
  });
});

async function authenticate({ page }: AuthenticateFnProps) {
  await page.locator('div.sign-in-button button').first().waitFor();
  await page.locator('div.sign-in-button button').first().click();

  // The Piano ID login form is served from id-au.piano.io inside an iframe in the .tp-modal overlay.
  // Note the password input has no name attribute, so it has to be matched on type.
  await page.locator('.tp-modal iframe').first().waitFor();
  const piano = page.frameLocator('.tp-modal iframe').first();
  await piano.locator('input[name="email"]').fill(process.env['ODT_LOGIN_USERNAME']);
  await piano.locator('input[type="password"]').fill(process.env['ODT_LOGIN_PASSWORD']);
  await piano.locator('button.btn', { hasText: /sign in/i }).first().click();

  // The header swaps SIGN IN for SIGN OUT once authenticated. Note div.sign-in-button stays in the
  // DOM either way, so its presence is not a usable signal.
  await page.getByRole('button', { name: /sign out/i }).first().waitFor();
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
  await page.getByRole('button', { name: /sign out/i }).first().click();
  await page.getByRole('button', { name: /sign in/i }).first().waitFor();
}
