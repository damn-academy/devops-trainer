import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { PRODUCT_LESSONS } from '../src/blocks/product/content';
import { PRODUCT_MODULES, PRODUCT_SUMMARIES } from '../src/blocks/product/structure';
import { PRODUCT_V2_LESSONS } from '../src/blocks/product/v2';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { catalogGroups, productById, visibleProducts } from '../src/core/products';

const files = import.meta.glob<string>('../src/blocks/product/v2/*.md', { query: '?raw', import: 'default', eager: true });

describe('product course integration', () => {
  it('assigns every pilot and Markdown lesson exactly once in authored order', () => {
    const ids = PRODUCT_MODULES.flatMap(m => m.lessons);
    expect(PRODUCT_MODULES).toHaveLength(5);
    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...PRODUCT_LESSONS, ...PRODUCT_V2_LESSONS].map(l => l.id).sort());
    expect(registry.blocks.get('product')!.lessons).toEqual(ids);
    expect(registry.blocks.get('product')!.modules).toEqual(PRODUCT_MODULES);
    for (const l of [...PRODUCT_LESSONS, ...PRODUCT_V2_LESSONS]) {
      expect(l.block).toBe('product');
      expect(registry.lessons.get(l.id)!.summary).toEqual(PRODUCT_SUMMARIES[l.id] ?? l.summary);
      for (const id of [...l.uses, ...l.introduces]) expect(registry.concepts.has(id), `${l.id}: ${id}`).toBe(true);
      for (const match of JSON.stringify(l.sections).matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
        expect(registry.concepts.has(match[1]!), `${l.id}: ${match[1]}`).toBe(true);
      }
    }
  });

  it('mirrors all Markdown section and widget positions and props in English', () => {
    expect(PRODUCT_V2_LESSONS.map(l => l.id)).toEqual(['product.cases', 'product.roadmap', 'product.signals']);
    for (const [path, ru] of Object.entries(files).filter(([p]) => p.endsWith('.ru.md'))) {
      const shape = (text: string) => parseMarkdownLessons(text).map(l => ({ id: l.id, sections: l.sections.map(s => ({ kind: s.kind, widget: s.widget, props: s.props })) }));
      expect(shape(files[path.replace('.ru.md', '.en.md')]!)).toEqual(shape(ru));
    }
    for (const l of PRODUCT_V2_LESSONS) for (const s of l.sections) {
      if (s.kind === 'widget') expect(registry.widgets.has(s.widget), s.widget).toBe(true);
    }
    expect(PRODUCT_V2_LESSONS.find(l => l.id === 'product.signals')!.sections.filter(s => s.kind === 'widget').map(s => s.widget)).toEqual(['template', 'deptsim']);
  });

  it('registers a public product on the business shelf with bilingual catalog copy', () => {
    const p = productById('product')!;
    expect(visibleProducts('course')).toContain(p);
    expect(p).toMatchObject({ shelf: 'business', title: { ru: 'Продукт', en: 'Product' } });
    expect(p.subtitle!.en).toContain('product managers');
    expect(catalogGroups([p])[0]!.products).toEqual([p]);
    expect(registry.blocks.get('product')!.hidden).toBe(true);
  });
});
