// Subnet calculator and drill (03 §10.1). The calculator shows the 32 bits
// with the mask as a moving border; every value is computed by the same IPv4
// arithmetic the simulator uses. The drill generates questions from a seed —
// no points, no streaks: a question, an answer, the bits that explain it.

import { clear, h } from '../../../core/dom';
import { bi, fmt, onLangChange, t, type Bi } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { bits, fmtIp, inSubnet, maskOf, parseCidr, parseIp, prefixOfMask, rng, subnetInfo, type AddressKind } from '../../../engine/sim-net/ip';

const KIND: Record<AddressKind, Bi> = {
  private: bi('частный адрес из RFC 1918, в интернете не маршрутизируется', 'private (RFC 1918): not routed on the internet'),
  loopback: bi('адрес самой машины (loopback)', 'loopback: the machine itself'),
  'link-local': bi('адрес link-local из 169.254/16, который машина назначает себе, если DHCP не ответил', 'link-local 169.254/16: DHCP did not answer'),
  cgnat: bi('общий адрес провайдера из 100.64/10 (CGNAT, RFC 6598)', 'CGNAT 100.64/10 (RFC 6598): the provider’s shared range'),
  documentation: bi('адрес для документации и примеров (RFC 5737)', 'for documentation (RFC 5737)'),
  multicast: bi('групповой адрес (multicast)', 'multicast'),
  public: bi('публичный адрес', 'public'),
  unspecified: bi('адрес «не задан» (0.0.0.0)', '“unspecified” (0.0.0.0)'),
  broadcast: bi('широковещательный адрес, то есть адрес «всем в сети»', 'limited broadcast'),
};

const L = {
  title: bi('Калькулятор подсети', 'Subnet calculator'),
  address: bi('Адрес', 'Address'),
  prefix: bi('Префикс', 'Prefix'),
  mask: bi('Маска', 'Mask'),
  network: bi('Адрес сети', 'Network address'),
  broadcast: bi('Широковещательный адрес', 'Broadcast'),
  range: bi('Адреса хостов', 'Host addresses'),
  hosts: bi('Хостов', 'Hosts'),
  kind: bi('Что за адрес', 'What kind of address'),
  netBits: bi('сеть', 'network'),
  hostBits: bi('хост', 'host'),
  bad: bi('Введите адрес вида 192.168.10.37 и префикс от 0 до 32.', 'Enter an address like 192.168.10.37 and a prefix 0–32.'),
  delta: bi('Префикс изменился с /{a} на /{b}, и адресов для машин стало {h1} вместо {h0}, потому что сетевая часть {more}.', '/{a} → /{b}: the network part {more} by {n} bit(s), hosts {h0} → {h1}.'),
  grew: bi('стала длиннее', 'grew'),
  shrank: bi('стала короче', 'shrank'),
};

function bitRow(addr: number, prefix: number): HTMLElement {
  const row = h('div.sn-bits', { role: 'img', 'aria-label': `${bits(addr)} /${prefix}` });
  const s = bits(addr).replace(/\./g, '');
  for (let i = 0; i < 32; i++) {
    if (i && i % 8 === 0) row.append(h('span.sn-dot', {}, '.'));
    row.append(h(`span.sn-bit${i < prefix ? '.net' : '.host'}${i === prefix - 1 ? '.edge' : ''}`, {}, s[i]));
  }
  return row;
}

function mountCalc(el: HTMLElement, props: { cidr?: string }, ctx: WidgetCtx): Mounted {
  let addr = (props.cidr ?? '192.168.10.37/26').split('/')[0];
  let prefix = Number((props.cidr ?? '192.168.10.37/26').split('/')[1] ?? 24);
  let lastDelta = '';
  let moves = 0;
  const root = h('section.sn-calc');
  el.append(root);
  const render = () => {
    clear(root);
    let info;
    try {
      info = subnetInfo(`${addr}/${prefix}`);
    } catch {
      info = null;
    }
    const input = h('input.sn-input', { type: 'text', value: addr, inputmode: 'decimal', 'aria-label': t(L.address), spellcheck: 'false', onchange: (e: Event) => { addr = (e.target as HTMLInputElement).value.trim(); render(); } });
    const slider = h('input', { type: 'range', min: 0, max: 32, step: 1, value: prefix, 'aria-label': t(L.prefix), oninput: (e: Event) => {
      const np = Number((e.target as HTMLInputElement).value);
      if (np === prefix) return;
      const h0 = subnetInfo(`${addr}/${prefix}`).hosts;
      const h1 = subnetInfo(`${addr}/${np}`).hosts;
      lastDelta = t(fmt(L.delta, { a: prefix, b: np, more: t(np > prefix ? L.grew : L.shrank), n: Math.abs(np - prefix), h0: h0.toLocaleString(), h1: h1.toLocaleString() }));
      prefix = np;
      if (++moves >= 3) ctx.complete();
      render();
    } });
    root.append(
      h('h4.sn-title', {}, t(L.title)),
      h('div.sn-inputs', {}, h('label', {}, h('span', {}, t(L.address)), input), h('label.sn-slider', {}, h('span', {}, `${t(L.prefix)} /${prefix}`), slider)),
    );
    if (!info) {
      root.append(h('p.err', {}, t(L.bad)));
      return;
    }
    const a = parseIp(info.address);
    root.append(
      h('div.sn-bitgrid', {}, h('div.sn-bitlabel', {}, t(L.address)), bitRow(a, prefix), h('div.sn-bitlabel', {}, t(L.mask)), bitRow(maskOf(prefix), prefix)),
      h('div.sn-legend', {}, h('span.sn-key.net', {}, t(L.netBits)), h('span.sn-key.host', {}, t(L.hostBits))),
      h(
        'dl.sn-table',
        {},
        ...([
          [L.mask, `${info.mask}  (/${info.prefix})`],
          [L.network, info.network],
          [L.broadcast, info.broadcast],
          [L.range, `${info.firstHost} – ${info.lastHost}`],
          [L.hosts, info.hosts.toLocaleString()],
          [L.kind, t(KIND[info.kind])],
        ] as [Bi, string][]).flatMap(([k, v]) => [h('dt', {}, t(k)), h('dd', {}, v)]),
      ),
      h('p.knob-delta', { 'aria-live': 'polite' }, lastDelta),
    );
  };
  const off = onLangChange(render);
  render();
  return { dispose: () => { off(); root.remove(); }, describe: () => `${addr}/${prefix}` };
}

// ── drill ──────────────────────────────────────────────────────────────────

export interface DrillQ {
  kind: 'hosts' | 'network' | 'broadcast' | 'same' | 'mask';
  prompt: Bi;
  answer: string;
  explain: Bi;
}

/** Deterministic questions for the subnet drill (prefixes /16–/30 for beginners). */
export function drillQuestion(seed: number): DrillQ {
  const r = rng(seed);
  const kinds: DrillQ['kind'][] = ['hosts', 'network', 'broadcast', 'same', 'mask'];
  const kind = kinds[Math.floor(r() * kinds.length)];
  const prefix = 16 + Math.floor(r() * 15);
  const base = [[10, 0], [172, 16], [192, 168]][Math.floor(r() * 3)];
  const ip = `${base[0]}.${base[0] === 192 ? 168 : base[1] + Math.floor(r() * 16)}.${Math.floor(r() * 256)}.${1 + Math.floor(r() * 254)}`;
  const info = subnetInfo(`${ip}/${prefix}`);
  switch (kind) {
    case 'hosts':
      return { kind, prompt: fmt(bi('Сколько адресов можно выдать машинам в подсети /{p}?', 'How many host addresses does a /{p} subnet have?'), { p: prefix }), answer: String(info.hosts), explain: fmt(bi('На номер машины остаётся 32 − {p} = {h} бит, это 2^{h} = {t} адресов. Если вычесть адрес сети и широковещательный адрес, остаётся {n}.', '32 − {p} = {h} host bits: 2^{h} = {t} addresses, minus the network and broadcast addresses = {n}.'), { p: prefix, h: 32 - prefix, t: info.total, n: info.hosts }) };
    case 'network':
      return { kind, prompt: fmt(bi('Какой адрес сети у {ip}/{p}?', 'The network address of {ip}/{p}?'), { ip, p: prefix }), answer: info.network, explain: fmt(bi('Обнулите {h} младших бит адреса, то есть биты номера машины, и получится {n}.', 'Zero the {h} lowest bits of the address (the host bits): {n}.'), { h: 32 - prefix, n: info.network }) };
    case 'broadcast':
      return { kind, prompt: fmt(bi('Какой широковещательный адрес у подсети {ip}/{p}?', 'The broadcast address of {ip}/{p}?'), { ip, p: prefix }), answer: info.broadcast, explain: fmt(bi('Поставьте в единицу все {h} бит номера машины, и получится {b}.', 'Set all {h} host bits to ones: {b}.'), { h: 32 - prefix, b: info.broadcast }) };
    case 'mask':
      return { kind, prompt: fmt(bi('Какая маска соответствует префиксу /{p}? Запишите её четырьмя числами.', 'What mask does prefix /{p} have? Write it as four numbers.'), { p: prefix }), answer: info.mask, explain: fmt(bi('Слева идут {p} единиц подряд, а остальные биты равны нулю, и получается {m}.', '{p} ones in a row from the left, zeros after: {m}.'), { p: prefix, m: info.mask }) };
    default: {
      const other = fmtIp((parseIp(info.network) + Math.floor(r() * info.total * 2)) >>> 0);
      const same = inSubnet(other, `${info.network}/${prefix}`);
      return { kind: 'same', prompt: fmt(bi('Находятся ли {a}/{p} и {b} в одной подсети? Ответьте «да» или «нет».', 'Are {a}/{p} and {b} in the same subnet? Answer “yes” or “no”.'), { a: ip, p: prefix, b: other }), answer: same ? 'yes' : 'no', explain: fmt(same ? bi('Подсеть {a}/{p} включает адреса от {n} до {bc}, и адрес {b} лежит внутри неё.', 'Subnet {a}/{p} is {n} … {bc}. {b} is inside.') : bi('Подсеть {a}/{p} включает адреса от {n} до {bc}, и адрес {b} лежит за её пределами.', 'Subnet {a}/{p} is {n} … {bc}. {b} is outside.'), { a: ip, p: prefix, n: info.network, bc: info.broadcast, b: other }) };
    }
  }
}

export function checkDrill(q: DrillQ, raw: string): boolean {
  const a = raw.trim().toLowerCase().replace(/^\//, '');
  if (q.kind === 'same') return (q.answer === 'yes' && ['да', 'yes', 'y', 'д'].includes(a)) || (q.answer === 'no' && ['нет', 'no', 'n', 'н'].includes(a));
  if (q.kind === 'mask' && /^\d+$/.test(a)) return false;
  if (q.kind === 'mask') {
    try {
      return prefixOfMask(a) === prefixOfMask(q.answer);
    } catch {
      return false;
    }
  }
  return a.replace(/\s|,/g, '') === q.answer;
}

function mountDrill(el: HTMLElement, props: { need?: number }, ctx: WidgetCtx): Mounted {
  const need = props.need ?? 5;
  let seed = 7;
  let solved = 0;
  let q = drillQuestion(seed);
  let feedback: HTMLElement | null = null;
  const root = h('section.sn-drill');
  el.append(root);
  const render = () => {
    clear(root);
    const input = h('input.sn-input', { type: 'text', 'aria-label': t(bi('Ответ', 'Answer')), spellcheck: 'false', autocomplete: 'off' });
    const submit = () => {
      const ok = checkDrill(q, (input as HTMLInputElement).value);
      feedback = h(`p.sn-feedback${ok ? '.ok' : '.err'}`, { 'aria-live': 'polite' }, ok ? t(bi('Вы ответили верно. ', 'Right. ')) : t(fmt(bi('Правильный ответ: {a}. ', 'The answer: {a}. '), { a: q.answer === 'yes' ? t(bi('да', 'yes')) : q.answer === 'no' ? t(bi('нет', 'no')) : q.answer })), t(q.explain));
      if (ok) {
        solved++;
        if (solved >= need) ctx.complete();
      }
      ctx.record({ kind: 'x.net.subnet-drill', ok, question: q.kind });
      render();
      (root.querySelector('button.next') as HTMLButtonElement | null)?.focus();
    };
    const form = h('form.sn-form', { onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, h('p.sn-q', {}, t(q.prompt)), h('div.sn-row', {}, input, h('button.btn', { type: 'submit' }, t(bi('Проверить', 'Check')))));
    root.append(h('h4.sn-title', {}, t(bi('Тренажёр по подсетям', 'Drill: subnets'))), form);
    if (feedback) {
      root.append(feedback, h('button.btn.small.next', { type: 'button', onclick: () => { seed++; q = drillQuestion(seed); feedback = null; render(); (root.querySelector('input') as HTMLInputElement | null)?.focus(); } }, t(bi('Следующий вопрос', 'Next question'))));
    }
    root.append(h('p.sn-progress', {}, t(fmt(bi('Решено {n} из {k}', 'Solved: {n} of {k}'), { n: Math.min(solved, need), k: need }))));
  };
  const off = onLangChange(render);
  render();
  return { dispose: () => { off(); root.remove(); }, describe: () => t(q.prompt) };
}

export const subnetWidget: WidgetReg = { id: 'net.subnet-calc', mount: (el, props, ctx) => mountCalc(el, (props ?? {}) as { cidr?: string }, ctx) };
export const drillWidget: WidgetReg = { id: 'net.subnet-drill', mount: (el, props, ctx) => mountDrill(el, (props ?? {}) as { need?: number }, ctx) };

export { parseCidr };
