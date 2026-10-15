import { chromium, defineConfig } from '@playwright/test';
import { createServiceModule } from 'src/testing/scraper-testing';
import { PlaywrightService } from './playwright.service';

jest.mock('@playwright/test', () => ({
  chromium: { launch: jest.fn() },
  defineConfig: jest.fn()
}));

// defineConfig runs once, when the module is imported, so read its call before clearMocks wipes it
const defineConfigCalls = [...(defineConfig as jest.Mock).mock.calls];

const launch = chromium.launch as jest.Mock;

describe('PlaywrightService', () => {
  let service: PlaywrightService;
  let logger: Awaited<ReturnType<typeof createServiceModule>>['logger'];
  let page: { setDefaultNavigationTimeout: jest.Mock; setDefaultTimeout: jest.Mock; goto: jest.Mock };
  let context: { newPage: jest.Mock; close: jest.Mock };
  let browser: { newContext: jest.Mock; close: jest.Mock; contexts: jest.Mock };

  const create = async (config: Record<string, string> = {}) => {
    ({ service, logger } = await createServiceModule(PlaywrightService, { config }));
  };

  beforeEach(async () => {
    page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn(), goto: jest.fn() };
    context = { newPage: jest.fn().mockResolvedValue(page), close: jest.fn() };
    browser = { newContext: jest.fn().mockResolvedValue(context), close: jest.fn(), contexts: jest.fn(() => [context]) };
    launch.mockResolvedValue(browser);
    await create();
  });

  it('caps a whole Playwright run at five minutes', () => {
    expect(defineConfigCalls).toEqual([[{ globalTimeout: 5 * 60 * 1000 }]]);
  });

  it('sets its logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith(PlaywrightService.name);
  });

  describe('openBrowser', () => {
    it('opens a page on the url with 60 second timeouts', async () => {
      await expect(service.openBrowser({ url: 'https://www.example.co.nz' })).resolves.toEqual({ page });

      expect(page.setDefaultNavigationTimeout).toHaveBeenCalledWith(60000);
      expect(page.setDefaultTimeout).toHaveBeenCalledWith(60000);
      expect(page.goto).toHaveBeenCalledWith('https://www.example.co.nz');
    });

    it.each([
      [undefined, true],
      ['true', true],
      ['false', false]
    ])('launches with HEADLESS=%s as headless: %s', async (headless, expected) => {
      await create(headless === undefined ? {} : { HEADLESS: headless });

      await service.openBrowser({ url: 'https://www.example.co.nz' });

      expect(launch).toHaveBeenCalledWith(expect.objectContaining({ headless: expected }));
    });

    it("logs only the browser's warnings and errors", async () => {
      await service.openBrowser({ url: 'https://www.example.co.nz' });
      const { logger: browserLogger } = launch.mock.calls[0][0];

      expect(browserLogger.isEnabled()).toBe(true);
      browserLogger.log('api', 'info', 'navigating');
      browserLogger.log('api', 'verbose', 'details');
      browserLogger.log('api', 'warning', 'slow response');
      browserLogger.log('browser', 'error', 'crashed');

      expect(logger.error.mock.calls).toEqual([['api warning slow response'], ['browser error crashed']]);
    });
  });

  describe('closeBrowser', () => {
    it('closes the context, then the browser', async () => {
      await service.openBrowser({ url: 'https://www.example.co.nz' });

      await service.closeBrowser();

      expect(context.close).toHaveBeenCalled();
      expect(browser.close).toHaveBeenCalled();
      expect(context.close.mock.invocationCallOrder[0]).toBeLessThan(browser.close.mock.invocationCallOrder[0]);
    });

    // Known defect: `this.browser.close()` has no `?.`, so every workflow's `finally` throws when the
    // browser was never opened — no candidates to scan, or openBrowser itself failed.
    it.failing('does nothing when no browser was opened', async () => {
      await expect(service.closeBrowser()).resolves.toBeUndefined();
    });
  });

  describe('closeAllBrowsers', () => {
    it('closes every context of the open browser', async () => {
      await service.openBrowser({ url: 'https://www.example.co.nz' });

      await service.closeAllBrowsers();

      expect(context.close).toHaveBeenCalled();
    });

    it('does nothing when no browser was opened', async () => {
      await expect(service.closeAllBrowsers()).resolves.toBeUndefined();
      expect(browser.contexts).not.toHaveBeenCalled();
    });
  });
});
