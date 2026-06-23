import { Test, TestingModule } from '@nestjs/testing';
import { EchartsService } from './echarts.service';
import { EchartsRenderer } from '../browser/echarts-renderer';
import { ChartRenderException } from '../exceptions/chart-render.exception';
import * as fs from 'fs/promises';

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const MOCK_PNG = Buffer.from('MOCK_PNG_DATA');

const mockRenderer = {
  render: jest.fn().mockResolvedValue(MOCK_PNG),
};

describe('EchartsService', () => {
  let service: EchartsService;

  const BAR_CHART = {
    series: [{ type: 'bar', data: [1, 2, 3] }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EchartsService,
        { provide: EchartsRenderer, useValue: mockRenderer },
      ],
    }).compile();

    service = module.get<EchartsService>(EchartsService);
  });

  describe('renderToBuffer', () => {
    it('returns a Buffer from the renderer', async () => {
      const result = await service.renderToBuffer(BAR_CHART);
      expect(result).toBe(MOCK_PNG);
      expect(mockRenderer.render).toHaveBeenCalledWith(BAR_CHART, {});
    });

    it('passes renderOptions through to renderer', async () => {
      const opts = { width: 1200, height: 800 };
      await service.renderToBuffer(BAR_CHART, opts);
      expect(mockRenderer.render).toHaveBeenCalledWith(BAR_CHART, opts);
    });
  });

  describe('renderToBase64', () => {
    it('returns a valid base64 string', async () => {
      const result = await service.renderToBase64(BAR_CHART);
      expect(typeof result).toBe('string');
      expect(result).toBe(MOCK_PNG.toString('base64'));
    });
  });

  describe('renderToDataUrl', () => {
    it('returns a data: URL with PNG mime type', async () => {
      const result = await service.renderToDataUrl(BAR_CHART);
      expect(result.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  describe('renderToFile', () => {
    it('calls writeFile with rendered buffer', async () => {
      await service.renderToFile(BAR_CHART, { path: '/tmp/chart.png' });
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/chart.png', MOCK_PNG);
    });

    it('strips path from renderOptions before forwarding to renderer', async () => {
      await service.renderToFile(BAR_CHART, { path: '/tmp/test.png', width: 400 });
      expect(mockRenderer.render).toHaveBeenCalledWith(BAR_CHART, { width: 400 });
    });
  });

  describe('renderMany', () => {
    it('renders all items and returns indexed results', async () => {
      const items = [
        { options: BAR_CHART },
        { options: BAR_CHART },
        { options: BAR_CHART },
      ];
      const results = await service.renderMany(items, 2);
      expect(results).toHaveLength(3);
      results.forEach((r, i) => {
        expect(r.index).toBe(i);
        expect(r.data).toEqual(MOCK_PNG);
        expect(r.error).toBeUndefined();
      });
    });

    it('captures individual errors without failing the whole batch', async () => {
      mockRenderer.render
        .mockResolvedValueOnce(MOCK_PNG)
        .mockRejectedValueOnce(new ChartRenderException('boom'))
        .mockResolvedValueOnce(MOCK_PNG);

      const items = [
        { options: BAR_CHART },
        { options: BAR_CHART },
        { options: BAR_CHART },
      ];

      const results = await service.renderMany(items, 1);
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeInstanceOf(ChartRenderException);
      expect(results[2].error).toBeUndefined();
    });
  });
});
