// Shared helpers of the netlab commands.

import type { CmdContext, ManPage } from '../../core/types';
import { netOf, type NetState } from './state';

export const man7 = (name: string, sec: number | string) => `https://man7.org/linux/man-pages/man${String(sec)[0]}/${name}.${sec}.html`;

export function page(name: string, sec: number | string, sections: ManPage['sections'], url = man7(name, sec), license = 'condensed from the Linux man-pages project and the upstream manual'): ManPage {
  return { section: sec, url, license, sections };
}

/** The network of this machine, with file-backed settings pulled in. */
export function net(ctx: CmdContext): NetState {
  const st = netOf(ctx.machine);
  st.pull();
  return st;
}

export function isRoot(ctx: CmdContext): boolean {
  return ctx.cred.uid === 0;
}

/**
 * The answer to a flag the simulator does not model. It does not list the
 * supported flags: such a list would be a hint and would cancel the forcing
 * step of the documentation ladder (03 §8.4).
 */
export function notSimulated(ctx: CmdContext, what: string): number {
  ctx.err(`netlab: ${what}: this option is not simulated here; open this lesson on a real machine (tier B) to try it\n`);
  return 64;
}

/** Milliseconds with three decimals as ping and traceroute print them. */
export function ms3(v: number): string {
  return v.toFixed(3);
}

/** A small deterministic jitter so repeated replies are not identical. */
export function jitter(base: number, i: number): number {
  const k = ((i * 2654435761) >>> 0) % 1000;
  return base * (1 + (k / 1000 - 0.5) * 0.08);
}

/** Pad to a width (left aligned). */
export function pad(s: string, n: number): string {
  return s.length >= n ? `${s} ` : s + ' '.repeat(n - s.length);
}

export const PORT_NAMES: Record<number, string> = {
  20: 'ftp-data',
  21: 'ftp',
  22: 'ssh',
  25: 'smtp',
  53: 'domain',
  67: 'bootps',
  68: 'bootpc',
  80: 'http',
  110: 'pop3',
  123: 'ntp',
  143: 'imap2',
  179: 'bgp',
  443: 'https',
  465: 'submissions',
  587: 'submission',
  853: 'domain-s',
  3306: 'mysql',
  5432: 'postgresql',
  6379: 'redis',
  8080: 'http-alt',
  9100: 'jetdirect',
};
