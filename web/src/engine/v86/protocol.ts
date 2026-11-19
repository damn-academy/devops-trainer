// The text protocols between the page and a real Linux machine in v86. All of
// this is pure string work, so it is unit-tested without an emulator.
//
// Two serial ports are used (design 09 §1.4.5):
//   ttyS0 — the learner's shell. Its prompt carries an invisible OSC marker
//           `ESC ] 777 ; dt ; <exit> ; <cwd> BEL`, so the page knows where each
//           command ends, with which exit code, and in which directory the
//           learner is — without typing anything into the learner's terminal.
//   ttyS1 — the service channel: a root shell with echo off. The page sends
//           framed commands and reads framed answers (`RS B<id>` … `RS E<id> <exit>`).
//           Facts for checks are collected here, by a script that forks as
//           little as possible (forks are the most expensive thing in emulation).

import type { FileFact, ProcFact, TermRecord } from '../../core/types';

export const OSC_PREFIX = '\x1b]777;dt;';
const BEL = '\x07';
const RS = '\x1e';

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[()][0-9A-Za-z]|\x1b[=>78]/g;
export const stripAnsi = (s: string) => s.replace(ANSI, '');

/** Quote a string for a POSIX shell. */
export function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The PS1 that makes the prompt report the last exit code and the current
 * directory. `\[ … \]` tell BusyBox line editing that the marker takes no
 * columns, so long lines still wrap correctly.
 */
export function promptPS1(visible = '\\u@\\h:\\w\\$ '): string {
  return `\\[${OSC_PREFIX}$?;$PWD${BEL}\\]${visible}`;
}

// ── ttyS0: the learner's terminal ─────────────────────────────────────────

export interface PromptMark {
  exit: number;
  cwd: string;
}

/**
 * Follows the learner's terminal stream: removes the prompt markers before the
 * text reaches xterm and turns "typed line + output + marker" into TermRecords
 * (the `term.main` facts of 09 §2.2).
 */
export class PromptTracker {
  records: TermRecord[] = [];
  last: PromptMark | null = null;
  /** Records made so far (never decreases, unlike records.length which is capped). */
  count = 0;
  private pendingOsc = '';
  private segment = '';
  private typed: string[] = [];
  private draft = '';
  constructor(private keep = 20) {}

  /** Keystrokes the learner sent: used only to remember the typed line (never for checks). */
  input(data: string): void {
    for (const ch of data) {
      if (ch === '\r' || ch === '\n') {
        this.typed.push(this.draft);
        this.draft = '';
      } else if (ch === '\x7f' || ch === '\b') this.draft = this.draft.slice(0, -1);
      else if (ch === '\x03' || ch === '\x15') this.draft = '';
      else if (ch >= ' ' && ch !== '\x7f') this.draft += ch;
    }
  }

  /** Terminal output; returns the text with markers removed, ready for xterm. */
  output(chunk: string): { text: string; marks: PromptMark[] } {
    let s = this.pendingOsc + chunk;
    this.pendingOsc = '';
    let text = '';
    const marks: PromptMark[] = [];
    for (;;) {
      const i = s.indexOf(OSC_PREFIX);
      if (i < 0) {
        // keep a possible partial prefix at the end for the next chunk
        const keep = partialSuffix(s, OSC_PREFIX);
        text += s.slice(0, s.length - keep);
        this.segment += s.slice(0, s.length - keep);
        this.pendingOsc = s.slice(s.length - keep);
        break;
      }
      const end = s.indexOf(BEL, i);
      if (end < 0) {
        text += s.slice(0, i);
        this.segment += s.slice(0, i);
        this.pendingOsc = s.slice(i);
        break;
      }
      text += s.slice(0, i);
      this.segment += s.slice(0, i);
      const body = s.slice(i + OSC_PREFIX.length, end);
      const sep = body.indexOf(';');
      const mark: PromptMark = { exit: Number(body.slice(0, sep)) || 0, cwd: body.slice(sep + 1) || '/' };
      marks.push(mark);
      this.onMark(mark);
      s = s.slice(end + 1);
    }
    return { text, marks };
  }

  private onMark(mark: PromptMark) {
    const seg = stripAnsi(this.segment).replace(/\r/g, '');
    this.segment = '';
    const hadPrompt = this.last !== null;
    this.last = mark;
    if (!hadPrompt) {
      this.typed = [];
      return;
    }
    const line = this.typed.shift();
    if (line === undefined) return;
    // The first line of the segment is the echo of the prompt and the command.
    const nl = seg.indexOf('\n');
    const out = nl < 0 ? '' : seg.slice(nl + 1);
    if (!line.trim()) return;
    this.records.push({ line, exit: mark.exit, out });
    this.count++;
    if (this.records.length > this.keep) this.records.splice(0, this.records.length - this.keep);
  }

  snapshot(): { records: TermRecord[]; last: PromptMark | null } {
    return { records: this.records.map((r) => ({ ...r })), last: this.last && { ...this.last } };
  }

  restore(s: { records: TermRecord[]; last: PromptMark | null }): void {
    this.records = s.records.map((r) => ({ ...r }));
    this.last = s.last;
    this.segment = '';
    this.pendingOsc = '';
    this.typed = [];
    this.draft = '';
  }
}

/** Length of the longest suffix of s that is a proper prefix of p. */
function partialSuffix(s: string, p: string): number {
  for (let n = Math.min(p.length - 1, s.length); n > 0; n--) if (s.endsWith(p.slice(0, n))) return n;
  return 0;
}

// ── ttyS1: the service channel ────────────────────────────────────────────

export interface ServiceReply {
  id: number;
  out: string;
  exit: number;
}

/** Frame one command for the service shell: its output and exit code come back between markers. */
export function frameCommand(id: number, cmd: string, cwd?: string): string {
  const cd = cwd ? `cd ${shq(cwd)} 2>/dev/null; ` : '';
  // The command runs in a subshell so `exit` or `cd` in it cannot break the channel.
  return `printf '\\036B${id}\\n'; (${cd}${cmd}\n) 2>&1; printf '\\036E${id} %d\\n' $?\n`;
}

/** Splits the service-channel stream into replies; noise between frames (prompts) is ignored. */
export class ServiceParser {
  private buf = '';
  feed(chunk: string): ServiceReply[] {
    this.buf += chunk.replace(/\r/g, '');
    const out: ServiceReply[] = [];
    for (;;) {
      const b = this.buf.indexOf(`${RS}B`);
      if (b < 0) {
        // Nothing framed yet: keep only a possible start of a marker.
        const rs = this.buf.lastIndexOf(RS);
        this.buf = rs >= 0 ? this.buf.slice(rs) : '';
        break;
      }
      const nl = this.buf.indexOf('\n', b);
      if (nl < 0) {
        this.buf = this.buf.slice(b);
        break;
      }
      const id = Number(this.buf.slice(b + 2, nl));
      const endTag = `${RS}E${id} `;
      const e = this.buf.indexOf(endTag, nl);
      if (e < 0) {
        this.buf = this.buf.slice(b);
        break;
      }
      const enl = this.buf.indexOf('\n', e);
      if (enl < 0) {
        this.buf = this.buf.slice(b);
        break;
      }
      out.push({ id, out: this.buf.slice(nl + 1, e), exit: Number(this.buf.slice(e + endTag.length, enl)) || 0 });
      this.buf = this.buf.slice(enl + 1);
    }
    return out;
  }
}

// ── Facts ─────────────────────────────────────────────────────────────────

/**
 * The fact-collecting script for BusyBox ash. Process data is read with the
 * `read` built-in (no fork); only the NUL-separated command line needs `tr`.
 * Regular files up to 64 KiB come back in base64, so any bytes survive the
 * serial line.
 */
export function factsScript(paths: string[], shellPidFile = '/tmp/.dt-shell'): string {
  const files = paths.length
    ? `for f in ${paths.map(shq).join(' ')}; do
if [ -e "$f" ] || [ -h "$f" ]; then echo "F $f"; ls -ldin "$f" 2>/dev/null; [ -h "$f" ] && echo "L $(readlink "$f")"
if [ -f "$f" ] && [ ! -h "$f" ] && [ -r "$f" ] && [ "$(wc -c < "$f")" -le 65536 ]; then echo "C"; base64 "$f"; echo "."; fi
else echo "N $f"; fi; done`
    : '';
  return `echo "K $(uname -r)"; echo "H $(hostname)"; [ -r ${shellPidFile} ] && read -r sp < ${shellPidFile} && echo "S $sp" && echo "D $(readlink /proc/$sp/cwd)"
for p in /proc/[0-9]*; do [ -r "$p/stat" ] || continue; read -r st < "$p/stat" 2>/dev/null || continue; u=0
while read -r k v r; do [ "$k" = "Uid:" ] && { u=$v; break; }; done < "$p/status"
echo "P $u $st"; printf 'A %s ' "\${p#/proc/}"; tr '\\0' ' ' < "$p/cmdline" 2>/dev/null; echo; done
echo "W"; cat /etc/passwd; echo "."; echo "G"; cat /etc/group; echo "."
${files}`;
}

export interface RawFacts {
  kernel: string;
  hostname: string;
  shellPid?: number;
  shellCwd?: string;
  procs: ProcFact[];
  files: Record<string, FileFact>;
  users: { name: string; uid: number; gid: number; home: string; shell: string }[];
  groups: { name: string; gid: number; members: string[] }[];
}

/** '-rwsr-xr-x' → '4755'. */
export function modeToOctal(m: string): string {
  const bit = (c: string, on: string) => (on.includes(c) ? 1 : 0);
  const tri = (s: string) => bit(s[0], 'r') * 4 + bit(s[1], 'w') * 2 + bit(s[2], 'xst');
  const u = m.slice(1, 4);
  const g = m.slice(4, 7);
  const o = m.slice(7, 10);
  const special = (/[sS]/.test(u[2]) ? 4 : 0) + (/[sS]/.test(g[2]) ? 2 : 0) + (/[tT]/.test(o[2]) ? 1 : 0);
  return `${special}${tri(u)}${tri(g)}${tri(o)}`;
}

const TYPE: Record<string, FileFact['type']> = { '-': 'f', d: 'd', l: 'l', c: 'c' };
const STATE = new Set(['R', 'S', 'D', 'T', 'Z', 'I']);

function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Parse what factsScript printed. */
export function parseFacts(out: string): RawFacts {
  const r: RawFacts = { kernel: '', hostname: '', procs: [], files: {}, users: [], groups: [] };
  const lines = out.replace(/\r/g, '').split('\n');
  const argv = new Map<number, string[]>();
  let file: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const tag = ln.slice(0, 2);
    if (tag === 'K ') r.kernel = ln.slice(2).trim();
    else if (tag === 'H ') r.hostname = ln.slice(2).trim();
    else if (tag === 'S ') r.shellPid = Number(ln.slice(2)) || undefined;
    else if (tag === 'D ') r.shellCwd = ln.slice(2).trim() || undefined;
    else if (tag === 'P ') {
      // "P <uid> <pid> (<comm>) <state> <ppid> …"
      const m = /^P (\d+) (\d+) \((.*)\) (\S) (-?\d+)/.exec(ln);
      if (!m) continue;
      const state = STATE.has(m[4]) ? (m[4] as ProcFact['state']) : 'S';
      r.procs.push({ pid: Number(m[2]), ppid: Number(m[5]), uid: Number(m[1]), state, cmd: m[3], argv: [] });
    } else if (tag === 'A ') {
      const m = /^A (\d+) ?(.*)$/.exec(ln);
      if (m) argv.set(Number(m[1]), m[2].trim() ? m[2].trim().split(/ +/) : []);
    } else if (ln === 'W' || ln === 'G') {
      const isUsers = ln === 'W';
      for (i++; i < lines.length && lines[i] !== '.'; i++) {
        const f = lines[i].split(':');
        if (isUsers && f.length >= 7) r.users.push({ name: f[0], uid: Number(f[2]), gid: Number(f[3]), home: f[5], shell: f[6] });
        if (!isUsers && f.length >= 3) r.groups.push({ name: f[0], gid: Number(f[2]), members: f[3] ? f[3].split(',').filter(Boolean) : [] });
      }
    } else if (tag === 'F ') {
      file = ln.slice(2);
      const st = lines[i + 1] ?? '';
      const m = /^\s*(\d+)\s+([-dlcbps])([-rwxsStT]{9})\S*\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(,?)/.exec(st);
      if (m) {
        i++;
        r.files[file] = { exists: true, type: TYPE[m[2]] ?? 'f', mode: modeToOctal(m[2] + m[3]), ino: Number(m[1]), nlink: Number(m[4]), uid: Number(m[5]), gid: Number(m[6]), size: m[8] ? 0 : Number(m[7]) };
      } else r.files[file] = { exists: true };
    } else if (tag === 'L ' && file) r.files[file].target = ln.slice(2);
    else if (ln === 'C' && file) {
      const chunks: string[] = [];
      for (i++; i < lines.length && lines[i] !== '.'; i++) chunks.push(lines[i]);
      try {
        r.files[file].text = decodeBase64(chunks.join(''));
      } catch {
        /* not base64: leave text out */
      }
    } else if (tag === 'N ') r.files[ln.slice(2)] = { exists: false };
  }
  for (const p of r.procs) p.argv = argv.get(p.pid) ?? [p.cmd];
  const byUid = new Map(r.users.map((u) => [u.uid, u.name]));
  const byGid = new Map(r.groups.map((g) => [g.gid, g.name]));
  for (const p of r.procs) p.user = byUid.get(p.uid);
  for (const f of Object.values(r.files)) {
    if (f.uid !== undefined) f.owner = byUid.get(f.uid);
    if (f.gid !== undefined) f.group = byGid.get(f.gid);
  }
  return r;
}

/** Remove the service shell and everything it started from the learner's view of processes. */
export function hideService(procs: ProcFact[], servicePid: number | undefined): ProcFact[] {
  if (!servicePid) return procs;
  const hidden = new Set<number>([servicePid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of procs)
      if (!hidden.has(p.pid) && hidden.has(p.ppid)) {
        hidden.add(p.pid);
        grew = true;
      }
  }
  // The `setsid sh -c …` wrapper that started the service shell, if it is still there.
  const svc = procs.find((p) => p.pid === servicePid);
  if (svc && procs.some((p) => p.pid === svc.ppid && p.argv.join(' ').includes('/dev/ttyS1'))) hidden.add(svc.ppid);
  return procs.filter((p) => !hidden.has(p.pid));
}

/**
 * Paths a check reads, taken from predicate strings: files['/etc/x'] and
 * @start.files['/x']. The machine collects only these (a real file system is
 * too big to list on every check).
 */
export function watchedPaths(predicates: (string | undefined)[], home = '/root'): string[] {
  const out = new Set<string>();
  for (const p of predicates) {
    if (!p) continue;
    for (const m of p.matchAll(/files\[\s*(['"])(.+?)\1\s*\]/g)) {
      const path = m[2].startsWith('~') ? home + m[2].slice(1) : m[2];
      if (path.startsWith('/')) out.add(path.replace(/\/+$/, '') || '/');
    }
  }
  return [...out].sort();
}
