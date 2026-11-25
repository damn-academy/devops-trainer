import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const errors = [];
try {
 const page = await browser.newPage();
 page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const [name, route] of [['catalog','courses'],['course','course/events'],['roi','lesson/events.map'],['sim','lesson/events.no-booth']]) {
   await page.goto(`http://127.0.0.1:4173/#/${route}`);
   await page.locator('h1').waitFor();
   if (route.startsWith('lesson')) await page.locator('section[data-kind="widget"] > *').first().waitFor();
   await page.evaluate(() => document.fonts.ready);
   const bounds = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, widgets: [...document.querySelectorAll('section[data-kind="widget"]')].map(el => { const r=el.getBoundingClientRect(); return {width:r.width,left:r.left,right:r.right,overflow:el.scrollWidth>el.clientWidth+1}; }) }));
   assert.equal(bounds.overflow,false,`${name}/${width}`);
   for (const b of bounds.widgets) assert.ok(b.width<=760 && b.left>=0 && b.right<=width && !b.overflow,JSON.stringify(b));
   await page.screenshot({path:`/tmp/wire-events-${name}-${width}.png`,fullPage:true});
   console.log(name,width,JSON.stringify(bounds));
  }
 }
 assert.deepEqual(errors,[]);
} finally { await browser.close(); }
