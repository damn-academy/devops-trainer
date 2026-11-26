// @vitest-environment jsdom
// The v9 six-persona pass of the DevOps profession: an exam taken in the
// local lab dtlab can be closed with what `dtlab destroy` prints, every
// real-machine exam names the dtlab VM of each of its machines, and the
// cleanup box carries its own instruction instead of the collector's.

import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryBackend, store } from '../src/core/store';
import { judgePaste } from '../src/app/real/facts';
import type { Exam, RealTask } from '../src/core/types';
import { DISK_EXAM } from '../src/blocks/linux/exam-real';
import { examB } from '../src/blocks/networks/exam-b';

beforeAll(async () => {
  await store.init(new MemoryBackend());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= function () {};
});

const DESTROYED = 'VMs, their disks and the kuberoot credentials removed; images stay in /home/u/.dtlab/images';

async function realExams(): Promise<Exam[]> {
  const { loadRegistry } = await import('../src/core/registry');
  const r = await loadRegistry();
  return [...r.exams.values()].filter((e) => e.real && !e.inTab);
}

const cleanup = (e: Exam) => e.tasks.find((x) => x.id === 'cleanup' && x.kind === 'real') as { real: RealTask } | undefined;

describe('DevOps v9: exams on own machines in dtlab', () => {
  it('every cleanup accepts the output of dtlab destroy and says so', async () => {
    const exams = await realExams();
    expect(exams.map((e) => e.id)).toEqual(expect.arrayContaining(['linux.exam.disk', 'linux.exam.access', 'networks.exam.machines', 'k8s-2.exam']));
    for (const e of exams) {
      const c = cleanup(e);
      if (!c) continue;
      expect(judgePaste(c.real, DESTROYED), e.id).toBe(true);
      expect(c.real.prompt.ru, e.id).toContain('dtlab destroy');
      expect(c.real.prompt.en, e.id).toContain('dtlab destroy');
      expect(judgePaste(c.real, 'Destroy complete! Resources: 0 destroyed.'), e.id).toBe(false);
    }
  });

  it('every machine of an own-machine exam is played by a named dtlab VM', async () => {
    for (const e of await realExams()) {
      expect(e.real!.dtlabUp, e.id).toMatch(/^dtlab up/);
      for (const m of e.real!.machines) expect(['learner', 'cp-1', 'worker-1', 'worker-2'], `${e.id} ${m.id}`).toContain(m.dtlab);
      const vms = e.real!.machines.map((m) => m.dtlab);
      expect(new Set(vms).size, e.id).toBe(vms.length);
    }
  });

  it('the exam page shows how to enter each machine and a cleanup instruction of its own', async () => {
    const { examPage } = await import('../src/app/exam-page');
    const page = examPage('linux.exam.access');
    const root = page.el;
    document.body.append(root);
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Training|Тренировка/.test(b.textContent ?? ''))!.click();
    const inLab = root.querySelector('.rl-inlab')!.textContent!;
    expect(inLab).toContain('dtlab up --with learner,kubeadm-nodes');
    expect(inLab).toContain('dtlab ssh cp-1');
    expect(inLab).toContain('dtlab ssh learner');
    expect(inLab).toContain('10.10.1.11');
    const guides = [...root.querySelectorAll('.rl-card')].filter((c) => c.querySelector('.rl-paste-task')).map((c) => c.querySelector('.task-guide')!.textContent!);
    expect(guides.length).toBe(1);
    expect(guides[0]).not.toMatch(/проверочный скрипт|check script/);
    page.dispose?.();
    root.remove();
  });

  it('one machine gets no address boxes, and the networks exam links its in-tab variant', async () => {
    const { examPage } = await import('../src/app/exam-page');
    const page = examPage(DISK_EXAM.id);
    document.body.append(page.el);
    [...page.el.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Training|Тренировка/.test(b.textContent ?? ''))!.click();
    expect(page.el.querySelector('.rl-addrs')).toBeNull();
    page.dispose?.();
    page.el.remove();
    expect(examB.intro.ru).toContain('#/exam/networks.exam.browser');
    expect(examB.intro.en).toContain('#/exam/networks.exam.browser');
  });
});
