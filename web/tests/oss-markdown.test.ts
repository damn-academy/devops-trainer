import { describe, expect, it } from 'vitest';
import { OSS_LESSONS } from '../src/blocks/oss/content';
import { OSS_MODULES, OSS_SUMMARIES } from '../src/blocks/oss/structure';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { registry } from '../src/core/registry';

const files = import.meta.glob<string>('../src/blocks/oss/*.md', {
  query: '?raw', import: 'default', eager: true,
});

describe('OSS course wiring', () => {
  it('includes every authored lesson exactly once in module order with its summary', () => {
    const ids = OSS_MODULES.flatMap(m => m.lessons);
    expect(ids).toHaveLength(8);
    expect(OSS_MODULES).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(OSS_LESSONS.map(l => l.id).sort());
    expect(Object.keys(OSS_SUMMARIES).sort()).toEqual([...ids].sort());
    expect(registry.blocks.get('oss')!.lessons).toEqual(ids);
    for (const lesson of OSS_LESSONS) {
      expect(registry.lessons.get(lesson.id)).toEqual({ ...lesson, summary: OSS_SUMMARIES[lesson.id] });
      for (const id of lesson.uses) expect(registry.concepts.has(id), `${lesson.id}: unresolved [[${id}]]`).toBe(true);
    }
  });

  it('mirrors every marker at the same section position with identical props', () => {
    for (const path of Object.keys(files).filter(p => p.endsWith('.ru.md'))) {
      const shape = (raw: string) => parseMarkdownLessons(raw).map(l => ({
        id: l.id, sections: l.sections.map(s => ({ kind: s.kind, widget: s.widget, props: s.props })),
      }));
      expect(shape(files[path.replace('.ru.md', '.en.md')]!), path).toEqual(shape(files[path]!));
    }
    const widgets = OSS_LESSONS.flatMap(l => l.sections.filter(s => s.kind === 'widget'));
    expect(widgets.map(s => s.widget)).toEqual(['boundary', 'governance', 'health', 'deptsim']);
    for (const widget of widgets) expect(registry.widgets.has(widget.widget)).toBe(true);
  });
});
