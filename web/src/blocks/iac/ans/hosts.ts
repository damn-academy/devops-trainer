// Managed hosts of the Ansible simulator. Each host is a directory tree under
// /srv/hosts/<name>/ on the control machine (its "/"), plus a small database
// of packages, services and users in <root>/var/lib/sim/host.json. Modules
// change these files; `ansible web1 -a "cat /etc/motd"` reads them back.

import type { FsApi } from '../../../core/types';

export const HOSTS_ROOT = '/srv/hosts';

export interface HostMeta {
  name: string;
  ip: string;
  os_family: 'Debian' | 'RedHat';
  distribution: string;
  distribution_version: string;
  python: boolean;
  reachable: boolean;
  memtotal_mb: number;
  vcpus: number;
}

export interface HostDb {
  meta: HostMeta;
  packages: Record<string, string>;
  services: Record<string, { state: 'started' | 'stopped'; enabled: boolean; restarts: number }>;
  users: Record<string, { shell: string; groups: string[]; home: string }>;
}

/** What a package brings: its service, files and version. */
export const PACKAGES: Record<string, { version: string; service?: string; files?: Record<string, string> }> = {
  nginx: {
    version: '1.26.3-3',
    service: 'nginx',
    files: {
      '/etc/nginx/nginx.conf': 'user www-data;\nworker_processes auto;\n\nevents {\n    worker_connections 768;\n}\n\nhttp {\n    include /etc/nginx/mime.types;\n    include /etc/nginx/conf.d/*.conf;\n    include /etc/nginx/sites-enabled/*;\n}\n',
      '/etc/nginx/sites-enabled/default': 'server {\n    listen 80 default_server;\n    root /var/www/html;\n    index index.html index.nginx-debian.html;\n}\n',
      '/var/www/html/index.nginx-debian.html': '<!DOCTYPE html>\n<title>Welcome to nginx!</title>\n<h1>Welcome to nginx!</h1>\n',
    },
  },
  curl: { version: '8.14.1-2' },
  git: { version: '1:2.47.2-0.2' },
  htop: { version: '3.4.1-4' },
  chrony: { version: '4.6.1-3', service: 'chrony', files: { '/etc/chrony/chrony.conf': 'pool 2.debian.pool.ntp.org iburst\n' } },
  'postgresql': { version: '17+278', service: 'postgresql', files: { '/etc/postgresql/17/main/postgresql.conf': "listen_addresses = 'localhost'\nport = 5432\n" } },
  'python3': { version: '3.13.5-1' },
  nftables: { version: '1.1.3-1', service: 'nftables', files: { '/etc/nftables.conf': '#!/usr/sbin/nft -f\nflush ruleset\n' } },
};

export interface HostSpec {
  name: string;
  ip?: string;
  os?: 'Debian' | 'RedHat';
  python?: boolean;
  reachable?: boolean;
  packages?: string[];
  files?: Record<string, string>;
}

export class Host {
  constructor(
    readonly fs: FsApi,
    readonly name: string,
  ) {}

  get root(): string {
    return `${HOSTS_ROOT}/${this.name}`;
  }

  static exists(fs: FsApi, name: string): boolean {
    return fs.exists(`${HOSTS_ROOT}/${name}/var/lib/sim/host.json`);
  }

  static list(fs: FsApi): string[] {
    if (!fs.exists(HOSTS_ROOT)) return [];
    return fs.readdir(HOSTS_ROOT).filter((n) => Host.exists(fs, n)).sort();
  }

  static create(fs: FsApi, spec: HostSpec, index: number): Host {
    const h = new Host(fs, spec.name);
    const os = spec.os ?? 'Debian';
    const db: HostDb = {
      meta: {
        name: spec.name,
        ip: spec.ip ?? `10.0.0.${11 + index}`,
        os_family: os,
        distribution: os === 'Debian' ? 'Debian' : 'Rocky',
        distribution_version: os === 'Debian' ? '13' : '9.6',
        python: spec.python ?? true,
        reachable: spec.reachable ?? true,
        memtotal_mb: 1967,
        vcpus: 2,
      },
      packages: {},
      services: { ssh: { state: 'started', enabled: true, restarts: 0 } },
      users: { root: { shell: '/bin/bash', groups: ['root'], home: '/root' } },
    };
    for (const d of ['etc', 'tmp', 'var/lib/sim', 'var/log', 'var/www', 'opt', 'home', 'root', 'srv']) fs.mkdir(`${h.root}/${d}`, { parents: true });
    fs.writeFile(`${h.root}/etc/hostname`, `${spec.name}\n`);
    fs.writeFile(`${h.root}/etc/os-release`, os === 'Debian' ? 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nID=debian\nVERSION_ID="13"\n' : 'PRETTY_NAME="Rocky Linux 9.6 (Blue Onyx)"\nID="rocky"\nVERSION_ID="9.6"\n');
    fs.writeFile(`${h.root}/etc/motd`, 'Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY.\n');
    h.save(db);
    for (const p of spec.packages ?? []) h.install(p);
    for (const [p, text] of Object.entries(spec.files ?? {})) h.write(p, text);
    return h;
  }

  db(): HostDb {
    return JSON.parse(this.fs.readFile(`${this.root}/var/lib/sim/host.json`)) as HostDb;
  }

  save(db: HostDb): void {
    this.fs.writeFile(`${this.root}/var/lib/sim/host.json`, JSON.stringify(db, null, 1));
  }

  update<T>(fn: (db: HostDb) => T): T {
    const db = this.db();
    const r = fn(db);
    this.save(db);
    return r;
  }

  p(path: string): string {
    return `${this.root}${path.startsWith('/') ? path : '/' + path}`;
  }

  exists(path: string): boolean {
    return this.fs.exists(this.p(path));
  }

  isDir(path: string): boolean {
    return this.fs.stat(this.p(path))?.type === 'd';
  }

  read(path: string): string | null {
    return this.fs.stat(this.p(path))?.type === 'f' ? this.fs.readFile(this.p(path)) : null;
  }

  write(path: string, text: string, mode?: number): void {
    const abs = this.p(path);
    const dir = abs.slice(0, abs.lastIndexOf('/'));
    if (!this.fs.exists(dir)) this.fs.mkdir(dir, { parents: true });
    this.fs.writeFile(abs, text);
    if (mode !== undefined) this.fs.chmod(abs, mode);
  }

  mode(path: string): string | null {
    const st = this.fs.stat(this.p(path));
    return st ? (st.mode & 0o7777).toString(8).padStart(4, '0') : null;
  }

  remove(path: string): void {
    const abs = this.p(path);
    const st = this.fs.stat(abs);
    if (!st) return;
    if (st.type === 'd') {
      for (const e of this.fs.readdir(abs)) this.remove(`${path}/${e}`);
      this.fs.rmdir(abs);
    } else this.fs.unlink(abs);
  }

  install(name: string): boolean {
    const pkg = PACKAGES[name];
    if (!pkg) return false;
    this.update((db) => {
      db.packages[name] = pkg.version;
      if (pkg.service) db.services[pkg.service] = { state: 'started', enabled: true, restarts: 0 };
    });
    for (const [p, text] of Object.entries(pkg.files ?? {})) if (!this.exists(p)) this.write(p, text);
    return true;
  }

  uninstall(name: string): void {
    const pkg = PACKAGES[name];
    this.update((db) => {
      delete db.packages[name];
      if (pkg?.service) delete db.services[pkg.service];
    });
  }

  /** Every file of the host as path → text (for facts and the command module). */
  files(prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (abs: string, rel: string) => {
      for (const e of this.fs.readdir(abs)) {
        const a = `${abs}/${e}`;
        const r = `${rel}/${e}`;
        if (r === '/var/lib/sim') continue;
        const st = this.fs.stat(a);
        if (st?.type === 'd') walk(a, r);
        else if (st?.type === 'f') out[r] = this.fs.readFile(a);
      }
    };
    const start = this.p(prefix || '/');
    if (this.fs.stat(start)?.type === 'd') walk(start.replace(/\/$/, ''), prefix.replace(/\/$/, ''));
    return out;
  }
}
