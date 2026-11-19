// The Networks exam, part B, on real machines: it follows the exam frame, its
// scripts are valid bash, the read-only collector really prints a block the
// page can decode, and every goal fails on the machines right after the
// preparation and holds on machines in the solved state — with targeted
// explanations for the tempting mistakes.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLLECTOR_TEXT } from '../src/app/real/panel';
import { collectorCommand, decodeHostBlob, hostFacts, hostProblems, judgePaste, nginxLocations, parseSs, parseWg } from '../src/app/real/facts';
import { examB } from '../src/blocks/networks/exam-b';
import { lintRegistry } from '../src/core/lint';
import { registry } from '../src/core/registry';
import { lintExam } from '../src/engine/quiz/exam';
import { blob, failing, machines, NONCE, printed, realTask, say } from './real-blob';

const VM1 = '10.0.0.11';
const VM2 = '10.0.0.12';
const PROBE = '10.0.0.13';

const ipAddr = (eth: string, wg?: string) =>
  JSON.stringify([
    { ifindex: 1, ifname: 'lo', mtu: 65536, operstate: 'UNKNOWN', addr_info: [{ family: 'inet', local: '127.0.0.1', prefixlen: 8 }] },
    { ifindex: 2, ifname: 'eth0', mtu: 1500, operstate: 'UP', addr_info: [{ family: 'inet', local: eth, prefixlen: 24 }] },
    ...(wg ? [{ ifindex: 3, ifname: 'wg0', mtu: 1420, operstate: 'UNKNOWN', addr_info: [{ family: 'inet', local: wg, prefixlen: 24 }] }] : []),
  ]);

const WG1 = 'wg0\t(hidden)\tPUB1=\t51820\toff\nwg0\tPUB2=\t(hidden)\t10.0.0.12:51820\t10.99.0.2/32\t1763467190\t9120\t8812\t25';
const WG2 = 'wg0\t(hidden)\tPUB2=\t51820\toff\nwg0\tPUB1=\t(hidden)\t10.0.0.11:51820\t0.0.0.0/0\t1763467195\t8812\t9120\t25';
const SS2 = 'tcp   LISTEN 0      5          10.99.0.2:8080       0.0.0.0:*    users:(("python3",pid=812,fd=3))\ntcp   LISTEN 0      5            0.0.0.0:9100       0.0.0.0:*    users:(("python3",pid=813,fd=3))\ntcp   LISTEN 0      128          0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=611,fd=3))\nudp   UNCONN 0      0            0.0.0.0:51820      0.0.0.0:*';

const NFT1 = `table inet filter {
	chain input {
		type filter hook input priority filter; policy drop;
		iif "lo" accept
		ct state established,related accept
		tcp dport 22 ct state new meter ssh4 { ip saddr limit rate 5/minute } accept
		tcp dport { 80, 443 } accept
		udp dport 51820 accept
		iifname "wg0" accept
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
		ct state established,related accept
		iifname "wg0" oifname "eth0" accept
	}
}
table ip nat {
	chain postrouting {
		type nat hook postrouting priority srcnat; policy accept;
		oifname "eth0" ip saddr 10.99.0.0/24 masquerade
	}
}`;
const NFT2 = `table inet filter {
	chain input {
		type filter hook input priority filter; policy drop;
		iif "lo" accept
		ct state established,related accept
		tcp dport 22 accept
		udp dport 51820 accept
		iifname "wg0" accept
	}
}`;

const NGINX_SOLVED = `# configuration file /etc/nginx/sites-enabled/corp:
server {
    listen 80;
    server_name www.corp.lab;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name www.corp.lab;
    ssl_certificate /etc/nginx/tls/www.crt;
    ssl_certificate_key /etc/nginx/tls/www.key;
    location / {
        proxy_pass http://10.99.0.2:8080;
    }
    location /report {
        proxy_pass http://10.99.0.2:8080;
        proxy_read_timeout 90s;
    }
}`;

/** The three machines right after the preparation scripts: tunnel and application up, nothing else done. */
function start() {
  return [
    blob('vm1', 'net-b', { raw: { ip_addr: ipAddr(VM1, '10.99.0.1'), ip_forward: '0', ss: 'tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=600,fd=3))', nft: '', iptables: '', wg: WG1 }, probes: { tun: { kind: 'icmp', to: '10.99.0.2', received: 3 }, app: { kind: 'http', to: 'http://10.99.0.2:8080/', status: 200, body: '{}' }, exporter: { kind: 'tcp', to: '10.99.0.2', port: 9100, connected: true } }, files: { '/root/504.txt': { exists: false } } }),
    blob('vm2', 'net-b', { raw: { ip_addr: ipAddr(VM2, '10.99.0.2'), ip_forward: '0', ss: SS2, nft: '', iptables: '', wg: WG2 }, files: { '/etc/dt-stub/delay': { exists: true, type: 'f', mode: '644', owner: 'root', group: 'root', size: 2, text: '3\n' } }, probes: { partner: { kind: 'http', to: `http://${PROBE}:8081/`, status: 200, body: `${VM2}\n` } } }),
    blob('probe', 'net-b', {
      probes: {
        portal: { kind: 'http', status: 0, error: 'curl: (7) Failed to connect to www.corp.lab port 443' },
        report: { kind: 'http', status: 0, error: 'curl: (7) Failed to connect' },
        plain: { kind: 'http', status: 0, error: 'curl: (7) Failed to connect' },
        ssh1: { kind: 'tcp', connected: true },
        closed1: { kind: 'tcp', connected: false, error: 'refused' },
        ssh2: { kind: 'tcp', connected: true },
        exporter2: { kind: 'tcp', connected: true },
      },
    }),
  ];
}

/** The machines after a reference solution of every ticket (the fault is on and fixed). */
function solved() {
  return [
    blob('vm1', 'net-b', {
      raw: { ip_addr: ipAddr(VM1, '10.99.0.1'), ip_forward: '1', ss: 'tcp LISTEN 0 511 0.0.0.0:443 0.0.0.0:* users:(("nginx",pid=900,fd=6))', nft: NFT1, iptables: '', wg: WG1, nginx_T: NGINX_SOLVED, nginx_t: 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\nexit=0' },
      probes: { tun: { kind: 'icmp', received: 3 }, app: { kind: 'http', status: 200 }, exporter: { kind: 'tcp', connected: true } },
      files: { '/root/504.txt': { exists: true, type: 'f', mode: '644', owner: 'root', group: 'root', size: 200, text: '2026/11/18 12:31:02 [error] 902#902: *7 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 10.0.0.13, server: www.corp.lab, request: "GET /report HTTP/1.1", upstream: "http://10.99.0.2:8080/report"\n' } },
    }, '2026-11-18T12:40:00Z'),
    blob('vm2', 'net-b', { raw: { ip_addr: ipAddr(VM2, '10.99.0.2'), ip_forward: '0', ss: SS2, nft: NFT2, iptables: '', wg: WG2 }, files: { '/etc/dt-stub/delay': { exists: true, type: 'f', mode: '644', owner: 'root', group: 'root', size: 3, text: '70\n' } }, probes: { partner: { kind: 'http', status: 200, body: `${VM1}\n` } } }, '2026-11-18T12:41:00Z'),
    blob('probe', 'net-b', {
      probes: {
        portal: { kind: 'http', status: 200, body: '{"service":"orders"}' },
        report: { kind: 'http', status: 200, seconds: '70.2', body: '{"report":"ready"}' },
        plain: { kind: 'http', status: 301 },
        ssh1: { kind: 'tcp', connected: true },
        closed1: { kind: 'tcp', connected: false, error: 'timeout' },
        ssh2: { kind: 'tcp', connected: true },
        exporter2: { kind: 'tcp', connected: false, error: 'timeout' },
      },
    }, '2026-11-18T12:45:00Z'),
  ];
}

describe('networks exam part B (real machines)', () => {
  it('is registered and follows the exam frame', () => {
    expect(registry.exams.get('networks.exam.machines')).toBe(examB);
    expect(lintExam(examB)).toEqual([]);
    expect(lintRegistry(registry).filter((i) => i.level === 'error' && i.where.includes('networks.exam.machines'))).toEqual([]);
  });

  it('its scripts are valid bash and the collector is read-only in what it runs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dt-net-b-'));
    for (const s of [...(examB.real!.prepare ?? []), { name: 'trainer-check-host.sh', text: COLLECTOR_TEXT }]) {
      const p = join(dir, s.name);
      writeFileSync(p, s.text);
      expect(() => execFileSync('bash', ['-n', p])).not.toThrow();
    }
    // The collector never writes outside its temporary body file and never changes the system.
    expect(COLLECTOR_TEXT).not.toMatch(/\b(rm -rf|systemctl (start|stop|restart|enable|disable)|nft (add|delete|flush)|iptables -[ADIF]|sysctl -w|useradd|chmod|chown)\b/);
  });

  it('the collector prints a block the page decodes (run here with probes to closed local ports)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dt-collect-'));
    const script = join(dir, 'trainer-check-host.sh');
    writeFileSync(script, COLLECTOR_TEXT);
    writeFileSync(join(dir, 'note.txt'), 'a "quoted" line\twith a tab\n');
    const out = execFileSync('bash', [script, '--nonce', NONCE, '--machine', 'vm1', '--track', 'net-b', '--file', join(dir, 'note.txt'), '--file', join(dir, 'missing'), '--tree', dir, '--tcp', 'closed,127.0.0.1,1', '--http', 'web,http://127.0.0.1:1/,timeout=2'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const f = hostFacts(await decodeHostBlob(out));
    expect(hostProblems(f, { nonce: NONCE, machine: 'vm1', track: 'net-b' })).toEqual([]);
    expect((f.files[join(dir, 'note.txt')] as { text?: string }).text).toBe('a "quoted" line\twith a tab');
    expect(f.files[join(dir, 'missing')]).toBeUndefined();
    expect(((f.reach as Record<string, { connected?: boolean }>).closed).connected).toBe(false);
    expect(((f.reach as Record<string, { status?: number }>).web).status).toBe(0);
    expect(((f.trees as Record<string, string>)[dir] ?? '').length).toBe(64);
  });

  it('a block from another machine, another attempt or the simulator is refused', async () => {
    const f = hostFacts(await decodeHostBlob(printed({ ...start()[0], nonce: 'other', machine: 'vm2', kernel: '6.12.0-dt-sim' })));
    expect(hostProblems(f, { nonce: NONCE, machine: 'vm1', track: 'net-b' }).length).toBe(3);
    await expect(decodeHostBlob('-----BEGIN TRAINER FACTS-----\nnot base64!\n-----END TRAINER FACTS-----')).rejects.toThrow();
  });

  it('the collector command fills in the typed addresses and quotes what needs quoting', () => {
    const cmd = collectorCommand(examB.real!.machines.find((m) => m.id === 'probe')!, { nonce: NONCE, track: 'net-b', addresses: { vm1: VM1, vm2: VM2 } });
    expect(cmd).toContain(`--http portal,https://www.corp.lab/,resolve=www.corp.lab:443:${VM1},cacert=/root/ca/ca.crt`);
    expect(cmd).toContain(`--tcp exporter2,${VM2},9100`);
    expect(collectorCommand(examB.real!.machines[0], { nonce: NONCE, track: 'net-b', addresses: {} })).toContain('--machine vm1');
    expect(collectorCommand(examB.real!.machines[2], { nonce: NONCE, track: 'net-b', addresses: {} })).toContain('VM1_ADDR');
  });

  it('parsers read ss, wg and nginx as the real tools print them', () => {
    expect(parseSs(SS2)[0]).toEqual({ proto: 'tcp', addr: '10.99.0.2', port: 8080, proc: 'python3', pid: 812 });
    expect(parseWg(WG1).peers[0]).toMatchObject({ publicKey: 'PUB2=', allowedIps: ['10.99.0.2/32'], handshake: 1763467190 });
    expect(nginxLocations(NGINX_SOLVED).length).toBe(2);
  });

  it('after the preparation only the tunnel ticket holds; the rest is still to do', async () => {
    const m = await machines(examB, start());
    expect(failing(examB, 'tunnel', m)).toEqual([]);
    for (const id of ['proxy', 'firewall', 'egress', 'fault504', 'ssh-limit']) expect(failing(examB, id, m).length, id).toBeGreaterThan(0);
    expect(failing(examB, 'proxy', m)).toEqual(['conf', 'portal', 'redirect']);
    expect(failing(examB, 'egress', m)).toEqual(['forward', 'masq', 'seen']);
    expect(say(examB, 'egress', 'seen', m)).toMatch(/directly, around the tunnel/);
    expect(say(examB, 'firewall', 'exp-out', m)).toMatch(/input interface/);
  });

  it('every goal holds on the solved machines', async () => {
    const m = await machines(examB, solved());
    for (const t of examB.tasks) if (t.kind === 'real' && t.real.goals) expect([t.id, failing(examB, t.id, m)]).toEqual([t.id, []]);
  });

  it('a timeout raised for the whole site does not count and is explained', async () => {
    const s = solved();
    s[0].raw.nginx_T = NGINX_SOLVED.replace('server {\n    listen 443 ssl;', 'proxy_read_timeout 120s;\nserver {\n    listen 443 ssl;');
    const m = await machines(examB, s);
    expect(failing(examB, 'fault504', m)).toEqual(['local']);
    expect(say(examB, 'fault504', 'local', m)).toMatch(/whole site/);
  });

  it('a report probe taken before the fault was switched on does not count', async () => {
    const s = solved();
    s[2].collectedAt = '2026-11-18T12:30:00Z';
    const m = await machines(examB, s);
    expect(failing(examB, 'fault504', m)).toEqual(['report']);
  });

  it('the tunnel address seen by the partner means the NAT is missing', async () => {
    const s = solved();
    s[1].probes.partner = { kind: 'http', status: 200, body: '10.99.0.2\n' };
    const m = await machines(examB, s);
    expect(say(examB, 'egress', 'seen', m)).toMatch(/source was not rewritten/);
  });

  it('the cleanup accepts the usual confirmations and nothing else', () => {
    const t = realTask(examB, 'cleanup');
    expect(judgePaste(t, 'Destroy complete! Resources: 3 destroyed.')).toBe(true);
    expect(judgePaste(t, 'No resources found in tenant-learner namespace.')).toBe(true);
    expect(judgePaste(t, '[]\n')).toBe(true);
    expect(judgePaste(t, 'Destroy complete! Resources: 0 destroyed.')).toBe(false);
    expect(judgePaste(t, '[{"name":"vm1"}]')).toBe(false);
  });
});
