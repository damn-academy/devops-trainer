// The demo of the editors platform (page #/lab/editors): three goals judged
// by what the editors hold in memory, not by the keys typed. Kept as data so
// the checks are unit-tested against facts recorded from the real editors.

import { bi } from '../../core/i18n';
import type { Task } from '../../core/types';
import type { EditorLabProps } from './editor-keys';

const APP = '/srv/train/app.conf';
const LIST = '/srv/train/list.txt';
const NOTES = '/srv/train/notes.txt';

export const EDITOR_DEMO_TASKS: Task[] = [
  {
    id: 'vim-word',
    prompt: bi(
      `Откройте \`${APP}\` в Vim, замените слово \`debug\` на \`release\` и сохраните файл, не выходя из редактора.`,
      `Open \`${APP}\` in Vim, change the word \`debug\` to \`release\` and save the file without leaving the editor.`,
    ),
    chips: `vim ${APP}`,
    hints: {
      H1: bi('Курсор ставится на слово поиском `/debug`, а команда `cw` заменяет слово до его конца.', 'Put the cursor on the word with `/debug`; `cw` changes the word up to its end.'),
      H2: bi('После `cw` наберите `release`, нажмите Esc и выполните `:w`.', 'After `cw` type `release`, press Esc and run `:w`.'),
    },
    check: {
      when: `vim.buffers[file='${APP}'].text ~ 'mode = release' && vim.buffers[file='${APP}'].modified = false && files['${APP}'].text ~ 'mode = release'`,
      fail: [
        { if: `vim.running && !vim.instrumented`, say: bi('Vim запущен без системных плагинов (например, `vim -u NONE`), поэтому буфер редактора не виден. Запустите `vim ' + APP + '`.', 'Vim runs without system plugins (for example, `vim -u NONE`), so its buffer is not visible. Start `vim ' + APP + '`.') },
        { if: `!vim.running && files['${APP}'].text ~ 'mode = release'`, say: bi('Файл изменён, но Vim уже закрыт, а эта цель проверяет буфер открытого редактора. Откройте файл снова.', 'The file is changed, but Vim is closed, and this goal checks the buffer of the open editor. Open the file again.') },
        { if: `vim.buffers[file='${APP}'].modified = true`, say: bi('Буфер изменён, но не сохранён: выполните `:w` и не выходите из Vim.', 'The buffer is changed but not saved: run `:w` and stay in Vim.') },
      ],
    },
    solutionTokens: ['cw'],
  },
  {
    id: 'vim-macro',
    prompt: bi(
      `Откройте \`${LIST}\`, запишите в регистр \`a\` макрос, который добавляет \`;\` в конец строки и переходит на следующую, и примените его так, чтобы точка с запятой стояла в конце всех четырёх строк.`,
      `Open \`${LIST}\`, record into register \`a\` a macro that appends \`;\` to the line and moves to the next one, then apply it so that all four lines end with a semicolon.`,
    ),
    chips: `vim ${LIST}`,
    hints: {
      H1: bi('Запись в регистр начинается с `qa` и заканчивается нажатием `q`; `@a` выполняет макрос, а `3@a` выполняет его три раза.', 'Recording into a register starts with `qa` and ends with `q`; `@a` runs the macro, `3@a` runs it three times.'),
      H2: bi('Внутри записи: `A;`, Esc и `j`.', 'Inside the recording: `A;`, Esc and `j`.'),
    },
    check: {
      when: `vim.reg.a ~ ';' && vim.recording = '' && vim.buffers[file='${LIST}'].text = 'alpha;\nbeta;\ngamma;\ndelta;'`,
      fail: [
        { if: `vim.recording != ''`, say: bi('Запись макроса ещё идёт: нажмите `q`, чтобы её закончить.', 'The macro is still being recorded: press `q` to stop.') },
        { if: `vim.running && !vim.instrumented`, say: bi('Vim запущен без системных плагинов, поэтому регистры не видны. Запустите `vim ' + LIST + '`.', 'Vim runs without system plugins, so its registers are not visible. Start `vim ' + LIST + '`.') },
        { if: `vim.reg.a ~ ';' && vim.buffers[file='${LIST}'].text ~ ';;'`, say: bi('В одной из строк две точки с запятой: верните буфер командой `u` и примените макрос по одному разу к каждой строке.', 'One line has two semicolons: undo with `u` and apply the macro once per line.') },
        { if: `vim.reg.a ~ ';'`, say: bi('Макрос в регистре `a` есть; примените его ко всем строкам, например `3@a` после первой.', 'Register `a` holds the macro; apply it to every line, for example `3@a` after the first.') },
        { if: `vim.running && !(vim.reg.a)`, say: bi('В регистре `a` пусто: начните запись с `qa`.', 'Register `a` is empty: start recording with `qa`.') },
      ],
    },
    solutionTokens: ['qa', '@a'],
  },
  {
    id: 'emacs-yank',
    prompt: bi(
      `Откройте \`${NOTES}\` в Emacs, удалите строку \`beta\` целиком в кольцо удалений и вставьте её дважды в конец буфера, чтобы получилось \`alpha\`, \`gamma\`, \`beta\`, \`beta\`.`,
      `Open \`${NOTES}\` in Emacs, kill the whole line \`beta\` into the kill ring and yank it twice at the end of the buffer, so it reads \`alpha\`, \`gamma\`, \`beta\`, \`beta\`.`,
    ),
    chips: `emacs ${NOTES}`,
    hints: {
      H1: bi('`C-k` в начале строки удаляет её текст, второй `C-k` удаляет перевод строки и дописывает его в тот же элемент кольца.', '`C-k` at the start of a line kills its text; a second `C-k` kills the newline and appends it to the same kill.'),
      H2: bi('`M->` переносит точку в конец буфера, а `C-y` вставляет последний удалённый текст.', '`M->` moves point to the end of the buffer, and `C-y` yanks the last killed text.'),
    },
    check: {
      when: `emacs.buffers[file='${NOTES}'].text = 'alpha\ngamma\nbeta\nbeta\n' && emacs.killhead = 'beta\n'`,
      fail: [
        { if: `emacs.running && !emacs.instrumented`, say: bi('Emacs запущен без файла `site-start.el` (например, `emacs -Q`), поэтому кольцо удалений не видно. Запустите `emacs ' + NOTES + '`.', 'Emacs runs without `site-start.el` (for example, `emacs -Q`), so the kill ring is not visible. Start `emacs ' + NOTES + '`.') },
        { if: `emacs.killhead = 'beta'`, say: bi('В кольце удалений строка без перевода строки: удалите строку двумя `C-k` подряд или командой `C-S-<backspace>`.', 'The kill ring holds the line without its newline: kill it with two `C-k` in a row or with `C-S-<backspace>`.') },
        { if: `emacs.killhead = 'beta\n'`, say: bi('Строка в кольце удалений; теперь `M->` и дважды `C-y`.', 'The line is in the kill ring; now `M->` and `C-y` twice.') },
      ],
    },
    solutionTokens: ['C-k', 'C-y'],
  },
];

export const EDITOR_DEMO: EditorLabProps = {
  intro: bi(
    '### Редакторы в настоящем Linux\n\nДемонстрация платформы курсов по Vim и Emacs. Цели проверяются по состоянию редактора, то есть по буферам, регистрам и кольцу удалений, которые редактор держит в памяти, а не по нажатым клавишам. Проверка идёт сама, пока редактор открыт.',
    '### Editors on real Linux\n\nA demo of the platform of the Vim and Emacs courses. Goals are checked by the editor’s state, that is, by the buffers, registers and kill ring the editor holds in memory, not by the keys pressed. Checks run by themselves while the editor is open.',
  ),
  editors: ['vim', 'emacs'],
  tasks: EDITOR_DEMO_TASKS,
  rows: 22,
};
