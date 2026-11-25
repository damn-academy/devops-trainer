// A hidden pilot course on its own page: the same pattern as the hidden
// pilots catalog #/courses (crumbs, title, cards with summary and duration,
// the honest note at the bottom), but for one course — the owner opens it by
// the direct link #/course/<id>. The catalog page itself stays untouched.

import { bi, t } from '../core/i18n';
import { h } from '../core/dom';
import { href } from '../core/router';
import { setTitle, type Page } from './common';
import { emptyState } from './common';
import type { Lesson } from '../core/types';
import { SALES_LESSONS, HONEST_NOTE as SALES_HONEST_NOTE } from '../blocks/sales/content';
import { MARKETING_LESSONS, HONEST_NOTE as MARKETING_HONEST_NOTE } from '../blocks/marketing/content';

interface CourseEntry {
  block: string;
  title: [string, string];
  lede: [string, string];
  lessons: Lesson[];
  note: { ru: string; en: string };
}

const COURSES: Record<string, CourseEntry> = {
  marketing: {
    block: 'marketing',
    title: ['Маркетинг', 'Marketing'],
    lede: [
      'Пилот скрытого раздела «Курсы»: 46 принципов маркетинга инфраструктурных и open-source продуктов на международных рынках — по модулю в день, с проверкой в каждом уроке. Страница открывается только по прямой ссылке; владелец проверяет пилота до решения, что выкладывать публично.',
      'A pilot of the hidden "Courses" section: 46 principles of marketing for infrastructure and open-source vendors on international markets — one module a day, with a check in every lesson. The page opens only by the direct link; the owner reviews the pilot before deciding what goes public.',
    ],
    lessons: MARKETING_LESSONS,
    note: MARKETING_HONEST_NOTE,
  },
  sales: {
    block: 'sales',
    title: ['Школа enterprise-продаж', 'The enterprise sales school'],
    lede: [
      'Пилот скрытого раздела «Курсы»: 46 принципов сложных продаж — по модулю в день, с интерактивной схемой закупочного центра и симулятором воронки.',
      'A pilot of the hidden "Courses" section: 46 principles of complex sales — one module a day, with the interactive buying-center scheme and the funnel simulator.',
    ],
    lessons: SALES_LESSONS,
    note: SALES_HONEST_NOTE,
  },
};

export function coursePage(id: string): Page {
  const course = COURSES[id];
  if (!course) {
    return { el: emptyState(bi('Такого курса пока нет.', 'There is no such course yet.'), undefined, { label: bi('К карте курса', 'To the course map'), href: href({ name: 'home' }) }) };
  }
  setTitle(t(bi(course.title[0], course.title[1])));
  const minutes = course.lessons.reduce((n, l) => n + (l.minutes ?? 0), 0);
  const el = h(
    'div.courses-page',
    {},
    h('nav.crumbs', {}, h('a', { href: href({ name: 'home' }) }, t(bi('Карта курса', 'Course map'))), ' › ', t(bi(course.title[0], course.title[1]))),
    h('h1', {}, t(bi(course.title[0], course.title[1]))),
    h('p.muted', {}, t(bi(course.lede[0], course.lede[1]))),
    h(
      'div.course-cards',
      {},
      ...course.lessons.map((l) =>
        h(
          'a.course-card',
          { href: href({ name: 'lesson', id: l.id }) },
          h('h2', {}, t(l.title)),
          h('p', {}, t(l.summary ?? l.title)),
          h('p.small.muted', {}, t(bi(`≈${l.minutes ?? 0} мин`, `≈${l.minutes ?? 0} min`))),
        ),
      ),
      h(
        'a.course-card',
        { href: href({ name: 'block', id: course.block }) },
        h('h2', {}, t(bi('Страница блока', 'The block page'))),
        h('p', {}, t(bi('Выбор уровня и проверка «покажите, что уже умеете» — на странице блока этого курса.', 'Choosing a level and the "show what you already know" check live on this course\'s block page.'))),
        h('p.small.muted', {}, t(bi(`всего ${course.lessons.length} уроков · ≈${minutes} мин`, `${course.lessons.length} lessons in total · ≈${minutes} min`))),
      ),
    ),
    h('p.sfu-note', {}, t(course.note)),
  );
  return { el };
}
