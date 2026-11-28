import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const blocks=['marketing','sales','product','metrics','events','oss','strategy','finance','pr','aicontent','scithink'];
// Read the actual lesson inventory, including every table and long formula in the business shelf.
const lessons = blocks.flatMap(block => readdirSync(resolve('src/blocks', block)).filter(f=>f.endsWith('.ru.md')).flatMap(file => {
  const text=readFileSync(resolve('src/blocks',block,file),'utf8');
  return [...text.matchAll(/<!-- lesson: ([^ |]+)[^>]*-->([\s\S]*?)(?=<!-- lesson:|$)/g)]
    .filter(m=>/^\s*\|.*\|/m.test(m[2]) || /`[^`\n]{100,}`/.test(m[2]))
    .map(m=>({id:m[1],tables:(m[2].match(/^\|\s*:?-{3,}[^\n]*$/gm)??[]).length}));
}));
for(const width of [1440,1365,390]) test(`business lesson tables and formulas at ${width}px`,async({page})=>{
  test.setTimeout(240000);
  await page.addInitScript(()=>localStorage.setItem('dt.lang','ru'));
  await page.setViewportSize({width,height:1000});
  expect(lessons.length).toBeGreaterThan(10);
  for(const lesson of lessons) {
    await page.goto(`/#/lesson/${lesson.id}`);
    await expect(page.locator('main h1')).toBeVisible();
    const regions=page.locator('.md-table-scroll');
    if(lesson.tables) await expect(regions,lesson.id).toHaveCount(lesson.tables);
    for(const region of await regions.all()) {
      await expect(region).toHaveAttribute('tabindex','0');
      await expect(region).toHaveAttribute('aria-label',/./);
      expect(await region.locator('thead th[scope=col]').count()).toBeGreaterThan(0);
      await region.focus(); await expect(region).toBeFocused();
      const size=await region.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
      if(size.scroll>size.width) { await region.press('ArrowRight'); await expect.poll(()=>region.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0); }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth),lesson.id).toBe(width);
    for(const code of await page.locator('.prose :not(pre) > code').all())
      expect(await code.evaluate(el=>getComputedStyle(el).whiteSpace),lesson.id).toBe('normal');
    if(['strategy.event-offer','events.portfolio','metrics.contract'].includes(lesson.id))
      await page.screenshot({path:`/tmp/business-wave2-${lesson.id}-${width}.png`,fullPage:true});
  }
});
test('mentor previews the current draft and downloads edits when copying is denied',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('dt.lang','ru'); Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))}});});
  await page.goto('/#/lesson/aicontent.brief');
  const draft=page.locator('.task-document textarea');
  await expect(draft).toHaveValue(/## Входные файлы/);
  await draft.fill('Наш черновик: сравнить два редактора за неделю.'); await page.reload();
  await expect(draft).toHaveValue('Наш черновик: сравнить два редактора за неделю.');
  await page.locator('.tutor-launch').click(); await page.locator('.tutor .external-help').click();
  const preview=page.locator('.external-preview'); await expect(preview).toHaveValue(/Наш черновик/); await expect(preview).toHaveValue(/Задание и критерии/);
  await expect(preview).not.toHaveValue(/Ответа на задание у меня пока нет/); await preview.fill('Проверить этот черновик.');
  // execCommand may provide the browser fallback even when Clipboard API is denied.
  await page.evaluate(()=>{document.execCommand=()=>false;});
  await page.getByRole('button',{name:'Скопировать запрос',exact:true}).click();
  await expect(page.locator('.external-dialog [role=status]')).toContainText('скачайте файл');
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать запрос (.txt)',exact:true}).click();
  const file=await download; expect(file.suggestedFilename()).toBe('aicontent.brief.prompt.txt');
  expect(readFileSync((await file.path())!,'utf8')).toBe('Проверить этот черновик.');
});
