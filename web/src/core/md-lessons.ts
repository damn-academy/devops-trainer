import { bi } from './i18n';
import type { Lesson, SourceLink, Section, QuizItem } from './types';

type SectionKind = 'hook' | 'theory' | 'task' | 'sources' | 'widget' | 'quiz';
interface MarkdownSection { kind: SectionKind; title?: string; body: string; continuation?: boolean; widget?: string; props?: Record<string, unknown> }
export interface MarkdownLesson {
  id: string;
  title: string;
  minutes: number;
  sections: MarkdownSection[];
}

/** Parse only the authoring markers; leave Markdown and concept links intact. */
export function parseMarkdownLessons(raw: string): MarkdownLesson[] {
  const lessons: MarkdownLesson[] = [];
  let lesson: MarkdownLesson | undefined;
  let section: MarkdownSection | undefined;
  let inQuiz = false;
  let resume: MarkdownSection | undefined;
  let fence = '';
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = line.trim();
    const f = /^(`{3,}|~{3,})/.exec(marker);
    if (f && (!fence || (f[1]![0] === fence[0] && f[1]!.length >= fence.length))) fence = fence ? '' : f[1]!;
    if (f || fence) { if (!section) throw new Error('Fence outside section'); section.body += `${line}\n`; continue; }
    if (inQuiz) {
      if (marker === '<!-- /quiz -->') { inQuiz = false; section = undefined; continue; }
      if (/^<!--/.test(marker)) throw new Error('Unclosed quiz');
      section!.body += `${line}\n`; continue;
    }
    const widget = /^<!-- widget:\s*([\w.-]+)(?:\s+(\{.*\}))?\s*-->$/.exec(marker);
    if (widget || marker === '<!-- quiz -->') {
      if (!lesson) throw new Error('Embed before lesson');
      if (section && !['widget', 'quiz'].includes(section.kind)) {
        resume = section;
        if (!section.body.trim() && ['task', 'theory'].includes(section.kind)) lesson.sections.pop();
      }
      const props: unknown = widget?.[2] ? JSON.parse(widget[2]) : undefined;
      if (props !== undefined && (!props || Array.isArray(props) || typeof props !== 'object')) throw new Error('Widget props must be an object');
      section = widget ? { kind: 'widget', body: '', widget: widget[1], props: props as Record<string, unknown> } : { kind: 'quiz', body: '' };
      lesson.sections.push(section);
      inQuiz = !widget;
      if (widget) section = undefined;
      continue;
    }
    const start = /^<!-- lesson:\s*([\w.-]+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*-->$/.exec(marker);
    if (start) {
      if (lessons.some((l) => l.id === start[1])) throw new Error(`Duplicate lesson: ${start[1]}`);
      lesson = { id: start[1]!, title: start[2]!.trim(), minutes: Number(start[3]), sections: [] };
      if (!lesson.title || lesson.minutes <= 0) throw new Error(`Invalid lesson: ${lesson.id}`);
      lessons.push(lesson);
      section = undefined;
      resume = undefined;
      continue;
    }
    const next = /^<!-- section:\s*(hook|theory|task|sources)(?:\s*\|\s*([^|]+?))?\s*-->$/.exec(marker);
    if (next) {
      if (!lesson) throw new Error('Section before lesson');
      resume = undefined;
      const kind = next[1] as SectionKind;
      const title = next[2]?.trim();
      if ((kind === 'theory' || kind === 'task') && !title) throw new Error(`Missing ${kind} title: ${lesson.id}`);
      if ((kind === 'hook' || kind === 'sources') && title) throw new Error(`Unexpected ${kind} title: ${lesson.id}`);
      section = { kind, title, body: '' };
      lesson.sections.push(section);
      continue;
    }
    if (/^<!--\s*(lesson|section|widget|\/?quiz)\b/.test(marker)) throw new Error(`Invalid marker: ${marker}`);
    if (!section && marker && resume && lesson) { section = { kind: resume.kind, title: resume.title, body: '', continuation: true }; lesson.sections.push(section); }
    if (section) section.body += `${line}\n`;
    else if (marker) throw new Error('Text outside a section');
  }
  if (inQuiz) throw new Error('Unclosed quiz');
  if (!lessons.length) throw new Error('No lessons');
  for (const l of lessons) {
    if (l.sections[0]?.kind !== 'hook' || l.sections.filter((s) => s.kind === 'hook' && !s.continuation).length !== 1) {
      throw new Error(`Expected one opening hook: ${l.id}`);
    }
    if (l.sections.filter((s) => s.kind === 'sources').length > 1 ||
        l.sections.some((s, i) => s.kind === 'sources' && i !== l.sections.length - 1)) {
      throw new Error(`Sources must be last: ${l.id}`);
    }
    for (const s of l.sections) {
      s.body = s.body.trim();
      if (s.kind === 'quiz') parseQuestions(s.body);
      if (!s.body && s.kind !== 'widget') throw new Error(`Empty ${s.kind}: ${l.id}`);
    }
  }
  return lessons;
}

function sources(body: string): SourceLink[] {
  return body.split('\n').filter((line) => line.trim()).flatMap((line) => {
    if (!line.trim().startsWith('- ')) throw new Error(`Invalid source: ${line}`);
    const sharedDate = / \(([^()\n]+)\)$/.exec(line)?.[1];
    // Preserve grouped references, individual dates, and undated source links.
    return line.trim().slice(2).split(/;\s+(?=[^;]+ — https?:\/\/)/).flatMap((entry) => {
      const heading = /^(.+?) — (.+)$/.exec(entry);
      if (!heading) throw new Error(`Invalid source: ${line}`);
      const refs = heading[2]!;
      const links: SourceLink[] = [];
      let end = 0;
      for (const match of refs.matchAll(/(https?:\/\/[^\s,;]+)(?: \(([^\n]+?)\))?/g)) {
        const separator = refs.slice(end, match.index).trim();
        if (links.length ? ![',', 'и', 'and'].includes(separator) : separator !== '') {
          throw new Error(`Invalid source separator: ${line}`);
        }
        const address = match[1]!;
        if (!new URL(address).hostname) throw new Error(`Invalid source URL: ${line}`);
        const date = match[2] ?? sharedDate;
        links.push({ title: heading[1]!, url: address, ...(date ? { note: bi(date, date) } : {}) });
        end = match.index + match[0].length;
      }
      if (!links.length || refs.slice(end).trim()) throw new Error(`Invalid source: ${line}`);
      return links;
    });
  });
}

/** Source sections may be omitted in English; all prose must match structurally. */
export function bilingualLessons(ruRaw: string, enRaw: string, block = 'marketing'): Lesson[] {
  const ru = parseMarkdownLessons(ruRaw);
  const en = parseMarkdownLessons(enRaw);
  if (ru.length !== en.length) throw new Error('Translation lesson count mismatch');
  return ru.map((r, i) => {
    const e = en[i]!;
    const rs = r.sections.filter((s) => s.kind !== 'sources');
    const es = e.sections.filter((s) => s.kind !== 'sources');
    if (r.id !== e.id || r.minutes !== e.minutes || rs.length !== es.length ||
        rs.some((s, j) => s.kind !== es[j]!.kind || Boolean(s.title) !== Boolean(es[j]!.title))) {
      throw new Error(`Translation structure mismatch: ${r.id}`);
    }
    const ruSources = r.sections.find((s) => s.kind === 'sources');
    if (!ruSources) throw new Error(`Missing Russian sources: ${r.id}`);
    const enSources = e.sections.find((s) => s.kind === 'sources');
    const counts: Record<SectionKind, number> = { hook: 0, theory: 0, task: 0, sources: 0, widget: 0, quiz: 0 };
    let question = 0;
    const sections: Section[] = rs.map((s, j): Section => {
      const e = es[j]!;
      const id = `${s.kind}-${++counts[s.kind]}`;
      if (s.kind === 'widget') {
        if (s.widget !== e.widget || canonical(s.props) !== canonical(e.props)) throw new Error(`Translation widget mismatch: ${r.id}`);
        return { id, kind: 'widget', step: 'practice', widget: s.widget!, props: s.props };
      }
      if (s.kind === 'quiz') {
        const rq = parseQuestions(s.body), eq = parseQuestions(e.body);
        if (rq.length !== eq.length) throw new Error(`Translation quiz mismatch: ${r.id}`);
        const items: QuizItem[] = rq.map((q, k) => {
          const translated = eq[k]!;
          if (q.options.length !== translated.options.length || q.options.some((o, n) => o.correct !== translated.options[n]!.correct)) throw new Error(`Translation options mismatch: ${r.id}`);
          return { id: `${r.id}.q${++question}`, kind: 'mcq', prompt: bi(q.prompt, translated.prompt), refs: { lesson: r.id },
            options: q.options.map((o, n) => ({ id: `o${n + 1}`, correct: o.correct, text: bi(o.text, translated.options[n]!.text), why: bi(o.why, translated.options[n]!.why) })) };
        });
        return { id, kind: 'quiz', step: 'exit', items };
      }
      return { id, kind: 'text', step: s.kind === 'hook' ? 'hook' : s.kind === 'task' ? 'practice' : 'explain',
        ...(s.title ? { title: bi(s.title, e.title!) } : {}), body: bi(s.body, e.body) };
    });
    const conceptIds = (l: MarkdownLesson) => [...
      [l.title, ...l.sections.flatMap((s) => [s.title ?? '', s.body])]
        .join('\n').matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g),
    ].map((m) => m[1]!);
    const uses = [...new Set([...conceptIds(r), ...conceptIds(e)])];
    return {
      id: r.id, block, title: bi(r.title, e.title),
      summary: bi(rs[0]!.body, es[0]!.body), minutes: r.minutes,
      introduces: [], uses, tier: 'core', sections,
      sources: { ru: sources(ruSources.body), en: sources((enSources ?? ruSources).body) },
    };
  });
}

export function loadMarkdownLessons(files: Record<string, string>, block = 'marketing'): Lesson[] {
  const result: Lesson[] = [];
  for (const path of Object.keys(files).filter((p) => p.endsWith('.ru.md')).sort()) {
    const enPath = path.replace(/\.ru\.md$/, '.en.md');
    if (!(enPath in files)) throw new Error(`Missing translation: ${enPath}`);
    try { result.push(...bilingualLessons(files[path]!, files[enPath]!, block)); }
    catch (error) { throw new Error(`${path}: ${String(error)}`); }
  }
  for (const path of Object.keys(files).filter((p) => p.endsWith('.en.md'))) {
    if (!(path.replace(/\.en\.md$/, '.ru.md') in files)) throw new Error(`Missing Russian original: ${path}`);
  }
  const ids = result.map((l) => l.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate lesson across files');
  return result;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical));
  if (value && typeof value === 'object') return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return JSON.stringify(value) ?? '';
}

function parseQuestions(body: string) {
  return body.trim().split(/\n\s*\n/).map(item => {
    const [first, ...lines] = item.split('\n');
    if (!first?.startsWith('? ') || !first.slice(2).trim()) throw new Error('Invalid quiz question');
    const options = lines.map(line => {
      const match = /^([+-]) (.+?)\s*\|\|\s*(.+)$/.exec(line);
      if (!match || !match[2]!.trim() || !match[3]!.trim()) throw new Error('Invalid quiz option');
      return { correct: match[1] === '+', text: match[2]!.trim(), why: match[3]!.trim() };
    });
    if (options.length < 2 || options.filter(o => o.correct).length !== 1) throw new Error('MCQ needs one correct answer and a distractor');
    return { prompt: first.slice(2).trim(), options };
  });
}

/** Register these alongside the returned lessons in BlockModule.quiz. */
export function markdownQuizItems(lessons: Lesson[]): QuizItem[] {
  return lessons.flatMap(l => l.sections.flatMap(s => s.kind === 'quiz' ? s.items.filter((q): q is QuizItem => typeof q !== 'string') : []));
}
