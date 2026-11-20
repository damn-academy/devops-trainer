import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectFacts, detectLab, labBase, LAB_REMOVAL, vmForMachine, type LabStatus } from './client';

const status: LabStatus = {
  profile: 'standard',
  backend: 'qemu',
  agent: true,
  vms: [
    { name: 'learner', kind: 'learner', ip: '10.10.1.10', running: true, cpus: 1, memMiB: 1024 },
    { name: 'cp-1', kind: 'kubeadm', ip: '10.10.1.11', running: true, cpus: 2, memMiB: 2048 },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('local lab client', () => {
  it('uses the same origin when dtlab serves the page', () => {
    expect(labBase({ origin: 'http://127.0.0.1:7788', port: '7788' })).toBe('');
    expect(labBase({ origin: 'https://trainer.example', port: '' })).toBe('http://127.0.0.1:7788');
  });

  it('sends X-DTLab and returns the block', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get('X-DTLab')).toBe('1');
      expect(JSON.parse(String(init.body))).toMatchObject({ vm: 'cp-1', nonce: 'abc123' });
      return new Response(JSON.stringify({ block: '-----BEGIN TRAINER FACTS-----\nx\n-----END TRAINER FACTS-----' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const b = await collectFacts({ vm: 'cp-1', nonce: 'abc123' }, '');
    expect(b).toContain('BEGIN TRAINER FACTS');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/facts');
  });

  it('reports the lab error and no lab as null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'no VM "x"' }), { status: 502 })));
    await expect(collectFacts({ vm: 'x', nonce: 'abcd' }, '')).rejects.toThrow('no VM');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused'); }));
    expect(await detectLab('')).toBeNull();
  });

  it('maps exam machines to lab VMs', () => {
    expect(vmForMachine('cp-1', status)).toBe('cp-1');
    expect(vmForMachine('app-01', status)).toBe('learner');
  });

  it('explains down, destroy and uninstall', () => {
    expect(LAB_REMOVAL.map((r) => r.cmd)).toEqual(['dtlab down', 'dtlab destroy', 'dtlab uninstall']);
  });
});
