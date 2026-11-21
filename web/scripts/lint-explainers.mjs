#!/usr/bin/env node
// Vitest supplies Vite's import.meta.glob transform and the registry setup.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', 'tests/explainer-lint-report.test.ts', '--maxWorkers=2', '--testTimeout=90000'], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;

if (result.status === 0) {
  const report = JSON.parse(readFileSync(new URL('../explainer-lint-report.json', import.meta.url), 'utf8'));
  console.log('Explainer lint: warnings only; deduplicated across scenarios and levels.');
  const totals = {};
  for (const [folder, block] of Object.entries(report.blocks)) {
    console.log(`${folder}: ${Object.entries(block.counts).map(([key, n]) => `${key}=${n}`).join(', ')} (${block.runs} runs)`);
    for (const [key, n] of Object.entries(block.counts)) totals[key] = (totals[key] ?? 0) + n;
  }
  console.log('Totals:', JSON.stringify(totals));
  console.log('15 worst examples (coverage/runtime first, then reading time, concept order, style; one per surface/language):');
  for (const f of report.worstExamples) {
    console.log(`${f.explainer} / ${f.lesson ?? 'unplaced'} / ${f.path || '(static)'} [${f.language}]: ${f.message}`);
    if (f.text) console.log(`  ${f.text.slice(0, 240)}`);
  }
  console.log('Full report: web/explainer-lint-report.json');
}
