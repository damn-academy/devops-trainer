// The multi-machine lab (design 09 §1.7, R11): two or three real Linux
// machines in this tab, each in its own worker, wired to dt-switch. The
// diagram is drawn from the switch's real decisions: every frame the kernels
// send moves along the cables, the MAC table fills as the switch learns, and
// the learner can turn the switch into a hub or pull a cable and watch the
// traffic change. Route: #/lab/multinode.

import { calm, clear, h, icon, s } from '../../core/dom';
import { bi, fmt, t, type Bi } from '../../core/i18n';
import { prose } from '../../app/common';
import type { Mounted, WidgetCtx } from '../../core/types';
import { downloadBytes, formatMB, loadManifest } from './assets';
import { tabMemoryMB } from './component';
import type { ConsoleHandle } from './console';
import { connectMachine, nodeMac } from './fabric';
import type { V86Machine } from './machine';
import { L2Switch, type FrameInfo, type SwitchEvent } from './switch';
import './v86.css';

interface Card {
  title: Bi | string;
  what: Bi;
  who: Bi;
  see?: string;
}

const T = {
  title: bi('Несколько машин и коммутатор', 'Several machines and a switch'),
  lede: bi(
    'В этой вкладке работают настоящие машины Linux, каждая в своём потоке браузера. Их сетевые карты подключены к коммутатору тренажёра: он, как настоящий, запоминает, за каким портом какой MAC-адрес, и пересылает кадр только туда, где сидит получатель. Отправь `ping` с одной машины на другую и смотри, как идут кадры.',
    'Real Linux machines run in this tab, each in its own browser thread. Their network cards are plugged into the trainer’s switch: like a real one, it remembers which MAC address sits behind which port and forwards a frame only where the receiver is. Send a `ping` from one machine to another and watch the frames go.',
  ),
  machines: bi('Машин', 'Machines'),
  start: bi('Запустить лабораторию', 'Start the lab'),
  cost: bi('≈ {mb} МБ загрузки один раз, ≈ {ram} МБ памяти вкладки', '≈ {mb} MB to download once, ≈ {ram} MB of tab memory'),
  missing: bi('В этой сборке нет файлов настоящей машины (`npm run fetch:v86`).', 'This build has no files for the real machine (`npm run fetch:v86`).'),
  booting: bi('Машины запускаются…', 'The machines are starting…'),
  ready: bi('Все машины работают · {s} с', 'All machines are running · {s} s'),
  hub: bi('Концентратор вместо коммутатора', 'A hub instead of a switch'),
  aging: bi('Время жизни записи MAC', 'MAC entry lifetime'),
  clear: bi('Очистить таблицу MAC', 'Clear the MAC table'),
  table: bi('Таблица MAC коммутатора', 'The switch’s MAC table'),
  tableEmpty: bi('Пусто: коммутатор ещё не видел ни одного кадра. Отправь ping.', 'Empty: the switch has not seen a frame yet. Send a ping.'),
  frames: bi('Последние кадры', 'Last frames'),
  framesEmpty: bi('Кадров пока не было.', 'No frames yet.'),
  unplug: bi('Выдернуть кабель {n}', 'Unplug the cable of {n}'),
  unplugged: bi('кабель отключён', 'cable unplugged'),
  predict: bi('Что будет?', 'What will happen?'),
  try: bi('Попробуй', 'Try'),
  card: bi('Нажми на любой элемент схемы — здесь появится, что это и как на него посмотреть.', 'Click any element of the diagram: what it is and how to look at it will appear here.'),
  cardWhat: bi('Что это', 'What it is'),
  cardWho: bi('Кто создаёт и меняет', 'Who creates and changes it'),
  cardSee: bi('Как посмотреть', 'How to look'),
  honest: bi(
    'Это настоящие ядра и настоящие кадры Ethernet; сам коммутатор — программа на странице. Интернета у машин нет: их сеть — 10.0.0.0/24 внутри вкладки.',
    'These are real kernels and real Ethernet frames; the switch itself is a program in the page. The machines have no internet: their network is 10.0.0.0/24 inside the tab.',
  ),
};

const HOW: Record<string, Bi> = {
  forward: bi('переслан в один порт', 'forwarded to one port'),
  flood: bi('разослан во все порты', 'flooded to every port'),
  filter: bi('отброшен: получатель за тем же портом', 'filtered: the receiver is behind the same port'),
  drop: bi('отброшен', 'dropped'),
  hub: bi('концентратор: копия во все порты', 'hub: a copy to every port'),
};

interface Node {
  id: string;
  ip: string;
  mac: string;
  machine: V86Machine | null;
  con: ConsoleHandle | null;
  up: boolean;
}

export function describeFrame(f: FrameInfo): Bi {
  if (f.arp) {
    if (f.arp.op === 'request') return bi(`ARP: у кого ${f.arp.targetIp}? Сообщи ${f.arp.senderIp}`, `ARP: who has ${f.arp.targetIp}? Tell ${f.arp.senderIp}`);
    if (f.arp.op === 'reply') return bi(`ARP: ${f.arp.senderIp} — это ${f.arp.senderMac}`, `ARP: ${f.arp.senderIp} is at ${f.arp.senderMac}`);
  }
  if (f.ip?.icmp) {
    const kind = f.ip.icmp.type === 8 ? bi('эхо-запрос', 'echo request') : f.ip.icmp.type === 0 ? bi('эхо-ответ', 'echo reply') : bi(`тип ${f.ip.icmp.type}`, `type ${f.ip.icmp.type}`);
    return bi(`ICMP ${kind.ru}: ${f.ip.src} → ${f.ip.dst}`, `ICMP ${kind.en}: ${f.ip.src} → ${f.ip.dst}`);
  }
  if (f.ip) return bi(`IPv4 протокол ${f.ip.proto}: ${f.ip.src} → ${f.ip.dst}`, `IPv4 protocol ${f.ip.proto}: ${f.ip.src} → ${f.ip.dst}`);
  if (f.kind === 'ipv6') return bi('IPv6 (ядро объявляет себя соседям)', 'IPv6 (the kernel announces itself to neighbours)');
  return bi(`кадр, ethertype 0x${f.ethertype.toString(16)}`, `frame, ethertype 0x${f.ethertype.toString(16)}`);
}

/** The "what changed and why" line after a knob or a break, from the next real frame. */
export function deltaLine(ev: Extract<SwitchEvent, { t: 'l2.frame' }>, ports: number): Bi {
  if (ev.how === 'hub') return fmt(bi('Концентратор не смотрит на адреса: кадр от {in} получили все {n} других порта.', 'A hub does not look at addresses: the frame from {in} reached all {n} other ports.'), { in: ev.in, n: ev.out.length });
  if (ev.how === 'forward') return fmt(bi('Коммутатор знает, где {dst}: кадр ушёл только в порт {out}, остальные {n} его не видят.', 'The switch knows where {dst} is: the frame went only to port {out}; the other {n} never see it.'), { dst: ev.info.dst, out: ev.out[0], n: ports - 2 });
  if (ev.how === 'flood') return fmt(bi('Адреса {dst} в таблице нет (или это широковещание): кадр разослан во все порты, кроме входящего.', '{dst} is not in the table (or it is a broadcast): the frame was flooded to every port except the one it came from.'), { dst: ev.info.dst });
  if (ev.how === 'drop') return fmt(bi('Кадр с порта {in} отброшен: {why}.', 'The frame from port {in} was dropped: {why}.'), { in: ev.in, why: ev.reason ?? '' });
  return bi('Получатель за тем же портом — кадр дальше не идёт.', 'The receiver is behind the same port: the frame goes no further.');
}

export function mountMultiNode(root: HTMLElement, _props: unknown = {}, ctx?: WidgetCtx): Mounted {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  let count = typeof dm === 'number' && dm >= 8 ? 3 : 2;
  const sw = new L2Switch({ agingMs: 300_000 });
  let nodes: Node[] = [];
  let disposed = false;
  let started = false;
  const predicted = new Set<string>();
  /** Set by a knob or a break: the next real frame completes the "what changed and why" line. */
  let pendingDelta: string | null = null;
  const log: { info: FrameInfo; how: string; in: string; out: string[]; at: number }[] = [];
  const timers: number[] = [];

  const svgHost = h('div.mn-diagram');
  const cardBox = h('div.mn-card', { 'aria-live': 'polite' }, h('p.muted.small', {}, t(T.card)));
  const delta = h('p.mn-delta', { 'aria-live': 'polite' });
  const tableBox = h('div.mn-table');
  const logBox = h('ol.mn-log');
  const consoles = h('div.mn-consoles');
  const controls = h('div.mn-controls');
  const status = h('p.mn-status.small.muted', { 'aria-live': 'polite' });
  const offer = h('div.v86-offer');

  const el = h(
    'div.mn',
    {},
    h('h1', {}, t(T.title)),
    prose(T.lede),
    h('p.v86-honest.small.muted', {}, icon('warn'), h('span', {}, t(T.honest))),
    offer,
    h('div.mn-grid', {}, h('div.mn-left', {}, svgHost, delta, controls, cardBox), h('div.mn-right', {}, h('h4.lab-h', {}, t(T.table)), tableBox, h('h4.lab-h', {}, t(T.frames)), logBox)),
    status,
    consoles,
  );
  clear(root);
  root.append(el);

  const showCard = (c: Card) => {
    clear(cardBox);
    cardBox.append(
      h('h4', {}, t(c.title)),
      h('dl', {}, h('dt', {}, t(T.cardWhat)), h('dd', {}, t(c.what)), h('dt', {}, t(T.cardWho)), h('dd', {}, t(c.who)), c.see ? h('dt', {}, t(T.cardSee)) : null, c.see ? h('dd', {}, h('code', {}, c.see)) : null),
    );
  };

  // ── the diagram ──
  const W = 720;
  const H = 250;
  const swBox = { x: 240, y: 20, w: 240, h: 56 };
  const nodeX = (i: number) => (count === 2 ? [150, 570][i] : [120, 360, 600][i]);
  const nodeY = 180;
  const edgeEls = new Map<string, SVGElement>();
  const labelEls = new Map<string, SVGElement>();
  let tokenLayer: SVGElement | null = null;

  const portXY = (i: number) => ({ x: swBox.x + ((i + 1) * swBox.w) / (count + 1), y: swBox.y + swBox.h });

  const drawDiagram = () => {
    clear(svgHost);
    edgeEls.clear();
    labelEls.clear();
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mn-svg', role: 'img', 'aria-label': t(T.title) });
    const swG = s('g.mn-el.fam-l2', { tabindex: 0, role: 'button' });
    swG.append(s('rect.mn-switch', { x: swBox.x, y: swBox.y, width: swBox.w, height: swBox.h, rx: 8 }), s('text.mn-label', { x: W / 2, y: swBox.y + 24, 'text-anchor': 'middle' }, sw.hub ? 'hub' : 'dt-switch'), s('text.mn-sub', { x: W / 2, y: swBox.y + 42, 'text-anchor': 'middle' }, sw.hub ? t(bi('без таблицы MAC', 'no MAC table')) : `${sw.table().length} MAC · ${Math.round(sw.agingMs / 1000)} s`));
    const swCard: Card = sw.hub
      ? { title: 'hub', what: bi('Концентратор повторяет каждый кадр во все порты, не глядя на адреса. Так работали сети на общей шине.', 'A hub repeats every frame to every port without looking at addresses. That is how shared-bus networks worked.'), who: bi('Ты включил режим концентратора тумблером ниже.', 'You switched the hub mode on with the toggle below.') }
      : { title: 'dt-switch', what: bi('Коммутатор второго уровня: учит, какой MAC за каким портом, и пересылает кадр только получателю; широковещательные и незнакомые кадры рассылает всем.', 'A layer-2 switch: it learns which MAC is behind which port and forwards a frame only to the receiver; broadcast and unknown frames go to everyone.'), who: bi('Тренажёр: программа на странице, через которую идут кадры настоящих сетевых карт.', 'The trainer: a program in the page that every frame of the real network cards passes through.'), see: 'bridge fdb show   # the same table on a Linux bridge' };
    swG.addEventListener('click', () => showCard(swCard));
    swG.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && showCard(swCard));
    svg.append(swG);
    nodes.forEach((n, i) => {
      const p = portXY(i);
      const x = nodeX(i);
      const path = `M${x} ${nodeY} L${x} ${nodeY - 34} L${p.x} ${p.y + 26} L${p.x} ${p.y}`;
      const edge = s('path.mn-edge', { d: path, id: `mn-edge-${n.id}`, class: n.up ? '' : 'down' });
      const c = sw.counters(n.id);
      // The label sits on the vertical leg of its own cable, so labels of neighbouring cables never meet.
      const label = s('text.mn-edge-label', { x, y: nodeY - 14, 'text-anchor': 'middle' }, n.up ? `${n.id} · rx ${c?.rx ?? 0} · tx ${c?.tx ?? 0}` : t(T.unplugged));
      const eg = s('g.mn-el', { tabindex: 0, role: 'button' }, s('path.mn-hit', { d: path }), edge, label);
      const edgeCard: Card = {
        title: fmt(bi('Кабель {n} — порт {n}', 'Cable {n} — port {n}'), { n: n.id }),
        what: bi('Соединение сетевой карты машины с портом коммутатора. rx — сколько кадров порт принял от машины, tx — сколько отдал ей.', 'The link from the machine’s network card to a switch port. rx is how many frames the port took from the machine, tx how many it gave to it.'),
        who: bi('Тренажёр соединил порт при запуске; кнопкой «выдернуть кабель» его можно отключить.', 'The trainer plugged it in at start; the “unplug” button disconnects it.'),
        see: 'ip -s link show eth0',
      };
      eg.addEventListener('click', () => showCard(edgeCard));
      svg.append(eg);
      edgeEls.set(n.id, edge);
      labelEls.set(n.id, label);
      const ng = s('g.mn-el.fam-node', { tabindex: 0, role: 'button' });
      ng.append(s('rect.mn-node', { x: x - 100, y: nodeY, width: 200, height: 62, rx: 8 }), s('text.mn-label', { x, y: nodeY + 22, 'text-anchor': 'middle' }, n.id), s('text.mn-sub', { x, y: nodeY + 40, 'text-anchor': 'middle' }, n.ip), s('text.mn-sub', { x, y: nodeY + 55, 'text-anchor': 'middle' }, n.mac));
      const nodeCard: Card = {
        title: n.id,
        what: bi(`Настоящая машина Linux (ядро i686 в эмуляторе v86). Её адрес ${n.ip}, MAC сетевой карты ${n.mac}.`, `A real Linux machine (an i686 kernel in the v86 emulator). Its address is ${n.ip}, the MAC of its network card is ${n.mac}.`),
        who: bi('Тренажёр запустил её в отдельном потоке браузера и выдал имя, адрес и MAC.', 'The trainer started it in its own browser thread and gave it a name, an address and a MAC.'),
        see: 'ip addr show eth0',
      };
      ng.addEventListener('click', () => showCard(nodeCard));
      svg.append(ng);
    });
    tokenLayer = s('g.mn-tokens');
    svg.append(tokenLayer);
    svgHost.append(svg);
  };

  // Moving dots: one per frame, rate-limited; in calm mode the cable only lights up.
  let lastAnim = 0;
  const animate = (ev: Extract<SwitchEvent, { t: 'l2.frame' }>) => {
    const now = performance.now();
    if (now - lastAnim < 90) return;
    lastAnim = now;
    const legs = [{ id: ev.in, reverse: false }, ...ev.out.map((id) => ({ id, reverse: true }))];
    legs.forEach((leg) => {
      const edge = edgeEls.get(leg.id) as SVGPathElement | undefined;
      if (!edge) return;
      if (calm() || !tokenLayer || typeof edge.getTotalLength !== 'function') {
        edge.classList.add('lit');
        timers.push(window.setTimeout(() => edge.classList.remove('lit'), 300));
        return;
      }
      const len = edge.getTotalLength();
      const dot = s('circle.mn-token', { r: 5, class: ev.info.arp ? 'arp' : ev.info.ip?.icmp ? 'icmp' : '' }) as SVGCircleElement;
      tokenLayer.append(dot);
      const t0 = now + (leg.reverse ? 260 : 0);
      const dur = 260;
      const step = (ts: number) => {
        const p = Math.min(1, Math.max(0, (ts - t0) / dur));
        const at = edge.getPointAtLength(leg.reverse ? len * p : len * (1 - p));
        dot.setAttribute('cx', String(at.x));
        dot.setAttribute('cy', String(at.y));
        if (p < 1 && !disposed) requestAnimationFrame(step);
        else dot.remove();
      };
      requestAnimationFrame(step);
    });
  };

  const renderTable = () => {
    clear(tableBox);
    if (sw.hub) return void tableBox.append(h('p.muted.small', {}, t(bi('Концентратор ничего не запоминает.', 'A hub remembers nothing.'))));
    const rows = sw.table();
    if (!rows.length) return void tableBox.append(h('p.muted.small', {}, t(T.tableEmpty)));
    const now = Date.now();
    tableBox.append(
      h(
        'table.mn-mac',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, 'MAC'), h('th', {}, t(bi('порт', 'port'))), h('th', {}, 'VLAN'), h('th', {}, t(bi('возраст', 'age'))))),
        h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, h('code', {}, r.mac)), h('td', {}, r.port), h('td', {}, String(r.vlan)), h('td', {}, `${Math.round((now - r.seen) / 1000)} s`)))),
      ),
    );
  };

  const renderLog = () => {
    clear(logBox);
    if (!log.length) return void logBox.append(h('li.muted.small', {}, t(T.framesEmpty)));
    for (const f of log.slice(-10).reverse())
      logBox.append(h('li', {}, h('span.mn-log-what', {}, t(describeFrame(f.info))), h('span.mn-log-how.small.muted', {}, `${f.in} → ${f.out.length ? f.out.join(', ') : '∅'} · ${t(HOW[f.how] ?? bi(f.how, f.how))}`)));
  };

  let redrawQueued = false;
  const queueRedraw = () => {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      for (const n of nodes) {
        const c = sw.counters(n.id);
        const l = labelEls.get(n.id);
        if (l) l.textContent = n.up ? `${n.id} · rx ${c?.rx ?? 0} · tx ${c?.tx ?? 0}` : t(T.unplugged);
      }
      const sub = svgHost.querySelector('.mn-switch ~ .mn-sub');
      if (sub) sub.textContent = sw.hub ? t(bi('без таблицы MAC', 'no MAC table')) : `${sw.table().length} MAC · ${Math.round(sw.agingMs / 1000)} s`;
      renderTable();
      renderLog();
    });
  };

  sw.on((ev) => {
    if (ev.t === 'l2.frame') {
      log.push({ info: ev.info, how: ev.how, in: ev.in, out: ev.out, at: ev.at });
      if (log.length > 200) log.splice(0, log.length - 200);
      animate(ev);
      if (pendingDelta !== null) {
        delta.textContent = `${pendingDelta}${pendingDelta ? ' ' : ''}${t(deltaLine(ev, nodes.length + 1))}`;
        pendingDelta = null;
      }
      ctx?.record({ kind: 'x.v86.frame', how: ev.how });
    }
    queueRedraw();
  });

  // ── knobs, breaks and predictions ──
  const ask = (id: string, q: Bi, options: { id: string; text: Bi }[], right: string, then: () => void) => {
    if (predicted.has(id)) return then();
    const box = h('div.mn-predict', { role: 'group', 'aria-label': t(T.predict) }, h('p', {}, h('strong', {}, t(T.predict)), ' ', t(q)));
    for (const o of options) {
      const b = h('button.btn.option.small', { type: 'button' }, t(o.text));
      b.addEventListener('click', () => {
        predicted.add(id);
        ctx?.record({ kind: 'x.v86.predict', about: id, choice: o.id, correct: o.id === right });
        box.replaceWith(h('p.mn-verdict.small', { class: o.id === right ? 'ok' : 'warn' }, h('span.st-icon', { 'aria-hidden': 'true' }, o.id === right ? '✓' : '!'), t(o.id === right ? bi('Верно — смотри на схему.', 'Right — watch the diagram.') : bi('Посмотри, что произошло на самом деле.', 'See what actually happened.'))));
        then();
      });
      box.append(b);
    }
    controls.prepend(box);
  };

  const renderControls = () => {
    clear(controls);
    const hub = h('input', { type: 'checkbox', role: 'switch', checked: sw.hub }) as HTMLInputElement;
    hub.addEventListener('change', () => {
      const want = hub.checked;
      hub.checked = sw.hub;
      ask(
        'hub',
        bi('Коммутатор станет концентратором. Что увидит ping между машинами?', 'The switch becomes a hub. What will ping between the machines see?'),
        [
          { id: 'stop', text: bi('ping перестанет отвечать', 'ping stops getting replies') },
          { id: 'all', text: bi('ping работает, но каждый кадр получают все машины', 'ping works, but every machine receives every frame') },
          { id: 'arp', text: bi('сломается только ARP', 'only ARP breaks') },
        ],
        'all',
        () => {
          sw.hub = want;
          hub.checked = want;
          pendingDelta = '';
          delta.textContent = t(want ? bi('Концентратор включён — следующий кадр покажет разницу.', 'The hub is on — the next frame will show the difference.') : bi('Снова коммутатор: таблица MAC учится заново.', 'A switch again: the MAC table learns anew.'));
          drawDiagram();
          queueRedraw();
        },
      );
    });
    const aging = h('input', { type: 'range', min: 10, max: 300, step: 10, value: Math.round(sw.agingMs / 1000) }) as HTMLInputElement;
    const agingVal = h('output.mn-mono', {}, `${aging.value} s`);
    aging.addEventListener('input', () => {
      sw.agingMs = Number(aging.value) * 1000;
      agingVal.textContent = `${aging.value} s`;
      delta.textContent = t(fmt(bi('Записи, которых коммутатор не видел {s} с, забываются; кадр к забытому адресу снова разошлётся всем.', 'Entries the switch has not seen for {s} s are forgotten; a frame to a forgotten address is flooded to everyone again.'), { s: aging.value }));
      queueRedraw();
    });
    const clearBtn = h('button.btn.ghost.small', { type: 'button' }, icon('repeat'), t(T.clear));
    clearBtn.addEventListener('click', () => {
      sw.flushTable();
      pendingDelta = '';
      delta.textContent = t(bi('Таблица пуста: следующий кадр коммутатор не знает куда отправить и разошлёт всем.', 'The table is empty: the switch does not know where the next frame goes and floods it to everyone.'));
      queueRedraw();
    });
    const breaks = nodes.map((n) => {
      const cb = h('input', { type: 'checkbox', checked: !n.up }) as HTMLInputElement;
      cb.addEventListener('change', () => {
        const down = cb.checked;
        cb.checked = !n.up;
        const other = nodes.find((x) => x !== n);
        ask(
          'unplug',
          bi(`Кабель ${n.id} выдернут. Что напишет ping с ${other?.id} на ${n.ip}?`, `The cable of ${n.id} is unplugged. What will ping from ${other?.id} to ${n.ip} print?`),
          [
            { id: 'cache', text: bi('ответы продолжатся: адрес уже в кеше ARP', 'replies continue: the address is already in the ARP cache') },
            { id: 'loss', text: bi('ответов не будет, ping покажет потерю пакетов', 'no replies; ping reports packet loss') },
            { id: 'error', text: bi('ping сразу завершится с ошибкой', 'ping fails immediately with an error') },
          ],
          'loss',
          () => {
            n.up = !down;
            cb.checked = down;
            sw.setPort(n.id, { up: n.up });
            delta.textContent = t(down ? fmt(bi('Порт {n} выключен: кадры к нему отбрасываются, а ARP-кеш соседей этого ещё не знает — ping ждёт ответа, которого не будет.', 'Port {n} is down: frames to it are dropped, and the neighbours’ ARP caches do not know that yet — ping waits for a reply that never comes.'), { n: n.id }) : fmt(bi('Кабель {n} снова на месте; коммутатор забыл адреса за этим портом и выучит их заново.', 'The cable of {n} is back; the switch forgot the addresses behind this port and will learn them again.'), { n: n.id }));
            pendingDelta = delta.textContent;
            drawDiagram();
            queueRedraw();
          },
        );
      });
      return h('label.break-toggle', {}, h('label.switch', {}, cb, h('span.switch-track', { 'aria-hidden': 'true' })), h('span', {}, t(fmt(T.unplug, { n: n.id }))));
    });
    controls.append(
      h('label.switch-row', {}, h('label.switch', {}, hub, h('span.switch-track', { 'aria-hidden': 'true' })), h('span', {}, t(T.hub))),
      h('label.mn-knob', {}, h('span.small', {}, t(T.aging)), aging, agingVal),
      h('div.row', {}, clearBtn),
      ...breaks,
    );
  };

  // ── start ──
  const start = async () => {
    if (started) return;
    started = true;
    offer.remove();
    status.textContent = t(T.booting);
    nodes = Array.from({ length: count }, (_, i) => ({ id: `node-${i + 1}`, ip: `10.0.0.${11 + i}`, mac: nodeMac(i + 1), machine: null, con: null, up: true }));
    drawDiagram();
    renderControls();
    queueRedraw();
    const [{ V86Machine }, { mountConsole }] = await Promise.all([import('./machine'), import('./console')]);
    if (disposed) return;
    const t0 = performance.now();
    await Promise.all(
      nodes.map(async (n, i) => {
        const box = h('div.lab-term-box.v86-term');
        const other = nodes[(i + 1) % nodes.length];
        const chips = [`ping -c 3 ${other.ip}`, 'ip neigh', 'ip addr show eth0'];
        const head = h('div.mn-con-head', {}, h('strong', {}, n.id), h('span.mn-mono.small.muted', {}, ` ${n.ip}/24 · ${n.mac}`));
        const chipRow = h('div.chips', { 'aria-label': t(T.try) }, ...chips.map((c) => h('button.chip.cmd', { type: 'button', onclick: () => n.con?.type(c) }, c)));
        consoles.append(h('section.mn-con', {}, head, box, chipRow));
        const m = new V86Machine({ id: n.id, identity: { hostname: n.id, ip: `${n.ip}/24`, mac: n.mac } });
        n.machine = m;
        connectMachine(sw, m, { mode: 'access', vlan: 1 }, n.id);
        n.con = await mountConsole(box, m, { rows: 12 });
        await m.start();
      }),
    ).then(
      () => {
        status.textContent = t(fmt(T.ready, { s: ((performance.now() - t0) / 1000).toFixed(1) }));
        ctx?.record({ kind: 'x.v86.multinode', machines: nodes.length, ms: Math.round(performance.now() - t0) });
        ctx?.complete();
      },
      (e: Error) => {
        status.textContent = `${t(bi('Не запустилось', 'Did not start'))}: ${e.message}`;
      },
    );
    timers.push(window.setInterval(queueRedraw, 1000));
  };

  const showOffer = async () => {
    const manifest = await loadManifest();
    if (disposed) return;
    clear(offer);
    if (!manifest) return void offer.append(prose(T.missing, 'muted small'));
    const mb = formatMB(downloadBytes(manifest));
    const seg = h('div.segmented', { role: 'radiogroup', 'aria-label': t(T.machines) });
    const costLine = h('span.small.muted');
    const update = () => (costLine.textContent = t(fmt(T.cost, { mb, ram: tabMemoryMB(32, count) })));
    for (const n of [2, 3]) {
      const r = h('input', { type: 'radio', name: 'mn-count', value: n, checked: n === count }) as HTMLInputElement;
      r.addEventListener('change', () => {
        count = n;
        update();
      });
      seg.append(h('label', {}, r, h('span', {}, String(n))));
    }
    update();
    const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(T.start));
    btn.addEventListener('click', () => void start());
    offer.append(h('div.v86-offer-row', {}, h('span.small', {}, t(T.machines)), seg, btn, costLine));
  };

  void showOffer();

  return {
    dispose() {
      disposed = true;
      timers.forEach((x) => (clearTimeout(x), clearInterval(x)));
      for (const n of nodes) {
        n.con?.dispose();
        n.machine?.dispose();
      }
    },
    describe: () =>
      `${t(T.title)}: ${nodes.length} machines, ${sw.hub ? 'hub' : 'switch'}, MAC table ${sw
        .table()
        .map((e) => `${e.mac}@${e.port}`)
        .join(', ')}`,
  };
}
