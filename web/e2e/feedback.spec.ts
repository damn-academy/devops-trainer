import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { open, runInTerminal } from './helpers';

const service = process.env.FEEDBACK_SERVICE_URL;
const adminToken = process.env.FEEDBACK_ADMIN_TOKEN ?? 'feedback2-test-token';
test.skip(!service, 'Set FEEDBACK_SERVICE_URL to the local Go receiver.');
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru')); });
async function screenshot(page: Page, name: string) {
  if (!process.env.FEEDBACK_SCREENSHOTS) return;
  await mkdir(process.env.FEEDBACK_SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: resolve(process.env.FEEDBACK_SCREENSHOTS, name + '.png'), fullPage: name === 'messages' });
}
async function saved(page: Page): Promise<Array<{id:string;token:string}>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {const r=indexedDB.open('dt-feedback-threads');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject) => {const r=db.transaction('threads').objectStore('threads').getAll();r.onsuccess=()=>{resolve(r.result);db.close();};r.onerror=()=>reject(r.error);});
  });
}
test('small form, attachments, private thread, admin reply, fixed notice and progress export', async ({ page, request }) => {
  await open(page, '#/lesson/linux.terminal');
  const lab = page.locator('.lab').first();
  await runInTerminal(page, lab, 'echo feedback-probe');
  await expect.poll(() => lab.locator('.xterm-rows').innerText()).toContain('feedback-probe');
  await page.locator('.feedback-launch').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('textarea')).toBeFocused();
  await expect(dialog.locator('details')).not.toHaveAttribute('open');
  await expect(dialog.locator('input:not(.feedback-trap):visible')).toHaveCount(0);
  await dialog.locator('textarea').fill('После команды проверка не завершилась. Посмотрите, пожалуйста.');
  await screenshot(page, 'form');
  await dialog.locator('summary').click();
  await expect(dialog.locator('pre')).toContainText('feedback-probe');
  await expect(dialog.locator('pre')).not.toContainText('followToken');
  const preview = JSON.parse(await dialog.locator('pre').innerText());
  await dialog.locator('textarea').press('Control+Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.feedback-status')).toContainText('отправлено');
  const [entry] = await saved(page);
  expect(entry.token).toMatch(/^[a-f0-9]{64}$/);
  const wrong = await request.get(service + '/api/feedback/' + entry.id + '?token=' + 'f'.repeat(64));
  expect(wrong.status()).toBe(404);
  const csrf = createHash('sha256').update(adminToken + '\0\0csrf').digest('hex');
  const admin = await request.post(service + '/admin', { headers: { Authorization: 'Bearer ' + adminToken }, form: { csrf, id: entry.id, status: 'fixed', fixedBuild: 'feedback2-test', reply: '**Исправили проверку.** Спасибо за подробности.' } });
  expect(admin.ok()).toBe(true);
  await page.locator('.feedback-menu').click();
  await expect(page.locator('.feedback-thread')).toContainText('Исправили проверку.');
  await expect(page.locator('.feedback-thread')).toContainText('исправлено в версии от');
  await expect(page.locator('.feedback-reply strong')).toHaveText('Исправили проверку.');
  await page.getByRole('textbox', { name: 'Добавьте ответ.' }).fill('Спасибо, теперь всё работает.');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.locator('.feedback-reply').last()).toContainText('теперь всё работает');
  await screenshot(page, 'messages');
  await page.goto('./' + preview.context.route);
  await expect(page.locator('.feedback-fixed')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.lesson-body')).toBeVisible();
  await expect(page.locator('.feedback-fixed')).toHaveCount(0);
  await page.goto('./#/settings');
  const download = page.waitForEvent('download');
  await page.locator('.settings').getByRole('button', { name: /Экспорт|Выгрузить|Сохранить прогресс/ }).click();
  const file = await download; const stream = await file.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).feedback[0].token).toBe(entry.token);
});
test('contact form and offline queue survive reload', async ({ page, context }) => {
  await open(page, '#/settings');
  await page.locator('.settings').getByRole('button', { name: 'Написать автору' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('textarea')).toBeFocused();
  await dialog.locator('textarea').fill('Спасибо за курс. Хотелось бы обсудить новый урок.');
  await dialog.locator('input[name=contact]').fill('@course_learner');
  await screenshot(page, 'contact');
  await context.setOffline(true);
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.locator('.feedback-status')).toContainText('сохранено');
  const [entry] = await saved(page);
  await context.setOffline(false); await page.reload();
  await expect(page.locator('.feedback-status')).toContainText('отправлено', { timeout: 40000 });
  await page.locator('.feedback-menu').click();
  await expect(page.locator('.feedback-thread')).toContainText('Письмо автору');
  await expect(page.locator('.feedback-thread-status')).toHaveText('получено');
  expect((await saved(page))[0].token).toBe(entry.token);
});
test.describe('touch', () => {
test.use({ hasTouch: true, isMobile: true });
test('touch form preselects the section and hides per-element buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '#/lesson/linux.terminal');
  const section = page.locator('.lsec').first(); await section.scrollIntoViewIfNeeded();
  await page.locator('.feedback-launch').click();
  await expect(page.getByRole('dialog').getByLabel('О каком месте вы хотите сообщить?')).toBeVisible();
  await expect(page.getByRole('dialog').locator('textarea')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
});
