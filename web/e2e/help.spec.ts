// The «?» help of the top bar and the local lab page in a real browser: the
// panel opens from the keyboard, closes on Esc and from its button, works at
// phone width, and its link leads to #/local-lab.

import { expect, test } from '@playwright/test';
import { open, watchErrors } from './helpers';

test.describe('help panel and local lab page', () => {
  test('the help opens and closes from the keyboard and links to the lab page', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '#/');
    await page.locator('.lang-switch button', { hasText: 'RU' }).click();
    const btn = page.locator('.help-btn');
    await expect(btn).toBeVisible();
    await btn.focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('dialog.help-dialog');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toHaveText('Справка');
    await expect(panel).toContainText('без логина и пароля');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(btn).toBeFocused();

    await btn.click();
    await panel.locator('.help-close').click();
    await expect(panel).toHaveCount(0);

    await btn.click();
    await panel.locator('a[href="#/local-lab"]').click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/#\/local-lab$/);
    await expect(page.locator('main#main h1')).toHaveText('Лаборатория на своём компьютере');
    await expect(page.locator('#ll-needs tbody tr')).toHaveCount(6);
    await expect(page.locator('details.ll-os[open]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('works at phone width without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '#/local-lab');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('.help-btn').click();
    const panel = page.locator('dialog.help-dialog');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('settings link to the lab page', async ({ page }) => {
    await open(page, '#/settings');
    await page.locator('section[data-id="local-lab"] a[href="#/local-lab"]').click();
    await expect(page.locator('.local-lab')).toBeVisible();
  });
});
