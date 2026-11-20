// Text tools: head, tail, less, wc, sort, uniq, cut, tr, sed, awk, tee,
// xargs, diff, printf, seq, nl, rev. Behaviour follows GNU coreutils 9,
// sed 4.9 and gawk 5 for the subset the course uses.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { isFsError } from '../vfs';
import { shq } from './files';
import { cmdDoc, fsErr, lines, parseArgs, readInputs, usageError } from './util';

/** -n 5, -5, -n +3, -n -3 */
function countArg(args: string[]): { args: string[]; n?: string } {
  const out: string[] = [];
  let n: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (/^-\d+$/.test(a)) n = a.slice(1);
    else if (a === '-n' || a === '--lines') n = args[++i];
    else if (a.startsWith('--lines=')) n = a.slice(8);
    else if (/^-n[+-]?\d+$/.test(a)) n = a.slice(2);
    else out.push(a);
  }
  return { args: out, n };
}

const head: ShellCommand = {
  ...cmdDoc({
    name: 'head',
    summary: bi('показать начало файла', 'output the first part of files'),
    whatis: 'output the first part of files',
    synopsis: ['head [OPTION]... [FILE]...'],
    description: 'Print the first 10 lines of each FILE to standard output. With more than one FILE, precede each with a header giving the file name.\nWith no FILE, or when FILE is -, read standard input.',
    options: [
      ['-c, --bytes=[-]NUM', 'print the first NUM bytes of each file; with the leading \'-\', print all but the last NUM bytes of each file'],
      ['-n, --lines=[-]NUM', "print the first NUM lines instead of the first 10; with the leading '-', print all but the last NUM lines of each file"],
      ['-q, --quiet, --silent', 'never print headers giving file names'],
    ],
    seeAlso: 'tail(1)',
  }),
  run(ctx) {
    const { args, n } = countArg(ctx.argv.slice(1));
    const a = parseArgs(args, { short: 'qv', withValue: 'c', long: { quiet: 'q', silent: 'q', bytes: 'c', verbose: 'v' } });
    if (a.error) return usageError(ctx, a.error);
    const count = n !== undefined ? Number(n) : 10;
    if (Number.isNaN(count)) {
      ctx.err(`head: invalid number of lines: '${n}'\n`);
      return 1;
    }
    const inputs = readInputs(ctx, a.operands);
    inputs.forEach((inp, i) => {
      if (inputs.length > 1 && !a.flags.has('q')) ctx.out(`${i ? '\n' : ''}==> ${inp.name === '-' ? 'standard input' : inp.name} <==\n`);
      if (a.values.c !== undefined) {
        ctx.out(inp.text.slice(0, Number(a.values.c)));
        return;
      }
      const l = lines(inp.text);
      const pick = n?.startsWith('-') ? l.slice(0, Math.max(0, l.length - Math.abs(count))) : l.slice(0, Math.abs(count));
      if (pick.length) ctx.out(pick.join('\n') + '\n');
    });
    return inputs.failed ? 1 : 0;
  },
};

const tail: ShellCommand = {
  ...cmdDoc({
    name: 'tail',
    summary: bi('показать конец файла, следить за ним', 'output the last part of files, follow them'),
    whatis: 'output the last part of files',
    synopsis: ['tail [OPTION]... [FILE]...'],
    description: 'Print the last 10 lines of each FILE to standard output. With more than one FILE, precede each with a header giving the file name.\nWith no FILE, or when FILE is -, read standard input.',
    options: [
      ['-c, --bytes=[+]NUM', 'output the last NUM bytes; or use -c +NUM to output starting with byte NUM of each file'],
      ['-f, --follow[={name|descriptor}]', 'output appended data as the file grows; an absent option argument means \'descriptor\''],
      ['-F', 'same as --follow=name --retry'],
      ['-n, --lines=[+]NUM', 'output the last NUM lines, instead of the last 10; or use -n +NUM to skip NUM-1 lines at the start'],
      ['-q, --quiet, --silent', 'never output headers giving file names'],
    ],
    extra: [
      {
        id: 'NOTES',
        body: 'With --follow (-f), tail defaults to following the file descriptor, which means that even if a tail\'ed file is renamed, tail will continue to track its end. This default behavior is not desirable when you really want to track the actual name of the file, not the file descriptor (e.g., log rotation). Use --follow=name in that case. That causes tail to track the named file in a way that accommodates renaming, removal and creation.',
      },
    ],
    examples: [
      ['tail -n 20 /var/log/nginx/error.log', 'The last twenty lines of a log.'],
      ['tail -f /var/log/app.log', 'Keep printing new lines as they are written; Ctrl+C stops it.'],
    ],
    seeAlso: 'head(1), less(1)',
  }),
  run(ctx) {
    const { args, n } = countArg(ctx.argv.slice(1));
    const a = parseArgs(args, { short: 'fFqv', withValue: 'c', long: { follow: 'f', quiet: 'q', silent: 'q', bytes: 'c', retry: 'retry' } });
    if (a.error) return usageError(ctx, a.error);
    const count = n !== undefined ? Number(n.replace(/^\+/, '')) : 10;
    const inputs = readInputs(ctx, a.operands);
    inputs.forEach((inp, i) => {
      if (inputs.length > 1 && !a.flags.has('q')) ctx.out(`${i ? '\n' : ''}==> ${inp.name === '-' ? 'standard input' : inp.name} <==\n`);
      if (a.values.c !== undefined) {
        ctx.out(inp.text.slice(-Number(a.values.c)));
        return;
      }
      const l = lines(inp.text);
      const pick = n?.startsWith('+') ? l.slice(Math.max(0, count - 1)) : l.slice(Math.max(0, l.length - count));
      if (pick.length) ctx.out(pick.join('\n') + '\n');
    });
    if ((a.flags.has('f') || a.flags.has('F')) && a.operands.length) {
      ctx.err('\x1b[2m(tail is following the file; on this simulated machine new lines show up the next time you run tail — the real tail keeps running until Ctrl+C)\x1b[0m\n');
    }
    return inputs.failed ? 1 : 0;
  },
};

const less: ShellCommand = {
  ...cmdDoc({
    name: 'less',
    summary: bi('листать длинный текст', 'page through text'),
    whatis: 'opposite of more',
    synopsis: ['less [options] [file...]'],
    description: 'less is a program similar to more(1), but it allows backward movement in the file as well as forward movement. less does not have to read the entire input file before starting.',
    extra: [
      {
        id: 'COMMANDS',
        body: 'SPACE or f    Scroll forward one window.\nb             Scroll backward one window.\nj or RETURN   Scroll forward one line.\nk             Scroll backward one line.\ng             Go to the first line.\nG             Go to the last line.\n/pattern      Search forward for the next line containing pattern.\nn             Repeat the previous search.\nq             Exit.',
      },
    ],
    seeAlso: 'more(1), man(1)',
  }),
  run(ctx) {
    const files = ctx.argv.slice(1).filter((x) => !x.startsWith('-') || x === '-');
    const inputs = readInputs(ctx, files);
    const text = inputs.map((i) => i.text).join('');
    if (!ctx.isatty) {
      ctx.out(text);
      return inputs.failed ? 1 : 0;
    }
    if (text) ctx.effect({ kind: 'pager', title: files[0] ?? 'standard input', text });
    return inputs.failed ? 1 : 0;
  },
};

const wc: ShellCommand = {
  ...cmdDoc({
    name: 'wc',
    summary: bi('посчитать строки, слова и байты', 'count lines, words and bytes'),
    whatis: 'print newline, word, and byte counts for each file',
    synopsis: ['wc [OPTION]... [FILE]...'],
    description: 'Print newline, word, and byte counts for each FILE, and a total line if more than one FILE is specified. A word is a non-zero-length sequence of printable characters delimited by white space.\nWith no FILE, or when FILE is -, read standard input.',
    options: [
      ['-c, --bytes', 'print the byte counts'],
      ['-m, --chars', 'print the character counts'],
      ['-l, --lines', 'print the newline counts'],
      ['-w, --words', 'print the word counts'],
      ['-L, --max-line-length', 'print the maximum display width'],
    ],
    seeAlso: 'uniq(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'cmlwL', long: { bytes: 'c', chars: 'm', lines: 'l', words: 'w', 'max-line-length': 'L' } });
    if (a.error) return usageError(ctx, a.error);
    const f = a.flags.size ? a.flags : new Set(['l', 'w', 'c']);
    const inputs = readInputs(ctx, a.operands);
    const rows: { v: number[]; name: string }[] = [];
    const tot = [0, 0, 0, 0, 0];
    for (const inp of inputs) {
      const t = inp.text;
      const v = [(t.match(/\n/g) ?? []).length, t.split(/\s+/).filter(Boolean).length, [...t].length, new TextEncoder().encode(t).length, Math.max(0, ...lines(t).map((l) => l.length))];
      v.forEach((x, i) => (tot[i] = i === 4 ? Math.max(tot[i], x) : tot[i] + x));
      rows.push({ v, name: inp.name === '-' ? '' : inp.name });
    }
    if (rows.length > 1) rows.push({ v: tot, name: 'total' });
    const order: [string, number][] = [['l', 0], ['w', 1], ['m', 2], ['c', 3], ['L', 4]];
    const cols = order.filter(([k]) => f.has(k)).map(([, i]) => i);
    const width = cols.length === 1 && rows.length === 1 && !rows[0].name ? 0 : Math.max(...rows.flatMap((r) => cols.map((c) => String(r.v[c]).length)), a.operands.length ? 1 : 7);
    for (const r of rows) ctx.out(cols.map((c) => String(r.v[c]).padStart(width)).join(' ') + (r.name ? ` ${r.name}` : '') + '\n');
    return inputs.failed ? 1 : 0;
  },
};

function keyOf(line: string, k: string | undefined, sep: string | undefined): string {
  if (!k) return line;
  const m = /^(\d+)(?:\.(\d+))?[a-zA-Z]*(?:,(\d+))?/.exec(k);
  if (!m) return line;
  const start = Number(m[1]);
  const end = m[3] ? Number(m[3]) : undefined;
  const fields = sep !== undefined ? line.split(sep) : line.trim().split(/\s+/);
  const picked = fields.slice(start - 1, end ?? fields.length);
  return picked.join(sep ?? ' ');
}

const HUMAN: Record<string, number> = { K: 1, M: 2, G: 3, T: 4 };
function humanNum(s: string): number {
  const m = /^\s*([\d.]+)([KMGT]?)/i.exec(s);
  return m ? Number(m[1]) * 1024 ** (HUMAN[m[2].toUpperCase()] ?? 0) : 0;
}

const sort: ShellCommand = {
  ...cmdDoc({
    name: 'sort',
    summary: bi('упорядочить строки', 'sort lines of text'),
    whatis: 'sort lines of text files',
    synopsis: ['sort [OPTION]... [FILE]...'],
    description: 'Write sorted concatenation of all FILE(s) to standard output. With no FILE, or when FILE is -, read standard input.\nsort has to read all of its input before it can print the first line.',
    options: [
      ['-f, --ignore-case', 'fold lower case to upper case characters'],
      ['-h, --human-numeric-sort', 'compare human readable numbers (e.g., 2K 1G)'],
      ['-n, --numeric-sort', 'compare according to string numerical value'],
      ['-r, --reverse', 'reverse the result of comparisons'],
      ['-k, --key=KEYDEF', 'sort via a key; KEYDEF gives location and type'],
      ['-t, --field-separator=SEP', 'use SEP instead of non-blank to blank transition'],
      ['-u, --unique', 'output only the first of an equal run'],
    ],
    extra: [{ id: 'KEYDEF', body: 'KEYDEF is F[.C][OPTS][,F[.C][OPTS]] for start and stop position, where F is a field number and C a character position in the field; both are origin 1. -k 2 means "from field 2 to the end of the line"; -k 2,2 means "field 2 only".' }],
    examples: [
      ['sort -n -k 2 sizes.txt', 'By the number in the second column.'],
      ['cut -d" " -f1 access.log | sort | uniq -c | sort -rn | head', 'The most frequent first fields: count, then sort the counts.'],
    ],
    seeAlso: 'uniq(1), shuf(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'fhnruV', withValue: 'kt', long: { 'ignore-case': 'f', 'human-numeric-sort': 'h', 'numeric-sort': 'n', reverse: 'r', unique: 'u', key: 'k', 'field-separator': 't', 'version-sort': 'V' } });
    if (a.error) return usageError(ctx, a.error);
    const f = a.flags;
    const inputs = readInputs(ctx, a.operands);
    let all = inputs.flatMap((i) => lines(i.text));
    const sep = a.values.t;
    const kmods = a.values.k ? /[nrhf]+/.exec(a.values.k.replace(/^\d+(\.\d+)?/, ''))?.[0] ?? '' : '';
    const num = f.has('n') || kmods.includes('n');
    const hum = f.has('h') || kmods.includes('h');
    const rev = f.has('r') || kmods.includes('r');
    const cmp = (x: string, y: string) => {
      const kx = keyOf(x, a.values.k, sep);
      const ky = keyOf(y, a.values.k, sep);
      let r: number;
      if (num) r = (parseFloat(kx) || 0) - (parseFloat(ky) || 0);
      else if (hum) r = humanNum(kx) - humanNum(ky);
      else {
        const A = f.has('f') ? kx.toUpperCase() : kx;
        const B = f.has('f') ? ky.toUpperCase() : ky;
        r = A < B ? -1 : A > B ? 1 : 0;
      }
      if (r === 0 && !f.has('u')) r = x < y ? -1 : x > y ? 1 : 0;
      return rev ? -r : r;
    };
    all.sort(cmp);
    if (f.has('u')) all = all.filter((l, i) => i === 0 || cmp(all[i - 1], l) !== 0);
    if (all.length) ctx.out(all.join('\n') + '\n');
    return inputs.failed ? 2 : 0;
  },
};

const uniq: ShellCommand = {
  ...cmdDoc({
    name: 'uniq',
    summary: bi('схлопнуть соседние повторы', 'report or omit repeated lines'),
    whatis: 'report or omit repeated lines',
    synopsis: ['uniq [OPTION]... [INPUT [OUTPUT]]'],
    description: "Filter adjacent matching lines from INPUT (or standard input), writing to OUTPUT (or standard output).\nNote: 'uniq' does not detect repeated lines unless they are adjacent. You may want to sort the input first, or use 'sort -u' without 'uniq'.",
    options: [
      ['-c, --count', 'prefix lines by the number of occurrences'],
      ['-d, --repeated', 'only print duplicate lines, one for each group'],
      ['-u, --unique', 'only print unique lines'],
      ['-i, --ignore-case', 'ignore differences in case when comparing'],
    ],
    seeAlso: 'sort(1), comm(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'cdui', long: { count: 'c', repeated: 'd', unique: 'u', 'ignore-case': 'i' } });
    if (a.error) return usageError(ctx, a.error);
    const inputs = readInputs(ctx, a.operands.slice(0, 1));
    const all = inputs.flatMap((i) => lines(i.text));
    const groups: { line: string; n: number }[] = [];
    const eq = (x: string, y: string) => (a.flags.has('i') ? x.toLowerCase() === y.toLowerCase() : x === y);
    for (const l of all) {
      const g = groups[groups.length - 1];
      if (g && eq(g.line, l)) g.n++;
      else groups.push({ line: l, n: 1 });
    }
    let out = '';
    for (const g of groups) {
      if (a.flags.has('d') && g.n < 2) continue;
      if (a.flags.has('u') && g.n > 1) continue;
      out += (a.flags.has('c') ? `${String(g.n).padStart(7)} ` : '') + g.line + '\n';
    }
    if (a.operands[1]) ctx.fs.writeFile(a.operands[1], out);
    else ctx.out(out);
    return inputs.failed ? 1 : 0;
  },
};

/** "1,3-5,7-" → a predicate on 1-based positions. */
function listSpec(spec: string): ((i: number) => boolean) | null {
  const parts = spec.split(',').map((p) => {
    const m = /^(\d*)(-?)(\d*)$/.exec(p);
    if (!m || (!m[1] && !m[3])) return null;
    const lo = m[1] ? Number(m[1]) : 1;
    const hi = m[2] ? (m[3] ? Number(m[3]) : Infinity) : lo;
    return [lo, hi] as const;
  });
  if (parts.some((p) => !p)) return null;
  return (i) => parts.some((p) => i >= p![0] && i <= p![1]);
}

const cut: ShellCommand = {
  ...cmdDoc({
    name: 'cut',
    summary: bi('вырезать поля или символы из строк', 'remove sections from each line'),
    whatis: 'remove sections from each line of files',
    synopsis: ['cut OPTION... [FILE]...'],
    description: 'Print selected parts of lines from each FILE to standard output.\nUse one, and only one of -b, -c or -f. Each LIST is made up of one range, or many ranges separated by commas: N, N-, N-M, -M.',
    options: [
      ['-c, --characters=LIST', 'select only these characters'],
      ['-d, --delimiter=DELIM', 'use DELIM instead of TAB for field delimiter'],
      ['-f, --fields=LIST', 'select only these fields; also print any line that contains no delimiter character, unless the -s option is specified'],
      ['-s, --only-delimited', 'do not print lines not containing delimiters'],
      ['--output-delimiter=STRING', 'use STRING as the output delimiter; the default is to use the input delimiter'],
    ],
    examples: [["cut -d: -f1,7 /etc/passwd", 'User names and their shells.'], ["cut -d' ' -f1 access.log", 'The first field of each line (the client address in a web log).']],
    seeAlso: 'awk(1), paste(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 's', withValue: 'cdfb', long: { characters: 'c', delimiter: 'd', fields: 'f', bytes: 'b', 'only-delimited': 's', 'output-delimiter': 'od' }, longWithValue: ['od'] });
    if (a.error) return usageError(ctx, a.error);
    const spec = a.values.f ?? a.values.c ?? a.values.b;
    if (!spec) return usageError(ctx, 'you must specify a list of bytes, characters, or fields');
    const pick = listSpec(spec);
    if (!pick) {
      ctx.err(`cut: invalid field value '${spec}'\nTry 'cut --help' for more information.\n`);
      return 1;
    }
    const d = a.values.d ?? '\t';
    if (d.length !== 1) {
      ctx.err('cut: the delimiter must be a single character\n');
      return 1;
    }
    const od = a.values.od ?? d;
    const inputs = readInputs(ctx, a.operands);
    for (const l of inputs.flatMap((i) => lines(i.text))) {
      if (a.values.f !== undefined) {
        if (!l.includes(d)) {
          if (!a.flags.has('s')) ctx.out(l + '\n');
          continue;
        }
        ctx.out(l.split(d).filter((_, i) => pick(i + 1)).join(od) + '\n');
      } else ctx.out([...l].filter((_, i) => pick(i + 1)).join('') + '\n');
    }
    return inputs.failed ? 1 : 0;
  },
};

function trSet(s: string): string[] {
  const classes: Record<string, string> = {
    '[:upper:]': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '[:lower:]': 'abcdefghijklmnopqrstuvwxyz',
    '[:digit:]': '0123456789',
    '[:space:]': ' \t\n\r\f\v',
    '[:blank:]': ' \t',
    '[:punct:]': '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
    '[:alpha:]': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    '[:alnum:]': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  };
  let t = s;
  for (const [k, v] of Object.entries(classes)) t = t.split(k).join(v);
  t = t.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i + 1] === '-' && i + 2 < t.length) {
      for (let c = t.charCodeAt(i); c <= t.charCodeAt(i + 2); c++) out.push(String.fromCharCode(c));
      i += 2;
    } else out.push(t[i]);
  }
  return out;
}

const tr: ShellCommand = {
  ...cmdDoc({
    name: 'tr',
    summary: bi('заменить или удалить символы', 'translate or delete characters'),
    whatis: 'translate or delete characters',
    synopsis: ['tr [OPTION]... STRING1 [STRING2]'],
    description: 'Translate, squeeze, and/or delete characters from standard input, writing to standard output. STRING1 and STRING2 specify arrays of characters; ranges like a-z and classes like [:upper:] are allowed.\ntr reads only standard input: tr a-z A-Z < file, not tr a-z A-Z file.',
    options: [
      ['-d, --delete', 'delete characters in SET1, do not translate'],
      ['-s, --squeeze-repeats', 'replace each sequence of a repeated character that is listed in the last specified SET, with a single occurrence of that character'],
      ['-c, -C, --complement', 'use the complement of SET1'],
    ],
    examples: [["tr 'a-z' 'A-Z' < notes.txt", 'Upper case.'], ["tr -s ' ' < table.txt", 'Squeeze runs of spaces into one.']],
    seeAlso: 'sed(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'dscC', long: { delete: 'd', 'squeeze-repeats': 's', complement: 'c' } });
    if (a.error) return usageError(ctx, a.error);
    const [s1, s2] = a.operands;
    if (s1 === undefined) return usageError(ctx, 'missing operand');
    if (a.operands.length > 2) {
      ctx.err(`tr: extra operand '${a.operands[2]}'\nOnly one string may be given when deleting without squeezing repeats.\nTry 'tr --help' for more information.\n`);
      return 1;
    }
    const set1 = trSet(s1);
    const set2 = s2 !== undefined ? trSet(s2) : [];
    const comp = a.flags.has('c') || a.flags.has('C');
    const in1 = (c: string) => set1.includes(c) !== comp;
    let out = '';
    for (const c of ctx.stdin) {
      if (a.flags.has('d')) {
        if (!in1(c)) out += c;
        continue;
      }
      if (s2 !== undefined) {
        const i = set1.indexOf(c);
        out += comp ? (in1(c) ? set2[set2.length - 1] : c) : i >= 0 ? (set2[Math.min(i, set2.length - 1)] ?? c) : c;
      } else out += c;
    }
    if (a.flags.has('s')) {
      const sq = s2 !== undefined ? set2 : set1;
      let r = '';
      for (const c of out) if (!(r.endsWith(c) && sq.includes(c))) r += c;
      out = r;
    }
    ctx.out(out);
    return 0;
  },
};

// ── sed: s///, p, d, addresses, -n, -i, -E ──

interface SedCmd {
  addr?: { kind: 'line' | 'last' | 're'; n?: number; re?: RegExp }[];
  neg?: boolean;
  op: 's' | 'p' | 'd' | 'q' | '=' | 'a' | 'i';
  text?: string;
  re?: RegExp;
  rep?: string;
  global?: boolean;
  print?: boolean;
}

function sedRegex(src: string, ere: boolean, flags: string): RegExp {
  let js = src;
  if (!ere) {
    let out = '';
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '\\' && i + 1 < src.length) {
        const n = src[++i];
        out += '(){}|+?'.includes(n) ? n : `\\${n}`;
      } else if ('(){}|+?'.includes(c)) out += `\\${c}`;
      else out += c;
    }
    js = out;
  }
  return new RegExp(js, flags);
}

function parseSed(script: string, ere: boolean): SedCmd[] | string {
  const cmds: SedCmd[] = [];
  let i = 0;
  const s = script;
  const readRe = (delim: string) => {
    let r = '';
    while (i < s.length && s[i] !== delim) {
      if (s[i] === '\\' && s[i + 1] === delim) {
        r += delim;
        i += 2;
        continue;
      }
      if (s[i] === '\\') {
        r += s[i] + (s[i + 1] ?? '');
        i += 2;
        continue;
      }
      r += s[i++];
    }
    if (s[i] !== delim) throw new Error('unterminated');
    i++;
    return r;
  };
  try {
    while (i < s.length) {
      while (i < s.length && /[\s;]/.test(s[i])) i++;
      if (i >= s.length) break;
      const cmd: SedCmd = { op: 'p' };
      const addr: NonNullable<SedCmd['addr']> = [];
      const readAddr = () => {
        if (/\d/.test(s[i])) {
          let n = '';
          while (/\d/.test(s[i])) n += s[i++];
          addr.push({ kind: 'line', n: Number(n) });
          return true;
        }
        if (s[i] === '$') {
          i++;
          addr.push({ kind: 'last' });
          return true;
        }
        if (s[i] === '/') {
          i++;
          addr.push({ kind: 're', re: sedRegex(readRe('/'), ere, '') });
          return true;
        }
        return false;
      };
      if (readAddr() && s[i] === ',') {
        i++;
        readAddr();
      }
      if (addr.length) cmd.addr = addr;
      if (s[i] === '!') {
        cmd.neg = true;
        i++;
      }
      const op = s[i++];
      if (op === 's') {
        const delim = s[i++];
        const re = readRe(delim);
        const rep = readRe(delim);
        let flags = '';
        while (i < s.length && /[gpiI0-9]/.test(s[i])) flags += s[i++];
        cmd.op = 's';
        cmd.re = sedRegex(re, ere, (flags.includes('g') ? 'g' : '') + (/[iI]/.test(flags) ? 'i' : ''));
        cmd.rep = rep;
        cmd.global = flags.includes('g');
        cmd.print = flags.includes('p');
      } else if (op === 'a' || op === 'i') {
        cmd.op = op;
        let t = '';
        if (s[i] === '\\') i++;
        while (i < s.length && s[i] === ' ') i++;
        while (i < s.length && s[i] !== '\n' && s[i] !== ';') t += s[i++];
        cmd.text = t.replace(/\\n/g, '\n');
      } else if (op === 'p' || op === 'd' || op === 'q' || op === '=') cmd.op = op;
      else return `sed: -e expression #1, char ${i}: unknown command: \`${op ?? ''}'`;
      cmds.push(cmd);
    }
  } catch {
    return `sed: -e expression #1, char ${s.length}: unterminated \`s' command`;
  }
  return cmds;
}

function sedReplace(rep: string, m: RegExpExecArray | string[]): string {
  let out = '';
  for (let i = 0; i < rep.length; i++) {
    const c = rep[i];
    if (c === '\\' && i + 1 < rep.length) {
      const n = rep[++i];
      if (/\d/.test(n)) out += m[Number(n)] ?? '';
      else if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else out += n;
    } else if (c === '&') out += m[0];
    else out += c;
  }
  return out;
}

export function runSed(text: string, cmds: SedCmd[], quiet: boolean): string {
  const ls = lines(text);
  let out = '';
  const ranges = new Map<SedCmd, boolean>();
  const hit = (c: SedCmd, line: string, n: number, last: boolean): boolean => {
    if (!c.addr) return true;
    const one = (a: NonNullable<SedCmd['addr']>[number]) => (a.kind === 'line' ? n === a.n : a.kind === 'last' ? last : a.re!.test(line));
    if (c.addr.length === 1) return one(c.addr[0]);
    const inRange = ranges.get(c) ?? false;
    if (!inRange) {
      if (one(c.addr[0])) {
        ranges.set(c, !(c.addr[1].kind === 'line' && c.addr[1].n! <= n));
        return true;
      }
      return false;
    }
    if (one(c.addr[1])) ranges.set(c, false);
    return true;
  };
  for (let n = 1; n <= ls.length; n++) {
    let line = ls[n - 1];
    const last = n === ls.length;
    let deleted = false;
    let quit = false;
    const after: string[] = [];
    for (const c of cmds) {
      const h = hit(c, line, n, last) !== !!c.neg;
      if (!h) continue;
      if (c.op === 's') {
        const re = c.re!;
        let changed = false;
        if (c.global) {
          line = line.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), (...args) => {
            changed = true;
            const groups = args.slice(0, -2) as string[];
            return sedReplace(c.rep!, groups);
          });
        } else {
          const m = new RegExp(re.source, re.flags.replace('g', '')).exec(line);
          if (m) {
            changed = true;
            line = line.slice(0, m.index) + sedReplace(c.rep!, m) + line.slice(m.index + m[0].length);
          }
        }
        if (changed && c.print) out += line + '\n';
      } else if (c.op === 'p') out += line + '\n';
      else if (c.op === 'a') after.push(c.text ?? '');
      else if (c.op === 'i') out += (c.text ?? '') + '\n';
      else if (c.op === '=') out += `${n}\n`;
      else if (c.op === 'd') {
        deleted = true;
        break;
      } else if (c.op === 'q') {
        quit = true;
        break;
      }
    }
    if (!deleted && !quiet) out += line + '\n';
    for (const a of after) out += a + '\n';
    if (quit) break;
  }
  return out;
}

const sed: ShellCommand = {
  ...cmdDoc({
    name: 'sed',
    summary: bi('потоковый редактор: заменить текст по образцу', 'stream editor: replace text by a pattern'),
    whatis: 'stream editor for filtering and transforming text',
    synopsis: ['sed [OPTION]... {script-only-if-no-other-script} [input-file]...'],
    description:
      'Sed is a stream editor. A stream editor is used to perform basic text transformations on an input stream (a file or input from a pipeline). It makes only one pass over the input.\nThe most used command is s/regexp/replacement/flags: replace the first match of regexp in each line; with the g flag every match. & in the replacement is the whole match, \\1…\\9 the groups.',
    options: [
      ['-n, --quiet, --silent', 'suppress automatic printing of pattern space'],
      ['-e script, --expression=script', 'add the script to the commands to be executed'],
      ['-i[SUFFIX], --in-place[=SUFFIX]', 'edit files in place (makes backup if SUFFIX supplied)'],
      ['-E, -r, --regexp-extended', 'use extended regular expressions in the script'],
    ],
    extra: [
      {
        id: 'COMMANDS',
        body: 's/regexp/replacement/[g]\n       Attempt to match regexp against the pattern space. If successful, replace that portion matched with replacement.\na text Append text after the line.\ni text Insert text before the line.\np      Print the current pattern space.\nd      Delete pattern space. Start next cycle.\nq      Immediately quit the sed script without processing any more input.\n=      Print the current line number.\nAddresses: a number selects that line, $ the last line, /regexp/ the lines that match; addr1,addr2 a range; ! after the address negates it.',
      },
    ],
    examples: [
      ["sed 's/listen 80/listen 8080/' nginx.conf", 'Print the file with the first "listen 80" on each line replaced.'],
      ["sed -i 's/DEBUG/INFO/g' app.conf", 'Replace in the file itself, every occurrence.'],
      ["sed -n '5,10p' big.log", 'Only lines 5 to 10.'],
    ],
    seeAlso: 'awk(1), grep(1), regex(7)',
  }),
  run(ctx) {
    const args = ctx.argv.slice(1);
    let quiet = false;
    let ere = false;
    let inplace: string | null = null;
    const scripts: string[] = [];
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === '-n' || x === '--quiet' || x === '--silent') quiet = true;
      else if (x === '-E' || x === '-r' || x === '--regexp-extended') ere = true;
      else if (x === '-e') scripts.push(args[++i] ?? '');
      else if (x.startsWith('--expression=')) scripts.push(x.slice(13));
      else if (x.startsWith('-i') || x.startsWith('--in-place')) inplace = x.startsWith('-i') ? x.slice(2) : (x.split('=')[1] ?? '');
      else if (/^-[nEr]+$/.test(x)) {
        if (x.includes('n')) quiet = true;
        if (/[Er]/.test(x)) ere = true;
      } else if (!scripts.length && !x.startsWith('-')) scripts.push(x);
      else files.push(x);
    }
    if (!scripts.length) return usageError(ctx, 'no script specified');
    const cmds = parseSed(scripts.join('\n'), ere);
    if (typeof cmds === 'string') {
      ctx.err(cmds + '\n');
      return 1;
    }
    if (inplace !== null) {
      if (!files.length) {
        ctx.err('sed: no input files\n');
        return 1;
      }
      let exit = 0;
      for (const f of files) {
        try {
          const text = ctx.fs.readFile(f);
          if (inplace) ctx.fs.writeFile(f + inplace, text);
          ctx.fs.writeFile(f, runSed(text, cmds, quiet));
        } catch (e) {
          if (isFsError(e)) ctx.err(`sed: couldn't edit ${f}: ${e.code === 'ENOENT' ? 'No such file or directory' : e.text}\n`);
          exit = 4;
        }
      }
      return exit;
    }
    const inputs = readInputs(ctx, files);
    ctx.out(runSed(inputs.map((i) => i.text).join(''), cmds, quiet));
    return inputs.failed ? 2 : 0;
  },
};

// ── awk: a small interpreter for the one-liners of the course ──

type AwkVal = string | number;
interface AwkEnv {
  vars: Record<string, AwkVal>;
  arrays: Record<string, Record<string, AwkVal>>;
  fields: string[];
  NR: number;
  FS: string;
  OFS: string;
  out: string;
}

class AwkProgram {
  private src: string;
  private i = 0;
  rules: { pattern: string | null; begin?: boolean; end?: boolean; action: string | null }[] = [];
  constructor(src: string) {
    this.src = src;
    this.parse();
  }
  private parse() {
    const s = this.src;
    while (this.i < s.length) {
      while (this.i < s.length && /[\s;]/.test(s[this.i])) this.i++;
      if (this.i >= s.length) break;
      let pattern = '';
      while (this.i < s.length && s[this.i] !== '{') {
        if (s[this.i] === '/') {
          const end = s.indexOf('/', this.i + 1);
          pattern += s.slice(this.i, end + 1);
          this.i = end + 1;
          continue;
        }
        if (s[this.i] === '\n' && pattern.trim()) break;
        pattern += s[this.i++];
      }
      pattern = pattern.trim();
      let action: string | null = null;
      if (s[this.i] === '{') action = this.block();
      if (pattern === 'BEGIN') this.rules.push({ pattern: null, begin: true, action });
      else if (pattern === 'END') this.rules.push({ pattern: null, end: true, action });
      else this.rules.push({ pattern: pattern || null, action });
    }
  }
  private block(): string {
    const s = this.src;
    let depth = 0;
    const start = this.i + 1;
    let q: string | null = null;
    for (; this.i < s.length; this.i++) {
      const c = s[this.i];
      if (q) {
        if (c === '\\') this.i++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '"') q = c;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          this.i++;
          return s.slice(start, this.i - 1);
        }
      }
    }
    throw new Error('missing }');
  }
}

/** Evaluate an awk expression (numbers, strings, $n, NR, NF, vars, arrays, comparisons, ~, &&, ||, arithmetic, concatenation). */
function awkEval(expr: string, env: AwkEnv): AwkVal {
  const toks = expr.match(/"(?:[^"\\]|\\.)*"|\/(?:[^/\\]|\\.)+\/|\$\w+|\$\(|\d+(?:\.\d+)?|[A-Za-z_]\w*(?:\[[^\]]*\])?|==|!=|<=|>=|&&|\|\||!~|[-+*/%<>()!~,]|\S/g) ?? [];
  let p = 0;
  const num = (v: AwkVal) => (typeof v === 'number' ? v : parseFloat(v) || 0);
  const field = (n: number) => (n === 0 ? env.fields.slice(1).join(env.OFS === ' ' ? ' ' : env.OFS) || env.fields[0] : (env.fields[n] ?? ''));
  const get = (name: string): AwkVal => {
    if (name === 'NR') return env.NR;
    if (name === 'NF') return env.fields.length - 1;
    const am = /^(\w+)\[(.*)\]$/.exec(name);
    if (am) return env.arrays[am[1]]?.[String(awkEval(am[2], env))] ?? '';
    return env.vars[name] ?? '';
  };
  const primary = (): AwkVal => {
    const t = toks[p++];
    if (t === undefined) return '';
    if (t === '(') {
      const v = or();
      p++;
      return v;
    }
    if (t === '!') return num(primary()) ? 0 : 1;
    if (t === '-') return -num(primary());
    if (t.startsWith('"')) return t.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    if (t.startsWith('/')) return new RegExp(t.slice(1, -1)).test(field(0)) ? 1 : 0;
    if (t === '$(') {
      const v = or();
      p++;
      return field(num(v));
    }
    if (t.startsWith('$')) return field(/^\d+$/.test(t.slice(1)) ? Number(t.slice(1)) : num(get(t.slice(1))));
    if (/^\d/.test(t)) return Number(t);
    if (/^length$/.test(t)) {
      if (toks[p] === '(') {
        p++;
        const v = toks[p] === ')' ? field(0) : or();
        p++;
        return String(v).length;
      }
      return field(0).length;
    }
    if (/^(toupper|tolower)$/.test(t)) {
      p++;
      const v = String(or());
      p++;
      return t === 'toupper' ? v.toUpperCase() : v.toLowerCase();
    }
    return get(t);
  };
  const mul = (): AwkVal => {
    let v = primary();
    while (toks[p] === '*' || toks[p] === '/' || toks[p] === '%') {
      const op = toks[p++];
      const r = num(primary());
      v = op === '*' ? num(v) * r : op === '/' ? num(v) / r : num(v) % r;
    }
    return v;
  };
  const add = (): AwkVal => {
    let v = mul();
    while (toks[p] === '+' || toks[p] === '-') {
      const op = toks[p++];
      const r = num(mul());
      v = op === '+' ? num(v) + r : num(v) - r;
    }
    return v;
  };
  const concat = (): AwkVal => {
    let v = add();
    while (p < toks.length && !['==', '!=', '<', '>', '<=', '>=', '&&', '||', ')', ',', '~', '!~'].includes(toks[p])) v = String(v) + String(add());
    return v;
  };
  const cmp = (): AwkVal => {
    const v = concat();
    const op = toks[p];
    if (['==', '!=', '<', '>', '<=', '>=', '~', '!~'].includes(op)) {
      p++;
      if (op === '~' || op === '!~') {
        const t = toks[p];
        let re: RegExp;
        if (t?.startsWith('/')) {
          p++;
          re = new RegExp(t.slice(1, -1));
        } else re = new RegExp(String(concat()));
        const r = re.test(String(v));
        return (op === '~' ? r : !r) ? 1 : 0;
      }
      const r = concat();
      const bothNum = (typeof v === 'number' || /^\s*-?[\d.]+\s*$/.test(String(v))) && (typeof r === 'number' || /^\s*-?[\d.]+\s*$/.test(String(r)));
      const a = bothNum ? num(v) : String(v);
      const b = bothNum ? num(r) : String(r);
      return (op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b) ? 1 : 0;
    }
    return v;
  };
  const and = (): AwkVal => {
    let v = cmp();
    while (toks[p] === '&&') {
      p++;
      const r = cmp();
      v = num(v) && num(r) ? 1 : 0;
    }
    return v;
  };
  const or = (): AwkVal => {
    let v = and();
    while (toks[p] === '||') {
      p++;
      const r = and();
      v = num(v) || num(r) ? 1 : 0;
    }
    return v;
  };
  return or();
}

function awkSplitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let q = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      cur += c;
      if (c === '\\') cur += s[++i] ?? '';
      else if (c === '"') q = false;
      continue;
    }
    if (c === '"') q = true;
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function awkFormat(fmt: string, args: AwkVal[]): string {
  let i = 0;
  return fmt.replace(/%(-?\d*)(?:\.(\d+))?([sdfi%])/g, (_m, w: string, prec: string | undefined, c: string) => {
    if (c === '%') return '%';
    const v = args[i++] ?? '';
    let s = c === 's' ? String(v) : c === 'f' ? (parseFloat(String(v)) || 0).toFixed(prec !== undefined ? Number(prec) : 6) : String(Math.trunc(parseFloat(String(v)) || 0));
    const width = Math.abs(Number(w || 0));
    if (width) s = w.startsWith('-') ? s.padEnd(width) : s.padStart(width);
    return s;
  });
}

function awkExec(action: string, env: AwkEnv): void {
  const stmts: string[] = [];
  let cur = '';
  let depth = 0;
  let q = false;
  for (let i = 0; i < action.length; i++) {
    const c = action[i];
    if (q) {
      cur += c;
      if (c === '\\') cur += action[++i] ?? '';
      else if (c === '"') q = false;
      continue;
    }
    if (c === '"') q = true;
    if (c === '(' || c === '{') depth++;
    if (c === ')' || c === '}') depth--;
    if ((c === ';' || c === '\n') && depth === 0) {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
    if (c === '}' && depth === 0) {
      stmts.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) stmts.push(cur.trim());
  for (const st of stmts) {
    let m: RegExpExecArray | null;
    if ((m = /^for\s*\(\s*(\w+)\s+in\s+(\w+)\s*\)\s*(\{([\s\S]*)\}|([\s\S]*))$/.exec(st))) {
      const arr = env.arrays[m[2]] ?? {};
      for (const k of Object.keys(arr)) {
        env.vars[m[1]] = k;
        awkExec(m[4] ?? m[5], env);
      }
      continue;
    }
    if ((m = /^if\s*\(([\s\S]*?)\)\s*(\{([\s\S]*?)\}|([^;{]*?))(?:\s*else\s*(\{([\s\S]*)\}|([\s\S]*)))?$/.exec(st))) {
      const c = awkEval(m[1], env);
      if (typeof c === 'number' ? c : c !== '') awkExec(m[3] ?? m[4], env);
      else if (m[5]) awkExec(m[6] ?? m[7], env);
      continue;
    }
    if ((m = /^printf\s*\(?([\s\S]*?)\)?$/.exec(st)) && st.startsWith('printf')) {
      const parts = awkSplitArgs(m[1]);
      const fmt = String(awkEval(parts[0], env));
      env.out += awkFormat(fmt, parts.slice(1).map((x) => awkEval(x, env)));
      continue;
    }
    if (st === 'print' || st.startsWith('print ') || st.startsWith('print(')) {
      const rest = st.slice(5).trim();
      if (!rest) env.out += (env.fields.length > 1 ? env.fields.slice(1).join(' ') : env.fields[0] ?? '') + '\n';
      else env.out += awkSplitArgs(rest.replace(/^\(|\)$/g, '')).map((x) => String(fmtNum(awkEval(x, env)))).join(env.OFS) + '\n';
      continue;
    }
    if ((m = /^(\w+)(?:\[(.*)\])?\s*(\+\+|--)$/.exec(st))) {
      if (m[2] !== undefined) {
        const arr = (env.arrays[m[1]] ??= {});
        const k = String(awkEval(m[2], env));
        arr[k] = (parseFloat(String(arr[k] ?? 0)) || 0) + (m[3] === '++' ? 1 : -1);
      } else env.vars[m[1]] = (parseFloat(String(env.vars[m[1]] ?? 0)) || 0) + (m[3] === '++' ? 1 : -1);
      continue;
    }
    if ((m = /^(\w+)(?:\[(.*)\])?\s*([-+*/]?=)\s*([\s\S]+)$/.exec(st)) && m[3] !== '==') {
      const v = awkEval(m[4], env);
      const apply = (old: AwkVal) => {
        const o = parseFloat(String(old)) || 0;
        const n = typeof v === 'number' ? v : parseFloat(v) || 0;
        return m![3] === '=' ? v : m![3] === '+=' ? o + n : m![3] === '-=' ? o - n : m![3] === '*=' ? o * n : o / n;
      };
      if (m[2] !== undefined) {
        const arr = (env.arrays[m[1]] ??= {});
        const k = String(awkEval(m[2], env));
        arr[k] = apply(arr[k] ?? 0);
      } else env.vars[m[1]] = apply(env.vars[m[1]] ?? 0);
      continue;
    }
    if (st.startsWith('{') && st.endsWith('}')) {
      awkExec(st.slice(1, -1), env);
      continue;
    }
    awkEval(st, env);
  }
}

const fmtNum = (v: AwkVal) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(6)) : v);

export function runAwk(program: string, text: string, fs: string | undefined, vars: Record<string, string> = {}): string {
  const prog = new AwkProgram(program);
  const env: AwkEnv = { vars: { ...vars }, arrays: {}, fields: [''], NR: 0, FS: fs ?? ' ', OFS: ' ', out: '' };
  for (const r of prog.rules) if (r.begin && r.action) awkExec(r.action, env);
  for (const line of lines(text)) {
    env.NR++;
    const parts = env.FS === ' ' ? line.trim().split(/\s+/).filter(Boolean) : line.split(env.FS.length === 1 ? env.FS : new RegExp(env.FS));
    env.fields = [line, ...parts];
    for (const r of prog.rules) {
      if (r.begin || r.end) continue;
      const ok = r.pattern === null ? true : (() => {
        const v = awkEval(r.pattern!, env);
        return typeof v === 'number' ? v !== 0 : v !== '';
      })();
      if (!ok) continue;
      if (r.action === null) env.out += line + '\n';
      else awkExec(r.action, env);
    }
  }
  for (const r of prog.rules) if (r.end && r.action) awkExec(r.action, env);
  return env.out;
}

const awk: ShellCommand = {
  ...cmdDoc({
    name: 'awk',
    summary: bi('обработать текст по столбцам', 'pattern scanning and processing by columns'),
    whatis: 'pattern scanning and text processing language',
    synopsis: ["awk [ -F fs ] [ -v var=value ] 'program' [ file ... ]"],
    description:
      "awk reads the input line by line, splits each line into fields $1, $2, … by the field separator (white space by default), and runs the program on it. A program is a list of pattern { action } pairs: the action runs for the lines where the pattern is true. BEGIN runs before the first line, END after the last.\nNR is the number of the current line, NF the number of fields, $0 the whole line.",
    options: [
      ['-F fs, --field-separator fs', 'Use fs for the input field separator (the value of the FS predefined variable).'],
      ['-v var=val, --assign var=val', 'Assign the value val to the variable var, before execution of the program begins.'],
    ],
    examples: [
      ["awk '{print $1}' access.log", 'The first field of every line.'],
      ["awk -F: '$3 >= 1000 {print $1}' /etc/passwd", 'Names of the ordinary users.'],
      ["awk '{sum += $2} END {print sum}' sizes.txt", 'The sum of the second column.'],
      ["awk '{n[$1]++} END {for (k in n) print n[k], k}' access.log", 'How many times each first field occurs.'],
    ],
    seeAlso: 'sed(1), cut(1), grep(1)',
    url: 'https://man7.org/linux/man-pages/man1/gawk.1.html',
  }),
  run(ctx) {
    const args = ctx.argv.slice(1);
    let fs: string | undefined;
    const vars: Record<string, string> = {};
    let program: string | undefined;
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === '-F') fs = args[++i];
      else if (x.startsWith('-F')) fs = x.slice(2);
      else if (x === '-v') {
        const [k, ...v] = (args[++i] ?? '').split('=');
        vars[k] = v.join('=');
      } else if (program === undefined) program = x;
      else files.push(x);
    }
    if (program === undefined) {
      ctx.err("usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nusage: awk [POSIX or GNU style options] [--] 'program' file ...\n");
      return 2;
    }
    if (fs === '\\t' || fs === 't') fs = '\t';
    const inputs = readInputs(ctx, files);
    try {
      ctx.out(runAwk(program, inputs.map((i) => i.text).join(''), fs, vars));
    } catch (e) {
      ctx.err(`awk: cmd. line:1: ${program}\nawk: cmd. line:1: ${'^'.padStart(1)} syntax error (${(e as Error).message})\n`);
      return 2;
    }
    return inputs.failed ? 2 : 0;
  },
};

const tee: ShellCommand = {
  ...cmdDoc({
    name: 'tee',
    summary: bi('записать вход в файл и передать дальше', 'read stdin, write it to files and to stdout'),
    whatis: 'read from standard input and write to standard output and files',
    synopsis: ['tee [OPTION]... [FILE]...'],
    description: 'Copy standard input to each FILE, and also to standard output.\nWith sudo it is the usual way to write a file that only root may write: echo line | sudo tee -a /etc/file.',
    options: [['-a, --append', 'append to the given FILEs, do not overwrite']],
    examples: [["echo '127.0.0.1 app.local' | sudo tee -a /etc/hosts", 'Append a line to a file owned by root.']],
    seeAlso: 'cat(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'ai', long: { append: 'a', 'ignore-interrupts': 'i' } });
    if (a.error) return usageError(ctx, a.error);
    let exit = 0;
    for (const f of a.operands) {
      try {
        ctx.fs.writeFile(f, ctx.stdin, { append: a.flags.has('a') });
      } catch (e) {
        exit = fsErr(ctx, e, f);
      }
    }
    ctx.out(ctx.stdin);
    return exit;
  },
};

const xargs: ShellCommand = {
  ...cmdDoc({
    name: 'xargs',
    summary: bi('превратить строки входа в аргументы команды', 'build command lines from standard input'),
    whatis: 'build and execute command lines from standard input',
    synopsis: ['xargs [options] [command [initial-arguments]]'],
    description: 'xargs reads items from the standard input, delimited by blanks or newlines, and executes the command (default is echo) one or more times with any initial-arguments followed by items read from standard input.',
    options: [
      ['-n max-args, --max-args=max-args', 'Use at most max-args arguments per command line.'],
      ['-I replace-str', 'Replace occurrences of replace-str in the initial-arguments with names read from standard input; one command per input line.'],
      ['-0, --null', 'Input items are terminated by a null character instead of by whitespace.'],
      ['-t, --verbose', 'Print the command line on the standard error output before executing it.'],
    ],
    examples: [["find . -name '*.tmp' | xargs rm", 'Remove every .tmp file find printed.'], ["cat hosts.txt | xargs -n 1 echo host:", 'One echo per item.']],
    seeAlso: 'find(1)',
  }),
  async run(ctx) {
    const args = ctx.argv.slice(1);
    let n = Infinity;
    let rep: string | undefined;
    let trace = false;
    let nul = false;
    while (args.length && args[0].startsWith('-')) {
      const x = args.shift()!;
      if (x === '-n') n = Number(args.shift());
      else if (/^-n\d+$/.test(x)) n = Number(x.slice(2));
      else if (x === '-I') rep = args.shift();
      else if (x === '-t' || x === '--verbose') trace = true;
      else if (x === '-0' || x === '--null') nul = true;
      else if (x === '-r' || x === '--no-run-if-empty') continue;
      else break;
    }
    const cmd = args.length ? args : ['echo'];
    const items = rep ? lines(ctx.stdin) : nul ? ctx.stdin.split('\u0000').filter(Boolean) : ctx.stdin.split(/\s+/).filter(Boolean);
    let exit = 0;
    const runOne = async (argv: string[]) => {
      const line = argv.map(shq).join(' ');
      if (trace) ctx.err(line + '\n');
      const r = await ctx.shell.run(line);
      ctx.out(r.out);
      ctx.err(r.err);
      if (r.exit) exit = r.exit === 127 ? 127 : 123;
    };
    if (rep) for (const it of items) await runOne(cmd.map((c) => c.split(rep!).join(it)));
    else if (!items.length) await runOne(cmd);
    else for (let i = 0; i < items.length; i += n === Infinity ? items.length : n) await runOne([...cmd, ...items.slice(i, i + (n === Infinity ? items.length : n))]);
    return exit;
  },
};

/** Line diff: the longest common subsequence, printed in unified or normal format. */
export function diffLines(a: string[], b: string[]): { op: ' ' | '-' | '+'; line: string }[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: ' ' | '-' | '+'; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      out.push({ op: ' ', line: a[i] });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] > dp[i + 1][j])) out.push({ op: '+', line: b[j++] });
    else out.push({ op: '-', line: a[i++] });
  }
  return out;
}

const diff: ShellCommand = {
  ...cmdDoc({
    name: 'diff',
    summary: bi('сравнить файлы построчно', 'compare files line by line'),
    whatis: 'compare files line by line',
    synopsis: ['diff [OPTION]... FILES'],
    description: 'Compare FILES line by line. With -u the output is in the unified format: lines starting with - are only in the first file, with + only in the second.',
    options: [
      ['-u, -U NUM, --unified[=NUM]', 'output NUM (default 3) lines of unified context'],
      ['-q, --brief', 'report only when files differ'],
    ],
    exit: '0 if inputs are the same, 1 if different, 2 if trouble.',
    seeAlso: 'cmp(1), patch(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'uq', long: { unified: 'u', brief: 'q' } });
    if (a.error) return usageError(ctx, a.error);
    if (a.operands.length !== 2) {
      ctx.err(`diff: missing operand after '${a.operands[0] ?? 'diff'}'\ndiff: Try 'diff --help' for more information.\n`);
      return 2;
    }
    const [fa, fb] = a.operands;
    let ta: string;
    let tb: string;
    try {
      ta = fa === '-' ? ctx.stdin : ctx.fs.readFile(fa);
      tb = fb === '-' ? ctx.stdin : ctx.fs.readFile(fb);
    } catch (e) {
      if (isFsError(e)) ctx.err(`diff: ${e.path}: ${e.text}\n`);
      return 2;
    }
    if (ta === tb) return 0;
    if (a.flags.has('q')) {
      ctx.out(`Files ${fa} and ${fb} differ\n`);
      return 1;
    }
    const d = diffLines(lines(ta), lines(tb));
    if (a.flags.has('u')) {
      const stamp = (path: string) => new Date(ctx.fs.stat(path)?.mtime ?? 0).toISOString().replace('T', ' ');
      ctx.out(`--- ${fa}\t${stamp(fa)}\n+++ ${fb}\t${stamp(fb)}\n`);
      const la = lines(ta).length;
      const lb = lines(tb).length;
      ctx.out(`@@ -1,${la} +1,${lb} @@\n`);
      for (const x of d) ctx.out(`${x.op}${x.line}\n`);
      return 1;
    }
    let ia = 0;
    let ib = 0;
    for (let k = 0; k < d.length; ) {
      if (d[k].op === ' ') {
        ia++;
        ib++;
        k++;
        continue;
      }
      const dels: string[] = [];
      const adds: string[] = [];
      const sa = ia;
      const sb = ib;
      while (k < d.length && d[k].op !== ' ') {
        if (d[k].op === '-') {
          dels.push(d[k].line);
          ia++;
        } else {
          adds.push(d[k].line);
          ib++;
        }
        k++;
      }
      const ra = dels.length > 1 ? `${sa + 1},${ia}` : dels.length ? `${ia}` : `${sa}`;
      const rb = adds.length > 1 ? `${sb + 1},${ib}` : adds.length ? `${ib}` : `${sb}`;
      ctx.out(`${ra}${dels.length && adds.length ? 'c' : dels.length ? 'd' : 'a'}${rb}\n`);
      for (const l of dels) ctx.out(`< ${l}\n`);
      if (dels.length && adds.length) ctx.out('---\n');
      for (const l of adds) ctx.out(`> ${l}\n`);
    }
    return 1;
  },
};

export function printfFormat(fmt: string, args: string[]): string {
  let out = '';
  let i = 0;
  const esc = (s: string) => s.replace(/\\(n|t|\\|e|r|0)/g, (_m, c: string) => ({ n: '\n', t: '\t', '\\': '\\', e: '\x1b', r: '\r', 0: '\u0000' })[c] ?? c);
  do {
    out += esc(fmt).replace(/%(-?\d*)(?:\.(\d+))?([sdfxob%])/g, (_m, w: string, prec: string | undefined, c: string) => {
      if (c === '%') return '%';
      const v = args[i++] ?? '';
      let s = c === 's' ? v : c === 'b' ? esc(v) : c === 'f' ? (parseFloat(v) || 0).toFixed(prec !== undefined ? Number(prec) : 6) : c === 'x' ? (parseInt(v) || 0).toString(16) : c === 'o' ? (parseInt(v) || 0).toString(8) : String(parseInt(v) || 0);
      const width = Math.abs(Number(w || 0));
      if (width) s = w.startsWith('-') ? s.padEnd(width) : s.padStart(width, w.startsWith('0') && c !== 's' ? '0' : ' ');
      return s;
    });
  } while (i < args.length && /%[-\d.]*[sdfxob]/.test(fmt));
  return out;
}

const printf: ShellCommand = {
  builtin: true,
  ...cmdDoc({
    name: 'printf',
    summary: bi('напечатать по формату', 'format and print data'),
    whatis: 'format and print data',
    synopsis: ['printf FORMAT [ARGUMENT]...'],
    description: 'Print ARGUMENT(s) according to FORMAT. Unlike echo, printf adds no newline by itself: write \\n where you need one. The format is reused while arguments remain.\n%s a string, %d an integer, %f a floating point number, %5s a field of width 5, %-5s left-aligned.',
    examples: [["printf '%s\\n' one two three", 'Three lines.'], ["printf '%-10s %5d\\n' nginx 80", 'An aligned table row.']],
    seeAlso: 'echo(1), printf(3)',
  }),
  run(ctx) {
    const [fmt, ...args] = ctx.argv.slice(1);
    if (fmt === undefined) {
      ctx.err('printf: usage: printf [-v var] format [arguments]\n');
      return 2;
    }
    ctx.out(printfFormat(fmt, args));
    return 0;
  },
};

const seq: ShellCommand = {
  ...cmdDoc({
    name: 'seq',
    summary: bi('напечатать последовательность чисел', 'print a sequence of numbers'),
    whatis: 'print a sequence of numbers',
    synopsis: ['seq [OPTION]... LAST', 'seq [OPTION]... FIRST LAST', 'seq [OPTION]... FIRST INCREMENT LAST'],
    description: 'Print numbers from FIRST to LAST, in steps of INCREMENT.',
    options: [['-s, --separator=STRING', 'use STRING to separate numbers (default: \\n)'], ['-w, --equal-width', 'equalize width by padding with leading zeroes']],
    seeAlso: 'printf(1)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'w', withValue: 's', long: { separator: 's', 'equal-width': 'w' } });
    const nums = a.operands.map(Number);
    if (!nums.length || nums.some(Number.isNaN)) return usageError(ctx, 'missing operand');
    const [first, inc, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    const out: string[] = [];
    for (let x = first; inc > 0 ? x <= last : x >= last; x += inc) {
      out.push(String(x));
      if (out.length > 100000) break;
    }
    const w = Math.max(...out.map((s) => s.length));
    if (out.length) ctx.out(out.map((s) => (a.flags.has('w') ? s.padStart(w, '0') : s)).join(a.values.s ?? '\n') + '\n');
    return 0;
  },
};

const nl: ShellCommand = {
  ...cmdDoc({
    name: 'nl',
    summary: bi('пронумеровать строки', 'number lines of files'),
    whatis: 'number lines of files',
    synopsis: ['nl [OPTION]... [FILE]...'],
    description: 'Write each FILE to standard output, with line numbers added to non-empty lines.',
    seeAlso: 'cat(1)',
  }),
  run(ctx) {
    const inputs = readInputs(ctx, ctx.argv.slice(1));
    let n = 0;
    for (const l of inputs.flatMap((i) => lines(i.text))) ctx.out(l ? `${String(++n).padStart(6)}\t${l}\n` : '\n');
    return 0;
  },
};

const rev: ShellCommand = {
  ...cmdDoc({
    name: 'rev',
    summary: bi('развернуть каждую строку', 'reverse lines characterwise'),
    whatis: 'reverse lines characterwise',
    synopsis: ['rev [option] [file...]'],
    description: 'The rev utility copies the specified files to standard output, reversing the order of characters in every line.',
    seeAlso: 'tac(1)',
  }),
  run(ctx) {
    const inputs = readInputs(ctx, ctx.argv.slice(1));
    for (const l of inputs.flatMap((i) => lines(i.text))) ctx.out([...l].reverse().join('') + '\n');
    return 0;
  },
};

export const TEXT_COMMANDS: ShellCommand[] = [head, tail, less, wc, sort, uniq, cut, tr, sed, awk, tee, xargs, diff, printf, seq, nl, rev];

export { lines, type CmdContext };
