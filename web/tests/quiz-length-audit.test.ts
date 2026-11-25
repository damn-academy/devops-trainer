import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { registry } from '../src/core/registry';
import type { QText } from '../src/core/types';

const plain = (v: QText, lang: 'ru' | 'en'): string => typeof v === 'string' ? v : 'ru' in v ? v[lang] : JSON.stringify(v);
it('audits the unique-longest-option shortcut across course question banks', () => {
  const lines = ['# Смещение длины вариантов ответа', '', 'Метод: один самый длинный вариант по числу Unicode-символов после удаления Markdown-разметки и нормализации пробелов. Совпадение максимальной длины не считается однозначной подсказкой. Для multi выбор одного варианта проходит только при единственном правильном варианте. В знаменатель входят mcq, multi и predict-output с вариантами; сортировки, сопоставления и свободный ввод исключены. Это уязвимость формы задания, не оценка знаний ученика. Проверены RU и EN; исходные варианты не изменялись.', ''];
  const all = new Map(registry.quiz);
  for (const lesson of registry.lessons.values()) for (const section of lesson.sections) {
    if (section.kind === 'quiz') for (const q of section.items) if (typeof q !== 'string') all.set(q.id, q);
  }
  const qs = [...all.values()];
  for (const block of registry.orderedBlocks(true)) {
    const bank = qs.filter(q => q.id.startsWith(block.id + '.'));
    lines.push(`## ${block.id}`, '');
    for (const lang of ['ru','en'] as const) {
      const eligible = bank.filter(q => q.kind === 'mcq' || q.kind === 'multi' || (q.kind === 'predict-output' && q.options?.length));
      const hits: string[] = []; let ties = 0;
      for (const q of eligible) {
        if (!('options' in q) || !q.options?.length) continue;
        const lengths = q.options.map(o => [...plain(o.text,lang).replace(/\[\[([^\]]+)\]\]/g, (_, ref: string) => ref.split('|').at(-1)!).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g,'').replace(/\s+/g,' ').trim()].length);
        const max = Math.max(...lengths), indices = lengths.flatMap((n,i) => n === max ? [i] : []);
        if (indices.length !== 1) { ties++; continue; }
        const i = indices[0];
        if (q.options[i].correct && q.options.filter(o => o.correct).length === 1) hits.push(`- \`${q.id}\` → \`${q.options[i].id}\` (${lengths.join(' / ')} символов): ${q.prompt[lang].replace(/\n/g,' ')}`);
      }
      lines.push(`### ${lang.toUpperCase()}: ${hits.length}/${eligible.length}; равных максимумов: ${ties}`, '', ...hits, ...(hits.length ? [] : ['Совпадений нет.']), '');
    }
  }
  expect(qs.length).toBeGreaterThan(100);
  if (process.env.QUIZ_LENGTH_REPORT) writeFileSync(process.env.QUIZ_LENGTH_REPORT, lines.join('\n'));
});
