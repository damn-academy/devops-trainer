import { PRODUCTS } from '../core/products';
import { mountTaskDocument } from '../engine/trainers/document';

/** Widgets that already hold the practice result: a field of their own, or a terminal that checks the work itself. */
const FIELD_WIDGETS = new Set(['rubric', 'roleplay', 'deptsim', 'signal-feed', 'marketing.dns-lab']);
/** XLSX templates are worked on in the file; CSV cards of the metrics course keep their own calculation field. */
const isSpreadsheet = (props: unknown) => { const file = props && typeof props === 'object' && 'file' in props ? props.file : undefined; return typeof file === 'string' && !file.startsWith('metrics-') && file !== 'ru-intensifiers-lint'; };
// The lesson page: sections in order (re-ordered for Experienced: the
// challenge comes first, 08 §5.2), progress auto-saved after every section.

import { renderInline } from '../core/markdown';
import { h, icon } from '../core/dom';
import { bi, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { Level, Mounted, Section, TextSection } from '../core/types';
import { emptyState, levelBadge, levelFor, setDescription, setTitle, sourcesBlock, type Page } from './common';
import { renderSection } from './sections';
import { blockCrumbs } from './common';

/** Experienced learners start with the challenge: the first practice section moves up after the hook. */
export function orderSections(sections: Section[], level: Level): Section[] {
  const visible = sections.filter((s) => !s.levels || s.levels.includes(level));
  if (level !== 'experienced') return visible;
  const pi = visible.findIndex((s) => s.step === 'practice');
  if (pi <= 0) return visible;
  const hook = visible.findIndex((s) => s.step === 'hook');
  const out = [...visible];
  const [p] = out.splice(pi, 1);
  out.splice(hook >= 0 ? hook + 1 : 0, 0, p);
  return out;
}

export function lessonPage(id: string, focusSection?: string): Page {
  const lesson = registry.lessons.get(id);
  if (!lesson) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  const block = registry.blocks.get(lesson.block);
  const level = levelFor(lesson.block);
  const index = block ? block.lessons.indexOf(lesson.id) : 0;
  const total = block ? block.lessons.length : 1;
  setTitle(t(lesson.title), block ? t(block.title) : '');
  setDescription(t(lesson.summary));
  store.record({ kind: 'lesson.open', lesson: lesson.id });

  const sections = orderSections(lesson.sections, level);
  const hook = lesson.sections.find(s => s.kind === 'text' && s.step === 'hook');
  const summary = t(lesson.summary);
  const showSummary = summary && !(hook?.kind === 'text' && t(hook.body).trim() === summary.trim());
  const doneSet = new Set(store.state.lessons[lesson.id]?.sections ?? []);
  const bar = h('div.lesson-progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': sections.length, 'aria-label': t(UI.progress) }, h('span'));
  const updateBar = () => {
    const n = sections.filter((s) => doneSet.has(s.id)).length;
    bar.setAttribute('aria-valuenow', String(n));
    (bar.firstChild as HTMLElement).style.width = `${sections.length ? (n / sections.length) * 100 : 0}%`;
  };
  const finished = () => store.state.lessons[lesson.id]?.status === 'done';
  const doneBanner = h('div.lesson-done', { hidden: !finished() }, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(bi('Урок пройден. Понятия ушли в повторение.', 'Lesson done. Its concepts are now in your review queue.')));
  const markDone = (sid: string) => {
    if (!doneSet.has(sid)) {
      doneSet.add(sid);
      store.record({ kind: 'section.done', lesson: lesson.id, section: sid });
      updateBar();
    }
    if (!finished() && sections.every((s) => doneSet.has(s.id))) {
      store.record({ kind: 'lesson.done', lesson: lesson.id, concepts: lesson.introduces });
      doneBanner.hidden = false;
    }
  };

  const standaloneCourse = PRODUCTS.some(p => p.kind === 'course' && p.id === lesson.block);
  const mounts: Mounted[] = [];
  const body = h('div.lesson-body');
  // Practice of a business course is written down once per lesson: one
  // document after the last practice step, or nothing when a trainer widget
  // already gives the learner a field of its own. Finishing it (or that
  // widget) completes every practice step of the lesson.
  const practice = sections.filter((s): s is TextSection => standaloneCourse && s.kind === 'text' && s.step === 'practice');
  const fieldWidget = sections.some((s) => s.kind === 'widget' && FIELD_WIDGETS.has(s.widget));
  const lastPractice = practice[practice.length - 1];
  const sharedDocument = !!lastPractice && !fieldWidget;
  // A spreadsheet template is worked on in its file; with a task document on
  // the page, finishing the document completes the template section too.
  const spreadsheets = sharedDocument ? sections.filter((s) => s.kind === 'widget' && s.widget === 'template' && isSpreadsheet(s.props)) : [];
  const donePractice = () => [...practice, ...spreadsheets].forEach((p) => markDone(p.id));
  for (const s of sections) {
    const widgetDone = s.kind === 'widget' && FIELD_WIDGETS.has(s.widget) ? (sid: string) => { markDone(sid); donePractice(); } : markDone;
    const r = renderSection(s, { lesson, block: lesson.block, level, index, count: total, manualTextCompletion: standaloneCourse && s.kind === 'text' && s.step === 'practice', isDone: doneSet.has(s.id), sharedDocument, done: widgetDone });
    if (doneSet.has(s.id)) r.el.classList.add('seen');
    body.append(r.el);
    if (r.mounted) mounts.push(r.mounted);
    if (s === lastPractice && !fieldWidget) {
      const task = practice.map((p) => t(p.body)).join('\n\n');
      mounts.push(mountTaskDocument(r.el, `${lesson.id}.${s.id}`, t(s.title ?? lesson.title), task, donePractice, practice.every((p) => doneSet.has(p.id))));
    }
  }

  const next = block ? registry.lessons.get(block.lessons[index + 1]) : undefined;
  const prev = block ? registry.lessons.get(block.lessons[index - 1]) : undefined;

  const el = h(
    'article.lesson',
    { 'data-level': level },
    h(
      'header.lesson-head',
      {},
      blockCrumbs(lesson.block),
      h('h1', {}, t(lesson.title)),
      showSummary ? h('p.lede', {}, ...renderInline(summary)) : null,
      h(
        'div.lesson-meta',
        {},
        levelBadge(level),
        h('span.badge.tier', { class: `tier-${lesson.tier}` }, t(UI.tiers[lesson.tier])),
        lesson.minutes ? h('span.muted', {}, `${lesson.minutes} ${t(bi('мин', 'min'))}`) : null,
        h('span.muted', {}, `${t(bi('Урок', 'Lesson'))} ${index + 1} / ${total}`),
      ),
      bar,
    ),
    body,
    doneBanner,
    sourcesBlock(lesson.sources),
    lesson.verifiedVersion ? h('footer.small.muted', {}, t(bi(`Сверено с версией ${lesson.verifiedVersion}.`, `Verified with version ${lesson.verifiedVersion}.`))) : null,
    h(
      'nav.lesson-nav',
      {},
      prev ? h('a.btn.ghost', { href: href({ name: 'lesson', id: prev.id }) }, icon('prev'), t(prev.title)) : h('span'),
      next ? h('a.btn.primary', { href: href({ name: 'lesson', id: next.id }) }, t(next.title), icon('next')) : block ? h('a.btn.primary', { href: href(standaloneCourse ? { name: 'courses' } : { name: 'block', id: block.id }) }, t(standaloneCourse ? bi('Каталог курсов', 'Course catalog') : block.title), icon('next')) : h('span'),
    ),
  );
  const tableCleanups = Array.from(el.querySelectorAll<HTMLElement>('.md-table-scroll')).map(scroll => {
    const frame = h('div.md-table-frame');
    scroll.replaceWith(frame); frame.append(scroll);
    const hint = h('span.md-table-hint', { 'aria-hidden': 'true', hidden: true }, '→');
    frame.append(hint);
    let touched = false;
    const update = () => {
      const overflow = scroll.scrollWidth > scroll.clientWidth + 1;
      frame.classList.toggle('overflowing', overflow && scroll.scrollLeft < scroll.scrollWidth - scroll.clientWidth - 1);
      hint.hidden = !overflow || touched;
    };
    const onScroll = () => { if (scroll.scrollLeft > 0) touched = true; update(); };
    scroll.addEventListener('scroll', onScroll);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update); observer?.observe(scroll);
    const table = scroll.querySelector('table');
    if (table) observer?.observe(table);
    const frameId = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    let disposed = false;
    void document.fonts?.ready.then(() => { if (!disposed) update(); });
    return () => { disposed = true; cancelAnimationFrame(frameId); observer?.disconnect(); window.removeEventListener('resize', update); scroll.removeEventListener('scroll', onScroll); };
  });
  updateBar();
  if (focusSection) requestAnimationFrame(() => el.querySelector(`#s-${CSS.escape(focusSection)}`)?.scrollIntoView({ block: 'start' }));
  return { el, dispose: () => { tableCleanups.forEach(clean => clean()); mounts.forEach(m => m.dispose()); } };
}

export { lessonStatus } from './status';
