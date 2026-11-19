// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pipeModel } from '../src/blocks/demo/pipe';
import { mountModel } from '../src/engine/explainer/render';
import { mountQuiz } from '../src/engine/quiz/render';
import { renderMd } from '../src/core/markdown';
import { registry } from '../src/core/registry';
import type { ProcessModel } from '../src/core/types';

describe('explainer renderer', () => {
  it('draws every element, steps forward and completes', () => {
    const el = document.createElement('div');
    document.body.append(el);
    let done = 0;
    const events: string[] = [];
    const m = mountModel(el, pipeModel as unknown as ProcessModel, { level: 'intermediate', onComplete: () => done++, record: (e) => events.push(e.kind), openDoc: () => {} });
    expect(el.querySelectorAll('.node')).toHaveLength(pipeModel.diagram.nodes.length);
    expect(el.querySelectorAll('.edge-label')).toHaveLength(pipeModel.diagram.edges.length);
    const fwd = el.querySelector<HTMLButtonElement>('button[aria-label="Шаг вперёд"]')!;
    for (let i = 0; i < 20; i++) fwd.click();
    expect(done).toBe(1);
    expect(events).toContain('explainer.done');
    expect(m.describe?.()).toContain('$?');
    // clicking a node opens its card
    (el.querySelector('.node[data-id="pipe"]') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.querySelector('.ex-card')?.textContent).toContain('pipe2');
    // a break asks for a prediction first
    const brk = el.querySelector<HTMLInputElement>('.break-toggle input')!;
    brk.checked = true;
    brk.dispatchEvent(new Event('change'));
    expect(el.querySelector('.ex-predict')?.hasAttribute('hidden')).toBe(false);
    el.querySelector<HTMLButtonElement>('.ex-predict-opts button')!.click();
    expect(events).toContain('explainer.predict');
    expect(el.querySelector('.ex-broken')?.hasAttribute('hidden')).toBe(false);
    m.dispose();
  });
});

describe('quiz renderer', () => {
  it('requires confidence before checking and explains the distractor', () => {
    const el = document.createElement('div');
    const item = registry.quiz.get('demo.q.where')!;
    mountQuiz(el, item, { context: 'lesson' });
    const check = el.querySelector<HTMLButtonElement>('.q-actions button')!;
    const wrong = el.querySelector<HTMLInputElement>('.q-option[data-id="disk"] input')!;
    wrong.checked = true;
    wrong.dispatchEvent(new Event('change'));
    expect(check.disabled).toBe(true);
    const conf = el.querySelector<HTMLInputElement>('.q-confidence input[value="3"]')!;
    conf.checked = true;
    conf.dispatchEvent(new Event('change'));
    expect(check.disabled).toBe(false);
    check.click();
    return new Promise<void>((r) =>
      setTimeout(() => {
        expect(el.querySelector('.q-result')?.classList.contains('err')).toBe(true);
        expect(el.querySelector('.q-why')?.textContent).toContain('диск');
        r();
      }, 0),
    );
  });
});

describe('markdown-lite', () => {
  it('renders code, glossary links, lists and fences without HTML injection', () => {
    const frag = renderMd('Текст с `ls` и [[demo.pipe|конвейером]] и <b>x</b>.\n\n- один\n- два\n\n```bash\nls | grep\n```');
    const div = document.createElement('div');
    div.append(frag);
    expect(div.querySelector('code')?.textContent).toBe('ls');
    expect(div.querySelector('[data-concept="demo.pipe"]')?.textContent).toBe('конвейером');
    expect(div.querySelectorAll('li')).toHaveLength(2);
    expect(div.querySelector('pre')?.textContent).toBe('ls | grep');
    expect(div.querySelector('b')).toBeNull();
  });
});
