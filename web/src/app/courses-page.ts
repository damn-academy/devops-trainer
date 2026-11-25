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
    courseCatalog(PRODUCTS.filter(p => p.kind === 'course'), productTile)) };
}
