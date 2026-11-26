import { bi, t } from '../core/i18n';
import { h } from '../core/dom';
import { href } from '../core/router';
import { registry } from '../core/registry';
import { productById } from '../core/products';
import { store } from '../core/store';
import { blockCrumbs, emptyState, setTitle, type Page } from './common';

export function coursePage(id: string): Page {
  const product = productById(id);
  const block = registry.blocks.get(id);
  if (product?.kind !== 'course' || !block) return { el: emptyState(bi('Такого курса пока нет.', 'There is no such course yet.')) };
  setTitle(t(product.title));
  const groups = block.modules ?? [{ title: undefined, lessons: block.lessons }];
  return { el: h('div.courses-page', {}, blockCrumbs(id),
    h('h1', {}, t(product.title)),
    h('p.lede', {}, t(product.subtitle ?? product.summary)),
    ...groups.map(group => h('section.course-module', {},
      group.title ? h('h2', {}, t(group.title)) : null,
      h('div.course-cards', {}, ...group.lessons.map(id => {
        const lesson = registry.lessons.get(id)!;
        const done = store.state.lessons[id]?.status === 'done';
        return h('a.course-card', { href: href({ name: 'lesson', id }), class: done ? 'done' : '' },
          h(group.title ? 'h3' : 'h2', {}, t(lesson.title)),
          h('p', {}, t(lesson.summary ?? lesson.title)),
          h('p.small.muted', {}, t(bi(`≈${lesson.minutes ?? 0} мин`, `≈${lesson.minutes ?? 0} min`)), done ? h('span.course-card-done', {}, ' · ✓ ', t(bi('пройден', 'done'))) : null));
      })))),
  ) };
}
