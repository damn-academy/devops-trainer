import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
 await page.addInitScript(()=>localStorage.setItem('dt.lang','ru'));
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for(const [name,route] of [['course','course/finance'],['safe','lesson/finance.safe'],['taxes','lesson/finance.taxes-federal']]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(`http://127.0.0.1:4173/#/${route}`);
  await page.waitForSelector(name==='course'?'.course-module':'.finance-trainer');
  await page.evaluate(()=>document.fonts.ready);
  if(name!=='course') {
   const height=await page.locator('.finance-trainer').evaluate(el=>Math.ceil(el.getBoundingClientRect().height)+180);
   await page.setViewportSize({width,height});
   await page.locator('.finance-trainer').scrollIntoViewIfNeeded();
  }
  if(name==='course') await page.screenshot({path:`/tmp/fin-${name}-${width}.png`,fullPage:true});
  else await page.screenshot({path:`/tmp/fin-${name}-${width}.png`});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) throw new Error(`${route} overflows at ${width}`);
  console.log(`${width} ${route}: screenshot, no page overflow`);
 }
 if(errors.length) throw new Error(errors.join('\n'));
 await page.close();
}
await browser.close();
