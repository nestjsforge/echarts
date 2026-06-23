export interface RenderOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  backgroundColor?: string;
  theme?: string | object;
  timeout?: number;
  renderTimeout?: number;
}

export interface RenderToFileOptions extends RenderOptions {
  path: string;
}

export interface BatchRenderItem {
  options: Record<string, any>;
  renderOptions?: RenderOptions;
}

export interface BatchRenderResult {
  index: number;
  data: Buffer;
  error?: Error;
}

export type RenderOutput = 'base64' | 'buffer';
