import type { LaunchOptions } from 'puppeteer';

export interface EchartsModuleOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  backgroundColor?: string;
  launchOptions?: LaunchOptions;
  maxConcurrency?: number;
  pagePoolSize?: number;
  timeout?: number;
  renderTimeout?: number;
}

export interface EchartsOptionsFactory {
  createEchartsOptions(): Promise<EchartsModuleOptions> | EchartsModuleOptions;
}

export interface EchartsModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<EchartsModuleOptions> | EchartsModuleOptions;
  useClass?: new (...args: any[]) => EchartsOptionsFactory;
  useExisting?: new (...args: any[]) => EchartsOptionsFactory;
}
