// Content tests of the Networks block: the linter has nothing to say about it,
// every explainer runs fast with every break, and every lab task is solvable —
// a reference solution typed into the simulated terminal passes the task's
// check (and the check fails before it).

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import { registry } from '../src/core/registry';
import type { DocsSection, Lesson, PredictOutputItem, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';

const lessons = [...registry.lessons.values()].filter((l) => l.block === 'networks');

describe('networks content', () => {
  it('is delivered: 15 lessons, ≥ 12 explainers and widgets, ≥ 12 quiz items', () => {
    expect(lessons.length).toBe(15);
    expect([...registry.explainers.values()].filter((e) => e.block === 'networks').length).toBeGreaterThanOrEqual(12);
    expect([...registry.quiz.keys()].filter((k) => k.startsWith('net.q.')).length).toBeGreaterThanOrEqual(12);
  });

  it('has no linter errors or warnings', () => {
    const mine = lintRegistry(registry).filter((i) => /\bnet\.|networks/.test(`${i.where} ${i.msg}`));
    expect(mine.map((i) => `${i.level} ${i.where}: ${i.msg}`)).toEqual([]);
  });

  it('every explainer model runs within budget with every break', () => {
    for (const e of registry.explainers.values()) {
      if (e.block !== 'networks' || !e.model) continue;
      const m = e.model;
      const defaults = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
      const t0 = performance.now();
      const steps = m.run(defaults, new Set());
      expect(performance.now() - t0, `${m.id} is too slow`).toBeLessThan(50);
      expect(steps.length, m.id).toBeGreaterThan(1);
      for (const b of m.breaks) {
        const s = m.run(defaults, new Set([b.id]));
        expect(s.some((x) => x.broken), `${m.id} break ${b.id}`).toBe(true);
        const answer = b.predict.resolve(steps, s);
        expect(b.predict.options.map((o) => o.id), `${m.id} break ${b.id} predicts an existing option`).toContain(answer);
      }
      for (const p of m.params) {
        if (!p.predict) continue;
        const alt = p.kind === 'toggle' ? !p.default : p.kind === 'choice' ? p.options!.find((o) => o.id !== p.default)!.id : p.min!;
        const next = m.run({ ...defaults, [p.id]: alt }, new Set());
        expect(p.predict.options.map((o) => o.id), `${m.id} param ${p.id}`).toContain(p.predict.resolve(steps, next));
        const delta = m.explainDelta(steps, next, { kind: 'param', id: p.id, from: p.default, to: alt }, defaults, { ...defaults, [p.id]: alt });
        expect(delta.ru.length * delta.en.length).toBeGreaterThan(0);
      }
    }
  });
});

/** Reference solutions, by `lesson/section/task`. Absent tasks are solved by their chips. */
const SOLUTIONS: Record<string, string[]> = {
  'networks.internet/lab/isp': ['echo 203.0.113.1 > ~/isp.txt'],
  'networks.frames/lab/mac': ['ip link show eth0 > ~/mac.txt'],
  'networks.frames/lab/neighbour': ['ping -c 1 192.168.1.20', 'echo 02:42:ac:11:00:14 > ~/b.txt'],
  'networks.arp/lab/failed': ['ping -c 2 192.168.1.30'],
  'networks.routing/lab-trace/where': ['traceroute -n -m 6 10.20.0.5', 'echo 10.0.12.2 > ~/last.txt'],
  'networks.transport/lab/diagnose': ['nc -zv -w 3 10.0.0.2 9000', 'nc -zv -w 3 10.0.0.2 9100', 'echo "9000 closed" > ~/ports.txt', 'echo "9100 filtered" >> ~/ports.txt'],
  'networks.transport/forcing/timeout': ['curl --connect-timeout 3 http://10.0.0.2:9100/metrics'],
  'networks.envelopes/lab/len': ['ping -c 1 shop.example', 'tcpdump -n -e icmp', 'echo 98 > ~/len.txt'],
  'networks.envelopes/lab/df': ['ping -c 1 -M do -s 1473 shop.example', 'ping -c 1 -M do -s 1472 shop.example', 'echo 1472 > ~/max.txt'],
  'networks.dns/lab/fix': ['dig shop.example @192.168.1.1', 'echo "nameserver 192.168.1.1" > /etc/resolv.conf'],
  'networks.dns/lab/trace': ['dig +trace shop.example', 'echo a.nic.example > ~/tld.txt'],
  'networks.dns/forcing/mx': ['dig +short shop.example MX > ~/mx.txt'],
  'networks.dhcp/lab/dns': ['echo 192.168.1.1 > ~/dns.txt'],
  'networks.dhcp/lab-rogue/rogue': ['dhcpcd eth0', 'echo 192.168.1.250 > ~/rogue.txt'],
  'networks.nat/lab/counters': ['iptables -t nat -L -n -v'],
  'networks.http/lab/byhand': ['echo -e "GET / HTTP/1.1\\r\\nHost: srv\\r\\n\\r\\n" | nc 10.0.0.2 8080'],
  'networks.http/forcing/code': ["curl -s -o /dev/null -w '%{http_code}' http://10.0.0.2:8080/nope"],
  'networks.tls/lab/expire': ['curl -vI https://shop.example/ > /dev/null', 'echo "Dec 30 23:59:59 2026 GMT" > ~/expire.txt'],
  'networks.tls/lab/name': ['curl https://wrong.example/', 'echo wrong.example > ~/mismatch.txt'],
  'networks.proxy/lab/log': ['cat /var/log/nginx/error.log', 'echo 75 > ~/direct.txt'],
  'networks.troubleshooting/incident1/layer': ['curl --connect-timeout 5 https://shop.example/', 'echo L4 > ~/layer.txt'],
  'networks.troubleshooting/incident2/port': ['nc -zv 10.0.2.21 8080', 'nc -zv 10.0.2.21 8081', 'echo 8081 > ~/port.txt'],
  'networks.troubleshooting/incident2/fix': ['__REWRITE_CONF__', 'nginx -t', 'nginx -s reload'],
  'networks.proxy/lab/layer': ['echo L7 > ~/layer.txt'],
  'networks.tls/forcing/resolve': ['curl --resolve shop.example:443:198.51.100.30 https://shop.example/'],
  'networks.proxy/forcing/next': ["echo 'proxy_next_upstream off;' >> /etc/nginx/conf.d/shop.conf", 'nginx -t', 'nginx -s reload'],
};

const FIXED = 'upstream backend {\\n    server 10.0.2.21:8081;\\n}\\nserver {\\n    listen 80;\\n    server_name shop.lab;\\n    location / {\\n        proxy_pass http://backend;\\n    }\\n}';

async function solve(setup: TerminalSetup, tasks: Task[], key: (t: Task) => string) {
  const m = await createSimMachine(setup);
  const start = await m.facts();
  const results: { id: string; before: boolean; after: boolean; out: string }[] = [];
  for (const t of tasks) {
    const before = evaluateCheck(t.check, await m.facts(), start).pass;
    const lines = SOLUTIONS[key(t)] ?? (t.chips ? [t.chips] : []);
    let out = '';
    for (const l0 of lines) {
      const l = l0 === '__REWRITE_CONF__' ? `echo -e '${FIXED}' > /etc/nginx/conf.d/shop.conf` : l0;
      out += stripAnsi((await m.exec(l)).out);
    }
    results.push({ id: t.id, before, after: evaluateCheck(t.check, await m.facts(), start).pass, out });
  }
  return results;
}

describe('every networks lab task is solvable by its reference solution', () => {
  for (const l of lessons) {
    for (const s of l.sections) {
      if (s.kind === 'terminal') {
        it(`${l.id} § ${s.id}`, async () => {
          const r = await solve((s as TerminalSection).setup, (s as TerminalSection).tasks, (t) => `${l.id}/${s.id}/${t.id}`);
          for (const x of r) expect(x.after, `${l.id}/${s.id}/${x.id} did not pass:\n${x.out}`).toBe(true);
          // A task must not be already solved at the start (except observation tasks that build on the previous one).
          expect(r[0].before, `${l.id}/${s.id}/${r[0].id} passes before anything was done`).toBe(false);
        });
      }
      if (s.kind === 'docs' && (s as DocsSection).terminal) {
        const d = s as DocsSection;
        it(`${l.id} § ${s.id} (docs task)`, async () => {
          const r = await solve(d.terminal!.setup, [d.terminal!.task], (t) => `${l.id}/${s.id}/${t.id}`);
          expect(r[0].after, `${l.id}/${s.id} did not pass:\n${r[0].out}`).toBe(true);
          expect(r[0].before).toBe(false);
        });
      }
    }
  }
});

describe('placement tasks of the networks block are solvable', () => {
  const block = registry.blocks.get('networks')!;
  const SOL: Record<string, string[]> = {
    gw: ['ip route add default via 10.0.1.1'],
    resolv: ['echo "nameserver 192.168.1.1" > /etc/resolv.conf'],
    dnat: ['sysctl -w net.ipv4.ip_forward=1', 'iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE', 'iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j DNAT --to-destination 10.0.2.20:8080'],
    dig: ['dig +noall +answer shop.example'],
  };
  for (const p of block.placement) {
    if (p.kind !== 'task') continue;
    it(p.id, async () => {
      const m = await createSimMachine(p.setup);
      expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(false);
      for (const l of SOL[p.task.id] ?? []) await m.exec(l);
      expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(true);
    });
  }
});

describe('a predict-output item takes its reference from the simulator', () => {
  it('net.q.env.dstmac: the frame to another network is addressed to the gateway', async () => {
    const q = registry.quiz.get('net.q.env.dstmac') as PredictOutputItem;
    const m = await createSimMachine(q.setup);
    const r = await m.exec(q.command);
    expect(stripAnsi(r.out)).toMatch(/3c:22:fb:12:34:56 > a0:63:91:00:00:01, ethertype IPv4/);
  });
});

export type { Lesson };
