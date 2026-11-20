import { expect, test } from '@playwright/test';
import { open, watchErrors } from './helpers';

test('first step, labelled controls and phone diagram fit', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '#/block/orient');
  await page.locator('.explainer-list a').first().click();
  const ex = page.locator('.explainer').first();
  await expect(ex.locator('.ex-counter')).toContainText('Шаг 1 /');
  const start = ex.getByRole('button', { name: 'Начать с первого шага' });
  if (await start.isVisible()) await start.click();
  await expect(ex.locator('.ex-counter')).toContainText('Шаг 1 /');
  await expect(ex.getByRole('button', { name: 'Шаг вперёд', exact: true })).toContainText('Шаг вперёд');
  await ex.getByRole('button', { name: 'Шаг вперёд', exact: true }).click();
  await expect(ex.locator('.ex-counter')).toContainText('Шаг 2 /');
  expect(await ex.locator('.ex-canvas').evaluate(e => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
  expect(errors).toEqual([]);
});

test('order quizzes can be submitted without a confidence mark', async ({ page }) => {
  await open(page, '#/lesson/orient.inside');
  const order = page.locator('.quiz-item[data-kind="order"]').first();
  await expect(order).toBeVisible();
  await expect(order.getByRole('button', { name: /Проверить|Check/ })).toBeEnabled();
  await order.getByRole('button', { name: /Проверить|Check/ }).click();
  await expect(order.locator('.q-feedback')).not.toBeEmpty();
});
