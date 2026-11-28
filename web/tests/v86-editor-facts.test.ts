// The editor area of the facts (engine/v86/editor-facts.ts), the editor
// terminal's pure parts (editor-keys.ts) and the demo goals (editor-demo.ts).
// Fixtures in tests/fixtures/editors/ are service-channel output recorded on
// the real lab-editors image (scripts/check-editors-lab.mjs --fixtures).

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import type { Facts } from '../src/core/types';
import { EDITOR_DEMO_TASKS } from '../src/engine/v86/editor-demo';
import { editorInstances, editorKindOf, editorProbeScript, editorScopesOf, editorStateScript, parseEditorProbe, parseEditorState, probeSignature } from '../src/engine/v86/editor-facts';
import { editorOnly, exitHint, keyboardLockSupport, nonLatinChord, nonLatinNotice, PANEL_KEYS, panelsFor, statusLine } from '../src/engine/v86/editor-keys';

const fixture = (name: string) => {
  const p = fileURLToPath(new URL(`./fixtures/editors/${name}.txt`, import.meta.url));
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
const task = (id: string) => EDITOR_DEMO_TASKS.find((t) => t.id === id)!;
const base = { schema: 'dt.facts/v1', env: { kind: 'v86', machine: 'm', kernel: '', at: '' }, user: { name: 'root', uid: 0, gid: 0 }, cwd: '/root', hostname: 'editors', vars: {}, procs: [], files: {}, term: { main: [] } } as Facts;
const factsOf = (out: string, files: Record<string, string> = {}): Facts =>
  ({ ...base, ...parseEditorState(out), files: Object.fromEntries(Object.entries(files).map(([k, text]) => [k, { exists: true, type: 'f', text }])) }) as Facts;

const vimState = (o: Record<string, unknown>) => JSON.stringify({ agent: 1, mode: 'n', recording: '', reg: {}, buffers: [], ...o });

describe('editor probe', () => {
  it('reads editors from /proc and the stamps', () => {
    const p = parseEditorProbe([
      'P 120 (vim) S 100 120 100 34816',
      'P 130 (bash) S 1 130',
      'P 140 (nvim) S 100 140',
      'P 141 (nvim) S 140 141',
      'P 150 (emacs) T 100 150',
      'T vim.120.stamp 3 1 5 1 n  1 0 0 0',
      'T nvim.141.stamp 1 0 2 1 n  1 0 0 0',
      'sh: can\'t open /proc/155/stat: no such file',
    ].join('\n'));
    expect(p.procs.map((x) => `${x.kind}:${x.pid}`)).toEqual(['vim:120', 'nvim:140', 'nvim:141', 'emacs:150']);
    const inst = editorInstances(p);
    // Neovim's TUI and its embedded server are one editor; the stamp belongs to the server.
    expect(inst).toEqual([
      { kind: 'vim', pid: 120, instrumented: true, stopped: false },
      { kind: 'nvim', pid: 140, instrumented: true, stopped: false },
      { kind: 'emacs', pid: 150, instrumented: false, stopped: true },
    ]);
    const sig = probeSignature(p);
    expect(probeSignature(parseEditorProbe('P 120 (vim) R 100\nT vim.120.stamp 3 1 5 1 n  1 0 0 0\nP 140 (nvim) S 100\nP 141 (nvim) S 140\nT nvim.141.stamp 1 0 2 1 n  1 0 0 0\nP 150 (emacs) T 100'))).toBe(sig);
    expect(probeSignature(parseEditorProbe('P 120 (vim) S 100\nT vim.120.stamp 4 2 6 1 n  1 1 0 0'))).not.toBe(sig);
  });

  it('leaves out the trainer\'s own editor clients', () => {
    const p = parseEditorProbe('V 900\nP 120 (nvim) S 100 120 100 34816\nP 121 (nvim) S 120 120 100 34816\nP 950 (nvim) S 940 940 900 0\nT nvim.121.stamp 1 x');
    expect(editorInstances(p).map((i) => i.pid)).toEqual([120]);
  });

  it('knows the editors by process name', () => {
    expect(['vim', 'view', 'vimdiff', 'nvim', 'emacs', 'emacs-30.2', 'vi', 'nano'].map(editorKindOf)).toEqual(['vim', 'vim', 'vim', 'nvim', 'emacs', 'emacs', undefined, undefined]);
  });

  it('uses only shell builtins in the probe', () => {
    const s = editorProbeScript();
    expect(s).not.toMatch(/\b(cat|ls|ps|grep|awk|sed|tr|pidof)\b/);
    expect(editorStateScript()).toContain('timeout 3 vim --clientserver socket');
    expect(editorStateScript()).toContain('socat -T 3');
  });
});

describe('editor scopes in predicates', () => {
  it('finds editor scopes but not words inside strings', () => {
    expect(editorScopesOf(["vim.reg.a ~ 'x' && files['/etc/vim.conf'].text ~ 'emacs.x'", '#nvim.buffers > 1', '!emacs.running', "editor.active = vim"]).sort()).toEqual(['editor', 'emacs', 'nvim', 'vim']);
    expect(editorScopesOf(["files['/srv/vim.txt'].type = f"])).toEqual([]);
  });

  it('tells editor-only goals from goals that also read files', () => {
    expect(editorOnly(task('vim-word'))).toBe(false);
    expect(editorOnly(task('vim-macro'))).toBe(true);
    expect(editorOnly(task('emacs-yank'))).toBe(true);
    expect(editorOnly({ id: 'x', prompt: { ru: '', en: '' }, check: { when: () => true } })).toBe(false);
  });
});

describe('editor state', () => {
  const vimOut = (state: string) => `P 120 (vim) S 100\nT vim.120.stamp 2 x\n\x1eSvim 120 socket\n${state}\n`;

  it('parses a live Vim state and exposes the current buffer', () => {
    const a = parseEditorState(vimOut(vimState({ mode: 'i', reg: { a: 'A;\u001bj' }, buffers: [{ nr: 1, file: '/srv/train/list.txt', name: '/srv/train/list.txt', current: true, modified: true, text: 'alpha;' }] })));
    expect(a.editor).toMatchObject({ running: ['vim'], active: 'vim', instrumented: true });
    expect(a.vim).toMatchObject({ running: true, instrumented: true, pid: 120, source: 'socket', mode: 'i' });
    expect((a.vim.buf as { file: string }).file).toBe('/srv/train/list.txt');
    expect(a.nvim).toEqual({ running: false, instrumented: false });
  });

  it('is honest about an editor without its agent', () => {
    const a = parseEditorState('P 120 (vim) S 100\n');
    expect(a.vim).toEqual({ running: true, instrumented: false, pid: 120, source: 'none' });
    expect(a.editor.instrumented).toBe(false);
    expect(statusLine(a)?.honest?.en).toMatch(/files only/);
  });

  it('falls back to the agent file and keeps the last state after exit', () => {
    const a = parseEditorState(`P 120 (vim) T 100\nT vim.120.stamp 2 x\n\x1eSvim 120 file\n${vimState({ mode: 'n' })}\n\x1eLemacs\n{"agent":1,"killhead":"beta\\n","buffers":[{"name":"notes.txt","current":true}]}\n`);
    expect(a.vim.source).toBe('file');
    expect(a.emacs.running).toBe(false);
    expect(a.emacs.last).toMatchObject({ killhead: 'beta\n', buf: { name: 'notes.txt' } });
  });

  it('takes Neovim state from the embedded server', () => {
    const a = parseEditorState(`P 140 (nvim) S 100\nP 141 (nvim) S 140\nT nvim.141.stamp 1 x\n\x1eSnvim 141 socket\n${vimState({ mode: 'n', version: '0.12.2' })}\n`);
    expect(a.nvim).toMatchObject({ running: true, instrumented: true, pid: 140, version: '0.12.2' });
  });
});

describe('demo goals on editor facts', () => {
  const app = '/srv/train/app.conf';
  it('(a) word changed and saved, Vim still open', () => {
    const saved = vimOut2({ buffers: [{ file: app, current: true, modified: false, text: '# x\nlisten = 8080\nmode = release' }] });
    expect(evaluateCheck(task('vim-word').check, factsOf(saved, { [app]: 'mode = release\n' })).pass).toBe(true);
    const unsaved = vimOut2({ buffers: [{ file: app, current: true, modified: true, text: 'mode = release' }] });
    const r = evaluateCheck(task('vim-word').check, factsOf(unsaved, { [app]: 'mode = debug\n' }));
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/not saved/);
    expect(evaluateCheck(task('vim-word').check, factsOf('', { [app]: 'mode = release\n' })).say?.en).toMatch(/Vim is closed/);
    expect(evaluateCheck(task('vim-word').check, factsOf('P 9 (vim) S 1\n', { [app]: 'mode = debug\n' })).say?.en).toMatch(/without system plugins/);
  });

  it('(b) macro in register a, applied to all lines', () => {
    const list = '/srv/train/list.txt';
    const done = vimOut2({ reg: { a: 'A;\u001bj' }, buffers: [{ file: list, current: true, modified: true, text: 'alpha;\nbeta;\ngamma;\ndelta;' }] });
    expect(evaluateCheck(task('vim-macro').check, factsOf(done)).pass).toBe(true);
    const recording = vimOut2({ recording: 'a', buffers: [{ file: list, current: true, text: 'alpha;\nbeta\ngamma\ndelta' }] });
    expect(evaluateCheck(task('vim-macro').check, factsOf(recording)).say?.en).toMatch(/still being recorded/);
    const once = vimOut2({ reg: { a: 'A;\u001bj' }, buffers: [{ file: list, current: true, text: 'alpha;\nbeta\ngamma\ndelta' }] });
    expect(evaluateCheck(task('vim-macro').check, factsOf(once)).say?.en).toMatch(/apply it to every line/);
  });

  it('(c) Emacs: killed line yanked twice', () => {
    const notes = '/srv/train/notes.txt';
    const em = (o: Record<string, unknown>) => `P 150 (emacs) S 100\nT emacs.150.stamp 3 x\n\x1eSemacs 150 socket\n${JSON.stringify({ agent: 1, selected: 'notes.txt', ...o })}\n`;
    expect(evaluateCheck(task('emacs-yank').check, factsOf(em({ killhead: 'beta\n', buffers: [{ name: 'notes.txt', file: notes, current: true, text: 'alpha\ngamma\nbeta\nbeta\n' }] }))).pass).toBe(true);
    expect(evaluateCheck(task('emacs-yank').check, factsOf(em({ killhead: 'beta', buffers: [{ name: 'notes.txt', file: notes, current: true, text: 'alpha\n\ngamma\nbetabeta\n' }] }))).say?.en).toMatch(/without its newline/);
    expect(evaluateCheck(task('emacs-yank').check, factsOf('P 150 (emacs) S 100\n')).say?.en).toMatch(/emacs -Q/);
  });

  function vimOut2(o: Record<string, unknown>) {
    return `P 120 (vim) S 100\nT vim.120.stamp 2 x\n\x1eSvim 120 socket\n${vimState(o)}\n`;
  }
});

describe('recorded on the real image', () => {
  const cases: [string, string, boolean][] = [
    ['vimSaved', 'vim-word', true],
    ['vimMacro', 'vim-macro', true],
    ['emacsYank', 'emacs-yank', true],
  ];
  for (const [name, id, pass] of cases) {
    const out = fixture(name);
    it.skipIf(!out)(`${name}: ${id} ${pass ? 'passes' : 'fails'}`, () => {
      const f = factsOf(out!, { '/srv/train/app.conf': (parseEditorState(out!).vim.buf as { text?: string } | undefined)?.text ?? '' });
      expect(evaluateCheck(task(id).check, f).pass).toBe(pass);
    });
  }
  const bare = fixture('vimBare');
  it.skipIf(!bare)('vim -u NONE is reported as not instrumented', () => {
    expect(parseEditorState(bare!).vim).toMatchObject({ running: true, instrumented: false });
  });
  const nv = fixture('nvimOpen');
  it.skipIf(!nv)('Neovim state comes through its socket', () => {
    expect(parseEditorState(nv!).nvim).toMatchObject({ running: true, instrumented: true, source: 'socket', mode: 'n' });
  });
});

describe('editor terminal', () => {
  it('panels follow the lab and the active editor', () => {
    expect(panelsFor(['vim'], null)).toEqual(['vim']);
    expect(panelsFor(['vim', 'emacs'], 'emacs')).toEqual(['emacs', 'vim']);
    expect(panelsFor(['nvim'], 'nvim')).toEqual(['vim']);
    expect(PANEL_KEYS.vim.find((k) => k.label === 'C-w')?.seq).toBe('\x17');
    expect(PANEL_KEYS.emacs.find((k) => k.label === 'M-x')?.seq).toBe('\x1bx');
  });

  it('mode line from facts', () => {
    const a = parseEditorState(`P 120 (vim) S 100\nT vim.120.stamp 2 x\n\x1eSvim 120 socket\n${vimState({ mode: 'n', recording: 'a', reg: { a: 'x', b: 'y', '"': 'z' } })}\n`);
    expect(statusLine(a)?.text).toEqual({ ru: 'Vim · режим: нормальный · идёт запись в регистр a · регистры с текстом: ab', en: 'Vim · mode: Normal · recording into register a · named registers: ab' });
    expect(statusLine(null)).toBeNull();
  });

  it('feature-detects Keyboard Lock', () => {
    expect(keyboardLockSupport({ keyboard: { lock: () => Promise.resolve() } }, { fullscreenEnabled: true })).toEqual({ fullscreen: true, lock: true });
    expect(keyboardLockSupport({}, {})).toEqual({ fullscreen: false, lock: false });
  });
});

describe('exit hint and keyboard layout', () => {
  it('names the way out of the editor in front, or of every editor of the lab', () => {
    expect(exitHint('vim', ['vim']).ru).toContain(':q!');
    expect(exitHint('emacs', ['vim', 'emacs']).en).toContain('C-x C-c');
    expect(exitHint('nvim', ['nvim']).en).toContain('Neovim');
    const both = exitHint(null, ['vim', 'emacs']);
    expect(both.ru).toContain(':q!');
    expect(both.ru).toContain('C-x C-c');
  });

  it('catches Emacs chords typed in a non-Latin layout, not plain Russian text', () => {
    expect(nonLatinChord('', '\x1bч')).toBe('M-ч');
    expect(nonLatinChord('\x18', 'л')).toBe('C-x л');
    expect(nonLatinChord('', '\x03ц')).toBe('C-c ц');
    expect(nonLatinChord('', 'привет')).toBeNull();
    expect(nonLatinChord('', '\x1bx')).toBeNull();
    expect(nonLatinChord('', '\x1b[A')).toBeNull();
  });

  it('reads the agent counter of non-Latin letters in Normal mode', () => {
    const a = parseEditorState(`P 120 (vim) S 100\nT vim.120.stamp 2 x\n\x1eSvim 120 socket\n${vimState({ nonlatin: { count: 2, last: 'ц', mode: 'n' } })}\n`);
    expect(a.vim.nonlatin).toEqual({ count: 2, last: 'ц', mode: 'n' });
    expect(nonLatinNotice('vim', 'ц').ru).toContain('режиме вставки');
  });
});
