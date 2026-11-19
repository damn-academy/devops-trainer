// Shell built-ins: they change the shell itself, so they cannot be programs.

import { bi } from '../../../core/i18n';
import type { ShellCommand } from '../../../core/types';
import type { SimMachine } from '../shell';
import { isFsError } from '../vfs';

const cd: ShellCommand = {
  name: 'cd',
  builtin: true,
  summary: bi('сменить текущий каталог', 'change the current directory'),
  help: `cd: cd [dir]
    Change the shell working directory.

    Change the current directory to DIR.  The default DIR is the value of the
    HOME shell variable.  If DIR is "-", it is converted to $OLDPWD.

    Exit Status:
    Returns 0 if the directory is changed; non-zero otherwise.`,
  man: {
    section: '1p',
    url: 'https://man7.org/linux/man-pages/man1/cd.1p.html',
    sections: [
      { id: 'NAME', body: 'cd — change the working directory' },
      { id: 'SYNOPSIS', body: 'cd [directory]\ncd -' },
      {
        id: 'DESCRIPTION',
        body: 'The cd utility changes the working directory of the current shell. It is a shell built-in: a separate program could not change the directory of the shell that started it.\nWithout an operand, cd goes to the directory named by the HOME variable.\nWith the operand -, cd goes to the previous directory ($OLDPWD) and prints its name.',
      },
      { id: 'EXIT STATUS', body: '0  The directory was changed.\n>0 An error occurred.' },
      { id: 'SEE ALSO', body: 'pwd(1)' },
    ],
  },
  run(ctx) {
    let target = ctx.argv[1];
    if (ctx.argv.length > 2) {
      ctx.err('bash: cd: too many arguments\n');
      return 1;
    }
    if (target === undefined || target === '~') target = ctx.env.HOME ?? ctx.user.home;
    else if (target === '-') {
      target = ctx.machine.vars.OLDPWD;
      if (!target) {
        ctx.err('bash: cd: OLDPWD not set\n');
        return 1;
      }
      ctx.out(target + '\n');
    }
    try {
      const st = ctx.fs.stat(target);
      if (!st) {
        ctx.err(`bash: cd: ${ctx.argv[1] ?? target}: No such file or directory\n`);
        return 1;
      }
      if (st.type !== 'd') {
        ctx.err(`bash: cd: ${ctx.argv[1]}: Not a directory\n`);
        return 1;
      }
      if (!ctx.fs.access(target, 'x')) {
        ctx.err(`bash: cd: ${ctx.argv[1]}: Permission denied\n`);
        return 1;
      }
    } catch (e) {
      if (isFsError(e)) {
        ctx.err(`bash: cd: ${ctx.argv[1]}: ${e.text}\n`);
        return 1;
      }
      throw e;
    }
    ctx.shell.chdir(target);
    return 0;
  },
};

const exportCmd: ShellCommand = {
  name: 'export',
  builtin: true,
  summary: bi('передать переменную запускаемым программам', 'pass a variable to the programs you start'),
  help: `export: export [name[=value] ...]
    Set export attribute for shell variables.

    Marks each NAME for automatic export to the environment of subsequently
    executed commands.  If VALUE is supplied, assign VALUE before exporting.`,
  run(ctx) {
    const args = ctx.argv.slice(1).filter((a) => a !== '-n');
    if (!args.length) {
      for (const [k, v] of Object.entries(ctx.env).sort()) ctx.out(`declare -x ${k}="${v}"\n`);
      return 0;
    }
    for (const a of args) {
      const eq = a.indexOf('=');
      const name = eq >= 0 ? a.slice(0, eq) : a;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        ctx.err(`bash: export: \`${a}': not a valid identifier\n`);
        return 1;
      }
      ctx.shell.setVar(name, eq >= 0 ? a.slice(eq + 1) : (ctx.machine.vars[name] ?? ''), true);
    }
    return 0;
  },
};

const unset: ShellCommand = {
  name: 'unset',
  builtin: true,
  summary: bi('удалить переменную', 'remove a variable'),
  help: `unset: unset [name ...]
    Unset values and attributes of shell variables.`,
  run(ctx) {
    for (const n of ctx.argv.slice(1)) ctx.shell.setVar(n, undefined);
    return 0;
  },
};

const trueCmd: ShellCommand = {
  name: 'true',
  builtin: true,
  summary: bi('ничего не делать, успешно', 'do nothing, successfully'),
  help: 'Usage: true [ignored command line arguments]\nExit with a status code indicating success.',
  run: () => 0,
};

const falseCmd: ShellCommand = {
  name: 'false',
  builtin: true,
  summary: bi('ничего не делать, неуспешно', 'do nothing, unsuccessfully'),
  help: 'Usage: false [ignored command line arguments]\nExit with a status code indicating failure.',
  run: () => 1,
};

const exit: ShellCommand = {
  name: 'exit',
  builtin: true,
  summary: bi('завершить оболочку или скрипт', 'leave the shell or a script'),
  help: `exit: exit [n]
    Exit the shell.

    Exits the shell with a status of N.  If N is omitted, the exit status
    is that of the last command executed.`,
  run(ctx) {
    const n = ctx.argv[1] !== undefined ? Number(ctx.argv[1]) & 255 : Number(ctx.machine.vars['?'] ?? 0);
    return (ctx.machine as unknown as SimMachine).exitSignal(Number.isFinite(n) ? n : 2);
  },
};

const history: ShellCommand = {
  name: 'history',
  builtin: true,
  summary: bi('показать введённые команды', 'show the commands you typed'),
  help: `history: history [n]
    Display the history list with line numbers.`,
  run(ctx) {
    const list = ctx.shell.history();
    const n = ctx.argv[1] ? Number(ctx.argv[1]) : list.length;
    const start = Math.max(0, list.length - n);
    list.slice(start).forEach((l, i) => ctx.out(`${String(start + i + 1).padStart(5)}  ${l}\n`));
    return 0;
  },
};

const sh: ShellCommand = {
  name: 'bash',
  aliases: ['sh'],
  summary: bi('запустить скрипт или строку команд', 'run a script or a command string'),
  help: `Usage: bash [option] [script-file] [arguments ...]
  -c string   read commands from string

A simulated bash: runs a script file line by line, with $1…$9, $# and $@.`,
  async run(ctx) {
    const args = ctx.argv.slice(1);
    if (args[0] === '-c') {
      if (args[1] === undefined) {
        ctx.err('bash: -c: option requires an argument\n');
        return 2;
      }
      const r = await ctx.shell.run(args[1], { args: ['bash', ...args.slice(2)], stdin: ctx.stdin });
      ctx.out(r.out);
      ctx.err(r.err);
      return r.exit;
    }
    if (!args.length) {
      ctx.err('bash: an interactive sub-shell is not available in the simulator; use bash -c or a script file\n');
      return 1;
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
    const m = ctx.machine as unknown as SimMachine;
    return m.runScript(text, [args[0], ...args.slice(1)], { writeOut: ctx.out, writeErr: ctx.err, cwd: ctx.cwd });
  },
};

export const BUILTINS: ShellCommand[] = [cd, exportCmd, unset, trueCmd, falseCmd, exit, history, sh];
