// The situational drill widget (10 §9.2): pick the next step or type a
// command; the sandbox shows what that step shows for the hidden cause. At
// the end: a status to the team, the score on the drill rubric, the path
// with marks (evidence, detour, destructive) and the cause revealed.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { meanScore, DRILL_RUBRIC, type CriterionScore } from '../../../engine/quiz/rubric';
import { shuffle } from '../../../engine/quiz/render';
import { prose } from './ui';
import { drillById } from '../data/drills';
import { finishStatus, matchCommand, move, pickVariant, scoreDrill, startDrill, type Drill, type DrillState } from '../drill-engine';
import { eventsOf, qtextBlock, scoreDots } from './ui';

export interface DrillResult {
  drill: string;
  variant: string;
  scores: CriterionScore[];
  mean: number;
  fixed: boolean;
  safetyZero: boolean;
}

const D = {
  start: bi('Начать', 'Start'),
  orType: bi('или введи команду и нажми Enter', 'or type a command and press Enter'),
  noMatch: bi('На этом шаге такая команда ничего полезного не покажет. Выбери шаг или попробуй другую команду.', 'At this step that command shows nothing useful. Pick a step or try another command.'),
  status: bi('Последний шаг — статус в чат команды: влияние, что сделано, когда следующее сообщение или что инцидент закрыт.', 'The last step is a status to the team chat: the impact, what was done, when the next message comes or that the incident is closed.'),
  send: bi('Отправить статус и завершить', 'Send the status and finish'),
  cause: bi('Скрытая причина была', 'The hidden cause was'),
  again: bi('Ещё раз, с другой причиной', 'Again, with another cause'),
  path: bi('Твой путь', 'Your path'),
  score: bi('Разбор по рубрике', 'Review on the rubric'),
  mean: bi('Средний балл', 'Mean score'),
  evidence: bi('улика', 'evidence'),
  destructive: bi('разрушающее действие', 'destructive action'),
  detour: bi('лишний шаг', 'detour'),
  hide: bi('прячет симптом', 'hides the symptom'),
  wrong: bi('не то', 'not this'),
  step: bi('Шаг', 'Step'),
  placeholder: bi('Например: «Оплата у всех, 504 ~30% с 14:10. Откатили релиз 14:05, ошибки 0,4%. Индекс выкатим миграцией, следующий статус в 15:00».', 'For example: “Checkout for everyone, 504 ~30% since 14:10. Rolled back the 14:05 release, errors 0.4%. The index goes out as a migration, next update at 15:00.”'),
};

const MARK: Record<string, { icon: string; cls: string; label: typeof D.evidence }> = {
  evidence: { icon: '✓', cls: 'ok', label: D.evidence },
  destructive: { icon: '⨯', cls: 'err', label: D.destructive },
  hide: { icon: '!', cls: 'warn', label: D.hide },
  detour: { icon: '·', cls: 'muted', label: D.detour },
  contradicts: { icon: '·', cls: 'muted', label: D.detour },
};

export interface DrillOptions {
  /** Hide the "again" button and report the result (the on-call shift). */
  onDone?(r: DrillResult): void;
  /** Called after every move (the shift uses it to bring the next incident). */
  onMove?(s: DrillState): void;
  previousVariant?: string;
}

export function mountDrill(root: HTMLElement, drill: Drill, o: DrillOptions = {}): Mounted {
  let state: DrillState;
  const log = h('ol.cw-log', { 'aria-live': 'polite' });
  const stage = h('div.cw-stage');
  let disposed = false;

  const begin = (prev?: string) => {
    state = startDrill(drill, pickVariant(drill, prev));
    clear(log);
    draw();
  };

  const draw = () => {
    if (disposed) return;
    clear(stage);
    if (state.done) return statusStep();
    const step = drill.steps[state.step];
    const input = h('input.cw-cmd', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': t(D.orType) }) as HTMLInputElement;
    const hint = h('p.small.muted', { 'aria-live': 'polite' });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const line = input.value.trim();
      if (!line) return;
      const opt = matchCommand(step, line);
      if (!opt) {
        hint.textContent = t(D.noMatch);
        return;
      }
      take(opt.id, 'command', line);
    });
    put(
      stage,
      h('p.cw-step', {}, h('span.muted', {}, `${t(D.step)} ${state.step + 1}/${drill.steps.length} · `), t(step.prompt)),
      h('div.cw-options', {}, ...shuffle(step.options, `${drill.id}:${step.id}:${state.variant}`).map((opt) => h('button.cw-option', { type: 'button', onclick: () => take(opt.id, 'choice') }, prose(opt.text, 'prose cw-opt-text')))),
      h('label.cw-cmd-row', {}, h('span.cw-prompt', { 'aria-hidden': 'true' }, '$'), input),
      h('p.small.muted', {}, t(D.orType)),
      hint,
    );
  };

  const take = (optionId: string, via: 'choice' | 'command', line?: string) => {
    const r = move(drill, state, optionId, via, line);
    state = r.state;
    const marks = r.option.tags.map((tg) => MARK[tg]).filter(Boolean);
    const shown = marks.find((m) => (r.right ? m.cls === 'ok' : m.cls !== 'ok'));
    log.append(
      h(
        'li.cw-entry',
        { class: r.right ? 'right' : 'wrong' },
        h('p.cw-move', {}, via === 'command' ? h('code', {}, `$ ${line}`) : h('span', {}, t(r.option.text).replace(/`/g, '')), shown ? h('span.cw-mark', { class: shown.cls }, ` ${shown.icon} ${t(shown.label)}`) : !r.right ? h('span.cw-mark.warn', {}, ` · ${t(D.wrong)}`) : null),
        r.output ? qtextBlock(r.output) : null,
        prose(r.why, 'prose cw-why'),
      ),
    );
    o.onMove?.(state);
    draw();
    log.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  };

  const statusStep = () => {
    const ta = h('textarea.cw-status', { rows: 3, placeholder: t(D.placeholder), 'aria-label': t(D.status) }) as HTMLTextAreaElement;
    const btn = h('button.btn.primary', { type: 'button' }, t(D.send));
    btn.addEventListener('click', () => finish(ta.value));
    put(stage, h('p.cw-step', {}, t(D.status)), ta, h('div.row', {}, btn));
    ta.focus({ preventScroll: true });
  };

  const finish = (status: string) => {
    state = finishStatus(state, status);
    const scores = scoreDrill(drill, state);
    const mean = meanScore(scores);
    const result: DrillResult = { drill: drill.id, variant: state.variant, scores, mean, fixed: scores.find((s) => s.id === 'result')!.score >= 2, safetyZero: scores.find((s) => s.id === 'safety')!.score === 0 };
    store.record({ kind: 'x.career.drill', drill: drill.id, variant: state.variant, mean, scores: scores.map((s) => ({ id: s.id, score: s.score })), moves: state.path.length });
    clear(stage);
    const cause = drill.variants.find((v) => v.id === state.variant)!;
    put(
      stage,
      h('p.cw-cause', {}, h('strong', {}, `${t(D.cause)}: `), t(cause.cause), '.'),
      h('h4', {}, t(D.score)),
      h(
        'table.cw-rubric',
        {},
        h(
          'tbody',
          {},
          ...scores.map((s) => {
            const c = DRILL_RUBRIC.criteria.find((x) => x.id === s.id)!;
            return h('tr', {}, h('th', { scope: 'row' }, t(c.title)), h('td', {}, scoreDots(s.score)), h('td.small', {}, t(c.anchors[s.score])));
          }),
        ),
      ),
      h('p', {}, `${t(D.mean)}: ${mean.toFixed(1)} / 3`),
      o.onDone ? null : h('button.btn.ghost', { type: 'button', onclick: () => begin(state.variant) }, icon('repeat'), t(D.again)),
    );
    o.onDone?.(result);
  };

  clear(root);
  root.append(h('div.cw-drill', {}, h('header.cw-head', {}, h('h3', {}, t(drill.title)), prose(drill.symptom)), h('h4.cw-path-h', {}, t(D.path)), log, stage));
  begin(o.previousVariant);
  return {
    dispose: () => {
      disposed = true;
      clear(root);
    },
    describe: () => `${t(drill.title)} — ${t(D.step)} ${state.step + 1}/${drill.steps.length}`,
  };
}

export const drillWidget: WidgetReg = {
  id: 'career.drill',
  mount(el, props, ctx) {
    const id = (props as { drill?: string })?.drill ?? 'drill.504';
    const drill = drillById(id);
    if (!drill) {
      el.append(h('p.err', {}, `Unknown drill: ${id}`));
      return { dispose: () => clear(el) };
    }
    const prev = eventsOf<{ drill: string; variant: string }>('x.career.drill').filter((e) => e.drill === id).slice(-1)[0];
    if (prev) ctx.complete();
    return mountWithComplete(el, drill, prev?.variant, ctx.complete);
  },
};

function mountWithComplete(el: HTMLElement, drill: Drill, previousVariant: string | undefined, complete: () => void): Mounted {
  const host = h('div');
  clear(el);
  el.append(host);
  let done = false;
  const m = mountDrill(host, drill, { previousVariant });
  const unsub = store.subscribe((_p, e) => {
    if (!done && e?.kind === 'x.career.drill' && (e as unknown as { drill: string }).drill === drill.id) {
      done = true;
      complete();
    }
  });
  return { dispose: () => (unsub(), m.dispose()), describe: m.describe };
}
