// "Repair the cluster layer by layer" (lesson final.cluster-map). Every fault
// takes one component out of a full cluster; the learner runs the commands,
// reads the real kube-lite output, names the component that does not do its
// job, learns how to check and repair it on a real cluster, and runs the
// same commands on the repaired cluster. Progress is kept in this browser.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import type { Mounted, WidgetReg } from '../../../core/types';
import { ALL_LAYERS, COMPONENTS, WIRES, comp, key, layerOf, runScenario, type CanvasState } from '../../../engine/kube-lite/ui/constructor-model';
import { CLUSTER_FAULTS, type ClusterFault, type FaultOption } from '../data/cluster-faults';
import { load, prose, save } from './ui';

const R = {
  title: bi('Ремонт кластера по слоям', 'Repairing the cluster layer by layer'),
  of: (n: number, all: number) => bi(`Поломка ${n} из ${all}`, `Fault ${n} of ${all}`),
  run: bi('Выполнить команды на сломанном кластере', 'Run the commands on the broken cluster'),
  running: bi('Кластер выполняет команды…', 'The cluster is running the commands…'),
  question: bi('Какой компонент не делает свою работу?', 'Which component does not do its job?'),
  first: bi('Сначала выполните команды и прочитайте вывод, потому что ответ спрятан в нём.', 'First run the commands and read the output: the answer is in it.'),
  right: bi('Верно.', 'Right.'),
  wrong: bi('Этот ответ неверен, и ниже объяснено почему. Выберите другой вариант.', 'This answer is wrong, and the reason is below. Choose another option.'),
  real: bi('Как проверить и починить это на настоящем кластере', 'How to check and repair this on a real cluster'),
  fix: bi('Починить и выполнить те же команды', 'Repair and run the same commands'),
  fixed: bi('После ремонта', 'After the repair'),
  next: bi('Следующая поломка', 'Next fault'),
  done: bi('Все девять слоёв починены. Вы прошли кластер целиком, от управляющего слоя до наблюдаемости.', 'All nine layers are repaired. You have walked the whole cluster, from the control plane to observability.'),
  again: bi('Пройти заново', 'Start over'),
  failed: bi('Кластер не запустился в этом браузере. Обновите страницу и попробуйте ещё раз.', 'The cluster did not start in this browser. Reload the page and try again.'),
};

const FULL: CanvasState = { placed: COMPONENTS.map((c) => c.id), wires: WIRES.map((w) => key(w.a, w.b)), off: [], cni: 'calico' };

/** The full cluster without one component and its wires. */
export function brokenState(id: string): CanvasState {
  return { ...FULL, placed: FULL.placed.filter((x) => x !== id), wires: FULL.wires.filter((w) => !w.split('|').includes(id)) };
}

export const fullState = (): CanvasState => ({ ...FULL, placed: [...FULL.placed], wires: [...FULL.wires] });

const optionLabel = (o: FaultOption) => (o.label ? t(o.label) : comp(o.id)?.label ?? o.id);

interface Saved {
  done: string[];
}

export const clusterRepairWidget: WidgetReg = {
  id: 'career.cluster-repair',
  mount(el, _props, ctx): Mounted {
    let disposed = false;
    let done = new Set<string>();
    let current = 0;
    const tabs = h('div.cw-tabs', { role: 'tablist', 'aria-label': t(R.title) });
    const stage = h('div.cw-repair-stage', { 'aria-live': 'polite' });

    const persist = () => save('cluster-repair', { done: [...done] } satisfies Saved);

    const drawTabs = () => {
      clear(tabs);
      CLUSTER_FAULTS.forEach((f, i) => {
        const b = h('button.cw-tab', { type: 'button', role: 'tab', 'aria-selected': i === current ? 'true' : 'false', 'data-fault': f.id }, done.has(f.id) ? '✓ ' : '', t(layerOf(f.layer).label));
        b.addEventListener('click', () => show(i));
        tabs.append(b);
      });
    };

    const run = async (st: CanvasState, f: ClusterFault, out: HTMLElement) => {
      put(out, h('p.small.muted', {}, t(R.running)));
      try {
        const res = await runScenario(st, f.scenario, ALL_LAYERS, undefined, () => !disposed);
        if (!res || disposed) return false;
        clear(out);
        put(out, h('pre.cw-out', {}, res.text.trimEnd()));
        return true;
      } catch {
        clear(out);
        put(out, h('p.cw-why', {}, t(R.failed)));
        return false;
      }
    };

    const finish = () => {
      clear(stage);
      put(stage, prose(R.done), h('div.row', {}, h('button.btn.ghost', { type: 'button', onclick: () => ((done = new Set()), persist(), show(0)) }, icon('repeat'), t(R.again))));
    };

    const show = (i: number) => {
      current = i;
      drawTabs();
      const f = CLUSTER_FAULTS[i];
      const out = h('div.cw-repair-out');
      const answer = h('div.cw-repair-answer', { 'aria-live': 'polite' });
      const after = h('div.cw-repair-after');
      let ran = false;
      const runBtn = h('button.btn.primary', { type: 'button' }, icon('play'), t(R.run)) as HTMLButtonElement;
      const options = f.options.map((o) => {
        const b = h('button.cw-option', { type: 'button', disabled: true, 'data-option': o.id }, optionLabel(o)) as HTMLButtonElement;
        b.addEventListener('click', () => pick(o, b));
        return b;
      });
      const hint = h('p.small.muted', {}, t(R.first));
      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        ran = await run(brokenState(f.broken), f, out);
        runBtn.disabled = false;
        if (ran) {
          hint.remove();
          for (const b of options) b.disabled = false;
        }
      });
      const pick = (o: FaultOption, b: HTMLButtonElement) => {
        if (!ran) return;
        clear(answer);
        if (o.why) {
          b.classList.add('is-wrong');
          put(answer, h('p.cw-step', {}, t(R.wrong)), prose(o.why, 'prose cw-why'));
          return;
        }
        for (const x of options) x.disabled = true;
        b.classList.add('is-right');
        const fixBtn = h('button.btn.primary', { type: 'button' }, icon('check'), t(R.fix)) as HTMLButtonElement;
        put(answer, h('p.cw-step', {}, t(R.right)), prose(f.cause, 'prose cw-cause'), h('h4', {}, t(R.real)), prose(f.real), h('div.row', {}, fixBtn));
        fixBtn.addEventListener('click', async () => {
          fixBtn.disabled = true;
          const fixedOut = h('div');
          clear(after);
          put(after, h('p.cw-step', {}, t(R.fixed)), fixedOut);
          if (!(await run(fullState(), f, fixedOut))) {
            fixBtn.disabled = false;
            return;
          }
          put(after, prose(f.scenario.ok, 'prose cw-say'));
          done.add(f.id);
          persist();
          drawTabs();
          if (done.size === CLUSTER_FAULTS.length) ctx.complete();
          const nextI = CLUSTER_FAULTS.findIndex((x, j) => j > i && !done.has(x.id));
          const anyLeft = CLUSTER_FAULTS.findIndex((x) => !done.has(x.id));
          const target = nextI >= 0 ? nextI : anyLeft;
          put(after, h('div.row', {}, target >= 0 ? h('button.btn.primary', { type: 'button', onclick: () => show(target) }, t(R.next)) : h('button.btn.primary', { type: 'button', onclick: finish }, t(R.next))));
        });
      };
      clear(stage);
      put(
        stage,
        h('p.small.muted', {}, `${t(R.of(i + 1, CLUSTER_FAULTS.length))} · ${t(layerOf(f.layer).label)}`),
        prose(f.ticket, 'prose cw-say'),
        h('div.row', {}, runBtn),
        out,
        h('p.cw-step', {}, t(R.question)),
        hint,
        h('div.cw-options', {}, ...options),
        answer,
        after,
      );
    };

    clear(el);
    el.append(h('div.cw-repair', {}, h('div.cw-head', {}, h('h3', {}, t(R.title))), tabs, stage));
    show(0);
    void load<Saved>('cluster-repair').then((v) => {
      if (disposed || !v?.done?.length) return;
      done = new Set(v.done.filter((id) => CLUSTER_FAULTS.some((f) => f.id === id)));
      if (done.size === CLUSTER_FAULTS.length) {
        ctx.complete();
        drawTabs();
        return;
      }
      show(Math.max(0, CLUSTER_FAULTS.findIndex((f) => !done.has(f.id))));
    });
    return {
      dispose: () => {
        disposed = true;
        clear(el);
      },
      describe: () => {
        const f = CLUSTER_FAULTS[current];
        return `${t(R.title)}: ${t(layerOf(f.layer).label)}. ${t(f.ticket)}`;
      },
    };
  },
};
