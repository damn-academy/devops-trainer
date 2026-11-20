import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru')); });
test('dense phone explainers keep labels readable and carry an expandable current caption', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['net.url', 'k8s.service-path', 'containers.orchestration', 'method.x.value-stream', 'orient.run']) {
    await page.goto(`/#/explainer/${id}`);
    await expect(page.locator('.ex-svg')).toBeVisible();
    for (let step = 0; step < 5; step++) {
      await expect.poll(() => page.locator('.ex-svg').evaluate(svg => {
        const s = svg as SVGSVGElement;
        return Math.min(...[...s.querySelectorAll('text.node-label')].map(l => parseFloat(getComputedStyle(l).fontSize) * s.getScreenCTM()!.a));
      })).toBeGreaterThanOrEqual(12);
      await expect(page.locator('.ex-step-caption')).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Шаг вперёд', exact: true }).click();
      await expect.poll(() => page.locator('.explainer').evaluate(el => el.querySelector('.ex-viewport')!.getBoundingClientRect().top >= el.querySelector('.ex-stepper')!.getBoundingClientRect().bottom - 1)).toBe(true);
    }
    await page.getByRole('button', { name: 'Развернуть пояснение', exact: true }).click();
    await expect(page.locator('.ex-step-caption')).toHaveClass(/expanded/);
  }
});
test('imports compressed progress in another browser profile', async ({ page, browser }) => {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Перенести на другое устройство', exact: true }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка для переноса прогресса' });
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  const context = await browser.newContext();
  try {
    const receiver = await context.newPage();
    await receiver.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
    await receiver.goto(url);
    await receiver.getByRole('button', { name: 'Загрузить прогресс по ссылке', exact: true }).click();
    await expect(receiver.getByText('Прогресс загружен на это устройство.', { exact: true })).toBeVisible();
    expect(receiver.url()).not.toContain('transfer=');
  } finally { await context.close(); }
});
