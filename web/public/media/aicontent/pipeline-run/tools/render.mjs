import { chromium } from '../../../../../node_modules/playwright/index.mjs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const slides = new URL('../slides/', import.meta.url);
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 for (const file of (await readdir(slides)).filter(f=>f.endsWith('.html')).sort()) {
  await page.goto(new URL(file,slides).href);
  await page.evaluate(()=>document.fonts.ready);
  if (await page.evaluate(()=>document.documentElement.scrollHeight>720 || document.documentElement.scrollWidth>1280)) throw new Error(`Overflow: ${file}`);
  await page.screenshot({path:fileURLToPath(new URL(file.replace('.html','.png'),slides))});
  console.log(file);
 }
} finally { await browser.close(); }
