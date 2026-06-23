import { InvalidChartOptionsException } from '../exceptions/invalid-chart-options.exception';

/**
 * Safely serializes ECharts options to a JSON string.
 *
 * Functions are NOT transferable to the browser page via JSON — they are
 * silently dropped by JSON.stringify, which causes hard-to-debug runtime
 * errors inside the headless page. We detect them early and throw instead.
 *
 * Use ECharts template strings (e.g. '{b}: {c}') instead of JS functions
 * for formatter, label, and similar callback-style options.
 */
export function serializeChartOptions(options: unknown): string {
  if (options === null || options === undefined) {
    throw new InvalidChartOptionsException('Chart options cannot be null or undefined');
  }
  if (typeof options !== 'object') {
    throw new InvalidChartOptionsException('Chart options must be a plain object');
  }

  const fnPath = findFunctionPath(options as Record<string, unknown>);
  if (fnPath) {
    throw new InvalidChartOptionsException(
      `Chart options contain a function at "${fnPath}" — functions cannot be serialized to JSON. ` +
        `Use an ECharts template string (e.g. '{b}: {c}') instead.`,
    );
  }

  validateCartesianAxes(options as Record<string, unknown>);

  try {
    return JSON.stringify(options);
  } catch (err) {
    throw new InvalidChartOptionsException(
      `Chart options are not JSON-serializable: ${(err as Error).message}`,
    );
  }
}

/**
 * Series types that render on a cartesian (cartesian2d) coordinate system and
 * therefore require both an xAxis and a yAxis.
 */
const CARTESIAN_SERIES_TYPES = new Set([
  'line',
  'bar',
  'scatter',
  'effectScatter',
  'candlestick',
  'boxplot',
  'pictorialBar',
  'heatmap',
]);

/**
 * Guards against the most common ECharts 6 migration pitfall.
 *
 * ECharts 5 silently created a default category xAxis + value yAxis when a
 * cartesian series (bar/line/scatter/…) omitted them. ECharts 6 no longer does
 * this, so the same options now throw a cryptic, page-side
 * "Cannot read properties of undefined (reading 'get')" deep inside setOption().
 *
 * We detect the case up-front and throw an actionable error instead.
 */
export function validateCartesianAxes(options: Record<string, unknown>): void {
  const series = options.series;
  if (series == null) return;

  const list = Array.isArray(series) ? series : [series];

  const needsCartesian = list.some((s) => {
    if (s == null || typeof s !== 'object') return false;
    const coordinateSystem = (s as Record<string, unknown>).coordinateSystem;
    // A series pinned to a non-cartesian coordinate system (polar, geo,
    // calendar, …) does not need xAxis/yAxis; only cartesian2d does.
    if (coordinateSystem != null && coordinateSystem !== 'cartesian2d') return false;
    return CARTESIAN_SERIES_TYPES.has((s as Record<string, unknown>).type as string);
  });

  if (!needsCartesian) return;

  const missing: string[] = [];
  if (options.xAxis == null) missing.push('xAxis');
  if (options.yAxis == null) missing.push('yAxis');
  if (missing.length === 0) return;

  throw new InvalidChartOptionsException(
    `Chart options use a cartesian series (bar/line/scatter/…) but are missing ${missing.join(' and ')}. ` +
      `ECharts 6 no longer auto-creates default axes the way ECharts 5 did, so omitting them throws ` +
      `"Cannot read properties of undefined (reading 'get')" during render. ` +
      `Add an explicit ${missing.join(' and ')} (e.g. xAxis: { type: 'category' }, yAxis: { type: 'value' }).`,
  );
}

function findFunctionPath(
  obj: unknown,
  path = '',
  visited = new Set<unknown>(),
): string | null {
  if (typeof obj === 'function') return path || '(root)';
  if (typeof obj !== 'object' || obj === null) return null;
  if (visited.has(obj)) return null;
  visited.add(obj);

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    const found = findFunctionPath(value, childPath, visited);
    if (found) return found;
  }
  return null;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
