import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { open, runInTerminal } from './helpers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru')); });

test('lab feedback stores the exact preview, transcript and facts in the development receiver', async ({ page }) => {
  await open(page, '#/lesson/linux.terminal');
  const lab = page.locator('.lab').first();
  await runInTerminal(page, lab, 'echo feedback-probe');
  await expect.poll(() => lab.locator('.xterm-rows').innerText()).toContain('feedback-probe');
  await page.locator('.feedback-launch').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('select[name=category]').selectOption('crash');
  await dialog.locator('textarea').fill('Среда упала после команды. Проверка обратной связи.');
  await expect(dialog.locator('button[type=submit]')).toBeEnabled();
  const preview = JSON.parse(await dialog.locator('pre').innerText());
  expect(preview.attachments.transcript).toContain('echo feedback-probe');
  expect(JSON.stringify(preview.attachments.environment)).toContain('dt.facts/v1');
  if (process.env.FEEDBACK_SCREENSHOTS) {
    await mkdir(process.env.FEEDBACK_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: resolve(process.env.FEEDBACK_SCREENSHOTS,'form.png') });
  }
  const response = page.waitForResponse(r => r.url().endsWith('/api/feedback') && r.request().method() === 'POST');
  await dialog.locator('button[type=submit]').click(); expect((await response).status()).toBe(200);
  const reports = (await readFile(resolve('.feedback/reports.jsonl'),'utf8')).trim().split('\n').map(line => JSON.parse(line));
  expect(reports.find(r => r.id === preview.id)).toEqual(preview);
});

test('offline report survives a page reload and is sent on reconnect', async ({ page, context }) => {
  await open(page, '#/lesson/linux.terminal');
  await page.locator('.feedback-launch').click(); const dialog = page.getByRole('dialog');
  await dialog.locator('textarea').fill('Offline report'); await expect(dialog.locator('button[type=submit]')).toBeEnabled();
  const id = JSON.parse(await dialog.locator('pre').innerText()).id;
  await context.setOffline(true); await dialog.locator('button[type=submit]').click();
  await expect(page.locator('.feedback-status')).toContainText('сохранено');
  await context.setOffline(false); await page.reload();
  await expect.poll(async () => {
    const rows = await readFile(resolve('.feedback/reports.jsonl'),'utf8').catch(()=>'');return rows.includes(id);
  }, { timeout: 40000 }).toBe(true);
});
