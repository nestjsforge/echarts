export class BrowserLaunchException extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'BrowserLaunchException';
    if (cause) this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
  }
}
