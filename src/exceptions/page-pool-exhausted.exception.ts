export class PagePoolExhaustedException extends Error {
  constructor(timeout: number) {
    super(`Page pool exhausted: no page available after ${timeout}ms`);
    this.name = 'PagePoolExhaustedException';
  }
}
