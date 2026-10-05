import { expect, test } from '@playwright/test';
import Parser from 'rss-parser';
import { ArticleLinkProps, ScanFnProps } from './types';

// The two rss-scan publications are read with the same parser and mapped the same way, but they differ in
// how they treat the request:
//
//   Beehive      sits behind Imperva Incapsula. rss-parser's default 'User-Agent: rss-parser' is answered
//                with an HTML bot challenge rather than the feed, which xml2js rejects with "Attribute
//                without value ... Char: >". A browser User-Agent is served the real feed.
//   Newstalk ZB  serves XML to any client, with one feed per news section.
//
// No browser is involved: the rss-scan workflow never opens a page, and its page_text is the item's RSS
// description. So these tests check every item in each feed rather than sampling one.

// Mirrors RSS_REQUEST_HEADERS in src/browser/rss-parser/rss-parser.service.ts
const RSS_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8'
};

const NEWSTALK_ZB_SECTIONS = [
  'National',
  'Crime',
  'Health',
  'World',
  'Sport',
  'Science',
  'Politics',
  'Education',
  'Emergency',
  'Business',
  'Entertainment'
];

test.describe('rss-scan group-a', () => {
  test('testing Beehive at https://www.beehive.govt.nz/rss.xml', async () => {
    const url = 'https://www.beehive.govt.nz/rss.xml';

    const articles = await getLinks({ url });
    console.log(`[Beehive] Found ${articles.length} items.`);

    assertFeedItems(articles, 'https://www.beehive.govt.nz/');
  });

  // One test per section feed, so a section that dies is reported on its own
  NEWSTALK_ZB_SECTIONS.forEach((section) => {
    const url = `https://www.newstalkzb.co.nz/news/${section.toLowerCase()}/rssfeed`;

    test(`testing Newstalk ZB - ${section} at ${url}`, async () => {
      const articles = await getLinks({ url });
      console.log(`[Newstalk ZB - ${section}] Found ${articles.length} items.`);

      assertFeedItems(articles, 'https://www.newstalkzb.co.nz/');
    });
  });
});

function assertFeedItems(articles: Array<ArticleLinkProps>, host: string) {
  expect(articles.length).toBeGreaterThan(0);

  for (const { link, title, description } of articles) {
    expect(link, `link of "${title}"`).toMatch(new RegExp(`^${host.replace(/[.]/g, '\\.')}`));
    expect(title?.length, `title of ${link}`).toBeGreaterThan(0);

    // The workflow persists the description as page_text, so it has to be plain text. Beehive's raw
    // description is escaped <p> markup, which contentSnippet strips.
    if (description) {
      expect(description, `description of ${link}`).not.toMatch(/<\/?[a-z][^>]*>/i);
    }
  }

  // Publishers do occasionally ship an item with an empty <description> — Newstalk ZB did for a Dolly Parton
  // tribute — and the workflow skips those. So don't demand one on every item, only on most of them: a
  // broken mapping or parse leaves none at all.
  const withoutDescription = articles.filter((a) => !a.description);
  withoutDescription.forEach((a) => console.log(`No description: ${a.link}`));
  expect(withoutDescription.length, 'items without a description').toBeLessThanOrEqual(articles.length / 2);
}

// Mirrors RssParserService.parseURL followed by BeehiveService / NewstalkZBService scanHome, which map items
// identically
async function getLinks({ url }: Pick<ScanFnProps, 'url'>): Promise<Array<ArticleLinkProps>> {
  const parser = new Parser({ headers: RSS_REQUEST_HEADERS });
  const feed = await parser.parseURL(url);

  return feed.items.map((item) => ({
    link: item.link as string,
    title: item.title as string,
    description: item.contentSnippet as string
  }));
}
