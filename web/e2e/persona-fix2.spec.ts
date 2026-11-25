import { test, expect } from '@playwright/test';

test('second persona pass: models, templates, language mirrors and saved work', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'en'));
  for (const [lesson, selector] of [
    ['marketing.regions', '.sfu-root'], ['sales.touches', '.sfu-root'],
    ['sales.fundamentals', '#s-principles'], ['sales.roles', '#s-principles'],
    ['sales.segments', '#s-principles'], ['sales.regions', '#s-principles'],
    ['sales.asymmetry', '#s-principles'],
    ['sales.d100-tracking', '.course-trainer'], ['events.local', '.course-trainer'],
    ['product.signals', '.course-trainer'], ['pr.analysts', '.course-trainer'],
    ['pr.press', '.course-trainer'], ['pr.founder', '.course-trainer'],
    ['marketing.search-llm', '.course-trainer'], ['sales.d100-signals', '.course-trainer'],
    ['marketing.content', '.quiz-item'],
  ]) {
    await page.goto(`/#/lesson/${lesson}`);
    const el = page.locator(selector).first(); await expect(el).toBeVisible();
    if (lesson === 'marketing.content') await expect(page.locator('.q-answer-type').first()).toBeVisible();
    if (lesson === 'marketing.regions') await expect(el).toContainText('Content uses the same budget as outbound');
    if (lesson === 'sales.touches') {
      await el.locator('input').nth(1).fill('8');
      await expect(el).toContainText('Negative replies'); await expect(el).toContainText('Unsubscribes');
    }
    const link = el.locator('a[download]');
    if (await link.count()) {
      const response = await page.request.get((await link.getAttribute('href'))!);
      expect(response.ok()).toBe(true); expect((await response.body()).length).toBeGreaterThan(1000);
    }
    await page.addStyleTag({ content: '.top { position:static!important }' });
    await el.screenshot({ path: `/tmp/fix2-${lesson}-en.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/#/lesson/marketing.paid');
  const budget = page.locator('.mkt-budget input[type=range]').first();
  await budget.fill('0'); await page.reload(); await expect(budget).toHaveValue('0');
  await page.locator('.mkt-budget').screenshot({ path: '/tmp/fix2-marketing-budget-persist.png' });
  await page.goto('/#/lesson/sales.d100-signals');
  const trainer = page.locator('.course-trainer').first();
  await trainer.getByRole('button', {name:'Signal',exact:true}).click();
  await trainer.locator('textarea').fill('Check the source before contacting the account');
  await trainer.getByRole('button', {name:'Reveal answer',exact:true}).click();
  await page.reload(); await expect(trainer.locator('textarea')).toHaveValue('Check the source before contacting the account');
  await expect(trainer.locator('textarea')).toBeDisabled();
  await trainer.getByRole('button', {name:'Next',exact:true}).click();
  await page.reload(); await expect(trainer).toContainText('2/20');
  await trainer.screenshot({path:'/tmp/fix2-sales-signals-persist.png'});
  await page.goto('/#/lesson/sales.d100-us');
  const draft = page.locator('.course-trainer textarea').first();
  await draft.fill('A saved sales draft'); await page.reload(); await expect(draft).toHaveValue('A saved sales draft');
  await page.goto('/#/lesson/marketing.sim-quarter');
  await expect(page.locator('.lesson-nav a').last()).toHaveAttribute('href','#/courses');
  await page.locator('.lesson-nav').screenshot({path:'/tmp/fix2-marketing-course-back.png'});
  for (const lesson of ['events.labs','events.cfp','events.no-booth','oss.why','pr.crisis','product.opencore','product.gtm','product.discovery','product.pricing','product.roadmap','scithink.story','scithink.correlation','scithink.control','scithink.bayes','scithink.calibration','scithink.fakes','scithink.numbers','scithink.forecasts','scithink.final','strategy.category','strategy.ecosystem','strategy.agents','sales.d100-presence']) {
    await page.goto(`/#/lesson/${lesson}`);
    await expect(page.locator('article.lesson')).toBeVisible();
    await page.screenshot({path:`/tmp/fix2-${lesson}-en.png`,fullPage:true});
  }
});

for (const lang of ['ru', 'en']) test(`mobile models and templates: ${lang}`, async ({ page }) => {
  await page.addInitScript(lang => localStorage.setItem('dt.lang', lang), lang);
  await page.setViewportSize({ width:390,height:900 });
  for (const lesson of ['marketing.regions','sales.touches','marketing.content','sales.d100-tracking','events.local','pr.press']) {
    await page.goto(`/#/lesson/${lesson}`);
    await expect(page.locator('article.lesson')).toBeVisible();
    const el = page.locator(lesson === 'marketing.content' ? '.quiz-item' : ['marketing.regions','sales.touches'].includes(lesson) ? '.sfu-root' : '.course-trainer').first();
    await expect(el).toBeVisible();
    await page.addStyleTag({content:'.top { position:static!important }'});
    await el.screenshot({path:`/tmp/fix2-${lesson}-${lang}-390.png`});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
