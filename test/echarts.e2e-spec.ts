import { Test, TestingModule } from '@nestjs/testing';
import { EchartsModule } from '../src/module/echarts.module';
import { EchartsService } from '../src/services/echarts.service';

/**
 * E2E test — launches a real Chromium browser.
 * Run with: npm run test:e2e
 *
 * Skip in CI without Chromium by setting SKIP_E2E=1.
 */
const SKIP = process.env.SKIP_E2E === '1';

describe('EchartsService (E2E)', () => {
  let module: TestingModule;
  let service: EchartsService;

  beforeAll(async () => {
    if (SKIP) return;

    module = await Test.createTestingModule({
      imports: [
        EchartsModule.forRoot({
          width: 800,
          height: 600,
          deviceScaleFactor: 1,
          pagePoolSize: 1,
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          },
        }),
      ],
    }).compile();

    await module.init();
    service = module.get<EchartsService>(EchartsService);
  }, 30_000);

  afterAll(async () => {
    if (module) await module.close();
  });

  it('renderToBuffer returns a non-empty PNG Buffer', async () => {
    if (SKIP) return;

    const buffer = await service.renderToBuffer({
      title: { text: 'E2E Test Chart' },
      series: [{ type: 'bar', data: [100, 200, 300] }],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  }, 30_000);

  it('renderToBase64 returns valid base64', async () => {
    if (SKIP) return;

    const base64 = await service.renderToBase64({
      series: [{ type: 'pie', data: [{ value: 100, name: 'A' }] }],
    });

    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);
    const decoded = Buffer.from(base64, 'base64');
    expect(decoded[0]).toBe(0x89);
  }, 30_000);

  it('renderMany renders multiple charts concurrently', async () => {
    if (SKIP) return;

    const items = Array.from({ length: 3 }, (_, i) => ({
      options: {
        series: [{ type: 'bar', data: [i * 10, i * 20, i * 30] }],
      },
    }));

    const results = await service.renderMany(items, 2);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.error).toBeUndefined();
      expect(r.data.length).toBeGreaterThan(0);
    });
  }, 60_000);
});
