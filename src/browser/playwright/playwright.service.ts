import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, BrowserContext, Page, chromium, defineConfig } from '@playwright/test';
import { WinstonLoggerService } from 'src/logger';

defineConfig({
  globalTimeout: 5 * 60 * 1000
});

@Injectable()
export class PlaywrightService {
  private browser: Browser;
  private context: BrowserContext;

  constructor(
    private configService: ConfigService,
    private logger: WinstonLoggerService
  ) {
    this.logger.setContext(PlaywrightService.name);
  }

  async openBrowser({ url }: { url: string }) {
    const HEADLESS = 'HEADLESS';

    this.logger.debug('Opening a browser instance.');
    this.browser = await chromium.launch({
      headless: this.configService.get<string>(HEADLESS, 'true') === 'true',
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => {
          if (['warning', 'error'].includes(severity)) this.logger.error(`${name} ${severity} ${message}`);
        }
      }
    });

    this.context = await this.browser.newContext();
    const page: Page = await this.context.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    await page.goto(url);

    return { page };
  }

  async closeBrowser() {
    this.logger.debug(`Closing the browser instance`);
    await this.context?.close();
    await this.browser.close();
  }

  async closeAllBrowsers() {
    this.browser?.contexts().forEach(async (c) => await c.close());
  }
}
