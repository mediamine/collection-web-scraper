import { expect, test } from '@playwright/test';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps } from './types';

[
  { name: 'The Post', url: 'https://www.thepost.co.nz', section: 'Politics' },
  { name: 'The Press', url: 'https://www.thepress.co.nz', section: 'NZ news' },
  { name: 'Waikato Times', url: 'https://www.waikatotimes.co.nz', section: 'News' }
].forEach(({ name, url, section }) => {
  test(`testing ${name} at ${url} on section ${section}`, async ({ page }) => {
    await page.goto(url);

    await authenticate({ page });

    const articles = await getLinks({ page, url }, section);

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

async function authenticate({ page }: AuthenticateFnProps) {
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Email address').fill(process.env['STUFF_LOGIN_USERNAME']);
  await page.getByLabel('Password').fill(process.env['STUFF_LOGIN_PASSWORD']);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.locator('#mastheads_menu').waitFor();
}

async function getLinks({ page, url }: ScanFnProps, section: string): Promise<Array<ArticleLinkProps>> {
  await page.reload();

  // Navigate to the section page
  await page.locator('#mastheads_menu').waitFor();
  await page.locator('#mastheads_menu').click();

  await page.getByRole('link', { name: section, exact: true }).waitFor();
  await page.getByRole('link', { name: section, exact: true }).click();

  // Wait for page to load
  await page.locator('div.story-list-medium-container').first().waitFor();
  await page.locator('div.list-stories-frame > div.stories-block').waitFor();

  // Find all articles under each sub-section
  const articles = [
    ...(await page.locator('div.story-list-medium-container ion-card').all()),
    ...(await page.locator('div.list-stories-frame > div.stories-block ion-card').all())
  ];

  // Extract & return all links, titles & descriptions for each article
  return await Promise.all(
    articles.map(async (article) => ({
      link: `${url}${await article.locator(page.locator('a').first()).getAttribute('href')}`,
      title: (await article.locator(page.locator('ion-card-title')).innerText()) as string,
      description: (await article.locator(page.locator('ion-card-content > .sf-desc')).innerText()) as string
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

async function logout({ page }: AuthenticateFnProps) {
  await page.getByRole('button', { name: 'M', exact: true }).waitFor();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.locator('#mastheads_menu').waitFor();
}
