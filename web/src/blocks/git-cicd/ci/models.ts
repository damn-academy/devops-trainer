// Tool models for CI job machines (06 §0.3): commands that cannot run in a
// browser (`npm ci`, `docker build`) are modelled with a closed list of
// behaviours and real error texts; `npm test` and `npm run` execute the real
// scripts of the project in the job's shell. These commands exist only on job
// machines (a separate command registry), never in the learner's terminal.

import type { CmdContext, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';

/** What a job machine knows about the job it runs (set by the runner). */
export interface JobContext {
  addTime(sec: number): void;
  /** `from` is the base image of the Dockerfile the image was built from (what it does when it runs). */
  pushImage(image: string, tag: string, from?: string): void;
  registryLoggedIn: boolean;
}

export function jobCtx(ctx: CmdContext): JobContext | undefined {
  return ctx.machine.ext<JobContext | undefined>('ci.job', () => undefined);
}

const summary = bi('Модель инструмента в джобе CI', 'A tool model inside a CI job');

function readJson(ctx: CmdContext, path: string): Record<string, unknown> | null {
  if (!ctx.fs.exists(path)) return null;
  try {
    return JSON.parse(ctx.fs.readFile(path)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const sameDeps = (a: unknown, b: unknown) => JSON.stringify(Object.entries((a as object) ?? {}).sort()) === JSON.stringify(Object.entries((b as object) ?? {}).sort());

export const npmModel: ShellCommand = {
  name: 'npm',
  override: true,
  summary,
  help: 'npm <command>\n\nUsage:\n\nnpm ci        clean install from package-lock.json\nnpm test      run the "test" script\nnpm run <s>   run a script from package.json\n',
  async run(ctx) {
    const [sub, ...rest] = ctx.argv.slice(1);
    const pkg = readJson(ctx, 'package.json');
    const job = jobCtx(ctx);
    if (!pkg) {
      ctx.err(`npm error code ENOENT\nnpm error syscall open\nnpm error path ${ctx.cwd}/package.json\nnpm error errno -2\nnpm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '${ctx.cwd}/package.json'\n`);
      return 254;
    }
    if (sub === 'ci' || sub === 'install' || sub === 'i') {
      const lock = readJson(ctx, 'package-lock.json');
      if (sub === 'ci' && !lock) {
        ctx.err('npm error code EUSAGE\nnpm error\nnpm error The `npm ci` command can only install with an existing package-lock.json or\nnpm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or\nnpm error later to generate a package-lock.json file, then try again.\n');
        return 1;
      }
      const lockDeps = ((lock?.packages as Record<string, Record<string, unknown>> | undefined)?.[''] ?? {}).dependencies;
      if (sub === 'ci' && !sameDeps(lockDeps, pkg.dependencies)) {
        ctx.err('npm error code EUSAGE\nnpm error\nnpm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.\n');
        return 1;
      }
      const deps = Object.keys((pkg.dependencies as object) ?? {}).concat(Object.keys((pkg.devDependencies as object) ?? {}));
      const cached = ctx.fs.exists('.npm/_cacache');
      const packages = 40 + deps.length * 29;
      const sec = cached ? 9 : 52;
      if (ctx.fs.exists('node_modules')) {
        // npm ci starts from an empty node_modules.
        const walk = (p: string) => {
          for (const e of ctx.fs.readdir(p)) {
            const x = `${p}/${e}`;
            if (ctx.fs.stat(x)?.type === 'd') {
              walk(x);
              ctx.fs.rmdir(x);
            } else ctx.fs.unlink(x);
          }
        };
        if (sub === 'ci') walk('node_modules');
      }
      ctx.fs.mkdir('node_modules/.bin', { parents: true });
      for (const d of deps) {
        ctx.fs.mkdir(`node_modules/${d}`, { parents: true });
        ctx.fs.writeFile(`node_modules/${d}/package.json`, JSON.stringify({ name: d, version: '1.0.0' }) + '\n');
      }
      ctx.fs.writeFile('node_modules/.package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }) + '\n');
      ctx.fs.mkdir('.npm/_cacache', { parents: true });
      ctx.fs.writeFile('.npm/_cacache/index', deps.join('\n') + '\n');
      job?.addTime(sec);
      ctx.out(`\nadded ${packages} packages, and audited ${packages + 1} packages in ${sec}s\n\nfound 0 vulnerabilities\n`);
      return 0;
    }
    const script = sub === 'test' || sub === 't' ? 'test' : sub === 'run' || sub === 'run-script' ? rest[0] : sub === 'start' ? 'start' : null;
    if (sub === 'run' && !rest[0]) {
      const scripts = (pkg.scripts as Record<string, string>) ?? {};
      ctx.out(`Scripts available in ${pkg.name} via \`npm run\`:\n${Object.entries(scripts).map(([k, v]) => `  ${k}\n    ${v}`).join('\n')}\n`);
      return 0;
    }
    if (!script) {
      ctx.err(`Unknown command: "${sub ?? ''}"\n\nTo see a list of supported npm commands, run:\n  npm help\n`);
      return 1;
    }
    const body = ((pkg.scripts as Record<string, string>) ?? {})[script];
    if (!body) {
      ctx.err(`npm error Missing script: "${script}"\nnpm error\nnpm error To see a list of scripts, run:\nnpm error   npm run\n`);
      return 1;
    }
    ctx.out(`\n> ${pkg.name}@${pkg.version ?? '1.0.0'} ${script}\n> ${body}\n\n`);
    job?.addTime(2);
    const r = await ctx.shell.run(body, { args: ['sh', ...rest.slice(1)] });
    ctx.out(r.out);
    ctx.err(r.err);
    return r.exit;
  },
};

export const dockerModel: ShellCommand = {
  name: 'docker',
  override: true,
  summary,
  help: 'Usage:  docker [OPTIONS] COMMAND\n\nCommands:\n  build   Build an image from a Dockerfile\n  login   Log in to a registry\n  push    Upload an image to a registry\n',
  run(ctx) {
    const [sub, ...rest] = ctx.argv.slice(1);
    const job = jobCtx(ctx);
    const built = ctx.machine.ext<Set<string>>('ci.images', () => new Set());
    if (sub === 'login') {
      const pass = rest[rest.indexOf('-p') + 1] ?? rest[rest.indexOf('--password') + 1];
      if (!pass || rest.indexOf('-p') < 0 && rest.indexOf('--password') < 0 && !rest.includes('--password-stdin')) {
        ctx.err('Error: Cannot perform an interactive login from a non TTY device\n');
        return 1;
      }
      const passStdin = rest.includes('--password-stdin') ? ctx.stdin.trim() : pass;
      if (!passStdin) {
        ctx.err('Error: Cannot perform an interactive login from a non TTY device\n');
        return 1;
      }
      if (job) job.registryLoggedIn = true;
      ctx.out('Login Succeeded\n');
      return 0;
    }
    if (sub === 'build') {
      const ti = rest.indexOf('-t');
      const tag = ti >= 0 ? rest[ti + 1] : undefined;
      const dir = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '-t').pop() ?? '.';
      const file = `${dir.replace(/\/$/, '')}/Dockerfile`;
      if (!ctx.fs.exists(file)) {
        ctx.err('ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory\n');
        return 1;
      }
      const steps = ctx.fs.readFile(file).split('\n').filter((l) => /^\s*[A-Z]+\s/.test(l));
      ctx.out(`#0 building with "default" instance using docker driver\n\n`);
      steps.forEach((s, i) => ctx.out(`#${i + 1} [${i + 1}/${steps.length}] ${s.trim()}\n#${i + 1} DONE 0.${(i * 3 + 2) % 10}s\n`));
      ctx.out(`#${steps.length + 1} exporting to image\n#${steps.length + 1} naming to ${tag ?? 'sha256:…'} done\n`);
      const ref = tag ? (tag.includes(':') ? tag : `${tag}:latest`) : null;
      if (ref) {
        built.add(ref);
        const from = /^\s*FROM\s+(\S+)/im.exec(ctx.fs.readFile(file))?.[1];
        if (from) ctx.machine.ext<Map<string, string>>('ci.image-from', () => new Map()).set(ref, from);
      }
      job?.addTime(14);
      return 0;
    }
    if (sub === 'push') {
      const ref = rest[0];
      if (!ref) {
        ctx.err('"docker push" requires exactly 1 argument.\n');
        return 1;
      }
      const full = ref.includes(':') ? ref : `${ref}:latest`;
      if (!built.has(full)) {
        ctx.err(`An image does not exist locally with the tag: ${ref.split(':')[0]}\n`);
        return 1;
      }
      if (job && !job.registryLoggedIn) {
        ctx.err(`unauthorized: HTTP Basic: Access denied. If a password was provided for Git authentication, the password was incorrect or you're required to use a token instead of a password.\n`);
        return 1;
      }
      const [image, tag] = [full.slice(0, full.lastIndexOf(':')), full.slice(full.lastIndexOf(':') + 1)];
      ctx.out(`The push refers to repository [${image}]\n${tag}: digest: sha256:${(image + tag).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0')}… size: 1570\n`);
      job?.pushImage(image, tag, ctx.machine.ext<Map<string, string>>('ci.image-from', () => new Map()).get(full));
      job?.addTime(6);
      return 0;
    }
    ctx.err(`docker: '${sub ?? ''}' is not a docker command.\nSee 'docker --help'\n`);
    return 1;
  },
};

/** Small POSIX tools a job image has; added to job machines only when no other block registered them. */
export const jobFallbacks: ShellCommand[] = [
  {
    name: 'test',
    aliases: ['['],
    builtin: true,
    summary,
    run(ctx) {
      let a = ctx.argv.slice(1);
      if (ctx.argv[0] === '[') {
        if (a[a.length - 1] !== ']') {
          ctx.err("[: missing `]'\n");
          return 2;
        }
        a = a.slice(0, -1);
      }
      const ev = (x: string[]): boolean => {
        if (x[0] === '!') return !ev(x.slice(1));
        if (x.length === 0) return false;
        if (x.length === 1) return x[0] !== '';
        if (x.length === 2) {
          const [op, v] = x;
          const st = ctx.fs.stat(v);
          if (op === '-n') return v !== '';
          if (op === '-z') return v === '';
          if (op === '-f') return st?.type === 'f';
          if (op === '-d') return st?.type === 'd';
          if (op === '-e') return !!st;
          if (op === '-s') return !!st && st.size > 0;
          if (op === '-x') return !!st && ctx.fs.access(v, 'x');
          return false;
        }
        const [l, op, r] = x;
        if (op === '=' || op === '==') return l === r;
        if (op === '!=') return l !== r;
        const n = (s: string) => Number(s);
        if (op === '-eq') return n(l) === n(r);
        if (op === '-ne') return n(l) !== n(r);
        if (op === '-gt') return n(l) > n(r);
        if (op === '-ge') return n(l) >= n(r);
        if (op === '-lt') return n(l) < n(r);
        if (op === '-le') return n(l) <= n(r);
        return false;
      };
      return ev(a) ? 0 : 1;
    },
  },
  {
    name: 'cp',
    summary,
    run(ctx) {
      const rec = ctx.argv.includes('-r') || ctx.argv.includes('-R') || ctx.argv.includes('-a');
      const ops = ctx.argv.slice(1).filter((x) => !x.startsWith('-'));
      if (ops.length < 2) {
        ctx.err('cp: missing destination file operand\n');
        return 1;
      }
      const dst = ops.pop()!;
      const copy = (src: string, to: string) => {
        const st = ctx.fs.stat(src);
        if (!st) throw Object.assign(new Error(`cannot stat '${src}': No such file or directory`), {});
        if (st.type === 'd') {
          if (!rec) throw new Error(`-r not specified; omitting directory '${src}'`);
          if (!ctx.fs.exists(to)) ctx.fs.mkdir(to, { parents: true });
          for (const e of ctx.fs.readdir(src)) copy(`${src}/${e}`, `${to}/${e}`);
        } else ctx.fs.writeFile(to, ctx.fs.readFile(src));
      };
      try {
        for (const s of ops) {
          const target = ctx.fs.stat(dst)?.type === 'd' ? `${dst}/${s.replace(/\/$/, '').split('/').pop()}` : dst;
          copy(s.replace(/\/$/, ''), target);
        }
      } catch (e) {
        ctx.err(`cp: ${(e as Error).message}\n`);
        return 1;
      }
      return 0;
    },
  },
  {
    name: 'sleep',
    summary,
    run(ctx) {
      jobCtx(ctx)?.addTime(Number(ctx.argv[1]) || 0);
      return 0;
    },
  },
  {
    name: 'env',
    aliases: ['printenv'],
    summary,
    run(ctx) {
      const one = ctx.argv[0] === 'printenv' ? ctx.argv[1] : undefined;
      if (one) {
        if (!(one in ctx.env)) return 1;
        ctx.out(ctx.env[one] + '\n');
        return 0;
      }
      for (const [k, v] of Object.entries(ctx.env).sort()) ctx.out(`${k}=${v}\n`);
      return 0;
    },
  },
  {
    name: 'base64',
    summary,
    run(ctx) {
      const decode = ctx.argv.includes('-d') || ctx.argv.includes('--decode');
      const file = ctx.argv.slice(1).find((a) => !a.startsWith('-'));
      const input = file ? ctx.fs.readFile(file) : ctx.stdin;
      const bytes = new TextEncoder().encode(input);
      if (decode) {
        ctx.out(new TextDecoder().decode(Uint8Array.from(atob(input.replace(/\s+/g, '')), (c) => c.charCodeAt(0))));
        return 0;
      }
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      ctx.out(btoa(bin) + '\n');
      return 0;
    },
  },
];
