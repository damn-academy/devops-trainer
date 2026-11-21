#!/usr/bin/env node
// Heuristic scan of Russian learner-facing strings for telegraphic style (see STYLE-RU.md).
// Usage: node scripts/lint-ru-style.mjs <block> [<block>...]   (prints file:line and the flagged sentence)
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const blocks = process.argv.slice(2);
const STR = /(?:\bbi|\bb|\bW)\(\s*'((?:[^'\\]|\\.)*)'/g;
const CALQUE = /(^|[^а-яё])(ед[её]т|везёт|везут|живёт|живут|поднять|поднимает|убить|убивает|умер|погиб|теряет|просто|именно|буквально|по сути|честно)(?=[^а-яё]|$)/i;
export function lintRuStyle(text) {
  if (!/[а-яё]/i.test(text)) return [];
  const findings = [];
  for (const sentence of text.replace(/\\n/g, ' ').split(/(?<=[.!?])\s+/)) {
    const words = sentence.split(/\s+/).length;
    const rules = [];
    if (/^(Да|Нет|Верно|Неверно|Ошибка|Остановится|Пройдёт)\s*[:—–-]/.test(sentence)) rules.push('answer-colon');
    else if (/[а-яё»)]\s*:\s+[а-яё`«]/i.test(sentence) && words < 14 && !/:\s*$/.test(sentence)) rules.push('colon');
    if (/\s—\s/.test(sentence) && words < 10) rules.push('dash');
    if (CALQUE.test(sentence)) rules.push('calque');
    if (rules.length) findings.push({ sentence, rules });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let total = 0;
  for (const b of blocks) {
    for (const f of globSync(`src/blocks/${b}/**/*.ts`)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(STR)) {
        const s = m[1];
        if (!/[а-яё]/i.test(s)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        for (const { sentence, rules } of lintRuStyle(s)) {
          total++; console.log(`${f}:${line} [${rules.join(',')}] ${sentence.slice(0, 200)}`);
        }
      }
    }
  }
  console.error(`flagged: ${total}`);
}
