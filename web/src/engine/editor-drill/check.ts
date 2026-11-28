// The check of a drill compares the resulting state with the target: text,
// cursor, the named registers and the head of the kill ring. The keys are
// never compared (a different correct way passes); the only exception is a
// drill marked `noArrows`, which fails when an arrow key was used.

import { bi } from '../../core/i18n';
import type { Cursor, Drill, DrillMismatch, DrillState, DrillVerdict } from './types';

const pos = (c: Cursor) => `${c.line + 1}:${c.ch + 1}`;
/** Quote a register or kill for a message: newlines and tabs made visible. */
export const shown = (s: string) => JSON.stringify(s);

export function checkDrill(drill: Drill, state: DrillState, opts: { usedArrows?: boolean } = {}): DrillVerdict {
  const m: DrillMismatch[] = [];
  const t = drill.target;
  if (state.text !== t.text) {
    const a = state.text.split('\n');
    const b = t.text.split('\n');
    let line = 0;
    while (line < Math.max(a.length, b.length) && a[line] === b[line]) line++;
    m.push({
      field: 'text',
      message: bi(`Текст расходится с целью в строке ${line + 1}: сейчас ${shown(a[line] ?? '')}, нужно ${shown(b[line] ?? '')}.`, `The text differs from the goal on line ${line + 1}: now ${shown(a[line] ?? '')}, needed ${shown(b[line] ?? '')}.`),
    });
  }
  if (t.cursor && (state.cursor.line !== t.cursor.line || state.cursor.ch !== t.cursor.ch)) {
    m.push({ field: 'cursor', message: bi(`Курсор стоит на ${pos(state.cursor)} (строка:колонка), а нужно ${pos(t.cursor)}.`, `The cursor is at ${pos(state.cursor)} (line:column), the goal is ${pos(t.cursor)}.`) });
  }
  for (const [name, want] of Object.entries(t.registers ?? {})) {
    const got = state.registers[name] ?? '';
    if (got !== want) m.push({ field: 'register', message: bi(`В регистре ${name} лежит ${shown(got)}, а нужно ${shown(want)}.`, `Register ${name} holds ${shown(got)}, the goal is ${shown(want)}.`) });
  }
  if (t.killRing) {
    const got = state.killRing.slice(0, t.killRing.length);
    if (got.length !== t.killRing.length || got.some((s, i) => s !== t.killRing![i])) {
      m.push({ field: 'killRing', message: bi(`Кольцо удалений сверху: ${got.map(shown).join(', ') || 'пусто'}; нужно ${t.killRing.map(shown).join(', ')}.`, `The kill ring from the newest: ${got.map(shown).join(', ') || 'empty'}; the goal is ${t.killRing.map(shown).join(', ')}.`) });
    }
  }
  if (drill.noArrows && opts.usedArrows) {
    m.push({ field: 'arrows', message: bi('В этом упражнении стрелки не в счёт: пройдите его клавишами редактора.', 'Arrows do not count in this drill: do it with the editor’s own keys.') });
  }
  return { ok: m.length === 0, mismatches: m };
}

/** Feedback on the number of keys, never a pass condition. */
export function budgetNote(used: number, best: number) {
  if (used === best) return bi(`Нажатий: ${used}, как в эталоне.`, `Keys: ${used}, as in the reference.`);
  if (used < best) return bi(`Нажатий: ${used}, короче эталона (${best}).`, `Keys: ${used}, shorter than the reference (${best}).`);
  return bi(`Нажатий: ${used}, в эталоне ${best}. Задача решена; короче тоже можно.`, `Keys: ${used}, the reference takes ${best}. Solved; a shorter way exists.`);
}
