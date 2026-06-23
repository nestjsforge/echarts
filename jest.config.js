// Plain JS config so Jest doesn't require ts-node to parse it (CI runs `npm ci`
// without ts-node). Jest auto-discovers this file, so `jest` needs no --config.
// Unit tests (*.spec.ts under src). E2E tests use test/jest-e2e.json.
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // reflect-metadata is required for NestJS DI metadata in TestingModule specs.
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: {
    // Route the real puppeteer import to the manual mock so specs never launch
    // a real browser.
    '^puppeteer$': '<rootDir>/src/__mocks__/puppeteer.ts',
    '^@nestjsforge/echarts(|/.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/__mocks__/**'],
  coverageDirectory: 'coverage',
};
