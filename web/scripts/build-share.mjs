// Share pages: one static URL per profession, course, block and help page, so a
// link posted to a messenger shows that page's own title, text and picture
// instead of the platform's front page. The app itself routes by '#/...'
// fragments, which messengers never send, so each share page carries the
// preview tags and forwards the reader to the route in the right language.
//
// Run against a built app served by `npm run preview`:
//   npm run build && npm run preview &   then   npm run build:share
// The pages and pictures land in public/s/ (Russian) and public/en/s/ (English)
// and are committed, so the cluster build ships them as they are.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.SHARE_BASE ?? 'http://localhost:4173';
const SITE = 'https://damn.academy';
const OUT = new URL('../public/', import.meta.url).pathname;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = s.replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…'; };
const slugOf = (route) => route.replace(/^#\//, '').replace(/\//g, '-') || 'home';

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const routes = new Set(['#/professions', '#/courses', '#/local-lab', '#/about']);

async function open(page, route) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
}
async function links(page, prefix) {
  return page.$$eval(`a[href^="${prefix}"]`, (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
}

// Discover the routes from the app itself, in Russian.
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 840 } });
  await ctx.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
  const page = await ctx.newPage();
  await open(page, '#/professions');
  for (const h of await links(page, '#/profession/')) routes.add(h);
  await open(page, '#/courses');
  for (const h of await links(page, '#/course/')) routes.add(h);
  for (const r of [...routes].filter((r) => r.startsWith('#/profession/') || r.startsWith('#/course/'))) {
    await open(page, r);
    for (const h of await links(page, '#/block/')) if (!h.endsWith('/placement')) routes.add(h);
  }
  await open(page, '#/about');
  for (const h of await links(page, '#/about/')) routes.add(h);
  await ctx.close();
}

rmSync(join(OUT, 's'), { recursive: true, force: true });
rmSync(join(OUT, 'en/s'), { recursive: true, force: true });
const index = [];
for (const lang of ['ru', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 840 }, deviceScaleFactor: 0.75 });
  // Previews are shot in the platform's dark theme, its usual face.
  await ctx.addInitScript((l) => { localStorage.setItem('dt.lang', l); localStorage.setItem('dt.theme', 'dark'); }, lang);
  const page = await ctx.newPage();
  for (const route of [...routes].sort()) {
    await open(page, route);
    const info = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const h1 = main.querySelector('h1')?.textContent?.trim() ?? '';
      const paras = [...main.querySelectorAll('p')].map((p) => p.textContent.trim()).filter((t) => t.length > 40);
      return { h1, text: paras[0] ?? '', title: document.title };
    });
    if (!info.h1) { console.warn('skip (no heading)', lang, route); continue; }
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.feedback-fab,[data-feedback],.toast{display:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const slug = slugOf(route);
    const dir = join(OUT, lang === 'ru' ? 's' : 'en/s', slug);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, 'og.jpg'), type: 'jpeg', quality: 84 });
    const path = `${lang === 'ru' ? '' : '/en'}/s/${slug}/`;
    const title = `${info.h1} — damn.academy`;
    const desc = clip(info.text || info.title, 200);
    const img = `${SITE}${path}og.jpg`;
    writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="damn.academy">
<meta property="og:title" content="${esc(info.h1)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'ru' ? 'ru_RU' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<meta name="robots" content="noindex, follow">
<script>try{localStorage.setItem('dt.lang','${lang}')}catch(e){}location.replace('/${route}')</script>
<meta http-equiv="refresh" content="1;url=/${route}">
</head>
<body><p><a href="/${route}">${esc(info.h1)}</a></p></body>
</html>
`);
    index.push(`${lang}\t${SITE}${path}\t${info.h1}`);
    console.log(lang, path, '·', info.h1);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 's', 'index.tsv'), index.join('\n') + '\n');
