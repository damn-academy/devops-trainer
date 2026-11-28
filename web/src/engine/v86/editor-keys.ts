// The pure parts of the editor terminal (widget `v86.editor`): the keys
// browsers keep for themselves, what the mode line shows, and how much of
// the Keyboard Lock API this browser has. No DOM here, so it is unit-tested.

import { bi, type Bi } from '../../core/i18n';
import type { Task } from '../../core/types';
import { EDITOR_SCOPES, type EditorArea, type EditorFacts, type EditorKind } from './editor-facts';

export interface PanelKey {
  /** What the button says: the key in the editors' own notation. */
  label: string;
  /** The bytes the terminal sends for it. */
  seq: string;
  title: Bi;
}

/**
 * Keys a browser tab may not pass to the page: Ctrl-W closes the tab, Ctrl-N
 * and Ctrl-T open windows and tabs, Esc leaves fullscreen. The panel sends the
 * same bytes the terminal would.
 */
export const PANEL_KEYS: Record<'vim' | 'emacs', PanelKey[]> = {
  vim: [
    { label: 'Esc', seq: '\x1b', title: bi('Вернуться в нормальный режим', 'Back to Normal mode') },
    { label: 'C-[', seq: '\x1b', title: bi('То же, что Esc', 'The same as Esc') },
    { label: 'C-w', seq: '\x17', title: bi('Префикс команд для окон; в режиме вставки стирает слово', 'Window command prefix; in Insert mode deletes a word') },
    { label: 'C-n', seq: '\x0e', title: bi('Следующая строка или следующий вариант дополнения', 'Next line or next completion') },
    { label: 'C-t', seq: '\x14', title: bi('Назад по стеку меток; в режиме вставки добавляет отступ', 'Back in the tag stack; in Insert mode adds an indent') },
    { label: 'C-v', seq: '\x16', title: bi('Визуальный режим блока', 'Visual block mode') },
    { label: 'C-\\ C-n', seq: '\x1c\x0e', title: bi('Выйти из режима терминала в Neovim', 'Leave Terminal mode in Neovim') },
  ],
  emacs: [
    { label: 'M-x', seq: '\x1bx', title: bi('Выполнить команду по имени', 'Run a command by name') },
    { label: 'C-g', seq: '\x07', title: bi('Прервать команду', 'Quit the command') },
    { label: 'C-w', seq: '\x17', title: bi('Вырезать область в кольцо удалений', 'Kill the region into the kill ring') },
    { label: 'C-n', seq: '\x0e', title: bi('Следующая строка', 'Next line') },
    { label: 'C-t', seq: '\x14', title: bi('Поменять местами символы', 'Transpose characters') },
    { label: 'C-SPC', seq: '\x00', title: bi('Поставить метку', 'Set the mark') },
    { label: 'ESC', seq: '\x1b', title: bi('Префикс Meta, если Alt не работает', 'The Meta prefix when Alt does not work') },
  ],
};

/** The panels a lab shows: by the editors it is about, the active one first. */
export function panelsFor(editors: readonly EditorKind[], active: EditorKind | null): ('vim' | 'emacs')[] {
  const want = new Set(editors.map((e) => (e === 'emacs' ? 'emacs' : 'vim') as 'vim' | 'emacs'));
  if (!want.size) want.add('vim');
  const order: ('vim' | 'emacs')[] = active === 'emacs' ? ['emacs', 'vim'] : ['vim', 'emacs'];
  return order.filter((k) => want.has(k));
}

const VIM_MODES: Record<string, Bi> = {
  n: bi('нормальный', 'Normal'),
  i: bi('вставка', 'Insert'),
  R: bi('замена', 'Replace'),
  v: bi('визуальный', 'Visual'),
  V: bi('визуальный построчный', 'Visual Line'),
  '\x16': bi('визуальный блок', 'Visual Block'),
  s: bi('выделение', 'Select'),
  S: bi('выделение строк', 'Select Line'),
  c: bi('командная строка', 'Command-line'),
  r: bi('ожидание ответа', 'waiting for an answer'),
  t: bi('терминал', 'Terminal'),
};

/** The mode line of the editor terminal: mode, macro recording, registers or the kill ring. */
export function statusLine(area: Pick<EditorArea, 'editor' | 'vim' | 'nvim' | 'emacs'> | null): { text: Bi; honest?: Bi } | null {
  if (!area || !area.editor.active) return null;
  const kind = area.editor.active;
  const f: EditorFacts = area[kind];
  const name = kind === 'vim' ? 'Vim' : kind === 'nvim' ? 'Neovim' : 'Emacs';
  if (!f.instrumented || f.source === 'none') {
    return {
      text: bi(`${name} запущен`, `${name} is running`),
      honest: bi(
        `${name} запущен без системных плагинов (например, с ключом ${kind === 'emacs' ? '`-Q`' : '`-u NONE`'}), поэтому состояние редактора недоступно, и тренажёр проверяет только файлы.`,
        `${name} runs without system plugins (for example, with ${kind === 'emacs' ? '`-Q`' : '`-u NONE`'}), so the editor's state is not available, and the trainer checks files only.`,
      ),
    };
  }
  if (kind === 'emacs') {
    const head = typeof f.killhead === 'string' ? short(f.killhead) : '';
    const major = typeof f.major === 'string' ? f.major : '';
    return {
      text: bi(
        `Emacs · ${major}${head ? ` · в начале кольца удалений: «${head}»` : ' · кольцо удалений пусто'}`,
        `Emacs · ${major}${head ? ` · kill ring head: “${head}”` : ' · the kill ring is empty'}`,
      ),
    };
  }
  const mode = typeof f.mode === 'string' ? f.mode : '';
  const m = VIM_MODES[mode] ?? bi(mode, mode);
  const rec = typeof f.recording === 'string' && f.recording ? f.recording : '';
  const regs = f.reg && typeof f.reg === 'object' ? Object.keys(f.reg as Record<string, string>).filter((r) => /^[a-z]$/.test(r)).sort().join('') : '';
  return {
    text: bi(
      `${name} · режим: ${m.ru}${rec ? ` · идёт запись в регистр ${rec}` : ''}${regs ? ` · регистры с текстом: ${regs}` : ''}`,
      `${name} · mode: ${m.en}${rec ? ` · recording into register ${rec}` : ''}${regs ? ` · named registers: ${regs}` : ''}`,
    ),
  };
}

function short(s: string): string {
  const one = s.replace(/\n/g, '⏎');
  return one.length > 24 ? one.slice(0, 23) + '…' : one;
}

/** How to leave the editor in front, shown under the terminal at every step (no hint level hides it). */
export function exitHint(active: EditorKind | null, editors: readonly EditorKind[]): Bi {
  const vim = bi('Выйти из Vim без сохранения: Esc, затем `:q!` и Enter; с сохранением: `:wq`.', 'Leave Vim without saving: Esc, then `:q!` and Enter; with saving: `:wq`.');
  const nvim = bi('Выйти из Neovim без сохранения: Esc, затем `:q!` и Enter; с сохранением: `:wq`.', 'Leave Neovim without saving: Esc, then `:q!` and Enter; with saving: `:wq`.');
  const emacs = bi('Выйти из Emacs: `C-x C-c`; на вопрос о сохранении ответьте `y` или `n`. Отменить начатую команду: `C-g`.', 'Leave Emacs: `C-x C-c`, then answer `y` or `n` to the question about saving. Cancel a command in progress: `C-g`.');
  if (active === 'vim') return vim;
  if (active === 'nvim') return nvim;
  if (active === 'emacs') return emacs;
  const parts = [...new Set(editors)].map((e) => (e === 'emacs' ? emacs : e === 'nvim' ? nvim : vim));
  return bi(parts.map((x) => x.ru).join(' '), parts.map((x) => x.en).join(' '));
}

/** A letter outside ASCII: what a Russian (or another non-Latin) layout sends instead of a command key. */
const NON_LATIN = /[^\x00-\x7f]/u;

/**
 * Emacs takes non-Latin letters as text, so only chords give a wrong layout
 * away: Meta (ESC) or the C-x and C-c prefixes followed by a non-Latin letter
 * (`M-ч` for `M-x`, `C-x л` for `C-x k`). `prev` is the last character of the
 * previous input chunk. Returns the chord, or null.
 */
export function nonLatinChord(prev: string, data: string): string | null {
  const s = [...(prev + data)];
  for (let i = 1; i < s.length; i++) {
    if (!NON_LATIN.test(s[i]) || !/\p{L}/u.test(s[i])) continue;
    const before = s[i - 1];
    if (before === '\x1b') return `M-${s[i]}`;
    if (before === '\x18') return `C-x ${s[i]}`;
    if (before === '\x03') return `C-c ${s[i]}`;
  }
  return null;
}

/** The gentle notice about the layout. */
export function nonLatinNotice(kind: EditorKind, key: string): Bi {
  if (kind === 'emacs')
    return bi(
      `Похоже, включена русская или другая нелатинская раскладка: Emacs получил \`${key}\`, а сочетания клавиш в нём набираются латинскими буквами. Переключите раскладку на английскую и повторите сочетание.`,
      `It looks like a Russian or another non-Latin layout is on: Emacs received \`${key}\`, while its key bindings use Latin letters. Switch the layout to English and repeat the keys.`,
    );
  const name = kind === 'nvim' ? 'Neovim' : 'Vim';
  return bi(
    `Похоже, включена русская или другая нелатинская раскладка: ${name} получил \`${key}\` в нормальном режиме, а команды в нём набираются латинскими буквами. Переключите раскладку на английскую. Текст на русском можно набирать в режиме вставки.`,
    `It looks like a Russian or another non-Latin layout is on: ${name} received \`${key}\` in Normal mode, while its commands use Latin letters. Switch the layout to English. Russian text can be typed in Insert mode.`,
  );
}

export interface KeyboardLockSupport {
  fullscreen: boolean;
  lock: boolean;
}

/** What this browser offers: fullscreen, and Keyboard Lock (Chromium only, effective in fullscreen). */
export function keyboardLockSupport(nav: unknown, doc: unknown): KeyboardLockSupport {
  const k = (nav as { keyboard?: { lock?: unknown } } | undefined)?.keyboard;
  const d = doc as { fullscreenEnabled?: boolean } | undefined;
  return { fullscreen: !!d?.fullscreenEnabled, lock: typeof k?.lock === 'function' };
}

/** macOS: the Option key becomes Meta (Emacs's M-x), at the price of typing symbols with Option. */
export function isMac(platform: string | undefined): boolean {
  return /Mac|iPhone|iPad/i.test(platform ?? '');
}

// ── the props and goals of the widget ─────────────────────────────────────

export interface EditorLabProps {
  intro?: Bi;
  /** Which editors the lab is about: picks the key panels. Default ['vim']. */
  editors?: EditorKind[];
  tasks?: Task[];
  /** Root commands run before the learner gets the prompt (not on a resumed machine). */
  setup?: string[];
  memoryMB?: number;
  autostart?: boolean;
  rows?: number;
}

/** Predicates of a task, strings only. */
export function predicates(task: Task): string[] {
  return [task.check.when, ...(task.check.fail ?? []).map((f) => f.if)].filter((x): x is string => typeof x === 'string');
}

/** A predicate that reads only the editor area can skip the machine's general facts (seconds in emulation). */
export function editorOnly(task: Task): boolean {
  const all = [task.check.when, ...(task.check.fail ?? []).map((f) => f.if)].filter((x) => x !== undefined);
  const preds = predicates(task);
  if (preds.length !== all.length || task.check.stdout !== undefined) return false;
  return preds.every((p) => {
    const code = p.replace(/'(?:\\.|[^'])*'|"(?:\\.|[^"])*"/g, "''");
    const scopes = [...code.matchAll(/(?:^|[\s(!&|#])(?:@start\.)?([a-z]+)(?=[.[#])/g)].map((m) => m[1]);
    return scopes.length > 0 && scopes.every((s) => (EDITOR_SCOPES as readonly string[]).includes(s));
  });
}

// ── what the tutor sees while an editor is open ───────────────────────────

const cutLine = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * The compact state of the editor in front for the tutor: mode, buffer,
 * cursor, a few lines around it, registers or the kill ring head, the last
 * error message. Bounded to about 1.5 KB.
 */
export function mentorEditorState(area: EditorArea | null): Record<string, unknown> | null {
  const kind = area?.editor.active;
  if (!area || !kind) return null;
  const f = area[kind];
  if (!f.instrumented || f.source === 'none') return { editor: kind, instrumented: false };
  const buf = (f.buf ?? {}) as Record<string, unknown>;
  const text = typeof buf.text === 'string' ? buf.text.split('\n') : [];
  const cursor = kind === 'emacs' ? { line: Number(buf.line) || 1, col: Number(buf.column) || 0 } : { line: Number((f.cursor as { lnum?: number })?.lnum) || 1, col: Number((f.cursor as { col?: number })?.col) || 1 };
  const from = Math.max(0, cursor.line - 6);
  const around = text.slice(from, cursor.line + 5).map((l, i) => `${from + i + 1}${from + i + 1 === cursor.line ? '>' : ':'} ${cutLine(l, 120)}`);
  const out: Record<string, unknown> = {
    editor: kind,
    buffer: buf.file || buf.name || '',
    modified: buf.modified === true,
    cursor,
    around,
  };
  if (kind === 'emacs') {
    out.major = f.major;
    out.killhead = typeof f.killhead === 'string' ? cutLine(f.killhead, 120) : null;
    out.minibuffer = f.minibuffer;
    if (typeof f.message === 'string') out.message = cutLine(f.message, 200);
  } else {
    out.mode = f.mode;
    if (f.recording) out.recording = f.recording;
    const reg = (f.reg ?? {}) as Record<string, string>;
    const regs: Record<string, string> = {};
    for (const r of ['"', '0', '.', '/', ...'abcdefghijklmnopqrstuvwxyz']) if (reg[r]) regs[r] = cutLine(reg[r], 60);
    out.registers = regs;
    if (typeof f.errmsg === 'string' && f.errmsg) out.error = cutLine(f.errmsg, 200);
  }
  return out;
}

/** The tutor's terminal context while an editor is open: the rendered screen, then the state line. */
export function mentorEditorContext(screen: string[], area: EditorArea | null): string[] | null {
  const state = mentorEditorState(area);
  if (!state) return null;
  const rows = screen.map((l) => cutLine(l.replace(/\s+$/, ''), 160));
  while (rows.length && !rows[rows.length - 1]) rows.pop();
  const json = JSON.stringify(state);
  return ['[editor screen]', ...rows.slice(-40), '[editor state]', json.length > 1600 ? json.slice(0, 1599) + '…' : json];
}
