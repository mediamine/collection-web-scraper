import { isCompleteScanExcludedConditions } from './excluded-conditions';

// Returns whether a link may be scanned, despite the name
describe('isCompleteScanExcludedConditions', () => {
  it.each([
    ['an article', 'https://www.thepost.co.nz/politics/350000001/one', true],
    ['an http article', 'http://www.thepost.co.nz/politics/one', true],
    ['a link that embeds a second url', 'https://www.thepost.co.nzhttps://www.thepost.co.nz/politics/one', false],
    ['an Ensemble magazine link', 'https://www.ensemblemagazine.co.nz/feature', false],
    ['a sponsored Stuff link', 'https://sponsoredinteractive.stuff.co.nz/campaign', false]
  ])('%s: %s → may be scanned: %s', (_, link, allowed) => {
    expect(isCompleteScanExcludedConditions(link)).toBe(allowed);
  });
});
