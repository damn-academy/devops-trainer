// Packages: apt, apt-get, apt-cache, dpkg over a small simulated archive.
// apt needs `apt update` before it can find a package (the list of packages
// is downloaded, not built in); installing puts files on disk, records them
// in the dpkg database and, for a service, enables and starts its unit.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { PACKAGED, type SimMachine } from '../shell';
import { ROOT_CRED } from '../vfs';
import { cmdDoc } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;

interface PkgFile {
  path: string;
  content?: string;
  mode?: number;
  dir?: boolean;
  /** A program stub for a registered command. */
  stub?: string;
}

export interface PkgDef {
  name: string;
  version: string;
  section: string;
  size: number;
  depends: string[];
  description: string;
  files: PkgFile[];
  /** systemd unit the package enables and starts on install (Debian policy). */
  unit?: string;
}

const NGINX_CONF = `user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;

events {
\tworker_connections 768;
}

http {
\tsendfile on;
\tinclude /etc/nginx/mime.types;
\taccess_log /var/log/nginx/access.log;

\tserver {
\t\tlisten 80 default_server;
\t\troot /var/www/html;
\t\tindex index.html;
\t\tserver_name _;
\t}
}
`;

export const ARCHIVE: PkgDef[] = [
  {
    name: 'nginx',
    version: '1.26.3-3+deb13u1',
    section: 'httpd',
    size: 1462,
    depends: ['nginx-common', 'libc6', 'libssl3t64'],
    description: 'small, powerful, scalable web/proxy server',
    unit: 'nginx.service',
    files: [
      { path: '/usr/sbin/nginx', stub: 'nginx' },
      { path: '/etc/nginx', dir: true },
      { path: '/etc/nginx/nginx.conf', content: NGINX_CONF },
      { path: '/etc/nginx/mime.types', content: 'types {\n    text/html html htm;\n    text/css css;\n    application/json json;\n}\n' },
      { path: '/var/www/html', dir: true },
      { path: '/var/www/html/index.html', content: '<!DOCTYPE html>\n<html>\n<head><title>Welcome to nginx!</title></head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed and working.</p>\n</body>\n</html>\n' },
      { path: '/var/log/nginx', dir: true },
      { path: '/var/log/nginx/access.log', content: '' },
      { path: '/var/log/nginx/error.log', content: '' },
      {
        path: '/usr/lib/systemd/system/nginx.service',
        content:
          '[Unit]\nDescription=A high performance web server and a reverse proxy server\nDocumentation=man:nginx(8)\nAfter=network-online.target remote-fs.target nss-lookup.target\nWants=network-online.target\n\n[Service]\nType=forking\nPIDFile=/run/nginx.pid\nExecStartPre=/usr/sbin/nginx -t -q -g \'daemon on; master_process on;\'\nExecStart=/usr/sbin/nginx -g \'daemon on; master_process on;\'\nExecReload=/usr/sbin/nginx -g \'daemon on; master_process on;\' -s reload\nTimeoutStopSec=5\nKillMode=mixed\n\n[Install]\nWantedBy=multi-user.target\n',
      },
    ],
  },
  { name: 'nginx-common', version: '1.26.3-3+deb13u1', section: 'httpd', size: 116, depends: [], description: 'small, powerful, scalable web/proxy server - common files', files: [{ path: '/usr/share/doc/nginx-common', dir: true }] },
  {
    name: 'jq',
    version: '1.7.1-6',
    section: 'utils',
    size: 102,
    depends: ['libjq1', 'libc6'],
    description: 'lightweight and flexible command-line JSON processor',
    files: [{ path: '/usr/bin/jq', stub: 'jq' }, { path: '/usr/share/doc/jq', dir: true }, { path: '/usr/share/man/man1/jq.1.gz', content: '' }],
  },
  { name: 'libjq1', version: '1.7.1-6', section: 'libs', size: 376, depends: ['libonig5'], description: 'lightweight and flexible command-line JSON processor - shared library', files: [{ path: '/usr/lib/x86_64-linux-gnu/libjq.so.1.0.4', content: '' }] },
  { name: 'libonig5', version: '6.9.9-1+b1', section: 'libs', size: 684, depends: [], description: 'regular expressions library', files: [{ path: '/usr/lib/x86_64-linux-gnu/libonig.so.5.4.0', content: '' }] },
  {
    name: 'htop',
    version: '3.4.1-5',
    section: 'utils',
    size: 448,
    depends: ['libncursesw6', 'libc6'],
    description: 'interactive processes viewer',
    files: [{ path: '/usr/bin/htop', stub: 'htop' }, { path: '/usr/share/doc/htop', dir: true }],
  },
  { name: 'libncursesw6', version: '6.5+20250216-2', section: 'libs', size: 412, depends: [], description: 'shared libraries for terminal handling (wide character support)', files: [] },
  { name: 'cowsay', version: '3.03+dfsg2-8', section: 'games', size: 93, depends: ['perl'], description: 'configurable talking cow', files: [{ path: '/usr/games/cowsay', content: '#!/usr/bin/perl\n' }] },
];

/** Packages a fresh Debian 13 server has (dpkg -l shows them as installed). */
const BASE: [string, string, string][] = [
  ['bash', '5.2.37-2+b5', 'GNU Bourne Again SHell'],
  ['coreutils', '9.7-3', 'GNU core utilities'],
  ['cron', '3.0pl1-197', 'process scheduling daemon'],
  ['curl', '8.14.1-2', 'command line tool for transferring data with URL syntax'],
  ['findutils', '4.10.0-3', 'utilities for finding files--find, xargs'],
  ['gawk', '1:5.2.1-2+b1', 'GNU awk, a pattern scanning and processing language'],
  ['grep', '3.11-4', 'GNU grep, egrep and fgrep'],
  ['gzip', '1.13-1', 'GNU compression utilities'],
  ['iproute2', '6.15.0-1', 'networking and traffic control tools'],
  ['less', '668-1', 'pager program similar to more'],
  ['libc6', '2.41-12', 'GNU C Library: Shared libraries'],
  ['libcap2-bin', '1:2.75-10+b1', 'POSIX 1003.1e capabilities (utilities)'],
  ['libssl3t64', '3.5.1-1', 'Secure Sockets Layer toolkit - shared libraries'],
  ['man-db', '2.13.1-1', 'tools for reading manual pages'],
  ['openssh-server', '1:10.0p1-7', 'secure shell (SSH) server, for secure access from remote machines'],
  ['perl', '5.40.1-6', 'Larry Wall\'s Practical Extraction and Report Language'],
  ['procps', '2:4.0.4-9', '/proc file system utilities'],
  ['sed', '4.9-2', 'GNU stream editor for filtering/transforming text'],
  ['sudo', '1.9.16p2-3', 'Provide limited super user privileges to specific users'],
  ['systemd', '257.8-1~deb13u2', 'system and service manager'],
  ['tar', '1.35+dfsg-3.1', 'GNU version of the tar archiving utility'],
  ['tree', '2.2.1-1', 'displays an indented directory tree, in color'],
  ['util-linux', '2.41-5', 'miscellaneous system utilities'],
];

for (const p of ARCHIVE) for (const f of p.files) if (f.stub) PACKAGED.set(f.stub, p.name);

export class AptState {
  updated = false;
  installed: Record<string, { version: string; auto: boolean; files: string[] }> = {};
  snapshot() {
    return { updated: this.updated, installed: this.installed };
  }
  restore(s: unknown) {
    const x = s as AptState;
    this.updated = x.updated;
    this.installed = { ...x.installed };
  }
}
export const apt = (m: SimMachine) => m.ext('apt', () => new AptState());

function closure(name: string): PkgDef[] {
  const out: PkgDef[] = [];
  const seen = new Set<string>();
  const visit = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    const p = ARCHIVE.find((x) => x.name === n);
    if (!p) return;
    for (const d of p.depends) visit(d);
    out.push(p);
  };
  visit(name);
  return out;
}

const isBase = (n: string) => BASE.some(([b]) => b === n);

/** Put a package's files on disk and record it. Used by apt and by setup ext.linux.packages. */
export async function installPackage(m: SimMachine, name: string, log: (s: string) => void = () => {}): Promise<boolean> {
  const st = apt(m);
  const pkgs = closure(name).filter((p) => !st.installed[p.name] && !isBase(p.name));
  if (!ARCHIVE.some((p) => p.name === name)) return false;
  for (const p of pkgs) {
    log(`Selecting previously unselected package ${p.name}.\n`);
    log(`Preparing to unpack .../${p.name}_${p.version}_amd64.deb ...\nUnpacking ${p.name} (${p.version}) ...\n`);
    for (const f of p.files) {
      const parent = f.path.slice(0, f.path.lastIndexOf('/')) || '/';
      if (!m.vfs.statAs(parent, ROOT_CRED)) m.vfs.mkdirAs(parent, ROOT_CRED, { parents: true });
      if (f.dir) {
        if (!m.vfs.statAs(f.path, ROOT_CRED)) m.vfs.mkdirAs(f.path, ROOT_CRED, { parents: true });
      } else if (f.stub) {
        m.vfs.writeFileAs(f.path, `#!/usr/bin/sim\n# ${f.stub}: from package ${p.name}\n`, ROOT_CRED);
        m.vfs.chmodAs(f.path, 0o755, ROOT_CRED);
      } else {
        if (!m.vfs.statAs(f.path, ROOT_CRED)) m.vfs.writeFileAs(f.path, f.content ?? '', ROOT_CRED);
        if (f.mode) m.vfs.chmodAs(f.path, f.mode, ROOT_CRED);
      }
    }
    st.installed[p.name] = { version: p.version, auto: p.name !== name, files: p.files.map((f) => f.path) };
  }
  for (const p of pkgs) log(`Setting up ${p.name} (${p.version}) ...\n`);
  const top = ARCHIVE.find((p) => p.name === name)!;
  if (top.unit && pkgs.includes(top)) {
    const r = m.systemd.enable(top.unit);
    for (const l of r.lines) log(l + '\n');
    await m.systemd.start(top.unit);
  }
  if (pkgs.length) log('Processing triggers for man-db (2.13.1-1) ...\n');
  return true;
}

const aptCmd = (variant: 'apt' | 'apt-get' | 'apt-cache'): ShellCommand => ({
  ...cmdDoc({
    name: variant,
    section: 8,
    summary: variant === 'apt-cache' ? bi('искать в списке пакетов', 'query the package lists') : bi('ставить и удалять пакеты с зависимостями', 'install and remove packages with their dependencies'),
    whatis: variant === 'apt-cache' ? 'query the APT cache' : variant === 'apt' ? 'command-line interface' : 'APT package handling utility -- command-line interface',
    synopsis: [`${variant} [-y] {update | install pkg... | remove pkg... | purge pkg... | upgrade | show pkg | search regex | list --installed}`],
    description:
      'apt provides a high-level commandline interface for the package management system: it downloads packages from the repositories listed in /etc/apt/sources.list and installs them together with their dependencies.\nupdate is used to download package information from all configured sources; without it apt does not know any package. install installs, remove removes (configuration files stay), purge removes everything.',
    options: [
      ['-y, --yes, --assume-yes', 'Automatic yes to prompts; assume "yes" as answer to all prompts and run non-interactively.'],
      ['--installed', 'With list: show only installed packages.'],
    ],
    extra: [{ id: 'FILES', body: '/etc/apt/sources.list\n       Locations to fetch packages from.\n/var/lib/apt/lists/\n       Storage area for state information for each package resource specified in sources.list.\n/var/lib/dpkg/status\n       The dpkg database of installed packages.' }],
    exit: 'apt returns zero on normal operation, decimal 100 on error.',
    seeAlso: 'apt-get(8), apt-cache(8), dpkg(1), sources.list(5)',
    url: `https://manpages.debian.org/trixie/apt/${variant}.8.en.html`,
  }),
  async run(ctx) {
    const m = M(ctx);
    const st = apt(m);
    const args = ctx.argv.slice(1).filter((a) => !['-y', '--yes', '--assume-yes', '-q', '--no-install-recommends'].includes(a));
    const [sub, ...pkgs] = args;
    const root = ctx.user.uid === 0;
    const lockErr = () => {
      ctx.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n');
      return 100;
    };
    if (variant === 'apt') ctx.err('');
    switch (sub) {
      case 'update': {
        if (!root) {
          ctx.err('Reading package lists... Done\nE: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\n');
          return 100;
        }
        ctx.out('Hit:1 http://deb.debian.org/debian trixie InRelease\nGet:2 http://deb.debian.org/debian trixie-updates InRelease [47.1 kB]\nGet:3 http://security.debian.org/debian-security trixie-security InRelease [43.4 kB]\nGet:4 http://deb.debian.org/debian trixie/main amd64 Packages [9,668 kB]\nFetched 9,758 kB in 2s (4,879 kB/s)\nReading package lists... Done\n' + (variant === 'apt' ? 'Building dependency tree... Done\nReading state information... Done\nAll packages are up to date.\n' : ''));
        st.updated = true;
        m.vfs.writeFileAs('/var/lib/apt/lists/deb.debian.org_debian_dists_trixie_main_binary-amd64_Packages', ARCHIVE.map((p) => `Package: ${p.name}\nVersion: ${p.version}\n`).join('\n'), ROOT_CRED);
        return 0;
      }
      case 'install': {
        if (!root) return lockErr();
        if (!pkgs.length) {
          ctx.out('Reading package lists... Done\nBuilding dependency tree... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n');
          return 0;
        }
        ctx.out('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n');
        for (const p of pkgs) {
          if (st.installed[p] || isBase(p)) {
            ctx.out(`${p} is already the newest version (${st.installed[p]?.version ?? BASE.find((b) => b[0] === p)?.[1]}).\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n`);
            continue;
          }
          if (!st.updated || !ARCHIVE.some((x) => x.name === p)) {
            ctx.err(`E: Unable to locate package ${p}\n`);
            return 100;
          }
          const add = closure(p).filter((x) => !st.installed[x.name] && !isBase(x.name));
          ctx.out(`Installing:\n  ${p}\n\n${add.length > 1 ? `Installing dependencies:\n  ${add.filter((x) => x.name !== p).map((x) => x.name).join('  ')}\n\n` : ''}Summary:\n  Upgrading: 0, Installing: ${add.length}, Removing: 0, Not Upgrading: 0\n  Download size: ${add.reduce((s, x) => s + x.size, 0) * 0.4 | 0} kB\n  Space needed: ${add.reduce((s, x) => s + x.size, 0)} kB / 4,512 MB available\n\n`);
          await installPackage(m, p, ctx.out);
        }
        return 0;
      }
      case 'remove':
      case 'purge': {
        if (!root) return lockErr();
        for (const p of pkgs) {
          const rec = st.installed[p];
          if (!rec) {
            ctx.out(`Package '${p}' is not installed, so not removed\n`);
            continue;
          }
          const def = ARCHIVE.find((x) => x.name === p);
          if (def?.unit) m.systemd.stop(def.unit);
          ctx.out(`REMOVING:\n  ${p}\n\nSummary:\n  Upgrading: 0, Installing: 0, Removing: 1, Not Upgrading: 0\nRemoving ${p} (${rec.version}) ...\n`);
          for (const f of [...rec.files].reverse()) {
            const keepConf = sub === 'remove' && f.startsWith('/etc/');
            const s = m.vfs.statAs(f, ROOT_CRED, false);
            if (!s || keepConf) continue;
            try {
              if (s.type === 'd') m.vfs.rmdirAs(f, ROOT_CRED);
              else m.vfs.unlinkAs(f, ROOT_CRED);
            } catch {
              /* directory not empty */
            }
          }
          if (def?.unit) m.systemd.disable(def.unit);
          delete st.installed[p];
        }
        return 0;
      }
      case 'upgrade':
      case 'full-upgrade':
        if (!root) return lockErr();
        ctx.out('Reading package lists... Done\nBuilding dependency tree... Done\nCalculating upgrade... Done\nSummary:\n  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0\n');
        return 0;
      case 'show':
      case 'policy': {
        let exit = 0;
        for (const p of pkgs) {
          const def = ARCHIVE.find((x) => x.name === p);
          const base = BASE.find((b) => b[0] === p);
          if (!def && !base) {
            ctx.err(`N: Unable to locate package ${p}\nE: No packages found\n`);
            exit = 100;
            continue;
          }
          if (def && !st.updated && !st.installed[p]) {
            ctx.err(`N: Unable to locate package ${p}\nE: No packages found\n`);
            exit = 100;
            continue;
          }
          ctx.out(`Package: ${p}\nVersion: ${def?.version ?? base![1]}\nPriority: optional\nSection: ${def?.section ?? 'utils'}\nMaintainer: Debian Developers <debian-devel@lists.debian.org>\nInstalled-Size: ${def?.size ?? 1024} kB\nDepends: ${def?.depends.join(', ') || 'libc6'}\nAPT-Sources: http://deb.debian.org/debian trixie/main amd64 Packages\nDescription: ${def?.description ?? base![2]}\n\n`);
        }
        return exit;
      }
      case 'search': {
        if (!st.updated) return 0;
        const re = new RegExp(pkgs[0] ?? '', 'i');
        ctx.out('Sorting... Done\nFull Text Search... Done\n');
        for (const p of ARCHIVE.filter((x) => re.test(x.name) || re.test(x.description))) ctx.out(`${p.name}/stable ${p.version} amd64${st.installed[p.name] ? ' [installed]' : ''}\n  ${p.description}\n\n`);
        return 0;
      }
      case 'list': {
        ctx.out('Listing... Done\n');
        const inst = Object.entries(st.installed);
        if (args.includes('--installed')) {
          for (const [n, v] of [...BASE.map(([n, v]) => [n, { version: v, auto: false }] as const), ...inst].sort((a, b) => a[0].localeCompare(b[0]))) ctx.out(`${n}/stable,now ${v.version} amd64 [installed${v.auto ? ',automatic' : ''}]\n`);
        } else for (const p of ARCHIVE) ctx.out(`${p.name}/stable ${p.version} amd64${st.installed[p.name] ? ' [installed]' : ''}\n`);
        return 0;
      }
      default:
        ctx.err(variant === 'apt' ? `E: Invalid operation ${sub ?? ''}\n` : `E: Invalid operation ${sub ?? ''}\n`);
        return 100;
    }
  },
});

const dpkg: ShellCommand = {
  ...cmdDoc({
    name: 'dpkg',
    summary: bi('база установленных пакетов Debian', 'the database of installed Debian packages'),
    whatis: 'package manager for Debian',
    synopsis: ['dpkg -l [package-name-pattern...]', 'dpkg -L package-name...', 'dpkg -S filename-search-pattern...', 'dpkg -s package-name...'],
    description: 'dpkg is the low-level tool to install, build, remove and manage Debian packages; apt calls it. It keeps the database of what is installed and which files belong to which package.',
    options: [
      ['-l, --list [package-name-pattern...]', 'List all known packages matching given patterns.'],
      ['-L, --listfiles package-name...', 'List files installed to your system from package-name.'],
      ['-S, --search filename-search-pattern...', 'Search for a filename from installed packages.'],
      ['-s, --status package-name...', 'Report status of specified package.'],
    ],
    seeAlso: 'apt(8), dpkg-query(1)',
    url: 'https://manpages.debian.org/trixie/dpkg/dpkg.1.en.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const st = apt(m);
    const [op, ...rest] = ctx.argv.slice(1);
    const all: [string, string, string][] = [...BASE, ...Object.entries(st.installed).map(([n, v]) => [n, v.version, ARCHIVE.find((p) => p.name === n)?.description ?? ''] as [string, string, string])].sort((a, b) => a[0].localeCompare(b[0]));
    if (op === '-l' || op === '--list') {
      ctx.out('Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name           Version              Architecture Description\n+++-==============-====================-============-=================================\n');
      const re = rest[0] ? new RegExp('^' + rest[0].replace(/\*/g, '.*') + '$') : null;
      const sel = all.filter(([n]) => !re || re.test(n));
      if (!sel.length) {
        ctx.err(`dpkg-query: no packages found matching ${rest[0]}\n`);
        return 1;
      }
      for (const [n, v, d] of sel) ctx.out(`ii  ${n.padEnd(14)} ${v.padEnd(20)} amd64        ${d}\n`);
      return 0;
    }
    if (op === '-L' || op === '--listfiles') {
      let exit = 0;
      for (const p of rest) {
        const rec = st.installed[p];
        if (!rec) {
          if (isBase(p)) {
            const own = Object.entries(baseFiles).filter(([, pk]) => pk === p).map(([f]) => f);
            ctx.out(['/.', ...own].join('\n') + '\n');
            continue;
          }
          ctx.err(`dpkg-query: package '${p}' is not installed\nUse dpkg --contents (= dpkg-deb --contents) to list archive files contents.\n`);
          exit = 1;
          continue;
        }
        ctx.out(['/.', ...rec.files].join('\n') + '\n');
      }
      return exit;
    }
    if (op === '-S' || op === '--search') {
      let found = 0;
      for (const pat of rest) {
        for (const [n, rec] of Object.entries(st.installed)) for (const f of rec.files) if (f.includes(pat)) {
          ctx.out(`${n}: ${f}\n`);
          found++;
        }
        for (const [f, n] of Object.entries(baseFiles)) if (f === pat || (pat.includes('/') ? f.endsWith(pat) : f.endsWith('/' + pat))) {
          ctx.out(`${n}: ${f}\n`);
          found++;
        }
      }
      if (!found) {
        ctx.err(`dpkg-query: no path found matching pattern *${rest[0] ?? ''}*\n`);
        return 1;
      }
      return 0;
    }
    if (op === '-s' || op === '--status') {
      const p = rest[0];
      const row = all.find(([n]) => n === p);
      if (!row) {
        ctx.err(`dpkg-query: package '${p}' is not installed and no information is available\n`);
        return 1;
      }
      ctx.out(`Package: ${row[0]}\nStatus: install ok installed\nVersion: ${row[1]}\nDescription: ${row[2]}\n`);
      return 0;
    }
    ctx.err("dpkg: need an action option\n\nType dpkg --help for help about installing and deinstalling packages [*];\nUse 'apt' or 'aptitude' for user-friendly package management;\n");
    return 2;
  },
};

/** Which base package owns some well-known files (dpkg -S). */
const baseFiles: Record<string, string> = {
  '/usr/bin/ls': 'coreutils',
  '/usr/bin/cp': 'coreutils',
  '/usr/bin/cat': 'coreutils',
  '/usr/bin/sort': 'coreutils',
  '/usr/bin/sha256sum': 'coreutils',
  '/usr/bin/bash': 'bash',
  '/usr/bin/grep': 'grep',
  '/usr/bin/sed': 'sed',
  '/usr/bin/awk': 'gawk',
  '/usr/bin/find': 'findutils',
  '/usr/bin/xargs': 'findutils',
  '/usr/bin/tar': 'tar',
  '/usr/bin/gzip': 'gzip',
  '/usr/bin/ps': 'procps',
  '/usr/bin/top': 'procps',
  '/usr/bin/free': 'procps',
  '/usr/bin/kill': 'procps',
  '/usr/bin/mount': 'util-linux',
  '/usr/bin/lsblk': 'util-linux',
  '/usr/bin/unshare': 'util-linux',
  '/usr/bin/nsenter': 'util-linux',
  '/usr/bin/lsns': 'util-linux',
  '/usr/bin/systemctl': 'systemd',
  '/usr/bin/journalctl': 'systemd',
  '/usr/sbin/sshd': 'openssh-server',
  '/usr/sbin/cron': 'cron',
  '/usr/bin/sudo': 'sudo',
  '/usr/bin/curl': 'curl',
  '/usr/sbin/ip': 'iproute2',
  '/usr/bin/ss': 'iproute2',
  '/usr/sbin/capsh': 'libcap2-bin',
  '/usr/sbin/setcap': 'libcap2-bin',
  '/usr/sbin/getcap': 'libcap2-bin',
  '/usr/bin/less': 'less',
  '/usr/bin/man': 'man-db',
  '/usr/bin/tree': 'tree',
  '/etc/crontab': 'cron',
  '/etc/ssh/sshd_config': 'openssh-server',
};

/** A tiny jq: .field, .a.b, .[], .[N], .a[].b, keys, length, with -r. */
export function runJq(filter: string, input: string, raw: boolean): { out: string; err?: string } {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return { out: '', err: `jq: error (at <stdin>:1): Cannot parse JSON: ${(e as Error).message}` };
  }
  const steps = filter.trim();
  let vals: unknown[] = [data];
  if (steps !== '.') {
    const parts = steps.split('|').map((s) => s.trim());
    for (const part of parts) {
      if (part === 'keys') {
        vals = vals.map((v) => (v && typeof v === 'object' ? Object.keys(v as object).sort() : []));
        continue;
      }
      if (part === 'length') {
        vals = vals.map((v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : typeof v === 'string' ? v.length : 0));
        continue;
      }
      const toks = part.match(/\.\[\]|\[\]|\.\[\d+\]|\[\d+\]|\.[A-Za-z_][\w-]*|\.\["[^"]+"\]|\./g);
      if (!toks || toks.join('') !== part) return { out: '', err: `jq: error: syntax error, unexpected INVALID_CHARACTER (Unix shell quoting issues?) at <top-level>, line 1:\n${filter}` };
      for (const t of toks) {
        if (t === '.') continue;
        const next: unknown[] = [];
        for (const v of vals) {
          if (t === '.[]' || t === '[]') {
            if (Array.isArray(v)) next.push(...v);
            else if (v && typeof v === 'object') next.push(...Object.values(v));
            else return { out: '', err: `jq: error (at <stdin>:0): Cannot iterate over ${v === null ? 'null' : typeof v}` };
          } else if (/^\.?\[\d+\]$/.test(t)) next.push(Array.isArray(v) ? v[Number(/\d+/.exec(t)![0])] ?? null : null);
          else {
            const key = t.startsWith('.["') ? t.slice(3, -2) : t.slice(1);
            next.push(v && typeof v === 'object' && !Array.isArray(v) ? ((v as Record<string, unknown>)[key] ?? null) : null);
          }
        }
        vals = next;
      }
    }
  }
  return { out: vals.map((v) => (raw && typeof v === 'string' ? v : JSON.stringify(v, null, 2))).join('\n') + '\n' };
}

const jq: ShellCommand = {
  ...cmdDoc({
    name: 'jq',
    summary: bi('достать поля из JSON', 'extract fields from JSON'),
    whatis: 'Command-line JSON processor',
    synopsis: ['jq [options...] filter [files...]'],
    description: 'jq can transform JSON in various ways, by selecting, iterating, reducing and otherwise mangling JSON documents. The simplest filters: . (the whole input), .name (a field), .items[] (every element of an array), .items[].name, .[0]; filters are joined with |.',
    options: [['-r, --raw-output', 'With this option, if the filter\'s result is a string then it will be written directly to standard output rather than being formatted as a JSON string with quotes.']],
    examples: [["curl -s localhost:8080/api | jq -r '.items[].name'", 'The names of all items, one per line, without quotes.']],
    seeAlso: 'https://jqlang.org/manual/',
    url: 'https://jqlang.org/manual/',
  }),
  run(ctx) {
    const args = ctx.argv.slice(1);
    const raw = args.includes('-r') || args.includes('--raw-output');
    const ops = args.filter((a) => !a.startsWith('-'));
    const filter = ops[0] ?? '.';
    let input = ctx.stdin;
    if (ops[1]) {
      try {
        input = ctx.fs.readFile(ops[1]);
      } catch {
        ctx.err(`jq: error: Could not open ${ops[1]}: No such file or directory\n`);
        return 2;
      }
    }
    const r = runJq(filter, input, raw);
    if (r.err) {
      ctx.err(r.err + '\n');
      return r.err.includes('syntax') ? 3 : 5;
    }
    ctx.out(r.out);
    return 0;
  },
};

const htop: ShellCommand = {
  ...cmdDoc({ name: 'htop', summary: bi('интерактивный просмотр процессов', 'interactive process viewer'), whatis: 'interactive process viewer', synopsis: ['htop [-u USER] [-p PID]'], description: 'htop is a cross-platform ncurses-based process viewer. On this machine it shows the same snapshot as top.', seeAlso: 'top(1), ps(1)' }),
  async run(ctx) {
    const r = await ctx.shell.run('top');
    ctx.out(r.out);
    return r.exit;
  },
};

export const PKG_COMMANDS: ShellCommand[] = [aptCmd('apt'), aptCmd('apt-get'), aptCmd('apt-cache'), dpkg, jq, htop];
