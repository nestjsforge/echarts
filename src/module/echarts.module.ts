import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';
import type {
  EchartsModuleOptions,
  EchartsModuleAsyncOptions,
  EchartsOptionsFactory,
} from '../interfaces/echarts-module-options.interface';
import { BrowserManager } from '../browser/browser-manager';
import { EchartsRenderer } from '../browser/echarts-renderer';
import { EchartsService } from '../services/echarts.service';
import { EchartsThemeRegistry } from '../themes/echarts-theme-registry';

const CORE_PROVIDERS: Provider[] = [
  BrowserManager,
  EchartsRenderer,
  EchartsService,
  EchartsThemeRegistry,
];

const EXPORTS = [EchartsService, EchartsThemeRegistry];

@Module({})
export class EchartsModule {
  // ---------------------------------------------------------------------------
  // forRoot — synchronous static configuration
  // ---------------------------------------------------------------------------

  static forRoot(options: EchartsModuleOptions = {}): DynamicModule {
    return {
      module: EchartsModule,
      global: true,
      providers: [
        {
          provide: ECHARTS_MODULE_OPTIONS,
          useValue: options,
        },
        ...CORE_PROVIDERS,
      ],
      exports: EXPORTS,
    };
  }

  // ---------------------------------------------------------------------------
  // forRootAsync — async configuration (useFactory / useClass / useExisting)
  // ---------------------------------------------------------------------------

  static forRootAsync(asyncOptions: EchartsModuleAsyncOptions): DynamicModule {
    const asyncProviders = EchartsModule.createAsyncProviders(asyncOptions);

    return {
      module: EchartsModule,
      global: true,
      imports: asyncOptions.imports ?? [],
      providers: [...asyncProviders, ...CORE_PROVIDERS],
      exports: EXPORTS,
    };
  }

  // ---------------------------------------------------------------------------
  // forFeature — import inside a feature module without re-configuring
  // (relies on global forRoot registration)
  // ---------------------------------------------------------------------------

  static forFeature(): DynamicModule {
    return {
      module: EchartsModule,
      providers: [...CORE_PROVIDERS],
      exports: EXPORTS,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private static createAsyncProviders(options: EchartsModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: ECHARTS_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const useClass = options.useClass ?? options.useExisting;
    if (!useClass) {
      throw new Error(
        'EchartsModule.forRootAsync() requires one of: useFactory, useClass, useExisting',
      );
    }

    const providers: Provider[] = [
      {
        provide: ECHARTS_MODULE_OPTIONS,
        useFactory: async (factory: EchartsOptionsFactory) =>
          factory.createEchartsOptions(),
        inject: [useClass],
      },
    ];

    if (options.useClass) {
      providers.push({ provide: useClass, useClass: useClass as Type<EchartsOptionsFactory> });
    }

    return providers;
  }
}
