// Renderers of lesson sections. Each section reports "done" once: prose when
// read (scrolled into view), an explainer when every step was seen, a lab
// when every goal passed, a quiz when every item was answered.

import { clear, h, icon, onVisible } from '../core/dom';
import { bi, t, type Bi } from '../core/i18n';
import { registry } from '../core/registry';
import { store } from '../core/store';
import type { BlockId, DocsSection, Level, Lesson, Mounted, QuizItem, Section } from '../core/types';
import { corpus } from '../engine/docs/corpus';
import { ANATOMY, openDoc, renderPage } from '../engine/docs/viewer';
import { mountQuiz } from '../engine/quiz/render';
import { conceptLink, prose } from './common';
import { mountLab } from './terminal-section';
import { renderMd } from '../core/markdown';

export interface SectionCtx {
  lesson: Lesson;
  block?: BlockId;
  level: Level;
  /** Position of the lesson inside its block (ladder schedule). */
  index: number;
  count: number;
  done(sectionId: string): void;
}

const CALLOUT: Record<string, Bi> = {
  note: bi('Заметка', 'Note'),
  warn: bi('Осторожно', 'Careful'),
  why: bi('Зачем это', 'Why this matters'),
  cost: bi('Стоимость', 'Cost'),
  cleanup: bi('Уборка', 'Cleanup'),
};

const md = (b: Bi) => renderMd(t(b), { concept: conceptLink });

export function renderSection(s: Section, c: SectionCtx): { el: HTMLElement; mounted?: Mounted } {
  const el = h('section.lsec', { 'data-kind': s.kind, id: `s-${s.id}`, 'data-step': s.step });
  const done = () => c.done(s.id);
  switch (s.kind) {
    case 'text': {
      if (s.title) el.append(h('h2', {}, t(s.title)));
      el.append(prose(s.body));
      onVisible(el, done, 0.25);
      return { el };
    }
    case 'callout': {
      el.classList.add(`callout`, `tone-${s.tone}`);
      el.append(h('p.callout-tag', {}, icon(s.tone === 'warn' || s.tone === 'cost' ? 'warn' : 'doc'), t(s.title ?? CALLOUT[s.tone])), prose(s.body));
      onVisible(el, done, 0.25);
      return { el };
    }
    case 'explainer': {
      const reg = registry.explainers.get(s.explainer);
      if (!reg) {
        el.append(h('p.err', {}, `Unknown explainer: ${s.explainer}`));
        return { el };
      }
      const host = h('div.ex-host');
      el.append(host);
      if (s.caption) el.append(h('p.figcaption', {}, t(s.caption)));
      const mounted = reg.mount(host, { level: c.level, params: s.params, onComplete: done, record: (e) => store.record(e), openDoc: (r) => openDoc(r) });
      return { el, mounted };
    }
    case 'terminal': {
      const host = h('div.lab-host');
      el.append(host);
      const mounted = mountLab(host, {
        key: `${c.lesson.id}/${s.id}`,
        setup: s.setup,
        tasks: s.tasks,
        intro: s.intro,
        level: c.level,
        block: c.block,
        lessonId: c.lesson.id,
        index: c.index,
        count: c.count,
        onAllDone: done,
      });
      return { el, mounted };
    }
    case 'quiz': {
      if (s.title) el.append(h('h3', {}, t(s.title)));
      const items = s.items.map((it) => (typeof it === 'string' ? registry.quiz.get(it) : it)).filter(Boolean) as QuizItem[];
      const answered = new Set<string>(items.filter((it) => store.state.quiz[it.id]).map((it) => it.id));
      const mounts: Mounted[] = [];
      for (const it of items) {
        const host = h('div.quiz-host');
        el.append(host);
        mounts.push(
          mountQuiz(host, it, {
            context: 'lesson',
            md,
            onAnswered: () => {
              answered.add(it.id);
              if (answered.size >= items.length) done();
            },
          }),
        );
      }
      if (items.length && answered.size >= items.length) done();
      return { el, mounted: { dispose: () => mounts.forEach((m) => m.dispose()) } };
    }
    case 'docs':
      return renderDocs(s, c, el, done);
    case 'widget': {
      const w = registry.widgets.get(s.widget);
      if (!w) {
        el.append(h('p.err', {}, `Unknown widget: ${s.widget}`));
        return { el };
      }
      const host = h('div.widget-host');
      el.append(host);
      const mounted = w.mount(host, s.props, { lessonId: c.lesson.id, sectionId: s.id, level: c.level, complete: done, record: (e) => store.record(e), openDoc: (r) => openDoc(r) });
      return { el, mounted };
    }
  }
}

function renderDocs(s: DocsSection, c: SectionCtx, el: HTMLElement, done: () => void): { el: HTMLElement; mounted?: Mounted } {
  el.append(h('p.docs-tag', {}, icon('doc'), t(bi('Документация', 'Documentation'))), prose(s.prompt));
  if (s.mode === 'anatomy') {
    const page = s.ref.page ? corpus.get(s.ref.page) : undefined;
    if (!page) {
      el.append(h('p.err', {}, `Unknown page: ${s.ref.page}`));
      return { el };
    }
    const result = h('div.docs-result', { 'aria-live': 'polite' });
    const host = h('div.docs-inline');
    const draw = () => {
      clear(host);
      host.append(
        renderPage(page, {
          mode: 'page',
          onSection: (id) => {
            store.record({ kind: 'doc.open', page: page.id, source: page.source, anchor: id, via: 'docref' });
            clear(result);
            const ok = id === s.answer;
            const why = ANATOMY[id];
            result.append(
              h(
                'p',
                { class: ok ? 'lab-ok' : 'lab-fail' },
                h('span.st-icon', { class: ok ? 'ok' : 'warn', 'aria-hidden': 'true' }, ok ? '✓' : '!'),
                ok ? t(bi('Верно: ', 'Right: ')) : t(bi('Это раздел ', 'This is ')) + id + ': ',
                why ? t(why) : '',
              ),
            );
            for (const b of host.querySelectorAll('.doc-map-item')) b.classList.toggle('picked', (b as HTMLElement).dataset.section === id);
            if (ok) done();
          },
        }),
      );
    };
    draw();
    el.append(h('div.docs-frame', {}, h('div.docs-frame-head', {}, page.title), host), result);
    return { el };
  }
  if (!s.terminal) return { el };
  const host = h('div.lab-host');
  el.append(host);
  const mounted = mountLab(host, {
    key: `${c.lesson.id}/${s.id}`,
    setup: s.terminal.setup,
    tasks: [{ ...s.terminal.task, docRef: s.terminal.task.docRef ?? s.ref }],
    level: c.level,
    block: c.block,
    lessonId: c.lesson.id,
    index: c.index,
    count: c.count,
    onAllDone: done,
  });
  return { el, mounted };
}
