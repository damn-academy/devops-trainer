// Sample drills of the key trainer: six for Vim (M1 grammar of editing, M2
// insert, M5 registers) and four for Emacs (M2 motion, M3 kill ring). They
// show the drill format; the courses will bring their own sets. On
// 28.11.2026 every solution here was replayed in Vim 9.0 (typed keys, `vim
// -s`) and GNU Emacs 28.2 (`emacs -Q --batch`, `execute-kbd-macro`) and gave
// the same text, cursor, registers and kill ring as the trainer, in every
// field its target checks. Known differences are pinned in
// tests/editor-drill.test.ts.

import { bi } from '../../core/i18n';
import type { Drill, DrillStart } from './types';

const at = (text: string, line: number, ch: number): DrillStart => ({ text, cursor: { line, ch } });

export const VIM_DRILLS: Drill[] = [
  {
    id: 'vim.d2w',
    engine: 'cm-vim',
    title: bi('Оператор и движение', 'Operator and motion'),
    task: bi('Удалите повтор «very very», чтобы осталось «it is slow». Курсор уже на первом «very».', 'Delete the repeated “very very” so that “it is slow” remains. The cursor is on the first “very”.'),
    start: at('it is very very slow', 0, 6),
    target: { text: 'it is slow', cursor: { line: 0, ch: 6 } },
    solution: 'd2w',
    explain: bi('Оператор d с движением 2w: счётчик, оператор и движение складываются в одну команду.', 'The d operator with the 2w motion: a count, an operator and a motion make one command.'),
  },
  {
    id: 'vim.ci-quote',
    engine: 'cm-vim',
    title: bi('Текстовый объект', 'Text object'),
    task: bi('Замените всё, что внутри кавычек, на new и вернитесь в нормальный режим.', 'Replace everything inside the quotes with new and return to Normal mode.'),
    start: at('name = "old value"', 0, 10),
    target: { text: 'name = "new"', cursor: { line: 0, ch: 10 } },
    solution: 'ci"new<Esc>',
    explain: bi('i" — объект «внутри кавычек»: курсору не нужно стоять на его начале.', 'i" is the “inside quotes” object: the cursor need not be at its start.'),
  },
  {
    id: 'vim.dot',
    engine: 'cm-vim',
    title: bi('Повтор точкой', 'The dot repeat'),
    task: bi('Допишите точку с запятой в конец каждой из трёх строк. Без стрелок.', 'Add a semicolon to the end of each of the three lines. No arrows.'),
    start: at('a = 1\nb = 2\nc = 3', 0, 0),
    target: { text: 'a = 1;\nb = 2;\nc = 3;', cursor: { line: 2, ch: 5 } },
    solution: 'A;<Esc>j.j.',
    noArrows: true,
    explain: bi('Точка повторяет последнее изменение целиком, вместе с A и выходом из вставки.', 'The dot repeats the whole last change, A and leaving Insert mode included.'),
  },
  {
    id: 'vim.register',
    engine: 'cm-vim',
    title: bi('Именованный регистр', 'A named register'),
    task: bi('Скопируйте первую строку в регистр a и вставьте её из этого регистра после последней строки.', 'Copy the first line into register a and put it from that register after the last line.'),
    start: at('header\nbody\nfooter', 0, 0),
    target: { text: 'header\nbody\nfooter\nheader', cursor: { line: 3, ch: 0 }, registers: { a: 'header\n' } },
    solution: '"ayyjj"ap',
    explain: bi('"a перед командой выбирает регистр; построчный регистр вставляется отдельной строкой.', '"a before a command picks the register; a linewise register is put as a line of its own.'),
  },
  {
    id: 'vim.macro',
    engine: 'cm-vim',
    title: bi('Макрос', 'A macro'),
    task: bi('Сделайте из первых трёх строк список: «- » в начале каждой. Запишите правку первой строки в макрос и проиграйте его на двух следующих.', 'Turn the first three lines into a list: “- ” at the start of each. Record the edit of the first line as a macro and play it on the next two.'),
    // A fourth line on purpose: on the last line the trainer's j jumps to the
    // end of the line, real Vim's j fails and stays (see the test file).
    start: at('alpha\nbeta\ngamma\n# end', 0, 0),
    target: { text: '- alpha\n- beta\n- gamma\n# end', cursor: { line: 3, ch: 1 } },
    solution: 'qaI- <Esc>jq2@a',
    explain: bi('Макрос — это нажатия в регистре; j в конце готовит следующую строку к следующему проигрыванию.', 'A macro is keys in a register; the j at the end readies the next line for the next run.'),
  },
  {
    id: 'vim.block',
    engine: 'cm-vim',
    title: bi('Визуальный блок', 'Visual block'),
    task: bi('Закомментируйте три строки: «# » в начале каждой, одной вставкой в блок.', 'Comment out the three lines: “# ” at the start of each, with one block insert.'),
    start: at('one\ntwo\nthree', 0, 0),
    // Text only: after the block insert real Vim leaves the cursor on the
    // first "#" (1:1), the trainer one column to the right (1:2).
    target: { text: '# one\n# two\n# three' },
    solution: '<C-v>jjI# <Esc>',
    explain: bi('Ctrl-V выделяет столбец; I вставляет текст перед блоком на всех его строках после Esc.', 'Ctrl-V selects a column; I inserts text before the block on all its lines once you press Esc.'),
  },
];

export const EMACS_DRILLS: Drill[] = [
  {
    id: 'emacs.words',
    engine: 'cm-emacs',
    title: bi('Движение по словам', 'Moving by words'),
    task: bi('Поставьте курсор в начало слова third, двигаясь по словам.', 'Put the cursor at the start of the word third, moving by words.'),
    start: at('first second third fourth', 0, 0),
    target: { text: 'first second third fourth', cursor: { line: 0, ch: 13 } },
    solution: 'M-f M-f M-f M-b',
    explain: bi('M-f встаёт в конец слова, M-b — в начало: поэтому к началу третьего слова удобнее прийти сзади.', 'M-f stops at the end of a word, M-b at its start: so the start of the third word is easier reached from behind.'),
  },
  {
    id: 'emacs.kill-yank',
    engine: 'cm-emacs',
    title: bi('Удаление и вставка', 'Kill and yank'),
    task: bi('Поменяйте строки местами: первая должна оказаться второй.', 'Swap the lines: the first one must become the second.'),
    start: at('second\nfirst\n', 0, 0),
    target: { text: 'first\nsecond\n', cursor: { line: 2, ch: 0 }, killRing: ['second\n'] },
    solution: 'C-k C-k C-n C-y',
    explain: bi('Два C-k подряд складываются в одну запись кольца: строка вместе с переводом строки.', 'Two C-k in a row add up to one kill-ring entry: the line with its newline.'),
  },
  {
    id: 'emacs.yank-pop',
    engine: 'cm-emacs',
    title: bi('Кольцо удалений', 'The kill ring'),
    task: bi('Удалите текст всех трёх строк по отдельности, а потом верните только первую строку, перебирая кольцо удалений.', 'Kill the text of each of the three lines separately, then bring back only the first one by cycling the kill ring.'),
    start: at('one\ntwo\nthree\n', 0, 0),
    target: { text: 'one\n', cursor: { line: 0, ch: 3 }, killRing: ['three', 'two', 'one'] },
    solution: 'C-k C-d C-k C-d C-k C-y M-y M-y',
    explain: bi('C-y вставляет последнее удалённое, каждый M-y сразу после него заменяет вставку на запись постарше.', 'C-y yanks the latest kill; each M-y right after it replaces the yank with an older entry.'),
  },
  {
    id: 'emacs.transpose',
    engine: 'cm-emacs',
    title: bi('Перестановка', 'Transpose'),
    task: bi('Исправьте опечатку в teh и поменяйте местами quick и brown.', 'Fix the typo in teh and swap quick and brown.'),
    start: at('teh quick brown fox', 0, 0),
    target: { text: 'the brown quick fox', cursor: { line: 0, ch: 15 } },
    solution: 'C-f C-f C-t M-f M-t',
    explain: bi('C-t меняет две буквы у курсора, M-t — два слова; курсор остаётся за переставленным.', 'C-t swaps the two characters at the cursor, M-t two words; the cursor ends after what was moved.'),
  },
];

export const DRILLS: Drill[] = [...VIM_DRILLS, ...EMACS_DRILLS];

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
