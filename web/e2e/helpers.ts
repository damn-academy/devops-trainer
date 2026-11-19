import { expect, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions of a page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Opens a hash route and waits for the page outlet to render. */
export async function open(page: Page, route: string): Promise<void> {
  await page.goto(`./${route}`);
  await expect(page.locator('main#main')).not.toBeEmpty();
}

/** Types a command line into the first xterm of a container and presses Enter. */
export async function runInTerminal(page: Page, scope: ReturnType<Page['locator']>, line: string): Promise<void> {
  const term = scope.locator('.xterm').first();
  await expect(term).toBeVisible();
  await term.click();
  await page.keyboard.type(line, { delay: 5 });
  await page.keyboard.press('Enter');
}

/** Reads the visible text of the first xterm of a container. */
export async function terminalText(scope: ReturnType<Page['locator']>): Promise<string> {
  return (await scope.locator('.xterm-rows').first().innerText()).replace(/ /g, ' ');
}
