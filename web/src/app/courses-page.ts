// The hidden pilot catalog: courses that are not on the route map yet. Open
// only by the direct link #/courses; the owner reviews the pilots here before
// deciding what goes public. Nothing on the home page or in the menu points
// here. TODO(ru-en): English pass before publishing.

import { bi, t } from '../core/i18n';
import { h } from '../core/dom';
import { href } from '../core/router';
import { setTitle, type Page } from './common';
import { HONEST_NOTE, SALES_LESSONS } from '../blocks/sales/content';

interface PilotCourse {
  block: string;
  title: [string, string];
  blurb: [string, string];
  lessons: number;
  minutes: number;
}

const PILOTS: PilotCourse[] = [
  {
    block: 'sales',
    title: ['Школа enterprise-продаж', 'The enterprise sales school'],
    blurb: [
      '46 принципов шести модулей: фундамент сложных продаж, роли закупочного центра, типы компаний, регионы, тактика касаний, founder-led против гигантов. С интерактивной схемой закупочного центра и симулятором воронки.',
      '46 principles in six modules, with the interactive buying-center scheme and the funnel simulator.',
    ],
    lessons: SALES_LESSONS.length,
    minutes: SALES_LESSONS.reduce((n, l) => n + (l.minutes ?? 0), 0),
  },
];

export function coursesPage(): Page {
  setTitle(t(bi('Курсы (скрытая превью)', 'Courses (hidden preview)')));
  const el = h(
    'div.courses-page',
    {},
    h('nav.crumbs', {}, h('a', { href: href({ name: 'home' }) }, t(bi('Карта курса', 'Course map'))), ' › ', t(bi('Курсы', 'Courses'))),
    h('h1', {}, t(bi('Курсы', 'Courses'))),
    h(
      'p.muted',
      {},
      t(bi(
        'Скрытый раздел пилотов: сюда не ведёт ни одна ссылка с сайта, страницу открывает только прямой адрес #/courses. Каждый пилот проверяется владельцем до решения, что выкладывать публично.',
        'A hidden pilots section: no link on the site points here, only the direct #/courses address opens it. The owner reviews each pilot before deciding what goes public.',
      )),
    ),
    h('div.course-cards', {}, ...PILOTS.map((c) => h('a.course-card', { href: href({ name: 'block', id: c.block }) },
      h('h2', {}, t(bi(c.title[0], c.title[1]))),
      h('p', {}, t(bi(c.blurb[0], c.blurb[1]))),
      h('p.small.muted', {}, t(bi(`${c.lessons} уроков · ≈${c.minutes} мин`, `${c.lessons} lessons · ≈${c.minutes} min`)))))),
    h('p.sfu-note', {}, t(HONEST_NOTE)),
  );
  return { el };
}
