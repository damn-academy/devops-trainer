// "Kubernetes from blocks" (05 §6.2): the learner places the components of a
// cluster layer by layer — the control plane on top, the node and the
// cluster network below, the add-ons a platform team installs at the
// bottom — wires the core ones and switches whole layers off and on. A wire
// is typed: only real connections are accepted, and a forbidden one says
// why; add-ons are wired to the API server by the trainer. "Run" starts
// kube-lite with exactly what is on the canvas and switched on, and a
// scenario shows the real kubectl and curl output of such a cluster, with
// a sentence naming the component whose absence caused the symptom.
//
// The model (components, layers, scenarios, the headless run) is in
// constructor-model.ts.

import './kube.css';
import { clear, h, s } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { placeLabel, type Box } from '../../explainer/tidy';
import {
  ALL_LAYERS,
  API_BUS,
  CNI_VARIANTS,
  COMPONENTS,
  CORE_LAYERS,
  DATA_LINKS,
  H,
  LAYERS,
  ROW_A,
  ROW_B,
  SCENARIOS,
  WIRES,
  comp,
  componentsFrom,
  key,
  layerOf,
  runScenario,
  scenarioLayers,
  whyNot,
  widthOf,
  wireOf,
  type CanvasState,
  type CniVariant,
  type Comp,
  type LayerId,
  type Scenario,
} from './constructor-model';

export { COMPONENTS, WIRES, componentsFrom, whyNot, type CanvasState };

type Zone = 'client' | 'cp' | 'node' | 'addon';
const zoneOfComp = (c: Comp): Zone => (c.layer === 'client' ? 'client' : c.layer === 'cp' ? 'cp' : c.layer === 'node' || c.layer === 'net' ? 'node' : 'addon');

const L = {
  legend: bi('Слои кластера', 'Cluster layers'),
  legendHint: bi(
    'Нажмите на название слоя, чтобы выключить или включить его целиком: блоки выключенного слоя бледнеют и в прогоне считаются убранными. Отдельный блок ставится нажатием в палитре или перетаскиванием на холст, а убирается кнопкой в его карточке. Чтобы провести провод между блоками управляющего слоя, узла и сети, нажмите на один блок на холсте, затем на другой; дополнения тренажёр подключает к API-серверу сам.',
    'Press a layer name to switch the whole layer off or on: the blocks of a layer that is off are dimmed and count as removed in a run. Place a single block by pressing it in the palette or dragging it onto the canvas; remove it with the button in its card. To wire blocks of the control plane, the node and the network, press one block on the canvas, then another; the trainer wires add-ons to the API server itself.',
  ),
  legendHintCore: bi('Перетащите блок на холст или нажмите на него. Чтобы провести провод, нажмите на один блок на холсте, затем на другой.', 'Drag a block onto the canvas or press it. To draw a wire, press one block on the canvas, then another.'),
  cp: bi('управляющий слой', 'control plane'),
  nodes: bi('узлы cp-1, worker-1, worker-2: агент узла и сеть кластера', 'nodes cp-1, worker-1, worker-2: node agent and cluster network'),
  addons: bi('дополнения: работают подами на узлах', 'add-ons: run as pods on the nodes'),
  bus: bi('watch и запись через API-сервер', 'watch and write through the API server'),
  run: bi('Запустить кластер из того, что на холсте', 'Run a cluster made of what is on the canvas'),
  remove: bi('Убрать с холста', 'Remove from the canvas'),
  removeWire: bi('Убрать провод', 'Remove the wire'),
  full: bi('Собрать всё правильно', 'Assemble everything correctly'),
  clearAll: bi('Очистить холст', 'Clear the canvas'),
  who: bi('Кто ставит', 'Who installs it'),
  talks: bi('С кем говорит', 'Who it talks to'),
  hands: bi('Что и кому передаёт', 'What it hands to whom'),
  see: bi('Как посмотреть', 'How to look at it'),
  without: bi('Если убрать', 'If you remove it'),
  variant: bi('Какой сетевой плагин стоит', 'Which network plugin is installed'),
  wrongZone: bi('Этот компонент живёт в другой зоне: ', 'This component lives in another zone: '),
  running: bi('Кластер запускается…', 'Starting the cluster…'),
  verdictOk: bi('Все компоненты на месте и соединены: кластер ведёт себя как настоящий.', 'Every component is in place and wired: the cluster behaves like a real one.'),
  verdictMissing: bi('Выключено, потому что блока нет на холсте, к нему нет провода или его слой выключен: ', 'Switched off because the block is not on the canvas, not wired, or its layer is off: '),
  pick: bi('Нажмите на любой блок или провод, и появится карточка с его объяснением.', 'Press any block or wire — it explains itself.'),
  result: bi('Что показал прогон', 'What the run showed'),
  layerOff: bi('слой выключен', 'layer is off'),
};

function blockShape(c: Comp, w: number): SVGElement {
  const fam = c.layer === 'client' ? 'var(--c-user-line)' : `var(--c-${layerOf(c.layer).family})`;
  const fill = `color-mix(in oklch, ${fam} 12%, var(--surface))`;
  if (c.layer === 'cp') {
    const k = 12;
    const d = `M${k},0 H${w - k} L${w},${H / 2} L${w - k},${H} H${k} L0,${H / 2} Z`;
    return s('path', { d, fill, stroke: fam });
  }
  return s('rect', { width: w, height: H, rx: c.layer === 'client' ? 6 : c.addon ? 10 : 4, fill, stroke: fam });
}

function placeWireLabels(labels: { text: SVGTextElement; a: { x: number; y: number }; b: { x: number; y: number } }[], placed: Comp[], fixed: Box[], vw: number): void {
  if (!labels.length || typeof labels[0].text.getComputedTextLength !== 'function' || !labels[0].text.isConnected) return;
  const blocks: Box[] = placed.map((c) => ({ x: c.x - 2, y: c.y - 2, w: widthOf(c) + 4, h: H + 4 }));
  const lines = labels.map((l) => [[l.a.x, l.a.y], [l.b.x, l.b.y]] as [[number, number], [number, number]]);
  const taken: Box[] = [];
  const order = [...labels].sort((p, q) => Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) - Math.hypot(q.a.x - q.b.x, q.a.y - q.b.y));
  for (const l of order) {
    const w = l.text.getComputedTextLength() + 6;
    if (!w) return;
    const box = placeLabel([[l.a.x, l.a.y], [l.b.x, l.b.y]], 0.5, w, 13, [...blocks, ...fixed, ...taken], lines);
    box.x = Math.max(4, Math.min(vw - 4 - box.w, box.x));
    taken.push(box);
    l.text.setAttribute('x', (box.x + box.w / 2).toFixed(1));
    l.text.setAttribute('y', (box.y + box.h / 2 + 3.5).toFixed(1));
  }
}

interface Props {
  preset?: 'empty' | 'full';
  /** 'core' (default): control plane, node, network; 'all': every layer with the add-ons. */
  layers?: 'core' | 'all' | LayerId[];
}

const TRUNK_X = 880;

function mountConstructor(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = (props ?? {}) as Props;
  const layers: LayerId[] = p.layers === 'all' ? ALL_LAYERS : Array.isArray(p.layers) ? p.layers : CORE_LAYERS;
  const extended = layers.some((l) => !CORE_LAYERS.includes(l));
  const comps = COMPONENTS.filter((c) => c.layer === 'client' || layers.includes(c.layer));
  const scenarios = SCENARIOS.filter((sc) => scenarioLayers(sc).every((l) => layers.includes(l)) && (extended || sc.id !== 'netpol'));
  const st: CanvasState = { placed: ['kubectl'], wires: [], off: [], cni: extended ? 'calico' : 'k3s' };
  const fullState = () => {
    st.placed = comps.map((c) => c.id);
    st.wires = WIRES.map((w) => key(w.a, w.b));
    st.off = [];
  };
  if (p.preset === 'full') fullState();
  let selected: string | null = null;
  let disposed = false;
  let fullOk = false;
  let brokenRun = false;
  const radioName = `kc-cni-${Math.random().toString(36).slice(2, 8)}`;
  const VW = 900;
  const VH = extended ? 736 : 450;

  const isOff = (id: string) => {
    const c = comp(id);
    return c.layer !== 'client' && (st.off ?? []).includes(c.layer);
  };
  const cniLabel = () => (extended ? `CNI: ${CNI_VARIANTS.find((v) => v.id === st.cni)?.label ?? 'flannel'}` : 'CNI (flannel)');
  const labelOf = (c: Comp) => (c.id === 'cni' ? cniLabel() : c.label);

  const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': t(bi('Холст конструктора', 'Constructor canvas')) }) as SVGSVGElement;
  const canvas = h('div.kc-canvas', {}, svg);
  const card = h('div.kc-card', { 'aria-live': 'polite' }, h('p.kx-note', {}, t(L.pick)));
  const why = h('p.kc-why', { 'aria-live': 'polite' });
  const out = h('pre.kx-pre', { 'aria-live': 'polite' });
  const result = h('div.kc-result', { 'aria-live': 'polite' });
  const verdict = h('div.kc-verdict');
  const runBtns = h('div.kc-runs');
  const palette = h('div.kc-palette');

  const zoneOf = (y: number): Zone => (y < 215 ? 'cp' : y < 450 || !extended ? 'node' : 'addon');

  const renderPalette = () => {
    clear(palette);
    for (const layer of LAYERS.filter((l) => layers.includes(l.id))) {
      const members = comps.filter((c) => c.layer === layer.id);
      const anyPlaced = members.some((c) => st.placed.includes(c.id));
      const on = anyPlaced && !(st.off ?? []).includes(layer.id);
      const chip = h(
        'button.kc-layer',
        {
          type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          style: `--fam: var(--c-${layer.family})`,
          title: t(layer.what),
          onclick: () => toggleLayer(layer.id),
        },
        h('span.sw', { 'aria-hidden': 'true' }),
        h('span', {}, t(layer.label)),
      );
      const items = h('div.kc-items');
      for (const c of members) {
        const placed = st.placed.includes(c.id);
        const item = h(
          'button.kc-item',
          { type: 'button', 'aria-pressed': placed ? 'true' : 'false', style: `--fam: var(--c-${layer.family})`, 'data-id': c.id },
          h('span.sw', { 'aria-hidden': 'true' }),
          h('span', {}, labelOf(c)),
          h('small', {}, t(c.sub)),
        );
        item.addEventListener('pointerdown', (e) => startDrag(e as PointerEvent, c));
        item.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
            e.preventDefault();
            if (placed) showCard(c.id);
            else place(c);
          }
        });
        items.append(item);
      }
      palette.append(h('div.kc-group', { style: `--fam: var(--c-${layer.family})` }, chip, items));
    }
  };

  const toggleLayer = (id: LayerId) => {
    const members = comps.filter((c) => c.layer === id);
    const off = new Set(st.off ?? []);
    if (!members.some((c) => st.placed.includes(c.id))) {
      // Nothing of the layer is on the canvas: put all of it, with its wires.
      for (const c of members) st.placed.push(c.id);
      for (const w of WIRES) if (st.placed.includes(w.a) && st.placed.includes(w.b) && !st.wires.includes(key(w.a, w.b)) && (members.some((c) => c.id === w.a || c.id === w.b))) st.wires.push(key(w.a, w.b));
      off.delete(id);
    } else if (off.has(id)) off.delete(id);
    else off.add(id);
    st.off = [...off];
    render();
  };

  const place = (c: Comp) => {
    if (st.placed.includes(c.id)) return;
    st.placed.push(c.id);
    st.off = (st.off ?? []).filter((l) => l !== c.layer);
    showCard(c.id);
    render();
  };

  // Drag from the palette: a ghost follows the pointer; dropping on the right zone places the block.
  const startDrag = (e: PointerEvent, c: Comp) => {
    if (st.placed.includes(c.id)) {
      showCard(c.id);
      return;
    }
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const ghost = h('div.kc-item.kc-ghost', { style: `position:fixed;left:${startX}px;top:${startY}px;z-index:50;--fam: var(--c-${c.layer === 'client' ? 'user' : layerOf(c.layer).family})` }, h('span.sw'), h('span', {}, labelOf(c)));
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 6 && !moved) {
        moved = true;
        document.body.append(ghost);
      }
      if (moved) {
        ghost.style.left = `${ev.clientX - 40}px`;
        ghost.style.top = `${ev.clientY - 16}px`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      if (!moved) {
        place(c);
        return;
      }
      const r = svg.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
      const y = ((ev.clientY - r.top) / r.height) * VH;
      const z = zoneOf(y);
      const want = zoneOfComp(c);
      if (z !== want) {
        why.textContent =
          t(L.wrongZone) +
          (want === 'cp'
            ? t(bi('управляющий слой, потому что этот компонент управляет всем кластером, а не одним узлом.', 'the control plane — it runs the whole cluster, not one node.'))
            : want === 'node'
              ? t(bi('узлы, потому что этот компонент работает на каждом узле и отвечает за его поды и правила.', 'the nodes — it runs on every node and looks after its pods and rules.'))
              : t(bi('дополнения, потому что этот компонент ставят поверх готового кластера, и он работает подами.', 'the add-ons — it is installed on top of a working cluster and runs as pods.')));
        return;
      }
      why.textContent = '';
      place(c);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const resetCard = () => {
    clear(card);
    card.append(h('p.kx-note', {}, t(L.pick)));
  };

  const showCard = (id: string) => {
    clear(card);
    const c = COMPONENTS.find((x) => x.id === id);
    if (c) {
      const layer = c.layer === 'client' ? undefined : layerOf(c.layer);
      card.append(
        h('h5', {}, labelOf(c), layer ? h('span.kc-tag', { style: `--fam: var(--c-${layer.family})` }, t(layer.label)) : ''),
        h('p', {}, t(c.what)),
        h('p', {}, h('strong', {}, `${t(L.who)}. `), t(c.who)),
        h('p', {}, h('strong', {}, `${t(L.talks)}. `), t(c.talks)),
        h('p', {}, h('strong', {}, `${t(L.hands)}. `), t(c.hands)),
        h('p', {}, h('strong', {}, `${t(L.see)}: `), h('code', {}, c.see)),
        h('p', {}, h('strong', {}, `${t(L.without)}. `), t(c.without)),
        h('p', {}, h('a', { href: c.doc, target: '_blank', rel: 'noopener' }, c.docLabel)),
      );
      if (c.id === 'cni' && extended) {
        const box = h('fieldset.kc-variants', {}, h('legend', {}, t(L.variant)));
        for (const v of CNI_VARIANTS) {
          const input = h('input', { type: 'radio', name: radioName, value: v.id, checked: st.cni === v.id ? true : undefined }) as HTMLInputElement;
          input.addEventListener('change', () => {
            st.cni = v.id as CniVariant;
            render();
            showCard('cni');
          });
          box.append(h('label', {}, input, h('span', {}, h('strong', {}, v.label), ' ', t(v.what))));
        }
        card.append(box);
      }
      if (c.layer !== 'client' && st.placed.includes(c.id))
        card.append(
          h(
            'button.btn.ghost.small',
            {
              type: 'button',
              onclick: () => {
                st.placed = st.placed.filter((x) => x !== c.id);
                st.wires = st.wires.filter((w) => !w.split('|').includes(c.id));
                selected = null;
                resetCard();
                render();
              },
            },
            t(L.remove),
          ),
        );
      return;
    }
    const w = WIRES.find((x) => key(x.a, x.b) === id);
    if (w) {
      card.append(
        h('h5', {}, h('code', {}, w.label)),
        h('p', {}, t(w.what)),
        h(
          'button.btn.ghost.small',
          {
            type: 'button',
            onclick: () => {
              st.wires = st.wires.filter((x) => x !== id);
              resetCard();
              render();
            },
          },
          t(L.removeWire),
        ),
      );
      return;
    }
    const d = DATA_LINKS.find((x) => `data:${key(x.a, x.b)}` === id);
    if (d) {
      card.append(h('h5', {}, `${comp(d.a).label} → ${comp(d.b).label}`), h('p', {}, t(d.what)));
      return;
    }
    if (id === 'bus') card.append(h('h5', {}, t(L.bus)), h('p', {}, t(API_BUS)));
  };

  const center = (c: Comp) => ({ x: c.x + widthOf(c) / 2, y: c.y + H / 2 });

  const pressBlock = (id: string) => {
    showCard(id);
    const c = comp(id);
    if (c.addon) {
      selected = null;
      render();
      return;
    }
    if (selected && selected !== id) {
      const w = wireOf(selected, id);
      if (w) {
        if (!st.wires.includes(key(selected, id))) st.wires.push(key(selected, id));
        why.textContent = '';
        flash = key(selected, id);
      } else {
        badWire = { a: selected, b: id };
        why.textContent = t(whyNot(selected, id));
      }
      selected = null;
    } else selected = selected === id ? null : id;
    render();
  };

  let flash: string | null = null;
  let badWire: { a: string; b: string } | null = null;

  const clickable = (el: SVGElement, id: string, label: string) => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    el.addEventListener('click', () => showCard(id));
    el.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && showCard(id));
  };

  const renderBus = (placed: Comp[]) => {
    const api = placed.filter((c) => c.addon && c.api);
    if (!api.length) return;
    const apiOn = st.placed.includes('apiserver') && !isOff('apiserver');
    const anyLive = api.some((c) => !isOff(c.id));
    const ap = comp('apiserver');
    const g = s(`g.kc-bus${apiOn && anyLive ? '' : '.off'}`);
    const rows = [...new Set(api.map((c) => c.y))];
    const lowest = Math.max(...rows) - 22;
    g.append(s('path.kc-wire', { d: `M${ap.x + widthOf(ap) / 2},${ap.y + H} V112 H${TRUNK_X} V${lowest}` }));
    for (const y of rows) {
      const left = Math.min(...api.filter((c) => c.y === y).map((c) => c.x + widthOf(c) - 18));
      g.append(s('path.kc-wire', { d: `M${left},${y - 22} H${TRUNK_X}` }));
    }
    const label = s('text.kc-wlabel', { x: TRUNK_X - 6, y: ROW_A - 28, 'text-anchor': 'end' }, t(L.bus));
    g.append(label);
    clickable(g, 'bus', t(L.bus));
    svg.append(g);
    for (const c of api) {
      const x = c.x + widthOf(c) - 18;
      svg.append(s(`line.kc-wire.kc-stub${isOff(c.id) || !apiOn ? '.off' : ''}`, { x1: x, y1: c.y - 22, x2: x, y2: c.y }));
    }
  };

  const renderDataLinks = () => {
    for (const d of DATA_LINKS) {
      if (!st.placed.includes(d.a) || !st.placed.includes(d.b) || !comps.some((c) => c.id === d.a)) continue;
      const a = comp(d.a);
      const b = comp(d.b);
      const ax = a.x + widthOf(a) / 2;
      const bx = b.x + widthOf(b) / 2;
      const y = a.y + H;
      const dip = y + 18;
      const off = isOff(d.a) || isOff(d.b);
      const g = s(`g.kc-data${off ? '.off' : ''}`);
      g.append(s('path.kc-wire.data', { d: `M${ax},${y} C${ax},${dip + 6} ${bx},${dip + 6} ${bx},${y + 2}`, 'marker-end': 'url(#kc-arrow)' }), s('text.kc-wlabel', { x: (ax + bx) / 2, y: dip + 16, 'text-anchor': 'middle' }, t(d.label)));
      clickable(g, `data:${key(d.a, d.b)}`, `${a.label} → ${b.label}`);
      svg.append(g);
    }
  };

  const render = () => {
    clear(svg);
    svg.append(
      s('defs', {}, s('marker', { id: 'kc-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 z', class: 'kc-arrowhead' }))),
      s('rect.kc-zone', { x: 190, y: 16, width: 676, height: 190, rx: 10 }),
      s('text.kc-zone-label', { x: 206, y: 36 }, t(L.cp)),
      s('rect.kc-zone', { x: 14, y: 236, width: 852, height: 200, rx: 10 }),
      s('text.kc-zone-label', { x: 30, y: 256 }, t(L.nodes)),
    );
    if (extended) {
      svg.append(s('rect.kc-zone', { x: 14, y: 452, width: 852, height: 276, rx: 10 }), s('text.kc-zone-label', { x: 30, y: 472 }, t(L.addons)));
    }
    const placed = comps.filter((c) => st.placed.includes(c.id));
    if (extended) {
      renderBus(placed);
      renderDataLinks();
      // Layer captions over each group of add-ons.
      for (const layer of LAYERS.filter((l) => layers.includes(l.id) && !CORE_LAYERS.includes(l.id))) {
        const members = COMPONENTS.filter((c) => c.layer === layer.id);
        const x = Math.min(...members.map((c) => c.x));
        const y = members[0].y;
        svg.append(s(`text.kc-caption${(st.off ?? []).includes(layer.id) ? '.off' : ''}`, { x, y: y - 6, style: `--fam: var(--c-${layer.family})` }, t(layer.label)));
      }
    }
    const labels: { text: SVGTextElement; a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    for (const k of st.wires) {
      const [a, b] = k.split('|');
      const ca = comp(a);
      const cb = comp(b);
      const pa = center(ca);
      const pb = center(cb);
      const w = WIRES.find((x) => key(x.a, x.b) === k)!;
      const off = isOff(a) || isOff(b);
      const g = s(`g${off ? '.kc-off' : ''}`);
      clickable(g, k, w.label);
      g.append(s(`line.kc-wire${flash === k ? '.flash' : ''}`, { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }));
      const label = s(`text.kc-wlabel${off ? '.off' : ''}`, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 4, 'text-anchor': 'middle' }, w.label) as SVGTextElement;
      label.addEventListener('click', () => showCard(k));
      labels.push({ text: label, a: pa, b: pb });
      svg.append(g);
    }
    if (badWire) {
      const pa = center(comp(badWire.a));
      const pb = center(comp(badWire.b));
      svg.append(s('line.kc-wire.bad', { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }), s('text.kc-wlabel.bad', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 4, 'text-anchor': 'middle' }, t(bi('нет такой связи', 'no such link'))));
      badWire = null;
    }
    for (const c of placed) {
      const w = widthOf(c);
      const off = isOff(c.id);
      const g = s(`g.kc-block${selected === c.id ? '.sel' : ''}${off ? '.off' : ''}`, { transform: `translate(${c.x},${c.y})`, tabindex: 0, role: 'button', 'aria-label': `${labelOf(c)}: ${t(c.sub)}${off ? ` (${t(L.layerOff)})` : ''}` });
      g.append(blockShape(c, w), s('text', { x: w / 2, y: 22, 'text-anchor': 'middle' }, labelOf(c)), s('text.sub', { x: w / 2, y: 39, 'text-anchor': 'middle' }, t(c.sub)));
      g.addEventListener('click', () => pressBlock(c.id));
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          pressBlock(c.id);
        }
      });
      svg.append(g);
    }
    // Wire labels go on top of the blocks, each where it covers no block, no other label and no other wire.
    for (const l of labels) svg.append(l.text);
    // Zone captions are obstacles too, so a wire label never covers them.
    const zoneLabels: Box[] = [...svg.querySelectorAll('text.kc-zone-label')].map((el) => {
      const t = el as SVGTextElement;
      const w = typeof t.getComputedTextLength === 'function' && t.isConnected ? t.getComputedTextLength() : 0;
      return { x: Number(t.getAttribute('x')) - 2, y: Number(t.getAttribute('y')) - 13, w: w + 4, h: 17 };
    });
    placeWireLabels(labels, placed, zoneLabels, VW);
    flash = null;
    renderPalette();
    renderVerdict();
  };

  const renderVerdict = () => {
    clear(verdict);
    const r = componentsFrom(st, layers);
    if (!r.missing.length) verdict.append(t(L.verdictOk));
    else {
      verdict.append(t(L.verdictMissing), r.missing.map((id) => labelOf(comp(id))).join(', '), '.');
      const first = comp(r.missing[0]);
      verdict.append(h('br'), h('span.kx-note', {}, `${labelOf(first)}. ${t(first.without)}`));
    }
    if (!r.kubectl) verdict.append(h('br'), h('span.kx-note', {}, t(comp('kubectl').cause)));
  };

  const run = async (sc: Scenario) => {
    for (const b of runBtns.querySelectorAll('button')) (b as HTMLButtonElement).disabled = true;
    clear(result);
    out.textContent = t(L.running);
    const res = await runScenario(st, sc, layers, undefined, () => !disposed);
    if (!res || disposed) return;
    out.textContent = res.text;
    clear(result);
    result.append(h('h5', {}, `${t(L.result)}: ${t(sc.label)}`));
    if (sc.note) result.append(h('p.kx-note', {}, t(sc.note)));
    for (const e of res.explain) result.append(h('p', {}, t(e)));
    result.dataset.ok = res.explain[0] === sc.ok ? 'true' : 'false';
    for (const b of runBtns.querySelectorAll('button')) (b as HTMLButtonElement).disabled = false;
    const broken = res.explain[0] !== sc.ok;
    if (!broken && !res.built.missing.length) fullOk = true;
    else if (broken) brokenRun = true;
    ctx.record({ kind: 'x.k8s.constructor.run', scenario: sc.id, missing: res.built.missing, broken });
    if (fullOk && brokenRun) ctx.complete();
  };

  for (const sc of scenarios) {
    const fam = layerOf(sc.layer).family;
    runBtns.append(h('button.btn.small.kc-run', { type: 'button', style: `--fam: var(--c-${fam})`, onclick: () => void run(sc) }, h('span.sw', { 'aria-hidden': 'true' }), t(sc.label)));
  }

  const tools = h(
    'div.kx-row',
    {},
    h(
      'button.btn.ghost.small',
      {
        type: 'button',
        onclick: () => {
          fullState();
          render();
        },
      },
      t(L.full),
    ),
    h(
      'button.btn.ghost.small',
      {
        type: 'button',
        onclick: () => {
          st.placed = ['kubectl'];
          st.wires = [];
          st.off = [];
          resetCard();
          render();
        },
      },
      t(L.clearAll),
    ),
  );

  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('div.kc.kc-layered', {}, h('div.kc-legend', {}, h('h4.kx-h', {}, t(L.legend)), h('p.kx-note', {}, t(extended ? L.legendHint : L.legendHintCore)), palette), canvas, why, tools, card),
      h('h4.kx-h', {}, t(L.run)),
      runBtns,
      verdict,
      result,
      out,
    ),
  );
  render();
  // The section may mount before it is in the document: lay the labels out again once it is.
  if (st.wires.length && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => !disposed && render());

  return {
    dispose() {
      disposed = true;
    },
    describe: () => {
      const r = componentsFrom(st, layers);
      return `Kubernetes constructor: layers ${layers.join(', ')}; off ${(st.off ?? []).join(', ') || 'none'}; CNI ${st.cni}; placed ${st.placed.join(', ')}; wires ${st.wires.join(', ') || 'none'}; switched off: ${r.missing.join(', ') || 'nothing'}`;
    },
  };
}

export const constructorWidget: WidgetReg = { id: 'k8s.constructor', mount: mountConstructor };

export { ROW_A, ROW_B };
