// Facts of a running text editor (the `editor` area of dt.facts/v1) on the
// lab-editors image: what Vim, Neovim and Emacs hold in memory — buffers,
// registers, marks, the mode, the kill ring — so a goal can be judged by the
// editor's state, not by the keys typed.
//
// The image carries a read-only agent for each editor (scripts/lab-editors):
// dt.vim, dt.lua and dt-agent.el. Each one writes /run/dt/<kind>.<pid>.stamp
// when something a check looks at changes and answers on
// /run/dt/<kind>.<pid>.sock. The service shell
//   - polls cheaply (`editorProbeScript`: /proc and the stamps, builtins only)
//     while a command runs in the learner's terminal, so the page knows when
//     to check again although no prompt comes back from a fullscreen editor;
//   - collects the state (`editorStateScript`) only when a check reads it.
// An editor started without plugins (`vim -u NONE`, `nvim --clean`,
// `emacs -Q`) has no stamp: its facts say `instrumented: false`, and checks
// fall back to files.
//
// Predicates (09 §2.3):
//   vim.mode = n                               vim.reg.a ~ 'A;'
//   vim.buffers[file='/srv/train/app.conf'].modified = false
//   vim.buf.text ~ 'mode = release'            #vim.windows >= 2
//   nvim.instrumented = true                   emacs.killhead = 'beta\n'
//   emacs.buffers[name='notes.txt'].text ~ 'x' editor.active = emacs
//
// Parsing is pure and unit-tested against output recorded from the real
// editors of the image.

export const EDITOR_KINDS = ['vim', 'nvim', 'emacs'] as const;
export type EditorKind = (typeof EDITOR_KINDS)[number];
export const EDITOR_SCOPES = ['editor', ...EDITOR_KINDS] as const;

/** Process names (`comm`) of each editor: Vim's other names are links to the same binary. */
const COMMS: Record<EditorKind, RegExp> = {
  vim: /^(vim|view|vimdiff|rvim|rview|ex|vimtutor)$/,
  nvim: /^nvim$/,
  emacs: /^emacs(-[\d.]+)?$/,
};

export function editorKindOf(comm: string): EditorKind | undefined {
  return EDITOR_KINDS.find((k) => COMMS[k].test(comm));
}

/** Editor scopes named as the first step of predicate strings ("vim.mode" → vim). */
export function editorScopesOf(predicates: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of predicates) {
    if (!p) continue;
    const code = p.replace(/'(?:\\.|[^'])*'|"(?:\\.|[^"])*"/g, "''");
    for (const m of code.matchAll(/(?:^|[\s(!&|#])(?:@start\.)?([a-z]+)(?=[.[#])/g)) {
      if ((EDITOR_SCOPES as readonly string[]).includes(m[1])) out.add(m[1]);
    }
  }
  return [...out];
}

const DIR = '/run/dt';
// `case` patterns over /proc/<pid>/stat: "<pid> (<comm>) <state> <ppid> …"
const STAT_CASE = '*" (vim) "*|*" (view) "*|*" (vimdiff) "*|*" (rvim) "*|*" (rview) "*|*" (ex) "*|*" (vimtutor) "*|*" (nvim) "*|*" (emacs"*';

/**
 * Running editors and the agents' stamps; only shell builtins, so it costs no
 * fork beyond the frame. `V` is the service shell: its session holds the
 * trainer's own editor clients, which are not the learner's editors.
 */
export function editorProbeScript(svcPidFile = '/tmp/.dt-svc'): string {
  return `[ -r ${svcPidFile} ] && read -r v < ${svcPidFile} && echo "V $v"
for p in /proc/[0-9]*; do read -r st < "$p/stat" 2>/dev/null || continue; case "$st" in ${STAT_CASE}) echo "P $st";; esac; done
for f in ${DIR}/*.stamp; do [ -e "$f" ] && read -r s < "$f" && echo "T \${f#${DIR}/} $s"; done; :`;
}

/**
 * The editors' state: for every alive agent, one fixed request on its socket
 * (with a timeout: a stopped editor cannot answer), else the JSON file the
 * agent last wrote. Also the last state an editor left on exit.
 */
export function editorStateScript(): string {
  const o = '/tmp/.dt-editor';
  return `${editorProbeScript()}
for f in ${DIR}/*.stamp; do [ -e "$f" ] || continue; n=\${f%.stamp}; b=\${n##*/}; k=\${b%%.*}; p=\${b#*.}; [ -r /proc/$p/stat ] || continue
read -r st < /proc/$p/stat; set -- $st; : > ${o}
if [ "$3" != T ] && [ -S "$n.sock" ]; then case $k in
vim) timeout 3 vim --clientserver socket --servername "$n.sock" --remote-expr 'DtState()' < /dev/null > ${o} 2>/dev/null ;;
nvim) timeout 5 nvim --server "$n.sock" --remote-expr 'luaeval("DtState()")' < /dev/null > ${o} 2>/dev/null ;;
emacs) echo state | socat -T 3 -t 3 - "UNIX-CONNECT:$n.sock" > ${o} 2>/dev/null ;;
esac; fi
if [ -s ${o} ]; then printf '\\036S%s %s socket\\n' "$k" "$p"; cat ${o}; elif [ -s "$n.json" ]; then printf '\\036S%s %s file\\n' "$k" "$p"; cat "$n.json"; else printf '\\036S%s %s none\\n' "$k" "$p"; fi; echo
done
for k in ${EDITOR_KINDS.join(' ')}; do [ -s ${DIR}/$k.last.json ] && printf '\\036L%s\\n' "$k" && cat ${DIR}/$k.last.json && echo; done; :`;
}

export interface EditorProc {
  kind: EditorKind;
  pid: number;
  ppid: number;
  state: string;
  comm: string;
}

export interface EditorProbe {
  procs: EditorProc[];
  /** Stamp file name (`vim.123.stamp`) → its content. */
  stamps: Record<string, string>;
}

/** Parse the P and T lines of the probe (also the head of the state script). */
export function parseEditorProbe(out: string): EditorProbe {
  const procs: EditorProc[] = [];
  const stamps: Record<string, string> = {};
  let svc = 0;
  const sessions = new Map<number, number>();
  for (const ln of out.replace(/\r/g, '').split('\n')) {
    if (ln.startsWith('V ')) svc = Number(ln.slice(2)) || 0;
    else if (ln.startsWith('P ')) {
      // "<pid> (<comm>) <state> <ppid> <pgrp> <session> …"
      const m = /^P (\d+) \((.*)\) (\S) (-?\d+)(?: (-?\d+) (-?\d+))?/.exec(ln);
      const kind = m ? editorKindOf(m[2]) : undefined;
      if (m && kind) {
        procs.push({ kind, pid: Number(m[1]), ppid: Number(m[4]), state: m[3], comm: m[2] });
        if (m[6]) sessions.set(Number(m[1]), Number(m[6]));
      }
    } else if (ln.startsWith('T ')) {
      const m = /^T (\S+\.stamp) ?(.*)$/.exec(ln);
      if (m) stamps[m[1]] = m[2];
    }
  }
  // The trainer's own clients (`nvim --server …`) run in the service shell's session.
  return { procs: svc ? procs.filter((p) => sessions.get(p.pid) !== svc) : procs, stamps };
}

export interface EditorInstance {
  kind: EditorKind;
  pid: number;
  /** The agent runs in this editor (its stamp belongs to this process or to its embedded server). */
  instrumented: boolean;
  /** A stopped editor (Ctrl-Z) keeps its state but cannot answer. */
  stopped: boolean;
}

/**
 * Editor processes as the learner sees them: Neovim's terminal front end and
 * its embedded server (`nvim --embed`, the child) count as one editor.
 */
export function editorInstances(p: EditorProbe): EditorInstance[] {
  const byPid = new Map(p.procs.map((x) => [x.pid, x]));
  const stamped = new Set(Object.keys(p.stamps).map((f) => f.replace(/\.stamp$/, '')));
  const out: EditorInstance[] = [];
  for (const x of p.procs) {
    const parent = byPid.get(x.ppid);
    if (parent && parent.kind === x.kind) continue; // the embedded half of a pair
    const kids = p.procs.filter((c) => c.ppid === x.pid && c.kind === x.kind);
    const pids = [x.pid, ...kids.map((c) => c.pid)];
    out.push({ kind: x.kind, pid: x.pid, instrumented: pids.some((pid) => stamped.has(`${x.kind}.${pid}`)), stopped: [x, ...kids].some((c) => c.state === 'T') });
  }
  return out.sort((a, b) => a.pid - b.pid);
}

/** A stable string that changes when an editor starts or stops or an agent's stamp moves. */
export function probeSignature(p: EditorProbe): string {
  const inst = editorInstances(p).map((i) => `${i.kind}:${i.pid}:${i.stopped ? 'T' : ''}`);
  const stamps = Object.entries(p.stamps).sort(([a], [b]) => a.localeCompare(b)).map(([f, s]) => `${f}=${s}`);
  return [...inst, ...stamps].join('|');
}

export type EditorSource = 'socket' | 'file' | 'none';

/** One editor's facts. Without the agent only `running`, `instrumented` and `pid` are known. */
export interface EditorFacts {
  running: boolean;
  instrumented: boolean;
  pid?: number;
  /** Where the state came from: the live socket, the agent's last file, or nowhere. */
  source?: EditorSource;
  /** The selected buffer (the one in the current window). */
  buf?: Record<string, unknown>;
  buffers?: Record<string, unknown>[];
  /** The state the editor left when it last exited (dt agents write it on exit). */
  last?: Record<string, unknown>;
  [field: string]: unknown;
}

export interface EditorArea {
  editor: {
    running: EditorKind[];
    /** The editor in front: the newest running one. */
    active: EditorKind | null;
    /** Whether the active editor is instrumented (false also when none runs). */
    instrumented: boolean;
    instances: EditorInstance[];
  };
  vim: EditorFacts;
  nvim: EditorFacts;
  emacs: EditorFacts;
}

function json(s: string): Record<string, unknown> | undefined {
  const t = s.trim();
  if (!t.startsWith('{')) return undefined;
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The current buffer of a state, as `buf`, so short predicates read it directly. */
function withBuf(kind: EditorKind, s: Record<string, unknown>): Record<string, unknown> {
  const buffers = Array.isArray(s.buffers) ? (s.buffers as Record<string, unknown>[]) : [];
  const buf = buffers.find((b) => b.current === true) ?? (kind === 'emacs' ? buffers.find((b) => b.name === s.selected) : undefined);
  return buf ? { ...s, buf } : s;
}

/** Parse what editorStateScript printed. */
export function parseEditorState(out: string): EditorArea {
  const clean = out.replace(/\r/g, '');
  const probe = parseEditorProbe(clean.split('\x1e')[0]);
  const instances = editorInstances(probe);
  const states = new Map<string, { source: EditorSource; state?: Record<string, unknown> }>();
  const last: Partial<Record<EditorKind, Record<string, unknown>>> = {};
  for (const part of clean.split('\x1e').slice(1)) {
    const nl = part.indexOf('\n');
    const head = nl < 0 ? part : part.slice(0, nl);
    const body = nl < 0 ? '' : part.slice(nl + 1);
    const s = /^S(\w+) (\d+) (socket|file|none)$/.exec(head.trim());
    if (s) {
      states.set(`${s[1]}.${s[2]}`, { source: s[3] as EditorSource, state: json(body) });
      continue;
    }
    const l = /^L(\w+)$/.exec(head.trim());
    if (l && (EDITOR_KINDS as readonly string[]).includes(l[1])) {
      const st = json(body);
      if (st) last[l[1] as EditorKind] = withBuf(l[1] as EditorKind, st);
    }
  }
  const area = { editor: { running: [], active: null, instrumented: false, instances } } as unknown as EditorArea;
  for (const kind of EDITOR_KINDS) {
    const mine = instances.filter((i) => i.kind === kind);
    // The newest instance in front; for its state look at its own pid and the embedded server's.
    const front = mine.at(-1);
    let facts: EditorFacts = { running: mine.length > 0, instrumented: false };
    if (front) {
      facts.pid = front.pid;
      facts.instrumented = front.instrumented;
      const kids = probe.procs.filter((p) => p.ppid === front.pid && p.kind === kind).map((p) => p.pid);
      const got = [front.pid, ...kids].map((pid) => states.get(`${kind}.${pid}`)).find(Boolean);
      if (got) {
        facts.source = got.source;
        if (got.state) facts = { ...withBuf(kind, got.state), ...facts };
      } else facts.source = 'none';
    }
    if (last[kind]) facts.last = last[kind];
    area[kind] = facts;
  }
  const running = instances.map((i) => i.kind);
  area.editor.running = [...new Set(running)];
  const active = instances.at(-1);
  area.editor.active = active?.kind ?? null;
  area.editor.instrumented = active ? area[active.kind].instrumented && area[active.kind].source !== 'none' : false;
  return area;
}
