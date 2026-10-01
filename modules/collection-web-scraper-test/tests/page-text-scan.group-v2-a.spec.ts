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

// Piano fills the body in one write, but not necessarily by the first read: a locked or metered page
// renders only a lead/teaser paragraph, and a production run persisted 85 chars of standfirst that way.
// So settle on a body length that has stopped changing instead of trusting the first non-empty read.
const ARTICLE_BODY_SELECTOR = 'div.article-body p:not(.paywallbox)';
const BODY_SETTLE_POLL_MS = 250;
const BODY_SETTLE_POLLS = 3;
const BODY_SETTLE_TIMEOUT_MS = 20000;

// Articles a production run came back with no, or truncated, page_text for. Each is checked against a
// phrase deep in its body, so a partial scrape fails rather than passing on the opening paragraph.
const PREVIOUSLY_EMPTY_ARTICLES = [
  {
    link: 'https://www.odt.co.nz/news/dunedin/community-groups-funding-reduced-after-council-bungle-l4yzpjyr',
    expectedText: 'that was actually available.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/a-unique-gift-tertiary-student-urges-peers-to-join-bone-marrow-registry-e3al45xy',
    expectedText: 'diverse population.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/dunedin-cancer-patient-failed-by-health-system-gets-200k-drug-lifeline-m8a2k032',
    expectedText: 'he feels like he has hope.'
  },
  {
    link: 'https://www.odt.co.nz/news/dunedin/bat-myths-bite-the-dust-in-new-research-bq9jkq40',
    expectedText: 'diseases in the future.'
  },
  {
    // Long-form template, and the one that persisted only its 85 char standfirst. This phrase sits 89%
    // of the way through the body, so reaching it proves the whole body settled before being read.
    link: 'https://www.odt.co.nz/life-and-style/fashion/otepoti-op-shop-hop-mapping-dunedins-second-hand-style-scene-dbwl3dwy',
    expectedText: 'make up Artist Kim Tuiliau, florist Estelle Flowers, stylist Cat Callanan'
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

    for (const { link, expectedText } of PREVIOUSLY_EMPTY_ARTICLES) {
      const { text } = await scanArticle({ page, url: link });
      console.log(`Scraped ${text.length} chars from ${link.split('/').pop()}`);

      expect(text.length).toBeGreaterThan(MIN_PINNED_PAGE_TEXT_CHAR_COUNT);
      expect(normaliseWhitespace(text)).toContain(normaliseWhitespace(expectedText));
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
  // entitlement is confirmed. Reading on the first non-empty poll is what truncated articles to their
  // standfirst, so read it only once the length has settled.
  const text = await readSettledArticleText(page);

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
async function readSettledArticleText(page: Record<string, any>): Promise<string> {
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
