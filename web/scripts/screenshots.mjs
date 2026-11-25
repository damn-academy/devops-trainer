// Screenshots of the home page, a lesson and the flagship explainers at
// desktop (1440) and phone (390) width, light and dark, Russian and English.
// Needs a running dev server: npm run dev -- --port 5288 (or BASE=...).
//   node scripts/screenshots.mjs [filter]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5288/';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
const filter = process.argv[2];

/** name → [route, element to capture: a selector, 'full' for the whole page, null for the viewport] */
const SHOTS = [
  ['marketing-budget', '#/lesson/marketing.paid', '.mkt-budget'],
  ['home', '#/', null],
  ['lesson', '#/lesson/linux.permissions', null],
  ['url-typing', '#/explainer/net.url', 'full'],
  ['osi-envelopes', '#/explainer/net.envelopes', 'full'],
  ['internet-map', '#/explainer/net.map', 'full'],
  ['vm-vs-container', '#/explainer/containers.stack', 'full'],
  ['six-boundaries', '#/explainer/containers.boundaries', 'full'],
  ['image-packing', '#/explainer/containers.image-pack', 'full'],
  ['k8s-from-blocks', '#/lesson/k8s-1.architecture', 'section.lsec[data-kind="widget"]'],
  ['reconcile-loop', '#/explainer/k8s.reconcile', 'full'],
  ['k8s-networking', '#/explainer/k8s.pod-network', 'full'],
  ['kanban-board', '#/lesson/methodology.board', '.flowlab'],
  ['orient-request', '#/explainer/orient.request', 'full'],
  ['orient-rent', '#/explainer/orient.rent', 'full'],
  ['cicd-k8s-deploy', '#/explainer/cicd.k8s-deploy', 'full'],
  ['k8s-netpol', '#/explainer/k8s.netpol', 'full'],
  ['iac-var-precedence', '#/explainer/iac.var-precedence', 'full'],
  ['cluster-from-code', '#/explainer/k8s-3.from-code', 'full'],
  ['gitops-loop', '#/explainer/k8s-3.gitops-loop', 'full'],
  ['log-path', '#/explainer/obs.log-path', 'full'],
  ['network-exam', '#/exam/networks.exam.office', null],
];

/** Actions before a shot, so the picture shows the thing working. */
const BEFORE = {
  'k8s-from-blocks': async (page) => {
    const b = page.getByRole('button', { name: /Собрать всё правильно|Assemble everything/ });
    if (await b.count()) await b.first().click();
  },
  'kanban-board': async (page) => {
    const b = page.locator('.flowlab button.fl-end').first();
    for (let i = 0; i < 3 && (await b.count()); i++) await b.click();
  },
};

const VIEWS = [
  ['desktop', { width: 1440, height: 1000 }],
  ['phone', { width: 390, height: 844 }],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
for (const [view, viewport] of VIEWS) {
  for (const theme of ['light', 'dark']) {
    for (const lang of ['ru', 'en']) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: view === 'phone' ? 2 : 1, colorScheme: theme, reducedMotion: 'reduce' });
      await ctx.addInitScript(([th, lg]) => {
        localStorage.setItem('dt.theme', th);
        localStorage.setItem('dt.lang', lg);
      }, [theme, lang]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => problems.push(`${view}/${theme}/${lang}: ${e.message}`));
      for (const [name, route, sel] of SHOTS) {
        if (filter && !name.includes(filter)) continue;
        if (lang === 'en' && !['home', 'lesson', 'url-typing', 'kanban-board', 'k8s-from-blocks', 'orient-request', 'cluster-from-code'].includes(name)) continue;
        await page.goto(BASE + route);
        await page.waitForTimeout(700);
        await page.addStyleTag({ content: '.top { position: static !important; } .tutor-launch, .feedback-launch { display: none !important; }' });
        if (BEFORE[name]) await BEFORE[name](page);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (sw > 0) problems.push(`${name} ${view}/${theme}: horizontal scroll ${sw}px`);
        const file = `${OUT}${name}-${view}-${theme}${lang === 'en' ? '-en' : ''}.png`;
        if (sel === 'full') await page.screenshot({ path: file, fullPage: true });
        else if (sel) {
          const el = page.locator(sel).first();
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await el.screenshot({ path: file });
        } else await page.screenshot({ path: file });
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no horizontal scroll, no page errors');
