<div align="center">
  <h1>@nestjsforge/echarts</h1>
  <p>Render any <a href="https://echarts.apache.org/en/index.html">ECharts</a> configuration to **PNG**, **Buffer**, or **Base64** from a NestJS service — no browser on the client required. Built for production workloads with a warm browser pool, page pooling, concurrency control, and graceful shutdown.</p>

![nestjsforge](https://i.imgur.com/mViyZWm.png)

  <p>
    <a href="https://www.npmjs.com/package/@nestjsforge/echarts">
      <img src="https://img.shields.io/npm/v/@nestjsforge/echarts.svg" alt="npm version" />
    </a>
    <a href="https://www.npmjs.com/package/@nestjsforge/echarts">
      <img src="https://img.shields.io/npm/l/@nestjsforge/echarts.svg" alt="license" />
    </a>
    <a href="https://www.npmjs.com/package/@nestjsforge/echarts">
      <img src="https://img.shields.io/npm/dm/@nestjsforge/echarts.svg" alt="downloads" />
    </a>
  </p>
</div>

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [forRoot](#earchartsmoduleforroot)
  - [forRootAsync](#echartsmoduleforrootasync)
- [API](#api)
  - [renderToBuffer](#rendertobuffer)
  - [renderToBase64](#rendertobase64)
  - [renderToDataUrl](#rendertodataurl)
  - [renderToFile](#rendertofile)
  - [renderMany](#rendermany)
- [Themes](#themes)
- [Per-call overrides](#per-call-overrides)
- [API Reference](#api-reference)
  - [EchartsModule](#echartsmodule-1)
  - [EchartsService](#echartsservice-1)
  - [EchartsThemeRegistry](#echartsthemeregistry-1)
  - [BrowserManager](#browsermanager-1)
  - [EchartsRenderer](#echartsrenderer-1)
  - [EchartsTestingModule](#echartestestingmodule-1)
  - [Interfaces](#interfaces)
  - [Exceptions](#exceptions)
  - [Decorators](#decorators)
  - [Constants](#constants)
- [Testing](#testing)
- [Docker](#docker)
- [Performance](#performance)
- [Architecture](#architecture)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install @nestjsforge/echarts
```

---

## Quick Start

### 1. Register the module

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { EchartsModule } from "@nestjsforge/echarts";

@Module({
  imports: [
    EchartsModule.forRoot({
      width: 1200,
      height: 600,
      deviceScaleFactor: 2,
    }),
  ],
})
export class AppModule {}
```

### 2. Inject the service

```typescript
// reports.service.ts
import { Injectable } from "@nestjs/common";
import { EchartsService } from "@nestjsforge/echarts";

@Injectable()
export class ReportsService {
  constructor(private readonly echarts: EchartsService) {}

  async generateRevenueChart(): Promise<Buffer> {
    return this.echarts.renderToBuffer({
      title: { text: "Monthly Revenue" },
      xAxis: { type: "category", data: ["Jan", "Feb", "Mar"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [1200, 1800, 2400] }],
    });
  }
}
```

---

## Configuration

### EchartsModule.forRoot

```typescript
EchartsModule.forRoot({
  // Viewport dimensions (px)
  width: 800, // default: 800
  height: 600, // default: 600

  // Retina / high-DPI output
  deviceScaleFactor: 2, // default: 1

  // Chart background
  backgroundColor: "#ffffff", // default: '#ffffff'

  // Puppeteer LaunchOptions (any puppeteer.launch() option)
  launchOptions: {
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  },

  // Page pool size (pages kept open and reused)
  pagePoolSize: 3, // default: 3

  // Max ms to wait for a free page before throwing PagePoolExhaustedException
  timeout: 30_000, // default: 30000

  // Max ms to wait for echarts to finish rendering
  renderTimeout: 10_000, // default: 10000
});
```

### EchartsModule.forRootAsync

Use async configuration to pull values from environment variables or a config service:

```typescript
import { ConfigModule, ConfigService } from "@nestjs/config";

EchartsModule.forRootAsync({
  imports: [ConfigModule], // omit if ConfigModule is global
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    width: parseInt(config.get("CHART_WIDTH", "800"), 10),
    height: parseInt(config.get("CHART_HEIGHT", "600"), 10),
    deviceScaleFactor: parseFloat(config.get("CHART_SCALE", "1")),
    pagePoolSize: parseInt(config.get("CHART_POOL_SIZE", "3"), 10),
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  }),
});
```

> **Important:** `ConfigService.get<number>()` is a TypeScript-only type hint — env vars are
> always `string` at runtime. Always use `parseInt` / `parseFloat` explicitly when passing
> numeric values to `EchartsModuleOptions`, otherwise Puppeteer receives a string and throws
> `ProtocolError: int32 value expected`.

Recommended `.env` variables:

```bash
CHART_WIDTH=1200
CHART_HEIGHT=600
CHART_SCALE=2
CHART_POOL_SIZE=3
```

---

## API

All methods accept an optional `RenderOptions` object that overrides the global configuration for that specific call.

```typescript
interface RenderOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  backgroundColor?: string;
  theme?: string; // registered theme name
  renderTimeout?: number;
}
```

### renderToBuffer

Returns a `Buffer` containing the PNG image.

```typescript
const buffer: Buffer = await echartsService.renderToBuffer(chartOptions);
const buffer: Buffer = await echartsService.renderToBuffer(chartOptions, { width: 400 });

// In a NestJS controller — use StreamableFile to set Content-Type correctly
import { StreamableFile } from '@nestjs/common';

@Get('chart')
async getChart(): Promise<StreamableFile> {
  const buffer = await this.echarts.renderToBuffer(chartOptions);
  return new StreamableFile(buffer, { type: 'image/png' });
}
```

> **Note:** Do not combine `@Header('Content-Type', 'image/png')` with `StreamableFile` —
> pass `{ type: 'image/png' }` to the `StreamableFile` constructor instead. Using both
> causes a content-type conflict warning in NestJS 11.

### renderToBase64

Returns the PNG as a Base64-encoded string — ideal for embedding in HTML emails.

```typescript
const base64: string = await echartsService.renderToBase64(chartOptions);
```

### renderToDataUrl

Returns a `data:image/png;base64,...` URI — drop directly into an `<img src>`.

```typescript
const url: string = await echartsService.renderToDataUrl(chartOptions);
// '<img src="data:image/png;base64,iVBOR...">'
```

### renderToFile

Renders the chart and writes it to disk.

```typescript
await echartsService.renderToFile(chartOptions, { path: "/tmp/chart.png" });

// With overrides
await echartsService.renderToFile(chartOptions, {
  path: "/reports/q1.png",
  width: 1600,
  height: 900,
});
```

### renderMany

Renders multiple charts concurrently (configurable worker count).

```typescript
const results = await echartsService.renderMany(
  [
    { options: lineChartOptions },
    { options: barChartOptions, renderOptions: { theme: "dark" } },
    { options: pieChartOptions, renderOptions: { width: 400, height: 400 } },
  ],
  3, // concurrency — defaults to 3
);

results.forEach(({ index, data, error }) => {
  if (error) console.error(`Chart ${index} failed:`, error.message);
  else fs.writeFileSync(`/tmp/chart-${index}.png`, data);
});
```

---

## Functions in chart options

ECharts options are serialized to JSON before being sent to the headless browser. **JavaScript functions are not JSON-serializable** — `JSON.stringify` silently drops them, which causes cryptic runtime errors inside the page.

`@nestjsforge/echarts` detects functions early and throws `InvalidChartOptionsException` with the exact key path before any browser interaction:

```
InvalidChartOptionsException: Chart options contain a function at "tooltip.formatter"
— use an ECharts template string (e.g. '{b}: {c}') instead.
```

**Use ECharts template strings instead of JS functions:**

```typescript
// ❌ Dropped silently by JSON.stringify — page crashes
tooltip: {
  formatter: (params) => `${params.name}: ${params.value}`;
}

// ✅ Template string — fully serializable
tooltip: {
  formatter: "{b}: {c}";
}

// ✅ More complex formatting with template variables
tooltip: {
  formatter: "{a}<br/>{b}: {c} ({d}%)";
}
label: {
  formatter: "{b}\n{d}%";
}
```

ECharts template variables: `{a}` series name, `{b}` data name, `{c}` value, `{d}` percentage.

---

## Themes

Register themes once at startup via `EchartsThemeRegistry`, then reference them by name on any render call.

```typescript
import { EchartsThemeRegistry } from '@nestjsforge/echarts';

@Module({
  imports: [EchartsModule.forRoot({ ... })],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly themeRegistry: EchartsThemeRegistry) {}

  onModuleInit() {
    this.themeRegistry.register('corporate', {
      color: ['#003f5c', '#2f4b7c', '#665191', '#a05195'],
      backgroundColor: '#fafafa',
    });
  }
}
```

Use the theme per-render:

```typescript
const buffer = await echartsService.renderToBuffer(chartOptions, {
  theme: "corporate",
});
```

---

## Per-call overrides

Every render method accepts `RenderOptions` so you can override viewport, background, theme, or timeouts without touching the global configuration:

```typescript
// Thumbnail
const thumb = await echartsService.renderToBuffer(opts, {
  width: 300,
  height: 150,
});

// Dark background
const dark = await echartsService.renderToBuffer(opts, {
  backgroundColor: "#1a1a2e",
});

// High-DPI for Retina
const hd = await echartsService.renderToBuffer(opts, { deviceScaleFactor: 3 });
```

---

## API Reference

Complete reference for all public classes, methods, properties, and TypeScript types exported by `@nestjsforge/echarts`.

---

### EchartsModule

Dynamic NestJS module. Register once at the app root — all other modules receive `EchartsService` and `EchartsThemeRegistry` automatically (the module is marked `global: true`).

| Method                  | Parameters                           | Return          | Description                                                                               |
| ----------------------- | ------------------------------------ | --------------- | ----------------------------------------------------------------------------------------- |
| `forRoot(options?)`     | `options?: EchartsModuleOptions`     | `DynamicModule` | Synchronous static registration.                                                          |
| `forRootAsync(options)` | `options: EchartsModuleAsyncOptions` | `DynamicModule` | Async registration via `useFactory`, `useClass`, or `useExisting`.                        |
| `forFeature()`          | —                                    | `DynamicModule` | Re-uses the globally registered module inside a feature module without re-configuring it. |

---

### EchartsService

Primary public API. Inject this service wherever you need to render charts.

| Method                                          | Parameters                                                           | Return                         | Description                                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `renderToBuffer(chartOptions, renderOptions?)`  | `chartOptions: Record<string, any>`, `renderOptions?: RenderOptions` | `Promise<Buffer>`              | Renders the chart and returns a PNG `Buffer`.                                                                                    |
| `renderToBase64(chartOptions, renderOptions?)`  | `chartOptions: Record<string, any>`, `renderOptions?: RenderOptions` | `Promise<string>`              | Returns the PNG as a Base64-encoded string.                                                                                      |
| `renderToDataUrl(chartOptions, renderOptions?)` | `chartOptions: Record<string, any>`, `renderOptions?: RenderOptions` | `Promise<string>`              | Returns a `data:image/png;base64,...` URI for use in `<img src>` or HTML emails.                                                 |
| `renderToFile(chartOptions, options)`           | `chartOptions: Record<string, any>`, `options: RenderToFileOptions`  | `Promise<void>`                | Renders the chart and writes the PNG to disk at `options.path`.                                                                  |
| `renderMany(items, concurrency?)`               | `items: BatchRenderItem[]`, `concurrency?: number` (default `3`)     | `Promise<BatchRenderResult[]>` | Renders multiple charts concurrently using an internal worker queue. Failed items set `error` in the result instead of throwing. |

---

### EchartsThemeRegistry

Register custom ECharts themes once at startup and reference them by name on any render call.

| Method                       | Parameters                      | Return                | Description                                                                                                                                           |
| ---------------------------- | ------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register(name, theme)`      | `name: string`, `theme: object` | `this`                | Registers a named ECharts theme. Chainable.                                                                                                           |
| `registerMany(themes)`       | `themes: ThemeDefinition[]`     | `this`                | Registers multiple themes in one call. Chainable.                                                                                                     |
| `get(name)`                  | `name: string`                  | `object \| undefined` | Retrieves a registered theme by name.                                                                                                                 |
| `has(name)`                  | `name: string`                  | `boolean`             | Returns `true` if the theme name is registered.                                                                                                       |
| `names()`                    | —                               | `string[]`            | Returns all registered theme names.                                                                                                                   |
| `buildRegistrationSnippet()` | —                               | `string`              | Builds the `echarts.registerTheme(...)` JS snippet injected into the headless page before chart initialization. Used internally by `EchartsRenderer`. |

---

### BrowserManager

Manages the singleton Puppeteer `Browser` and the warm page pool. Implements `OnApplicationShutdown` for graceful cleanup.

| Member                           | Type / Parameters | Return                                                           | Description                                                                                                                                                                                 |
| -------------------------------- | ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `echartsBundle`                  | property          | `string`                                                         | The ECharts minified bundle, read from `node_modules/echarts/dist/echarts.min.js` at startup and injected into every chart page.                                                            |
| `getBrowser()`                   | —                 | `Promise<Browser>`                                               | Returns the singleton `Browser`, launching Chromium on first call. Concurrent callers share the same launch promise.                                                                        |
| `acquirePage()`                  | —                 | `Promise<Page>`                                                  | Returns an idle `Page` from the pool. Creates a new page if the pool is under `pagePoolSize`. Queues callers if all pages are busy; throws `PagePoolExhaustedException` after `timeout` ms. |
| `releasePage(page)`              | `page: Page`      | `void`                                                           | Marks the page as idle and notifies the next queued waiter.                                                                                                                                 |
| `stats()`                        | —                 | `{ total: number; busy: number; idle: number; waiters: number }` | Current pool state — useful for monitoring and debug logging.                                                                                                                               |
| `onApplicationShutdown(signal?)` | `signal?: string` | `Promise<void>`                                                  | Closes all pooled pages then the browser. Called automatically by the NestJS lifecycle.                                                                                                     |

---

### EchartsRenderer

Low-level render pipeline. Consumed internally by `EchartsService`. Advanced use only.

| Method                                 | Parameters                                                           | Return            | Description                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render(chartOptions, renderOptions?)` | `chartOptions: Record<string, any>`, `renderOptions?: RenderOptions` | `Promise<Buffer>` | Full render pipeline: validates options → builds HTML → acquires page → sets content → waits for `__ECHARTS_RENDER_DONE__` signal → screenshots → releases page. |

---

### EchartsTestingModule

Drop-in replacement for `EchartsModule` in unit tests. Swaps `BrowserManager` and `EchartsRenderer` with Jest mocks so tests never open a real browser.

| Method                | Parameters                       | Return          | Description                                                                                                                                                                           |
| --------------------- | -------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withMocks(options?)` | `options?: EchartsModuleOptions` | `DynamicModule` | Returns a testing module with the browser layer mocked. `EchartsService` and `EchartsThemeRegistry` remain real instances. The mock `render()` resolves to `Buffer.from('PNG_MOCK')`. |

---

### Interfaces

#### `EchartsModuleOptions`

Passed to `forRoot()` or returned by the `useFactory` of `forRootAsync()`.

| Property            | Type            | Default     | Description                                                                                                     |
| ------------------- | --------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `width`             | `number`        | `800`       | Viewport width in pixels.                                                                                       |
| `height`            | `number`        | `600`       | Viewport height in pixels.                                                                                      |
| `deviceScaleFactor` | `number`        | `1`         | Device pixel ratio — use `2` for Retina/HiDPI output.                                                           |
| `backgroundColor`   | `string`        | `'#ffffff'` | Chart canvas background color.                                                                                  |
| `launchOptions`     | `LaunchOptions` | —           | Any [`puppeteer.launch()`](https://pptr.dev/api/puppeteer.launchoptions) option, e.g. `executablePath`, `args`. |
| `pagePoolSize`      | `number`        | `3`         | Number of pages kept open and reused across renders.                                                            |
| `timeout`           | `number`        | `30000`     | Max milliseconds to wait for a free page before throwing `PagePoolExhaustedException`.                          |
| `renderTimeout`     | `number`        | `10000`     | Max milliseconds to wait for ECharts to signal render completion.                                               |

#### `EchartsModuleAsyncOptions`

Passed to `forRootAsync()`.

| Property      | Type                                                                        | Description                                                                                |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `imports`     | `any[]`                                                                     | NestJS modules to import (e.g. `ConfigModule` if not already global).                      |
| `inject`      | `any[]`                                                                     | Providers to inject into `useFactory`.                                                     |
| `useFactory`  | `(...args: any[]) => EchartsModuleOptions \| Promise<EchartsModuleOptions>` | Factory function that returns the options object.                                          |
| `useClass`    | `new (...args: any[]) => EchartsOptionsFactory`                             | Class implementing `EchartsOptionsFactory`. A new instance is created by the DI container. |
| `useExisting` | `new (...args: any[]) => EchartsOptionsFactory`                             | Existing provider implementing `EchartsOptionsFactory`. No new instance is created.        |

#### `EchartsOptionsFactory`

Interface for `useClass` / `useExisting` providers.

| Method                   | Return                                                  |
| ------------------------ | ------------------------------------------------------- |
| `createEchartsOptions()` | `EchartsModuleOptions \| Promise<EchartsModuleOptions>` |

#### `RenderOptions`

Optional per-call overrides accepted by all `EchartsService` render methods.

| Property            | Type               | Description                                                          |
| ------------------- | ------------------ | -------------------------------------------------------------------- |
| `width`             | `number`           | Override viewport width for this render only.                        |
| `height`            | `number`           | Override viewport height for this render only.                       |
| `deviceScaleFactor` | `number`           | Override device scale factor for this render only.                   |
| `backgroundColor`   | `string`           | Override background color for this render only.                      |
| `theme`             | `string \| object` | Named registered theme (`string`) or an inline ECharts theme object. |
| `timeout`           | `number`           | Override the page-acquire timeout for this render only.              |
| `renderTimeout`     | `number`           | Override the render completion timeout for this render only.         |

#### `RenderToFileOptions`

Extends `RenderOptions` with a required `path`.

| Property           | Type     | Description                                                                 |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| `path`             | `string` | **Required.** Absolute or relative path where the PNG file will be written. |
| _...RenderOptions_ |          | All `RenderOptions` properties are also accepted.                           |

#### `BatchRenderItem`

One item in the array passed to `renderMany()`.

| Property        | Type                       | Description                                             |
| --------------- | -------------------------- | ------------------------------------------------------- |
| `options`       | `Record<string, any>`      | ECharts chart options for this item.                    |
| `renderOptions` | `RenderOptions` (optional) | Per-item render overrides (width, height, theme, etc.). |

#### `BatchRenderResult`

One result returned by `renderMany()`. Items always appear in the same order as the input array.

| Property | Type               | Description                                                          |
| -------- | ------------------ | -------------------------------------------------------------------- |
| `index`  | `number`           | Original position in the input array.                                |
| `data`   | `Buffer`           | PNG buffer. Empty `Buffer` (`Buffer.alloc(0)`) when `error` is set.  |
| `error`  | `Error` (optional) | Present if this item failed to render. Other items are not affected. |

#### `ThemeDefinition`

Used by `EchartsThemeRegistry.registerMany()`.

| Property | Type     | Description                                                                |
| -------- | -------- | -------------------------------------------------------------------------- |
| `name`   | `string` | Theme name — passed to `echarts.registerTheme()` inside the headless page. |
| `theme`  | `object` | ECharts theme object.                                                      |

---

### Exceptions

All exceptions extend the native `Error` class and set `this.name` to the class name for easy identification in `catch` blocks.

| Exception                      | Constructor                        | Thrown when                                                                                                                           |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartRenderException`         | `(message: string, cause?: Error)` | The headless page fails to render the chart (page error, screenshot failure, unexpected crash).                                       |
| `BrowserLaunchException`       | `(message: string, cause?: Error)` | Puppeteer fails to launch Chromium (missing binary, insufficient permissions, sandbox issues).                                        |
| `InvalidChartOptionsException` | `(message: string)`                | Chart options are `null`, not a plain object, contain a function (detected before browser interaction), or are not JSON-serializable. |
| `PagePoolExhaustedException`   | `(timeout: number)`                | No page becomes available within `timeout` milliseconds. Message includes the timeout value.                                          |

---

### Decorators

| Decorator                 | Target                | Description                                                                                                                                                       |
| ------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@InjectEchartsOptions()` | Constructor parameter | Injects the raw `EchartsModuleOptions` object via the `ECHARTS_MODULE_OPTIONS` DI token. Useful for building custom providers that need the module configuration. |

---

### Constants

Exported from `@nestjsforge/echarts` for use in custom providers.

| Constant                              | Type     | Value       | Description                             |
| ------------------------------------- | -------- | ----------- | --------------------------------------- |
| `ECHARTS_MODULE_OPTIONS`              | `symbol` | —           | DI token for the module options object. |
| `ECHARTS_DEFAULT_WIDTH`               | `number` | `800`       | Default viewport width (px).            |
| `ECHARTS_DEFAULT_HEIGHT`              | `number` | `600`       | Default viewport height (px).           |
| `ECHARTS_DEFAULT_DEVICE_SCALE_FACTOR` | `number` | `1`         | Default device scale factor.            |
| `ECHARTS_DEFAULT_BACKGROUND_COLOR`    | `string` | `'#ffffff'` | Default background color.               |
| `ECHARTS_DEFAULT_PAGE_POOL_SIZE`      | `number` | `3`         | Default page pool size.                 |
| `ECHARTS_DEFAULT_TIMEOUT_MS`          | `number` | `30000`     | Default page-acquire timeout (ms).      |
| `ECHARTS_DEFAULT_RENDER_TIMEOUT_MS`   | `number` | `10000`     | Default render completion timeout (ms). |

---

## Testing

### Unit tests — mock the renderer

Use `EchartsTestingModule` to swap out the real browser with a Jest mock:

```typescript
import { Test } from "@nestjs/testing";
import { EchartsTestingModule, EchartsService } from "@nestjsforge/echarts";

describe("ReportsService", () => {
  let echarts: EchartsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [EchartsTestingModule.withMocks()],
      providers: [ReportsService],
    }).compile();

    echarts = module.get(EchartsService);
  });

  it("returns a PNG buffer", async () => {
    const result = await echarts.renderToBuffer({ series: [] });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
```

### E2E tests — real browser

```typescript
import { Test } from "@nestjs/testing";
import { EchartsModule, EchartsService } from "@nestjsforge/echarts";

describe("EchartsService (E2E)", () => {
  let service: EchartsService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        EchartsModule.forRoot({
          launchOptions: { args: ["--no-sandbox"] },
        }),
      ],
    }).compile();
    await module.init();
    service = module.get(EchartsService);
  }, 30_000);

  afterAll(() => module.close());

  it("renders a bar chart", async () => {
    const buf = await service.renderToBuffer({
      series: [{ type: "bar", data: [1, 2, 3] }],
    });
    expect(buf[0]).toBe(0x89); // PNG magic byte
  }, 15_000);
});
```

---

## Docker

### node:22-slim (recommended)

```dockerfile
FROM node:22-slim

# Chromium system deps
RUN apt-get update && apt-get install -y \
  ca-certificates fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 \
  libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
  libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
  libxi6 libxrandr2 libxrender1 libxss1 libxtst6 wget xdg-utils \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
CMD ["node", "dist/main"]
```

### node:22-alpine

Alpine requires Chromium from the Alpine package registry (Puppeteer's bundled Chromium doesn't run on musl libc):

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache \
  chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "dist/main"]
```

Set in your NestJS config:

```typescript
EchartsModule.forRoot({
  launchOptions: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});
```

---

## Performance

| Concern           | Strategy                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Browser startup   | **Lazy singleton** — Chromium launches on first render, then stays alive      |
| Page creation     | **Page pool** — pages are reused across renders (configurable `pagePoolSize`) |
| Concurrency       | **Waiter queue** — excess requests wait for a free page instead of crashing   |
| Memory            | Each page is reset via `setContent()` — no state leaks between renders        |
| Graceful shutdown | `OnApplicationShutdown` closes all pages then the browser                     |

### Tuning for high throughput

```typescript
EchartsModule.forRoot({
  pagePoolSize: 10, // warm pool — no cold page creation under load
  renderTimeout: 5_000, // fast-fail slow or invalid charts
  timeout: 60_000, // max wait for a free page under burst traffic
});
```

> **Note:** `pagePoolSize` is the only concurrency knob. Requests that arrive when all pages
> are busy queue automatically and are served as soon as a page is released.

For thousands of renders per day, run multiple Node.js instances behind a load balancer — each instance manages its own browser pool. Avoid sharing a single Puppeteer browser across processes.

### Animations are disabled automatically

For server-side rendering, `@nestjsforge/echarts` always sets `animation: false` before rendering — there is no point animating a static screenshot and it prevents partial frames from being captured. You do **not** need to add this to your chart options manually.

---

## Architecture

```
libs/echarts/src/
├── browser/
│   ├── browser-manager.ts      # Singleton browser + page pool
│   └── echarts-renderer.ts     # Low-level render pipeline
├── constants/
│   └── echarts.constants.ts    # DI tokens & defaults
├── decorators/
│   └── inject-echarts-options.decorator.ts
├── exceptions/
│   ├── browser-launch.exception.ts
│   ├── chart-render.exception.ts
│   ├── invalid-chart-options.exception.ts
│   └── page-pool-exhausted.exception.ts
├── interfaces/
│   ├── echarts-module-options.interface.ts
│   └── render-options.interface.ts
├── module/
│   └── echarts.module.ts       # Dynamic module (forRoot / forRootAsync)
├── services/
│   └── echarts.service.ts      # Public API
├── templates/
│   └── chart.template.ts       # Headless HTML page template
├── testing/
│   └── echarts-testing.module.ts
├── themes/
│   └── echarts-theme-registry.ts
├── utils/
│   └── serializer.util.ts
└── index.ts                    # Public barrel
```

### Render flow

```
EchartsService.renderToBuffer(options)
  └─► EchartsRenderer.render()
        ├── serializeChartOptions()          validate & JSON.stringify
        ├── buildChartHtml()                 inject ECharts bundle + options
        ├── BrowserManager.acquirePage()     get idle page from pool
        ├── page.setContent(html)            load chart page
        ├── page.waitForFunction(done)       wait for render signal
        ├── page.screenshot()               capture PNG
        └── BrowserManager.releasePage()     return page to pool
```

---

## FAQ

**Q: Does this work in serverless environments (Lambda, Cloud Run)?**
A: Yes, but cold starts are slower since Chromium must launch fresh. Set `pagePoolSize: 1` and configure `launchOptions` with `--no-sandbox`. For Cloud Run, use a minimum instance count of 1 to keep the browser warm.

**Q: Can I use a custom Chromium / Chrome path?**
A: Yes — set `launchOptions.executablePath` to your Chrome binary path.

**Q: How do I render multiple chart types (line, bar, pie) in one image?**
A: Use ECharts' built-in multi-series: pass an `options` object with multiple series or use a grid layout. `renderMany` is for rendering separate charts in parallel.

**Q: Can I add watermarks?**
A: Use ECharts' `graphic` component in your options object to overlay text or images.

**Q: Memory is growing over time — what's happening?**
A: Check for browser disconnections (look for `Browser disconnected` log). On disconnect, the pool clears and a new browser is spawned on the next request. If you see frequent disconnects, increase system resources or reduce `pagePoolSize`.

---

## Troubleshooting

### `BrowserLaunchException: Failed to launch Chromium`

- Missing system dependencies — see the [Docker](#docker) section for the full apt/apk list.
- On Alpine: set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` and `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`.
- In Docker: always add `--no-sandbox --disable-setuid-sandbox` to `launchOptions.args`.

### `InvalidChartOptionsException: Chart options contain a function at "..."`

ECharts options are sent to the browser via `JSON.stringify`. Functions are silently dropped,
causing runtime errors in the headless page. Replace JS functions with ECharts template strings:

```typescript
// ❌ breaks
formatter: (p) => `${p.name}: ${p.value}`;

// ✅ works
formatter: "{b}: {c}";
```

### `ProtocolError: int32 value expected`

Puppeteer's CDP protocol requires integer values for `width` and `height`. This happens when
`ConfigService.get<number>()` is used without explicit parsing — env vars are always strings.

```typescript
// ❌ runtime type is string '1200', not number 1200
width: config.get<number>("CHART_WIDTH", 1200);

// ✅ explicitly parsed to integer
width: parseInt(config.get("CHART_WIDTH", "1200"), 10);
```

### `ChartRenderException: Chart render timeout`

- Increase `renderTimeout` (default 10 s).
- Animations are disabled automatically; this usually only happens with very complex or invalid options.
- Validate your ECharts options in the [ECharts playground](https://echarts.apache.org/examples/) first.

### `PagePoolExhaustedException`

- Increase `pagePoolSize` or `timeout`.
- If concurrency is very high, add more pool capacity or run multiple app instances.

### Chart renders as blank / white

- Ensure `backgroundColor` is set (default `#ffffff` — screenshots appear blank against a white background).
- Enable `DEBUG` log level to see browser console errors.

### `Content-Type` warning in NestJS 11

Do not use `@Header('Content-Type', 'image/png')` together with `StreamableFile`. Pass the
type to the constructor instead:

```typescript
// ❌ conflict — NestJS 11 warns
@Header('Content-Type', 'image/png')
return new StreamableFile(buffer);

// ✅ correct
return new StreamableFile(buffer, { type: 'image/png' });
```

## Stay in touch

- Author - [Smerlyn Javier Eusebio Bonifacio](https://www.linkedin.com/in/smerlyn-javier-eusebio-bonifacio-aab15b418/)

---

## Support

If this library saved you time, consider buying me a coffee:

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/SmerlynJavierEB)

---

## License

MIT © [NestJSForge](https://github.com/nestjsforge)

---

Forged with ⚒️❤️‍🔥 for the NestJS community 🚀