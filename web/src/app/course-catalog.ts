import { h } from '../core/dom';
import { catalogGroups, type Product } from '../core/products';

export function courseCatalog(products: Product[], tile: (p: Product) => HTMLElement): HTMLElement {
  return h('div.course-shelves', {}, ...catalogGroups(products).map(group =>
    h('section.catalog-shelf', {},
      h('ul.catalog-grid', {}, ...group.products.map(tile)))));
}
