#!/usr/bin/env node
// Smoke check of a deployed course in headless Chromium, one browser at a time:
// home page, a lesson explainer, a simulated terminal goal, a real-Linux v86
// lab booted from the snapshot, the in-tab cloud lab, and a feedback report
// stored by the service and visible in the admin UI.
//
//   DT_URL=https://damn.academy ADMIN_TOKEN=... node scripts/smoke-public.mjs
import { chromium, expect } from '@playwright/test';

const base = (process.env.DT_URL ?? 'https://damn.academy').replace(/\/$/, '') + '/';
const token = process.env.ADMIN_TOKEN;
const results = [];
const browser = await chromium.launch({ headless: true });

async function step(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  try {
    await fn(page, context);
    const bad = errors.filter((e) => !/favicon/.test(e));
    results.push({ name, ok: bad.length === 0, ms: Date.now() - t0, errors: bad.slice(0, 5) });
  } catch (e) {
    await page.screenshot({ path: `smoke-${name}.png` }).catch(() => {});
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(e.message ?? e).split('\n').slice(0, 4).join(' '), errors: errors.slice(0, 5) });
  } finally {
    await context.close();
  }
}

const open = async (page, route) => {
  await page.goto(base + route);
  await expect(page.locator('main#main')).not.toBeEmpty();
};

await step('home', async (page) => {
  await open(page, '#/');
  await expect(page.locator('ol.route > li').first()).toBeVisible();
  if (!(await page.evaluate(() => self.crossOriginIsolated))) throw new Error('page is not cross-origin isolated');
});

await step('explainer', async (page) => {
  await open(page, '#/explainer/linux.pipe');
  const counter = page.locator('.ex-counter').first();
  const before = await counter.innerText();
  await page.locator('.ex-buttons button[aria-label]').nth(3).click();
  await expect(counter).not.toHaveText(before);
});

await step('sim-terminal', async (page) => {
  await open(page, '#/lesson/linux.terminal');
  const lab = page.locator('.lab').first();
  await lab.scrollIntoViewIfNeeded();
  const term = lab.locator('.xterm').first();
  await term.click();
  await page.keyboard.type('date', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(lab.locator('li.goal[data-task="date"]')).toHaveClass(/done/);
});

await step('v86-real-linux', async (page) => {
  await open(page, '#/lesson/linux.install');
  const lab = page.locator('.rl-lab').first();
  await lab.scrollIntoViewIfNeeded();
  const start = lab.locator('.v86-offer button.btn.primary');
  if (await start.isVisible().catch(() => false)) await start.click();
  const t0 = Date.now();
  await expect(lab.locator('.v86-status')).toContainText(/new 10\.0\.0\.11/, { timeout: 240_000 });
  console.log(`v86: ready ${Date.now() - t0} ms after start; status: ${(await lab.locator('.v86-status').innerText()).slice(0, 200)}`);
  const goal = lab.locator('li.goal[data-task="gpt"]');
  await goal.locator('button.chip.cmd').click();
  await page.keyboard.press('Enter');
  await expect(goal).toHaveClass(/done/, { timeout: 90_000 });
});

await step('cloud-lab', async (page) => {
  await open(page, '#/lesson/iac.cloud-api');
  const lab = page.locator('.lab.cl').first();
  await lab.scrollIntoViewIfNeeded();
  const start = lab.getByRole('button', { name: /Start the lab|Запустить лабораторию/ });
  if (await start.isVisible().catch(() => false)) await start.click();
  const goal = lab.locator('li.goal[data-task="public"]');
  const chip = goal.locator('button.chip.cmd');
  const t0 = Date.now();
  // The chip types only once the workstation is ready; retry until it lands.
  await expect(async () => {
    await chip.click();
    await page.keyboard.press('Enter');
    await expect(goal).toHaveClass(/done/, { timeout: 8_000 });
  }).toPass({ timeout: 240_000, intervals: [5_000] });
  console.log(`cloud lab: first goal ${Date.now() - t0} ms after start`);
});

const marker = `smoke ${new Date().toISOString()}`;
await step('feedback', async (page) => {
  await open(page, '#/lesson/linux.terminal');
  await page.locator('.feedback-launch').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea').fill(`Deployment smoke check, please ignore. ${marker}`);
  const sent = page.waitForResponse((r) => r.url().includes('/api/feedback') && r.request().method() === 'POST');
  await dialog.locator('textarea').press('Control+Enter');
  const response = await sent;
  if (!response.ok()) throw new Error(`POST /api/feedback answered ${response.status()}`);
  await expect(page.locator('.feedback-status')).toContainText(/sent|отправлено/);
});

if (token) {
  await step('admin', async (page, context) => {
    await context.setExtraHTTPHeaders({ Authorization: 'Bearer ' + token });
    await page.goto(base + 'admin?type=report');
    await expect(page.locator('body')).toContainText(marker);
  });
}

await browser.close();
for (const r of results) console.log(JSON.stringify(r));
process.exit(results.every((r) => r.ok) ? 0 : 1);
