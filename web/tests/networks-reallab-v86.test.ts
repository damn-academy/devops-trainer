// The real-Linux network labs on the real emulator, in-process like
// tests/v86-lab-integration.test.ts: every lab boots its machines on the lab
// switch, runs its setup, and then a reference solution goal by goal; after
// each step the goals are judged exactly as the widget judges them (the same
// gather(), probes and checks). It needs `npm run fetch:v86` and
// `npm run build:lab-image`, boots Alpine many times and takes minutes, so it
// runs only on request:
//
//   NET_LAB=1 npx vitest run tests/networks-reallab-v86.test.ts
//   NET_LAB=router,firewall …   only these labs (ids, plus `exam`)
//
// The solutions live here, not in the app: the mentor and the page never see them.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { judgeReal } from '../src/app/real/facts';
import { examBrowser, examLab } from '../src/blocks/networks/reallab/exam-lab';
import { LABS } from '../src/blocks/networks/reallab/labs';
import { factsFor, gather, type NetLabSpec, type Scope } from '../src/blocks/networks/reallab/spec';
import { SwitchTap } from '../src/blocks/networks/reallab/tap';
import { v86Runner } from '../src/blocks/networks/reallab/v86-runner';
import { createHost } from '../src/engine/v86/host';
import { V86Lab } from '../src/engine/v86/lab';
import type { MachineAssets, TransportFactory } from '../src/engine/v86/machine';

const root = fileURLToPath(new URL('..', import.meta.url));
const lab = `${root}public/v86/lab/`;
const assets: MachineAssets = {
  wasm: `${root}node_modules/v86/build/v86.wasm`,
  bios: `${root}public/v86/seabios.bin`,
  vgaBios: `${root}public/v86/vgabios.bin`,
  bzimage: `${lab}vmlinuz-virt`,
  initrd: `${lab}initramfs-lab`,
  fsJson: `${lab}lab-node.fs.json`,
  filesBase: `${lab}files/`,
  cmdline: 'rw root=host9p rootfstype=9p console=ttyS0 tsc=reliable mitigations=off random.trust_cpu=on',
  kernelSha: 'test',
};
const want = process.env.NET_LAB ?? '';
const enabled = !!want && existsSync(assets.fsJson!);
const picked = (id: string) => want === '1' || want.split(',').includes(id);

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

const rss = () => Math.round(process.memoryUsage().rss / 1048576);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach((f) => f()));

type Step = Record<string, string> & { tap?: never };
type TapStep = (tap: SwitchTap) => void;

/** Reference solutions: per goal, root commands per machine (and switch knobs). */
const SOLUTIONS: Record<string, Record<string, (Step | TapStep)[]>> = {
  capture: {
    arp: [(t) => t.start(), { a: 'ip neigh flush all; ping -c 1 -W 2 b >/dev/null; true' }],
    tcpdump: [{ a: '(tcpdump -i eth0 -n -c 4 -w /root/icmp.pcap icmp >/dev/null 2>&1 &); sleep 2; ping -c 3 b >/dev/null; sleep 1; true' }],
    loss: [(t) => t.setLine('b', { lossPct: 30 }), { a: 'ping -c 20 -i 0.2 -W 1 b > /root/loss.txt; true' }],
    delay: [(t) => t.setLine('b', { lossPct: 0, delayMs: 150 }), { a: 'ping -c 3 b > /root/rtt.txt; true' }],
  },
  vlan: {
    vifs: [{ sw: 'ip link add link eth0 name eth0.10 type vlan id 10 && ip link add link eth0 name eth0.20 type vlan id 20 && ip link set eth0.10 up && ip link set eth0.20 up' }],
    bridge: [{ sw: 'ip link add br0 type bridge && ip link set eth0.10 master br0 && ip link set eth0.20 master br0 && ip link set br0 up' }],
    ping: [],
  },
  router: {
    vif: [{ gw: 'ip link add link eth0 name eth0.10 type vlan id 10 && ip addr add 192.168.10.1/24 dev eth0.10 && ip link set eth0.10 up' }],
    route: [{ pc: 'ip route add default via 192.168.10.1' }],
    forward: [{ gw: 'sysctl -qw net.ipv4.ip_forward=1' }],
    nat: [{ gw: 'iptables -t nat -A POSTROUTING -s 192.168.10.0/24 -o eth0 -j MASQUERADE' }],
    'route-back': [{ gw: 'iptables -t nat -F POSTROUTING', srv: 'ip route add 192.168.10.0/24 via 10.0.0.1' }],
  },
  netns: {
    ns: [{ host: 'ip netns add blue' }],
    veth: [{ host: 'ip link add veth-host type veth peer name veth-blue netns blue && ip addr add 172.16.0.1/24 dev veth-host && ip link set veth-host up && ip -n blue addr add 172.16.0.2/24 dev veth-blue && ip -n blue link set veth-blue up && ip -n blue link set lo up' }],
    out: [{ host: 'ip -n blue route add default via 172.16.0.1 && sysctl -qw net.ipv4.ip_forward=1 && iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -o eth0 -j MASQUERADE' }],
  },
  firewall: {
    drop: [{ srv: "nft add table inet filter && nft add chain inet filter input '{ type filter hook input priority 0; policy accept; }' && nft add rule inet filter input ct state established,related accept && nft add rule inet filter input iif lo accept && nft add rule inet filter input tcp dport 80 accept && nft chain inet filter input '{ policy drop; }'" }],
    ssh: [{ srv: 'nft add rule inet filter input ip saddr 10.0.0.42 tcp dport 22 accept' }],
    quiet: [{ srv: 'nft add rule inet filter input ip protocol icmp accept' }],
    persist: [{ srv: 'nft list ruleset > /etc/nftables.nft && rc-update -q add nftables default' }],
  },
  dnsmasq: {
    serve: [{ gw: "printf 'dhcp-range=10.0.0.100,10.0.0.199,1h\\n' >> /etc/dnsmasq.conf && rc-service -q dnsmasq start" }],
    lease: [{ pc: 'udhcpc -i eth0 -n -q -t 5 >/dev/null 2>&1; true' }],
    name: [{ gw: 'echo address=/web.corp.lab/10.0.0.20 >> /etc/dnsmasq.conf && rc-service -q dnsmasq restart' }],
    fixed: [{ gw: 'echo dhcp-host=02:64:74:00:00:63,10.0.0.50 >> /etc/dnsmasq.conf && rc-service -q dnsmasq restart' }, { pc: 'ip addr flush dev eth0 && udhcpc -i eth0 -n -q -t 5 >/dev/null 2>&1; true' }],
  },
};

async function startLab(spec: NetLabSpec) {
  const t0 = performance.now();
  const rss0 = rss();
  const l = new V86Lab({ transport: inProcess, assets, nodes: spec.machines.map((m) => ({ name: m.name, ip: m.dhcp ? undefined : m.ip, dhcp: m.dhcp, mac: m.mac, port: m.port })) });
  cleanup.push(() => l.dispose());
  const tap = new SwitchTap(l.switch);
  const boots: Record<string, string> = {};
  await l.start((name, b) => (boots[name] = `${b.kind} ${(b.ms / 1000).toFixed(1)} s`));
  const booted = performance.now();
  for (const m of spec.machines) for (const line of m.setup ?? []) {
    const r = await l.exec(m.name, line);
    expect(r.exit, `${spec.id} setup on ${m.name}: ${r.out}`).toBe(0);
  }
  const ready = performance.now();
  console.log(`[${spec.id}] ${spec.machines.length} machines: ${JSON.stringify(boots)}; all up in ${((booted - t0) / 1000).toFixed(1)} s, setup ${((ready - booted) / 1000).toFixed(1)} s; rss ${rss0} → ${rss()} MiB`);
  // The same runner as the widget, with the time of every round trip noted.
  const base = v86Runner(l, tap);
  const timing: string[] = [];
  const runner: typeof base = {
    ...base,
    exec: async (m, c) => {
      const t1 = performance.now();
      const r = await base.exec(m, c);
      if (c.includes('@@DT-PROBE')) timing.push(`probe@${m} ${Math.round(performance.now() - t1)}`);
      return r;
    },
    facts: async (m, sc, f) => {
      const t1 = performance.now();
      const r = await base.facts(m, sc, f);
      timing.push(`facts@${m}[${sc.join(',')}] ${Math.round(performance.now() - t1)}`);
      return r;
    },
  };
  return { l, tap, runner, timing };
}

describe.skipIf(!enabled)('network labs on real Linux (v86)', () => {
  for (const spec of Object.values(LABS)) {
    it.skipIf(!picked(spec.id))(`${spec.id}: every goal fails before its step and holds after the reference solution`, async () => {
      const { l, tap, runner, timing } = await startLab(spec);
      const t = performance.now();
      const r = await l.exec(spec.machines[0].name, 'true');
      console.log(`[${spec.id}] service-channel round trip: ${Math.round(performance.now() - t)} ms (exit ${r.exit})`);
      const rows: string[] = [];
      for (const task of spec.tasks) {
        if (task.check.when === undefined) {
          // A goal judged on the learner's terminal output (`stdout`): run the command and match it here.
          const out = (await l.exec(task.on!, task.chips!)).out;
          expect(task.check.stdout instanceof RegExp ? task.check.stdout.test(out) : out.includes(String(task.check.stdout)), `${spec.id}.${task.id}: ${out}`).toBe(true);
          rows.push(`${task.id}: stdout ok`);
          continue;
        }
        const g0 = performance.now();
        const before = await gather(spec, runner, [task]);
        const gatherMs = Math.round(performance.now() - g0);
        const was = evaluateCheck(task.check, factsFor(task, before)!);
        for (const step of SOLUTIONS[spec.id][task.id] ?? []) {
          if (typeof step === 'function') step(tap);
          else for (const [m, cmd] of Object.entries(step)) {
            const res = await l.exec(m, cmd);
            expect(res.exit, `${spec.id}.${task.id} on ${m}: ${cmd}\n${res.out}`).toBe(0);
          }
        }
        let now = evaluateCheck(task.check, factsFor(task, await gather(spec, runner, [task]))!);
        // DHCP and supervised services settle in seconds: give them a few tries, as the widget does after every command.
        for (let i = 0; i < 4 && !now.pass; i++) {
          await pause(2000);
          now = evaluateCheck(task.check, factsFor(task, await gather(spec, runner, [task]))!);
        }
        const spent = timing.splice(0).join(', ');
        rows.push(`${task.id}: before ${was.pass ? 'PASS' : 'fail'}${was.say ? ` («${was.say.en.slice(0, 60)}…»)` : ''}, after ${now.pass ? 'PASS' : 'FAIL'}; gather ${gatherMs} ms (${spent})`);
        expect(now.pass, `${spec.id}.${task.id} after the solution: ${now.say?.en ?? now.matched.join(' ')}`).toBe(true);
      }
      console.log(`[${spec.id}]\n  ${rows.join('\n  ')}\n  rss ${rss()} MiB`);
      l.dispose();
      tap.dispose();
    }, 900_000);
  }

  it.skipIf(!picked('exam'))('the in-browser exam: tickets 1–4 and 6 on three machines', async () => {
    const { l, runner } = await startLab(examLab);
    const all = () => gather(examLab, runner, [{ id: 'all', prompt: { ru: '', en: '' }, check: {}, probes: examLab.probes.filter((p) => p.id !== 'report').map((p) => p.id), scopes: { vm1: ['net', 'listen', 'fw'] as Scope[], vm2: ['net', 'listen', 'fw'] as Scope[] } }]);
    const run = async (m: string, cmd: string) => {
      const r = await l.exec(m, cmd);
      expect(r.exit, `${m}: ${cmd}\n${r.out}`).toBe(0);
      return r.out;
    };
    const score = async (id: string) => {
      const t = examBrowser.tasks.find((x) => x.id === id)!;
      if (t.kind !== 'real') throw new Error('real');
      const g0 = performance.now();
      const f = await all();
      const j = judgeReal(t.real, f.machines);
      console.log(`[exam] ${id}: ${j.goals.map((g) => `${g.goal.id}=${g.result?.pass ? 'ok' : 'no'}`).join(' ')} (facts ${Math.round(performance.now() - g0)} ms)`);
      if (j.score < 1) for (const [m, mf] of Object.entries(f.machines)) console.log(`[exam]   ${m} reach ${JSON.stringify((mf as unknown as { reach: unknown }).reach).slice(0, 900)}`);
      return j.score;
    };
    expect(await score('link')).toBeLessThan(1);
    // Ticket 1: VLAN 99 on both; the supervised application binds as soon as the address exists.
    await run('vm1', 'ip link add link eth0 name eth0.99 type vlan id 99 && ip addr add 10.99.0.1/24 dev eth0.99 && ip link set eth0.99 up');
    await run('vm2', 'ip link add link eth0 name eth0.99 type vlan id 99 && ip addr add 10.99.0.2/24 dev eth0.99 && ip link set eth0.99 up');
    await pause(5000);
    expect(await score('link')).toBe(1);
    // Ticket 2: a key and a request on vm1, signed on probe over SSH, nginx with TLS and a redirect.
    await run('vm1', "mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N '' -f /root/.ssh/id_ed25519");
    const pub = (await l.exec('vm1', 'cat /root/.ssh/id_ed25519.pub')).out.trim();
    await run('probe', `mkdir -p /root/.ssh && echo '${pub}' >> /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys`);
    await run('vm1', 'mkdir -p /etc/nginx/tls && cd /etc/nginx/tls && openssl req -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -keyout corp.key -out corp.csr -subj /CN=www.corp.lab -addext subjectAltName=DNS:www.corp.lab >/dev/null 2>&1');
    const t0 = performance.now();
    await run('vm1', 'cd /etc/nginx/tls && scp -q -o StrictHostKeyChecking=accept-new corp.csr root@10.0.0.13:/root/ && ssh root@10.0.0.13 dt-ca-sign /root/corp.csr && scp -q root@10.0.0.13:/root/corp.crt .');
    console.log(`[exam] scp + ssh + scp vm1 ↔ probe: ${Math.round(performance.now() - t0)} ms`);
    await run('vm1', `mv /etc/nginx/http.d/default.conf /root/default.conf.off 2>/dev/null; cat > /etc/nginx/http.d/corp.conf <<'EOF'
server { listen 80 default_server; return 301 https://www.corp.lab$request_uri; }
server {
  listen 443 ssl; server_name www.corp.lab;
  ssl_certificate /etc/nginx/tls/corp.crt; ssl_certificate_key /etc/nginx/tls/corp.key;
  location / { proxy_pass http://10.99.0.2:8080; }
  location /report { proxy_pass http://10.99.0.2:8080; proxy_read_timeout 90s; }
}
EOF
rc-service -q nginx start || { nginx -t -g 'pid /tmp/x.pid;' 2>&1; exit 1; }`);
    expect(await score('proxy')).toBe(1);
    // Ticket 3: DROP on both, open from VLAN 1 only what is needed, everything over VLAN 99.
    const fw = (ports: string) => `nft add table inet filter && nft add chain inet filter input '{ type filter hook input priority 0; policy accept; }' && nft add rule inet filter input ct state established,related accept && nft add rule inet filter input iif lo accept && nft add rule inet filter input iifname '\"eth0.99\"' accept && nft add rule inet filter input ip protocol icmp accept && nft add rule inet filter input tcp dport '{ ${ports} }' accept && nft chain inet filter input '{ policy drop; }'`;
    await run('vm1', fw('22, 80, 443'));
    await run('vm2', fw('22'));
    expect(await score('firewall')).toBe(1);
    // Ticket 4: vm2 → partner through vm1, rewritten to vm1's address.
    await run('vm2', 'ip route add 10.0.0.13/32 via 10.99.0.1');
    await run('vm1', 'sysctl -qw net.ipv4.ip_forward=1 && iptables -t nat -A POSTROUTING -s 10.99.0.0/24 -o eth0 -j MASQUERADE');
    expect(await score('egress')).toBe(1);
    // Ticket 6 (beyond the course).
    await run('vm1', 'nft insert rule inet filter input tcp dport 22 ct state new limit rate over 5/minute drop');
    expect(await score('ssh-limit')).toBe(1);
    expect(await score('firewall')).toBe(1);
    console.log(`[exam] rss ${rss()} MiB`);
    l.dispose();
  }, 900_000);
});
