import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

// Otago Daily Times premium articles are locked behind a Piano paywall. The body container is served
// EMPTY and Piano injects the paragraphs client-side once it has confirmed entitlement, and
// scanArticle throws when it never fills — so for a randomly picked premium article ANY text at all is
// the proof that the login worked. A floor is not usable there: ODT runs premium pieces as short as a
// 179 char photo caption, which used to fail this suite at random.
const MIN_PAGE_TEXT_CHAR_COUNT = 0;
// The pinned articles below are known long-form, so they get a real floor on top of the ending check.
const MIN_PINNED_PAGE_TEXT_CHAR_COUNT = 500;

// Articles that came back with no page_text from a production run. Each is checked against the last
// sentence of its body, so a truncated scrape fails rather than passing on a partial read. The body
// carries on with the author's byline email after this, hence toContain rather than an exact match.
const PREVIOUSLY_EMPTY_ARTICLES = [
  {
    link: 'https://www.odt.co.nz/news/dunedin/community-groups-funding-reduced-after-council-bungle-l4yzpjyr',
    endsWith: 'that was actually available.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/a-unique-gift-tertiary-student-urges-peers-to-join-bone-marrow-registry-e3al45xy',
    endsWith: 'diverse population.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/dunedin-cancer-patient-failed-by-health-system-gets-200k-drug-lifeline-m8a2k032',
    endsWith: 'he feels like he has hope.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/bat-myths-bite-the-dust-in-new-research-bq9jkq40',
    endsWith: 'diseases in the future.'
  }
];

// ODT's copy is littered with non-breaking spaces and double spaces — 'he feels like he has hope.'
// contains an nbsp, for instance — so body text is compared on normalised whitespace.
const normaliseWhitespace = (text: string) => text.replace(/\s+/g, ' ');

type TeaserLinkProps = ArticleLinkProps & { premium: boolean };

test.describe('page-text-scan group-v2-a', () => {
  // This is the path the page-text-scan-v2 workflow itself takes: it opens a news_item link directly,
  // never the home page, so authenticating has to work from the subscription dialog.
  test('testing Otago Daily Times at https://www.odt.co.nz signing in from the subscription dialog', async ({ page }) => {
    const url = 'https://www.odt.co.nz';
    const article = await pickPremiumArticle({ page, url: `${url}/news/dunedin` });

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
  test('testing Otago Daily Times at https://www.odt.co.nz signing in from the header', async ({ page }) => {
    const url = 'https://www.odt.co.nz';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(await page.locator('iframe[id^="offer-"]').count()).toBe(0);

    await authenticate({ page });

    const article = await pickPremiumArticle({ page, url: `${url}/news/dunedin` });

    const { text } = await scanArticle({ page, url: article.link });
    console.log(`Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logout({ page });
  });

  // Picking one random premium article only samples the section, so the articles a production run came
  // back empty on are pinned here and scanned in sequence, the way the workflow loops them.
  test('testing Otago Daily Times articles that previously returned no page text', async ({ page }) => {
    await page.goto(PREVIOUSLY_EMPTY_ARTICLES[0].link, { waitUntil: 'domcontentloaded' });

    await authenticate({ page });

    for (const { link, endsWith } of PREVIOUSLY_EMPTY_ARTICLES) {
      const { text } = await scanArticle({ page, url: link });
      console.log(`Scraped ${text.length} chars from ${link.split('/').pop()}`);

      expect(text.length).toBeGreaterThan(MIN_PINNED_PAGE_TEXT_CHAR_COUNT);
      expect(normaliseWhitespace(text)).toContain(normaliseWhitespace(endsWith));
    }

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
  //
  // The container alone proves nothing: it is served EMPTY and Piano fills it client-side only once
  // entitlement is confirmed, so waiting for the element and reading straight away hands back ''.
  // Wait for real text instead, and throw rather than return an empty string the workflow would
  // happily persist over a News Item that has no page text yet.
  try {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('div.article-body p:not(.paywallbox)')).some(
          (p) => (p.textContent ?? '').trim().length > 0
        ),
      { timeout: 20000 }
    );
  } catch {
    throw new Error(`Article body never filled — not entitled or paywall-locked: ${url}`);
  }

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
