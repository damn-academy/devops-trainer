// containers.orchestration: the counters follow the model written on the
// cards (ORCH), every event plays the three worlds in order, and the breaks
// stop where a real system would.

import { describe, expect, it } from 'vitest';
import { fold } from '../src/engine/explainer/geometry';
import { hpaPeriods, ORCH, orchNumbers, orchestrationModel as m, waves } from '../src/blocks/containers/explainers/orchestration';

type P = { event: string; servers: number; orchestrator: boolean; staleTemplate: boolean };
const base: P = { event: 'fire', servers: 10, orchestrator: true, staleTemplate: false };
const run = (p: Partial<P> = {}, broken: string[] = []) => m.run({ ...base, ...p }, new Set(broken));
const last = (p: Partial<P> = {}, broken: string[] = []) => run(p, broken).at(-1)!.metrics!;
const ids = (p: Partial<P> = {}, broken: string[] = []) => run(p, broken).map((s) => s.id);
const EVENTS = ['fire', 'deploy', 'load', 'rollback'];

describe('orchestration: the numbers', () => {
  it('a burnt server', () => {
    const t = orchNumbers(base);
    expect(t.bm).toEqual({ down: ORCH.alertMin + ORCH.wakeMin + ORCH.bmRestoreMin, manual: ORCH.bmRestoreMin, woken: 1, risk: 3 });
    expect(t.vm.down).toBeCloseTo((ORCH.haDetectS + ORCH.haPlaceS + ORCH.vmBootS + ORCH.appStartS) / 60, 2);
    expect(t.vm).toMatchObject({ manual: 0, woken: 0, risk: 1 });
    expect(t.ct.down).toBeCloseTo((ORCH.nodeGraceS + ORCH.tolerationS + ORCH.podStartS) / 60, 2);
    expect(t.ct).toMatchObject({ manual: 0, woken: 0, risk: 1 });
    // VM HA brings the work back sooner than the orchestrator with its default five-minute wait.
    expect(t.vm.down).toBeLessThan(t.ct.down);
    expect(orchNumbers({ ...base, orchestrator: false }).ct).toEqual({ down: 28, manual: ORCH.dockerRestoreMin, woken: 1, risk: 2 });
  });

  it('a rollout: manual work grows with servers everywhere except under the orchestrator', () => {
    for (const n of [3, 10, 40]) {
      const t = orchNumbers({ ...base, event: 'deploy', servers: n });
      expect(t.bm.manual).toBe(ORCH.bmPrepMin + ORCH.bmUpdateMin * n);
      expect(t.bm.down).toBe(ORCH.bmStopMin * n);
      expect(t.vm.manual).toBe(ORCH.templateMin + ORCH.vmSwitchMin * n);
      expect(t.ct).toEqual({ down: 0, manual: ORCH.editMin, woken: 0, risk: 1 });
      expect(orchNumbers({ ...base, event: 'deploy', servers: n, orchestrator: false }).ct.manual).toBe(ORCH.dockerUpdateMin * n);
    }
    expect(waves(10)).toEqual({ surge: 3, waves: 4 });
    expect(waves(3)).toEqual({ surge: 1, waves: 3 });
    expect(waves(40)).toEqual({ surge: 10, waves: 4 });
  });

  it('tripled load: two weeks for hardware, minutes for VMs, about two minutes for the autoscaler', () => {
    const t = orchNumbers({ ...base, event: 'load' });
    expect(t.bm.down).toBeGreaterThan(ORCH.leadDays * 24 * 60);
    expect(t.vm.down).toBeLessThan(90);
    expect(hpaPeriods(10)).toBe(2);
    expect(hpaPeriods(3)).toBe(2);
    expect(t.ct.down).toBeCloseTo((ORCH.hpaReactS + 2 * ORCH.hpaPeriodS + ORCH.podStartS) / 60, 2);
    expect(t.ct.woken).toBe(0);
  });

  it('a rollback wakes a person in every world, but the orchestrator’s part is one command', () => {
    const t = orchNumbers({ ...base, event: 'rollback' });
    for (const w of ['bm', 'vm', 'ct'] as const) expect(t[w].woken).toBe(1);
    expect(t.ct.manual).toBe(ORCH.undoMin);
    expect(t.bm.manual).toBe(ORCH.bmUpdateMin * 10);
  });

  it('a stale template adds drift only where VMs are cloned', () => {
    for (const event of ['deploy', 'load']) {
      const a = orchNumbers({ ...base, event });
      const b = orchNumbers({ ...base, event, staleTemplate: true });
      expect(b.vm.manual - a.vm.manual).toBe(ORCH.driftMin);
      expect(b.vm.risk).toBe(3);
    }
    for (const event of ['fire', 'rollback']) expect(orchNumbers({ ...base, event, staleTemplate: true })).toEqual(orchNumbers({ ...base, event }));
  });

  it('says sub-minute durations in seconds', () => {
    const fire = m.run({ ...base }, new Set());
    expect(fire[fire.length - 1].metrics?.vmDownS).toBe(65);
    expect(fire.map((s) => s.caption.ru).join(' ')).toContain('Через 65 секунд работа хоста 1');
    expect(fire.map((s) => s.caption.ru).join(' ')).not.toMatch(/\d,\d+ минут/);
  });

  it('the counters under the last step are the totals', () => {
    for (const event of EVENTS)
      for (const orchestrator of [true, false]) {
        const t = orchNumbers({ ...base, event, orchestrator });
        const mx = last({ event, orchestrator });
        for (const w of ['bm', 'vm', 'ct'] as const) {
          // Time under two minutes is counted in seconds, the rest in whole minutes.
          for (const k of ['Down', 'Manual'] as const) {
            const v = t[w][k === 'Down' ? 'down' : 'manual'];
            if (v < 2 && !Number.isInteger(v)) expect(mx[`${w}${k}S`]).toBe(Math.round(v * 60));
            else expect(mx[`${w}${k}`]).toBe(Math.round(v));
          }
          expect(mx[`${w}Woken`]).toBe(t[w].woken);
          expect(mx[`${w}Risk`]).toBe(t[w].risk);
        }
      }
  });
});

describe('orchestration: the step sequences', () => {
  it('plays the worlds in order and introduces each when its turn comes', () => {
    expect(ids()).toEqual(['fire-bm-alert', 'fire-bm-wake', 'fire-bm-restore', 'fire-vm-hb', 'fire-vm-restart', 'fire-vm-mail', 'fire-k8s-hb', 'fire-k8s-wait', 'fire-k8s-schedule', 'fire-k8s-state']);
    expect(ids({ orchestrator: false }).slice(6)).toEqual(['fire-ct-nobody', 'fire-ct-wake', 'fire-ct-run']);
    expect(ids({ event: 'deploy', staleTemplate: true })).toContain('deploy-vm-drift');
    for (const event of EVENTS)
      for (const orchestrator of [true, false]) {
        const steps = run({ event, orchestrator });
        const order = steps.map((s) => s.id.split('-')[1]).map((w) => (w === 'k8s' ? 'ct' : w));
        expect([...new Set(order)]).toEqual(['bm', 'vm', 'ct']);
        // Only the first world is on the picture at the start; the orchestrator appears only when it is switched on.
        const f0 = fold(steps, 0);
        expect(f0.states['vm-mgr']).toBe('hidden');
        expect(f0.states['ct-admin']).toBe('hidden');
        expect(fold(steps, steps.length - 1).states['ct-cp'] === 'hidden').toBe(!orchestrator);
        steps.forEach((st, i) => {
          const actors = Object.keys(st.say ?? {});
          expect(actors).toHaveLength(1);
          expect(fold(steps, i).states[actors[0]], `${event}/${st.id}`).not.toBe('hidden');
          for (const tk of st.tokens ?? []) expect(fold(steps, i).states[tk.edge], `${event}/${st.id}: ${tk.edge}`).not.toBe('hidden');
        });
      }
  });

  it('no room for the orchestrator: copies wait as Pending', () => {
    for (const event of EVENTS) {
      const steps = run({ event }, ['no-room']);
      const end = steps.at(-1)!;
      expect(end.broken?.at, event).toBe('ct-cp');
      expect(end.broken?.message).toMatch(/nodes are available/);
    }
    expect(run({ orchestrator: false }, ['no-room']).some((s) => s.broken)).toBe(false);
    expect(last({}, ['no-room']).ctWoken).toBe(1);
    expect(last({ event: 'deploy' }, ['no-room']).ctDown).toBe(0);
  });

  it('VM disks on the host itself: no HA restart', () => {
    const steps = run({}, ['vm-local-disk']);
    expect(steps.at(-1)!.broken?.message).toBe('vSphere HA virtual machine failover failed');
    expect(steps.at(-1)!.metrics!.vmWoken).toBe(1);
    expect(run({ event: 'deploy' }, ['vm-local-disk']).some((s) => s.broken)).toBe(false);
  });

  it('predictions resolve to the right option', () => {
    const p = (id: string) => m.params.find((x) => x.id === id)!.predict!;
    expect(p('servers').resolve(run(), run({ servers: 40 }))).toBe('same');
    expect(p('servers').resolve(run({ event: 'deploy' }), run({ event: 'deploy', servers: 40 }))).toBe('scale');
  });
});
