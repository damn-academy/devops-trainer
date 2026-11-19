// @vitest-environment jsdom
// Smoke tests: the widgets and explainers of the Git/CI/CD, IaC and Monitoring
// blocks mount, react and complete in a DOM.

import { describe, expect, it } from 'vitest';
import { yamlWidget } from '../src/blocks/git-cicd/yaml';
import { boardWidget } from '../src/blocks/git-cicd/ci/board';
import { publish } from '../src/blocks/git-cicd/shared/hub';
import { workbenchWidget } from '../src/blocks/monitoring/workbench';
import { fromModel } from '../src/engine/explainer/render';
import { ciModel, gitModel } from '../src/blocks/git-cicd/explainers';
import { ansModel, tfModel } from '../src/blocks/iac/explainers';
import { monModel } from '../src/blocks/monitoring/explainer';
import { bi } from '../src/core/i18n';


const ctx = () => {
  const c = { done: 0, events: [] as unknown[] };
  return { c, w: { level: 'beginner' as const, complete: () => void c.done++, record: (e: unknown) => void c.events.push(e), openDoc: () => {} } };
};

describe('widgets', () => {
  it('yaml parser view completes when quoted right', () => {
    const el = document.createElement('div');
    const { c, w } = ctx();
    yamlWidget.mount(el, { text: 'country: NO\n', version: '1.1', bothVersions: true, expect: { country: 'NO' } }, w);
    expect(el.querySelector('.yt-val')!.textContent).toBe('false');
    expect(c.done).toBe(0);
    const ta = el.querySelector('textarea')!;
    ta.value = 'country: "NO"\n';
    ta.dispatchEvent(new Event('input'));
    expect(c.done).toBe(1);
  });
  it('pipeline board draws a published pipeline', () => {
    const el = document.createElement('div');
    const { c, w } = ctx();
    const m = boardWidget.mount(el, {}, w);
    publish({ t: 'ci.pipeline', id: 1, status: 'failed', pipeline: { id: 101, project: 'team/site', ref: 'main', sha: '1a2b3c4d5e', source: 'push', status: 'failed', jobs: [{ id: 1, name: 'test', stage: 'test', status: 'failed', when: 'on_success', allowFailure: false, needs: null, log: '\x1b[32;1m$ ./test.sh\x1b[0;m\nERROR: Job failed: exit code 1\n', start: 1, end: 5, image: 'alpine', tags: [], attempt: 0 }], excluded: [], stages: ['test'], changed: [], duration: 5, at: 0 } });
    expect(el.querySelectorAll('.pb-job').length).toBe(1);
    expect(el.querySelector('.pb-log')!.textContent).toContain('exit code 1');
    expect(c.done).toBe(1);
    m.dispose();
  });
  it('PromQL workbench runs queries and checks goals', () => {
    const el = document.createElement('div');
    const { c, w } = ctx();
    workbenchWidget.mount(el, { query: 'up{job="api"}', goals: [{ id: 'g', prompt: bi('x', 'x'), reference: 'up{job="api"}' }] }, w);
    expect(el.querySelectorAll('.wb-table tr').length).toBe(3);
    expect(c.done).toBe(1);
    const input = el.querySelector('textarea')!;
    input.value = 'rate(up';
    (el.querySelector('.wb-q button') as HTMLButtonElement).click();
    expect(el.querySelector('.wb-err')!.textContent).toContain('parse error');
    (el.querySelectorAll('.wb-tab')[1] as HTMLButtonElement).click();
    input.value = 'sum by (route) (rate(http_requests_total{job="api"}[5m]))';
    (el.querySelector('.wb-q button') as HTMLButtonElement).click();
    expect(el.querySelectorAll('.wb-line').length).toBe(4);
  });
});

describe('explainers', () => {
  for (const m of [gitModel, ciModel, tfModel, ansModel, monModel]) {
    it(`${m.id} mounts`, () => {
      const el = document.createElement('div');
      document.body.append(el);
      const reg = fromModel(m as Parameters<typeof fromModel>[0]);
      const mounted = reg.mount(el, { level: 'experienced', onComplete: () => {}, record: () => {}, openDoc: () => {} });
      expect(el.querySelectorAll('[data-id]').length).toBeGreaterThan(5);
      mounted.dispose();
    });
  }
});
