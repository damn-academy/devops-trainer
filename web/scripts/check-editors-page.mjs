// The demo page #/lab/editors in headless Chromium, as a learner uses it:
// keys typed into the terminal (xterm), goals turning green on the editor's
// state while the editor stays open. Run it on a build host:
//
//   node scripts/check-editors-page.mjs
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser;
const log = (o) => console.log(JSON.stringify(o));
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  page.on('pageerror', (e) => console.error(e));
  const t0 = Date.now();
  await page.goto(`${server.resolvedUrls.local[0]}#/lab/editors`);
  const start = page.locator('.ed-lab .v86-offer button.btn.primary');
  // Headless Chromium may not report enough memory for an autostart: press Start when it is offered.
  if (await start.waitFor({ timeout: 15000 }).then(() => true, () => false)) await start.click();
  // "Check" is enabled once the machine is up and its start state is saved.
  await page.locator('.ed-lab .rl-actions button:first-child:not([disabled])').waitFor({ timeout: 180000 });
  await page.locator('.ed-lab .xterm').waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  log({ step: 'ready', ms: Date.now() - t0 });
  const term = page.locator('.ed-lab .xterm-helper-textarea');
  const type = async (s, wait = 300) => { await term.focus(); await page.keyboard.type(s, { delay: 40 }); await page.waitForTimeout(wait); };
  const press = async (k, wait = 300) => { await term.focus(); await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const done = (id, timeout = 60000) => page.locator(`.ed-lab li.goal.done[data-task="${id}"]`).waitFor({ timeout }).then(() => true, () => false);
  const modeLine = () => page.locator('.ed-mode').textContent();

  const layoutShown = () => page.locator('.ed-layout').isVisible();
  const hideLayout = async () => { if (await layoutShown()) await page.locator('.ed-layout button').click(); };
  log({ step: 'exit.idle', exit: await page.locator('.ed-exit').textContent() });
  // (a)
  await type('vim /srv/train/app.conf\n', 6000);
  log({ step: 'exit.vim', exit: await page.locator('.ed-exit').textContent() });
  // Layout: Russian text in Insert mode is fine; Russian letters in Normal mode get a notice.
  await type('Oпривет', 300);
  await press('Escape', 2500);
  const falseAlarm = await layoutShown();
  await type('u', 1500);
  await type('цц', 2500);
  log({ step: 'layout.vim', insertModeAlarm: falseAlarm, normalModeNotice: await layoutShown(), text: await page.locator('.ed-layout span').textContent() });
  await hideLayout();
  await type('/debug\n');
  await type('cwrelease');
  await press('Escape');
  log({ step: 'vim.mode', mode: await modeLine() });
  let t = Date.now();
  await type(':w\n');
  log({ step: 'vim-word', done: await done('vim-word'), ms: Date.now() - t });
  // (b), without leaving Vim
  await type(':e /srv/train/list.txt\n', 1500);
  await type('qaA;');
  await press('Escape');
  await type('jq', 1500);
  log({ step: 'vim.recorded', mode: await modeLine() });
  t = Date.now();
  await type('3@a');
  log({ step: 'vim-macro', done: await done('vim-macro'), ms: Date.now() - t });
  // The key panel: Esc from the panel, then quit.
  await page.locator('.ed-key', { hasText: 'Esc' }).first().click();
  await type(':qa!\n', 2000);
  // (c)
  await type('emacs /srv/train/notes.txt\n', 12000);
  log({ step: 'exit.emacs', exit: await page.locator('.ed-exit').textContent() });
  await hideLayout();
  await press('Escape');
  await type('ч', 800);
  const emacsNotice = await layoutShown();
  await press('Control+g', 500);
  await hideLayout();
  log({ step: 'layout.emacs', chordNotice: emacsNotice });
  await press('Control+n');
  await press('Control+a');
  await press('Control+k');
  await press('Control+k', 800);
  await press('Escape');
  await type('>', 500);
  await press('Control+y');
  await press('Control+y', 500);
  t = Date.now();
  log({ step: 'emacs-yank', done: await done('emacs-yank'), ms: Date.now() - t, mode: await modeLine() });
  log({ step: 'goals', done: await page.locator('.ed-lab li.goal.done').count(), status: (await page.locator('.ed-lab .lab-status').textContent())?.trim() });
  const shot = process.env.SHOT;
  if (shot) await page.screenshot({ path: shot, fullPage: true });
} finally {
  await browser?.close();
  await server.close();
}
