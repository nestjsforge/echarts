import { Test, TestingModule } from '@nestjs/testing';
import { BrowserManager } from './browser-manager';
import { ECHARTS_MODULE_OPTIONS } from '../constants/echarts.constants';
import { BrowserLaunchException } from '../exceptions/browser-launch.exception';
// Resolved to __mocks__/puppeteer.ts via jest moduleNameMapper
import { launch as mockLaunch, mockPage, mockBrowser } from '../__mocks__/puppeteer';

// Prevent the BrowserManager constructor from hitting the real filesystem
jest.mock('fs', () => ({ readFileSync: jest.fn().mockReturnValue('/* echarts bundle */') }));

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockBrowser.connected = true;
    (mockBrowser.newPage as jest.Mock).mockResolvedValue(mockPage);
    (mockLaunch as jest.Mock).mockResolvedValue(mockBrowser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserManager,
        {
          provide: ECHARTS_MODULE_OPTIONS,
          useValue: { pagePoolSize: 2, timeout: 5000 },
        },
      ],
    }).compile();

    manager = module.get<BrowserManager>(BrowserManager);
  });

  describe('getBrowser', () => {
    it('launches browser on first call', async () => {
      const browser = await manager.getBrowser();
      expect(mockLaunch).toHaveBeenCalledTimes(1);
      expect(browser).toBe(mockBrowser);
    });

    it('reuses existing browser on subsequent calls', async () => {
      await manager.getBrowser();
      await manager.getBrowser();
      expect(mockLaunch).toHaveBeenCalledTimes(1);
    });

    it('throws BrowserLaunchException when puppeteer.launch fails', async () => {
      (mockLaunch as jest.Mock).mockRejectedValueOnce(new Error('Chromium not found'));
      await expect(manager.getBrowser()).rejects.toBeInstanceOf(BrowserLaunchException);
    });
  });

  describe('acquirePage / releasePage', () => {
    it('creates a new page from pool', async () => {
      const page = await manager.acquirePage();
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
      expect(page).toBe(mockPage);
    });

    it('reuses a released page without creating a new one', async () => {
      const page1 = await manager.acquirePage();
      manager.releasePage(page1 as any);
      const page2 = await manager.acquirePage();
      expect(page1).toBe(page2);
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    });

    it('respects pagePoolSize limit and enqueues waiters', async () => {
      const p1 = await manager.acquirePage();
      await manager.acquirePage(); // fills pool (size=2)

      let acquired = false;
      const p3Promise = manager.acquirePage().then((p) => {
        acquired = true;
        return p;
      });

      expect(acquired).toBe(false);

      manager.releasePage(p1 as any);
      await p3Promise;
      expect(acquired).toBe(true);
    });
  });

  describe('stats', () => {
    it('reports correct pool state', async () => {
      const p = await manager.acquirePage();
      expect(manager.stats()).toMatchObject({ busy: 1, idle: 0 });
      manager.releasePage(p as any);
      expect(manager.stats()).toMatchObject({ busy: 0, idle: 1 });
    });
  });

  describe('onApplicationShutdown', () => {
    it('closes all pages and the browser', async () => {
      await manager.acquirePage();
      await manager.onApplicationShutdown('SIGTERM');
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});
