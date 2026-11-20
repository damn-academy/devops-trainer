// The second round of fixes after the six learner personas walked the
// Networks block: subnet splitting, a real TLS 1.2 handshake, the VPN lesson,
// NAT entries, and goals that accept every correct way of proving a point.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import netMod from '../src/engine/sim-net/module';
import { setLang } from '../src/core/i18n';
import type { Step, TerminalSection } from '../src/core/types';
import { natModel } from '../src/blocks/networks/explainers/nat';
import { tlsModel } from '../src/blocks/networks/explainers/tcp';
import { vpnModel } from '../src/blocks/networks/explainers/vpn';
import { routing, subnets } from '../src/blocks/networks/lessons-a';
import { troubleshooting } from '../src/blocks/networks/lessons-c';
import { vpn } from '../src/blocks/networks/lessons-e';
import { checkDrill, drillQuestion } from '../src/blocks/networks/widgets/subnet';
import { ROUTE_ROWS } from '../src/blocks/networks/widgets/route-map';
import { RU_TEXT, PROTOCOLS } from '../src/blocks/networks/widgets/protocols';
import { quiz } from '../src/blocks/networks/quiz';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...(netMod.commands ?? [])]) reg.commands.add(c);
reg.setup.push(...(netMod.setup ?? []));
reg.facts.push(...(netMod.facts ?? []));

const task = (sections: { id: string }[], section: string, id: string) => (sections.find((s) => s.id === section) as TerminalSection).tasks.find((t) => t.id === id)!;
const captions = (steps: Step[]) => steps.map((s) => (typeof s.caption === 'string' ? s.caption : s.caption.ru)).join(' ');

describe('subnet splitting', () => {
  it('asks for the prefix of N subnets cut from a parent block and checks it by the doubling rule', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = drillQuestion(seed, ['split']);
      expect(q.kind).toBe('split');
      const parent = Number(/\/(\d+)/.exec(q.prompt.ru)![1]);
      const n = Number(/нарезать (\d+)/.exec(q.prompt.ru)![1]);
      const p = Number(q.answer);
      expect(2 ** (p - parent)).toBeGreaterThanOrEqual(n);
      expect(2 ** (p - parent - 1)).toBeLessThan(n);
      expect(checkDrill(q, `/${p}`)).toBe(true);
    }
  });

  it('teaches splitting and disarms the class habit in the lesson and the quiz', () => {
    expect(subnets.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['classes', 'split', 'drill-split', 'why-small']));
    const split = quiz.find((q) => q.id === 'net.q.sub.split')!;
    expect(split.kind === 'mcq' && split.options.find((o) => o.correct)?.id).toBe('25');
    expect(quiz.find((q) => q.id === 'net.q.sub.class')).toBeDefined();
  });
});

describe('TLS 1.2 on the diagram', () => {
  it('has its own messages and waits for the server’s Finished before the request', () => {
    const steps = tlsModel.run({ rtt: 40, version: '1.2', reuse: false }, new Set());
    expect(steps.map((s) => s.id)).toEqual(['tcp', 'hello', 'shello', 'ckx', 'sfin', 'fin', 'resp']);
    expect(steps.at(-1)!.metrics!.rtts).toBe(4);
    expect(captions(steps)).not.toContain('не дожидаясь');
    expect(captions(steps)).toContain('два на TLS 1.2');
  });

  it('writes the number of round trips in words', () => {
    const steps = tlsModel.run({ rtt: 40, version: '1.3', reuse: false }, new Set());
    expect(captions(steps)).toContain('через три пути до сервера и обратно');
  });
});

describe('the VPN lesson', () => {
  it('is on the route after the proxy lesson and stops at the right place for every break', () => {
    expect(vpn.introduces).toContain('net.vpn');
    const ok = vpnModel.run({ mode: 'split' }, new Set());
    expect(ok.at(-1)!.tokens![0].edge).toBe('direct');
    const full = vpnModel.run({ mode: 'full' }, new Set());
    expect(full.at(-1)!.tokens!.some((t) => t.edge === 'wan2')).toBe(true);
    expect(vpnModel.run({ mode: 'split' }, new Set(['udp-blocked'])).find((s) => s.broken)!.broken!.at).toBe('router');
    expect(vpnModel.run({ mode: 'split' }, new Set(['no-peer'])).find((s) => s.broken)!.broken!.at).toBe('gw');
    expect(vpnModel.run({ mode: 'split' }, new Set(['no-route-back'])).find((s) => s.broken)!.broken!.at).toBe('srv');
  });
});

describe('NAT entries', () => {
  it('agrees the number of devices and shows how the entries differ', () => {
    setLang('ru');
    const steps = natModel.run({ devices: 2, inbound: false }, new Set());
    const many = steps.find((s) => s.id === 'many')!;
    expect(captions([many])).toContain('В квартире 2 устройства');
    expect(many.say!.ct.ru).toContain('.24:51234 → :40002');
  });
});

describe('goals that accept every correct proof', () => {
  it('counts curl -m and nc -w as proof of the silent port 443', async () => {
    const t = task(troubleshooting.sections, 'incident1', 'prove');
    const re = t.check.stdout as RegExp;
    for (const line of ['curl --connect-timeout 5 https://shop.example/', 'curl -sS -m 5 https://shop.example/', 'nc -zv -w 5 shop.example 443']) {
      const m = await createSimMachine({ user: 'root', hostname: 'laptop', ext: { net: { preset: 'home', opts: { drop443: true } } } }, { registry: reg });
      const out = stripAnsi((await m.exec(line)).out);
      expect(re.test(out), `${line}\n${out}`).toBe(true);
    }
  });

  it('counts ip route get before the route is added', () => {
    const t = task(routing.sections, 'lab', 'get');
    expect((t.check.stdout as RegExp).test('RTNETLINK answers: Network is unreachable')).toBe(true);
  });
});

describe('the route map and the catalogue', () => {
  it('links every row to a lesson and translates catalogue prose', () => {
    expect(ROUTE_ROWS.map((r) => r.lesson.id)).toContain('networks.vpn');
    const symptoms = PROTOCOLS.flatMap((p) => p.breaks.map((b) => b.symptom));
    expect(symptoms).toContain('default via 192.168.1.250 — no internet');
    expect(RU_TEXT['default via 192.168.1.250 — no internet']).toBe('default via 192.168.1.250, и интернета нет');
  });
});
