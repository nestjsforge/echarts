import { EchartsThemeRegistry } from './echarts-theme-registry';

describe('EchartsThemeRegistry', () => {
  let registry: EchartsThemeRegistry;

  beforeEach(() => {
    registry = new EchartsThemeRegistry();
  });

  it('registers and retrieves a theme', () => {
    const theme = { color: ['#c23531'] };
    registry.register('vintage', theme);
    expect(registry.get('vintage')).toBe(theme);
  });

  it('reports has() correctly', () => {
    registry.register('dark', { backgroundColor: '#333' });
    expect(registry.has('dark')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });

  it('returns all registered names', () => {
    registry.registerMany([
      { name: 'a', theme: {} },
      { name: 'b', theme: {} },
    ]);
    expect(registry.names()).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('builds correct registration snippet', () => {
    registry.register('custom', { color: ['red'] });
    const snippet = registry.buildRegistrationSnippet();
    expect(snippet).toContain('echarts.registerTheme("custom"');
    expect(snippet).toContain('"red"');
  });

  it('returns empty string snippet when no themes registered', () => {
    expect(registry.buildRegistrationSnippet()).toBe('');
  });
});
