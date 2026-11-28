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

