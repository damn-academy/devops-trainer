import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import type { Section } from '../src/core/types';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { EXERCISES, WEBSITE_CRD, reconcileAll } from '../src/engine/kube-lite/ui/controller-lab';
import { reconcileInProcess } from '../src/engine/kube-lite/sandbox';

/** The js fence of a beginner-only text section, in the given language. */
const fence = (lessonId: string, sectionId: string, lang: 'ru' | 'en') => {
  const s = registry.lessons.get(lessonId)!.sections.find((x) => x.id === sectionId) as Section & { kind: 'text' };
  expect(s.levels).toEqual(['beginner']);
  return /```js\n([\s\S]*?)```/.exec(s.body[lang])![1];
};
const run = (code: string, o: object, w: object[]) => Promise.resolve(reconcileInProcess(code, o as never, w as never));
const act = (ex: (typeof EXERCISES)[keyof typeof EXERCISES], id: string, c: Cluster) => ex.actions.find((a) => a.id === id)!.run(c);

describe('the ready code given to beginners reaches the widget goals', () => {
  for (const lang of ['ru', 'en'] as const) {
    it(`the team-info loop (${lang})`, async () => {
      const code = fence('k8s-1.reconcile', 'your-loop-solution', lang);
      const ex = EXERCISES['team-info'];
      const c = new Cluster({ nodes: ['a'] });
      act(ex, 'ns-a', c);
      await reconcileAll(c, ex, code, run);
      expect(ex.goal(c)).toBe(true);
      act(ex, 'del-cm', c);
      await reconcileAll(c, ex, code, run);
      act(ex, 'relabel', c);
      await reconcileAll(c, ex, code, run);
      expect(ex.goal(c)).toBe(true);
    });

    it(`the Website operator (${lang})`, async () => {
      const ex = EXERCISES.website;
      const code = ex.starter.beginner.replace(/  \/\/ Your part:[\s\S]*?\n\n/, fence('k8s-1.operators', 'write-solution', lang) + '\n');
      const c = new Cluster({ nodes: ['a', 'b'] });
      c.create(WEBSITE_CRD);
      act(ex, 'site', c);
      await reconcileAll(c, ex, code, run);
      act(ex, 'scale', c);
      await reconcileAll(c, ex, code, run);
      act(ex, 'del-dep', c);
      await reconcileAll(c, ex, code, run);
      expect(ex.goal(c)).toBe(true);
    });
  }
});
