import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';
it('recomputes RU and EN workbook identities, hiring, new events and partial receipts', () => {
  const output=execFileSync(process.execPath,['scripts/verify-finance-templates.mjs'],{encoding:'utf8'});
  expect(output).toContain('RU: formulas evaluated'); expect(output).toContain('-en: formulas evaluated');
});
