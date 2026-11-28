// Figures of the scientific-thinking pilot, drawn as inline SVG so they take
// the page's colour tokens in light and dark themes. All data is fictional
// and every figure says so in its caption.
//  - scithink.axis: one pair of numbers (80 and 82) on an axis from 79 and on
//    an axis from zero, plus a slider that moves the start of the axis.
//  - scithink.thousand: the base-rate example laid out as a thousand dots.

import { onVisible } from '../../core/dom';
import { bi, lang, t } from '../../core/i18n';
import type { Bi, Mounted, WidgetCtx, WidgetReg } from '../../core/types';

const SVG = 'http://www.w3.org/2000/svg';
let instance = 0;

const css = `
.sct-root { display: grid; gap: 18px; font-family: var(--font-ui); max-width: 760px; margin-inline: auto; }
.sct-root * { box-sizing: border-box; min-width: 0; }
.sct-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin: 0; }
.sct-pair > figcaption { grid-column: 1 / -1; }
.sct-chart { width: 100%; max-width: 380px; }
.sct-panel { display: grid; gap: 6px; margin: 0; }
.sct-panel h4 { margin: 0; font: 600 14px/1.35 var(--font-ui); color: var(--ink); }
.sct-root svg { display: block; width: 100%; height: auto; }
.sct-root figure { margin: 0; display: grid; gap: 12px; }
.sct-root figcaption, .sct-caption { font: 14px/1.5 var(--font-ui); color: var(--ink-2); margin: 0; }
.sct-try { display: grid; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px; }
.sct-try label { display: grid; gap: 6px; font: 600 14px/1.35 var(--font-ui); color: var(--ink); }
.sct-try input[type=range] { width: 100%; accent-color: var(--focus); }
.sct-readout { font: 14px/1.5 var(--font-ui); color: var(--ink-2); margin: 0; font-variant-numeric: tabular-nums; }
.sct-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; list-style: none; padding: 0; margin: 0; font: 14px/1.4 var(--font-ui); color: var(--ink-2); }
.sct-legend li { display: flex; align-items: center; gap: 8px; }
.sct-swatch { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.lsec:has(.sct-root) > .task-completion { display: none; }
`;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

/** An accessible SVG root: role img, a title and a description read by screen readers. */
function figureSvg(width: number, height: number, title: string, desc: string): SVGSVGElement {
  const id = `sct-${++instance}`;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': `${id}-t ${id}-d` });
  svg.append(svgEl('title', { id: `${id}-t` }, title), svgEl('desc', { id: `${id}-d` }, desc));
  return svg;
}

const num = (v: number, digits = 1) => v.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: digits });

/** Bar top with 4 px rounded corners, anchored square at the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Tick values from the axis start upward; the start is always labelled. */
function ticks(base: number, top: number): number[] {
  const span = top - base;
  const step = [1, 2, 5, 10, 20, 25, 50].find(s => span / s <= 5) ?? 50;
  const out = [base];
  for (let v = Math.ceil(base / step) * step; v <= top + 1e-9; v += step) if (v - base >= step * 0.6) out.push(v);
  return out;
}

export const AXIS_DATA = { old: 80, next: 82 } as const;

/** How many times taller the new bar looks than the old one when the axis starts at `base`. */
export const apparentRatio = (base: number) => (AXIS_DATA.next - base) / (AXIS_DATA.old - base);

function barChart(base: number, title: string): SVGSVGElement {
  const W = 300, H = 230, left = 44, right = 12, top = 26, bottom = 46;
  const max = base === 0 ? 100 : AXIS_DATA.next + (AXIS_DATA.next - base) * 0.25;
  const y = (v: number) => top + (1 - (v - base) / (max - base)) * (H - top - bottom);
  const desc = t(bi(
    `Вертикальная ось начинается с ${base}. Столбик старой пасты — ${AXIS_DATA.old} баллов, столбик новой — ${AXIS_DATA.next} балла. На рисунке новый столбик выше старого в ${num(apparentRatio(base), 2)} раза.`,
    `The vertical axis starts at ${base}. The old toothpaste bar is ${AXIS_DATA.old} points, the new one ${AXIS_DATA.next} points. In the picture the new bar is ${num(apparentRatio(base), 2)} times as tall as the old one.`,
  ));
  const svg = figureSvg(W, H, title, desc);
  for (const v of ticks(base, max)) {
    svg.append(
      svgEl('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), stroke: v === base ? 'var(--line-2)' : 'var(--line)', 'stroke-width': v === base ? 1.5 : 1 }),
      svgEl('text', { x: left - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: v === base ? 'var(--ink)' : 'var(--muted)', 'font-weight': v === base ? 600 : 400 }, num(v)),
    );
  }
  const bars = [
    { v: AXIS_DATA.old, label: t(bi('Старая паста', 'Old toothpaste')), fill: 'var(--c-neutral)' },
    { v: AXIS_DATA.next, label: t(bi('Новая паста', 'New toothpaste')), fill: 'var(--focus)' },
  ];
  const slot = (W - left - right) / bars.length, bw = Math.min(72, slot * 0.5);
  bars.forEach((b, i) => {
    const x = left + slot * i + (slot - bw) / 2;
    svg.append(
      svgEl('path', { d: barPath(x, y(b.v), bw, y(base) - y(b.v)), fill: b.fill }),
      svgEl('text', { x: x + bw / 2, y: y(b.v) - 7, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, num(b.v)),
      svgEl('text', { x: x + bw / 2, y: H - bottom + 20, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink-2)' }, b.label),
    );
  });
  return svg;
}

function shell(el: HTMLElement): HTMLElement {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'sct-root';
  el.append(style, root);
  styles.set(root, style);
  return root;
}

const styles = new WeakMap<HTMLElement, HTMLStyleElement>();

function h(tag: string, cls: string, ...kids: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
}

function finish(root: HTMLElement, ctx: WidgetCtx, describe: Bi): Mounted {
  const stop = onVisible(root, () => ctx.complete(), 0.25);
  return { dispose() { stop(); styles.get(root)?.remove(); root.remove(); }, describe: () => t(describe) };
}

export function mountAxis(el: HTMLElement, _props: unknown, ctx: WidgetCtx): Mounted {
  const root = shell(el);
  const panel = (base: number, heading: Bi) => {
    const title = t(heading);
    return h('div', 'sct-panel', h('h4', '', title), barChart(base, title));
  };
  const pair = h('figure', 'sct-pair',
    panel(79, bi('Ось начинается с 79', 'The axis starts at 79')),
    panel(0, bi('Ось начинается с нуля', 'The axis starts at zero')),
  );
  const caption = h('p', 'sct-caption', t(bi(
    'Данные вымышленные: средняя оценка белизны зубов по шкале до 100 баллов у старой пасты 80, у новой 82. На обоих рисунках одни и те же два числа. На первом рисунке ось начинается с 79, и столбик новой пасты выглядит втрое выше старого; на втором ось начинается с нуля, и видно, что разница составляет два балла, то есть два с половиной процента. Сравните подписи у основания осей: только они выдают приём.',
    'The data is fictional: the average tooth-whiteness score on a 100-point scale is 80 for the old toothpaste and 82 for the new one. Both pictures show the same two numbers. In the first picture the axis starts at 79, and the new bar looks three times as tall as the old one; in the second the axis starts at zero, and you can see the difference is two points, that is two and a half percent. Compare the labels at the bottom of the axes: they alone give the trick away.',
  )));
  pair.append(h('figcaption', '', caption));

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '79';
  input.step = '1';
  input.value = '60';
  const chartHost = h('div', 'sct-chart');
  const readout = h('p', 'sct-readout');
  readout.setAttribute('aria-live', 'polite');
  const draw = () => {
    const base = Number(input.value);
    chartHost.replaceChildren(barChart(base, t(bi(`Ось начинается с ${base}`, `The axis starts at ${base}`))));
    readout.textContent = t(bi(
      `Ось начинается с ${base}. На рисунке столбик новой пасты выше старого в ${num(apparentRatio(base), 2)} раза, а на деле 82 больше 80 в ${num(apparentRatio(0), 3)} раза, то есть на 2,5 %.`,
      `The axis starts at ${base}. In the picture the new bar is ${num(apparentRatio(base), 2)} times as tall as the old one, while in fact 82 is ${num(apparentRatio(0), 3)} times 80, that is 2.5% more.`,
    ));
  };
  input.oninput = draw;
  draw();
  const label = h('label', '', t(bi('Передвиньте начало оси и посмотрите, как меняется разница между столбиками', 'Move the start of the axis and watch the gap between the bars change')), input);
  root.append(pair, h('div', 'sct-try', label, chartHost, readout));
  return finish(root, ctx, bi(
    'Два рисунка одних и тех же вымышленных данных, 80 и 82 балла: ось от 79 и ось от нуля, и ползунок, который передвигает начало оси.',
    'Two pictures of the same fictional data, 80 and 82 points: an axis from 79 and an axis from zero, and a slider that moves the start of the axis.',
  ));
}

/** Deterministic positions of the false alarms so the picture is the same for every reader. */
export function thousandLayout(): { sick: number; falseAlarms: Set<number> } {
  let seed = 20261126;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const sick = 517;
  const falseAlarms = new Set<number>();
  while (falseAlarms.size < 50) {
    const i = Math.floor(rand() * 1000);
    if (i !== sick) falseAlarms.add(i);
  }
  return { sick, falseAlarms };
}

export function mountThousand(el: HTMLElement, _props: unknown, ctx: WidgetCtx): Mounted {
  const root = shell(el);
  const cols = 40, rows = 25, cell = 10;
  const { sick, falseAlarms } = thousandLayout();
  const svg = figureSvg(cols * cell, rows * cell, t(bi('Тысяча человек и положительный тест', 'A thousand people and a positive test')), t(bi(
    'Тысяча точек, по одной на человека. Одна синяя точка — больной, у которого тест нашёл болезнь. Пятьдесят красных точек — здоровые люди, у которых тест ошибся и показал болезнь. Остальные 949 серых точек — здоровые люди с отрицательным результатом.',
    'A thousand dots, one per person. One blue dot is the sick person whose disease the test found. Fifty red dots are healthy people for whom the test erred and showed the disease. The remaining 949 grey dots are healthy people with a negative result.',
  )));
  const colours = { sick: 'var(--focus)', alarm: 'var(--c-err)', healthy: 'var(--line-2)' };
  for (let i = 0; i < cols * rows; i++) {
    const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * cell + cell / 2;
    if (i === sick) svg.append(svgEl('circle', { cx, cy, r: 4.6, fill: colours.sick, stroke: 'var(--ink)', 'stroke-width': 1 }));
    else svg.append(svgEl('circle', { cx, cy, r: falseAlarms.has(i) ? 3.6 : 2.8, fill: falseAlarms.has(i) ? colours.alarm : colours.healthy }));
  }
  const item = (colour: string, text: Bi) => h('li', '', Object.assign(h('span', 'sct-swatch'), { style: `background:${colour}` }), t(text));
  const legend = h('ul', 'sct-legend',
    item(colours.sick, bi('1 больной, тест его нашёл', '1 sick person, found by the test')),
    item(colours.alarm, bi('50 здоровых с ложной тревогой', '50 healthy people with a false alarm')),
    item(colours.healthy, bi('949 здоровых с отрицательным тестом', '949 healthy people with a negative test')),
  );
  const caption = h('figcaption', '', t(bi(
    'Вымышленная тысяча человек из примера, по точке на человека. Положительный результат получила 51 точка, синяя и красные, и только одна из них — больной. Найдите на рисунке синюю точку среди красных: так выглядят два процента.',
    'The fictional thousand people from the example, one dot per person. Fifty-one dots, the blue one and the red ones, got a positive result, and only one of them is sick. Find the blue dot among the red ones: this is what two percent looks like.',
  )));
  root.append(h('figure', '', svg, legend, caption));
  return finish(root, ctx, bi(
    'Рисунок из тысячи точек: один больной, пятьдесят ложных тревог и 949 здоровых с отрицательным тестом.',
    'A picture of a thousand dots: one sick person, fifty false alarms and 949 healthy people with a negative test.',
  ));
}

export const axisWidget: WidgetReg = { id: 'scithink.axis', mount: mountAxis };
export const thousandWidget: WidgetReg = { id: 'scithink.thousand', mount: mountThousand };
