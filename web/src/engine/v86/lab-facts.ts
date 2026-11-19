// Facts of the "before Docker" lab (design 00 §6.13, dt.facts/v1 scopes):
// what a check needs to judge networking, disks, services and the firewall of
// a real Alpine machine by its state. Collected on the service channel by one
// script per request, only for the scopes a check reads; every scope is a
// flat array or object so predicates stay short:
//
//   net.addrs[dev=eth0].cidr = '10.0.0.11/24'    net.forward = 1
//   net.links[kind=bridge].name has br0           net.routes[dst=default].via = 10.0.0.1
//   listen[port=22].proc = sshd                   svc[name=nginx].state = started
//   blk[type=lvm].fstype = ext4                   mounts[target='/srv'].src ~ mapper
//   fstab[target='/srv'].src ~ 'UUID='            lvm.lvs[name=data].vg = vg0
//   fw.nft[chain=input].rule ~ 'tcp dport 22'     fw.iptables[table=nat].rule ~ MASQUERADE
//   boot.root = host9p                            dns.nameservers has 10.0.0.1
//
// Parsing is pure and unit-tested against recorded output.

export const LAB_SCOPES = ['net', 'listen', 'blk', 'mounts', 'fstab', 'lvm', 'svc', 'fw', 'dns', 'boot'] as const;
export type LabScope = (typeof LAB_SCOPES)[number];

const RS = '\x1e';
/** A section header, printed by the guest (no raw control bytes go through the tty). */
const H = (name: string) => `printf '\\036S${name}\\n'`;

/** Shell for each scope (Alpine with iproute2, util-linux, lvm2, OpenRC, nftables, iptables). */
const SCRIPTS: Record<LabScope, string> = {
  net: `${H('net.addr')}; ip -j addr 2>/dev/null; echo; ${H('net.link')}; ip -j -d link 2>/dev/null; echo; ${H('net.route')}; ip -j route 2>/dev/null; echo; ${H('net.forward')}; cat /proc/sys/net/ipv4/ip_forward; ${H('net.netns')}; ip netns list 2>/dev/null`,
  listen: `${H('listen')}; ss -Htulnp 2>/dev/null`,
  blk: `${H('blk')}; lsblk -J -b -o NAME,PATH,TYPE,SIZE,FSTYPE,UUID,LABEL,MOUNTPOINT,PKNAME,PARTTYPENAME 2>/dev/null`,
  mounts: `${H('mounts')}; cat /proc/mounts`,
  fstab: `${H('fstab')}; cat /etc/fstab 2>/dev/null`,
  // The LVM tools take about half a second each in emulation: run them only when there is an LVM physical volume.
  lvm: `if blkid -t TYPE=LVM2_member >/dev/null 2>&1; then ${H('lvm.pv')}; pvs --reportformat json -o pv_name,vg_name,pv_size 2>/dev/null; ${H('lvm.vg')}; vgs --reportformat json -o vg_name,vg_size,vg_free 2>/dev/null; ${H('lvm.lv')}; lvs --reportformat json -o lv_name,vg_name,lv_size,lv_path 2>/dev/null; else ${H('lvm.pv')}; fi`,
  // OpenRC keeps service states as files under /run/openrc; reading them is much cheaper than rc-status.
  svc: `${H('svc.state')}; for d in started inactive starting stopping failed; do for s in /run/openrc/$d/*; do [ -e "$s" ] && echo "\${s##*/} = $d"; done; done; for s in /etc/init.d/*; do echo "\${s##*/} = stopped?"; done; ${H('svc.enabled')}; for d in /etc/runlevels/*/; do l=\${d%/}; l=\${l##*/}; for s in "$d"*; do [ -e "$s" ] && echo "$l \${s##*/}"; done; done`,
  fw: `${H('fw.nft')}; nft -j list ruleset 2>/dev/null; echo; ${H('fw.ipt')}; iptables-save 2>/dev/null`,
  dns: `${H('dns')}; cat /etc/resolv.conf 2>/dev/null`,
  boot: `${H('boot.cmdline')}; cat /proc/cmdline; ${H('boot.root')}; awk '$2=="/"{print $1" "$3}' /proc/mounts | tail -1; ${H('boot.image')}; cat /etc/dt/image 2>/dev/null`,
};

export function labFactsScript(scopes: readonly string[]): string {
  return scopes
    .filter((s): s is LabScope => (LAB_SCOPES as readonly string[]).includes(s))
    .map((s) => SCRIPTS[s])
    .join('\n');
}

/** Scopes named as the first step of predicate strings ("net.addrs[...]" → net). */
export function scopesOf(predicates: (string | undefined)[]): LabScope[] {
  const out = new Set<LabScope>();
  for (const p of predicates) {
    if (!p) continue;
    for (const m of p.matchAll(/(?:^|[\s(!&|])(?:@start\.)?([a-z]+)(?=[.[#])/g)) {
      if ((LAB_SCOPES as readonly string[]).includes(m[1])) out.add(m[1] as LabScope);
    }
  }
  return [...out];
}

export interface LabFacts {
  net?: {
    addrs: { dev: string; family: 'inet' | 'inet6'; addr: string; prefix: number; cidr: string; scope?: string }[];
    links: { name: string; mac?: string; state: string; up: boolean; mtu?: number; kind?: string; master?: string; vlan?: number; peer?: string }[];
    routes: { dst: string; via?: string; dev?: string; src?: string; proto?: string }[];
    forward: number;
    netns: string[];
  };
  listen?: { proto: string; addr: string; port: number; proc?: string; pid?: number }[];
  blk?: { name: string; path: string; type: string; size: number; fstype?: string; uuid?: string; label?: string; mount?: string; parent?: string; parttype?: string }[];
  mounts?: { src: string; target: string; fstype: string; opts: string[] }[];
  fstab?: { src: string; target: string; fstype: string; opts: string[]; dump: number; pass: number }[];
  lvm?: { pvs: { name: string; vg: string; size: string }[]; vgs: { name: string; size: string; free: string }[]; lvs: { name: string; vg: string; size: string; path: string }[] };
  svc?: { name: string; state: string; runlevels: string[] }[];
  fw?: { nft: { family: string; table: string; chain?: string; rule: string }[]; nftRaw: unknown; iptables: { table: string; chain: string; rule: string }[] };
  dns?: { nameservers: string[]; search: string[] };
  boot?: { cmdline: string; root: string; rootfs: string; image?: Record<string, unknown> };
}

function sections(out: string): Map<string, string> {
  const m = new Map<string, string>();
  const parts = out.replace(/\r/g, '').split(RS + 'S');
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n');
    const name = (nl < 0 ? part : part.slice(0, nl)).trim();
    m.set(name, nl < 0 ? '' : part.slice(nl + 1));
  }
  return m;
}

function json<T>(s: string | undefined, fallback: T): T {
  if (!s || !s.trim()) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

type IpAddr = { ifname: string; addr_info?: { family: string; local: string; prefixlen: number; scope?: string }[] };
type IpLink = {
  ifname: string;
  address?: string;
  operstate?: string;
  flags?: string[];
  mtu?: number;
  master?: string;
  link?: string;
  linkinfo?: { info_kind?: string; info_data?: { id?: number } };
};
type IpRoute = { dst: string; gateway?: string; dev?: string; prefsrc?: string; protocol?: string };

/** Turn the `nft -j list ruleset` JSON into one line per rule, close to `nft list` syntax. */
export function nftRules(raw: unknown): { family: string; table: string; chain?: string; rule: string }[] {
  const items = (raw as { nftables?: Record<string, unknown>[] } | null)?.nftables ?? [];
  const out: { family: string; table: string; chain?: string; rule: string }[] = [];
  const expr = (e: unknown): string => {
    if (e === null || typeof e !== 'object') return String(e);
    const o = e as Record<string, unknown>;
    if ('match' in o) {
      const m = o.match as { left: unknown; right: unknown; op: string };
      return `${val(m.left)} ${m.op === '==' ? '' : m.op + ' '}${val(m.right)}`.replace(/\s+/g, ' ');
    }
    const k = Object.keys(o)[0];
    const v = o[k];
    if (v === null) return k;
    if (k === 'counter') return 'counter';
    if (k === 'jump' || k === 'goto') return `${k} ${(v as { target: string }).target}`;
    if (k === 'masquerade' || k === 'accept' || k === 'drop' || k === 'return' || k === 'reject') return k;
    if (k === 'snat' || k === 'dnat') {
      const t = v as { addr?: unknown; port?: unknown };
      return `${k} to ${val(t.addr ?? '')}${t.port !== undefined ? ':' + val(t.port) : ''}`;
    }
    if (k === 'log') return 'log';
    return `${k} ${val(v)}`;
  };
  const val = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'object') return String(v);
    if (Array.isArray(v)) return v.map(val).join(' ');
    const o = v as Record<string, unknown>;
    if ('payload' in o) {
      const p = o.payload as { protocol: string; field: string };
      return `${p.protocol} ${p.field}`;
    }
    if ('meta' in o) return `meta ${(o.meta as { key: string }).key}`;
    if ('ct' in o) return `ct ${(o.ct as { key: string }).key}`;
    if ('set' in o) return `{ ${(o.set as unknown[]).map(val).join(', ')} }`;
    if ('prefix' in o) {
      const p = o.prefix as { addr: string; len: number };
      return `${p.addr}/${p.len}`;
    }
    if ('range' in o) return (o.range as unknown[]).map(val).join('-');
    return JSON.stringify(v);
  };
  for (const it of items) {
    if (it.chain) {
      const c = it.chain as { family: string; table: string; name: string; hook?: string; policy?: string; type?: string };
      out.push({ family: c.family, table: c.table, chain: c.name, rule: `chain ${c.name}${c.hook ? ` type ${c.type} hook ${c.hook}` : ''}${c.policy ? ` policy ${c.policy}` : ''}` });
    } else if (it.rule) {
      const r = it.rule as { family: string; table: string; chain: string; expr: unknown[] };
      out.push({ family: r.family, table: r.table, chain: r.chain, rule: (r.expr ?? []).map(expr).join(' ').replace(/\s+/g, ' ').trim() });
    } else if (it.table) {
      const t = it.table as { family: string; name: string };
      out.push({ family: t.family, table: t.name, rule: `table ${t.family} ${t.name}` });
    }
  }
  return out;
}

/** Parse what labFactsScript printed into the lab scopes. */
export function parseLabFacts(out: string): LabFacts {
  const s = sections(out);
  const f: LabFacts = {};
  if (s.has('net.addr')) {
    const addrs = json<IpAddr[]>(s.get('net.addr'), []).flatMap((a) =>
      (a.addr_info ?? []).map((i) => ({ dev: a.ifname, family: i.family as 'inet' | 'inet6', addr: i.local, prefix: i.prefixlen, cidr: `${i.local}/${i.prefixlen}`, scope: i.scope })),
    );
    const links = json<IpLink[]>(s.get('net.link'), []).map((l) => ({
      name: l.ifname,
      mac: l.address,
      state: (l.operstate ?? 'UNKNOWN').toUpperCase(),
      up: (l.flags ?? []).includes('UP'),
      mtu: l.mtu,
      kind: l.linkinfo?.info_kind,
      master: l.master,
      vlan: l.linkinfo?.info_kind === 'vlan' ? l.linkinfo.info_data?.id : undefined,
      peer: l.link,
    }));
    const routes = json<IpRoute[]>(s.get('net.route'), []).map((r) => ({ dst: r.dst, via: r.gateway, dev: r.dev, src: r.prefsrc, proto: r.protocol }));
    const netns = (s.get('net.netns') ?? '').split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
    f.net = { addrs, links, routes, forward: Number((s.get('net.forward') ?? '0').trim()) || 0, netns };
  }
  if (s.has('listen')) {
    f.listen = [];
    for (const line of (s.get('listen') ?? '').split('\n')) {
      // tcp   LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1234,fd=3))
      const w = line.trim().split(/\s+/);
      if (w.length < 5) continue;
      const local = w[4];
      const i = local.lastIndexOf(':');
      const addr = local.slice(0, i).replace(/^\[|\]$/g, '').replace(/%.*$/, '');
      const port = Number(local.slice(i + 1));
      const pm = /users:\(\("([^"]+)",pid=(\d+)/.exec(line);
      if (!Number.isFinite(port)) continue;
      f.listen.push({ proto: w[0], addr: addr === '*' ? '0.0.0.0' : addr, port, proc: pm?.[1], pid: pm ? Number(pm[2]) : undefined });
    }
  }
  if (s.has('blk')) {
    type Dev = { name: string; path: string; type: string; size: number | string; fstype?: string | null; uuid?: string | null; label?: string | null; mountpoint?: string | null; pkname?: string | null; parttypename?: string | null; children?: Dev[] };
    const flat: NonNullable<LabFacts['blk']> = [];
    const walk = (d: Dev) => {
      flat.push({
        name: d.name,
        path: d.path,
        type: d.type,
        size: Number(d.size) || 0,
        fstype: d.fstype ?? undefined,
        uuid: d.uuid ?? undefined,
        label: d.label ?? undefined,
        mount: d.mountpoint ?? undefined,
        parent: d.pkname ?? undefined,
        parttype: d.parttypename ?? undefined,
      });
      for (const c of d.children ?? []) walk(c);
    };
    for (const d of json<{ blockdevices?: Dev[] }>(s.get('blk'), {}).blockdevices ?? []) walk(d);
    f.blk = flat;
  }
  if (s.has('mounts')) {
    f.mounts = (s.get('mounts') ?? '')
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter((w) => w.length >= 4)
      .map((w) => ({ src: unescapeMount(w[0]), target: unescapeMount(w[1]), fstype: w[2], opts: w[3].split(',') }));
  }
  if (s.has('fstab')) {
    f.fstab = (s.get('fstab') ?? '')
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/))
      .filter((w) => w.length >= 3)
      .map((w) => ({ src: w[0], target: unescapeMount(w[1]), fstype: w[2], opts: (w[3] ?? 'defaults').split(','), dump: Number(w[4] ?? 0) || 0, pass: Number(w[5] ?? 0) || 0 }));
  }
  if (s.has('lvm.pv')) {
    type Rep = { report?: { pv?: Record<string, string>[]; vg?: Record<string, string>[]; lv?: Record<string, string>[] }[] };
    const pvs: NonNullable<LabFacts['lvm']>['pvs'] = [];
    const vgs: NonNullable<LabFacts['lvm']>['vgs'] = [];
    const lvs: NonNullable<LabFacts['lvm']>['lvs'] = [];
    const reports = ['lvm.pv', 'lvm.vg', 'lvm.lv'].flatMap((k) => json<Rep>(s.get(k), {}).report ?? []);
    for (const r of reports) {
      for (const p of r.pv ?? []) if (p.pv_name) pvs.push({ name: p.pv_name, vg: p.vg_name ?? '', size: p.pv_size ?? '' });
      for (const v of r.vg ?? []) if (v.vg_name && !vgs.some((x) => x.name === v.vg_name)) vgs.push({ name: v.vg_name, size: v.vg_size ?? '', free: v.vg_free ?? '' });
      for (const l of r.lv ?? []) if (l.lv_name) lvs.push({ name: l.lv_name, vg: l.vg_name ?? '', size: l.lv_size ?? '', path: l.lv_path ?? '' });
    }
    f.lvm = { pvs, vgs, lvs };
  }
  if (s.has('svc.state') || s.has('svc.enabled')) {
    const byName = new Map<string, { name: string; state: string; runlevels: string[] }>();
    const get = (n: string) => {
      if (!byName.has(n)) byName.set(n, { name: n, state: 'stopped', runlevels: [] });
      return byName.get(n)!;
    };
    for (const line of (s.get('svc.state') ?? '').split('\n')) {
      const m = /^\s*([\w.@-]+)\s*=\s*(\w+)(\?)?/.exec(line);
      if (!m) continue;
      // "stopped?" comes from the list of all init scripts: a default, never over a real state.
      if (m[3] && byName.has(m[1])) continue;
      get(m[1]).state = m[2];
    }
    for (const line of (s.get('svc.enabled') ?? '').split('\n')) {
      const [level, name] = line.trim().split(/\s+/);
      if (level && name) get(name).runlevels.push(level);
    }
    f.svc = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (s.has('fw.nft') || s.has('fw.ipt')) {
    const raw = json<unknown>(s.get('fw.nft'), null);
    const iptables: { table: string; chain: string; rule: string }[] = [];
    let table = '';
    for (const line of (s.get('fw.ipt') ?? '').split('\n')) {
      if (line.startsWith('*')) table = line.slice(1).trim();
      else if (line.startsWith('-A ')) {
        const w = line.slice(3).split(' ');
        iptables.push({ table, chain: w[0], rule: w.slice(1).join(' ') });
      } else if (line.startsWith(':')) {
        const w = line.slice(1).split(' ');
        iptables.push({ table, chain: w[0], rule: `policy ${w[1]}` });
      }
    }
    f.fw = { nft: nftRules(raw), nftRaw: raw, iptables };
  }
  if (s.has('dns')) {
    const lines = (s.get('dns') ?? '').split('\n').map((l) => l.trim().split(/\s+/));
    f.dns = { nameservers: lines.filter((w) => w[0] === 'nameserver').map((w) => w[1]), search: lines.filter((w) => w[0] === 'search' || w[0] === 'domain').flatMap((w) => w.slice(1)) };
  }
  if (s.has('boot.cmdline')) {
    const [root = '', rootfs = ''] = (s.get('boot.root') ?? '').trim().split(/\s+/);
    f.boot = { cmdline: (s.get('boot.cmdline') ?? '').trim(), root, rootfs, image: json<Record<string, unknown> | undefined>(s.get('boot.image'), undefined) };
  }
  return f;
}

/** /proc/mounts escapes spaces and tabs as octal. */
function unescapeMount(s: string): string {
  return s.replace(/\\([0-7]{3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
}
