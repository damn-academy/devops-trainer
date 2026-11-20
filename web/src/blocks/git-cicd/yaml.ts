// YAML in the course: the `yamllint` command (a subset of the real rules with
// their messages and exit codes) and the widget "YAML through the parser's
// eyes": text on the left, the data tree and JSON on the right, a switch
// between YAML 1.2 and YAML 1.1 parsing (06 §2.7, Y-I1 and Y-traps).

import { isScalar, LineCounter, parseDocument, visit } from 'yaml';
import type { ShellCommand, WidgetReg } from '../../core/types';
import { bi, t, type Bi } from '../../core/i18n';
import { h, clear } from '../../core/dom';
import './yaml.css';

export interface YamlProblem {
  line: number;
  col: number;
  level: 'error' | 'warning';
  message: string;
  rule: string;
}

const TRUTHY_11 = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;

/** yamllint's default rules that matter for CI and compose files. */
export function lintYaml(text: string): YamlProblem[] {
  const out: YamlProblem[] = [];
  const lc = new LineCounter();
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    const tab = /^( *)\t/.exec(l);
    if (tab) out.push({ line: i + 1, col: tab[1].length + 1, level: 'error', message: 'syntax error: found character \'\\t\' that cannot start any token', rule: 'syntax' });
    const tr = /[ \t]+$/.exec(l);
    if (tr && l.trim()) out.push({ line: i + 1, col: tr.index + 1, level: 'error', message: 'trailing spaces', rule: 'trailing-spaces' });
  });
  if (out.some((p) => p.rule === 'syntax')) return out;
  const doc = parseDocument(text, { lineCounter: lc, uniqueKeys: false, prettyErrors: false });
  for (const e of doc.errors) {
    // The yaml library reports an over-indented key where the enclosing mapping starts and in its own words;
    // yamllint (PyYAML) points at the colon of that key: "mapping values are not allowed here".
    const over = e.code === 'BLOCK_AS_IMPLICIT_KEY' || e.code === 'MULTILINE_IMPLICIT_KEY' ? overIndentedKey(lines) : null;
    if (over) {
      if (!out.some((x) => x.line === over.line && x.col === over.col)) out.push({ ...over, level: 'error', message: 'syntax error: mapping values are not allowed here', rule: 'syntax' });
      continue;
    }
    const pos = e.linePos?.[0] ?? lc.linePos(e.pos[0]);
    out.push({ line: pos.line, col: pos.col, level: 'error', message: `syntax error: ${e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')}`, rule: 'syntax' });
  }
  if (doc.errors.length) return out.sort((a, b) => a.line - b.line);
  if (text.trim() && !/^(%.*\n)*---/.test(text.replace(/^(#.*\n)*/, ''))) out.push({ line: 1, col: 1, level: 'warning', message: 'missing document start "---"', rule: 'document-start' });
  visit(doc, {
    Map(_, node) {
      const seen = new Set<string>();
      for (const p of node.items) {
        if (!isScalar(p.key)) continue;
        const k = String(p.key.value);
        if (seen.has(k) && p.key.range) {
          const pos = lc.linePos(p.key.range[0]);
          out.push({ line: pos.line, col: pos.col, level: 'error', message: `duplication of key "${k}" in mapping`, rule: 'key-duplicates' });
        }
        seen.add(k);
      }
    },
    Scalar(_, node) {
      if (node.type === 'PLAIN' && typeof node.source === 'string' && TRUTHY_11.test(node.source) && !/^(true|false)$/.test(node.source) && node.range) {
        const pos = lc.linePos(node.range[0]);
        out.push({ line: pos.line, col: pos.col, level: 'warning', message: 'truthy value should be one of [false, true]', rule: 'truthy' });
      }
    },
  });
  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}

/** The first key indented deeper than the line above it, when that line does not open a block: where PyYAML stops. */
function overIndentedKey(lines: string[]): { line: number; col: number } | null {
  let prevContent = -1;
  let prevOpens = true;
  for (const [i, l] of lines.entries()) {
    if (!l.trim() || /^\s*#/.test(l) || /^---/.test(l)) continue;
    const indent = l.length - l.trimStart().length;
    const body = l.trimStart();
    const key = /^[^\s#:-][^:]*:(\s|$)/.exec(body);
    if (key && !prevOpens && indent > prevContent) return { line: i + 1, col: indent + body.indexOf(':') + 1 };
    const item = /^(- +)/.exec(body);
    prevContent = indent + (item ? item[1].length : 0);
    prevOpens = /:\s*$/.test(body);
  }
  return null;
}

export const yamllintCommand: ShellCommand = {
  name: 'yamllint',
  summary: bi('Проверяет YAML-файлы и сообщает о синтаксических ошибках, повторённых ключах и подозрительных логических значениях.', 'A linter for YAML files: syntax, duplicate keys, truthy values.'),
  help: 'usage: yamllint [-h] [-f {parsable,standard}] [-s] FILE_OR_DIR ...\n\nA linter for YAML files.\n\npositional arguments:\n  FILE_OR_DIR           files to check\n\noptions:\n  -h, --help            show this help message and exit\n  -f, --format          format for parsing output\n  -s, --strict          return non-zero exit code on warnings as well as errors\n\nExit status:\n  0  no problems, or only warnings\n  1  at least one error\n  2  warnings with --strict\n',
  run(ctx) {
    const args = ctx.argv.slice(1);
    const strict = args.includes('-s') || args.includes('--strict');
    const parsable = args.includes('parsable') || args.includes('--format=parsable');
    const files = args.filter((a) => !a.startsWith('-') && a !== 'parsable' && a !== 'standard');
    if (!files.length) {
      ctx.err('usage: yamllint [-h] [-] [-c CONFIG_FILE | -d CONFIG_DATA] [-f {parsable,standard}] [-s] FILE_OR_DIR ...\nyamllint: error: one of the arguments FILE_OR_DIR - is required\n');
      return 2;
    }
    let errors = 0;
    let warnings = 0;
    for (const f of files) {
      let text: string;
      try {
        text = ctx.fs.readFile(f);
      } catch {
        ctx.err(`[Errno 2] No such file or directory: '${f}'\n`);
        return 1;
      }
      const ps = lintYaml(text);
      if (!ps.length) continue;
      if (!parsable) ctx.out(`${ctx.isatty ? `\x1b[4m${f}\x1b[0m` : f}\n`);
      for (const p of ps) {
        if (p.level === 'error') errors++;
        else warnings++;
        if (parsable) ctx.out(`${f}:${p.line}:${p.col}: [${p.level}] ${p.message} (${p.rule})\n`);
        else {
          const lvl = ctx.isatty ? (p.level === 'error' ? '\x1b[31merror\x1b[0m  ' : '\x1b[33mwarning\x1b[0m') : p.level === 'error' ? 'error  ' : 'warning';
          ctx.out(`  ${`${p.line}:${p.col}`.padEnd(9)} ${lvl}  ${p.message}  ${ctx.isatty ? `\x1b[2m(${p.rule})\x1b[0m` : `(${p.rule})`}\n`);
        }
      }
      if (!parsable) ctx.out('\n');
    }
    return errors ? 1 : warnings && strict ? 2 : 0;
  },
};

// ── the widget ──

const W = {
  title: bi('Как парсер читает YAML', 'YAML through the parser’s eyes'),
  source: bi('Текст', 'Text'),
  tree: bi('Что получил парсер', 'What the parser got'),
  json: bi('То же в JSON', 'The same in JSON'),
  v12: bi('YAML 1.2 (большинство современных парсеров)', 'YAML 1.2 (most current parsers)'),
  v11: bi('YAML 1.1 (PyYAML, старые инструменты)', 'YAML 1.1 (PyYAML, older tools)'),
  ok: bi('Документ разобран без ошибок.', 'The document parses without errors.'),
  done: bi('Задача выполнена, потому что в обеих версиях YAML все значения получились такими, как нужно.', 'Done: in both YAML versions every value came out as required.'),
  parsedAs: bi('Разобрано по правилам YAML {v}', 'Parsed by the rules of YAML {v}'),
  diff: bi('YAML 1.1 и YAML 1.2 читают это значение по-разному.', 'YAML 1.1 and 1.2 read this value differently'),
  todo: bi('Это значение пока не совпадает с тем, что требует задача', 'This value does not yet match what the task asks for'),
  legend: bi('Пунктиром обведены значения, которые YAML 1.1 и YAML 1.2 читают по-разному, а красными точками подчёркнуты значения, которые ещё не совпадают с задачей.', 'Dashed outlines mark values YAML 1.1 and YAML 1.2 read differently, and a red dotted underline marks values that do not match the task yet.'),
  goal: bi('Что нужно сделать', 'What to do'),
};

type Kind = 'map' | 'seq' | 'str' | 'int' | 'float' | 'bool' | 'null';
const kindOf = (v: unknown): Kind => (v === null || v === undefined ? 'null' : Array.isArray(v) ? 'seq' : typeof v === 'object' ? 'map' : typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : 'str');
const KIND: Record<Kind, Bi> = {
  map: bi('словарь', 'mapping'),
  seq: bi('список', 'sequence'),
  str: bi('строка', 'string'),
  int: bi('целое', 'integer'),
  float: bi('дробное', 'float'),
  bool: bi('логическое', 'boolean'),
  null: bi('пусто', 'null'),
};

const NONE = Symbol('no expectation');
const sub = (want: unknown, key: string | number): unknown => (want === NONE || want === null || typeof want !== 'object' ? NONE : (want as Record<string | number, unknown>)[key]);

function treeEl(v: unknown, other: unknown, want: unknown = NONE, depth = 0): HTMLElement {
  const k = kindOf(v);
  if (k === 'map' || k === 'seq') {
    const entries = k === 'map' ? Object.entries(v as object) : (v as unknown[]).map((x, i) => [`- ${i}`, x] as [string, unknown]);
    const otherObj = (other ?? {}) as Record<string, unknown>;
    return h(
      'ul.yt-list',
      { 'data-depth': depth },
      ...entries.map(([key, val]) => {
        const at = k === 'map' ? key : Number(key.slice(2));
        const ok = k === 'map' ? otherObj[key] : (other as unknown[] | undefined)?.[at as number];
        const w = sub(want, at);
        return h('li', {}, h('span.yt-key', {}, key), h('span.yt-kind', { 'data-kind': kindOf(val) }, t(KIND[kindOf(val)])), typeof val === 'object' && val !== null ? treeEl(val, ok, w, depth + 1) : scalarEl(val, ok, w));
      }),
    );
  }
  return scalarEl(v, other, want);
}

function scalarEl(v: unknown, other: unknown, want: unknown = NONE): HTMLElement {
  const differs = JSON.stringify(v) !== JSON.stringify(other);
  const todo = want !== NONE && JSON.stringify(v) !== JSON.stringify(want);
  const title = [differs ? `${t(W.diff)}: ${JSON.stringify(other)}` : '', todo ? `${t(W.todo)}: ${JSON.stringify(want)}` : ''].filter(Boolean).join('. ');
  return h('code.yt-val', { 'data-kind': kindOf(v), class: [differs ? 'yt-differs' : '', todo ? 'yt-todo' : ''].filter(Boolean).join(' '), title }, JSON.stringify(v));
}

export interface YamlWidgetProps {
  text: string;
  version?: '1.1' | '1.2';
  /** Done when the tree equals this JSON (both versions, if `bothVersions`). */
  expect?: unknown;
  bothVersions?: boolean;
  goal?: Bi;
}

export const yamlWidget: WidgetReg = {
  id: 'yaml.parser',
  mount(el, props, ctx) {
    const p = props as YamlWidgetProps;
    let version: '1.1' | '1.2' = p.version ?? '1.2';
    let done = false;
    const ta = h('textarea.yp-text', { spellcheck: 'false', rows: Math.max(8, p.text.split('\n').length + 1), 'aria-label': t(W.source) }) as HTMLTextAreaElement;
    ta.value = p.text;
    const gutter = h('pre.yp-gutter', { 'aria-hidden': 'true' });
    const treeBox = h('div.yp-tree');
    const jsonBox = h('pre.yp-json');
    const status = h('p.yp-status', { 'aria-live': 'polite' });
    const parsedAs = h('p.yp-parsed');
    // One group name per widget: the two versions are alternatives, so exactly one stays checked.
    const group = `yv-${Math.random().toString(36).slice(2)}`;
    const radios = (['1.2', '1.1'] as const).map((v) =>
      h(
        'label.chip',
        {},
        h('input', { type: 'radio', name: group, value: v, checked: v === version, onchange: () => ((version = v), draw()) }),
        t(v === '1.2' ? W.v12 : W.v11),
      ),
    );
    const parse = (v: '1.1' | '1.2') => parseDocument(ta.value, { version: v, prettyErrors: false, uniqueKeys: true });
    const draw = () => {
      const lines = ta.value.split('\n').length;
      const doc = parse(version);
      const errLines = new Set(doc.errors.map((e) => e.linePos?.[0].line ?? 0));
      gutter.textContent = '';
      for (let i = 1; i <= lines; i++) gutter.append(h('span', { class: errLines.has(i) ? 'err' : '' }, String(i)), '\n');
      clear(treeBox);
      clear(status);
      parsedAs.textContent = t(W.parsedAs).replace('{v}', version);
      if (doc.errors.length) {
        const e = doc.errors[0];
        status.className = 'yp-status err';
        status.append(h('span.st-icon.err', { 'aria-hidden': 'true' }, '!'), ` ${e.linePos ? `${e.linePos[0].line}:${e.linePos[0].col} ` : ''}${e.message.split('\n')[0]}`);
        jsonBox.textContent = '';
        return;
      }
      const value = doc.toJS();
      const other = parse(version === '1.2' ? '1.1' : '1.2').toJS();
      treeBox.append(treeEl(value, other, p.expect === undefined ? NONE : p.expect));
      jsonBox.textContent = JSON.stringify(value, null, 2);
      status.className = 'yp-status ok';
      const same = (x: unknown) => JSON.stringify(x) === JSON.stringify(p.expect);
      const solved = p.expect !== undefined && same(value) && (!p.bothVersions || same(other));
      status.append(h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), ' ', t(solved ? W.done : W.ok));
      if (solved && !done) {
        done = true;
        ctx.complete();
      }
    };
    ta.addEventListener('input', draw);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
        draw();
      }
    });
    clear(el);
    el.append(
      h(
        'div.yp',
        {},
        h('div.yp-head', {}, h('h3', {}, t(W.title)), h('div.yp-modes', {}, ...radios)),
        p.goal ? h('p.yp-goal', {}, h('strong', {}, `${t(W.goal)}: `), t(p.goal)) : null,
        h('div.yp-grid', {}, h('div.yp-src', {}, h('h4', {}, t(W.source)), h('div.yp-editor', {}, gutter, ta)), h('div.yp-out', {}, h('h4', {}, t(W.tree)), parsedAs, treeBox, p.expect !== undefined ? h('p.yp-legend', {}, t(W.legend)) : null, h('details', {}, h('summary', {}, t(W.json)), jsonBox))),
        status,
      ),
    );
    draw();
    if (p.expect === undefined) ctx.complete();
    return {
      dispose() {},
      describe: () => `YAML (${version}): ${ta.value.slice(0, 400)}`,
    };
  },
};
