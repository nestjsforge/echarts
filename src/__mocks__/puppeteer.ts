const mockPage = {
  setViewport: jest.fn().mockResolvedValue(undefined),
  setContent: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('\x89PNG')),
  waitForFunction: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  isClosed: jest.fn().mockReturnValue(false),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  connected: true,
  on: jest.fn(),
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

const launch = jest.fn().mockResolvedValue(mockBrowser);

export { launch, mockPage, mockBrowser };
export default { launch };
