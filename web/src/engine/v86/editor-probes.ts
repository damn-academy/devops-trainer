// Behaviour probes (design: the Vim course plan §6.2, item 5): run what the
// learner made — a macro in a register, keys through their own config, an
// Emacs function from their init file — on a hidden input inside the guest,
// in a fresh batch editor, and put the result into the facts. A goal can then
// check what the macro does, not only the text it left in the visible file:
//
//   probe['macro-a'].text = 'one;\ntwo;\nthree;\n'
//   probe['macro-a'].ok = true            probe['macro-a'].error ~ 'E'
//
// The learner's running editor is never touched: the macro comes from the
// facts (the live editor or the state it left on exit), the batch editor
// starts without plugins (`-u NONE`, `-Q`) unless the probe is about the
// learner's config. Pure string work, unit-tested; the scripts run on the
// lab-editors image.

import type { Facts } from '../../core/types';
import type { EditorKind } from './editor-facts';

export interface EditorProbeSpec {
  id: string;
  editor: EditorKind;
  /** The hidden input file. */
  input: string;
  run:
    /** A macro: a Vim/Neovim register, or 'last' for Emacs's last keyboard macro. `times`: a count, 'each-line', or by default repeat until it fails. */
    | { macro: string; times?: number | 'each-line' }
    /** Keys typed in Normal mode (Vim notation is not expanded: raw keys) through the learner's config. */
    | { keys: string; config?: string }
    /** Emacs: call this command with point at the start of the buffer, after loading the learner's init file. */
    | { call: string; config?: string };
}

export interface ProbeResult {
  ok: boolean;
  exit: number;
  /** The hidden file after the run. */
  text: string;
  error?: string;
  ms?: number;
}

/** Probe ids a predicate names: probe['id']. */
export function probesNamed(predicates: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of predicates) if (p) for (const m of p.matchAll(/probe\[['"]([\w.-]+)['"]\]/g)) out.add(m[1]);
  return [...out];
}

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** Batch Neovim must not look for a clipboard tool (tmux, xclip). Batch runs use --headless: `nvim -Es` lost the file in tests. */
const NO_CLIPBOARD = `--cmd 'let g:loaded_clipboard_provider = 1'`;

const DEFAULT_CONFIG: Record<EditorKind, string> = { vim: '~/.vimrc', nvim: '~/.config/nvim/init.lua', emacs: '~/.emacs.d/init.el' };

/** The editor's facts, or the state it left on exit. */
function editorState(facts: Facts, kind: EditorKind): Record<string, unknown> | undefined {
  const f = facts[kind] as { reg?: unknown; last?: Record<string, unknown>; macro?: unknown; running?: boolean } | undefined;
  if (!f) return undefined;
  if (f.running && (f.reg !== undefined || f.macro !== undefined)) return f as Record<string, unknown>;
  return f.last;
}

/** What the probe will run, as a key for caching its result (same macro and input → same result). */
export function probeKey(spec: EditorProbeSpec, facts: Facts): string | null {
  const r = spec.run;
  if ('macro' in r) {
    const st = editorState(facts, spec.editor);
    const body = spec.editor === 'emacs' ? st?.macro : (st?.reg as Record<string, string> | undefined)?.[r.macro];
    if (typeof body !== 'string' || !body) return null;
    const type = spec.editor === 'emacs' ? '' : ((st?.regtype as Record<string, string> | undefined)?.[r.macro] ?? 'v');
    return JSON.stringify([spec.id, spec.input, body, type, r.times ?? 'repeat']);
  }
  return JSON.stringify([spec.id, spec.input, r]);
}

/**
 * The guest script of a probe, or null when there is nothing to run yet (the
 * register is empty, no macro was recorded). Prints `RS R <exit>` and the
 * output file in base64; everything runs in a fresh temporary directory.
 */
export function probeScript(spec: EditorProbeSpec, facts: Facts): string | null {
  const r = spec.run;
  const files: Record<string, string> = { 'in.txt': spec.input };
  let cmd: string;
  if ('macro' in r) {
    const st = editorState(facts, spec.editor);
    if (spec.editor === 'emacs') {
      if (typeof st?.macro !== 'string' || !st.macro) return null;
      files['macro.txt'] = st.macro;
      const times = typeof r.times === 'number' ? r.times : 0; // 0: until an error
      cmd = `timeout 30 emacs --batch -Q --eval '(progn (find-file "in.txt") (goto-char (point-min)) (condition-case e (execute-kbd-macro (kbd (with-temp-buffer (insert-file-contents "macro.txt") (buffer-string))) ${times}) (error (with-temp-file "err.txt" (insert (error-message-string e))))) (write-region nil nil "out.txt"))'`;
    } else {
      // Prefer the key notation (keytrans(): `A;<Esc>j`): raw registers can hold Vim's internal
      // special-key bytes (modifyOtherKeys input), which do not survive JSON.
      const keys = (st?.regkeys as Record<string, string> | undefined)?.[r.macro];
      const reg = (st?.reg as Record<string, string> | undefined)?.[r.macro];
      if (!(typeof keys === 'string' && keys) && !(typeof reg === 'string' && reg)) return null;
      const type = (st?.regtype as Record<string, string> | undefined)?.[r.macro] ?? 'v';
      files['reg.json'] = JSON.stringify(typeof keys === 'string' && keys ? [keys, type, 'keys'] : [reg, type, 'raw']);
      const times = r.times === 'each-line' ? '' : String(typeof r.times === 'number' ? r.times : 999);
      // The macro goes into register q of the batch editor, whatever register the learner used.
      // No `silent!` around it: that would swallow the error that ends a repeated macro (a failed `j` on the last line).
      files['probe.vim'] = [
        'let r = json_decode(join(readfile("reg.json"), "\\n"))',
        `let k = r[2] ==# 'keys' ? eval('"' . substitute(escape(r[0], '\\"'), '<', '\\\\<', 'g') . '"') : r[0]`,
        'call setreg("q", k, r[1])',
        times ? 'normal! gg' : '',
        times ? `exe "normal ${times}@q"` : '%normal @q',
        'call writefile([v:errmsg], "err.txt")',
        'w! out.txt',
        'qa!',
      ].filter(Boolean).join('\n') + '\n';
      const exe = spec.editor === 'nvim' ? `nvim --headless -u NONE -i NONE -n ${NO_CLIPBOARD}` : 'vim -Nu NONE -i NONE -n -Es';
      cmd = `timeout 30 ${exe} -S probe.vim in.txt`;
    }
  } else if ('keys' in r) {
    if (spec.editor === 'emacs') return null;
    files['keys.txt'] = r.keys;
    const cfg = r.config ?? DEFAULT_CONFIG[spec.editor];
    const exe = spec.editor === 'nvim' ? `nvim --headless -u ${cfg} -i NONE -n ${NO_CLIPBOARD}` : `vim -Nu ${cfg} -i NONE -n -Es`;
    // Ex mode starts on the last line: go to the first. `normal` (not `normal!`): the learner's mappings are what is checked.
    cmd = `timeout 30 ${exe} -c 'normal! gg' -c 'exe "normal " . join(readfile("keys.txt", "b"), "\\n")' -c 'call writefile([v:errmsg], "err.txt")' -c 'w! out.txt' -c 'qa!' in.txt`;
  } else {
    if (spec.editor !== 'emacs' || !/^[\w:/+*<>=.-]+$/.test(r.call)) return null;
    const cfg = r.config ?? DEFAULT_CONFIG.emacs;
    cmd = `timeout 30 emacs --batch -Q -l ${cfg} --eval '(progn (find-file "in.txt") (goto-char (point-min)) (condition-case e (call-interactively (quote ${r.call})) (error (with-temp-file "err.txt" (insert (error-message-string e))))) (write-region nil nil "out.txt"))'`;
  }
  const put = Object.entries(files).map(([name, text]) => `printf '%s' '${b64(text)}' | base64 -d > ${name}`);
  return [
    'd=$(mktemp -d /tmp/.dt-probe.XXXXXX) && cd "$d" || exit 1',
    ...put,
    `${cmd} < /dev/null > log.txt 2>&1; e=$?`,
    `printf '\\036R %s\\n' "$e"; [ -f out.txt ] && base64 out.txt; printf '\\036X\\n'; [ -s err.txt ] && head -c 300 err.txt`,
    'cd /; rm -rf "$d"',
  ].join('\n');
}

function unb64(s: string): string {
  const bin = atob(s.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Parse what probeScript printed. */
export function parseProbe(out: string): ProbeResult {
  const clean = out.replace(/\r/g, '');
  const m = /\x1eR (\d+)\n([\s\S]*?)\x1eX\n?([\s\S]*)$/.exec(clean);
  if (!m) return { ok: false, exit: -1, text: '', error: clean.slice(0, 300) || 'no answer' };
  const exit = Number(m[1]);
  let text = '';
  try {
    text = m[2].trim() ? unb64(m[2]) : '';
  } catch {
    text = '';
  }
  const error = m[3].trim() || undefined;
  return { ok: exit === 0 && m[2].trim() !== '', exit, text, ...(error ? { error } : {}) };
}
