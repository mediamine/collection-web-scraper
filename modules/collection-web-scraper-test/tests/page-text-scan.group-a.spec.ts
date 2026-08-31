import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

// The three page-text-scan publications share a workflow but not a login model or a DOM, so each has
// its own test and its own set of scraping functions:
//
//   Business Desk  no login. Paywalled articles expose only a ~515 char teaser, free ones the full body.
//   NBR            logs in. Anonymous articles return a ~290 char teaser, so clearing 1000 chars is
//                  itself the proof that the session worked.
//   Stuff          no login, no paywall.

// A Business Desk teaser runs ~515 chars and a Stuff article runs into the thousands, so this only has
// to be high enough to catch an empty or broken scrape.
const MIN_PAGE_TEXT_CHAR_COUNT = 200;
// No NBR teaser reaches this, so passing it means the session was live.
const NBR_MIN_PAGE_TEXT_CHAR_COUNT = 1000;

test.describe('page-text-scan group-a', () => {
  test('testing Business Desk at https://businessdesk.co.nz', async ({ page }) => {
    const url = 'https://businessdesk.co.nz';
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticateBusinessDesk({ page });

    const articles = await getBusinessDeskLinks({ page, url });
    expect(articles.length).toBeGreaterThan(0);

    // Pick a random article from the list returned
    const article = articles[Math.floor(Math.random() * articles.length)];
    console.log(`[Business Desk] Found ${articles.length} articles. Picked: ${article.link}`);

    const { text } = await scanBusinessDeskArticle({ page, url: article.link });
    console.log(`[Business Desk] Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logoutBusinessDesk({ page });
  });

  test('testing National Business Review at https://www.nbr.co.nz', async ({ page }) => {
    const url = 'https://www.nbr.co.nz';
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticateNationalBusinessReview({ page });

    const articles = await getNationalBusinessReviewLinks({ page, url });
    expect(articles.length).toBeGreaterThan(0);

    // Pick a random article from the list returned
    const article = articles[Math.floor(Math.random() * articles.length)];
    console.log(`[National Business Review] Found ${articles.length} articles. Picked: ${article.link}`);

    const { text } = await scanNationalBusinessReviewArticle({ page, url: article.link });
    console.log(`[National Business Review] Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(NBR_MIN_PAGE_TEXT_CHAR_COUNT);

    await logoutNationalBusinessReview({ page });
  });

  test('testing Stuff at https://www.stuff.co.nz', async ({ page }) => {
    const url = 'https://www.stuff.co.nz';
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticateStuff({ page });

    const articles = await getStuffLinks({ page, url });
    expect(articles.length).toBeGreaterThan(0);

    // Pick a random article from the list returned
    const article = articles[Math.floor(Math.random() * articles.length)];
    console.log(`[Stuff] Found ${articles.length} articles. Picked: ${article.link}`);

    const { text } = await scanStuffArticle({ page, url: article.link });
    console.log(`[Stuff] Scraped ${text.length} chars of page text.`);
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

    await logoutStuff({ page });
  });
});

/* ---------------------------------------------------------------- Business Desk (no login) ------ */

// BusinessDesk is read anonymously, so there is deliberately no login flow
async function authenticateBusinessDesk({}: AuthenticateFnProps) {}

async function getBusinessDeskLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the home page card grid to load
  await page.locator('div.card.news-card').first().waitFor();

  // Extracted in a single DOM pass — a locator call per field across ~77 cards costs minutes of
  // round trips. Note BusinessDesk hrefs are absolute, and not every card links to an article.
  const articles: Array<ArticleLinkProps> = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div.card.news-card'))
      .map((card) => ({
        link: card.querySelector('a[href*="/article/"]')?.getAttribute('href') ?? '',
        title: (card.querySelector('.card-title')?.textContent ?? '').trim(),
        description: (card.querySelector('.card-text')?.textContent ?? '').trim()
      }))
      .filter((a) => a.link)
  );

  return articles;
}

async function scanBusinessDeskArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // A free article renders the full body as div.article-body; a paywalled one renders none of it and
  // shows a truncated teaser in div.paywall instead. Wait for whichever this article has.
  await page.locator('div.article-body, div.paywall').first().waitFor();

  const articleBody = page.locator('div.article-body');
  if ((await articleBody.count()) > 0) {
    console.log('[Business Desk] Article is not paywalled — scraping the full body.');
    const textContents: Array<string> = ([] as Array<string>).concat(await articleBody.locator('p').allTextContents());

    return {
      text: textContents.join('')
    };
  }

  // The teaser is raw text directly inside div.paywall, with no <p> children to collect
  const paywall = page.locator('div.paywall');
  if ((await paywall.count()) > 0) {
    console.log('[Business Desk] Article is paywalled — scraping the teaser.');

    return {
      text: await paywall.first().innerText()
    };
  }

  throw new Error(`No article body or paywall teaser found: ${url}`);
}

async function logoutBusinessDesk({}: AuthenticateFnProps) {}

/* ------------------------------------------------- National Business Review (needs login) ------- */

async function authenticateNationalBusinessReview({ page }: AuthenticateFnProps) {
  // NBR sessions are tied to one shared subscriber account, so two of these running at once will log
  // each other out — don't run this test in parallel with itself (e.g. --repeat-each with >1 worker).
  // Going straight to the login form avoids depending on the header's log in control.
  await page.goto('https://www.nbr.co.nz/Security/login/?BackURL=%2F', { waitUntil: 'domcontentloaded' });

  await page.locator('input[name="Email"]').fill(process.env['NBR_LOGIN_USERNAME']);
  await page.locator('input[name="Password"]').fill(process.env['NBR_LOGIN_PASSWORD']);
  // The submit control is an <input type="submit" value="Log in">, not a button element
  await page.locator('input[type="submit"][name="action_doLogin"]').click();

  // Signed in, the header swaps the log in link for a My Account link
  await page.getByRole('link', { name: /my account/i }).first().waitFor();
}

async function getNationalBusinessReviewLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Many cards are hidden at this breakpoint, so wait for attachment rather than visibility
  const cardSelector = 'div.article-big, div.article-medium, div.article-small';
  await page.locator(cardSelector).first().waitFor({ state: 'attached' });

  // Extracted in a single DOM pass — a locator call per field across ~111 cards is slow enough to
  // blow the test timeout. NBR hrefs are relative, and section links (one path segment) aren't articles.
  const articles: Array<ArticleLinkProps> = await page.evaluate(
    (cardSelector: string) =>
      Array.from(document.querySelectorAll(cardSelector))
        .map((card) => ({
          link: card.querySelector('a[href^="/"]')?.getAttribute('href') ?? '',
          title: (card.querySelector('h4.text-single-title')?.textContent ?? '').trim(),
          description: (card.querySelector('p.text-description')?.textContent ?? '').trim()
        }))
        .filter((a) => a.link.split('/').filter(Boolean).length >= 2),
    cardSelector
  );

  // The same article appears in several cards, so collapse duplicates
  return articles
    .filter((a, i) => articles.findIndex((b) => b.link === a.link) === i)
    .map((a) => ({ ...a, link: `${url}${a.link}` }));
}

async function scanNationalBusinessReviewArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('div.article-content').waitFor();

  // Article Text. Signed out this returns only the opening teaser, which is why the test asserts a
  // length no teaser could reach.
  const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-content p').allTextContents());

  return {
    text: textContents.join('')
  };
}

async function logoutNationalBusinessReview({ page }: AuthenticateFnProps) {
  // Best effort — releasing the session is desirable but must not fail the run
  try {
    await page.getByRole('link', { name: /my account/i }).first().click();
    await page.getByRole('link', { name: /log ?out|sign ?out/i }).first().click();
    await page.getByRole('link', { name: /log ?in/i }).first().waitFor();
    console.log('[National Business Review] Signed out.');
  } catch (e: any) {
    console.log(`[National Business Review] Sign out failed, ignoring: ${e.message.split('\n')[0]}`);
  }
}

/* ------------------------------------------------------------------------ Stuff (no login) ------ */

// Stuff articles are readable anonymously
async function authenticateStuff({}: AuthenticateFnProps) {}

async function getStuffLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the home page card grid to load
  await page.locator('[data-testid="grid-card-content"] > a').first().waitFor();

  // Extracted in a single DOM pass — a locator call per field across ~130 anchors costs minutes of
  // round trips. Stuff hrefs are relative.
  const articles: Array<ArticleLinkProps> = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="grid-card-content"] > a'))
      .map((anchor) => {
        const title = (anchor.querySelector('h3')?.textContent ?? '').trim();

        return { link: anchor.getAttribute('href') ?? '', title, description: title };
      })
      .filter((a) => a.link)
  );

  return articles.map((a) => ({ ...a, link: a.link.startsWith('http') ? a.link : `${url}${a.link}` }));
}

async function scanStuffArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
    await page.getByRole('button', { name: 'Close Ad' }).click();
  }

  if (await page.locator('div.common-error-display').isVisible()) {
    return {
      text: ''
    };
  }

  // Standard articles wrap paragraphs in div[data-testid="body-paragraph"], but live blogs don't use
  // it at all — div.content-groups covers both, so prefer it and keep the other as a fallback.
  await page.locator('div.content-groups, div[data-testid="body-paragraph"]').first().waitFor();

  const contentGroups = page.locator('div.content-groups');
  const selector = (await contentGroups.count()) > 0 ? 'div.content-groups p' : 'div[data-testid="body-paragraph"] > p';

  // Article Text
  const textContents: Array<string> = ([] as Array<string>).concat(await page.locator(selector).allTextContents());

  return {
    text: textContents.join('')
  };
}

async function logoutStuff({}: AuthenticateFnProps) {}
