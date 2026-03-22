import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

[
  { name: 'Manawatu Standard (Subscription)', url: 'https://www.thepost.co.nz/manawatu' },
  { name: 'The Marlborough Express (Subscription)', url: 'https://www.thepress.co.nz/marlborough' },
  { name: 'Nelson Mail (Subscription)', url: 'https://www.thepress.co.nz/nelson' },
  { name: 'Southland Times (Subscription)', url: 'https://www.thepress.co.nz/southland' },
  { name: 'Taranaki Daily News (Subscription)', url: 'https://www.thepost.co.nz/taranaki' },
  { name: 'Timaru Herald (Subscription)', url: 'https://www.thepress.co.nz/timaru' },
  { name: 'Wairarapa Times-Age (Subscription)', url: 'https://www.thepost.co.nz/wairarapa' },
  { name: 'Sunday Star Times (Subscription)', url: 'https://www.thepost.co.nz/sunday-star-times' }
].forEach(({ name, url }) => {
  test(`testing ${name} at ${url}`, async ({ page }) => {
    await page.goto(url);

    await authenticate({ page });

    await page.locator('section.page-content').waitFor();

    const articles = await getLinks({ page, url });

    expect(articles.map((a) => a.link).every((link) => !link.includes('/topics/'))).toBeTruthy();

    // Pick a random article from the list returned
    let article = articles[Math.floor(Math.random() * articles.length)];
    // & keep picking again until it has a valid link url
    while (
      !(
        article.link &&
        !/https[^\s]+https[^\s]+/.test(article.link) &&
        !['www.ensemblemagazine.co.nz', 'sponsoredinteractive.stuff.co.nz'].some((d) => article.link.includes(d))
      )
    ) {
      article = articles[Math.floor(Math.random() * articles.length)];
    }

    const { text } = await scanArticle({ page, url: article.link });
    expect(text.length).toBeGreaterThan(0);

    await logout({ page });
  });
});

async function authenticate({}: AuthenticateFnProps) {}

async function getLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  // Wait for page to load
  await page.locator('div[data-testid="box-container"]').first().waitFor();

  // Find all articles under each sub-section
  const articles = [...(await page.locator('div[data-testid="box-container"] article').all())];

  // Extract & return all links, titles & descriptions for each article
  return await Promise.all(
    articles.map(async (article) => ({
      link: `${url}${await article.locator(page.locator('div[data-testid="grid-card-content"] > a').first()).getAttribute('href')}`,
      title: (await article.locator(page.locator('h3')).innerText()) as string,
      description: ''
    }))
  );
}

async function scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url, { timeout: 60000 });
  await page.locator('section.page-content').waitFor();

  // Article Text
  const textContents: Array<string> = ([] as Array<string>).concat(
    await page.locator('div.text-block > p').allTextContents(),
    await page.locator('div.text-block > div.paywall > p').allTextContents()
  );

  return {
    text: textContents.join('')
  };
}

async function logout({}: AuthenticateFnProps) {}
