// Shell built-ins and shell-level programs of the Linux block: set, shift,
// source, read, test/[, alias, type, which, command, exec, jobs, fg, bg,
// wait, sleep, env, printenv, bash (with nested interactive shells), date.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { parseControl } from '../control';
import { CAP_FULL, capHex, type KProc } from '../kernel';
import { PROGRAMS, type SimMachine } from '../shell';
import { isFsError } from '../vfs';
import { cmdDoc, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;

/** The environment a child bash gets: what the command was given (exported variables and per-command assignments). */
function childEnv(ctx: CmdContext): Record<string, string> {
  return { ...ctx.env };
}

const set: ShellCommand = {
  name: 'set',
  builtin: true,
  summary: bi('включить режимы оболочки (-e, -u, -x, pipefail)', 'set shell options (-e, -u, -x, pipefail)'),
  help: `set: set [-eux] [-o option-name] [--] [arg ...]
    Set or unset values of shell options and positional parameters.

    Options:
      -e  Exit immediately if a command exits with a non-zero status.
      -u  Treat unset variables as an error when substituting.
      -x  Print commands and their arguments as they are executed.
      -o option-name
          Set the variable corresponding to option-name:
              errexit      same as -e
              nounset      same as -u
              pipefail     the return value of a pipeline is the status of
                           the last command to exit with a non-zero status,
                           or zero if no command exited with a non-zero status
              xtrace       same as -x

    Using + rather than - causes these flags to be turned off.

    Exit Status:
    Returns success unless an invalid option is given.`,
  run(ctx) {
    const m = M(ctx);
    const opts = m.shellOptsOf(ctx);
    const args = ctx.argv.slice(1);
    if (!args.length) {
      for (const [k, v] of Object.entries(m.vars).sort()) ctx.out(`${k}=${/^[\w./:-]*$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`}\n`);
      return 0;
    }
    const map: Record<string, keyof typeof opts> = { e: 'errexit', u: 'nounset', x: 'xtrace', errexit: 'errexit', nounset: 'nounset', xtrace: 'xtrace', pipefail: 'pipefail' };
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      const on = a.startsWith('-');
      if (a === '-o' || a === '+o') {
        const name = args[++i];
        if (name === undefined) {
          for (const k of ['errexit', 'nounset', 'pipefail', 'xtrace'] as const) ctx.out(`${k.padEnd(15)}\t${opts[k] ? 'on' : 'off'}\n`);
          continue;
        }
        if (!map[name]) {
          ctx.err(`bash: set: ${name}: invalid option name\n`);
          return 1;
        }
        opts[map[name]] = on;
        continue;
      }
      if (/^[-+][euxo]+$/.test(a)) {
        for (const c of a.slice(1)) {
          if (c === 'o') {
            const name = args[++i];
            if (!name || !map[name]) {
              ctx.err(`bash: set: ${name ?? ''}: invalid option name\n`);
              return 1;
            }
            opts[map[name]] = on;
          } else opts[map[c]] = on;
        }
        continue;
      }
      ctx.err(`bash: set: ${a}: invalid option\nset: usage: set [-abefhkmnptuvxBCEHPT] [-o option-name] [--] [-] [arg ...]\n`);
      return 2;
    }
    return 0;
  },
};

const shift: ShellCommand = {
  name: 'shift',
  builtin: true,
  summary: bi('сдвинуть позиционные параметры', 'shift the positional parameters'),
  help: 'shift: shift [n]\n    Shift positional parameters.\n\n    Rename the positional parameters $N+1,$N+2 ... to $1,$2 ...  If N is\n    not given, it is assumed to be 1.',
  run(ctx) {
    const args = M(ctx).frameArgs(ctx);
    const n = Number(ctx.argv[1] ?? 1);
    if (!args || args.length - 1 < n) return 1;
    args.splice(1, n);
    return 0;
  },
};

const source: ShellCommand = {
  name: 'source',
  aliases: ['.'],
  builtin: true,
  summary: bi('выполнить файл в текущей оболочке', 'run a file in the current shell'),
  help: 'source: source filename [arguments]\n    Execute commands from a file in the current shell.\n\n    Read and execute commands from FILENAME in the current shell.  Unlike\n    running a script, variables, aliases and cd done by the file stay in\n    your shell afterwards: that is how ~/.bashrc changes take effect\n    without opening a new terminal.\n\n    Exit Status:\n    Returns the status of the last command executed in FILENAME; fails if\n    FILENAME cannot be read.',
  async run(ctx) {
    const f = ctx.argv[1];
    if (!f) {
      ctx.err(`bash: ${ctx.argv[0]}: filename argument required\n${ctx.argv[0]}: usage: ${ctx.argv[0]} filename [arguments]\n`);
      return 2;
    }
    let text: string;
    try {
      text = ctx.fs.readFile(f);
    } catch (e) {
      if (isFsError(e)) {
        ctx.err(`bash: ${f}: ${e.text}\n`);
        return 1;
      }
      throw e;
    }
    const m = M(ctx);
    const aliasRe = /^\s*alias\s+([\w.-]+)=(['"]?)(.*)\2\s*$/;
    for (const l of text.split('\n')) {
      const am = aliasRe.exec(l);
      if (am) m.aliases.set(am[1], am[3]);
    }
    return m.runScript(text.split('\n').filter((l) => !aliasRe.test(l)).join('\n'), [f, ...ctx.argv.slice(2)], { writeOut: ctx.out, writeErr: ctx.err, source: true, ppid: m.shellPid });
  },
};

const read: ShellCommand = {
  name: 'read',
  builtin: true,
  summary: bi('прочитать строку в переменную', 'read a line into variables'),
  help: 'read: read [-r] [-p prompt] [name ...]\n    Read a line from the standard input and split it into fields.\n\n    The line is split into fields as with word splitting, and the first\n    word is assigned to the first NAME, the second word to the second NAME,\n    and so on, with any leftover words assigned to the last NAME.\n\n    Options:\n      -p prompt\toutput the string PROMPT without a trailing newline before\n    \t\tattempting to read\n      -r\tdo not allow backslashes to escape any characters\n\n    Exit Status:\n    The return code is zero, unless end-of-file is encountered.',
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const names: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-p') ctx.err(args[++i] ?? '');
      else if (args[i] === '-r' || args[i] === '-s') continue;
      else names.push(args[i]);
    }
    const line = m.readLine(ctx);
    if (line === null) return 1;
    const vars = names.length ? names : ['REPLY'];
    const words = vars.length === 1 ? [line] : line.trim().split(/\s+/);
    vars.forEach((n, i) => ctx.shell.setVar(n, i === vars.length - 1 ? words.slice(i).join(' ') : (words[i] ?? '')));
    return 0;
  },
};

/** test / [ : file tests, string and integer comparisons, !, -a, -o. */
export function evalTest(ctx: CmdContext, args: string[]): boolean | 'error' {
  const fs = ctx.fs;
  const unary = (op: string, v: string): boolean | undefined => {
    const st = () => {
      try {
        return fs.stat(v);
      } catch {
        return null;
      }
    };
    switch (op) {
      case '-e':
        return !!st();
      case '-f':
        return st()?.type === 'f';
      case '-d':
        return st()?.type === 'd';
      case '-L':
      case '-h':
        return fs.lstat(v)?.type === 'l';
      case '-s':
        return (st()?.size ?? 0) > 0;
      case '-r':
        return !!st() && fs.access(v, 'r');
      case '-w':
        return !!st() && fs.access(v, 'w');
      case '-x':
        return !!st() && fs.access(v, 'x');
      case '-z':
        return v === '';
      case '-n':
        return v !== '';
    }
    return undefined;
  };
  const binary = (a: string, op: string, b: string): boolean | undefined => {
    const n = (x: string) => {
      if (!/^\s*-?\d+\s*$/.test(x)) throw new Error(`${x}: integer expression expected`);
      return Number(x);
    };
    switch (op) {
      case '=':
      case '==':
        return a === b;
      case '!=':
        return a !== b;
      case '-eq':
        return n(a) === n(b);
      case '-ne':
        return n(a) !== n(b);
      case '-lt':
        return n(a) < n(b);
      case '-le':
        return n(a) <= n(b);
      case '-gt':
        return n(a) > n(b);
      case '-ge':
        return n(a) >= n(b);
      case '-nt':
        return (fs.stat(a)?.mtime ?? 0) > (fs.stat(b)?.mtime ?? 0);
    }
    return undefined;
  };
  const evalExpr = (xs: string[]): boolean => {
    const oi = xs.lastIndexOf('-o');
    if (oi > 0) return evalExpr(xs.slice(0, oi)) || evalExpr(xs.slice(oi + 1));
    const ai = xs.lastIndexOf('-a');
    if (ai > 0 && xs.length > 3) return evalExpr(xs.slice(0, ai)) && evalExpr(xs.slice(ai + 1));
    if (xs[0] === '!') return !evalExpr(xs.slice(1));
    if (xs.length === 0) return false;
    if (xs.length === 1) return xs[0] !== '';
    if (xs.length === 2) {
      const r = unary(xs[0], xs[1]);
      if (r === undefined) throw new Error(`${xs[0]}: unary operator expected`);
      return r;
    }
    if (xs.length === 3) {
      const r = binary(xs[0], xs[1], xs[2]);
      if (r === undefined) throw new Error(`${xs[1]}: binary operator expected`);
      return r;
    }
    throw new Error('too many arguments');
  };
  try {
    return evalExpr(args);
  } catch (e) {
    ctx.err(`bash: ${ctx.argv[0]}: ${(e as Error).message}\n`);
    return 'error';
  }
}

const test: ShellCommand = {
  ...cmdDoc({
    name: 'test',
    summary: bi('проверить условие: файл, строку, число', 'evaluate a condition: file, string, number'),
    whatis: 'check file types and compare values',
    synopsis: ['test EXPRESSION', '[ EXPRESSION ]'],
    description: 'Exit with the status determined by EXPRESSION: 0 if it is true, 1 if it is false. It is what if, && and || look at.\nThe spaces matter: [ is a command, and ] is its last argument.',
    options: [
      ['-d FILE', 'FILE exists and is a directory'],
      ['-e FILE', 'FILE exists'],
      ['-f FILE', 'FILE exists and is a regular file'],
      ['-r FILE', 'FILE exists and the user has read access'],
      ['-s FILE', 'FILE exists and has a size greater than zero'],
      ['-x FILE', 'FILE exists and the user has execute (or search) access'],
      ['-n STRING', 'the length of STRING is nonzero'],
      ['-z STRING', 'the length of STRING is zero'],
      ['STRING1 = STRING2', 'the strings are equal'],
      ['INTEGER1 -eq INTEGER2', 'INTEGER1 is equal to INTEGER2 (also -ne -lt -le -gt -ge)'],
      ['! EXPRESSION', 'EXPRESSION is false'],
    ],
    exit: '0 if the expression is true, 1 if it is false, 2 if an error occurred.',
    seeAlso: 'bash(1)',
  }),
  aliases: ['['],
  builtin: true,
  run(ctx) {
    let args = ctx.argv.slice(1);
    if (ctx.argv[0] === '[') {
      if (args[args.length - 1] !== ']') {
        ctx.err("bash: [: missing `]'\n");
        return 2;
      }
      args = args.slice(0, -1);
    }
    const r = evalTest(ctx, args);
    return r === 'error' ? 2 : r ? 0 : 1;
  },
};

const alias: ShellCommand = {
  name: 'alias',
  builtin: true,
  summary: bi('задать короткое имя для команды', 'define a short name for a command'),
  help: "alias: alias [-p] [name[=value] ... ]\n    Define or display aliases.\n\n    Without arguments, `alias' prints the list of aliases in the reusable\n    form `alias NAME=VALUE' on standard output.\n\n    Otherwise, an alias is defined for each NAME whose VALUE is given.\n    An alias lives in the current shell only: put it in ~/.bashrc to have\n    it in every new shell.",
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1).filter((a) => a !== '-p');
    if (!args.length) {
      for (const [k, v] of [...m.aliases].sort()) ctx.out(`alias ${k}='${v}'\n`);
      return 0;
    }
    let exit = 0;
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq < 0) {
        const v = m.aliases.get(a);
        if (v === undefined) {
          ctx.err(`bash: alias: ${a}: not found\n`);
          exit = 1;
        } else ctx.out(`alias ${a}='${v}'\n`);
      } else m.aliases.set(a.slice(0, eq), a.slice(eq + 1));
    }
    return exit;
  },
};

const unalias: ShellCommand = {
  name: 'unalias',
  builtin: true,
  summary: bi('удалить псевдоним', 'remove an alias'),
  help: 'unalias: unalias [-a] name [name ...]\n    Remove each NAME from the list of defined aliases.',
  run(ctx) {
    const m = M(ctx);
    for (const a of ctx.argv.slice(1)) {
      if (a === '-a') m.aliases.clear();
      else if (!m.aliases.delete(a)) {
        ctx.err(`bash: unalias: ${a}: not found\n`);
        return 1;
      }
    }
    return 0;
  },
};

function describe(ctx: CmdContext, name: string): { kind: 'alias' | 'builtin' | 'file' | 'none'; text: string; path?: string } {
  const m = M(ctx);
  if (m.aliases.has(name)) return { kind: 'alias', text: `${name} is aliased to \`${m.aliases.get(name)}'` };
  if (['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'in'].includes(name)) return { kind: 'builtin', text: `${name} is a shell keyword` };
  const r = m.resolveCommand(name, null, ctx.fs);
  if (r.kind === 'builtin') return { kind: 'builtin', text: `${name} is a shell builtin` };
  if (r.kind === 'program' || r.kind === 'script') return { kind: 'file', text: `${name} is ${r.path}`, path: r.path };
  return { kind: 'none', text: `bash: type: ${name}: not found` };
}

const type: ShellCommand = {
  name: 'type',
  builtin: true,
  summary: bi('узнать, чем является имя команды', 'tell what a command name is'),
  help: "type: type [-afptP] name [name ...]\n    Display information about command type.\n\n    For each NAME, indicate how it would be interpreted if used as a\n    command name: an alias, a shell keyword, a shell builtin or a file\n    found in PATH.\n\n    Options:\n      -t\toutput a single word which is one of `alias', `keyword',\n    \t\t`function', `builtin', `file' or `', if NAME is an alias,\n    \t\tshell reserved word, shell function, shell builtin, disk file,\n    \t\tor not found, respectively\n      -p\treturns either the name of the disk file that would be executed,\n    \t\tor nothing if `type -t NAME' would not return `file'\n\n    Exit Status:\n    Returns success if all of the NAMEs are found; fails if any are not found.",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const t = args.includes('-t');
    const p = args.includes('-p') || args.includes('-P');
    let exit = 0;
    for (const n of args.filter((x) => !x.startsWith('-'))) {
      const d = describe(ctx, n);
      if (d.kind === 'none') {
        if (!t && !p) ctx.err(d.text + '\n');
        exit = 1;
        continue;
      }
      if (t) ctx.out((d.text.includes('keyword') ? 'keyword' : d.kind) + '\n');
      else if (p) {
        if (d.path) ctx.out(d.path + '\n');
      } else ctx.out(d.text + '\n');
    }
    return exit;
  },
};

const which: ShellCommand = {
  ...cmdDoc({
    name: 'which',
    summary: bi('найти программу в каталогах PATH', 'locate a command in PATH'),
    whatis: 'locate a command',
    synopsis: ['which [-a] filename ...'],
    description: 'which returns the pathnames of the files (or links) which would be executed in the current environment, had its arguments been given as commands in a strictly POSIX-conformant shell. It does this by searching the PATH for executable files matching the names of the arguments. Built-in commands of the shell (cd, export) are not files, so which does not find them: use type.',
    options: [['-a', 'print all matching pathnames of each argument']],
    exit: '0  if all specified commands are found and executable\n1  if one or more specified commands is nonexistent or not executable',
    seeAlso: 'type (bash builtin), command (bash builtin)',
    url: 'https://manpages.debian.org/trixie/debianutils/which.debianutils.1.en.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const all = ctx.argv.includes('-a');
    let exit = 0;
    for (const n of ctx.argv.slice(1).filter((x) => !x.startsWith('-'))) {
      const hits: string[] = [];
      for (const dir of (ctx.env.PATH ?? '').split(':').filter(Boolean)) {
        const p = `${dir.replace(/\/$/, '')}/${n}`;
        try {
          if (ctx.fs.stat(p)?.type === 'f' && ctx.fs.access(p, 'x')) hits.push(p);
        } catch {
          /* unreadable directory */
        }
      }
      void m;
      if (!hits.length) exit = 1;
      for (const h of all ? hits : hits.slice(0, 1)) ctx.out(h + '\n');
    }
    return exit;
  },
};

const command: ShellCommand = {
  name: 'command',
  builtin: true,
  summary: bi('найти или запустить команду, минуя псевдонимы', 'find or run a command, skipping aliases'),
  help: 'command: command [-pVv] command [arg ...]\n    Execute a simple command or display information about commands.\n\n    Options:\n      -v    print a description of COMMAND similar to the `type\' builtin',
  async run(ctx) {
    const args = ctx.argv.slice(1);
    if (args[0] === '-v' || args[0] === '-V') {
      let exit = 0;
      for (const n of args.slice(1)) {
        const d = describe(ctx, n);
        if (d.kind === 'none') exit = 1;
        else ctx.out((args[0] === '-v' ? (d.path ?? n) : d.text) + '\n');
      }
      return exit;
    }
    const r = await ctx.shell.run(args.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' '), { stdin: ctx.stdin });
    ctx.out(r.out);
    ctx.err(r.err);
    return r.exit;
  },
};

const exec: ShellCommand = {
  name: 'exec',
  builtin: true,
  summary: bi('заменить оболочку командой', 'replace the shell with a command'),
  help: 'exec: exec [command [argument ...]]\n    Replace the shell with the given command.\n\n    Execute COMMAND, replacing this shell with the specified program.\n    The process keeps its PID: no new process is created, and when the\n    program exits, so does the shell (in a script: the script ends there).',
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    if (!args.length) return 0;
    const frame = (ctx as CmdContext & { frame?: { service?: { daemon?: string[] }; interactive?: boolean } }).frame;
    if (frame?.service) {
      const name = args[0].split('/').pop()!;
      if (PROGRAMS.get(name)?.daemon || PROGRAMS.get(name)?.background) {
        frame.service.daemon = args;
        return m.exitSignal(0);
      }
    }
    const r = await ctx.shell.run(args.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' '), { stdin: ctx.stdin });
    ctx.out(r.out);
    ctx.err(r.err);
    if (frame?.interactive && m.depth() === 0) ctx.err('\x1b[2m(exec replaced the login shell; the simulator starts a new one)\x1b[0m\n');
    return m.exitSignal(r.exit);
  },
};

const jobs: ShellCommand = {
  name: 'jobs',
  builtin: true,
  summary: bi('показать фоновые задания', 'list background jobs'),
  help: 'jobs: jobs [-lnprs] [jobspec ...]\n    Display status of jobs.\n\n    Lists the active jobs: started with & or stopped with Ctrl+Z.\n\n    Options:\n      -l\tlists process IDs in addition to the normal information',
  run(ctx) {
    const m = M(ctx);
    const l = ctx.argv.includes('-l') || ctx.argv.includes('-p');
    const live = m.jobs.filter((j) => j.state === 'Running' || j.state === 'Stopped');
    live.forEach((j, i) => {
      const mark = i === live.length - 1 ? '+' : i === live.length - 2 ? '-' : ' ';
      ctx.out(ctx.argv.includes('-p') ? `${j.pid}\n` : `[${j.n}]${mark}  ${l ? `${j.pid} ` : ''}${j.state.padEnd(24)}${j.line} &\n`);
    });
    return 0;
  },
};

function jobOf(m: SimMachine, spec: string | undefined) {
  const live = m.jobs.filter((j) => j.state === 'Running' || j.state === 'Stopped');
  if (!spec || spec === '%+' || spec === '%%' || spec === '%') return live[live.length - 1];
  const n = Number(spec.replace(/^%/, ''));
  return live.find((j) => j.n === n);
}

const fg: ShellCommand = {
  name: 'fg',
  builtin: true,
  summary: bi('вернуть задание на передний план', 'bring a job to the foreground'),
  help: 'fg: fg [job_spec]\n    Move job to the foreground.\n\n    Place the job identified by JOB_SPEC in the foreground, making it the\n    current job.  If JOB_SPEC is not present, the shell\'s notion of the\n    current job is used.',
  run(ctx) {
    const m = M(ctx);
    const j = jobOf(m, ctx.argv[1]);
    if (!j) {
      ctx.err(`bash: fg: ${ctx.argv[1] ?? 'current'}: no such job\n`);
      return 1;
    }
    ctx.out(`${j.line}\n`);
    const p = m.procs.get(j.pid) as KProc | undefined;
    if (!p) return 0;
    if (p.until !== undefined) {
      m.advance(Math.max(0, p.until - m.now()));
      j.notified = true;
      return 0;
    }
    ctx.out('^C\n');
    m.procs.kill(j.pid, 'INT');
    j.notified = true;
    return 130;
  },
};

const bg: ShellCommand = {
  name: 'bg',
  builtin: true,
  summary: bi('продолжить остановленное задание в фоне', 'resume a stopped job in the background'),
  help: 'bg: bg [job_spec ...]\n    Move jobs to the background.\n\n    Place the jobs identified by each JOB_SPEC in the background, as if they\n    had been started with `&\'.',
  run(ctx) {
    const m = M(ctx);
    const j = jobOf(m, ctx.argv[1]);
    if (!j) {
      ctx.err(`bash: bg: ${ctx.argv[1] ?? 'current'}: no such job\n`);
      return 1;
    }
    if (j.state === 'Running') {
      ctx.err(`bash: bg: job ${j.n} already in background\n`);
      return 0;
    }
    m.procs.kill(j.pid, 'CONT');
    j.state = 'Running';
    ctx.out(`[${j.n}]+ ${j.line} &\n`);
    return 0;
  },
};

const wait: ShellCommand = {
  name: 'wait',
  builtin: true,
  summary: bi('дождаться фоновых заданий', 'wait for background jobs'),
  help: 'wait: wait [-n] [id ...]\n    Wait for job completion and return exit status.',
  run(ctx) {
    const m = M(ctx);
    for (const j of m.jobs) {
      const p = m.procs.get(j.pid) as KProc | undefined;
      if (p?.until !== undefined) m.advance(Math.max(0, p.until - m.now()));
    }
    return 0;
  },
};

const sleep: ShellCommand = {
  ...cmdDoc({
    name: 'sleep',
    summary: bi('подождать заданное время', 'delay for a specified amount of time'),
    whatis: 'delay for a specified amount of time',
    synopsis: ['sleep NUMBER[SUFFIX]...'],
    description: "Pause for NUMBER seconds. SUFFIX may be 's' for seconds (the default), 'm' for minutes, 'h' for hours or 'd' for days. 'infinity' sleeps forever.\nOn this simulated machine the clock jumps forward instead of making you wait.",
    seeAlso: 'sleep(3)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    if (!args.length) return usageError(ctx, 'missing operand');
    let ms = 0;
    for (const a of args) {
      if (a === 'infinity') {
        ctx.err('\x1b[2m(sleep infinity would never return; run it with & to keep it in the background)\x1b[0m\n');
        return 130;
      }
      const mt = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(a);
      if (!mt) {
        ctx.err(`sleep: invalid time interval '${a}'\nTry 'sleep --help' for more information.\n`);
        return 1;
      }
      ms += Number(mt[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000, '': 1000 }[mt[2]] ?? 1000);
    }
    m.advance(ms);
    return 0;
  },
};

const env: ShellCommand = {
  ...cmdDoc({
    name: 'env',
    summary: bi('показать окружение или запустить с изменённым', 'print the environment or run a program in a modified one'),
    whatis: 'run a program in a modified environment',
    synopsis: ['env [OPTION]... [-] [NAME=VALUE]... [COMMAND [ARG]...]'],
    description: 'Set each NAME to VALUE in the environment and run COMMAND. Without COMMAND, print the resulting environment.\nThe environment holds only exported variables: a variable set without export is not in it.',
    options: [
      ['-i, --ignore-environment', 'start with an empty environment'],
      ['-u, --unset=NAME', 'remove variable from the environment'],
    ],
    seeAlso: 'environ(7), printenv(1)',
  }),
  async run(ctx) {
    const args = ctx.argv.slice(1);
    let e = { ...ctx.env };
    while (args.length) {
      if (args[0] === '-i' || args[0] === '-') {
        e = {};
        args.shift();
      } else if (args[0] === '-u') {
        args.shift();
        delete e[args.shift() ?? ''];
      } else if (/^[A-Za-z_]\w*=/.test(args[0])) {
        const a = args.shift()!;
        e[a.slice(0, a.indexOf('='))] = a.slice(a.indexOf('=') + 1);
      } else break;
    }
    if (!args.length) {
      for (const [k, v] of Object.entries(e)) ctx.out(`${k}=${v}\n`);
      return 0;
    }
    const m = M(ctx);
    return m.runArgv(ctx, args, { user: ctx.user, capEff: m.shellProc().capEff }, { env: e });
  },
};

const printenv: ShellCommand = {
  ...cmdDoc({
    name: 'printenv',
    summary: bi('напечатать переменные окружения', 'print environment variables'),
    whatis: 'print all or part of environment',
    synopsis: ['printenv [OPTION]... [VARIABLE]...'],
    description: 'Print the values of the specified environment VARIABLE(s). If no VARIABLE is specified, print name and value pairs for them all.',
    seeAlso: 'env(1), environ(7)',
  }),
  run(ctx) {
    const names = ctx.argv.slice(1);
    if (!names.length) {
      for (const [k, v] of Object.entries(ctx.env)) ctx.out(`${k}=${v}\n`);
      return 0;
    }
    let exit = 0;
    for (const n of names) {
      if (n in ctx.env) ctx.out(ctx.env[n] + '\n');
      else exit = 1;
    }
    return exit;
  },
};

const bash: ShellCommand = {
  name: 'bash',
  aliases: ['sh'],
  override: true,
  summary: bi('командная оболочка: скрипт, строка или вложенная оболочка', 'the shell: a script, a command string or a nested shell'),
  help: `GNU bash, version 5.2.37(1)-release-(x86_64-pc-linux-gnu)
Usage:	bash [GNU long option] [option] ...
	bash [GNU long option] [option] script-file ...
GNU long options:
	--login
	--norc
Shell options:
	-ilrsD or -c command or -O shopt_option		(invocation only)
	-abefhkmnptuvxBCEHPT or -o option
  -c string   read commands from string
  -e          exit immediately if a command exits with a non-zero status
  -n          read commands but do not execute them (check the syntax)
  -x          print commands and their arguments as they are executed

Type \`bash -c "help set"' for more information about shell options.
Without arguments bash starts a nested interactive shell; exit returns.`,
  man: {
    section: 1,
    url: 'https://man7.org/linux/man-pages/man1/bash.1.html',
    sections: [
      { id: 'NAME', body: 'bash - GNU Bourne-Again SHell' },
      { id: 'SYNOPSIS', body: 'bash [options] [command_string | file]' },
      {
        id: 'DESCRIPTION',
        body: 'Bash is a command language interpreter that executes commands read from the standard input, from a string, or from a file.\nAn interactive shell reads a line, splits it into words, expands variables, globs and substitutions, finds the command (an alias, a builtin, or a file in PATH), creates a process for it and waits for its exit status.',
      },
      { id: 'OPTIONS', body: '-c     If the -c option is present, then commands are read from the first non-option argument command_string.\n-e     Exit immediately if a pipeline returns a non-zero status (see set).\n-n     Read commands but do not execute them; check a script for syntax errors.\n-x     Print commands and their arguments as they are executed.' },
      {
        id: 'INVOCATION',
        body: 'When an interactive shell that is not a login shell is started, bash reads and executes commands from ~/.bashrc, if that file exists. A login shell reads /etc/profile and ~/.profile. Changes to ~/.bashrc therefore apply to new shells, or to the current one after source ~/.bashrc.',
      },
      { id: 'REDIRECTION', body: 'Before a command is executed, its input and output may be redirected. Redirections are processed in the order they appear, from left to right.\n> file     redirect standard output (fd 1) to file, truncating it\n>> file    append standard output to file\n< file     read standard input (fd 0) from file\n2> file    redirect standard error (fd 2)\n2>&1       make fd 2 a copy of fd 1 at that moment: cmd > out 2>&1 sends both to out, cmd 2>&1 > out sends only fd 1 there\n<<word     here-document: the lines up to a line containing only word become the standard input' },
      { id: 'PIPELINES', body: 'A pipeline is a sequence of one or more commands separated by |. The standard output of each command is connected via a pipe to the standard input of the next command. The return status of a pipeline is the exit status of the last command, unless the pipefail option is enabled.' },
      { id: 'EXIT STATUS', body: 'The exit status of an executed command is the value returned by the waitpid system call. 0 means success. When a command terminates on a fatal signal N, bash uses the value of 128+N as the exit status. If a command is not found, the child process created to execute it returns a status of 127. If a command is found but is not executable, the return status is 126.' },
      { id: 'SEE ALSO', body: 'sh(1), environ(7), signal(7)' },
    ],
  },
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let xtrace = false;
    let errexit = false;
    let check = false;
    while (args.length && /^-[exn]+$/.test(args[0])) {
      const f = args.shift()!;
      if (f.includes('x')) xtrace = true;
      if (f.includes('e')) errexit = true;
      if (f.includes('n')) check = true;
    }
    if (args[0] === '-c') {
      if (args[1] === undefined) {
        ctx.err('bash: -c: option requires an argument\n');
        return 2;
      }
      const prefix = [xtrace ? 'set -x' : '', errexit ? 'set -e' : ''].filter(Boolean).join('; ');
      const as = { user: ctx.user, capEff: ctx.user.uid === 0 ? capHex(CAP_FULL) : m.shellProc().capEff };
      return m.asChildShell(
        () => m.runLineAs(prefix ? `${prefix}\n${args[1]}` : args[1], as, { out: ctx.out, err: ctx.err, cwd: ctx.cwd, args: ['bash', ...args.slice(2)], stdin: ctx.stdin, ppid: (ctx as CmdContext & { pid?: number }).pid }),
        childEnv(ctx),
      );
    }
    if (!args.length) {
      if (!ctx.isatty) {
        const r = await ctx.shell.run(ctx.stdin);
        ctx.out(r.out);
        ctx.err(r.err);
        return r.exit;
      }
      m.pushShell({});
      return 0;
    }
    let text: string;
    try {
      text = ctx.fs.readFile(args[0]);
    } catch (e) {
      if (isFsError(e)) {
        ctx.err(`${ctx.argv[0]}: ${args[0]}: ${e.text}\n`);
        return 127;
      }
      throw e;
    }
    if (check) {
      const r = parseControl(text.startsWith('#!') ? text.slice(text.indexOf('\n') + 1) : text);
      if (!r.ok) {
        ctx.err(`${args[0]}: line ${text.split('\n').length}: ${r.error}\n`);
        return 2;
      }
      return 0;
    }
    const prefix = [xtrace ? 'set -x' : '', errexit ? 'set -e' : ''].filter(Boolean).join('\n');
    const body = text.startsWith('#!') ? text.slice(text.indexOf('\n') + 1) : text;
    return m.asChildShell(() => m.runScript(prefix ? `${prefix}\n${body}` : body, [args[0], ...args.slice(1)], { writeOut: ctx.out, writeErr: ctx.err, cwd: ctx.cwd, as: { user: ctx.user, capEff: ctx.user.uid === 0 ? capHex(CAP_FULL) : m.shellProc().capEff }, ppid: (ctx as CmdContext & { pid?: number }).pid }), childEnv(ctx));
  },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function strftime(fmt: string, ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return fmt.replace(/%([YmdHMSFTaAbBejsZz%])/g, (_m, c: string) =>
    ({
      Y: String(d.getUTCFullYear()),
      m: p(d.getUTCMonth() + 1),
      d: p(d.getUTCDate()),
      e: String(d.getUTCDate()).padStart(2),
      H: p(d.getUTCHours()),
      M: p(d.getUTCMinutes()),
      S: p(d.getUTCSeconds()),
      F: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
      T: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
      a: DAYS[d.getUTCDay()],
      A: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()],
      b: MONTHS[d.getUTCMonth()],
      B: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()],
      j: p(Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1, 3),
      s: String(Math.floor(ms / 1000)),
      Z: 'UTC',
      z: '+0000',
      '%': '%',
    })[c] ?? c,
  );
}

const date: ShellCommand = {
  ...cmdDoc({
    name: 'date',
    summary: bi('показать дату и время', 'print the date and time'),
    whatis: 'print or set the system date and time',
    synopsis: ['date [OPTION]... [+FORMAT]'],
    description: 'Display the current time in the given FORMAT.\nFORMAT controls the output: %Y year, %m month, %d day, %H hour, %M minute, %S second, %F the same as %Y-%m-%d, %T the same as %H:%M:%S, %s seconds since 1970-01-01 00:00:00 UTC.',
    options: [['-u, --utc, --universal', 'print or set Coordinated Universal Time (UTC)'], ['-I[FMT], --iso-8601[=FMT]', "output date/time in ISO 8601 format"]],
    examples: [['date +%F', 'Today as 2026-11-18, handy for file names: backup-$(date +%F).tar.gz']],
    seeAlso: 'strftime(3)',
  }),
  run(ctx) {
    const m = M(ctx);
    const f = ctx.argv.slice(1).find((x) => x.startsWith('+'));
    if (ctx.argv.includes('-I') || ctx.argv.includes('--iso-8601')) {
      ctx.out(strftime('%F', m.now()) + '\n');
      return 0;
    }
    ctx.out(strftime(f ? f.slice(1) : '%a %b %e %T %Z %Y', m.now()) + '\n');
    return 0;
  },
};

export const SHELL_COMMANDS: ShellCommand[] = [set, shift, source, read, test, alias, unalias, type, which, command, exec, jobs, fg, bg, wait, sleep, env, printenv, bash, date];
