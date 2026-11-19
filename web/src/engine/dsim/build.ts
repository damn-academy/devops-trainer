// `docker build` (04 §11.5, X2): a Dockerfile parser, stages, the build
// cache and BuildKit-like output. A RUN step runs in a real container shell
// of the simulator (cmachine.ts) with "recipe" programs (apk, apt-get, pip,
// go, adduser…) that change files and record their weight; the change set of
// the step becomes its layer. The cache key of a step is
// sha256(parent key + instruction text + for COPY/ADD the content of the
// copied files), so the first changed step and everything after it rebuild.

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand, SimMachineApi } from '../../core/types';
import type { ImageConfigBody, ImageConfigDoc, HistoryEntry } from './catalog';
import { openContainer, type ContainerCtx } from './cmachine';
import { clock, findImage, pull, type Out, canonical } from './engine';
import { dir, makeLayer, merge, type LayerFiles } from './layers';
import { readHostTree } from './rootfs';
import type { BuildStepRec, ContainerRec, DockerSnapshot, ImageRec } from './state';
import { digestOf, dockerSize, sha256hex, splitWords } from './util';

export interface Instruction {
  line: number;
  op: string;
  args: string;
  flags: Record<string, string>;
  raw: string;
}

export function parseDockerfile(text: string): { ok: true; ins: Instruction[] } | { ok: false; error: string } {
  const lines = text.split('\n');
  const ins: Instruction[] = [];
  let buf = '';
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!buf && /^\s*#/.test(raw)) continue;
    if (!buf) start = i + 1;
    const cont = /\\\s*$/.test(raw);
    buf += (buf ? ' ' : '') + raw.replace(/\\\s*$/, '').trim();
    if (cont) continue;
    const line = buf.trim();
    buf = '';
    if (!line) continue;
    const m = /^(\w+)\s*(.*)$/.exec(line);
    if (!m) return { ok: false, error: `dockerfile parse error on line ${start}: unknown instruction: ${line}` };
    const op = m[1].toUpperCase();
    const KNOWN = ['FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'ENV', 'ARG', 'LABEL', 'EXPOSE', 'CMD', 'ENTRYPOINT', 'USER', 'VOLUME', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'ONBUILD', 'MAINTAINER'];
    if (!KNOWN.includes(op)) return { ok: false, error: `dockerfile parse error on line ${start}: unknown instruction: ${m[1]}` };
    let rest = m[2];
    const flags: Record<string, string> = {};
    while (/^--[\w-]+(=\S+)?\s/.test(rest + ' ') && ['COPY', 'ADD', 'RUN', 'FROM', 'HEALTHCHECK'].includes(op)) {
      const f = /^--([\w-]+)(?:=(\S+))?\s*/.exec(rest)!;
      flags[f[1]] = f[2] ?? 'true';
      rest = rest.slice(f[0].length);
    }
    ins.push({ line: start, op, args: rest, flags, raw: line });
  }
  if (!ins.length) return { ok: false, error: 'the Dockerfile (Dockerfile) cannot be empty' };
  if (ins[0].op !== 'FROM' && ins[0].op !== 'ARG') return { ok: false, error: `dockerfile parse error on line ${ins[0].line}: no build stage in current context` };
  return { ok: true, ins };
}

/** exec form ["a","b"] or shell form `a b` (wrapped in /bin/sh -c). */
export function cmdForm(args: string): { exec: boolean; argv: string[] } {
  const t = args.trim();
  if (t.startsWith('[')) {
    try {
      const v = JSON.parse(t);
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return { exec: true, argv: v };
    } catch {
      /* not JSON: shell form */
    }
  }
  return { exec: false, argv: ['/bin/sh', '-c', t] };
}

function parseKv(args: string): [string, string][] {
  const t = args.trim();
  if (!/^\S+=/.test(t)) {
    const [k, ...v] = t.split(/\s+/);
    return [[k, v.join(' ')]];
  }
  return splitWords(t).map((w) => {
    const i = w.indexOf('=');
    return [w.slice(0, i), w.slice(i + 1)] as [string, string];
  });
}

// ── .dockerignore ─────────────────────────────────────────────────────────

function globRe(p: string): RegExp {
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      re += '.*';
      i++;
      if (p[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}(/.*)?$`);
}

export function ignoredBy(patterns: string[]): (rel: string) => boolean {
  const rules = patterns
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => ({ neg: l.startsWith('!'), re: globRe(l.replace(/^!/, '').replace(/^\.?\//, '').replace(/\/$/, '')) }));
  return (rel) => {
    let ign = false;
    for (const r of rules) if (r.re.test(rel)) ign = !r.neg;
    return ign;
  };
}

// ── recipes: programs a RUN step may call ─────────────────────────────────

const MB = 1_000_000;
const PKG_SIZES: Record<string, number> = { curl: 0.6 * MB, git: 14 * MB, bash: 1.3 * MB, 'build-base': 210 * MB, 'build-essential': 220 * MB, gcc: 95 * MB, make: 0.4 * MB, python3: 46 * MB, nodejs: 72 * MB, tini: 0.04 * MB, 'ca-certificates': 0.7 * MB, postgresql17_client: 8 * MB, 'libpq-dev': 3 * MB, vim: 39 * MB, jq: 0.9 * MB, nginx: 2.3 * MB, procps: 1.2 * MB, iputils: 0.3 * MB, tzdata: 3.5 * MB };
const PIP_SIZES: Record<string, number> = { flask: 1.2 * MB, werkzeug: 1.1 * MB, jinja2: 0.5 * MB, requests: 0.4 * MB, urllib3: 0.5 * MB, psycopg: 3.9 * MB, 'psycopg2-binary': 9.8 * MB, fastapi: 0.6 * MB, uvicorn: 0.4 * MB, pydantic: 6.4 * MB, numpy: 38 * MB, pandas: 62 * MB, gunicorn: 0.4 * MB, redis: 1.1 * MB, sqlalchemy: 9.6 * MB };

interface RecipeEnv {
  weights: Map<string, number>;
  /** Model time the step takes, ms. */
  ms: { v: number };
}

function weigh(ctx: CmdContext, path: string, size: number, text = '(installed files)\n'): void {
  const dirPath = path.slice(0, path.lastIndexOf('/')) || '/';
  if (!ctx.fs.exists(dirPath)) ctx.fs.mkdir(dirPath, { parents: true });
  ctx.fs.writeFile(path, text);
  ctx.machine.ext<Map<string, number>>('dsim.weights', () => new Map()).set(ctx.fs.resolve(path), Math.round(size));
}

function recipes(env: RecipeEnv): ShellCommand[] {
  const cmd = (name: string, run: (ctx: CmdContext) => number | Promise<number>): ShellCommand => ({ name, summary: bi('программа сборки', 'a build program'), run });
  return [
    cmd('apk', (ctx) => {
      const [sub, ...rest] = ctx.argv.slice(1);
      const pkgs = rest.filter((a) => !a.startsWith('-'));
      if (sub === 'add') {
        const noCache = rest.includes('--no-cache');
        ctx.out('fetch https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/APKINDEX.tar.gz\nfetch https://dl-cdn.alpinelinux.org/alpine/v3.22/community/x86_64/APKINDEX.tar.gz\n');
        pkgs.forEach((p, i) => {
          const name = p.split('=')[0];
          ctx.out(`(${i + 1}/${pkgs.length}) Installing ${name} (1.0.0-r0)\n`);
          weigh(ctx, `/usr/lib/apk-pkgs/${name}`, PKG_SIZES[name] ?? 2 * MB);
          if (['curl', 'bash', 'git', 'jq', 'tini', 'vim'].includes(name)) weigh(ctx, name === 'tini' ? '/sbin/tini' : `/usr/bin/${name}`, 1000, '\x7fELF (binary)\n');
        });
        if (!noCache) weigh(ctx, '/var/cache/apk/APKINDEX.tar.gz', 2.4 * MB);
        ctx.out(`OK: ${12 + pkgs.length * 3} MiB in ${18 + pkgs.length} packages\n`);
        env.ms.v += 900 + 700 * pkgs.length;
        return 0;
      }
      if (sub === 'del') {
        for (const p of pkgs) for (const path of [`/usr/lib/apk-pkgs/${p}`, `/usr/bin/${p}`]) if (ctx.fs.exists(path)) ctx.fs.unlink(path);
        env.ms.v += 300;
        return 0;
      }
      ctx.err(`apk-tools 2.14.10, compiled for x86_64.\nusage: apk [<OPTIONS>...] COMMAND [<ARGUMENTS>...]\n`);
      return 1;
    }),
    cmd('apt-get', (ctx) => {
      const [sub, ...rest] = ctx.argv.slice(1);
      const pkgs = rest.filter((a) => !a.startsWith('-'));
      if (sub === 'update') {
        ctx.out('Get:1 http://deb.debian.org/debian trixie InRelease [140 kB]\nGet:2 http://deb.debian.org/debian trixie/main amd64 Packages [9670 kB]\nFetched 9810 kB in 2s (4905 kB/s)\nReading package lists...\n');
        weigh(ctx, '/var/lib/apt/lists/deb.debian.org_debian_dists_trixie_main_binary-amd64_Packages.lz4', 46 * MB);
        env.ms.v += 3200;
        return 0;
      }
      if (sub === 'install') {
        if (!ctx.fs.exists('/var/lib/apt/lists') || !ctx.fs.readdir('/var/lib/apt/lists').length) {
          ctx.err(`E: Unable to locate package ${pkgs[0] ?? ''}\n`);
          return 100;
        }
        ctx.out(`Reading package lists...\nBuilding dependency tree...\nThe following NEW packages will be installed:\n  ${pkgs.join(' ')}\n`);
        for (const p of pkgs) weigh(ctx, `/usr/lib/apt-pkgs/${p}`, (PKG_SIZES[p] ?? 3 * MB) * (rest.includes('--no-install-recommends') ? 1 : 1.6));
        env.ms.v += 2500 + 1800 * pkgs.length;
        return 0;
      }
      if (sub === 'purge' || sub === 'remove') {
        for (const p of pkgs) if (ctx.fs.exists(`/usr/lib/apt-pkgs/${p}`)) ctx.fs.unlink(`/usr/lib/apt-pkgs/${p}`);
        env.ms.v += 900;
        return 0;
      }
      if (sub === 'clean') return 0;
      ctx.err('E: Invalid operation ' + (sub ?? '') + '\n');
      return 100;
    }),
    cmd('pip', async (ctx) => {
      const args = ctx.argv.slice(1);
      if (args[0] !== 'install') {
        ctx.out('Usage:\n  pip <command> [options]\n');
        return args.length ? 1 : 0;
      }
      const noCache = args.includes('--no-cache-dir');
      let pkgs = args.slice(1).filter((a, i, all) => !a.startsWith('-') && all[i - 1] !== '-r' && all[i - 1] !== '--requirement');
      const ri = args.findIndex((a) => a === '-r' || a === '--requirement');
      if (ri >= 0) {
        const f = args[ri + 1];
        try {
          pkgs = pkgs.concat(
            ctx.fs
              .readFile(f)
              .split('\n')
              .map((l) => l.replace(/#.*/, '').trim())
              .filter(Boolean),
          );
        } catch {
          ctx.err(`ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${f}'\n`);
          return 1;
        }
      }
      const names: string[] = [];
      for (const p of pkgs) {
        const name = p.split(/[=<>~!]/)[0].toLowerCase();
        names.push(p.includes('==') ? p.replace('==', '-') : `${name}-1.0.0`);
        ctx.out(`Collecting ${p}\n  Downloading ${name}-${p.split('==')[1] ?? '1.0.0'}-py3-none-any.whl\n`);
        weigh(ctx, `/usr/local/lib/python3.13/site-packages/${name}`, PIP_SIZES[name] ?? 1.5 * MB);
        if (!noCache) weigh(ctx, `/root/.cache/pip/http-v2/${name}.whl`, (PIP_SIZES[name] ?? 1.5 * MB) * 0.45);
        env.ms.v += 1400 + Math.round((PIP_SIZES[name] ?? 1.5 * MB) / 25_000);
      }
      ctx.out(`Installing collected packages: ${names.map((n) => n.replace(/-[\d.]+$/, '')).join(', ')}\nSuccessfully installed ${names.join(' ')}\n`);
      return 0;
    }),
    cmd('go', (ctx) => {
      const [sub, ...rest] = ctx.argv.slice(1);
      if (sub === 'mod' && rest[0] === 'download') {
        weigh(ctx, '/go/pkg/mod/cache/download', 38 * MB);
        env.ms.v += 6400;
        return 0;
      }
      if (sub === 'build') {
        const oi = rest.indexOf('-o');
        const out = oi >= 0 ? rest[oi + 1] : 'app';
        let src = '';
        try {
          src = ctx.fs.readFile('main.go');
        } catch {
          ctx.err('go: go.mod file not found in current directory or any parent directory; see \'go help modules\'\n');
          return 1;
        }
        const port = /ListenAndServe\("[^:]*:(\d+)"/.exec(src)?.[1];
        const says = /Fprint(?:ln|f)?\(w,\s*"([^"]*)"/.exec(src)?.[1];
        const text = port ? `\x7fELF x86_64 go program: listens :${port}${says ? `, says "${says.replace(/\\n$/, '')}"` : ''}\n` : '\x7fELF x86_64 go program\n';
        weigh(ctx, out, 8.6 * MB, text);
        ctx.fs.chmod(out, 0o755);
        weigh(ctx, '/root/.cache/go-build/cache', 92 * MB);
        env.ms.v += 11_000;
        return 0;
      }
      ctx.err(`go ${sub ?? ''}: unknown command\nRun 'go help' for usage.\n`);
      return 2;
    }),
    cmd('make', (ctx) => {
      weigh(ctx, 'build/app', 4 * MB, '\x7fELF x86_64 (built by make)\n');
      env.ms.v += 7000;
      ctx.out('cc -O2 -o build/app src/*.c\n');
      return 0;
    }),
    ...['adduser', 'useradd'].map((n) =>
      cmd(n, (ctx) => {
        const args = ctx.argv.slice(1);
        const name = args.filter((a, i) => !a.startsWith('-') && !['-u', '-G', '-g', '-h', '-s', '--uid'].includes(args[i - 1])).pop();
        if (!name) {
          ctx.err(`${n}: missing user name\n`);
          return 1;
        }
        const ui = args.findIndex((a) => a === '-u' || a === '--uid');
        const uid = ui >= 0 ? Number(args[ui + 1]) : 1000;
        const passwd = ctx.fs.exists('/etc/passwd') ? ctx.fs.readFile('/etc/passwd') : '';
        if (passwd.split('\n').some((l) => l.startsWith(name + ':'))) {
          ctx.err(`${n}: user '${name}' already exists\n`);
          return 1;
        }
        ctx.fs.writeFile('/etc/passwd', `${passwd}${name}:x:${uid}:${uid}:Linux User,,,:/home/${name}:/bin/sh\n`);
        const group = ctx.fs.exists('/etc/group') ? ctx.fs.readFile('/etc/group') : '';
        if (!group.split('\n').some((l) => l.startsWith(name + ':'))) ctx.fs.writeFile('/etc/group', `${group}${name}:x:${uid}:${name}\n`);
        if (!args.includes('-H') && (n === 'adduser' || args.includes('-m'))) {
          if (!ctx.fs.exists(`/home/${name}`)) ctx.fs.mkdir(`/home/${name}`, { parents: true });
          ctx.fs.chown(`/home/${name}`, uid, uid);
        }
        return 0;
      }),
    ),
    cmd('addgroup', (ctx) => {
      const args = ctx.argv.slice(1);
      const name = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-g').pop() ?? '';
      const gi = args.indexOf('-g');
      const gid = gi >= 0 ? Number(args[gi + 1]) : 1000;
      const group = ctx.fs.exists('/etc/group') ? ctx.fs.readFile('/etc/group') : '';
      ctx.fs.writeFile('/etc/group', `${group}${name}:x:${gid}:\n`);
      return 0;
    }),
    cmd('ln', (ctx) => {
      const args = ctx.argv.slice(1);
      const ops = args.filter((a) => !a.startsWith('-'));
      if (!args.some((a) => a.startsWith('-') && a.includes('s')) || ops.length !== 2) {
        ctx.err('ln: only symbolic links (ln -s) are simulated in builds\n');
        return 1;
      }
      if (ctx.fs.lstat(ops[1]) && args.some((a) => a.startsWith('-') && a.includes('f'))) ctx.fs.unlink(ops[1]);
      ctx.fs.symlink(ops[0], ops[1]);
      return 0;
    }),
  ];
}

const BUILD_BINS: Record<string, string> = { apk: '/sbin/apk', 'apt-get': '/usr/bin/apt-get', pip: '/usr/local/bin/pip', go: '/usr/local/go/bin/go', make: '/usr/bin/make', adduser: '/bin/busybox', useradd: '/usr/bin/apt-get', addgroup: '/bin/busybox', ln: '/bin/sh' };

// ── the builder ───────────────────────────────────────────────────────────

export interface BuildOpts {
  context: string;
  file?: string;
  tags: string[];
  target?: string;
  noCache: boolean;
  buildArgs: Record<string, string>;
  quiet?: boolean;
}

interface Stage {
  name: string;
  index: number;
  base: string;
  layers: string[];
  config: ImageConfigBody;
  history: HistoryEntry[];
  key: string;
  arch: string;
  os: string;
  user: string;
}

const fmtS = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Run a build; prints BuildKit-like progress and returns the image (or null on error). */
export async function build(m: SimMachineApi, st: DockerSnapshot, o: BuildOpts, io: Out): Promise<ImageRec | null> {
  const fs = m.rootFs;
  const ctxDir = fs.resolve(o.context);
  const dfPath = o.file ? (o.file.startsWith('/') ? o.file : `${ctxDir}/${o.file}`.replace(/\/\.\//g, '/')) : `${ctxDir}/Dockerfile`;
  const lines: string[] = [];
  const say = (s: string) => lines.push(s);
  let total = 0;
  const fail = (msg: string) => {
    io.out(`[+] Building ${fmtS(total)} (${lines.length}/${lines.length}) FINISHED\n${lines.join('\n')}\n`);
    io.err(`ERROR: ${msg}\n`);
    st.builds.push({ tags: o.tags, imageId: '', size: 0, steps: [], contextBytes: 0, at: clock(m), ok: false });
    return null;
  };
  if (!fs.exists(ctxDir) || fs.stat(ctxDir)?.type !== 'd') {
    io.err(`ERROR: unable to prepare context: path "${o.context}" not found\n`);
    return null;
  }
  if (!fs.exists(dfPath)) {
    io.err(`ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory\n`);
    return null;
  }
  const dfText = fs.readFile(dfPath);
  say(` => [internal] load build definition from ${dfPath.slice(dfPath.lastIndexOf('/') + 1)}`);
  say(` => => transferring dockerfile: ${dockerSize(dfText.length)}`);
  const parsed = parseDockerfile(dfText);
  if (!parsed.ok) return fail(`failed to build: failed to solve: ${parsed.error}`);
  // context, minus .dockerignore
  const ignorePath = `${ctxDir}/.dockerignore`;
  const ignore = ignoredBy(fs.exists(ignorePath) ? fs.readFile(ignorePath).split('\n') : []);
  const all = readHostTree(fs, ctxDir);
  const context: LayerFiles = {};
  for (const [p, e] of Object.entries(all)) if (!ignore(p.slice(1))) context[p] = e;
  const contextBytes = Object.values(context).reduce((n, e) => n + (e.t === 'f' ? e.size : 0), 0);
  say(' => [internal] load .dockerignore');
  say(` => => transferring context: ${dockerSize(fs.exists(ignorePath) ? fs.readFile(ignorePath).length : 2)}`);

  // stages
  const stages: Stage[] = [];
  const groups: Instruction[][] = [];
  const preArgs: Record<string, string> = {};
  for (const i of parsed.ins) {
    if (i.op === 'FROM') groups.push([i]);
    else if (!groups.length && i.op === 'ARG') for (const [k, v] of parseKv(i.args)) preArgs[k] = o.buildArgs[k] ?? v;
    else groups[groups.length - 1].push(i);
  }
  const subst = (s: string, vars: Record<string, string>) => s.replace(/\$\{(\w+)(?::-([^}]*))?\}|\$(\w+)/g, (_, a: string, d: string | undefined, b: string) => vars[a ?? b] ?? d ?? '');
  const stageNames = groups.map((g, i) => /\s+AS\s+(\S+)/i.exec(g[0].args)?.[1] ?? String(i));
  let targetIdx = groups.length - 1;
  if (o.target) {
    targetIdx = stageNames.indexOf(o.target);
    if (targetIdx < 0) return fail(`failed to build: failed to solve: target stage "${o.target}" could not be found`);
  }
  // only stages the target needs are built (BuildKit skips unused stages)
  const needed = new Set<number>([targetIdx]);
  for (let s = targetIdx; s >= 0; s--) {
    if (!needed.has(s)) continue;
    for (const i of groups[s]) {
      const from = i.flags.from ?? (i.op === 'FROM' ? i.args.split(/\s+/)[0] : undefined);
      const idx = from !== undefined ? stageNames.indexOf(from) : -1;
      if (idx >= 0 && idx < s) needed.add(idx);
    }
  }
  const counts = groups.map((g) => g.length);
  const stepRecs: BuildStepRec[] = [];
  for (let s = 0; s <= targetIdx; s++) {
    if (!needed.has(s)) continue;
    const g = groups[s];
    const fromRef = subst(g[0].args.split(/\s+/)[0], preArgs);
    const label = (n: number) => `[${groups.length > 1 ? `${/^\d+$/.test(stageNames[s]) ? `stage-${s}` : stageNames[s]} ` : ''}${n}/${counts[s]}]`;
    let stage: Stage;
    const prev = stages.find((x) => x.name === fromRef);
    if (prev) stage = { ...prev, name: stageNames[s], index: s, layers: [...prev.layers], config: { ...prev.config }, history: [...prev.history] };
    else if (fromRef === 'scratch') stage = { name: stageNames[s], index: s, base: 'scratch', layers: [], config: { Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'] }, history: [], key: 'scratch', arch: 'amd64', os: 'linux', user: '' };
    else {
      let img = findImage(st, fromRef);
      say(` => [internal] load metadata for docker.io/library/${fromRef.includes('/') ? fromRef : fromRef}`);
      if (!img) {
        const sink: Out = { out: () => {}, err: (x) => (pullErr += x) };
        let pullErr = '';
        img = (await pull(m, st, fromRef, sink, { quiet: true })) ?? undefined;
        if (!img) return fail(`failed to build: failed to solve: ${fromRef}: failed to resolve source metadata for docker.io/library/${fromRef}: ${pullErr.replace(/^Error response from daemon: /, '').trim()}`);
        total += 2100;
      }
      stage = { name: stageNames[s], index: s, base: fromRef, layers: [...img.layers], config: JSON.parse(JSON.stringify(img.config.config)), history: [...img.config.history], key: img.id, arch: img.config.architecture, os: img.config.os, user: img.config.config.User ?? '' };
    }
    say(` => ${label(1)} FROM ${fromRef === 'scratch' ? 'scratch' : `docker.io/library/${fromRef}`}`);
    const args: Record<string, string> = { ...preArgs };
    for (let k = 1; k < g.length; k++) {
      const ins = g[k];
      const vars = { ...args, ...Object.fromEntries((stage.config.Env ?? []).map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)])) };
      const text = subst(ins.args, vars);
      const norm = `${ins.op} ${Object.entries(ins.flags)
        .map(([a, b]) => `--${a}=${b} `)
        .join('')}${text}`;
      let keyExtra = '';
      let copyFiles: LayerFiles | null = null;
      if (ins.op === 'COPY' || ins.op === 'ADD') {
        const words = cmdForm(text).exec ? (JSON.parse(text) as string[]) : splitWords(text);
        const dest = words.pop() ?? '.';
        const wd = stage.config.WorkingDir || '/';
        const destAbs = normalizePath(dest.startsWith('/') ? dest : `${wd.replace(/\/$/, '')}/${dest}`) + (dest.endsWith('/') ? '/' : '');
        const src: LayerFiles = ins.flags.from !== undefined ? stageFiles(st, stages, ins.flags.from) ?? {} : context;
        if (ins.flags.from !== undefined && !stageFiles(st, stages, ins.flags.from)) {
          const img = findImage(st, ins.flags.from) ?? (await pull(m, st, ins.flags.from, { out: () => {}, err: () => {} }, { quiet: true }));
          if (!img) return fail(`failed to build: failed to solve: ${ins.flags.from}: not found`);
          Object.assign(src, merge(img.layers.map((d) => st.layers[d]?.files ?? {})));
        }
        copyFiles = {};
        const [cu, cg] = (ins.flags.chown ?? '').split(':');
        const own = (e: LayerFiles[string]) => ({ ...e, uid: ins.flags.chown ? Number(cu) || 0 : 0, gid: ins.flags.chown ? Number(cg ?? cu) || 0 : 0 });
        const destDir = destAbs.replace(/\/$/, '') || '';
        for (const w of words) {
          const rel = w.replace(/^\.(?=\/|$)/, '').replace(/^\/+/, '').replace(/\/$/, '');
          const put = (target: string, e: LayerFiles[string]) => (copyFiles![target.replace(/\/+/g, '/') || '/'] = own(e));
          if (rel === '' || src[`/${rel}`]?.t === 'd') {
            // a directory: its contents go into the destination
            const pre = rel === '' ? '/' : `/${rel}/`;
            for (const [p, e] of Object.entries(src)) if (p.startsWith(pre)) put(`${destDir}/${p.slice(pre.length)}`, e);
            copyFiles[destDir || '/'] = dir();
            continue;
          }
          const re = new RegExp(`^/${rel.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
          const hits = Object.keys(src).filter((p) => re.test(p) && src[p].t !== 'd');
          if (!hits.length) return fail(`failed to build: failed to solve: failed to compute cache key: failed to calculate checksum of ref: "/${rel}": not found`);
          const toDir = dest.endsWith('/') || dest === '.' || words.length > 1 || hits.length > 1;
          for (const p of hits) put(toDir ? `${destDir}/${p.slice(p.lastIndexOf('/') + 1)}` : destAbs, src[p]);
          if (toDir) copyFiles[destDir || '/'] = dir();
        }
        keyExtra = await sha256hex(canonical(Object.entries(copyFiles).map(([p, e]) => [p, e.t, e.mode, e.size, e.text ?? ''])));
      }
      if (ins.op === 'RUN') keyExtra = canonical({ args, user: stage.user, wd: stage.config.WorkingDir ?? '' });
      const key = await sha256hex(`${stage.key}\n${norm}\n${keyExtra}`);
      const isLayer = ins.op === 'RUN' || ins.op === 'COPY' || ins.op === 'ADD';
      const cached = !o.noCache && st.buildCache[key] !== undefined && (!isLayer || (st.buildCache[key].diffId !== null && !!st.layers[st.buildCache[key].diffId!]));
      const n = k + 1;
      let ms = 0;
      const createdBy = ins.op === 'RUN' ? `RUN ${cmdForm(text).exec ? text : `/bin/sh -c ${text}`} # buildkit` : ins.op === 'COPY' || ins.op === 'ADD' ? `${ins.op} ${text} # buildkit` : `${ins.op} ${text}`;
      // metadata instructions
      const applyMeta = () => {
        switch (ins.op) {
          case 'WORKDIR':
            stage.config.WorkingDir = text.startsWith('/') ? text : `${(stage.config.WorkingDir || '/').replace(/\/$/, '')}/${text}`;
            break;
          case 'ENV': {
            const env = [...(stage.config.Env ?? [])];
            for (const [k2, v] of parseKv(text)) {
              const idx = env.findIndex((e) => e.startsWith(k2 + '='));
              if (idx >= 0) env[idx] = `${k2}=${v}`;
              else env.push(`${k2}=${v}`);
            }
            stage.config.Env = env;
            break;
          }
          case 'ARG':
            for (const [k2, v] of parseKv(text.includes('=') ? text : `${text}=`)) args[k2] = o.buildArgs[k2] ?? v;
            break;
          case 'LABEL':
            stage.config.Labels = { ...(stage.config.Labels ?? {}), ...Object.fromEntries(parseKv(text)) };
            break;
          case 'EXPOSE':
            stage.config.ExposedPorts = { ...(stage.config.ExposedPorts ?? {}), ...Object.fromEntries(text.split(/\s+/).map((p) => [p.includes('/') ? p : `${p}/tcp`, {}])) };
            break;
          case 'CMD':
            stage.config.Cmd = cmdForm(text).argv;
            break;
          case 'ENTRYPOINT':
            stage.config.Entrypoint = cmdForm(text).argv;
            stage.config.Cmd = null;
            break;
          case 'USER':
            stage.config.User = text;
            stage.user = text;
            break;
          case 'STOPSIGNAL':
            stage.config.StopSignal = text;
            break;
          case 'VOLUME':
            stage.config.Volumes = { ...(stage.config.Volumes ?? {}), ...Object.fromEntries((cmdForm(text).exec ? (JSON.parse(text) as string[]) : text.split(/\s+/)).map((v) => [v, {}])) };
            break;
          case 'HEALTHCHECK': {
            const cm = /^CMD\s+(.*)$/i.exec(text);
            stage.config.Healthcheck = cm ? { Test: cmdForm(cm[1]).exec ? ['CMD', ...cmdForm(cm[1]).argv] : ['CMD-SHELL', cm[1]] } : { Test: ['NONE'] };
            break;
          }
        }
      };
      if (!isLayer) {
        applyMeta();
        stage.history.push({ created: new Date(clock(m)).toISOString(), created_by: createdBy, comment: 'buildkit.dockerfile.v0', empty_layer: true });
        stage.key = key;
        st.buildCache[key] = { diffId: null, createdBy };
        if (ins.op === 'WORKDIR' || ins.op === 'ENV' || ins.op === 'USER') say(` => ${cached ? 'CACHED ' : ''}${label(n)} ${ins.op} ${text}`);
        stepRecs.push({ n, stage: stage.name, text: `${ins.op} ${text}`, cached, ms: 0, layer: false });
        continue;
      }
      let diffId: string;
      if (cached) {
        diffId = st.buildCache[key].diffId!;
        say(` => CACHED ${label(n)} ${ins.op} ${text}`);
      } else if (copyFiles) {
        ms = 80 + Math.round(Object.values(copyFiles).reduce((a, e) => a + e.size, 0) / 50_000);
        const layer = await makeLayer(copyFiles, createdBy);
        st.layers[layer.diffId] = layer;
        diffId = layer.diffId;
        say(` => ${label(n)} ${ins.op} ${text}${' '.repeat(Math.max(1, 40 - text.length))}${fmtS(ms)}`);
      } else {
        // RUN: a temporary container over the stage's layers
        const run = cmdForm(text);
        const tmp = buildContainer(stage, key);
        st.containers.push(tmp);
        const ctx: ContainerCtx = { host: m, st, containerId: tmp.id };
        const opened = await openContainer(ctx, tmp, { user: stage.user || undefined });
        const env: RecipeEnv = { weights: new Map(), ms: { v: 0 } };
        for (const r of recipes(env)) {
          const binPath = BUILD_BINS[r.name];
          if (opened.cm.lookup(r.name) || (binPath && opened.cm.vfs.statAs(binPath, { uid: 0, gid: 0, groups: [0] })) || (r.name === 'pip' && opened.cm.vfs.statAs('/usr/local/bin/python3', { uid: 0, gid: 0, groups: [0] }))) opened.cm.addLocalCommand(r);
        }
        if (stage.config.WorkingDir) await opened.cm.exec(`mkdir -p ${stage.config.WorkingDir} && cd ${stage.config.WorkingDir}`);
        const line = run.exec ? run.argv.join(' ') : text;
        const r = await opened.cm.exec(line);
        opened.commit();
        st.containers = st.containers.filter((x) => x !== tmp);
        ms = 200 + env.ms.v;
        const outLines = r.out.replace(/\n$/, '').split('\n').filter(Boolean);
        say(` => ${label(n)} RUN ${text}${' '.repeat(Math.max(1, 40 - text.length))}${fmtS(ms)}`);
        for (const l of outLines.slice(0, 6)) say(` => => # ${l}`);
        if (r.exit !== 0) {
          total += ms;
          return fail(`failed to build: failed to solve: process "/bin/sh -c ${text}" did not complete successfully: exit code: ${r.exit}`);
        }
        const layer = await makeLayer(tmp.upper, createdBy);
        st.layers[layer.diffId] = layer;
        diffId = layer.diffId;
      }
      total += ms;
      stage.layers.push(diffId);
      stage.history.push({ created: new Date(clock(m)).toISOString(), created_by: createdBy, comment: 'buildkit.dockerfile.v0' });
      stage.key = key;
      st.buildCache[key] = { diffId, createdBy };
      stepRecs.push({ n, stage: stage.name, text: `${ins.op} ${text}`, cached, ms, layer: true, mounts: ins.flags.mount ? [ins.flags.mount] : undefined });
    }
    stages.push(stage);
  }
  const fin = stages.find((x) => x.index === targetIdx)!;
  const config: ImageConfigDoc = {
    architecture: fin.arch,
    os: fin.os,
    created: new Date(clock(m)).toISOString(),
    config: fin.config,
    rootfs: { type: 'layers', diff_ids: fin.layers },
    history: fin.history,
  };
  const id = await digestOf(canonical(config));
  let img = st.images.find((i) => i.id === id);
  if (!img) {
    img = { id, repoTags: [], repoDigests: [], layers: fin.layers, config, platform: `${fin.os}/${fin.arch}`, created: clock(m) };
    st.images.push(img);
  }
  const tags = o.tags.map((t) => (t.includes(':') && !/:\d+\//.test(t) ? t : `${t}:latest`));
  for (const t of tags) {
    for (const other of st.images) if (other !== img) other.repoTags = other.repoTags.filter((x) => x !== t);
    if (!img.repoTags.includes(t)) img.repoTags.push(t);
  }
  say(' => exporting to image');
  say(' => => exporting layers');
  say(` => => writing image ${id}`);
  for (const t of tags) say(` => => naming to docker.io/library/${t}`);
  total += 150;
  const size = img.layers.reduce((n, d) => n + (st.layers[d]?.size ?? 0), 0);
  st.builds.push({ tags, imageId: id, size, steps: stepRecs, contextBytes, at: clock(m), ok: true });
  if (st.builds.length > 10) st.builds.shift();
  if (o.quiet) io.out(`${id}\n`);
  else io.out(`[+] Building ${fmtS(total)} (${lines.length}/${lines.length}) FINISHED                    docker:default\n${lines.join('\n')}\n`);
  return img;
}

/** /app/./x/../y → /app/y */
function normalizePath(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

function stageFiles(st: DockerSnapshot, stages: Stage[], name: string): LayerFiles | null {
  const s = stages.find((x) => x.name === name);
  return s ? merge(s.layers.map((d) => st.layers[d]?.files ?? {})) : null;
}

function buildContainer(stage: Stage, key: string): ContainerRec {
  return {
    id: `build${key.slice(0, 59)}`,
    name: `buildkit_${key.slice(0, 8)}`,
    image: stage.base,
    imageId: '',
    created: 0,
    status: 'running',
    exitCode: null,
    startedAt: 0,
    finishedAt: null,
    oomKilled: false,
    restartCount: 0,
    stopDurationMs: null,
    stoppedByUser: false,
    pid: 0,
    procs: [],
    config: { ...stage.config, Hostname: 'buildkitsandbox', Tty: false, OpenStdin: false, Image: stage.base },
    hostConfig: { memory: 0, pidsLimit: null, cpus: 0, init: false, autoRemove: false, restartPolicy: { name: 'no', maximumRetryCount: 0 }, portBindings: [], networkMode: 'none', readonlyRootfs: false, capAdd: [], capDrop: [], privileged: false, securityOpt: [], stopTimeout: null, stopSignal: null, user: stage.user, logConfig: { type: 'none', config: {} }, tmpfs: [], sysctls: {} },
    networks: {},
    mounts: [],
    upper: {},
    tmpfsData: {},
    logs: [],
    program: null,
    health: null,
    labels: {},
    buildLayers: [...stage.layers],
  };
}
