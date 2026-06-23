import { Injectable, Logger, OnApplicationShutdown, Inject } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';
import type { EchartsModuleOptions } from '../interfaces/echarts-module-options.interface';
import { BrowserLaunchException } from '../exceptions/browser-launch.exception';
import { PagePoolExhaustedException } from '../exceptions/page-pool-exhausted.exception';
import { formatMs } from '../utils/serializer.util';

interface PooledPage {
  page: Page;
  busy: boolean;
}

/**
 * Manages a singleton Puppeteer browser with a warm page pool.
 * Pages are reused across renders to avoid the overhead of opening
 * a new page per request (each new page triggers a separate renderer process).
 */
@Injectable()
export class BrowserManager implements OnApplicationShutdown {
  private readonly logger = new Logger(BrowserManager.name);

  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;
  private readonly pagePool: PooledPage[] = [];
  private readonly waiters: Array<() => void> = [];

  readonly echartsBundle: string;

  constructor(
    @Inject(ECHARTS_MODULE_OPTIONS)
    private readonly options: EchartsModuleOptions,
  ) {
    // process.cwd() is always the project root at runtime (both dev webpack and prod).
    // require.resolve() is not used here because webpack replaces it at bundle time
    // and resolves against the bundle graph instead of the real filesystem.
    const echartsPath = join(process.cwd(), 'node_modules/echarts/dist/echarts.min.js');
    this.echartsBundle = readFileSync(echartsPath, 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Browser lifecycle
  // ---------------------------------------------------------------------------

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.launchPromise = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    const start = Date.now();
    this.logger.log('Launching Chromium browser…');

    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      // Keep timers and rAF running at full speed in non-foreground pages.
      // Without these, Chrome throttles backgrounded pages, so concurrent
      // pooled-page renders stall waiting for a render-done signal that never
      // fires — surfacing as "Waiting failed: Nms exceeded" timeouts.
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      // NOTE: '--single-process' / '--no-zygote' are intentionally omitted —
      // they make concurrent rendering unstable.
    ];

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: defaultArgs,
        ...this.options.launchOptions,
        // merge args so defaults are preserved unless caller overrides
        ...(this.options.launchOptions?.args
          ? { args: [...defaultArgs, ...this.options.launchOptions.args] }
          : {}),
      });

      browser.on('disconnected', () => {
        this.logger.warn('Browser disconnected — pool cleared');
        this.browser = null;
        this.pagePool.length = 0;
      });

      this.logger.log(`Browser launched in ${formatMs(Date.now() - start)}`);
      return browser;
    } catch (err) {
      throw new BrowserLaunchException('Failed to launch Chromium', err as Error);
    }
  }

  // ---------------------------------------------------------------------------
  // Page pool
  // ---------------------------------------------------------------------------

  async acquirePage(): Promise<Page> {
    const poolSize = this.options.pagePoolSize ?? 3;
    const timeout = this.options.timeout ?? 30_000;

    // Return an idle pooled page if available
    const idle = this.pagePool.find((p) => !p.busy && !p.page.isClosed());
    if (idle) {
      idle.busy = true;
      return idle.page;
    }

    // Grow pool if under limit
    if (this.pagePool.length < poolSize) {
      const page = await this.createPage();
      const entry: PooledPage = { page, busy: true };
      this.pagePool.push(entry);
      return page;
    }

    // Wait for a page to become available
    return new Promise<Page>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(tryAcquire);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new PagePoolExhaustedException(timeout));
      }, timeout);

      const tryAcquire = () => {
        const available = this.pagePool.find((p) => !p.busy && !p.page.isClosed());
        if (available) {
          clearTimeout(timer);
          available.busy = true;
          resolve(available.page);
        } else {
          this.waiters.push(tryAcquire);
        }
      };

      this.waiters.push(tryAcquire);
    });
  }

  releasePage(page: Page): void {
    const entry = this.pagePool.find((p) => p.page === page);
    if (entry) {
      entry.busy = false;
    }

    const waiter = this.waiters.shift();
    if (waiter) waiter();
  }

  private async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: Math.round(Number(this.options.width ?? 800)),
      height: Math.round(Number(this.options.height ?? 600)),
      deviceScaleFactor: Number(this.options.deviceScaleFactor ?? 1),
    });

    // Suppress superfluous console noise from the page context
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.logger.warn(`[Page console.error] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err: Error) => {
      this.logger.error(`[Page error] ${err.message}`);
    });

    return page;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  stats(): { total: number; busy: number; idle: number; waiters: number } {
    const total = this.pagePool.length;
    const busy = this.pagePool.filter((p) => p.busy).length;
    return { total, busy, idle: total - busy, waiters: this.waiters.length };
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down browser (signal=${signal ?? 'none'})…`);

    // Close all pooled pages first
    await Promise.allSettled(this.pagePool.map((p) => p.page.close()));
    this.pagePool.length = 0;

    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log('Browser closed gracefully');
      } catch (err) {
        this.logger.error('Error closing browser', (err as Error).stack);
      }
      this.browser = null;
    }
  }
}
