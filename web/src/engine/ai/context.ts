// What the tutor knows about the moment (01 §16.4, 09 §4.5): the lesson that is
// open, the concepts introduced so far, the current goal of a lab, the last
// terminal lines and the documentation trail. Everything is read from the
// progress store, the registry and the page; nothing in core had to change
// except one `dt:terminal` event the terminal widgets dispatch.

import { lang, t } from '../../core/i18n';
import { registry } from '../../core/registry';
import { parseRoute } from '../../core/router';
import { store } from '../../core/store';
import type { Lesson, Task } from '../../core/types';
import { documentTemplate } from '../trainers/document-fields';
import { loadDraft } from '../trainers/storage';
import { maskSecrets } from './prompt';
import type { TutorContext, TutorMode, VocabEntry } from './prompt';

const MAX_LINES = 40;
const lines: string[] = [];
let listening = false;

/** Keep the last 40 lines of every terminal on the page (sim and v86 dispatch `dt:terminal`). */
export function listenTerminals(target: EventTarget = typeof document !== 'undefined' ? document : new EventTarget()): void {
  if (listening) return;
  listening = true;
  target.addEventListener('dt:terminal', (e) => {
    const d = (e as CustomEvent<{ line: string; out: string; exit: number }>).detail;
    if (!d) return;
    pushTerminal(d.line, d.out, d.exit);
  });
}

export function pushTerminal(line: string, out: string, exit: number): void {
  lines.push(`$ ${maskSecrets(line)}`);
  for (const l of maskSecrets(out).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '').split('\n')) if (l !== '') lines.push(l);
  if (exit !== 0) lines.push(`[exit ${exit}]`);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

export function terminalTail(): string[] {
  return [...lines];
}

export function clearTerminalTail(): void {
  lines.length = 0;
}

/** Tasks of a lesson, wherever they sit (terminal sections and docs "find" tasks). */
export function lessonTasks(l: Lesson): Task[] {
  const out: Task[] = [];
  for (const s of l.sections) {
    if (s.kind === 'terminal') out.push(...s.tasks);
    if (s.kind === 'docs' && s.terminal) out.push(s.terminal.task);
  }
  return out;
}

/** The goal the learner is on now: the lab marks it `.goal.current[data-task]` with its DL tag. */
export function currentTask(l: Lesson | undefined, root: ParentNode | null = typeof document !== 'undefined' ? document : null): { task: Task; docStep?: number } | null {
  if (!l || !root) return null;
  const el = root.querySelector<HTMLElement>('.goal.current[data-task]');
  const id = el?.dataset.task;
  const task = id ? lessonTasks(l).find((x) => x.id === id) : undefined;
  if (!task) {
    const sections = l.sections.filter(s => s.kind === 'text' && s.step === 'practice');
    if (!sections.length) return null;
    const prompt = sections.map(s => s.kind === 'text' ? t(s.body) : '').join('\n\n');
    return { task: { id: `${l.id}.markdown-task`, prompt: { ru: prompt, en: prompt }, hints: [] } as unknown as Task };
  }
  const dl = Number(el?.dataset.docStep) || undefined;
  return { task, docStep: dl || task.docStep || (task.beyond ? 4 : undefined) };
}

const practiceCsv = import.meta.glob<string>('../../../public/templates/metrics-*.csv', { query: '?raw', import: 'default', eager: true });

/** Bind a data card to its lesson's sample-data exercise, not the business task. */
export function templateTask(l: Lesson | undefined, file?: string): ReturnType<typeof currentTask> {
  if (!l || !file?.startsWith('metrics-')) return null;
  if (!l.sections.some(s => s.kind === 'widget' && s.widget === 'template' && (s.props as { file?: string } | undefined)?.file === file)) return null;
  const practice = l.sections.find(s => s.kind === 'text' && s.title?.ru === 'Практика на учебных данных');
  if (practice?.kind !== 'text') return null;
  const filename = `${file}${lang() === 'en' ? '-en' : ''}.csv`;
  const csv = practiceCsv[`../../../public/templates/${filename}`];
  if (!csv) return null;
  const rows = csv.trim().split(/\r?\n/);
  const summary = lang() === 'ru'
    ? `Файл: ${filename}. Колонки: ${rows[0]}. Строк данных: ${rows.length - 1}.`
    : `File: ${filename}. Columns: ${rows[0]}. Data rows: ${rows.length - 1}.`;
  const prompt = `${t(practice.body)}\n\n${summary}`;
  return { task: { id: `${l.id}.${file}`, prompt: { ru: prompt, en: prompt }, hints: [] } as unknown as Task };
}

export function templateDraft(file: string, root: ParentNode | null = typeof document !== 'undefined' ? document : null): string {
  const input = Array.from(root?.querySelectorAll<HTMLTextAreaElement>('textarea[data-template-id]') ?? []).find(el => el.dataset.templateId === file);
  return input ? input.value : loadDraft(`template.${file}`, '');
}

/** Live values take precedence over storage, including an explicitly cleared draft. */
export function documentDraft(l: Lesson | undefined, root: ParentNode | null = typeof document !== 'undefined' ? document : null, includeTemplates = true): string | undefined {
  if (!l) return undefined;
  const drafts = l.sections.filter(s => s.kind === 'text' && s.step === 'practice').map(s => {
    const id = `${l.id}.${s.id}`;
    const input = Array.from(root?.querySelectorAll<HTMLTextAreaElement>('textarea[data-document-id]') ?? []).find(el => el.dataset.documentId === id);
    const value = input ? input.value : loadDraft(`document.${id}`, '');
    const template = s.kind === 'text' ? documentTemplate(id, t(s.title ?? l.title), t(s.body)) : '';
    const legacy = s.kind === 'text' ? `${t(s.title ?? l.title)}\n\n${t(s.body)}\n\n` : '';
    return value === template || value === legacy || !value.trim() ? '' : `## ${t(s.kind === 'text' ? s.title ?? l.title : l.title)}\n\n${value.trim()}`;
  }).filter(Boolean);
  for (const section of includeTemplates ? l.sections : []) {
    if (section.kind !== 'widget' || section.widget !== 'template') continue;
    const props = section.props;
    const file = props && typeof props === 'object' && 'file' in props ? props.file : undefined;
    if (typeof file !== 'string') continue;
    const input = Array.from(root?.querySelectorAll<HTMLTextAreaElement>('textarea[data-template-id]') ?? []).find(el => el.dataset.templateId === file);
    const value = input ? input.value : loadDraft(`template.${file}`, '');
    if (value.trim()) drafts.push(`## ${input?.dataset.templateTitle ?? file}\n\n${value.trim()}`);
  }
  return drafts.length ? drafts.join('\n\n') : undefined;
}

export interface Where {
  lesson?: Lesson;
  /** An exam attempt or a placement check: the tutor is off. */
  exam: boolean;
}

export function where(hash = typeof location !== 'undefined' ? location.hash : ''): Where {
  const r = parseRoute(hash);
  if (r.name === 'exam' || r.name === 'placement') return { exam: true };
  if (r.name === 'lesson') return { lesson: registry.lessons.get(r.id), exam: false };
  return { exam: false };
}

/** The learner's vocabulary: concepts introduced or placed, plus those this lesson introduces. */
export function vocabulary(lesson?: Lesson): VocabEntry[] {
  const ids = new Set(Object.entries(store.state.concepts).filter(([, c]) => c.state !== 'unseen').map(([id]) => id));
  for (const id of lesson?.introduces ?? []) ids.add(id);
  const out: VocabEntry[] = [];
  for (const id of ids) {
    const c = registry.concepts.get(id);
    if (c) out.push({ id, term: c.term, forms: c.forms, short: c.short });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Assemble the context for one question. */
export function gather(o: { mode: TutorMode; hintsUsed?: number; screen?: string; task?: { task: Task; docStep?: number } | null }): TutorContext {
  const w = where();
  const lesson = w.lesson;
  const block = lesson?.block;
  const found = o.task === undefined ? currentTask(lesson) : o.task;
  return {
    lang: lang(),
    level: (block && store.state.levels[block]) || 'beginner',
    mode: w.exam ? 'exam' : o.mode,
    lesson: lesson ? { id: lesson.id, title: t(lesson.title), block } : undefined,
    screen: o.screen,
    task: found ? { id: found.task.id, prompt: t(found.task.prompt), docStep: found.docStep, hintsUsed: o.hintsUsed ?? 0 } : undefined,
    introduced: vocabulary(lesson),
    terminal: terminalTail(),
    docTrail: store.state.docTrail.slice(-12).map((d) => ({ page: d.page, anchor: d.anchor })),
  };
}
