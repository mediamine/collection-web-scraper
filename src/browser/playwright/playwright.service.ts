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
    this.logger.debug('Opening a browser instance.');
    this.browser = await chromium.launch({
      headless: true, // !process.argv.slice(2).includes('--headed'), // setting this to true will not run the UI
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
  }

  async closeAllBrowsers() {
    this.browser?.contexts().forEach(async (c) => await c.close());
  }
}
