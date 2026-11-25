import { bi } from '../../../core/i18n';
import type { Lesson, SourceLink, TextSection } from '../../../core/types';

type SectionKind = 'hook' | 'theory' | 'task' | 'sources';
interface MarkdownSection { kind: SectionKind; title?: string; body: string }
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
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = line.trim();
    const start = /^<!-- lesson:\s*([\w.-]+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*-->$/.exec(marker);
    if (start) {
      if (lessons.some((l) => l.id === start[1])) throw new Error(`Duplicate lesson: ${start[1]}`);
      lesson = { id: start[1]!, title: start[2]!.trim(), minutes: Number(start[3]), sections: [] };
      if (!lesson.title || lesson.minutes <= 0) throw new Error(`Invalid lesson: ${lesson.id}`);
      lessons.push(lesson);
      section = undefined;
      continue;
    }
    const next = /^<!-- section:\s*(hook|theory|task|sources)(?:\s*\|\s*([^|]+?))?\s*-->$/.exec(marker);
    if (next) {
      if (!lesson) throw new Error('Section before lesson');
      const kind = next[1] as SectionKind;
      const title = next[2]?.trim();
      if ((kind === 'theory' || kind === 'task') && !title) throw new Error(`Missing ${kind} title: ${lesson.id}`);
      if ((kind === 'hook' || kind === 'sources') && title) throw new Error(`Unexpected ${kind} title: ${lesson.id}`);
      section = { kind, title, body: '' };
      lesson.sections.push(section);
      continue;
    }
    if (/^<!--\s*(lesson|section)\b/.test(marker)) throw new Error(`Invalid marker: ${marker}`);
    if (section) section.body += `${line}\n`;
    else if (marker) throw new Error('Text outside a section');
  }
  if (!lessons.length) throw new Error('No lessons');
  for (const l of lessons) {
    if (l.sections[0]?.kind !== 'hook' || l.sections.filter((s) => s.kind === 'hook').length !== 1) {
      throw new Error(`Expected one opening hook: ${l.id}`);
    }
    if (l.sections.filter((s) => s.kind === 'sources').length > 1 ||
        l.sections.some((s, i) => s.kind === 'sources' && i !== l.sections.length - 1)) {
      throw new Error(`Sources must be last: ${l.id}`);
    }
    for (const s of l.sections) {
      s.body = s.body.trim();
      if (!s.body) throw new Error(`Empty ${s.kind}: ${l.id}`);
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
export function bilingualLessons(ruRaw: string, enRaw: string): Lesson[] {
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
    const counts = { hook: 0, theory: 0, task: 0, sources: 0 };
    const sections: TextSection[] = rs.map((s, j) => ({
      id: `${s.kind}-${++counts[s.kind]}`,
      kind: 'text',
      step: s.kind === 'hook' ? 'hook' : s.kind === 'task' ? 'practice' : 'explain',
      ...(s.title ? { title: bi(s.title, es[j]!.title!) } : {}),
      body: bi(s.body, es[j]!.body),
    }));
    const conceptIds = (l: MarkdownLesson) => [...
      [l.title, ...l.sections.flatMap((s) => [s.title ?? '', s.body])]
        .join('\n').matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g),
    ].map((m) => m[1]!);
    const uses = [...new Set([...conceptIds(r), ...conceptIds(e)])];
    return {
      id: r.id, block: 'marketing', title: bi(r.title, e.title),
      summary: bi(rs[0]!.body, es[0]!.body), minutes: r.minutes,
      introduces: [], uses, tier: 'core', sections,
      sources: { ru: sources(ruSources.body), en: sources((enSources ?? ruSources).body) },
    };
  });
}

export function loadMarkdownLessons(files: Record<string, string>): Lesson[] {
  const result: Lesson[] = [];
  for (const path of Object.keys(files).filter((p) => p.endsWith('.ru.md')).sort()) {
    const enPath = path.replace(/\.ru\.md$/, '.en.md');
    if (!(enPath in files)) throw new Error(`Missing translation: ${enPath}`);
    try { result.push(...bilingualLessons(files[path]!, files[enPath]!)); }
    catch (error) { throw new Error(`${path}: ${String(error)}`); }
  }
  for (const path of Object.keys(files).filter((p) => p.endsWith('.en.md'))) {
    if (!(path.replace(/\.en\.md$/, '.ru.md') in files)) throw new Error(`Missing Russian original: ${path}`);
  }
  const ids = result.map((l) => l.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate lesson across files');
  return result;
}
