// The protocol catalogue screen: filters by course level and layer, one card
// open at a time, every card in the same order — why, layer, the exchange
// (a sequence diagram with labels on the arrows), how to observe, how it
// breaks with the layer named first.

import { clear, h, s } from '../../../core/dom';
import { bi, lang, onLangChange, t } from '../../../core/i18n';
import type { Level, Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { PROTOCOLS, RU_TEXT, type LayerTag, type ProtoCard } from './protocols';

/** A symptom, proof or actor name in the reader's language; commands and tool output stay as printed. */
const tx = (text: string): string => (lang() === 'ru' ? RU_TEXT[text] ?? text : text);

const LAYER_FAM: Record<LayerTag, string> = { L2: 'l2', L3: 'l3', L4: 'l4', TLS: 'tls', L7: 'l7' };
const LEVEL_NAME: Record<Level, ReturnType<typeof bi>> = { beginner: bi('Новичок', 'Beginner'), intermediate: bi('Средний', 'Intermediate'), experienced: bi('Опытный', 'Experienced') };
const RANK: Record<Level, number> = { beginner: 0, intermediate: 1, experienced: 2 };

/** A sequence diagram: actors as columns, time downwards, a label on every arrow. */
export function sequenceSvg(p: ProtoCard): SVGElement {
  const W = 640;
  const colW = W / p.actors.length;
  const x = (i: number) => colW * i + colW / 2;
  const top = 34;
  const dy = 40;
  const H = top + p.steps.length * dy + 20;
  const svg = s('svg.cat-seq', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${p.name}: ${p.steps.map((st) => st.label).join('; ')}` });
  p.actors.forEach((a, i) => {
    svg.append(s('text.cat-actor', { x: x(i), y: 16, 'text-anchor': 'middle' }, tx(a)), s('line.cat-life', { x1: x(i), y1: 24, x2: x(i), y2: H - 6 }));
  });
  p.steps.forEach((st, i) => {
    const y = top + i * dy + 16;
    const x1 = x(st.from);
    const x2 = x(st.to);
    const dir = x2 > x1 ? 1 : -1;
    svg.append(
      s('line.cat-msg', { x1, y1: y, x2: x2 - dir * 6, y2: y + 8 }),
      s('path.cat-arrow', { d: `M${x2} ${y + 8} l${-dir * 9} -5 l0 10 z` }),
      s('text.cat-label', { x: (x1 + x2) / 2, y: y - 5, 'text-anchor': 'middle' }, st.label),
    );
  });
  return svg;
}

function mount(el: HTMLElement, props: { level?: Level } | undefined, ctx: WidgetCtx): Mounted {
  let level: Level = props?.level ?? ctx.level;
  let layer: LayerTag | 'all' = 'all';
  let open: string | null = null;
  const opened = new Set<string>();
  const root = h('section.cat');
  el.append(root);
  const render = () => {
    clear(root);
    const filters = h(
      'div.cat-filters',
      {},
      h('div.segmented', { role: 'radiogroup', 'aria-label': t(bi('Уровень', 'Level')) }, ...(['beginner', 'intermediate', 'experienced'] as Level[]).map((l) => h('button.env-seg', { type: 'button', 'aria-pressed': String(level === l), onclick: () => { level = l; render(); } }, t(LEVEL_NAME[l])))),
      h('div.segmented', { role: 'radiogroup', 'aria-label': t(bi('Слой', 'Layer')) }, ...(['all', 'L2', 'L3', 'L4', 'TLS', 'L7'] as const).map((l) => h(`button.env-seg${l === 'all' ? '' : `.fam-${LAYER_FAM[l]}`}`, { type: 'button', 'aria-pressed': String(layer === l), onclick: () => { layer = l; render(); } }, l === 'all' ? t(bi('все', 'all')) : l))),
    );
    const list = PROTOCOLS.filter((p) => RANK[p.level] <= RANK[level] && (layer === 'all' || p.layer === layer));
    const grid = h('div.cat-grid');
    for (const p of list) {
      const isOpen = open === p.id;
      const head = h(
        'button.cat-head',
        { type: 'button', 'aria-expanded': String(isOpen), onclick: () => { open = isOpen ? null : p.id; if (!isOpen) { opened.add(p.id); ctx.record({ kind: 'x.net.protocol-card', card: p.id }); if (opened.size >= 3) ctx.complete(); } render(); } },
        h(`span.cat-layer.fam-${LAYER_FAM[p.layer]}`, {}, p.layer),
        h('span.cat-name', {}, p.name),
        h('span.cat-transport', {}, p.transport),
        p.level !== 'beginner' ? h('span.cat-level', {}, t(LEVEL_NAME[p.level])) : null,
      );
      const card = h(`article.cat-card${isOpen ? '.open' : ''}`, {}, head);
      if (isOpen) {
        card.append(
          h('p.cat-why', {}, t(p.why)),
          h('h5', {}, t(bi('Обмен', 'The exchange'))),
          sequenceSvg(p),
          h('h5', {}, t(bi('Как наблюдать', 'How to observe'))),
          h('ul.cat-observe', {}, ...p.observe.map((o) => h('li', {}, h('code', {}, o)))),
          h('h5', {}, t(bi('Как протокол ломается и на каком это уровне', 'How it breaks — which layer?'))),
          h(
            'ul.cat-breaks',
            {},
            ...p.breaks.map((b) => h('li', {}, h(`span.cat-layer.fam-${LAYER_FAM[b.layer]}`, {}, b.layer), h('code.cat-symptom', {}, tx(b.symptom)), h('span.cat-cause', {}, t(b.cause)), h('span.cat-prove', {}, t(bi('Чем это доказать: ', 'Prove it: ')), h('code', {}, tx(b.prove))))),
          ),
          h('p.cat-doc', {}, t(bi('Где это написано: ', 'Where it is written: ')), h('a', { href: p.doc.url, target: '_blank', rel: 'noopener' }, p.doc.label)),
        );
      }
      grid.append(card);
    }
    root.append(filters, grid);
  };
  const off = onLangChange(render);
  render();
  return { dispose: () => { off(); root.remove(); }, describe: () => `protocol catalogue, ${level}, open: ${open ?? 'none'}` };
}

export const catalogueWidget: WidgetReg = { id: 'net.protocols', mount: (el, props, ctx) => mount(el, props as { level?: Level } | undefined, ctx) };
