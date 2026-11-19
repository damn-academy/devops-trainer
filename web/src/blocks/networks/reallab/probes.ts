// Probes of the real-Linux network labs: what one lab machine sees when it
// tries to reach another (design 00 §6.13). Each probe is one shell command
// run as root on the service channel of the machine it starts from, never in
// the learner's terminal; its output is parsed into `reach[<id>]` of that
// machine's facts, the same field names the real-VM collector prints
// (app/real/trainer-check-host.sh): `ok`, `status`, `connected`, `error`,
// `body`. A check therefore reads what the network really did: a DROP shows
// up as `error = timeout`, a REJECT as `refused`.
//
// Pure: the command builders and parsers are unit-tested against recorded
// output of the lab image (Alpine 3.24, bash, curl, iputils, bind-tools).

export type ProbeKind = 'ping' | 'tcp' | 'http' | 'dns' | 'cmd';

export interface ProbeSpec {
  id: string;
  kind: ProbeKind;
  /** The machine the probe starts from. */
  from: string;
  /** Run inside this network namespace of `from` (`ip netns exec`). */
  ns?: string;
  /** ping/tcp/dns: host name or address; http: the URL. */
  to?: string;
  port?: number;
  /** dns: the server to ask (`@server`); default the resolver of `from`. */
  server?: string;
  /** http: extra curl arguments, e.g. ['--resolve', 'www.corp.lab:443:10.0.0.11', '--cacert', '/root/ca/ca.crt']. */
  curl?: string[];
  /** cmd: any read-only command; its output and exit code are the result. */
  cmd?: string;
  /** Seconds before the probe gives up (default 3; http 5). */
  timeout?: number;
}

export interface ProbeResult {
  kind: ProbeKind;
  ok: boolean;
  /** http: the status code (0 when no answer). */
  status?: number;
  /** tcp: the three-way handshake completed. */
  connected?: boolean;
  /** 'timeout' (silence: DROP, no route back), 'refused' (RST or REJECT), 'unreachable', 'dns', 'tls', or the tool's message. */
  error?: string;
  /** http: the start of the body; cmd: the output. */
  body?: string;
  out?: string;
  exit?: number;
  /** dns: the answers of `dig +short`. */
  answers?: string[];
  /** ping: the round-trip time in ms. */
  rtt?: number;
}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const MARK = '@@DT-PROBE';
const ERR = '@@DT-ERR';

/** The shell line of one probe; prints `@@DT-PROBE rc=<code>` after the tool's output. */
export function probeCommand(p: ProbeSpec): string {
  const t = p.timeout ?? (p.kind === 'http' ? 5 : 3);
  const pre = p.ns ? `ip netns exec ${q(p.ns)} ` : '';
  let body: string;
  switch (p.kind) {
    case 'ping':
      body = `${pre}ping -n -c 1 -W ${t} ${q(p.to ?? '')} 2>&1`;
      break;
    case 'tcp':
      // bash's /dev/tcp opens a real connection; timeout's 124 means nobody answered.
      body = `${pre}timeout ${t} bash -c ${q(`exec 3<>/dev/tcp/${p.to}/${p.port}`)} 2>&1`;
      break;
    case 'http':
      // The status line first, then the body, then curl's own error message after a marker.
      body = `${pre}curl -sS -m ${t} -o /tmp/.dt-probe-body -w '%{http_code}\\n' ${(p.curl ?? []).map(q).join(' ')} ${q(p.to ?? '')} 2>/tmp/.dt-probe-err; rc=$?; head -c 2000 /tmp/.dt-probe-body 2>/dev/null; echo; echo "${ERR}"; cat /tmp/.dt-probe-err; rm -f /tmp/.dt-probe-body /tmp/.dt-probe-err; (exit $rc)`;
      break;
    case 'dns':
      body = `${pre}dig +short +time=${t} +tries=1 ${p.server ? '@' + q(p.server) + ' ' : ''}${q(p.to ?? '')} 2>&1`;
      break;
    case 'cmd':
      body = `${pre}timeout ${t} sh -c ${q(p.cmd ?? 'true')} 2>&1`;
      break;
  }
  return `${body}; echo "${MARK} rc=$?"`;
}

function classify(text: string, rc: number): string {
  if (rc === 124 || rc === 28 || /timed out|Timeout was reached/i.test(text)) return 'timeout';
  if (/refused/i.test(text) || rc === 7) return 'refused';
  if (/No route to host|Network is unreachable|Destination Host Unreachable/i.test(text)) return 'unreachable';
  if (/Could not resolve|Name or service not known|Unknown host|bad address/i.test(text) || rc === 6) return 'dns';
  if (/SSL|certificate|TLS/i.test(text) || rc === 35 || rc === 51 || rc === 60) return 'tls';
  return text.trim().split('\n').pop()?.slice(0, 120) || `exit ${rc}`;
}

/** Parse what probeCommand printed. */
export function parseProbe(p: ProbeSpec, raw: string): ProbeResult {
  const text = raw.replace(/\r/g, '');
  const at = text.lastIndexOf(MARK);
  const rc = at >= 0 ? Number(/rc=(\d+)/.exec(text.slice(at))?.[1] ?? 1) : 1;
  const out = (at >= 0 ? text.slice(0, at) : text).replace(/\n$/, '');
  switch (p.kind) {
    case 'ping': {
      const rtt = /time[=<]([\d.]+)\s*ms/.exec(out);
      return rc === 0 ? { kind: 'ping', ok: true, rtt: rtt ? Number(rtt[1]) : undefined } : { kind: 'ping', ok: false, error: /unreachable/i.test(out) ? 'unreachable' : /bad address|Name|resolve/i.test(out) ? 'dns' : 'timeout' };
    }
    case 'tcp':
      return rc === 0 ? { kind: 'tcp', ok: true, connected: true } : { kind: 'tcp', ok: false, connected: false, error: classify(out, rc) };
    case 'http': {
      const e = out.lastIndexOf(ERR);
      const main = e >= 0 ? out.slice(0, e) : out;
      const err = e >= 0 ? out.slice(e + ERR.length).trim() : '';
      const nl = main.indexOf('\n');
      const status = Number(/^(\d{3})/.exec(main.trim())?.[1] ?? 0);
      const body = nl < 0 ? '' : main.slice(nl + 1).replace(/\n$/, '');
      if (rc === 0 && status > 0) return { kind: 'http', ok: status >= 200 && status < 400, status, body };
      return { kind: 'http', ok: false, status, body, error: classify(err, rc) };
    }
    case 'dns': {
      const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
      const failed = rc !== 0 || lines.some((l) => /^;;|connection timed out|no servers could be reached/i.test(l));
      const answers = failed ? [] : lines;
      return { kind: 'dns', ok: answers.length > 0, answers, error: failed ? classify(out, rc === 0 ? 124 : rc) : answers.length ? undefined : 'nxdomain' };
    }
    case 'cmd':
      return { kind: 'cmd', ok: rc === 0, exit: rc, out, body: out };
  }
}

/** Run probes on machines; probes from one machine run in order, machines in parallel. */
export async function runProbes(
  probes: ProbeSpec[],
  exec: (machine: string, cmd: string) => Promise<{ out: string; exit: number }>,
): Promise<Record<string, Record<string, ProbeResult>>> {
  const byFrom = new Map<string, ProbeSpec[]>();
  for (const p of probes) byFrom.set(p.from, [...(byFrom.get(p.from) ?? []), p]);
  const out: Record<string, Record<string, ProbeResult>> = {};
  await Promise.all(
    [...byFrom].map(async ([from, list]) => {
      const res: Record<string, ProbeResult> = (out[from] = {});
      for (const p of list) {
        try {
          res[p.id] = parseProbe(p, (await exec(from, probeCommand(p))).out);
        } catch (e) {
          res[p.id] = { kind: p.kind, ok: false, error: (e as Error).message };
        }
      }
    }),
  );
  return out;
}
