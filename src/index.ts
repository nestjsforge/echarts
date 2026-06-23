// Module
export { EchartsModule } from './module/echarts.module';

// Services
export { EchartsService } from './services/echarts.service';

// Browser internals (advanced usage)
export { BrowserManager } from './browser/browser-manager';
export { EchartsRenderer } from './browser/echarts-renderer';

// Themes
export { EchartsThemeRegistry } from './themes/echarts-theme-registry';
export type { ThemeDefinition } from './themes/echarts-theme-registry';

// Interfaces
export type { EchartsModuleOptions } from './interfaces/echarts-module-options.interface';
export type { EchartsModuleAsyncOptions } from './interfaces/echarts-module-options.interface';
export type { EchartsOptionsFactory } from './interfaces/echarts-module-options.interface';
export type {
  RenderOptions,
  RenderToFileOptions,
  BatchRenderItem,
  BatchRenderResult,
} from './interfaces/render-options.interface';

// Exceptions
export { ChartRenderException } from './exceptions/chart-render.exception';
export { BrowserLaunchException } from './exceptions/browser-launch.exception';
export { InvalidChartOptionsException } from './exceptions/invalid-chart-options.exception';
export { PagePoolExhaustedException } from './exceptions/page-pool-exhausted.exception';

// Constants
export { ECHARTS_MODULE_OPTIONS } from './constants/echarts.constants';

// Decorators
export { InjectEchartsOptions } from './decorators/inject-echarts-options.decorator';

// Testing
export { EchartsTestingModule } from './testing/echarts-testing.module';
