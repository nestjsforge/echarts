import { serializeChartOptions, validateCartesianAxes } from './serializer.util';
import { InvalidChartOptionsException } from '../exceptions/invalid-chart-options.exception';

describe('serializeChartOptions', () => {
  it('serializes a valid cartesian chart', () => {
    const opts = {
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [1, 2] }],
    };
    expect(JSON.parse(serializeChartOptions(opts))).toEqual(opts);
  });

  it('throws on functions in options', () => {
    expect(() => serializeChartOptions({ tooltip: { formatter: () => 'x' } })).toThrow(
      InvalidChartOptionsException,
    );
  });

  it('rejects a cartesian series missing its axes (ECharts 6 pitfall)', () => {
    expect(() => serializeChartOptions({ series: [{ type: 'bar', data: [1, 2, 3] }] })).toThrow(
      InvalidChartOptionsException,
    );
  });
});

describe('validateCartesianAxes', () => {
  it('flags bar/line/scatter without xAxis and yAxis', () => {
    for (const type of ['bar', 'line', 'scatter']) {
      expect(() => validateCartesianAxes({ series: [{ type, data: [1, 2] }] })).toThrow(
        /missing xAxis and yAxis/,
      );
    }
  });

  it('flags a chart that has only one of the two axes', () => {
    expect(() =>
      validateCartesianAxes({ xAxis: { type: 'category' }, series: [{ type: 'bar', data: [1] }] }),
    ).toThrow(/missing yAxis/);
  });

  it('accepts a cartesian series with both axes', () => {
    expect(() =>
      validateCartesianAxes({
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [1] }],
      }),
    ).not.toThrow();
  });

  it('ignores non-cartesian series (pie/gauge/radar)', () => {
    expect(() => validateCartesianAxes({ series: [{ type: 'pie', data: [] }] })).not.toThrow();
    expect(() => validateCartesianAxes({ series: [{ type: 'gauge', data: [] }] })).not.toThrow();
  });

  it('ignores a series pinned to a non-cartesian coordinate system', () => {
    expect(() =>
      validateCartesianAxes({
        polar: {},
        angleAxis: {},
        radiusAxis: {},
        series: [{ type: 'line', coordinateSystem: 'polar', data: [1, 2] }],
      }),
    ).not.toThrow();
  });

  it('is a no-op when there is no series', () => {
    expect(() => validateCartesianAxes({ title: { text: 'x' } })).not.toThrow();
  });
});
