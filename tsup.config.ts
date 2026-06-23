import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: '.',
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: false,
  // echarts y puppeteer quedan como dependencias externas (no se empaquetan)
  external: ['echarts', 'puppeteer', '@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs'],
});
