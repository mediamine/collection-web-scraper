import { errors, expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

[
  { name: 'Manawatu Standard', url: 'https://www.stuff.co.nz/manawatu-standard' },
  { name: 'Marlborough News', url: 'https://www.stuff.co.nz/marlborough-news' },
  { name: 'Nelson Mail', url: 'https://www.stuff.co.nz/nelson-mail' },
  { name: 'Southland Times', url: 'https://www.stuff.co.nz/southland-times' },
  { name: 'Taranaki Daily News', url: 'https://www.stuff.co.nz/taranaki-daily-news' },
  { name: 'Timaru Herald', url: 'https://www.stuff.co.nz/timaru-herald' }
].forEach(({ name, url }) => {
  test(`testing ${name} at ${url}`, async ({ page }) => {
    // Not 'load': these pages are ad-heavy, so with several browsers open at once the load event can take minutes
    // to fire (or never do). Everything below waits explicitly for the content it needs instead.
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticate({ page });

    await page.locator('section.page-content').waitFor();

    const articles = await getLinks({ page, url });

    // Video-led articles (~6%) have no body paragraphs at all, so try up to 3 articles & expect text from one of them
    const tried: Array<string> = [];
    let text = '';
    while (!text.length && tried.length < 3) {
      // Pick a random article from the list returned
      let article = articles[Math.floor(Math.random() * articles.length)];
      // & keep picking again until it has a valid link url
      while (!(
        article.link &&
        !/https[^\s]+https[^\s]+/.test(article.link) &&
        !['www.ensemblemagazine.co.nz', 'sponsoredinteractive.stuff.co.nz'].some((d) => article.link.includes(d))
      )) {
        article = articles[Math.floor(Math.random() * articles.length)];
      }

      tried.push(article.link);
      ({ text } = await scanArticle({ page, url: article.link }));
    }
    expect(text.length, `No article text in any of: ${tried.join(', ')}`).toBeGreaterThan(0);

    await logout({ page });
  });
});

async function authenticate({}: AuthenticateFnProps) {}

async function getLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  url = 'https://www.stuff.co.nz';

  // Wait for page to load
  // await page.locator('div.story-card.story1.lead a').waitFor();
  // await page.locator('div.story-card.story2 a').waitFor();
  // await page.locator('div.story-card.secondary a').first().waitFor();
  await page.locator('div[data-testid="grid-row"] [data-testid="grid-card-content"]>a').first().waitFor();

  // Find all articles under each sub-section, then extract & return all links, titles & descriptions for each one in
  // a single pass. Don't fan out a getAttribute()/innerText() per article: that is ~3 round trips per article on a
  // busy, ad-heavy page (15-50s each under load), and .all() returns positional (nth) locators, so if the list
  // re-renders shorter the remaining calls wait on articles that no longer exist until the test times out.
  return await page.evaluate(
    (base) =>
      Array.from(document.querySelectorAll('div[data-testid="grid-row"] [data-testid="grid-card-content"]>a')).map((article) => {
        const title = article.querySelector<HTMLElement>('h3')?.innerText ?? '';
        return { link: `${base}${article.getAttribute('href')}`, title, description: title };
      }),
    url
  );
}

async function scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#ionContentElement').waitFor();

  if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
    await page.getByRole('button', { name: 'Close Ad' }).click();
  }

  // The body renders after domcontentloaded, so wait for it before reading or allTextContents() returns [] (or a
  // partial body). A video-led article never gets one, so a timeout isn't an error here: it just yields no text
  // and the caller tries another article.
  await page
    .locator('div.content-groups p')
    .first()
    .waitFor({ state: 'attached', timeout: 15000 })
    .catch((error) => {
      if (!(error instanceof errors.TimeoutError)) throw error;
    });

  // Article Text
  const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.content-groups p').allTextContents());

  return {
    text: textContents.join('')
  };
}

async function logout({}: AuthenticateFnProps) {}
