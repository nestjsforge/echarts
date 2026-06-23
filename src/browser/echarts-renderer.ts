import { Injectable, Logger, Inject } from '@nestjs/common';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';
import type { EchartsModuleOptions } from '../interfaces/echarts-module-options.interface';
import type { RenderOptions } from '../interfaces/render-options.interface';
import { BrowserManager } from './browser-manager';
import { EchartsThemeRegistry } from '../themes/echarts-theme-registry';
import { buildChartHtml } from '../templates/chart.template';
import { serializeChartOptions, formatMs } from '../utils/serializer.util';
import { ChartRenderException } from '../exceptions/chart-render.exception';

/**
 * The cryptic ECharts-6 error raised when a cartesian series points at an axis
 * (or grid/polar) component that doesn't exist. The serializer catches the
 * common "no axes at all" case before render; this covers index mismatches
 * (e.g. xAxisIndex/polarIndex out of range) that still reach the page.
 */
function decorateRenderError(message: string): string {
  if (/reading '(get|findAxisModel)'/.test(message)) {
    return (
      `${message} — this usually means a series references a coordinate-system ` +
      `component that doesn't exist (missing xAxis/yAxis, or an out-of-range ` +
      `xAxisIndex/yAxisIndex/gridIndex/polarIndex). ECharts 6 no longer creates ` +
      `default axes automatically.`
    );
  }
  return message;
}

@Injectable()
export class EchartsRenderer {
  private readonly logger = new Logger(EchartsRenderer.name);

  constructor(
    @Inject(ECHARTS_MODULE_OPTIONS)
    private readonly globalOptions: EchartsModuleOptions,
    private readonly browserManager: BrowserManager,
    private readonly themeRegistry: EchartsThemeRegistry,
  ) {}

  async render(chartOptions: Record<string, any>, renderOptions: RenderOptions = {}): Promise<Buffer> {
    const start = Date.now();

    const width = Math.round(Number(renderOptions.width ?? this.globalOptions.width ?? 800));
    const height = Math.round(Number(renderOptions.height ?? this.globalOptions.height ?? 600));
    const deviceScaleFactor = Number(renderOptions.deviceScaleFactor ?? this.globalOptions.deviceScaleFactor ?? 1);
    const backgroundColor = renderOptions.backgroundColor ?? this.globalOptions.backgroundColor ?? '#ffffff';
    const renderTimeout = renderOptions.renderTimeout ?? this.globalOptions.renderTimeout ?? 10_000;

    // Resolve theme — can be a string (registered theme name) or inline object
    let resolvedTheme: string | null = null;
    if (renderOptions.theme !== undefined) {
      resolvedTheme = typeof renderOptions.theme === 'string'
        ? renderOptions.theme
        : null; // object themes are registered inline; handled in snippet
    }

    const serialized = serializeChartOptions(chartOptions);
    const themeSnippet = this.themeRegistry.buildRegistrationSnippet();

    const html = buildChartHtml({
      echartsVersion: this.browserManager.echartsBundle,
      width,
      height,
      backgroundColor,
      options: serialized,
      theme: resolvedTheme,
      themeRegistrations: themeSnippet,
      renderTimeoutMs: renderTimeout,
    });

    const page = await this.browserManager.acquirePage();

    try {
      await page.setViewport({ width, height, deviceScaleFactor });
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Wait until the chart signals completion (or error).
      // Use interval polling (not the default 'raf') because requestAnimationFrame
      // is throttled in backgrounded pages — fatal when several pooled pages render
      // concurrently, since the waiter would never observe the done flag.
      const waitResult = await page.waitForFunction(
        () => (window as any).__ECHARTS_RENDER_DONE__ === true,
        { timeout: renderTimeout + 2000, polling: 100 },
      );

      // Check for render-side errors signalled from within the page
      const renderError = await page.evaluate(
        () => (window as any).__ECHARTS_RENDER_ERROR__,
      );
      if (renderError) {
        throw new ChartRenderException(`Chart render failed: ${decorateRenderError(renderError)}`);
      }

      const screenshot = await page.screenshot({ type: 'png' });
      const elapsed = Date.now() - start;

      const stats = this.browserManager.stats();
      this.logger.debug(
        `Chart rendered in ${formatMs(elapsed)} ` +
          `[pool: ${stats.busy}/${stats.total} busy, ${stats.waiters} waiting]`,
      );

      return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
    } catch (err) {
      if (err instanceof ChartRenderException) throw err;
      throw new ChartRenderException('Unexpected render failure', err as Error);
    } finally {
      this.browserManager.releasePage(page);
    }
  }
}
