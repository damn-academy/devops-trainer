// Calibration trainer for the hidden scientific-thinking pilot: ten claims
// about the world, the learner assigns a probability (0–100%) that each
// claim is true, then the widget shows the verdicts, the share of true
// claims and a calibration curve (stated confidence vs the share that
// turned out true). Answers persist in localStorage so the learner can
// come back and watch the picture move. The model is deliberately open
// about its small sample: ten claims are a training weight, not a verdict.

import { bi, t } from '../../core/i18n';
import type { Bi, Mounted, WidgetCtx, WidgetReg } from '../../core/types';

export interface CalibrationClaim {
  id: string;
  claim: Bi;
  truth: boolean;
  evidence: Bi;
}

export const CLAIMS: CalibrationClaim[] = [
  {
    id: 'sydney',
    claim: bi('Столица Австралии — Сидней.', 'The capital of Australia is Sydney.'),
    truth: false,
    evidence: bi(
      'Столица Австралии — Канберра. Сидней — самый большой город страны, и его часто путают со столицей, но правительство сидит в Канберре.',
      'The capital of Australia is Canberra. Sydney is the country’s largest city and is often mistaken for the capital, but the government sits in Canberra.',
    ),
  },
  {
    id: 'eiffel',
    claim: bi('Эйфелева башня летом становится выше, чем зимой.', 'The Eiffel Tower is taller in summer than in winter.'),
    truth: true,
    evidence: bi(
      'Металл расширяется от нагрева: по разным оценкам, жарой летом башня вырастает на несколько сантиметров, чаще всего называют цифру до 15 сантиметров.',
      'Metal expands when heated: by various estimates, summer heat makes the tower grow by several centimetres, with the figure most often quoted up to 15 centimetres.',
    ),
  },
  {
    id: 'banana',
    claim: bi('Банан с ботанической точки зрения — ягода, а клубника — нет.', 'A banana is a berry, botanically speaking, and a strawberry is not.'),
    truth: true,
    evidence: bi(
      'Ягода растёт из одного цветка с одной завязью; банан под это определение подходит. Съедобная часть клубники — разросшееся цветоложе с семенами снаружи, поэтому ботаники ягодой её не считают.',
      'A berry grows from a single flower with a single ovary; a banana fits that definition. The edible part of a strawberry is a swollen receptacle with seeds on the outside, so botanists do not count it as a berry.',
    ),
  },
  {
    id: 'wall',
    claim: bi('Великую Китайскую стену видно с Луны невооружённым глазом.', 'The Great Wall of China is visible from the Moon with the naked eye.'),
    truth: false,
    evidence: bi(
      'Это популярный миф: стена слишком узкая, чтобы её различил глаз на таком расстоянии. Даже с орбиты Земли увидеть её без помощи почти невозможно.',
      'This is a popular myth: the wall is far too narrow for an eye to pick out at that distance. Even from Earth’s orbit, seeing it unaided is next to impossible.',
    ),
  },
  {
    id: 'fish',
    claim: bi('Память золотой рыбки длится всего несколько секунд.', 'A goldfish’s memory lasts only a few seconds.'),
    truth: false,
    evidence: bi(
      'Опытты показывали, что золотые рыбки запоминают маршруты, сигналы кормления и звуки неделями. Секундная память — из анекдота, не из биологии.',
      'Experiments showed goldfish remember routes, feeding signals and sounds for weeks. The seconds-long memory comes from a joke, not from biology.',
    ),
  },
  {
    id: 'lightning',
    claim: bi('Молния может ударить в одно и то же место дважды.', 'Lightning can strike the same place twice.'),
    truth: true,
    evidence: bi(
      'Не только может, но и делает это регулярно: высокие здания принимают удары постоянно. Эмпайр-стейт-билдинг, по распространённым оценкам, ловит около двух десятков ударов в год.',
      'It not only can, it does so regularly: tall buildings are struck all the time. By common estimates, the Empire State Building catches about two dozen strikes a year.',
    ),
  },
  {
    id: 'decimals',
    claim: bi('Число 0,999… с бесконечной девяткой равно единице.', 'The number 0.999… with an endless nine equals one.'),
    truth: true,
    evidence: bi(
      'Математически 0,999… и 1 — одно и то же число: их разница меньше любого положительного числа, а такой разницы не существует.',
      'Mathematically 0.999… and 1 are the same number: the difference between them is smaller than any positive number, and no such difference exists.',
    ),
  },
  {
    id: 'earth',
    claim: bi('Радиус Земли на экваторе примерно на 21 километр больше, чем на полюсе.', 'The Earth’s radius at the equator is about 21 kilometres larger than at the pole.'),
    truth: true,
    evidence: bi(
      'Земля приплюснута у полюсов: экваториальный радиус — около 6378 километров, полярный — около 6357 километров, разница чуть больше 21 километра.',
      'The Earth is flattened at the poles: the equatorial radius is about 6378 kilometres, the polar radius about 6357, a difference of a little over 21 kilometres.',
    ),
  },
  {
    id: 'blood',
    claim: bi('Кровь составляет примерно половину массы тела взрослого человека.', 'Blood makes up about half of an adult’s body mass.'),
    truth: false,
    evidence: bi(
      'У взрослого человека крови около 4–6 литров, это примерно 7–8% массы тела. Половина массы тела пришлась бы на 30–40 литров, чего у человека нет.',
      'An adult has about 4–6 litres of blood, which is roughly 7–8% of body mass. Half of body mass would be 30–40 litres, which a human does not have.',
    ),
  },
  {
    id: 'brain',
    claim: bi('Человек задействует только десятую часть мозга.', 'Humans use only a tenth of the brain.'),
    truth: false,
    evidence: bi(
      'Нейрофизиология не находит «спящих» девяти десятых: за сутки активна большая часть мозга, даже во сне, и повреждение небольшого участка даёт заметные сбои.',
      'Neurophysiology finds no "sleeping" nine tenths: most of the brain is active over the course of a day, even in sleep, and damage to a small area produces noticeable failures.',
    ),
  },
];

export interface CalibrationBin {
  from: number;
  to: number;
  /** Mean stated confidence in the bin, 0..100. */
  stated: number;
  /** Share of claims in the bin that are actually true, 0..100. */
  actual: number;
  n: number;
}

export interface CalibrationStats {
  answered: number;
  /** Mean stated confidence over answered claims, 0..100. */
  mean: number;
  /** Share of true claims among answered ones, 0..100. */
  shareTrue: number;
  bins: CalibrationBin[];
}

const BIN_EDGES = [0, 20, 40, 60, 80, 100];

/** The deterministic stats behind the curve; extracted for tests. */
export function calibrationStats(claims: CalibrationClaim[], answers: Record<string, number>): CalibrationStats {
  const done = claims.filter((c) => typeof answers[c.id] === 'number');
  const mean = done.length ? done.reduce((n, c) => n + (answers[c.id] ?? 0), 0) / done.length : 0;
  const shareTrue = done.length ? (done.filter((c) => c.truth).length / done.length) * 100 : 0;
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < BIN_EDGES.length - 1; i++) {
    const from = BIN_EDGES[i]!;
    const to = BIN_EDGES[i + 1]!;
    const inBin = done.filter((c) => {
      const v = answers[c.id]!;
      return v >= from && (v < to || (to === 100 && v === 100));
    });
    const stated = inBin.length ? inBin.reduce((n, c) => n + (answers[c.id] ?? 0), 0) / inBin.length : 0;
    const actual = inBin.length ? (inBin.filter((c) => c.truth).length / inBin.length) * 100 : 0;
    bins.push({ from, to, stated, actual, n: inBin.length });
  }
  return { answered: done.length, mean, shareTrue, bins };
}

const STORE_KEY = 'dt.scithink.calibration.v1';

interface SavedState {
  answers: Record<string, number>;
  revealed: boolean;
}

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as SavedState;
      if (s && typeof s === 'object' && s.answers && typeof s.revealed === 'boolean') return { answers: s.answers, revealed: s.revealed };
    }
  } catch {
    /* private mode or a damaged record: the trainer lives for this tab only */
  }
  return { answers: {}, revealed: false };
}

function saveState(s: SavedState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: nothing to persist */
  }
}

const css = `
.scb-root { display: grid; gap: 14px; font-family: var(--font-text); }
.scb-claims { display: grid; gap: 10px; }
.scb-claim { border: 1px solid var(--line, #d8dee9); border-radius: 10px; padding: 10px 14px; display: grid; gap: 8px; }
.scb-claim p { margin: 0; }
.scb-slider { display: flex; align-items: center; gap: 12px; font-family: var(--font-ui); font-size: 13px; }
.scb-slider input[type=range] { flex: 1; }
.scb-slider output { min-width: 52px; text-align: right; font-variant-numeric: tabular-nums; color: var(--accent, #2f6fdd); }
.scb-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.scb-btn { font: inherit; font-family: var(--font-ui); border: 0; border-radius: 8px; padding: 8px 16px; background: var(--accent, #2f6fdd); color: #fff; cursor: pointer; }
.scb-btn.ghost { background: transparent; color: var(--accent, #2f6fdd); border: 1px solid var(--accent, #2f6fdd); }
.scb-progress { font-family: var(--font-ui); font-size: 13px; color: var(--muted, #5a6577); }
.scb-verdicts { display: grid; gap: 10px; }
.scb-verdict { border-left: 3px solid var(--line, #d8dee9); padding: 8px 12px; display: grid; gap: 4px; }
.scb-verdict.true { border-left-color: var(--ok, #3f9d6e); }
.scb-verdict.false { border-left-color: var(--err, #c4553a); }
.scb-mark { font-family: var(--font-ui); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
.scb-verdict.true .scb-mark { color: var(--ok, #3f9d6e); }
.scb-verdict.false .scb-mark { color: var(--err, #c4553a); }
.scb-evidence { font-size: 0.94rem; color: var(--ink-2, #43506b); margin: 0; }
.scb-summary { display: flex; flex-wrap: wrap; gap: 18px; font-family: var(--font-ui); font-size: 13px; }
.scb-summary b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.scb-curve { max-width: 420px; }
.scb-curve svg { width: 100%; height: auto; display: block; }
.scb-note { font-size: 13px; color: var(--muted, #5a6577); border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; margin: 0; }
`;

function curveSvg(stats: CalibrationStats): SVGSVGElement {
  const W = 340;
  const H = 260;
  const pad = 34;
  const x = (v: number) => pad + (v / 100) * (W - pad - 10);
  const y = (v: number) => H - pad - (v / 100) * (H - pad - 10);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const el = (tag: string, attrs: Record<string, string>, text?: string) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    svg.append(e);
  };
  el('line', { x1: String(x(0)), y1: String(y(0)), x2: String(x(100)), y2: String(y(0)), stroke: 'var(--line, #d8dee9)' });
  el('line', { x1: String(x(0)), y1: String(y(0)), x2: String(x(0)), y2: String(y(100)), stroke: 'var(--line, #d8dee9)' });
  for (const v of [0, 50, 100]) {
    el('text', { x: String(x(v)), y: String(H - pad + 16), 'text-anchor': 'middle', 'font-size': '11', fill: 'var(--muted, #5a6577)' }, String(v));
    el('text', { x: String(x(v) - 6), y: String(y(v) + 4), 'text-anchor': 'end', 'font-size': '11', fill: 'var(--muted, #5a6577)' }, String(v));
  }
  el('text', { x: String((W + pad) / 2), y: String(H - 4), 'text-anchor': 'middle', 'font-size': '11', fill: 'var(--muted, #5a6577)' }, t(bi('Названная уверенность, %', 'Stated confidence, %')));
  el('text', { x: '10', y: '14', 'font-size': '11', fill: 'var(--muted, #5a6577)' }, t(bi('Доля правдивых, %', 'Share true, %')));
  el('line', { x1: String(x(0)), y1: String(y(0)), x2: String(x(100)), y2: String(y(100)), stroke: 'var(--line, #d8dee9)', 'stroke-dasharray': '4 4' });
  for (const b of stats.bins) {
    if (!b.n) continue;
    el('circle', { cx: String(x(b.stated)), cy: String(y(b.actual)), r: '6', fill: 'var(--accent, #2f6fdd)' });
    el('text', { x: String(x(b.stated)), y: String(y(b.actual) - 10), 'text-anchor': 'middle', 'font-size': '11', fill: 'var(--ink-2, #43506b)' }, String(b.n));
  }
  return svg;
}

export function mountCalibration(el: HTMLElement, _props: unknown, ctx: WidgetCtx): Mounted {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'scb-root';
  el.append(style, root);
  const state = loadState();
  let revealed = state.revealed && Object.keys(state.answers).length === CLAIMS.length;

  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.append(...kids);
    return e;
  };

  const render = () => {
    const stats = calibrationStats(CLAIMS, state.answers);
    if (!revealed) {
      const progress = h('span', 'scb-progress', t(bi(`Отвечено ${stats.answered} из ${CLAIMS.length}`, `Answered ${stats.answered} of ${CLAIMS.length}`)));
      const show = h('button', 'scb-btn', t(bi('Показать, что правда', 'Show what is true'))) as HTMLButtonElement;
      show.type = 'button';
      show.onclick = () => {
        revealed = true;
        saveState({ answers: state.answers, revealed: true });
        ctx.record({ kind: 'x.calibration.done', answered: stats.answered, mean: Math.round(stats.mean), shareTrue: Math.round(stats.shareTrue) });
        ctx.complete();
        render();
      };
      root.replaceChildren(
        h('div', 'scb-claims', ...CLAIMS.map((c) => {
          const value = state.answers[c.id] ?? 50;
          const out = h('output', '', `${value}%`);
          const input = document.createElement('input');
          input.type = 'range';
          input.min = '0'; input.max = '100'; input.step = '5'; input.value = String(value);
          input.setAttribute('aria-label', t(bi('Насколько утверждение правдиво', 'How true the claim is')));
          input.oninput = () => {
            state.answers[c.id] = Number(input.value);
            out.textContent = `${input.value}%`;
            saveState(state);
            progress.textContent = t(bi(`Отвечено ${calibrationStats(CLAIMS, state.answers).answered} из ${CLAIMS.length}`, `Answered ${calibrationStats(CLAIMS, state.answers).answered} of ${CLAIMS.length}`));
          };
          return h('div', 'scb-claim', h('p', '', t(c.claim)), h('div', 'scb-slider', input, out));
        })),
        h('div', 'scb-actions', show, progress),
      );
    } else {
      const again = h('button', 'scb-btn ghost', t(bi('Пройти ещё раз', 'Run it again'))) as HTMLButtonElement;
      again.type = 'button';
      again.onclick = () => {
        state.answers = {};
        revealed = false;
        saveState({ answers: {}, revealed: false });
        render();
      };
      root.replaceChildren(
        h('div', 'scb-verdicts', ...CLAIMS.map((c) => {
          const yours = state.answers[c.id] ?? 50;
          return h('div', `scb-verdict ${c.truth ? 'true' : 'false'}`,
            h('span', 'scb-mark', `${t(c.truth ? bi('Правда', 'True') : bi('Ложь', 'False'))} · ${t(bi('ваша уверенность', 'your confidence'))} ${yours}%`),
            h('p', '', t(c.claim)),
            h('p', 'scb-evidence', t(c.evidence)),
          );
        })),
        h('div', 'scb-summary',
          h('div', '', t(bi('Средняя уверенность', 'Mean confidence')), h('b', '', `${Math.round(stats.mean)}%`)),
          h('div', '', t(bi('Доля правдивых утверждений', 'Share of true claims')), h('b', '', `${Math.round(stats.shareTrue)}%`))),
        h('div', 'scb-curve', curveSvg(stats)),
        h('p', 'scb-note', t(bi(
          'Точки кривой показывают, какая доля утверждений с вашей уверенностью оказалась правдивой; число над точкой — сколько утверждений в этой группе. Десять утверждений — маленькая выборка, поэтому относитесь к одному прогону как к тренировке, а не к диагнозу: ценность накапливается, когда вы проходите тренажёр повторно.',
          'The curve’s points show which share of claims at your level of confidence turned out true; the number over a point is how many claims sit in that group. Ten claims are a small sample, so treat one run as practice, not a diagnosis: the value builds up when you retake the trainer.',
        ))),
        h('div', 'scb-actions', again),
      );
    }
  };
  render();
  return {
    dispose() { root.remove(); style.remove(); },
    describe: () => t(bi('Тренажёр калибровки: десять утверждений, ползунки уверенности и кривая калибровки.', 'A calibration trainer: ten claims, confidence sliders and a calibration curve.')),
  };
}

export const calibrationWidget: WidgetReg = { id: 'scithink.calibration', mount: mountCalibration };
