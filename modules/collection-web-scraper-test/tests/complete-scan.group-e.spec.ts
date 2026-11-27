import { errors, expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

[
  { name: 'The Post', url: 'https://www.thepost.co.nz', section: 'Politics' },
  { name: 'The Press', url: 'https://www.thepress.co.nz', section: 'NZ news' },
  { name: 'Waikato Times', url: 'https://www.waikatotimes.co.nz', section: 'NZ news' }
].forEach(({ name, url, section }) => {
  test(`testing ${name} at ${url} on section ${section}`, async ({ page }) => {
    // Not 'load': these pages are ad-heavy, so with several browsers open at once the load event can take minutes
    // to fire (or never do). Everything below waits explicitly for the content it needs instead.
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await authenticate({ page });

    const articles = await getLinks({ page, url }, section);

    expect(articles.map((a) => a.link).every((link) => !link.includes('/topics/'))).toBeTruthy();

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
    const { text } = await scanArticle({ page, url: article.link });
    expect(text.length).toBeGreaterThan(0);

    await logout({ page });
  });
});

async function authenticate({ page }: AuthenticateFnProps) {
  await page.getByTestId('login-button').click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(process.env['STUFF_LOGIN_USERNAME']);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env['STUFF_LOGIN_PASSWORD']);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();
}

async function getLinks({ page, url }: ScanFnProps, section: string): Promise<Array<ArticleLinkProps>> {
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Navigate to the section page
  await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();
  await page.getByRole('button', { name: 'Toggle navigation menu' }).click();

  await page.getByRole('link', { name: section, exact: true }).first().waitFor();
  await page.getByRole('link', { name: section, exact: true }).first().click();

  // Wait for page to load
  await page.locator('div[data-testid="box-container"] article').first().waitFor();

  // Extract & return all links, titles & descriptions for each article under each sub-section, in a single pass.
  // Don't fan out a getAttribute()/innerText() per article: that is ~3 round trips per article on a busy, ad-heavy
  // page, and .all() returns positional (nth) locators, so if the list re-renders shorter the remaining calls wait
  // on articles that no longer exist until the test times out.
  return await page.evaluate(
    (base) =>
      Array.from(document.querySelectorAll('div[data-testid="box-container"] article')).map((article) => {
        const title = article.querySelector<HTMLElement>('h3')?.innerText ?? '';
        return {
          link: `${base}${article.querySelector('div[data-testid="grid-card-content"] > a')?.getAttribute('href')}`,
          title,
          description: title
        };
      }),
    url
  );
}

async function scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('section.page-content').waitFor();

  // The body renders after domcontentloaded, so wait for it before reading or allTextContents() returns [] (almost
  // always, on these pages). A timeout isn't an error here: the caller's own text-length assertion reports it.
  await page
    .locator('div.text-block > p, div.text-block > div.paywall > p, div[data-testid="body-paragraph"] > p')
    .first()
    .waitFor({ state: 'attached', timeout: 30000 })
    .catch((error) => {
      if (!(error instanceof errors.TimeoutError)) throw error;
    });

  // Article Text
  const textContents: Array<string> = ([] as Array<string>).concat(
    await page.locator('div.text-block > p').allTextContents(),
    await page.locator('div.text-block > div.paywall > p').allTextContents(),
    await page.locator('div[data-testid="body-paragraph"] > p').allTextContents()
  );

  return {
    text: textContents.join('')
  };
}

async function logout({ page }: AuthenticateFnProps) {
  await page.getByTestId('dropdown-button').click();
  await page.getByRole('link', { name: 'Sign Out' }).click();
  await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();
}
