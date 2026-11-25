import { bi, t } from '../core/i18n';
import { h } from '../core/dom';
import { PRODUCTS } from '../core/products';
import { setTitle, type Page } from './common';
import { courseCatalog } from './course-catalog';
import { productTile } from './home';

export function coursesPage(): Page {
  setTitle(t(bi('Курсы', 'Courses')));
  return { el: h('div.courses-page', {},
    h('nav.crumbs', {}, h('a', { href: '#/' }, t(bi('Начало', 'Start'))), ' › ', t(bi('Курсы', 'Courses'))),
    h('h1', {}, t(bi('Курсы', 'Courses'))),
    h('p.lede', {}, t(bi('Курс учит отдельному навыку или области работы, которую можно освоить без смены профессии.', 'A course teaches one skill or area of work you can learn without changing your profession.'))),
    courseCatalog(PRODUCTS.filter(p => p.kind === 'course'), productTile)) };
}

export function professionsPage(): Page {
  setTitle(t(bi('Профессии', 'Professions')));
  return { el: h('div.courses-page', {},
    h('nav.crumbs', {}, h('a', { href: '#/' }, t(bi('Начало', 'Start'))), ' › ', t(bi('Профессии', 'Professions'))),
    h('h1', {}, t(bi('Профессии', 'Professions'))),
    h('p.lede', {}, t(bi('Профессия — долгий путь к новой работе: теория, практика, проверки уровня и экзамены.', 'A profession is a long road to a new job: theory, practice, level checks and exams.'))),
    h('ul.catalog-grid.bento', {}, ...PRODUCTS.filter(p => p.kind === 'profession' && !p.hidden).map(p => productTile(p, 'w')))) };
}
