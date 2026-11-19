// Integration test of tier B on the real emulator: boots the Buildroot kernel
// in v86 in-process (same host code as the browser worker), drives the
// learner's terminal and the service channel, collects facts, and connects
// two machines through dt-switch. It needs the assets from
// `npm run fetch:v86` and takes ~10–20 s, so it runs only on request:
//
//   V86_INTEGRATION=1 npx vitest run tests/v86-integration.test.ts

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { createHost } from '../src/engine/v86/host';
import { V86Machine, type MachineAssets, type TransportFactory } from '../src/engine/v86/machine';
import { connectMachine } from '../src/engine/v86/fabric';
import { L2Switch } from '../src/engine/v86/switch';

const root = fileURLToPath(new URL('..', import.meta.url));
const assets: MachineAssets = {
  wasm: `${root}node_modules/v86/build/v86.wasm`,
  bios: `${root}public/v86/seabios.bin`,
  vgaBios: `${root}public/v86/vgabios.bin`,
  bzimage: `${root}public/v86/buildroot-bzimage.bin`,
  kernelSha: 'test',
};
const enabled = !!process.env.V86_INTEGRATION && existsSync(assets.bzimage);

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

const machines: V86Machine[] = [];
const make = (o: ConstructorParameters<typeof V86Machine>[0] = {}) => {
  const m = new V86Machine({ transport: inProcess, assets, bootCache: false, ...o });
  machines.push(m);
  return m;
};

function nextPrompt(m: V86Machine, timeout = 20_000): Promise<{ exit: number; cwd: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no prompt')), timeout);
    const off = m.on((ev) => {
      if (ev.t !== 'cmd.done') return;
      clearTimeout(timer);
      off();
      resolve({ exit: ev.exit as number, cwd: ev.cwd as string });
    });
  });
}

afterAll(() => machines.forEach((m) => m.dispose()));

describe.skipIf(!enabled)('v86: a real Linux machine', () => {
  it('boots, keeps a terminal, a service channel and facts', async () => {
    const m = make({ identity: { hostname: 'lab' } });
    let screen = '';
    m.onOutput((t) => (screen += t));
    const boot = await m.start();
    expect(boot.kind).toBe('cold');
    console.log(`v86 cold start to prompt: ${boot.ms} ms`);

    const r = await m.exec('uname -m; hostname');
    expect(r.out).toMatch(/i686/);
    expect(r.out).toMatch(/lab/);

    // The learner types in the real terminal; the prompt marker reports the result.
    let done = nextPrompt(m);
    m.write('mkdir -p /root/demo/a && cd /root/demo\r');
    expect(await done).toEqual({ exit: 0, cwd: '/root/demo' });
    done = nextPrompt(m);
    m.write('ls /nope\r');
    expect((await done).exit).not.toBe(0);
    expect(screen).not.toContain('777;dt;');

    m.watchPredicates(["files['/root/demo/a'].type=d && files['/etc/hostname'].exists"]);
    const facts = await m.facts();
    expect(facts.env.kind).toBe('v86');
    expect(facts.cwd).toBe('/root/demo');
    expect(facts.files['/root/demo/a']).toMatchObject({ exists: true, type: 'd', uid: 0 });
    expect(facts.procs.some((p) => p.pid === 1)).toBe(true);
    expect(facts.procs.some((p) => p.argv.join(' ').includes('ttyS1'))).toBe(false);
    const term = facts.term.main;
    expect(term.at(-2)).toMatchObject({ line: 'mkdir -p /root/demo/a && cd /root/demo', exit: 0 });
    expect(term.at(-1)?.out).toMatch(/No such file/);
    expect(evaluateCheck({ when: "files['/root/demo/a'].type=d && term['main'][last].exit!=0" }, facts).pass).toBe(true);

    // Snapshot and restore bring the file system back.
    const snap = await m.snapshot();
    await m.exec('rm -r /root/demo');
    expect((await m.exec('ls /root')).out).not.toContain('demo');
    await m.restore(snap);
    expect((await m.exec('ls /root')).out).toContain('demo');
  }, 120_000);

  it('connects two machines through the learning switch', async () => {
    const sw = new L2Switch();
    const a = make({ id: 'node-1', identity: { hostname: 'node-1', ip: '10.0.0.11/24', mac: '02:64:74:00:00:01' } });
    const b = make({ id: 'node-2', identity: { hostname: 'node-2', ip: '10.0.0.12/24', mac: '02:64:74:00:00:02' } });
    connectMachine(sw, a, { mode: 'access' });
    connectMachine(sw, b, { mode: 'access' });
    await Promise.all([a.start(), b.start()]);
    const r = await b.exec('ping -c 2 -W 2 10.0.0.11');
    expect(r.exit).toBe(0);
    expect(r.out).toMatch(/2 packets received|2 received/);
    const table = sw.table().map((e) => `${e.mac}@${e.port}`);
    expect(table).toContain('02:64:74:00:00:01@node-1');
    expect(table).toContain('02:64:74:00:00:02@node-2');
  }, 120_000);
});
