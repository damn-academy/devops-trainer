#!/usr/bin/env node
// Heuristic scan of Russian learner-facing strings for telegraphic style (see STYLE-RU.md).
// Usage: node scripts/lint-ru-style.mjs <block> [<block>...]   (prints file:line and the flagged sentence)
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const blocks = process.argv.slice(2);
const STR = /(?:\bbi|\bb|\bW)\(\s*'((?:[^'\\]|\\.)*)'/g;
const CALQUE = /(^|[^а-яё])(ед[её]т|везёт|везут|живёт|живут|поднять|поднимает|убить|убивает|умер|погиб|теряет|просто|именно|буквально|по сути|честно)(?=[^а-яё]|$)/i;
let total = 0;
for (const b of blocks) {
  for (const f of globSync(`src/blocks/${b}/**/*.ts`)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(STR)) {
      const s = m[1];
      if (!/[а-яё]/i.test(s)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      for (const sent of s.replace(/\\n/g, ' ').split(/(?<=[.!?])\s+/)) {
        const words = sent.split(/\s+/).length;
        const why = [];
        if (/^(Да|Нет|Верно|Неверно|Ошибка|Остановится|Пройдёт)\s*[:—–-]/.test(sent)) why.push('answer-colon');
        else if (/[а-яё»)]\s*:\s+[а-яё`«]/i.test(sent) && words < 14 && !/:\s*$/.test(sent)) why.push('colon');
        if (/\s—\s/.test(sent) && words < 10) why.push('dash');
        if (CALQUE.test(sent)) why.push('calque');
        if (why.length) { total++; console.log(`${f}:${line} [${why.join(',')}] ${sent.slice(0, 200)}`); }
      }
    }
  }
}
console.error(`flagged: ${total}`);
