import { isPageTextScanExcludedConditions } from './excluded-conditions';

// Returns whether a link may be scanned, despite the name
describe('isPageTextScanExcludedConditions', () => {
  it.each([
    ['a BusinessDesk article', 'https://businessdesk.co.nz/article/markets/one', true],
    ['an NBR article', 'https://www.nbr.co.nz/markets/one', true],
    ['a link that embeds a second url', 'https://www.stuff.co.nzhttps://www.stuff.co.nz/one', true],
    ['a BusinessDesk journalist page', 'https://businessdesk.co.nz/journalist/jane-doe', false]
  ])('%s: %s → may be scanned: %s', (_, link, allowed) => {
    expect(isPageTextScanExcludedConditions(link)).toBe(allowed);
  });
});
