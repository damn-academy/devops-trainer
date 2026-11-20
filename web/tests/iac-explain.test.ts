// The IaC block explains common mistakes in Russian where the tools answer in
// English, and its new questions point at the line they talk about.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { BugfindItem, Lesson, TerminalSection } from '../src/core/types';
import { createSimMachine } from '../src/engine/terminal/shell';
import { addrModel } from '../src/blocks/iac/explainers-2';

const OPS = '/home/learner/ops';

describe('iac explanations', () => {
  it('a broken YAML indent in the playbook gets a Russian explanation', async () => {
    const s = (registry.lessons.get('iac.playbook') as Lesson).sections.find((x) => x.id === 'lab') as TerminalSection;
    const m = await createSimMachine(s.setup);
    const start = await m.facts();
    const play = (await m.exec('cat site.yml')).out.replace('    - name: The motd says who manages the host\n      ansible.builtin.shell', '    - name: The motd says who manages the host\n  ansible.builtin.lineinfile');
    m.rootFs.writeFile(`${OPS}/site.yml`, play);
    await m.exec('ansible-playbook site.yml');
    const r = evaluateCheck(s.tasks.find((t) => t.id === 'idem')!.check, await m.facts(), start);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('отступ');
  });

  it('the self-reference bugfind points at the labels line', () => {
    const q = registry.quiz.get('iac.q.self-ref') as BugfindItem;
    const lines = q.code.split('\n');
    expect(lines[q.bug[0] - 1]).toContain('edu_vm.web.name');
    for (const n of Object.keys(q.why)) expect(lines[Number(n) - 1]).toBeDefined();
  });

  it('"what changed" never says a number went from a value to the same value', () => {
    const off = addrModel.run({ block: false } as never, new Set());
    const on = addrModel.run({ block: true } as never, new Set());
    const d = addrModel.explainDelta(off, on, { kind: 'param', id: 'block', from: false, to: true }, { block: false } as never, { block: true } as never);
    expect(d.ru).toContain('изменилось с 1 на 0');
    expect(d.ru).not.toMatch(/с (\d+)(\u00A0с)? на \1(\u00A0с)?[,.]/);
    const same = addrModel.explainDelta(on, on, { kind: 'param', id: 'block', from: true, to: true }, { block: true } as never, { block: true } as never);
    expect(same.ru).toContain('осталось прежним');
  });
});
