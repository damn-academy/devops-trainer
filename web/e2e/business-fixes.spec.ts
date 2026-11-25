import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dt.lang', 'ru'));
});
for (const width of [1440, 390]) {
  test(`business widgets at ${width}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    for (const [lesson, selector] of [
      ['pr.crisis', '.course-trainer'], ['events.booth', '.course-trainer'],
      ['oss.governance', '.course-trainer'], ['oss.contributors', '.course-trainer'],
      ['oss.why', '.course-trainer'], ['oss.cncf-path', '.deptsim'],
      ['product.opencore', '.poc-root'], ['product.pricing', '.pvm-root'],
      ['product.cases', '.q-match'], ['marketing.paid', '.mkt-budget'],
      ['marketing.search-llm', '.course-trainer'], ['sales.d100-signals', '.course-trainer'],
      ['pr.press', '.task-document'], ['scithink.final', '.task-document'], ['scithink.calibration', '.scb-root'],
      ['scithink.correlation', '.explainer'], ['marketing.events', '.explainer'],
    ]) {
      await page.goto(`/#/lesson/${lesson}`);
      const widget = page.locator(selector).first(); await expect(widget).toBeVisible();
      if (lesson === 'oss.governance') await widget.getByRole('button', { name: 'Сверить правила с репозиторием проекта' }).click();
      if (lesson === 'product.opencore') {
        const input = widget.locator('input').last(); await input.focus(); await input.press('ArrowRight'); await expect(input).toBeFocused();
      }
      if (selector === '.explainer' && width === 390) {
        await expect.poll(() => widget.locator('.ex-svg').evaluate(el => el.getBoundingClientRect().width <= el.parentElement!.clientWidth + 1)).toBe(true);
        await expect.poll(() => widget.locator('.ex-viewport').evaluate(el => el.clientHeight)).toBeGreaterThan(200);
        await expect.poll(() => widget.locator('.ex-viewport').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      }
      if (lesson === 'pr.press') {
        const downloadPromise = page.waitForEvent('download');
        await widget.getByRole('button', { name: 'Download .txt' }).click();
        const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/pr.press.*\.txt$/);
        await download.saveAs(`/tmp/fix-document-${width}.txt`);
      }
      // Avoid capturing the sticky page header over a tall widget.
      await page.addStyleTag({ content: '.top { position:static!important }' });
      await widget.screenshot({ path: `/tmp/fix-${lesson}-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/#/lesson/scithink.correlation');
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 1000 });
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.ex-svg')).toBeVisible();
    await page.goto('/#/lesson/pr.crisis');
    const draft = page.locator('.course-trainer textarea').first(); await draft.fill('Unsent crisis draft');
    await page.reload(); await expect(draft).toHaveValue('Unsent crisis draft');
    await page.goto('/#/lesson/pr.founder'); await page.goto('/#/lesson/pr.crisis'); await expect(draft).toHaveValue('Unsent crisis draft');
    await page.goto('/#/lesson/strategy.agents');
    await page.locator('.tutor-launch').click();
    for (const mode of ['explain','practice','docs','free']) {
      await page.locator(`input[name=tutor-mode][value=${mode}]`).check();
      const question = page.locator('.tutor-input'); await question.fill(mode === 'explain' ? '' : `Question for ${mode}`);
      await page.locator('.tutor .external-help').click();
      const preview = page.locator('.external-preview');
      await expect(preview).not.toHaveValue(/я ошибся/);
      await expect(preview).toHaveValue(/Задание и критерии: .+/);
      if (mode !== 'explain') await expect(preview).toHaveValue(new RegExp(`Question for ${mode}`));
      await page.getByRole('button', { name: 'Копировать', exact: true }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText()); expect(copied).toContain('Задание и критерии:');
      await page.locator('.external-dialog').screenshot({ path: `/tmp/fix-helper-${mode}-${width}.png` });
      await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
    }
    await page.locator('.tutor-head').getByRole('button', { name: /Закрыть/ }).click();
    await page.evaluate(() => window.scrollTo(0, 1400));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
    await page.waitForTimeout(200); await page.reload();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  });
}
