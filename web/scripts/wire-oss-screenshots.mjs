import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, route] of [['courses', 'courses'], ['course', 'course/oss'], ['governance', 'lesson/oss.governance'], ['cncf-path', 'lesson/oss.cncf-path']]) {
      await page.goto(`http://127.0.0.1:4187/#/${route}`);
      await page.locator('h1').waitFor();
      if (route.startsWith('lesson/')) await page.locator('.lsec[data-kind="widget"] > *').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        widgets: [...document.querySelectorAll('.lsec[data-kind="widget"]')].map(el => {
          const r = el.getBoundingClientRect();
          return { width: r.width, left: r.left, right: r.right, overflow: el.scrollWidth > el.clientWidth + 1 };
        }),
      }));
      if (layout.overflow || layout.widgets.some(w => w.width > 761 || w.left < 0 || w.right > width || w.overflow)) errors.push(`${name}/${width}: ${JSON.stringify(layout)}`);
      await page.screenshot({ path: `/tmp/wire-oss-${name}-${width}.png`, fullPage: true });
      console.log(name, width, JSON.stringify(layout));
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('8 screenshots; no page errors or horizontal overflow; widgets fit the 760px column.');
} finally { await browser.close(); }
