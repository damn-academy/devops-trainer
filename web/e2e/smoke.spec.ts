// End-to-end smoke tests: the whole app in a real browser, one scenario per
// pillar. They run against the Vite dev server (see playwright.config.ts).

import { expect, test } from '@playwright/test';
import { open, runInTerminal, terminalText, watchErrors } from './helpers';

const BLOCKS = ['orient', 'methodology', 'linux', 'git-yaml', 'networks', 'containers', 'cicd', 'k8s-1', 'cicd-k8s', 'k8s-2', 'iac', 'k8s-3', 'monitoring', 'final', 'career', 'pet-projects'];

test.describe('shell', () => {
  test('home shows public business courses in order and keeps the profession route separate in RU/EN', async ({ page }) => {
    const errors = watchErrors(page);
    const courses = ['marketing', 'sales', 'product', 'events', 'oss', 'strategy', 'pr', 'scithink'];
    await open(page, '#/');
    for (const language of ['ru', 'en']) {
      await page.locator('.lang-switch button', { hasText: language.toUpperCase() }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('header .brand')).toHaveText('damn.academy');
      await expect(page.locator('.hero h1')).toHaveText('damn.academy');
      await expect(page.locator('.catalog-shelf .catalog-tile')).toHaveCount(courses.length);
      expect(await page.locator('.catalog-shelf .catalog-tile').evaluateAll(els => els.map(el => el.getAttribute('href'))))
        .toEqual(courses.map(id => `#/course/${id}`));
      await page.locator('.catalog-tile[href="#/profession/devops"]').click();
      await expect(page.locator('ol.route > li')).toHaveCount(BLOCKS.length);
      const order = await page.locator('ol.route > li').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.block));
      expect(order).toEqual(BLOCKS);
      for (const course of courses) expect(order).not.toContain(course);
      await expect(page.locator('.route-title')).toHaveText(language === 'ru' ? 'Программа' : 'Syllabus');
      await page.locator('header .brand').click();
    }
    expect(errors).toEqual([]);
  });

  test('home paints from the manifest; profession content and its lessons load on navigation', async ({ page }) => {
    const errors = watchErrors(page);
    const blockFiles: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/src/blocks/')) blockFiles.push(r.url());
    });
    await open(page, '#/');
    await expect(page.locator('.catalog-shelf .catalog-tile')).toHaveCount(8);
    await page.waitForLoadState('networkidle');
    expect(blockFiles).toEqual([]);
    await page.locator('.catalog-tile[href="#/profession/devops"]').click();
    await expect(page.locator('ol.route > li')).toHaveCount(BLOCKS.length);

    await page.locator('ol.route > li[data-block="linux"] h2 a').click();
    await page.locator('ol.lesson-list li a').first().click();
    await expect(page.locator('main#main .lesson-body')).toBeVisible();
    expect(blockFiles.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('theme toggle switches light and dark', async ({ page }) => {
    await open(page, '#/');
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: 'Theme' }).click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    expect(['light', 'dark']).toContain(after);
  });
});

test.describe('every block', () => {
  for (const id of BLOCKS) {
    test(`${id}: block page and its first lesson open`, async ({ page }) => {
      const errors = watchErrors(page);
      await open(page, `#/block/${id}`);
      await expect(page.locator('.block-head h1')).toBeVisible();
      const first = page.locator('ol.lesson-list li a').first();
      await expect(first).toBeVisible();
      const title = (await first.innerText()).trim();
      await first.click();
      await expect(page.locator('article.lesson h1')).toHaveText(title);
      await expect(page.locator('.lesson-body > *').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test('terminal: a command runs and the task check passes', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, '#/lesson/linux.terminal');
  const lab = page.locator('.lab').first();
  await runInTerminal(page, lab, 'date');
  await expect(lab.locator('li.goal[data-task="date"]')).toHaveClass(/done/);
  await runInTerminal(page, lab, 'whoami');
  await expect(lab.locator('li.goal[data-task="whoami"]')).toHaveClass(/done/);
  expect(await terminalText(lab)).toContain('learner');
  expect(errors).toEqual([]);
});

test('explainer: step forward, change a parameter, break a component', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, '#/explainer/linux.pipe');
  const counter = page.locator('.ex-counter').first();
  const before = await counter.innerText();
  await page.locator('.ex-buttons button[aria-label]').nth(3).click();
  await expect(counter).not.toHaveText(before);

  // Change the first knob; a knob with a prediction asks "what will happen?" first.
  const knob = page.locator('.ex-knobs .knob').first();
  await knob.locator('input[type=range]').focus();
  await page.keyboard.press('ArrowRight');
  const options = page.locator('.ex-predict .ex-predict-opts button.option');
  await expect(options.first().or(page.locator('.ex-delta:not([hidden])'))).toBeVisible();
  if (await options.count()) await options.first().click();
  await expect(page.locator('.ex-delta:not([hidden])')).toBeVisible();
  await expect(page.locator('.ex-delta p')).not.toBeEmpty();

  // Break: switch the first break toggle, answer its prediction, and the process stops at the break.
  await page.locator('.ex-breaks .break-toggle').first().click();
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(page.locator('.ex-broken:not([hidden])')).toBeVisible();

  // Every node is clickable and explains itself.
  await page.locator('svg.ex-svg .node:not(.st-hidden) .node-shape').first().click();
  await expect(page.locator('.ex-card:not([hidden])')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quiz: answer an item and get feedback', async ({ page }) => {
  await open(page, '#/lesson/linux.terminal');
  const item = page.locator('.quiz-item').first();
  await item.scrollIntoViewIfNeeded();
  const kind = await item.getAttribute('data-kind');
  if (kind === 'mcq' || kind === 'multi') await item.locator('.q-option').first().click();
  else if (kind === 'fill-command') await item.locator('input.q-fill').fill('ls');
  else if (kind === 'order') await item.locator('.q-order button').nth(1).click();
  else if (kind === 'predict-output') await item.locator('.q-option, textarea.q-predict').first().click().then(() => item.locator('textarea.q-predict').fill('x').catch(() => {}));
  else if (kind === 'bugfind') await item.locator('.q-codeline').first().click();
  await item.locator('.q-actions .btn.primary').click();
  await expect(item.locator('.q-result')).toBeVisible();
});

test('kanban: a card moves from the backlog to the next column', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, '#/lesson/methodology.board');
  const board = page.locator('.flowlab').first();
  await board.scrollIntoViewIfNeeded();
  const card = board.locator('.fl-col[data-col="backlog"] .fl-card').first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-card');
  const target = board.locator('.fl-col[data-idx="1"]');
  const col = await target.getAttribute('data-col');
  const a = (await card.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(board.locator(`.fl-col[data-col="${col}"] [data-card="${id}"]`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('kubernetes: kubectl apply creates a pod', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, '#/lesson/k8s-1.first-pod');
  const lab = page.locator('.lab').first();
  await runInTerminal(page, lab, 'kubectl apply -f pod.yaml');
  await expect.poll(() => terminalText(lab)).toContain('pod/web created');
  await expect(async () => {
    await runInTerminal(page, lab, 'kubectl get pods');
    expect(await terminalText(lab)).toMatch(/web\s+1\/1\s+Running/);
  }).toPass({ timeout: 30_000, intervals: [2_000] });
  expect(errors).toEqual([]);
});

test('progress persists after reload', async ({ page }) => {
  await open(page, '#/lesson/linux.terminal');
  const lab = page.locator('.lab').first();
  await runInTerminal(page, lab, 'date');
  await expect(lab.locator('li.goal[data-task="date"]')).toHaveClass(/done/);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('.lab li.goal[data-task="date"]').first()).toHaveClass(/done/);
  await open(page, '#/block/linux');
  await expect(page.locator('ol.lesson-list li').first()).toHaveClass(/st-open|st-done/);
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of ['#/', '#/lesson/linux.terminal', '#/explainer/net.url', '#/explainer/containers.boundaries', '#/lesson/k8s-1.architecture', '#/lesson/methodology.board', '#/lesson/orient.requests', '#/explainer/k8s.netpol', '#/lesson/k8s-3.as-code', '#/exam/networks.exam.office']) {
    test(`no sideways page scroll: ${route}`, async ({ page }) => {
      await open(page, route);
      await page.waitForTimeout(500);
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(extra).toBeLessThanOrEqual(0);
    });
  }
});

test('explainer edge labels do not sit on boxes', async ({ page }) => {
  await open(page, '#/explainer/net.map');
  await expect(page.locator('svg.ex-svg')).toBeVisible();
  await page.waitForTimeout(400);
  const hits = await page.evaluate(() => {
    const svg = document.querySelector('svg.ex-svg')!;
    const boxes = [...svg.querySelectorAll('g.node:not(.shape-bar) .node-shape')].map((n) => (n as SVGGraphicsElement).getBBox());
    let n = 0;
    for (const l of svg.querySelectorAll('text.edge-label')) {
      const b = (l as SVGGraphicsElement).getBBox();
      for (const r of boxes) if (b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y) n++;
    }
    return n;
  });
  expect(hits).toBe(0);
});
