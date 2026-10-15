import { isPageTextScanV2ExcludedConditions } from './excluded-conditions';

// Returns whether a link may be scanned, despite the name
describe('isPageTextScanV2ExcludedConditions', () => {
  it.each([
    ['an ODT article', 'https://www.odt.co.nz/news/dunedin/one', true],
    ['a link with a url in its query string', 'https://www.odt.co.nz/search?q=https', true],
    ['a link that embeds a second url', 'https://www.odt.co.nzhttps://www.odt.co.nz/news/one', false],
    ['a link with a second url after a slash', 'https://www.odt.co.nz/https://example.com', false]
  ])('%s: %s → may be scanned: %s', (_, link, allowed) => {
    expect(isPageTextScanV2ExcludedConditions(link)).toBe(allowed);
  });
});
