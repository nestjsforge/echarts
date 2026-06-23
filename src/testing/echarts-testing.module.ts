import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';
import type { EchartsModuleOptions } from '../interfaces/echarts-module-options.interface';
import { EchartsRenderer } from '../browser/echarts-renderer';
import { EchartsService } from '../services/echarts.service';
import { EchartsThemeRegistry } from '../themes/echarts-theme-registry';

/**
 * Drop-in replacement for EchartsModule in unit tests.
 * Swaps BrowserManager and EchartsRenderer with Jest mocks so tests
 * never open a real browser.
 */
@Module({})
export class EchartsTestingModule {
  static withMocks(options: EchartsModuleOptions = {}): DynamicModule {
    const mockBrowserManager = {
      echartsBundle: '',
      acquirePage: jest.fn(),
      releasePage: jest.fn(),
      stats: jest.fn().mockReturnValue({ total: 0, busy: 0, idle: 0, waiters: 0 }),
      onApplicationShutdown: jest.fn(),
    };

    const mockRenderer: Pick<EchartsRenderer, 'render'> = {
      render: jest.fn().mockResolvedValue(Buffer.from('PNG_MOCK')),
    };

    const providers: Provider[] = [
      { provide: ECHARTS_MODULE_OPTIONS, useValue: options },
      { provide: 'BrowserManager', useValue: mockBrowserManager },
      { provide: EchartsRenderer, useValue: mockRenderer },
      EchartsService,
      EchartsThemeRegistry,
    ];

    return {
      module: EchartsTestingModule,
      providers,
      exports: [EchartsService, EchartsThemeRegistry, EchartsRenderer],
    };
  }
}
