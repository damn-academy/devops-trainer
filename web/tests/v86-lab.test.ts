import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
// @ts-expect-error The build helpers are native Node ESM.
import { parseApkIndex, parseDep, Index, resolve, apkChecksum, gzipMembers } from '../scripts/build-lab-image.lib.mjs';
import { CHUNK, SparseDisk } from '../src/engine/v86/sparse-disk';
import { identityScript, isBootable } from '../src/engine/v86/machine';
import { labFactsScript, parseLabFacts, scopesOf } from '../src/engine/v86/lab-facts';

const section = (name: string, text: string) => `\x1eS${name}\r\n${text}\r\n`;

describe('Alpine image helpers', () => {
  it('parses package metadata, virtual providers and install_if', () => {
    expect(parseApkIndex('P:nginx\nV:1.2-r0\nA:x86\nC:Q1abc\nS:123\nI:456\nD:so:libc !apache\np:cmd:nginx=1.2\ni:openrc nginx\nk:10\n\ninvalid\n')).toEqual([
      { name: 'nginx', version: '1.2-r0', arch: 'x86', checksum: 'Q1abc', size: 123, isize: 456, deps: ['so:libc', '!apache'], provides: ['cmd:nginx=1.2'], installIf: ['openrc', 'nginx'], priority: 10 },
    ]);
    expect(parseDep('!foo>=1.0')).toEqual({ name: 'foo', conflict: true, op: '>=', version: '1.0' });
  });
  it('resolves providers, cycles and transitive install_if in dependency order', () => {
    const index = new Index().add(parseApkIndex('P:app\nD:so:libc openrc !bad\n\nP:musl\np:so:libc\n\nP:openrc\nD:cycle\n\nP:cycle\nD:openrc\n\nP:app-openrc\ni:app openrc\n\nP:extra\ni:app-openrc\n'), 'main');
    const names = resolve(index, ['app']).map((p: { name: string }) => p.name);
    expect(new Set(names)).toEqual(new Set(['app', 'musl', 'openrc', 'cycle', 'app-openrc', 'extra']));
    expect(names.indexOf('musl')).toBeLessThan(names.indexOf('app'));
    expect(resolve(index, ['app'], { exclude: ['extra'] }).some((p: { name: string }) => p.name === 'extra')).toBe(false);
    expect(() => resolve(index, ['missing'])).toThrow('missing (needed by the image)');
  });
  it('prefers the first repository and an already chosen virtual provider', () => {
    const index = new Index().add(parseApkIndex('P:a\nV:1\np:virtual\nk:1\n\nP:b\np:virtual\nk:2\n'), 'main');
    index.add(parseApkIndex('P:a\nV:2\np:virtual\n'), 'other');
    expect(index.provider('a').version).toBe('1');
    expect(index.provider('virtual').name).toBe('b');
    expect(index.provider('virtual', new Set(['a'])).name).toBe('a');
  });
  it('checks the compressed control member, detecting changes to it', () => {
    const control = gzipSync('package metadata');
    const archive = Buffer.concat([gzipSync('signature'), control, gzipSync('files')]);
    const members = gzipMembers(archive);
    expect(members.map((m: { data: Buffer }) => m.data.toString())).toEqual(['signature', 'package metadata', 'files']);
    const expected = 'Q1' + createHash('sha1').update(control).digest('base64');
    expect(apkChecksum(members[1].raw)).toBe(expected);
    expect(apkChecksum(gzipSync('tampered metadata'))).not.toBe(expected);
    expect(() => gzipMembers(Buffer.from('invalid'))).toThrow('not a gzip stream');
  });
});

describe('sparse disk', () => {
  it('allocates only written chunks and reads across chunk boundaries', () => {
    const d = new SparseDisk(CHUNK * 3);
    d.set(0, new Uint8Array(CHUNK), () => {});
    expect(d.usedBytes).toBe(0);
    d.set(CHUNK - 2, Uint8Array.of(1, 2, 3, 4), () => {});
    d.get(CHUNK - 3, 6, (data) => expect([...data]).toEqual([0, 1, 2, 3, 4, 0]));
    expect(d.usedBytes).toBe(2 * CHUNK);
    expect(() => d.get(d.byteLength, 1, () => {})).toThrow();
    expect(() => d.set(d.byteLength, Uint8Array.of(1), () => {})).toThrow();
    expect(() => new SparseDisk(513)).toThrow();
  });
  it('round trips sparse state without sharing mutable bytes and detects the MBR', () => {
    const d = new SparseDisk(CHUNK * 4);
    d.set(CHUNK * 3, Uint8Array.of(42), () => {});
    expect(d.bootable()).toBe(false);
    d.set(510, Uint8Array.of(0x55, 0xaa), () => {});
    const state = d.get_state();
    expect([...state[1]]).toEqual([0, 3]);
    expect(isBootable(d.export())).toBe(true);
    const clone = new SparseDisk(512);
    clone.set_state(state);
    state[2].fill(0);
    expect(clone.bootable()).toBe(true);
    expect(clone.get_from_cache(CHUNK * 3, 1)[0]).toBe(42);
    clone.get_buffer((b) => expect(b).toBeUndefined());
  });
});

describe('lab facts', () => {
  it('parses network addresses, IPv6 listeners and malformed optional JSON', () => {
    const f = parseLabFacts(section('net.addr', '[{"ifname":"eth0","addr_info":[{"family":"inet","local":"10.0.0.12","prefixlen":24}]}]') + section('net.link', 'invalid') + section('listen', 'tcp LISTEN 0 128 [::]:22 [::]:* users:(("sshd",pid=42,fd=3))'));
    expect(f.net?.addrs[0].cidr).toBe('10.0.0.12/24');
    expect(f.net?.links).toEqual([]);
    expect(f.listen).toEqual([{ proto: 'tcp', addr: '::', port: 22, proc: 'sshd', pid: 42 }]);
    expect(parseLabFacts('noise')).toEqual({});
  });
  it('flattens disks, decodes mount paths and preserves service state over defaults', () => {
    const f = parseLabFacts(section('blk', '{"blockdevices":[{"name":"sda","path":"/dev/sda","type":"disk","size":"4096","children":[{"name":"sda1","path":"/dev/sda1","type":"part","size":2048,"fstype":"ext4"}]}]}') + section('mounts', '/dev/sda1 /srv/my\\040data ext4 rw,relatime 0 0') + section('fstab', '# comment\nUUID=abc /srv/my\\040data ext4 defaults 0 2') + section('svc.state', 'sshd = started\nsshd = stopped?\nnginx = stopped?') + section('svc.enabled', 'default sshd') + section('boot.cmdline', 'root=host9p') + section('boot.root', 'host9p 9p'));
    expect(f.blk?.map((d) => d.name)).toEqual(['sda', 'sda1']);
    expect(f.mounts?.[0].target).toBe('/srv/my data');
    expect(f.fstab?.[0]).toMatchObject({ src: 'UUID=abc', target: '/srv/my data', pass: 2 });
    expect(f.svc).toContainEqual({ name: 'sshd', state: 'started', runlevels: ['default'] });
    expect(f.boot?.rootfs).toBe('9p');
  });
  it('selects only requested scopes', () => {
    expect(scopesOf([undefined, "net.addrs[dev=eth0].cidr='x' && @start.svc[name=sshd].state=started", 'files[/a].exists'])).toEqual(['net', 'svc']);
    expect(labFactsScript(['unknown', 'dns'])).toContain('/etc/resolv.conf');
    expect(labFactsScript(['unknown'])).toBe('');
  });
});

describe('clone identity', () => {
  it('writes persistent static networking and regenerates SSH keys for clones', () => {
    const s = identityScript({ hostname: "node'2", ip: '10.0.0.12/24', mac: '02:00:00:00:00:02', gateway: '10.0.0.1', dns: '10.0.0.1', hosts: { node1: '10.0.0.11/24' } }, { sshd: true, newKeys: true });
    expect(s).toContain("hostname 'node'\\''2'");
    for (const value of ['/etc/machine-id', '/etc/network/interfaces', 'address 10.0.0.12/24', 'ip addr flush dev eth0', 'ip route replace default via 10.0.0.1', '10.0.0.11\tnode1', 'rm -f /etc/ssh/ssh_host_*', 'ssh-keygen', 'sshd reload']) expect(s).toContain(value);
  });
  it('uses DHCP when requested and keeps fresh boot keys', () => {
    const s = identityScript({ hostname: 'node', dhcp: true }, { sshd: true, newKeys: false });
    expect(s).toContain('iface eth0 inet dhcp');
    expect(s).toContain('udhcpc -i eth0');
    expect(s).not.toContain('ssh-keygen');
    expect(identityScript({ hostname: 'installer' }, { sshd: false, newKeys: true })).not.toContain('ssh-keygen');
  });
});

it('creates independent clone IDs and OpenSSH keys from host randomness', async () => {
  const { cloneIdentity } = await import('../src/engine/v86/clone-identity');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const a = await cloneIdentity(true);
  const b = await cloneIdentity(true);
  expect(a.machineId).toMatch(/^[a-f0-9]{32}$/);
  expect(a.machineId).not.toBe(b.machineId);
  expect(a.publicKey).not.toBe(b.publicKey);
  const dir = mkdtempSync(join(tmpdir(), 'dt-clone-key-'));
  try {
    const file = join(dir, 'key');
    writeFileSync(file, a.privateKey!, { mode: 0o600 });
    expect(execFileSync('ssh-keygen', ['-y', '-f', file], { encoding: 'utf8' }).trim()).toBe(a.publicKey);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const script = identityScript({ hostname: 'clone' }, { sshd: true, newKeys: true, random: a });
  expect(script).toContain(a.machineId);
  expect(script).toContain(a.privateKey!);
  expect(script).not.toContain('ssh-keygen');
});

it('parses LVM, firewall rules and DNS sections independently', () => {
  const f = parseLabFacts(
    section('lvm.pv', JSON.stringify({ report: [{ pv: [{ pv_name: '/dev/sda2', vg_name: 'vg0', pv_size: '200m' }] }] })) +
    section('lvm.vg', JSON.stringify({ report: [{ vg: [{ vg_name: 'vg0', vg_size: '200m', vg_free: '100m' }] }] })) +
    section('lvm.lv', JSON.stringify({ report: [{ lv: [{ lv_name: 'data', vg_name: 'vg0', lv_size: '100m', lv_path: '/dev/vg0/data' }] }] })) +
    section('fw.nft', JSON.stringify({ nftables: [{ rule: { family: 'inet', table: 'filter', chain: 'input', expr: [{ match: { left: { payload: { protocol: 'tcp', field: 'dport' } }, op: '==', right: 22 } }, { accept: null }] } }] })) +
    section('fw.ipt', '*filter\n:INPUT DROP [0:0]\n-A INPUT -p tcp --dport 22 -j ACCEPT\nCOMMIT') +
    section('dns', 'nameserver 10.0.0.1\nsearch lab example.test'),
  );
  expect(f.lvm?.pvs).toEqual([{ name: '/dev/sda2', vg: 'vg0', size: '200m' }]);
  expect(f.lvm?.lvs).toEqual([{ name: 'data', vg: 'vg0', size: '100m', path: '/dev/vg0/data' }]);
  expect(f.fw?.nft).toEqual([{ family: 'inet', table: 'filter', chain: 'input', rule: 'tcp dport 22 accept' }]);
  expect(f.fw?.iptables).toContainEqual({ table: 'filter', chain: 'INPUT', rule: 'policy DROP' });
  expect(f.dns).toEqual({ nameservers: ['10.0.0.1'], search: ['lab', 'example.test'] });
});
