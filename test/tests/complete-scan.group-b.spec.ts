import { expect, test } from '@playwright/test';
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
    await page.goto(url);

    await authenticate({ page });

    await page.locator('div.frame-container.top-stories-section-frame').waitFor();

    const articles = await getLinks({ page, url });

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
    expect(text.length).toBeGreaterThanOrEqual(0);

    await logout({ page });
  });
});

async function authenticate({}: AuthenticateFnProps) {}

async function getLinks({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  url = 'https://www.stuff.co.nz';

  // Wait for page to load
  await page.locator('div.story-card.story1.lead a').waitFor();
  await page.locator('div.story-card.story2 a').waitFor();
  await page.locator('div.story-card.secondary a').first().waitFor();

  // Find all articles under each sub-section
  const articles = [
    await page.locator('div.story-card.story1.lead a'),
    await page.locator('div.story-card.story2 a'),
    ...(await page.locator('div.story-card.secondary a').all())
  ];

  // Extract & return all links, titles & descriptions for each article
  return [
    ...(await Promise.all(
      articles.map(async (article) => ({
        link: `${url}${await article.getAttribute('href')}`,
        title: (await article.locator(page.locator('span.heading-text')).innerText()) as string,
        description: (await article.locator(page.locator('p.common-text-body')).innerText()) as string
      }))
    ))
  ];
}

async function scanArticle({ page, url }: ScanFnProps): Promise<ArticleProps> {
  await page.goto(url);
  await page.locator('#ionContentElement').waitFor();

  if (await page.getByRole('button', { name: 'Close Ad' }).isVisible()) {
    await page.getByRole('button', { name: 'Close Ad' }).click();
  }

  // Article Text
  const textContents: Array<string> = ([] as Array<string>).concat(await page.locator('div.content-groups p').allTextContents());

  return {
    text: textContents.join('')
  };
}

async function logout({}: AuthenticateFnProps) {}
