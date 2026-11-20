// Subnet calculator and drill (03 §10.1). The calculator shows the 32 bits
// with the mask as a moving border; every value is computed by the same IPv4
// arithmetic the simulator uses. The drill generates questions from a seed —
// no points, no streaks: a question, an answer, the bits that explain it.

import { clear, h } from '../../../core/dom';
import { bi, fmt, lang, onLangChange, pluralRu, t, type Bi } from '../../../core/i18n';
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
  range: bi('Адреса машин (хостов)', 'Host addresses'),
  hosts: bi('Адресов для машин', 'Hosts'),
  kind: bi('Что за адрес', 'What kind of address'),
  netBits: bi('сеть', 'network'),
  hostBits: bi('номер машины', 'host'),
  bad: bi('Введите адрес вида 192.168.10.37 и префикс от 0 до 32.', 'Enter an address like 192.168.10.37 and a prefix 0–32.'),
  delta: bi('Префикс изменился с /{a} на /{b}, и адресов для машин стало {h1} вместо {h0}, потому что сетевая часть {more}.', '/{a} → /{b}: the network part {more} by {n} bit(s), hosts {h0} → {h1}.'),
  grew: bi('стала длиннее', 'grew'),
  shrank: bi('стала короче', 'shrank'),
  noBroadcast: bi('нет: в подсети /31 оба адреса выдают машинам (RFC 3021), а /32 описывает один адрес', 'none: in a /31 both addresses go to machines (RFC 3021), and a /32 is a single address'),
};

/** A number in the reader's language: 65 534 in Russian, 65,534 in English. */
const num = (n: number): string => n.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US');
const bitWord = (n: number): string => pluralRu(n, ['бит', 'бита', 'бит']);
const addrWord = (n: number): string => pluralRu(n, ['адрес', 'адреса', 'адресов']);
const subnetWord = (n: number): string => pluralRu(n, ['подсеть', 'подсети', 'подсетей']);
/** 2⁷ rather than 2^7, as in the lesson text. */
const sup = (n: number): string => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);

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
      lastDelta = t(fmt(L.delta, { a: prefix, b: np, more: t(np > prefix ? L.grew : L.shrank), n: Math.abs(np - prefix), h0: num(h0), h1: num(h1) }));
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
          [L.broadcast, info.prefix >= 31 ? t(L.noBroadcast) : info.broadcast],
          [L.range, `${info.firstHost} – ${info.lastHost}`],
          [L.hosts, num(info.hosts)],
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
  kind: 'hosts' | 'network' | 'broadcast' | 'same' | 'mask' | 'split';
  prompt: Bi;
  answer: string;
  explain: Bi;
}

export const DRILL_KINDS: DrillQ['kind'][] = ['hosts', 'network', 'broadcast', 'same', 'mask', 'split'];

/** Deterministic questions for the subnet drill (prefixes /16–/30 for beginners). */
export function drillQuestion(seed: number, kinds: DrillQ['kind'][] = DRILL_KINDS): DrillQ {
  const r = rng(seed);
  const kind = kinds[Math.floor(r() * kinds.length)];
  const prefix = 16 + Math.floor(r() * 15);
  const base = [[10, 0], [172, 16], [192, 168]][Math.floor(r() * 3)];
  const ip = `${base[0]}.${base[0] === 192 ? 168 : base[1] + Math.floor(r() * 16)}.${Math.floor(r() * 256)}.${1 + Math.floor(r() * 254)}`;
  const info = subnetInfo(`${ip}/${prefix}`);
  switch (kind) {
    case 'hosts':
      return { kind, prompt: fmt(bi('Сколько адресов можно выдать машинам в подсети /{p}?', 'How many host addresses does a /{p} subnet have?'), { p: prefix }), answer: String(info.hosts), explain: fmt(bi('На номер машины остаётся 32 − {p} = {h} {hb}, а это 2{hs} = {t} {ta}. Если вычесть адрес сети и широковещательный адрес, остаётся {n}.', '32 − {p} = {h} host bits: 2{hs} = {t} addresses, minus the network and broadcast addresses = {n}.'), { p: prefix, h: 32 - prefix, hs: sup(32 - prefix), hb: bitWord(32 - prefix), t: num(info.total), ta: addrWord(info.total), n: num(info.hosts) }) };
    case 'network':
      return { kind, prompt: fmt(bi('Какой адрес сети у {ip}/{p}?', 'The network address of {ip}/{p}?'), { ip, p: prefix }), answer: info.network, explain: fmt(bi('Номеру машины в этой подсети отведено {h} {hb} справа. Запишите во все эти биты нули, и получится адрес сети {n}.', 'Zero the {h} lowest bits of the address (the host bits): {n}.'), { h: 32 - prefix, hb: bitWord(32 - prefix), n: info.network }) };
    case 'broadcast':
      return { kind, prompt: fmt(bi('Какой широковещательный адрес в подсети, где находится машина {ip}/{p}?', 'What is the broadcast address of the subnet that holds {ip}/{p}?'), { ip, p: prefix }), answer: info.broadcast, explain: fmt(bi('Подсеть начинается не с адреса машины, а с адреса сети {n}: границы подсетей идут с шагом в её размер, {t} {ta}, и адрес машины их не сдвигает. Номеру машины отведено {h} {hb} справа. Запишите во все эти биты единицы, и получится {b}.', 'The subnet starts not at the machine’s address but at the network address {n}: subnet borders go in steps of its size, {t} addresses, and a machine’s address does not move them. Set all {h} host bits to ones: {b}.'), { n: info.network, t: num(info.total), ta: addrWord(info.total), h: 32 - prefix, hb: bitWord(32 - prefix), b: info.broadcast }) };
    case 'mask':
      return { kind, prompt: fmt(bi('Какая маска соответствует префиксу /{p}? Запишите её четырьмя числами.', 'What mask does prefix /{p} have? Write it as four numbers.'), { p: prefix }), answer: info.mask, explain: fmt(bi('В маске /{p} первые {p} {pb} слева равны единице, а остальные нулю, и получается {m}.', '{p} ones in a row from the left, zeros after: {m}.'), { p: prefix, pb: bitWord(prefix), m: info.mask }) };
    case 'split': {
      const parent = 16 + Math.floor(r() * 9);
      const k = 2 + Math.floor(r() * 11);
      const add = Math.ceil(Math.log2(k));
      const net = subnetInfo(`${ip}/${parent}`).network;
      return {
        kind,
        prompt: fmt(bi('Из блока {net}/{p0} нужно нарезать {k} {kw} одинакового размера, как можно более крупных. Какой префикс будет у каждой подсети?', 'The block {net}/{p0} must be cut into {k} subnets of equal size, as large as possible. What prefix will each subnet have?'), { net, p0: parent, k, kw: subnetWord(k) }),
        answer: String(parent + add),
        explain: fmt(bi('Каждый бит, который вы забираете из номера машины, удваивает число подсетей. {k} {kw} нужно {s} {sb}, потому что 2{ss} = {c}, а это не меньше {k}. К родительскому префиксу /{p0} прибавляем {s} и получаем /{p}.', 'Each bit taken from the host number doubles the number of subnets. {k} subnets need {s} bit(s), because 2{ss} = {c}, which is at least {k}. Add {s} to the parent prefix /{p0} and you get /{p}.'), { k, kw: pluralRu(k, ['подсети', 'подсетям', 'подсетям']), s: add, sb: bitWord(add), ss: sup(add), c: 2 ** add, p0: parent, p: parent + add }),
      };
    }
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

function mountDrill(el: HTMLElement, props: { need?: number; kinds?: DrillQ['kind'][]; seed?: number }, ctx: WidgetCtx): Mounted {
  const need = props.need ?? 5;
  const kinds = props.kinds ?? DRILL_KINDS;
  let seed = props.seed ?? 7;
  const solved = new Set<number>();
  let q = drillQuestion(seed, kinds);
  let feedback: HTMLElement | null = null;
  const root = h('section.sn-drill');
  el.append(root);
  const render = () => {
    clear(root);
    const input = h('input.sn-input', { type: 'text', 'aria-label': t(bi('Ответ', 'Answer')), spellcheck: 'false', autocomplete: 'off' });
    const submit = () => {
      const ok = checkDrill(q, (input as HTMLInputElement).value);
      feedback = h(`p.sn-feedback${ok ? '.ok' : '.err'}`, { 'aria-live': 'polite' }, ok ? t(bi('Вы ответили верно. ', 'Right. ')) : t(fmt(bi('Правильный ответ: {a}. ', 'The answer: {a}. '), { a: q.answer === 'yes' ? t(bi('да', 'yes')) : q.answer === 'no' ? t(bi('нет', 'no')) : q.answer })), t(q.explain));
      // A question counts once, however many times “Check” is pressed on it.
      if (ok && !solved.has(seed)) {
        solved.add(seed);
        if (solved.size >= need) ctx.complete();
      }
      ctx.record({ kind: 'x.net.subnet-drill', ok, question: q.kind });
      render();
      (root.querySelector('button.next') as HTMLButtonElement | null)?.focus();
    };
    const form = h('form.sn-form', { onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, h('p.sn-q', {}, t(q.prompt)), h('div.sn-row', {}, input, h('button.btn', { type: 'submit' }, t(bi('Проверить', 'Check')))));
    root.append(h('h4.sn-title', {}, t(bi('Тренажёр по подсетям', 'Drill: subnets'))), form);
    if (feedback) {
      root.append(feedback, h('button.btn.small.next', { type: 'button', onclick: () => { seed++; q = drillQuestion(seed, kinds); feedback = null; render(); (root.querySelector('input') as HTMLInputElement | null)?.focus(); } }, t(bi('Следующий вопрос', 'Next question'))));
    }
    root.append(h('p.sn-progress', {}, t(fmt(bi('Решено {n} из {k}', 'Solved: {n} of {k}'), { n: Math.min(solved.size, need), k: need }))));
  };
  const off = onLangChange(render);
  render();
  return { dispose: () => { off(); root.remove(); }, describe: () => t(q.prompt) };
}

export const subnetWidget: WidgetReg = { id: 'net.subnet-calc', mount: (el, props, ctx) => mountCalc(el, (props ?? {}) as { cidr?: string }, ctx) };
export const drillWidget: WidgetReg = { id: 'net.subnet-drill', mount: (el, props, ctx) => mountDrill(el, (props ?? {}) as { need?: number; kinds?: DrillQ['kind'][]; seed?: number }, ctx) };

export { parseCidr };
