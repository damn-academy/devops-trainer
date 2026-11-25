// Run against a local Vite server; use Chromium for all viewport/theme checks.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/trainers-preview', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body style="padding:20px"><main></main></body></html>' }));
  await page.goto('http://127.0.0.1:5199/trainers-preview');
  await page.evaluate(async () => {
    await import('/src/styles/tokens.css'); await import('/src/styles/base.css'); await import('/src/styles/widgets.css');
    await import('/node_modules/@fontsource-variable/inter/index.css');
    const { mountTrainer } = await import('/src/engine/trainers/widget.ts');
    const { setLang } = await import('/src/core/i18n.ts'); setLang('ru');
    window.mountPreview = (kind, props) => {
      window.preview?.dispose(); localStorage.clear(); document.querySelector('main').replaceChildren();
      const status = { configured: true, hasKey: true, settings: null, locked: false };
      window.preview = mountTrainer(kind, document.querySelector('main'), props, { level: 'beginner', complete() {}, record() {}, openDoc() {} }, { status, ready: Promise.resolve(status), onChange: () => () => {}, stream: () => ({ done: Promise.resolve('**Проверка:** текст понятен.\n\n1. Уточните следующий шаг.'), abort() {} }) });
    };
  });
  for (const width of [1440, 390]) for (const theme of ['light']) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    for (const [kind, props] of [['governance', { data: 'oss.governance' }], ['health', { data: 'oss.health' }], ['template', { file: 'dream100' }]]) {
      await page.evaluate(([kind, props]) => window.mountPreview(kind, props), [kind, props]);
      if (kind === 'governance') {
        await page.locator('input[value=B]').first().check();
        await page.getByRole('button', { name: 'Сверить с репозиторием' }).click();
        if (!(await page.locator('textarea').inputValue()).includes('мейнтейнер может сливать')) throw Error('Missing assembled selection');
      } else if (kind === 'health') {
        await page.locator('textarea').fill('Два человека');
        await page.getByRole('button', { name: 'Показать разбор' }).click();
        await page.getByRole('button', { name: 'Дальше', exact: true }).waitFor();
      } else {
        const response = await page.request.get('http://127.0.0.1:5199/templates/dream100.xlsx');
        if (!response.ok()) throw Error('Template download failed');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) errors.push(`${kind}/${width}/${theme}: horizontal overflow`);
      await page.screenshot({ path: `/tmp/trainers2-${kind}-${width}-${theme}.png`, fullPage: true });
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('6 Chromium screenshots; no page errors or horizontal overflow.');
} finally { await browser.close(); }
