import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, route, interactive] of [
      ['courses', 'courses'],
      ['course', 'course/scithink'],
      ['calibration', 'lesson/scithink.calibration', '.scb-root'],
      ['correlation', 'lesson/scithink.correlation', '.explainer'],
    ]) {
      await page.goto((process.env.BASE ?? 'http://127.0.0.1:52739/') + '#/' + route);
      await page.locator('h1').waitFor();
      if (interactive) await page.locator(interactive).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(selector => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        widgets: selector ? [...document.querySelectorAll(selector)].map(el => {
          const r = el.getBoundingClientRect();
          return { width: r.width, left: r.left, right: r.right };
        }) : [],
      }), interactive);
      assert(metrics.overflow <= 1, JSON.stringify({ name, width, ...metrics }));
      for (const r of metrics.widgets) {
        assert(r.width <= 761 && r.left >= 0 && r.right <= width, JSON.stringify({ name, width, r }));
      }
      await page.screenshot({ path: '/tmp/wire-sci-' + name + '-' + width + '.png', fullPage: true });
      console.log(JSON.stringify({ name, width, ...metrics }));
    }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
