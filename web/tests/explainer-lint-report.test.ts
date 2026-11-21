import { writeFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { registry } from '../src/core/registry';
import { lintExplainers, worstExplainerFindings } from '../src/core/lint-explainers';

it('reports explainer content warnings without failing the build', () => {
  expect(registry.complete).toBe(true);
  const report = lintExplainers(registry);
  writeFileSync(new URL('../explainer-lint-report.json', import.meta.url), JSON.stringify({ ...report, worstExamples: worstExplainerFindings(report) }, null, 2) + '\n');
  console.warn('Explainer lint (warnings only; counts deduplicated across scenarios/levels):');
  for (const [folder, block] of Object.entries(report.blocks)) {
    console.warn(`${folder}: ${block.explainers.length} explainers, ${block.runs} runs; ${Object.entries(block.counts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  console.warn('15 worst examples (coverage/runtime first, then longest reading time, concept order, style):');
  for (const f of worstExplainerFindings(report)) console.warn(`${f.explainer} / ${f.lesson ?? 'unplaced'} / ${f.path} [${f.language}]: ${f.message}\n  ${f.text.slice(0, 240)}`);
  console.warn('Full report: web/explainer-lint-report.json');
});
