import { Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { EchartsRenderer } from '../browser/echarts-renderer';
import type { RenderOptions, RenderToFileOptions, BatchRenderItem, BatchRenderResult } from '../interfaces/render-options.interface';
import { ChartRenderException } from '../exceptions/chart-render.exception';

/**
 * Primary public API for @nestjsforge/echarts.
 *
 * Designed for forward-compatibility:
 *   - renderToSvg() / renderToPdf() can be added without breaking changes
 *   - all methods accept a shared RenderOptions overlay for per-call overrides
 */
@Injectable()
export class EchartsService {
  private readonly logger = new Logger(EchartsService.name);

  constructor(private readonly renderer: EchartsRenderer) {}

  // ---------------------------------------------------------------------------
  // Core render methods
  // ---------------------------------------------------------------------------

  async renderToBuffer(
    chartOptions: Record<string, any>,
    renderOptions: RenderOptions = {},
  ): Promise<Buffer> {
    return this.renderer.render(chartOptions, renderOptions);
  }

  async renderToBase64(
    chartOptions: Record<string, any>,
    renderOptions: RenderOptions = {},
  ): Promise<string> {
    const buffer = await this.renderToBuffer(chartOptions, renderOptions);
    return buffer.toString('base64');
  }

  async renderToDataUrl(
    chartOptions: Record<string, any>,
    renderOptions: RenderOptions = {},
  ): Promise<string> {
    const base64 = await this.renderToBase64(chartOptions, renderOptions);
    return `data:image/png;base64,${base64}`;
  }

  async renderToFile(
    chartOptions: Record<string, any>,
    options: RenderToFileOptions,
  ): Promise<void> {
    const { path, ...renderOptions } = options;
    const buffer = await this.renderToBuffer(chartOptions, renderOptions);
    await writeFile(path, buffer);
    this.logger.log(`Chart written to ${path}`);
  }

  // ---------------------------------------------------------------------------
  // Batch rendering
  // ---------------------------------------------------------------------------

  async renderMany(
    items: BatchRenderItem[],
    concurrency: number = 3,
  ): Promise<BatchRenderResult[]> {
    const results: BatchRenderResult[] = new Array(items.length);
    const queue = items.map((item, index) => ({ item, index }));

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;

        try {
          const data = await this.renderToBuffer(job.item.options, job.item.renderOptions ?? {});
          results[job.index] = { index: job.index, data };
        } catch (err) {
          this.logger.error(`Batch render failed at index ${job.index}: ${(err as Error).message}`);
          results[job.index] = {
            index: job.index,
            data: Buffer.alloc(0),
            error: err instanceof Error ? err : new ChartRenderException(String(err)),
          };
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
    await Promise.all(workers);

    return results;
  }

  // ---------------------------------------------------------------------------
  // Extension points (future renderers slot in here)
  // ---------------------------------------------------------------------------

  // async renderToSvg(chartOptions: Record<string, any>, options?: RenderOptions): Promise<string>
  // async renderToPdf(chartOptions: Record<string, any>, options?: PdfRenderOptions): Promise<Buffer>
}
