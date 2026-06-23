import { Injectable, Logger } from '@nestjs/common';

export interface ThemeDefinition {
  name: string;
  theme: object;
}

@Injectable()
export class EchartsThemeRegistry {
  private readonly logger = new Logger(EchartsThemeRegistry.name);
  private readonly themes = new Map<string, object>();

  register(name: string, theme: object): this {
    this.themes.set(name, theme);
    this.logger.debug(`Registered ECharts theme: "${name}"`);
    return this;
  }

  registerMany(themes: ThemeDefinition[]): this {
    themes.forEach(({ name, theme }) => this.register(name, theme));
    return this;
  }

  get(name: string): object | undefined {
    return this.themes.get(name);
  }

  has(name: string): boolean {
    return this.themes.has(name);
  }

  names(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Builds the JS snippet injected into the chart page to register themes
   * via echarts.registerTheme() before chart initialization.
   */
  buildRegistrationSnippet(): string {
    if (this.themes.size === 0) return '';
    const lines: string[] = [];
    for (const [name, theme] of this.themes) {
      lines.push(`echarts.registerTheme(${JSON.stringify(name)}, ${JSON.stringify(theme)});`);
    }
    return lines.join('\n');
  }
}
