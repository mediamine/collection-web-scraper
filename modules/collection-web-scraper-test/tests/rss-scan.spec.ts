import { expect, test } from '@playwright/test';
import Parser from 'rss-parser';
import { ArticleLinkProps, ScanFnProps } from './types';

[
  { name: 'Newstalk ZB - National', url: 'https://www.newstalkzb.co.nz/news/national/rssfeed' },
  { name: 'Newstalk ZB - Crime', url: 'https://www.newstalkzb.co.nz/news/crime/rssfeed' },
  { name: 'Newstalk ZB - Health', url: 'https://www.newstalkzb.co.nz/news/health/rssfeed' },
  { name: 'Newstalk ZB - World', url: 'https://www.newstalkzb.co.nz/news/world/rssfeed' },
  { name: 'Newstalk ZB - Sport', url: 'https://www.newstalkzb.co.nz/news/sport/rssfeed' },
  { name: 'Newstalk ZB - Science', url: 'https://www.newstalkzb.co.nz/news/science/rssfeed' },
  { name: 'Newstalk ZB - Politics', url: 'https://www.newstalkzb.co.nz/news/politics/rssfeed' },
  { name: 'Newstalk ZB - Education', url: 'https://www.newstalkzb.co.nz/news/education/rssfeed' },
  { name: 'Newstalk ZB - Emergency', url: 'https://www.newstalkzb.co.nz/news/emergency/rssfeed' },
  { name: 'Newstalk ZB - Business', url: 'https://www.newstalkzb.co.nz/news/business/rssfeed' },
  { name: 'Newstalk ZB - Entertainment', url: 'https://www.newstalkzb.co.nz/news/entertainment/rssfeed' },
  { name: 'Beehive', url: 'https://www.beehive.govt.nz/rss.xml' }
].forEach(({ name, url }) => {
  test(`testing ${name} at ${url}`, async ({ page }) => {
    const articles = await getLinks({ page, url });

    // Pick a random article from the list returned
    const article = articles[Math.floor(Math.random() * articles.length)];

    expect(article.description.length).toBeGreaterThan(0);
  });
});

async function getLinks({ url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
  const parser = new Parser();
  const feed = await parser.parseURL(url);

  return feed.items.map((item) => ({
    link: item.link,
    title: item.title,
    description: item.contentSnippet
  }));
}
