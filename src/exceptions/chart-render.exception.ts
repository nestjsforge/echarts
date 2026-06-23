export class ChartRenderException extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ChartRenderException';
    if (cause) this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
  }
}
