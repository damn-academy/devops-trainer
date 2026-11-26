// Run from web/: node scripts/audit-task-clarity.mjs before|after
// Evidence is local and gitignored. No lab machines or external AI are started.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const phase = process.argv[2] ?? 'after';
if (!/^[a-z-]+$/.test(phase)) throw new Error('Use a simple phase name');
const out = path.resolve('task-clarity-audit', phase);
await mkdir(out, { recursive: true });
// Optional lesson ids refresh only those lessons in an existing evidence set.
const selected = new Set(process.argv.slice(3));
const records = selected.size
  ? JSON.parse(await readFile(path.join(out, 'sections.json'), 'utf8')).filter(r => !selected.has(r.lesson))
  : [];
const server = await createServer({
  configLoader: 'runner', cacheDir: '.cache/task-clarity-vite',
  server: { hmr: false, fs: { allow: [process.cwd(), await realpath('node_modules')] }, host: '127.0.0.1', port: 6199, strictPort: true },
});
await server.listen();
let browser;
const errors = [];
async function newPage() {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push({ url: page.url(), error: error.message }));
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
  await page.goto('http://127.0.0.1:6199/');
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  return page;
}
async function capture(page, el, metadata) {
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(30);
  const filename = `${metadata.lesson}--${metadata.id}--${metadata.level}--${metadata.width}.png`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const record = {
    ...metadata, text: await el.innerText(),
    controls: await el.locator('button,input,textarea,select,a').evaluateAll(els => els.map(e => ({
      tag: e.tagName, text: e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '',
      label: e.labels ? [...e.labels].map(l => l.innerText).join(' ') : '',
      type: e.getAttribute('type'), disabled: e.disabled ?? false, href: e.getAttribute('href'),
      visible: !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden',
    }))), screenshot: filename,
  };
  try { await el.screenshot({ path: path.join(out, filename), timeout: 10000, animations: 'disabled' }); }
  catch (error) { record.error = String(error); }
  records.push(record);
}
try {
  browser = await chromium.launch();
  const page = await newPage();
  const inventory = await page.evaluate(async () => {
    const { loadRegistry } = await import('/src/core/registry.ts');
    const r = await loadRegistry();
    return {
      blocks: r.orderedBlocks(true).map(b => ({ id: b.id, hidden: !!b.hidden, placement: b.placement.length, levels: [...new Set(b.placement.map(p => p.level))] })),
      lessons: r.orderedLessons().map(l => ({ id: l.id, title: l.title.ru, block: l.block,
        sections: l.sections.map(s => ({ id: s.id, kind: s.kind, step: s.step, widget: s.widget ?? s.explainer, props: s.props, levels: s.levels })) })),
    };
  });
  for (const id of selected) if (!inventory.lessons.some(l => l.id === id)) throw new Error(`Unknown lesson: ${id}`);
  await writeFile(path.join(out, 'inventory.json'), JSON.stringify(inventory, null, 2));
  await page.close();
  const jobs = [1280, 390].flatMap(width => inventory.lessons.filter(l => !selected.size || selected.has(l.id)).map(lesson => ({ width, lesson })));
  await Promise.all(Array.from({ length: 4 }, async () => {
    const page = await newPage();
    while (jobs.length) {
      const { width, lesson } = jobs.shift();
      await page.setViewportSize({ width, height: 900 });
      // Cover every section, including those shown only at a higher level.
      const levels = ['beginner', ...new Set(lesson.sections.filter(s => s.levels && !s.levels.includes('beginner')).map(s => s.levels[0]))];
      for (const level of levels) {
        await page.evaluate(async ({ block, level }) => {
          const { store } = await import('/src/core/store.ts');
          store.record({ kind: 'level.set', block, level, via: 'choice' });
        }, { block: lesson.block, level });
        await page.evaluate(() => { location.hash = '/'; });
        await page.waitForFunction(() => !document.querySelector('article.lesson'));
        await page.evaluate(id => { location.hash = `/lesson/${id}`; }, lesson.id);
        await page.waitForFunction(title => document.querySelector('.lesson-head h1')?.textContent === title, lesson.title);
        for (const section of lesson.sections) {
          if (section.levels && !section.levels.includes(level)) continue;
          if (level !== 'beginner' && (!section.levels || section.levels.includes('beginner'))) continue;
          const el = page.locator(`[id="s-${section.id}"]`);
          if (!await el.count()) { records.push({ lesson: lesson.id, ...section, level, width, error: 'Section not rendered' }); continue; }
          // Include prose too: authored tasks can live in text or callouts.
          await capture(page, el, { lesson: lesson.id, block: lesson.block, ...section, level, width });
        }
        console.log(`${phase} ${width} ${lesson.id} ${level}`);
      }
    }
    await page.close();
  }));
  // Placement tasks use the same renderers but a different submission flow.
  const placement = await newPage();
  for (const width of [1280, 390]) for (const block of inventory.blocks.filter(b => !selected.size && b.placement)) {
    for (const [index, level] of block.levels.entries()) {
      await placement.setViewportSize({ width, height: 900 });
      await placement.goto(`http://127.0.0.1:6199/#/block/${block.id}/placement`, { waitUntil: 'domcontentloaded' });
      await placement.locator('.level-card').nth(index).click();
      let task = 0;
      while (await placement.locator('.pl-host').count()) {
        await capture(placement, placement.locator('.placement'), { lesson: `placement.${block.id}`, block: block.id, id: `task-${++task}`, kind: 'placement', level, width });
        await placement.getByRole('button', { name: 'Пропустить', exact: true }).click();
        if (task > block.placement) throw new Error(`Placement loop: ${block.id}`);
      }
    }
  }
  await placement.close();
  const captured = new Set(records.map(r => `${r.lesson}/${r.id}/${r.width}`));
  for (const lesson of inventory.lessons) for (const section of lesson.sections) for (const width of [1280, 390]) {
    const key = `${lesson.id}/${section.id}/${width}`;
    if (!captured.has(key)) throw new Error(`Missing capture: ${key}`);
  }
} finally {
  records.sort((a, b) => `${a.lesson}/${a.id}/${a.level}/${a.width}`.localeCompare(`${b.lesson}/${b.id}/${b.level}/${b.width}`));
  await writeFile(path.join(out, 'sections.json'), JSON.stringify(records, null, 2));
  await writeFile(path.join(out, 'errors.json'), JSON.stringify(errors, null, 2));
  await browser?.close();
  await server.close();
}
if (errors.length || records.some(r => r.error)) process.exitCode = 1;
