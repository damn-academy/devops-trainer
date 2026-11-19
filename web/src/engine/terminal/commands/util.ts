// Helpers for writing simulated commands that behave like GNU coreutils.

import type { Bi, CmdContext, ManPage, ShellCommand } from '../../../core/types';
import { isFsError } from '../vfs';

export interface FlagSpec {
  /** Short flags without a value: 'laAihd1'. */
  short?: string;
  /** Short flags that take a value: 'n' for `-n 5` / `-n5`. */
  withValue?: string;
  /** Long options mapped to short letters or to their own names: { all: 'a', 'preserve-root': 'preserve-root' }. */
  long?: Record<string, string>;
  /** Long options that take a value (by mapped name). */
  longWithValue?: string[];
}

export interface ParsedArgs {
  flags: Set<string>;
  values: Record<string, string>;
  operands: string[];
  error?: string;
}

/** getopt-like parsing: bundled short flags, `--long`, `--long=value`, `--` ends options. */
export function parseArgs(args: string[], spec: FlagSpec): ParsedArgs {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const operands: string[] = [];
  const short = spec.short ?? '';
  const withValue = spec.withValue ?? '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const [name, inline] = a.slice(2).split(/=(.*)/s, 2);
      const mapped = spec.long?.[name];
      if (mapped === undefined) return { flags, values, operands, error: `unrecognized option '--${name}'` };
      const takes = withValue.includes(mapped) || spec.longWithValue?.includes(mapped);
      if (takes) {
        const v = inline ?? args[++i];
        if (v === undefined) return { flags, values, operands, error: `option '--${name}' requires an argument` };
        values[mapped] = v;
      } else flags.add(mapped);
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const c = a[j];
        if (withValue.includes(c)) {
          const v = a.slice(j + 1) || args[++i];
          if (v === undefined) return { flags, values, operands, error: `option requires an argument -- '${c}'` };
          values[c] = v;
          break;
        }
        if (!short.includes(c)) return { flags, values, operands, error: `invalid option -- '${c}'` };
        flags.add(c);
      }
      continue;
    }
    operands.push(a);
  }
  return { flags, values, operands };
}

/** Print the GNU-style usage error and return exit code 2. */
export function usageError(ctx: CmdContext, msg: string): number {
  const name = ctx.argv[0];
  ctx.err(`${name}: ${msg}\nTry '${name} --help' for more information.\n`);
  return 2;
}

/** Report a file-system error the way coreutils do: "cat: x: No such file or directory". */
export function fsErr(ctx: CmdContext, e: unknown, path: string, verb?: string): number {
  if (isFsError(e)) {
    ctx.err(verb ? `${ctx.argv[0]}: ${verb} '${path}': ${e.text}\n` : `${ctx.argv[0]}: ${path}: ${e.text}\n`);
    return 1;
  }
  throw e;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 18 16:54" as ls -l prints recent files (UTC). */
export function lsTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 1.5K, 12M — as ls -h prints. */
export function humanSize(n: number): string {
  if (n < 1024) return String(n);
  const units = ['K', 'M', 'G', 'T'];
  let v = n;
  let u = -1;
  do {
    v /= 1024;
    u++;
  } while (v >= 1024 && u < units.length - 1);
  return (v < 10 ? Math.ceil(v * 10) / 10 : Math.ceil(v)).toString() + units[u];
}

/** Lay names out in columns like ls does on a terminal. `width` is the visible length (without ANSI). */
export function columns(items: { text: string; width: number }[], cols: number): string {
  if (!items.length) return '';
  const max = Math.max(...items.map((i) => i.width)) + 2;
  const perRow = Math.max(1, Math.floor(cols / max));
  const rows = Math.ceil(items.length / perRow);
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < perRow; c++) {
      const idx = c * rows + r;
      if (idx >= items.length) continue;
      const it = items[idx];
      const lastInRow = (c + 1) * rows + r >= items.length;
      line += lastInRow ? it.text : it.text + ' '.repeat(max - it.width);
    }
    out.push(line.trimEnd());
  }
  return out.join('\n') + '\n';
}

// ── one spec → --help text and man page ──


export interface CmdDoc {
  name: string;
  summary: Bi;
  /** Manual section: 1 user commands, 8 administration. */
  section?: number | string;
  /** NAME line after the dash: "output the first part of files". */
  whatis: string;
  /** SYNOPSIS lines without "Usage:". */
  synopsis: string[];
  /** DESCRIPTION paragraphs (English, as in the real page, condensed). */
  description: string;
  /** [flags, text] in the order of the real page. */
  options?: [string, string][];
  exit?: string;
  examples?: [string, string][];
  seeAlso?: string;
  /** Extra sections of the real page that lessons point at (FILES, NOTES, STANDARD FORMAT SPECIFIERS…). */
  extra?: { id: string; body: string }[];
  /** man7.org or manpages.debian.org page; built from name and section when absent. */
  url?: string;
  /** Text after the options in --help (GNU puts notes there). */
  helpTail?: string;
}

const wrapHelp = (flags: string, text: string) => {
  const pad = 2 + Math.max(flags.length + 2, 24);
  return `  ${flags.padEnd(pad - 2)}${text}`;
};

export function cmdDoc(d: CmdDoc): Pick<ShellCommand, 'name' | 'summary' | 'help' | 'man'> {
  const sec = d.section ?? 1;
  const help = [
    `Usage: ${d.synopsis[0]}`,
    ...d.synopsis.slice(1).map((s) => `  or:  ${s}`),
    d.description.split('\n')[0],
    ...(d.options?.length ? ['', ...d.options.map(([f, t]) => wrapHelp(f, t.split('\n')[0]))] : []),
    ...(d.helpTail ? ['', d.helpTail] : []),
    ...(d.exit ? ['', 'Exit status:', ...d.exit.split('\n').map((l) => ` ${l}`)] : []),
  ].join('\n');
  const sections: ManPage['sections'] = [
    { id: 'NAME', body: `${d.name} - ${d.whatis}` },
    { id: 'SYNOPSIS', body: d.synopsis.join('\n') },
    { id: 'DESCRIPTION', body: d.description },
  ];
  if (d.options?.length) sections.push({ id: 'OPTIONS', body: d.options.map(([f, t]) => `${f}\n${t.split('\n').map((l) => `       ${l}`).join('\n')}`).join('\n') });
  for (const e of d.extra ?? []) sections.push(e);
  if (d.exit) sections.push({ id: 'EXIT STATUS', body: d.exit });
  if (d.examples?.length) sections.push({ id: 'EXAMPLES', body: d.examples.map(([c, t]) => `${c}\n    ${t}`).join('\n') });
  if (d.seeAlso) sections.push({ id: 'SEE ALSO', body: d.seeAlso });
  const s = String(sec);
  return {
    name: d.name,
    summary: d.summary,
    help,
    man: {
      section: sec,
      url: d.url ?? `https://man7.org/linux/man-pages/man${s[0]}/${d.name}.${s}.html`,
      license: 'condensed from the Linux man-pages project, GNU coreutils, util-linux, procps-ng and systemd documentation',
      sections,
    },
  };
}

/** Lines of a text, without the empty string after the last newline. */
export function lines(text: string): string[] {
  const l = text.split('\n');
  if (text.endsWith('\n')) l.pop();
  return text === '' ? [] : l;
}

/** Read FILE operands (or stdin for none / "-"), reporting errors like coreutils. */
export function readInputs(ctx: CmdContext, files: string[]): { name: string; text: string }[] & { failed?: boolean } {
  const out: { name: string; text: string }[] & { failed?: boolean } = [];
  for (const f of files.length ? files : ['-']) {
    if (f === '-') {
      out.push({ name: '-', text: ctx.stdin });
      continue;
    }
    try {
      const st = ctx.fs.stat(f);
      if (st?.type === 'd') {
        ctx.err(`${ctx.argv[0]}: ${f}: Is a directory\n`);
        out.failed = true;
        continue;
      }
      out.push({ name: f, text: ctx.fs.readFile(f) });
    } catch (e) {
      fsErr(ctx, e, f);
      out.failed = true;
    }
  }
  return out;
}
