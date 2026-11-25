import { test, expect } from '@playwright/test';
for (const lang of ['ru', 'en']) test(`pipeline initial overflow cue and data-card mentor at 390px: ${lang}`, async ({ page }) => {
  await page.addInitScript(lang => localStorage.setItem('dt.lang', lang), lang);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/lesson/metrics.pipeline');
  const frames = page.locator('.md-table-frame');
  await expect(frames.first()).toBeVisible();
  for (const frame of await frames.all()) {
    const overflow = await frame.locator('.md-table-scroll').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    if (overflow) await expect(frame.locator('.md-table-hint')).toBeVisible();
  }
  const input = page.locator('textarea[data-template-id="metrics-pipeline"]');
  await input.fill('CSV draft');
  await page.getByRole('button', { name: lang === 'ru' ? 'Спросить наставника о данных' : 'Ask the tutor about the data', exact: true }).click();
  await page.getByRole('button', { name: lang === 'ru' ? 'Спросить нейросеть' : 'Ask the AI', exact: true }).first().click();
  const preview = page.locator('.external-preview');
  await expect(preview).toHaveValue(/metrics-pipeline(?:-en)?\.csv/);
  await expect(preview).toHaveValue(/opp_id,account_id,snapshot_date/);
  await expect(preview).toHaveValue(/CSV draft/);
  await expect(preview).not.toHaveValue(/DevOps Trainer/);
});
