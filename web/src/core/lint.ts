// The content linter. The concept-order rule (01 §6.1) is the heart of it: a
// term may appear in a lesson only in or after the lesson that introduces it.
// It also checks the contracts the platform relies on: bilingual text,
// sources in both languages, explainer diagrams (labels on every edge, a card
// on every element, ≤ 12 nodes), quiz items (a why for every distractor),
// doc-ladder rules (DL4 has no hints) and predicates that compile.

import { plainText, conceptLinks } from './markdown';
import { compile, readsTypedText } from './predicate';
import type { Registry } from './registry';
import type { Bi, Check, Lesson, ProcessModel, QuizItem, Task } from './types';

export interface LintIssue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

const isBi = (v: unknown): v is Bi =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as Bi).ru === 'string' && typeof (v as Bi).en === 'string' && Object.keys(v).length === 2;

/** Every Bi inside a value, with its path. */
export function collectBis(v: unknown, path = '', out: { path: string; bi: Bi }[] = [], seen = new Set<unknown>()): { path: string; bi: Bi }[] {
  if (typeof v !== 'object' || v === null || seen.has(v)) return out;
  seen.add(v);
  if (isBi(v)) {
    out.push({ path, bi: v });
    return out;
  }
  if (Array.isArray(v)) v.forEach((x, i) => collectBis(x, `${path}[${i}]`, out, seen));
  else for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') collectBis(x, path ? `${path}.${k}` : k, out, seen);
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordRe(words: string[]): RegExp | null {
  const ws = words.map((w) => w.trim()).filter(Boolean);
  if (!ws.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}_.-])(?:${ws.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_-])`, 'iu');
}

/** Learner-visible texts of a lesson (both languages), with the bank items its quiz sections reference. */
function lessonTexts(l: Lesson, reg: Registry): { path: string; bi: Bi }[] {
  const items: unknown[] = [];
  for (const s of l.sections) if (s.kind === 'quiz') for (const it of s.items) items.push(typeof it === 'string' ? reg.quiz.get(it) : it);
  return [...collectBis({ title: l.title, summary: l.summary, sections: l.sections }), ...collectBis({ bank: items })];
}

function lintPredicate(src: unknown, where: string, issues: LintIssue[], isWhen: boolean): void {
  if (typeof src !== 'string') return;
  try {
    compile(src);
    if (isWhen && readsTypedText(src)) issues.push({ level: 'error', where, msg: `"when" reads typed text (term.*.line / history): check the effect, not the way (09 §2.4): ${src}` });
  } catch (e) {
    issues.push({ level: 'error', where, msg: `predicate does not compile: ${(e as Error).message}` });
  }
}

function lintCheck(c: Check, where: string, issues: LintIssue[]): void {
  if (c.when === undefined && c.stdout === undefined) issues.push({ level: 'error', where, msg: 'check has neither "when" nor "stdout"' });
  lintPredicate(c.when, `${where}.when`, issues, true);
  c.fail?.forEach((f, i) => lintPredicate(f.if, `${where}.fail[${i}]`, issues, false));
}

function lintTask(t: Task, where: string, issues: LintIssue[]): void {
  lintCheck(t.check, `${where}.check`, issues);
  if (t.docStep === 4 || t.docStep === 5) {
    if (!t.beyond && t.docStep === 4) issues.push({ level: 'error', where, msg: 'docStep 4 (forcing) requires beyond: true' });
    const hints = Object.keys(t.hints ?? {}).filter((k) => k !== 'H1');
    if (hints.length) issues.push({ level: 'error', where, msg: `DL${t.docStep} task must not carry content hints (found ${hints.join(', ')})` });
    if (!t.solutionTokens?.length) issues.push({ level: 'error', where, msg: 'DL4/DL5 task needs solutionTokens the mentor must not say' });
  }
}

export function lintQuizItem(q: QuizItem, where: string, issues: LintIssue[]): void {
  switch (q.kind) {
    case 'mcq':
    case 'multi': {
      const right = q.options.filter((o) => o.correct).length;
      if (q.kind === 'mcq' && right !== 1) issues.push({ level: 'error', where, msg: `mcq needs exactly one correct option (has ${right})` });
      if (q.kind === 'multi' && right < 1) issues.push({ level: 'error', where, msg: 'multi needs at least one correct option' });
      if (q.options.length < 2) issues.push({ level: 'error', where, msg: 'needs at least two options' });
      for (const o of q.options) if (!o.correct && !o.why) issues.push({ level: 'error', where: `${where}.${o.id}`, msg: 'every distractor needs a "why"' });
      if (new Set(q.options.map((o) => o.id)).size !== q.options.length) issues.push({ level: 'error', where, msg: 'duplicate option ids' });
      break;
    }
    case 'order':
      if (q.steps.length < 2) issues.push({ level: 'error', where, msg: 'order needs at least two steps' });
      break;
    case 'match':
      if (q.pairs.length < 2) issues.push({ level: 'error', where, msg: 'match needs at least two pairs' });
      break;
    case 'fill-command':
      if (!q.answers?.length && !q.check) issues.push({ level: 'error', where, msg: 'fill-command needs answers or a check' });
      if (q.check) lintCheck(q.check, `${where}.check`, issues);
      for (const m of q.misconceptions ?? []) {
        try {
          new RegExp(m.match);
        } catch {
          issues.push({ level: 'error', where, msg: `misconception regexp does not compile: ${m.match}` });
        }
      }
      break;
    case 'predict-output':
      if (!q.command.trim()) issues.push({ level: 'error', where, msg: 'predict-output needs a command' });
      if (q.options) {
        if (q.options.filter((o) => o.correct).length !== 1) issues.push({ level: 'error', where, msg: 'predict-output with options needs exactly one correct option' });
        for (const o of q.options) if (!o.correct && !o.why) issues.push({ level: 'error', where: `${where}.${o.id}`, msg: 'every distractor needs a "why"' });
      }
      break;
    case 'bugfind': {
      const n = q.code.split('\n').length;
      if (!q.bug.length || q.bug.some((b) => b < 1 || b > n)) issues.push({ level: 'error', where, msg: 'bug lines must exist in the code' });
      for (const b of q.bug) if (!q.why[b]) issues.push({ level: 'error', where, msg: `the buggy line ${b} needs a "why"` });
      break;
    }
    case 'label': {
      const ids = new Set(q.labels.map((l) => l.id));
      for (const s of q.diagram.slots) if (!ids.has(s.answer)) issues.push({ level: 'error', where, msg: `slot ${s.id} answer "${s.answer}" is not a label` });
      break;
    }
  }
}

/** Diagram and model rules of 08 §3.4 and §5.3. */
export function lintModel(m: ProcessModel<Record<string, unknown>>, where: string, issues: LintIssue[]): void {
  const d = m.diagram;
  const ids = new Set<string>();
  const dup = (id: string) => {
    if (ids.has(id)) issues.push({ level: 'error', where, msg: `diagram id "${id}" used twice` });
    ids.add(id);
  };
  if (d.nodes.length > 12) issues.push({ level: 'error', where, msg: `diagram has ${d.nodes.length} nodes; one screen, one idea: at most 12` });
  for (const n of d.nodes) {
    dup(n.id);
    if (!n.card?.what || !n.card?.who) issues.push({ level: 'error', where: `${where}.${n.id}`, msg: 'every node needs a card with "what" and "who"' });
    if (n.x < 0 || n.y < 0 || n.x + n.w > d.width || n.y + n.h > d.height) issues.push({ level: 'warn', where: `${where}.${n.id}`, msg: 'node is outside the diagram' });
  }
  for (const e of d.edges) {
    dup(e.id);
    if (!e.label || (typeof e.label !== 'string' && (!e.label.ru || !e.label.en))) issues.push({ level: 'error', where: `${where}.${e.id}`, msg: 'every edge is labelled on the line' });
    if (!e.card?.what || !e.card?.who) issues.push({ level: 'error', where: `${where}.${e.id}`, msg: 'every edge needs a card with "what" and "who"' });
    if (!d.nodes.some((n) => n.id === e.from) || !d.nodes.some((n) => n.id === e.to)) issues.push({ level: 'error', where: `${where}.${e.id}`, msg: 'edge ends must be nodes' });
  }
  for (const g of d.groups ?? []) {
    dup(g.id);
    if (!g.card?.what || !g.card?.who) issues.push({ level: 'error', where: `${where}.${g.id}`, msg: 'every group needs a card' });
  }
  for (const b of m.breaks) for (const r of b.remove) if (!ids.has(r)) issues.push({ level: 'error', where: `${where}.break.${b.id}`, msg: `removes unknown element "${r}"` });
  const defaults = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
  let steps;
  try {
    steps = m.run(defaults, new Set());
  } catch (e) {
    issues.push({ level: 'error', where, msg: `run(defaults) throws: ${(e as Error).message}` });
    return;
  }
  if (!steps.length) issues.push({ level: 'error', where, msg: 'run(defaults) returns no steps' });
  for (const s of steps) for (const f of s.focus) if (!ids.has(f)) issues.push({ level: 'error', where: `${where}.step.${s.id}`, msg: `focus on unknown element "${f}"` });
  for (const b of m.breaks) {
    try {
      const broken = m.run(defaults, new Set([b.id]));
      if (!broken.some((s) => s.broken)) issues.push({ level: 'warn', where: `${where}.break.${b.id}`, msg: 'the run with this break never reports where the process stopped (Step.broken)' });
    } catch (e) {
      issues.push({ level: 'error', where: `${where}.break.${b.id}`, msg: `run throws: ${(e as Error).message}` });
    }
  }
}

export function lintRegistry(reg: Registry): LintIssue[] {
  const issues: LintIssue[] = reg.errors.map((msg) => ({ level: 'error' as const, where: 'registry', msg }));
  const lessons = reg.orderedLessons();
  const pos = (id: string) => reg.position(id);

  // Bilingual completeness everywhere.
  const all = {
    blocks: [...reg.blocks.values()],
    lessons: [...reg.lessons.values()],
    concepts: [...reg.concepts.values()],
    quiz: [...reg.quiz.values()],
    exams: [...reg.exams.values()],
    explainers: [...reg.explainers.values()].map((e) => ({ id: e.id, title: e.title, summary: e.summary, model: e.model ? { diagram: e.model.diagram, params: e.model.params, breaks: e.model.breaks.map((b) => ({ label: b.label, predict: { prompt: b.predict.prompt, options: b.predict.options } })) } : undefined })),
  };
  for (const { path, bi } of collectBis(all)) {
    if (!bi.ru.trim() || !bi.en.trim()) issues.push({ level: 'error', where: path, msg: `missing ${!bi.ru.trim() ? 'Russian' : 'English'} text` });
  }

  // Blocks and lessons.
  const owner = new Map<string, string>();
  for (const b of reg.blocks.values()) {
    for (const id of b.lessons) {
      const l = reg.lessons.get(id);
      if (!l) issues.push({ level: 'error', where: `block ${b.id}`, msg: `lists unknown lesson "${id}"` });
      else if (l.block !== b.id) issues.push({ level: 'error', where: `lesson ${id}`, msg: `belongs to block "${l.block}" but is listed in "${b.id}"` });
      if (owner.has(id)) issues.push({ level: 'error', where: `lesson ${id}`, msg: `listed in two blocks: ${owner.get(id)} and ${b.id}` });
      owner.set(id, b.id);
    }
    if (!b.placement.length && !b.hidden) issues.push({ level: 'warn', where: `block ${b.id}`, msg: 'no placement tasks yet ("show what you know")' });
    for (const p of b.placement) {
      if (p.kind === 'quiz') lintQuizItem(p.item, `block ${b.id}.placement.${p.id}`, issues);
      else lintTask(p.task, `block ${b.id}.placement.${p.id}`, issues);
    }
    if (b.exam && !reg.exams.has(b.exam)) issues.push({ level: 'error', where: `block ${b.id}`, msg: `unknown exam "${b.exam}"` });
  }
  for (const l of reg.lessons.values()) if (!owner.has(l.id)) issues.push({ level: 'error', where: `lesson ${l.id}`, msg: 'is not listed in any block' });

  // Concepts.
  for (const c of reg.concepts.values()) {
    const l = reg.lessons.get(c.introducedIn);
    if (!l) issues.push({ level: 'error', where: `concept ${c.id}`, msg: `introducedIn unknown lesson "${c.introducedIn}"` });
    else if (!l.introduces.includes(c.id)) issues.push({ level: 'error', where: `concept ${c.id}`, msg: `lesson ${l.id} does not list it in introduces` });
  }

  // Lessons: the order rule, sections, sources.
  for (const l of lessons) {
    const here = pos(l.id);
    const where = `lesson ${l.id}`;
    for (const c of l.introduces) {
      const concept = reg.concepts.get(c);
      if (!concept) issues.push({ level: 'error', where, msg: `introduces unknown concept "${c}"` });
      else if (concept.introducedIn !== l.id) issues.push({ level: 'error', where, msg: `introduces "${c}", but the concept says it is introduced in ${concept.introducedIn}` });
    }
    for (const c of l.uses) {
      const concept = reg.concepts.get(c);
      if (!concept) {
        issues.push({ level: 'error', where, msg: `uses unknown concept "${c}"` });
        continue;
      }
      const at = pos(concept.introducedIn);
      if (at < 0 || at >= here) issues.push({ level: 'error', where, msg: `uses "${c}" before it is introduced (in ${concept.introducedIn})` });
    }
    if (!l.sources.en.length || !l.sources.ru.length) issues.push({ level: 'error', where, msg: 'needs sources in English and in Russian' });
    for (const s of [...l.sources.en, ...l.sources.ru]) if (!/^https:\/\//.test(s.url)) issues.push({ level: 'error', where, msg: `source URL must be https: ${s.url}` });
    const secIds = new Set<string>();
    for (const s of l.sections) {
      const sw = `${where} § ${s.id}`;
      if (secIds.has(s.id)) issues.push({ level: 'error', where: sw, msg: 'duplicate section id' });
      secIds.add(s.id);
      if (s.kind === 'explainer' && !reg.explainers.has(s.explainer)) issues.push({ level: 'error', where: sw, msg: `unknown explainer "${s.explainer}"` });
      if (s.kind === 'widget' && !reg.widgets.has(s.widget)) issues.push({ level: 'error', where: sw, msg: `unknown widget "${s.widget}"` });
      if (s.kind === 'quiz') {
        s.items.forEach((it, i) => {
          if (typeof it === 'string') {
            if (!reg.quiz.has(it)) issues.push({ level: 'error', where: sw, msg: `unknown bank item "${it}"` });
          } else lintQuizItem(it, `${sw}[${i}]`, issues);
        });
      }
      if (s.kind === 'terminal') s.tasks.forEach((t) => lintTask(t, `${sw}.${t.id}`, issues));
      if (s.kind === 'docs') {
        if (s.mode === 'anatomy' && !s.answer) issues.push({ level: 'error', where: sw, msg: 'anatomy task needs the answer section id' });
        if (s.mode === 'find' && !s.terminal) issues.push({ level: 'error', where: sw, msg: 'find task needs a terminal task' });
        if (s.terminal) lintTask(s.terminal.task, `${sw}.task`, issues);
        if (s.ref.page && !reg.corpus.get(s.ref.page)) issues.push({ level: 'error', where: sw, msg: `doc page "${s.ref.page}" is not in the corpus` });
        if (s.mode === 'anatomy' && s.ref.page && s.answer && !reg.corpus.get(s.ref.page)?.sections.some((x) => x.id === s.answer)) {
          issues.push({ level: 'error', where: sw, msg: `page ${s.ref.page} has no section "${s.answer}"` });
        }
      }
    }

    // Glossary links: the concept must exist and be introduced here or earlier.
    for (const { path, bi } of lessonTexts(l, reg)) {
      for (const text of [bi.ru, bi.en]) {
        for (const link of conceptLinks(text)) {
          const c = reg.concepts.get(link.id);
          if (!c) issues.push({ level: 'error', where: `${where} ${path}`, msg: `links unknown concept [[${link.id}]]` });
          else {
            const at = pos(c.introducedIn);
            if (at < 0 || at > here) issues.push({ level: 'error', where: `${where} ${path}`, msg: `links [[${link.id}]] before it is introduced (in ${c.introducedIn})` });
          }
        }
      }
    }
  }

  // Glossary scan: a term must not appear in prose before its lesson.
  const texts = lessons.map((l) => ({ l, at: pos(l.id), bis: lessonTexts(l, reg) }));
  for (const c of reg.concepts.values()) {
    if (c.scan === false) continue;
    const at = pos(c.introducedIn);
    if (at < 0) continue;
    const ru = wordRe([c.term.ru, ...(c.forms?.ru ?? [])]);
    const en = wordRe([c.term.en, ...(c.forms?.en ?? [])]);
    for (const t of texts) {
      if (t.at >= at) continue;
      for (const { path, bi } of t.bis) {
        const hitRu = ru?.exec(plainText(bi.ru));
        const hitEn = en?.exec(plainText(bi.en));
        const hit = hitRu?.[0] ?? hitEn?.[0];
        if (hit) {
          issues.push({ level: 'error', where: `lesson ${t.l.id} ${path}`, msg: `term "${hit}" (${c.id}) appears before ${c.introducedIn} introduces it` });
          break;
        }
      }
    }
  }

  // Explainers.
  for (const e of reg.explainers.values()) {
    if (!reg.blocks.has(e.block) && !reg.origin.has(`block:${e.block}`)) issues.push({ level: 'warn', where: `explainer ${e.id}`, msg: `block "${e.block}" is not delivered yet` });
    if (e.model) lintModel(e.model, `explainer ${e.id}`, issues);
  }
  for (const q of reg.quiz.values()) lintQuizItem(q, `quiz ${q.id}`, issues);
  for (const ex of reg.exams.values()) {
    for (const t of ex.tasks) {
      if (t.kind === 'quiz') lintQuizItem(t.item, `exam ${ex.id}.${t.id}`, issues);
      else lintTask(t.task, `exam ${ex.id}.${t.id}`, issues);
    }
  }
  return issues;
}
