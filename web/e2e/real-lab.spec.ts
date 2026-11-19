import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { open, watchErrors } from './helpers';

// Boots a real Alpine machine (v86, lab-installer profile) headless in the page
// and passes one checked goal of the installation lesson: GPT partitioning of a
// blank disk. Slow (a cold boot is tens of seconds) and needs the lab image in
// public/v86/lab, so it runs only with E2E_V86=1: `npm run test:e2e:v86`.

const image = existsSync(new URL('../public/v86/lab/manifest.json', import.meta.url));

test.describe('@v86 real-Linux lab', () => {
  test.skip(!process.env.E2E_V86, 'set E2E_V86=1 to boot a real lab machine');
  test.skip(!image, 'no lab image: npm run build:lab-image');
  test.setTimeout(300_000);

  test('linux.install: a real machine boots and the GPT goal passes', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '#/lesson/linux.install');
    const lab = page.locator('.rl-lab').first();
    await lab.scrollIntoViewIfNeeded();

    const startBtn = lab.locator('.v86-offer button.btn.primary');
    if (await startBtn.isVisible().catch(() => false)) await startBtn.click();

    const t0 = Date.now();
    await expect(lab.locator('.v86-status')).toContainText(/new 10\.0\.0\.11/, { timeout: 240_000 });
    const bootMs = Date.now() - t0;

    const goal = lab.locator('li.goal[data-task="gpt"]');
    await expect(goal).not.toHaveClass(/done/);
    await goal.locator('button.chip.cmd').click();
    await page.keyboard.press('Enter');
    const t1 = Date.now();
    await expect(goal).toHaveClass(/done/, { timeout: 60_000 });
    console.log(`real lab: ready in ${bootMs} ms, goal checked ${Date.now() - t1} ms after Enter`);

    expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
  });
});
