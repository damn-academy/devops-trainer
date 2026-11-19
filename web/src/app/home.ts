// Home: the course route map (00 §2.1) — blocks in order, each with its three
// levels and a "show what you know" entry. Progress is a map of skills, not
// points.

import { h, icon } from '../core/dom';
import { bi, count, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import type { RouteEntry } from '../core/route';
import { href } from '../core/router';
import { store } from '../core/store';
import { LEVELS, type Block, type Level } from '../core/types';
import type { Page } from './common';
import { chosenLevel, lessonStatus, setTitle } from './status';

function levelsTable(levels: Record<Level, import('../core/i18n').Bi>, hours: Record<Level, number> | undefined, chosen: Level | undefined): HTMLElement {
  return h(
    'dl.levels',
    {},
    ...LEVELS.map((l) =>
      h(
        'div.level',
        { class: chosen === l ? 'chosen' : undefined },
        h('dt', {}, t(UI.levels[l]), hours && hours[l] ? h('span.hours', {}, `≈ ${hours[l]} ${t(UI.hours)}`) : null),
        h('dd', {}, t(levels[l])),
      ),
    ),
  );
}

function blockItem(b: Block, entry: RouteEntry | undefined): HTMLElement {
  const lessons = b.lessons.map((id) => registry.lessons.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof registry.lessons.get>>[];
  const doneN = lessons.filter((l) => lessonStatus(l) === 'done').length;
  const nextLesson = lessons.find((l) => lessonStatus(l) !== 'done');
  const started = lessons.some((l) => lessonStatus(l) !== 'new');
  const chosen = chosenLevel(b.id);
  return h(
    'li.route-item',
    { 'data-block': b.id, class: doneN === lessons.length && lessons.length ? 'complete' : started ? 'started' : undefined },
    h('div.route-mark', { 'aria-hidden': 'true' }, h('span', {}, entry?.segment ?? String(b.order))),
    h(
      'div.route-body',
      {},
      h('h2', {}, h('a', { href: href({ name: 'block', id: b.id }) }, t(b.title))),
      h(
        'p.route-meta',
        {},
        b.checklistStep ? h('span', {}, `${t(UI.checklistStep)} ${b.checklistStep}`) : null,
        lessons.length ? h('span', {}, `${doneN} / ${count(lessons.length, ['урок', 'урока', 'уроков'], ['lesson', 'lessons'])}`) : null,
        b.beginnerOnly ? h('span.badge', {}, t(bi('только для новичков', 'beginners only'))) : null,
      ),
      h('p.route-summary', {}, t(b.summary)),
      levelsTable(b.levels, b.hours ?? entry?.hours, chosen),
      h(
        'div.route-actions',
        {},
        nextLesson
          ? h('a.btn.primary', { href: href({ name: 'lesson', id: nextLesson.id }) }, t(started ? UI.continue : UI.start), icon('next'))
          : lessons.length
            ? h('span.badge.ok', {}, '✓ ', t(UI.done))
            : null,
        registry.placementCount(b.id) ? h('a.btn.ghost', { href: href({ name: 'placement', id: b.id }) }, icon('check'), t(UI.checkLevel)) : null,
      ),
    ),
  );
}

function placeholderItem(e: RouteEntry): HTMLElement {
  return h(
    'li.route-item.placeholder',
    { 'data-block': e.id },
    h('div.route-mark', { 'aria-hidden': 'true' }, h('span', {}, e.segment)),
    h(
      'div.route-body',
      {},
      h('h2', {}, t(e.title)),
      h('p.route-meta', {}, e.checklistStep ? h('span', {}, `${t(UI.checklistStep)} ${e.checklistStep}`) : null, h('span.badge', {}, t(UI.comingSoon)), e.beginnerOnly ? h('span.badge', {}, t(bi('только для новичков', 'beginners only'))) : null),
      h('p.route-summary', {}, t(e.summary)),
      levelsTable(e.levels, e.hours, undefined),
    ),
  );
}

export function homePage(): Page {
  setTitle();
  const items = registry.routeMap();
  const anyProgress = Object.keys(store.state.lessons).length > 0;
  const el = h(
    'div.home',
    {},
    h(
      'section.hero',
      {},
      h('p.kicker', {}, t(bi('Интерактивный учебник', 'An interactive textbook'))),
      h('h1', {}, t(UI.course)),
      h('p.lede', {}, t(UI.tagline)),
      h(
        'ul.pillars',
        {},
        h('li', {}, h('strong', {}, t(bi('Учебник.', 'Textbook.'))), ' ', t(bi('Связная теория: термин появляется только после того, как его ввели.', 'Coherent theory: a term appears only after it has been introduced.'))),
        h('li', {}, h('strong', {}, t(bi('Процессы.', 'Processes.'))), ' ', t(bi('Схемы, которые вы ведёте сами: шаги, ручки, «сломайте».', 'Diagrams you drive yourself: steps, knobs, “break it”.'))),
        h('li', {}, h('strong', {}, t(bi('Документация.', 'Documentation.'))), ' ', t(bi('От «это отсюда» до экзамена, где открыта только она.', 'From “this is from” to an exam where it is all you have.'))),
      ),
      h(
        'p.time',
        {},
        t(
          bi(
            'Сколько это займёт при 10 часах в неделю: «Новичок» — около 480 часов, 11–12 месяцев; «Средний» — около 330 часов, 8 месяцев; «Опытный» — около 215 часов, 5 месяцев. Уровень выбирается отдельно для каждого блока.',
            'How long it takes at 10 hours a week: Beginner — about 480 hours, 11–12 months; Intermediate — about 330 hours, 8 months; Experienced — about 215 hours, 5 months. The level is chosen for each block separately.',
          ),
        ),
      ),
      anyProgress ? null : h('p.small.muted', {}, t(bi('Регистрация не нужна: прогресс сохраняется в этом браузере после каждого действия.', 'No sign-up: progress is saved in this browser after every action.'))),
    ),
    h('h2.route-title', {}, t(UI.map)),
    h('ol.route', {}, ...items.map((it) => (it.kind === 'block' ? blockItem(it.block, it.entry) : placeholderItem(it.entry)))),
  );
  return { el };
}
