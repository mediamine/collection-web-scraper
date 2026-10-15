// A stand-in for the slice of the Playwright Page / Locator API the scrapers use. Every locator is keyed by
// how it was looked up (a CSS selector as-is, or one of the key helpers below for getByRole & co.) and cached
// by that key, so a spec configures it up front through a spec map and asserts on the very same mock after.
//
// first() and or() hand back the locator they were called on, so `page.locator(x).first().waitFor()` and
// `page.locator(x).waitFor()` both land on page.locatorFor(x).waitFor.

type LocatorMethod = 'all' | 'allTextContents' | 'count' | 'getAttribute' | 'innerText' | 'isVisible' | 'waitFor' | 'click' | 'fill';

export interface MockLocatorSpec {
  /** Locators returned by all(), e.g. one per article card */
  all?: MockLocatorSpec[];
  allTextContents?: string[];
  count?: number;
  getAttribute?: string | null;
  innerText?: string;
  isVisible?: boolean;
  /** What locator(child) returns on this locator, keyed like the page's map */
  children?: Record<string, MockLocatorSpec>;
  /** Methods that reject with the given error instead of resolving */
  rejects?: Partial<Record<LocatorMethod, Error>>;
}

export interface MockLocator extends Record<LocatorMethod, jest.Mock> {
  key: string;
  locator: jest.Mock;
  first: jest.Mock;
  or: jest.Mock;
}

export const role = (role: string, name: string | RegExp) => `role=${role}[name=${String(name)}]`;
export const label = (text: string) => `label=${text}`;
export const testId = (id: string) => `testid=${id}`;
export const inFrame = (frame: string, selector: string) => `${frame} >> ${selector}`;
export const hasText = (selector: string, text: string | RegExp) => `${selector}:has-text(${String(text)})`;

const settle = (spec: MockLocatorSpec, method: LocatorMethod, value: unknown) =>
  spec.rejects?.[method] ? jest.fn().mockRejectedValue(spec.rejects[method]) : jest.fn().mockResolvedValue(value);

export const createMockLocator = (key: string, spec: MockLocatorSpec = {}): MockLocator => {
  const children = new Map<string, MockLocator>();
  const childFor = (child: string | MockLocator) => {
    const childKey = typeof child === 'string' ? child : child.key;
    if (!children.has(childKey)) {
      children.set(childKey, createMockLocator(childKey, spec.children?.[childKey]));
    }
    return children.get(childKey);
  };

  const locator: MockLocator = {
    key,
    locator: jest.fn(childFor),
    first: jest.fn(() => locator),
    or: jest.fn(() => locator),
    all: settle(
      spec,
      'all',
      (spec.all ?? []).map((itemSpec, index) => createMockLocator(`${key} >> nth=${index}`, itemSpec))
    ),
    allTextContents: settle(spec, 'allTextContents', spec.allTextContents ?? []),
    count: settle(spec, 'count', spec.count ?? 0),
    getAttribute: settle(spec, 'getAttribute', spec.getAttribute ?? null),
    innerText: settle(spec, 'innerText', spec.innerText ?? ''),
    isVisible: settle(spec, 'isVisible', spec.isVisible ?? false),
    waitFor: settle(spec, 'waitFor', undefined),
    click: settle(spec, 'click', undefined),
    fill: settle(spec, 'fill', undefined)
  };

  return locator;
};

export const createMockPage = (specs: Record<string, MockLocatorSpec> = {}) => {
  const registry = new Map<string, MockLocator>();
  const locatorFor = (key: string): MockLocator => {
    if (!registry.has(key)) {
      registry.set(key, createMockLocator(key, specs[key]));
    }
    return registry.get(key);
  };
  const bySelector = (selector: string, options?: { hasText?: string | RegExp }) =>
    locatorFor(options?.hasText ? hasText(selector, options.hasText) : selector);

  return {
    goto: jest.fn().mockResolvedValue(null),
    reload: jest.fn().mockResolvedValue(null),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    locator: jest.fn(bySelector),
    getByRole: jest.fn((ariaRole: string, { name }: { name: string | RegExp }) => locatorFor(role(ariaRole, name))),
    getByLabel: jest.fn((text: string) => locatorFor(label(text))),
    getByTestId: jest.fn((id: string) => locatorFor(testId(id))),
    frameLocator: jest.fn((frame: string) => ({
      locator: jest.fn((selector: string, options?: { hasText?: string | RegExp }) => bySelector(inFrame(frame, selector), options))
    })),
    /** The locator registered under a key, created on first use, for configuring or asserting on it */
    locatorFor
  };
};

export type MockPage = ReturnType<typeof createMockPage>;
