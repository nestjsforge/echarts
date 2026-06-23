export function buildChartHtml(params: {
  echartsVersion: string;
  width: number;
  height: number;
  backgroundColor: string;
  options: string;
  theme: string | null;
  themeRegistrations: string;
  renderTimeoutMs: number;
}): string {
  const {
    echartsVersion,
    width,
    height,
    backgroundColor,
    options,
    theme,
    themeRegistrations,
    renderTimeoutMs,
  } = params;

  const themeArg = theme ? JSON.stringify(theme) : 'null';

  return /* html */ `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #chart { width: ${width}px; height: ${height}px; background: ${backgroundColor}; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>${echartsVersion}</script>
  <script>
    (function () {
      'use strict';

      // Reset render signals up-front. Puppeteer's setContent() reuses the same
      // window across pooled-page renders (document.write), so flags from a
      // previous render would otherwise persist and poison this one — a single
      // failed render would cascade into every subsequent render on the page.
      window.__ECHARTS_RENDER_DONE__ = false;
      window.__ECHARTS_RENDER_ERROR__ = undefined;

      // Register custom themes before chart init
      ${themeRegistrations}

      var container = document.getElementById('chart');
      var chart = echarts.init(container, ${themeArg}, {
        renderer: 'canvas',
        width: ${width},
        height: ${height},
      });

      var userOptions = ${options};

      // Disable animations for server-side rendering: setOption() becomes
      // synchronous, so the canvas is fully painted before the next rAF tick.
      var renderOptions = Object.assign({}, userOptions, {
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
      });

      try {
        // 'finished' fires once ECharts has completed its render pass. With
        // animation disabled it fires synchronously inside setOption(), so we
        // register the handler BEFORE calling setOption to avoid missing it.
        // NOTE: do NOT gate the done-flag behind requestAnimationFrame — rAF is
        // throttled in backgrounded pages, so under concurrent pooled-page
        // rendering it may never fire and the render would hang until timeout.
        chart.on('finished', function () {
          window.__ECHARTS_RENDER_DONE__ = true;
        });

        chart.setOption(renderOptions);

        // Safety net: if 'finished' never fires (e.g. empty series), resolve on
        // the next macrotask. setTimeout is far less throttled than rAF and the
        // canvas is already painted synchronously (animation is disabled).
        setTimeout(function () {
          window.__ECHARTS_RENDER_DONE__ = true;
        }, 0);

      } catch (err) {
        window.__ECHARTS_RENDER_ERROR__ = err.message;
        window.__ECHARTS_RENDER_DONE__ = true;
      }

      // Hard timeout — prevents Puppeteer from hanging on pathological options
      setTimeout(function () {
        if (!window.__ECHARTS_RENDER_DONE__) {
          window.__ECHARTS_RENDER_ERROR__ = 'Render timeout after ${renderTimeoutMs}ms';
          window.__ECHARTS_RENDER_DONE__ = true;
        }
      }, ${renderTimeoutMs});
    })();
  </script>
</body>
</html>`;
}
