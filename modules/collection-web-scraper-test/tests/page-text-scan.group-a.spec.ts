import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

// The three page-text-scan publications share a workflow but not a DOM, so each has its own test and
// its own set of scraping functions. None of them logs in:
//
//   Business Desk  no login. Paywalled articles expose only a ~300-600 char teaser, free ones the full body.
//   NBR            no login. Paywalled articles expose only a ~290 char teaser.
//   Stuff          no login, no paywall.

// A NBR teaser runs ~290 chars, a Business Desk one ~300-600 and a Stuff article runs into the thousands,
// so this only has to be high enough to catch an empty or broken scrape.
const MIN_PAGE_TEXT_CHAR_COUNT = 200;

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
    expect(text.length).toBeGreaterThan(MIN_PAGE_TEXT_CHAR_COUNT);

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
  await page.locator('article a[href]').first().waitFor();

  // Extracted in a single DOM pass — a locator call per field across ~100 cards costs minutes of
  // round trips. Cards carry only utility classes, so they are matched on structure: an <article>
  // whose links go to /<section>/<slug>/<ID>/. Cards also link section and topic index pages, which
  // end in no ID and aren't articles. Hrefs read through .href are absolute.
  const articles: Array<ArticleLinkProps> = await page.evaluate(() => {
    const isArticleLink = (href: string) => /\/[A-Z0-9]{26}\/?$/.test(href);
    const seen = new Set<string>();

    return Array.from(document.querySelectorAll('article'))
      .map((card) => {
        const anchors = Array.from(card.querySelectorAll('a[href]')).filter((a) => isArticleLink((a as HTMLAnchorElement).href));
        // The headline is the card's first link with text, the standfirst the next one — both go to
        // the same article, and not every card has a standfirst.
        const [title = '', description = ''] = anchors.map((a) => (a.textContent ?? '').trim()).filter(Boolean);

        return { link: (anchors[0] as HTMLAnchorElement)?.href ?? '', title, description };
      })
      .filter((a) => a.link && !seen.has(a.link) && seen.add(a.link));
  });

  return articles;
}

async function scanBusinessDeskArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Every article is first served as a truncated teaser (section.article__body.premium-content), then
  // the paywall script decides. A free article flips to section.full-content and reveals every
  // paragraph; a paywalled one gets the #zephr-html-paywall prompt and stays truncated. Reading before
  // that decision would cut a free article short, so wait for either outcome.
  await page.locator('section.article__body.full-content, #zephr-html-paywall').first().waitFor({ state: 'attached' });

  // A paywalled article still holds every paragraph in the DOM, hiding all but the teaser with
  // display:none, and textContent reads straight through that. :visible keeps only the paragraphs that
  // are rendered, which is what an anonymous reader sees and all this scrape is after.
  const textContents: Array<string> = await page.locator('section.article__body p:visible').allTextContents();

  if (textContents.length === 0) {
    throw new Error(`No article text found: ${url}`);
  }

  const isPaywalled = (await page.locator('#zephr-html-paywall').count()) > 0;
  console.log(`[Business Desk] Article is ${isPaywalled ? 'paywalled — scraping the teaser' : 'not paywalled — scraping the full body'}.`);

  return {
    text: textContents.join('')
  };
}

async function logoutBusinessDesk({}: AuthenticateFnProps) {}

/* ------------------------------------------------- National Business Review (no login) ---------- */

// NBR is read anonymously, so there is deliberately no login flow
async function authenticateNationalBusinessReview({}: AuthenticateFnProps) {}

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

  // Article Text. Read anonymously, a paywalled article returns only the opening teaser (~290 chars).
  const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.article-content p').allTextContents());

  return {
    text: textContents.join('')
  };
}

async function logoutNationalBusinessReview({}: AuthenticateFnProps) {}

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
