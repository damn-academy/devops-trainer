import { h } from '../core/dom';
import { t } from '../core/i18n';
import { catalogGroups, type Product } from '../core/products';

export function courseCatalog(products: Product[], tile: (p: Product) => HTMLElement): HTMLElement {
  return h('div.course-shelves', {}, ...catalogGroups(products).map(group =>
    h('section.catalog-shelf', {},
      group.title ? h('h2', {}, t(group.title)) : null,
      group.summary ? h('p.muted', {}, t(group.summary)) : null,
      h('ul.catalog-grid', {}, ...group.products.map(tile)))));
}
