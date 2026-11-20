// The third persona pass over the Networks block: the VPN diagram tells the
// truth about ordinary sites in both tunnel modes, the gateway break points to
// where it can be told apart, and the QUIC caption writes the round trips in
// words.

import { describe, expect, it } from 'vitest';
import type { Step } from '../src/core/types';
import { tlsModel } from '../src/blocks/networks/explainers/tcp';
import { vpnModel } from '../src/blocks/networks/explainers/vpn';

const ru = (v: string | { ru: string }) => (typeof v === 'string' ? v : v.ru);
const brokenStep = (steps: Step[]) => steps.find((s) => s.broken)!;

describe('the VPN diagram in both tunnel modes', () => {
  it('says that ordinary sites still open only for a split tunnel', () => {
    const split = brokenStep(vpnModel.run({ mode: 'split' }, new Set(['udp-blocked'])));
    const full = brokenStep(vpnModel.run({ mode: 'full' }, new Set(['udp-blocked'])));
    expect(ru(split.caption)).toContain('сайты по HTTPS при этом открываются');
    expect(ru(full.caption)).toContain('Обычные сайты тоже не открываются');
  });

  it('shows the wg show output the caption talks about', () => {
    const step = brokenStep(vpnModel.run({ mode: 'split' }, new Set(['udp-blocked'])));
    expect(step.broken!.message).toContain('transfer: 0 B received');
    expect(step.broken!.message).not.toContain('latest handshake');
  });

  it('sends the learner to the gateway to tell an unknown key from a filter', () => {
    const step = brokenStep(vpnModel.run({ mode: 'split' }, new Set(['no-peer'])));
    expect(ru(step.broken!.caption)).toContain('tcpdump -n udp port 51820');
  });
});

describe('the QUIC caption', () => {
  it('writes the number of round trips in words', () => {
    const steps = tlsModel.run({ rtt: 40, version: 'h3', reuse: false }, new Set());
    expect(ru(steps.find((s) => s.id === 'h3req')!.caption)).toMatch(/проходит два таких пути/);
  });
});
