import { h } from '../core/dom';
import { catalogGroups, type Product } from '../core/products';

// Card sizes for the course shelf, in catalog order: a large card, two medium,
// a row of small ones and a wide one. Shelves longer than the pattern repeat it.
const BENTO = ['l', 'm', 'm', 's', 's', 's', 'w', 's'];

export function courseCatalog(products: Product[], tile: (p: Product, size?: string) => HTMLElement): HTMLElement {
  return h('div.course-shelves', {}, ...catalogGroups(products).map(group =>
    h('section.catalog-shelf', {},
      h('ul.catalog-grid.bento', {}, ...group.products.map((p, i) => tile(p, BENTO[i % BENTO.length]))))));
}
