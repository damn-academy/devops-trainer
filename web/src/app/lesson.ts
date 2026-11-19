// The lesson page: sections in order (re-ordered for Experienced: the
// challenge comes first, 08 §5.2), progress auto-saved after every section.

import { h, icon } from '../core/dom';
import { bi, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { Level, Mounted, Section } from '../core/types';
import { conceptLink, emptyState, levelBadge, levelFor, setTitle, sourcesBlock, type Page } from './common';
import { renderSection } from './sections';

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
  store.record({ kind: 'lesson.open', lesson: lesson.id });

  const sections = orderSections(lesson.sections, level);
  const doneSet = new Set(store.state.lessons[lesson.id]?.sections ?? []);
  const bar = h('div.lesson-progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': sections.length, 'aria-label': t(UI.progress) }, h('span'));
  const updateBar = () => {
    const n = sections.filter((s) => doneSet.has(s.id)).length;
    bar.setAttribute('aria-valuenow', String(n));
    (bar.firstChild as HTMLElement).style.width = `${sections.length ? (n / sections.length) * 100 : 0}%`;
  };
  const finished = () => store.state.lessons[lesson.id]?.status === 'done';
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

  const mounts: Mounted[] = [];
  const body = h('div.lesson-body');
  for (const s of sections) {
    const r = renderSection(s, { lesson, block: lesson.block, level, index, count: total, done: markDone });
    if (doneSet.has(s.id)) r.el.classList.add('seen');
    body.append(r.el);
    if (r.mounted) mounts.push(r.mounted);
  }

  const next = block ? registry.lessons.get(block.lessons[index + 1]) : undefined;
  const prev = block ? registry.lessons.get(block.lessons[index - 1]) : undefined;
  const doneBanner = h('div.lesson-done', { hidden: !finished() }, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(bi('Урок пройден. Понятия ушли в повторение.', 'Lesson done. Its concepts are now in your review queue.')));

  const el = h(
    'article.lesson',
    { 'data-level': level },
    h(
      'header.lesson-head',
      {},
      h('nav.crumbs', { 'aria-label': 'breadcrumbs' }, h('a', { href: href({ name: 'home' }) }, t(UI.map)), ' › ', block ? h('a', { href: href({ name: 'block', id: block.id }) }, t(block.title)) : null),
      h('h1', {}, t(lesson.title)),
      lesson.summary ? h('p.lede', {}, t(lesson.summary)) : null,
      h(
        'div.lesson-meta',
        {},
        levelBadge(level),
        h('span.badge.tier', { class: `tier-${lesson.tier}` }, t(UI.tiers[lesson.tier])),
        lesson.minutes ? h('span.muted', {}, `${lesson.minutes} ${t(bi('мин', 'min'))}`) : null,
        h('span.muted', {}, `${t(bi('Урок', 'Lesson'))} ${index + 1} / ${total}`),
      ),
      lesson.introduces.length ? h('p.lesson-concepts', {}, h('span.k', {}, t(UI.introduces)), ' ', ...lesson.introduces.flatMap((c, i) => [i ? ', ' : '', conceptLink(c)])) : null,
      bar,
    ),
    body,
    doneBanner,
    sourcesBlock(lesson.sources),
    h(
      'nav.lesson-nav',
      {},
      prev ? h('a.btn.ghost', { href: href({ name: 'lesson', id: prev.id }) }, icon('prev'), t(prev.title)) : h('span'),
      next ? h('a.btn.primary', { href: href({ name: 'lesson', id: next.id }) }, t(next.title), icon('next')) : block ? h('a.btn.primary', { href: href({ name: 'block', id: block.id }) }, t(block.title), icon('next')) : h('span'),
    ),
  );
  updateBar();
  if (focusSection) requestAnimationFrame(() => el.querySelector(`#s-${CSS.escape(focusSection)}`)?.scrollIntoView({ block: 'start' }));
  return { el, dispose: () => mounts.forEach((m) => m.dispose()) };
}

export { lessonStatus } from './status';
