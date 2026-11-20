import { netOf } from '../../sim-net/state';
import { nginxCommand } from '../../sim-net/cmd-tools';
// systemctl, journalctl, systemd-run, systemd-cgls, systemd-analyze on top of
// the systemd model (systemd.ts). Messages follow systemd 257 (Debian 13).

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import type { KProc } from '../kernel';
import type { SimMachine } from '../shell';
import { Systemd, fmtEntry, memBytes, shortTime } from '../systemd';
import { ROOT_CRED } from '../vfs';
import { cmdDoc, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;
const N = Systemd.normalize;

const denied = (ctx: CmdContext, verb: string, unit: string) => {
  ctx.err(`Failed to ${verb} ${unit}: Access denied\nSee system logs and 'systemctl status ${unit}' for details.\n`);
  return 1;
};

const systemctl: ShellCommand = {
  ...cmdDoc({
    name: 'systemctl',
    summary: bi('управлять службами systemd', 'control systemd services'),
    whatis: 'Control the systemd system and service manager',
    synopsis: ['systemctl [OPTIONS...] COMMAND [UNIT...]'],
    description:
      'systemctl may be used to introspect and control the state of the "systemd" system and service manager.\nstart runs a unit now; enable makes it start at boot (it creates a symbolic link in a .wants/ directory) and does not start it now unless --now is given. After you change a unit file, run daemon-reload: systemd keeps the loaded version in memory until then.',
    options: [
      ['--now', 'When used with enable, the units will also be started. When used with disable or mask, the units will also be stopped.'],
      ['-p, --property=NAME', 'When showing unit properties with show, limit display to properties specified in the argument.'],
      ['--value', 'When printing properties with show, only print the value, and skip the property name and "=".'],
      ['--failed', 'List units in failed state (list-units).'],
      ['--type=TYPE', 'The argument is a comma-separated list of unit types such as service and socket.'],
      ['--no-pager', 'Do not pipe output into a pager.'],
      ['--stdin', 'With edit, read the new contents of the drop-in from standard input.'],
    ],
    extra: [
      {
        id: 'COMMANDS',
        body: 'start UNIT...\n       Start (activate) one or more units specified on the command line.\nstop UNIT...\n       Stop (deactivate) one or more units.\nrestart UNIT...\n       Stop and then start one or more units.\nreload UNIT...\n       Asks all units listed on the command line to reload their configuration.\nstatus [UNIT...]\n       Show runtime status information about one or more units, followed by the most recent log data from the journal.\nshow [UNIT...]\n       Show properties of one or more units.\ncat UNIT...\n       Show backing files of one or more units: the fragment and the drop-ins.\nenable UNIT..., disable UNIT...\n       Enable or disable one or more units: create or remove the symlinks in .wants/ directories.\nis-active UNIT..., is-enabled UNIT..., is-failed UNIT...\n       Check whether units are active, enabled, failed; print the state, exit 0 if it matches.\nlist-units [--failed] [--type=service]\n       List units that systemd currently has in memory.\nlist-unit-files\n       List unit files installed on the system, in combination with their enablement state.\nreset-failed [UNIT...]\n       Reset the "failed" state and the start rate counter of the specified units.\nedit UNIT\n       Edit a drop-in snippet (override.conf) for the unit; with --stdin the contents come from standard input.\ndaemon-reload\n       Reload the systemd manager configuration: rerun generators, reload all unit files.\nreboot\n       Shut down and reboot the system.',
      },
    ],
    exit: 'On success, 0 is returned, a non-zero failure code otherwise. systemctl status uses 0 for an active unit, 3 for an inactive or failed one and 4 for no such unit.',
    seeAlso: 'systemd(1), journalctl(1), systemd.unit(5), systemd.service(5), systemd.exec(5), systemd.resource-control(5)',
    url: 'https://man7.org/linux/man-pages/man1/systemctl.1.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const sd = m.systemd;
    const args = ctx.argv.slice(1);
    const opts = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
    const kv = Object.fromEntries(args.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]));
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-p' || args[i] === '--property') kv.property = (kv.property ? kv.property + ',' : '') + args[++i];
      else if (args[i] === '-t' || args[i] === '--type') kv.type = args[++i];
      else if (args[i] === '-n' || args[i] === '--lines') kv.lines = args[++i];
      else if (/^-[lqa]+$/.test(args[i])) continue;
      else if (!args[i].startsWith('--')) rest.push(args[i]);
    }
    const [cmd = 'list-units', ...units] = rest;
    const root = ctx.user.uid === 0;
    const names = units.map(N);
    if (cmd === 'reload' && names.length === 1 && names[0] === 'nginx.service' && netOf(m).local.services.some(s => s.kind === 'nginx')) {
      return nginxCommand.run({ ...ctx, argv: ['nginx', '-s', 'reload'] });
    }
    await sd.settle();
    switch (cmd) {
      case 'start':
      case 'restart':
      case 'try-restart': {
        if (!names.length) return usageError(ctx, `Too few arguments.`);
        if (!root) return denied(ctx, cmd, names[0]);
        let exit = 0;
        for (const n of names) {
          const r = cmd === 'start' ? await sd.start(n) : await sd.restart(n);
          for (const l of r.lines) ctx.err(l + '\n');
          if (!r.ok) exit = r.lines.some((l) => l.includes('not found')) ? 5 : 1;
        }
        return exit;
      }
      case 'stop': {
        if (!root) return denied(ctx, 'stop', names[0] ?? '');
        for (const n of names) {
          const r = sd.stop(n);
          for (const l of r.lines) ctx.err(l + '\n');
          if (!r.ok) return 5;
        }
        return 0;
      }
      case 'reload': {
        if (!root) return denied(ctx, 'reload', names[0] ?? '');
        for (const n of names) {
          const s = sd.units.get(n);
          if (!s || s.active !== 'active') {
            ctx.err(`Failed to reload ${n}: Unit ${n} is not active.\n`);
            return 1;
          }
          const c = sd.config(n);
          if (!c?.props.ExecReload && n !== 'nginx.service') {
            ctx.err(`Failed to reload ${n}: Job type reload is not applicable for unit ${n}.\n`);
            return 1;
          }
          m.procs.kill(s.mainPid, 'HUP');
          sd.log('systemd', 1, `Reloading ${n} - ${c?.description ?? ''}...`, { unit: n });
          sd.log('systemd', 1, `Reloaded ${n} - ${c?.description ?? ''}.`, { unit: n });
        }
        return 0;
      }
      case 'enable':
      case 'disable': {
        if (!names.length) return usageError(ctx, 'Too few arguments.');
        if (!root) {
          ctx.err(`Failed to ${cmd} unit: Access denied\n`);
          return 1;
        }
        for (const n of names) {
          if (cmd === 'enable') {
            const r = sd.enable(n);
            for (const l of r.lines) ctx.err(l + '\n');
            if (!r.ok) return 1;
            if (opts.has('--now')) {
              const s = await sd.start(n);
              for (const l of s.lines) ctx.err(l + '\n');
            }
          } else {
            for (const l of sd.disable(n)) ctx.err(l + '\n');
            if (opts.has('--now')) sd.stop(n);
          }
        }
        return 0;
      }
      case 'status': {
        if (!names.length) {
          const failed = [...sd.units.values()].filter((u) => u.active === 'failed').length;
          ctx.out(`● ${m.hostname}\n    State: ${failed ? '\x1b[31mdegraded\x1b[0m' : 'running'}\n    Units: ${sd.units.size} loaded (incl. loaded aliases)\n     Jobs: 0 queued\n   Failed: ${failed} units\n    Since: ${shortTime(m.bootAt)}\n  systemd: 257.8-1~deb13u2\n   CGroup: /\n`);
          return 0;
        }
        let code = 0;
        for (const n of names) {
          const r = sd.status(n, Number(kv.lines ?? 10));
          if (r.code === 4) ctx.err(r.text);
          else ctx.out(r.text);
          code = Math.max(code, r.code);
        }
        return code;
      }
      case 'is-active':
      case 'is-failed': {
        let code = cmd === 'is-active' ? 3 : 1;
        for (const n of names) {
          const s = sd.units.get(n);
          const st = s?.active ?? 'inactive';
          ctx.out(st + '\n');
          if ((cmd === 'is-active' && st === 'active') || (cmd === 'is-failed' && st === 'failed')) code = 0;
        }
        return code;
      }
      case 'is-enabled': {
        let code = 1;
        for (const n of names) {
          const st = sd.enabledState(n);
          if (st === 'not-found') {
            ctx.err(`Failed to get unit file state for ${n}: No such file or directory\n`);
            return 4;
          }
          ctx.out(st + '\n');
          if (st === 'enabled' || st === 'static') code = 0;
        }
        return code;
      }
      case 'show': {
        const props = kv.property?.split(',');
        for (const n of names) {
          const all = sd.show(n);
          const pick = props ? props.map((p) => [p, all[p] ?? ''] as const) : Object.entries(all);
          for (const [k, v] of pick) ctx.out(opts.has('--value') ? `${v}\n` : `${k}=${v}\n`);
        }
        return 0;
      }
      case 'cat': {
        let exit = 0;
        for (const n of names) {
          const c = sd.readConfig(n);
          if (!c) {
            ctx.err(`No files found for ${n}.\n`);
            exit = 1;
            continue;
          }
          ctx.out(`# ${c.path}\n${m.vfs.readFileAs(c.path, ROOT_CRED)}`);
          for (const d of c.dropIns) ctx.out(`\n# ${d}\n${m.vfs.readFileAs(d, ROOT_CRED)}`);
        }
        return exit;
      }
      case 'edit': {
        const n = names[0];
        if (!n) return usageError(ctx, 'Too few arguments.');
        if (!root) return denied(ctx, 'edit', n);
        if (!opts.has('--stdin')) {
          ctx.err(`This terminal has no editor. Pass the drop-in on standard input:\n  printf '[Service]\\nRestart=always\\n' | sudo systemctl edit --stdin ${n}\nor write /etc/systemd/system/${n}.d/override.conf yourself and run systemctl daemon-reload.\n`);
          return 1;
        }
        if (!sd.readConfig(n)) {
          ctx.err(`Failed to edit unit: Unit ${n} not found.\n`);
          return 1;
        }
        const dir = `/etc/systemd/system/${n}.d`;
        if (!m.vfs.statAs(dir, ROOT_CRED)) m.vfs.mkdirAs(dir, ROOT_CRED, { parents: true });
        m.vfs.writeFileAs(`${dir}/override.conf`, ctx.stdin, ROOT_CRED);
        sd.daemonReload();
        return 0;
      }
      case 'daemon-reload': {
        if (!root) {
          ctx.err('Failed to reload daemon: Access denied\n');
          return 1;
        }
        sd.daemonReload();
        return 0;
      }
      case 'reset-failed':
        sd.resetFailed(names[0]);
        return 0;
      case 'kill': {
        if (!root) return denied(ctx, 'kill', names[0] ?? '');
        const sig = (kv.signal ?? 'TERM').replace(/^SIG/, '');
        for (const n of names) {
          const s = sd.units.get(n);
          if (s?.mainPid) m.procs.kill(s.mainPid, sig);
        }
        return 0;
      }
      case 'reboot': {
        if (!root) {
          ctx.err('Call to Reboot failed: Access denied\n');
          return 1;
        }
        await sd.reboot();
        ctx.out(`\x1b[2m[ the machine rebooted: ${m.hostname} login: learner (automatic login) ]\x1b[0m\n`);
        return 0;
      }
      case 'list-units': {
        const failedOnly = opts.has('--failed') || kv.state === 'failed';
        let list = [...sd.units.values()].filter((u) => u.config || u.active !== 'inactive');
        if (failedOnly) list = list.filter((u) => u.active === 'failed');
        else if (!opts.has('--all')) list = list.filter((u) => u.active !== 'inactive');
        ctx.out('  UNIT                         LOAD   ACTIVE   SUB     DESCRIPTION\n');
        for (const u of list.sort((a, b) => a.name.localeCompare(b.name))) ctx.out(`${u.active === 'failed' ? '\x1b[31m●\x1b[0m' : ' '} ${u.name.padEnd(28)} loaded ${u.active.padEnd(8)} ${u.sub.padEnd(7)} ${u.config?.description ?? ''}\n`);
        ctx.out(`\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n        SUB    → The low-level unit activation state, values depend on unit type.\n\n${list.length} loaded units listed.\n`);
        return 0;
      }
      case 'list-unit-files': {
        const files = new Set<string>();
        for (const d of ['/etc/systemd/system', '/usr/lib/systemd/system']) {
          try {
            for (const f of m.vfs.readdirAs(d, ROOT_CRED)) if (/\.(service|timer|target)$/.test(f)) files.add(f);
          } catch {
            /* none */
          }
        }
        ctx.out('UNIT FILE                    STATE    PRESET\n');
        for (const f of [...files].sort()) ctx.out(`${f.padEnd(28)} ${sd.enabledState(f).padEnd(8)} enabled\n`);
        ctx.out(`\n${files.size} unit files listed.\n`);
        return 0;
      }
      case 'list-timers':
        ctx.out('NEXT                        LEFT LAST                        PASSED UNIT                         ACTIVATES\n' + `${new Date(m.now() + 3_600_000).toUTCString().slice(0, 25)} 59min -                             -      apt-daily.timer              apt-daily.service\n\n1 timers listed.\n`);
        return 0;
      default:
        ctx.err(`Unknown command verb '${cmd}'.\n`);
        return 1;
    }
  },
  complete: () => ['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable', 'is-active', 'is-enabled', 'show', 'cat', 'edit', 'daemon-reload', 'list-units', 'list-unit-files', 'reset-failed'],
};

const journalctl: ShellCommand = {
  ...cmdDoc({
    name: 'journalctl',
    summary: bi('читать журнал systemd', 'print the systemd journal'),
    whatis: 'Print log entries from the systemd journal',
    synopsis: ['journalctl [OPTIONS...] [MATCHES...]'],
    description:
      'journalctl is used to print the log entries stored in the journal by the systemd journal service. Everything a service writes to its standard output and standard error goes there: you do not have to configure anything (StandardOutput=journal is the default, systemd.exec(5)).\nUsers in the groups adm or systemd-journal see the whole journal; others see only their own entries.',
    options: [
      ['-u, --unit=UNIT|PATTERN', 'Show messages for the specified systemd unit UNIT.'],
      ['-n, --lines=', 'Show the most recent journal events and limit the number of events shown.'],
      ['-f, --follow', 'Show only the most recent journal entries, and continuously print new entries as they are appended to the journal.'],
      ['-b [ID], --boot[=ID]', 'Show messages from a specific boot; without an argument, the current boot.'],
      ['-k, --dmesg', 'Show only kernel messages.'],
      ['-p, --priority=', 'Filter output by message priorities: "emerg" (0), "alert" (1), "crit" (2), "err" (3), "warning" (4), "notice" (5), "info" (6), "debug" (7). A single priority shows that and everything more important.'],
      ['-e, --pager-end', 'Immediately jump to the end of the journal.'],
      ['-x, --catalog', 'Augment log lines with explanation texts from the message catalog.'],
      ['-o, --output=', 'Controls the formatting of the journal entries: short (default), cat (only the message), short-iso.'],
      ['--since=, --until=', 'Start showing entries on or newer than the specified date: "today", "-10min", "1 hour ago".'],
      ['--no-pager', 'Do not pipe output into a pager.'],
    ],
    examples: [
      ['journalctl -u nginx -n 20', 'The last twenty lines of nginx.'],
      ['journalctl -u app --since "10 min ago" -p err', 'Errors of app in the last ten minutes.'],
      ['journalctl -k -b', 'Kernel messages of this boot.'],
    ],
    seeAlso: 'systemd-journald.service(8), systemctl(1), journald.conf(5)',
    url: 'https://man7.org/linux/man-pages/man1/journalctl.1.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const sd = m.systemd;
    await sd.settle();
    const args = ctx.argv.slice(1);
    const units: string[] = [];
    let n: number | undefined;
    let follow = false;
    let kernel = false;
    let prio: number | undefined;
    let output = 'short';
    let since: number | undefined;
    let boot: number | undefined;
    const prios: Record<string, number> = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };
    const timeArg = (v: string): number | undefined => {
      if (v === 'today') return Date.UTC(new Date(m.now()).getUTCFullYear(), new Date(m.now()).getUTCMonth(), new Date(m.now()).getUTCDate());
      const r = /^-?(\d+)\s*(s|sec|min|m|h|hour|hours)\b(?:\s+ago)?/.exec(v);
      if (r) return m.now() - Number(r[1]) * ({ s: 1000, sec: 1000, min: 60000, m: 60000, h: 3600000, hour: 3600000, hours: 3600000 }[r[2]] ?? 60000);
      return undefined;
    };
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      const val = () => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i]);
      if (a === '-u' || a.startsWith('--unit')) units.push(N(val() ?? ''));
      else if (/^-u.+/.test(a)) units.push(N(a.slice(2)));
      else if (a === '-n' || a.startsWith('--lines')) n = Number(val());
      else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
      else if (a === '-f' || a === '--follow') follow = true;
      else if (a === '-k' || a === '--dmesg') kernel = true;
      else if (a === '-p' || a.startsWith('--priority')) {
        const v = val() ?? '';
        prio = prios[v] ?? Number(v);
      } else if (a === '-o' || a.startsWith('--output')) output = val() ?? 'short';
      else if (a.startsWith('--since') || a === '-S') since = timeArg(val() ?? '');
      else if (a === '-b' || a === '--boot') {
        boot = sd.bootId;
        if (args[i + 1] && /^-?\d+$/.test(args[i + 1])) boot = sd.bootId + Number(args[++i]);
      } else if (/^-[xefaqrl]+$/.test(a) || a === '--no-pager' || a === '--catalog' || a === '--pager-end' || a === '--no-hostname') {
        if (a.includes('f')) follow = follow || /^-[a-z]*f/.test(a);
      } else if (a.startsWith('_') || a.startsWith('SYSLOG_IDENTIFIER=')) continue;
      else {
        ctx.err(`journalctl: unrecognized option '${a}'\n`);
        return 1;
      }
    }
    const privileged = ctx.user.uid === 0 || ctx.user.groups.some((g) => m.groups.find((x) => x.gid === g && (x.name === 'adm' || x.name === 'systemd-journal')));
    let list = sd.journal;
    if (!privileged) {
      ctx.err("Hint: You are currently not seeing messages from other users and the system.\n      Users in groups 'adm', 'systemd-journal' can see all messages.\n      Pass -q to turn off this notice.\n");
      list = [];
    }
    if (kernel) list = list.filter((e) => e.kernel);
    if (units.length) list = list.filter((e) => e.unit && units.includes(e.unit));
    if (prio !== undefined) list = list.filter((e) => e.prio <= prio!);
    if (since !== undefined) list = list.filter((e) => e.at >= since!);
    if (boot !== undefined) list = list.filter((e) => e.boot === boot);
    if (kernel) {
      const k = m.kernel.dmesg.map((d) => ({ at: d.at, ident: 'kernel', pid: 0, msg: d.msg, prio: 6, boot: sd.bootId, kernel: true }));
      list = [...list.filter((e) => !e.kernel), ...k].sort((a, b) => a.at - b.at);
    }
    if (follow && n === undefined) n = 10;
    if (n !== undefined) list = list.slice(-n);
    if (!list.length) {
      ctx.out('-- No entries --\n');
      return 0;
    }
    let lastBoot = list[0].boot;
    for (const e of list) {
      if (e.boot !== lastBoot) {
        ctx.out(`-- Boot ${e.boot.toString(16).padStart(32, 'a')} --\n`);
        lastBoot = e.boot;
      }
      const line = output === 'cat' ? e.msg : output === 'short-iso' ? `${new Date(e.at).toISOString().slice(0, 19)}+0000 ${m.hostname} ${e.ident}[${e.pid}]: ${e.msg}` : fmtEntry(e, m.hostname);
      ctx.out((ctx.isatty && e.prio <= 3 ? `\x1b[1;31m${line}\x1b[0m` : ctx.isatty && e.prio === 4 ? `\x1b[1;33m${line}\x1b[0m` : line) + '\n');
    }
    if (follow) ctx.err('\x1b[2m(journalctl -f keeps printing new entries on a real machine; here run it again to see new ones)\x1b[0m\n');
    return 0;
  },
};

const systemdRun: ShellCommand = {
  ...cmdDoc({
    name: 'systemd-run',
    summary: bi('запустить команду в отдельной группе с лимитами', 'run a command in its own unit with limits'),
    whatis: 'Run programs in transient scope units, service units, or path-, socket-, or timer-triggered service units',
    synopsis: ['systemd-run [OPTIONS...] COMMAND [ARGS...]'],
    description: 'systemd-run may be used to create and start a transient .service or .scope unit and run the specified COMMAND in it. With --scope the command runs in the foreground of your shell, but in a new cgroup: properties set with -p become its limits (MemoryMax=, CPUQuota=, TasksMax=; systemd.resource-control(5)).',
    options: [
      ['--scope', 'Create a transient .scope unit instead of the default transient .service unit.'],
      ['-p, --property=NAME=VALUE', 'Sets a property on the scope or service unit that is created.'],
      ['--unit=, -u', 'Use this unit name instead of an automatically generated one.'],
      ['--wait', 'Synchronously wait for the transient service to terminate.'],
    ],
    seeAlso: 'systemctl(1), systemd.resource-control(5)',
    url: 'https://man7.org/linux/man-pages/man1/systemd-run.1.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const props: Record<string, string> = {};
    let unit: string | undefined;
    let scope = false;
    while (args.length && args[0].startsWith('-')) {
      const a = args.shift()!;
      if (a === '-p' || a === '--property') {
        const [k, ...v] = (args.shift() ?? '').split('=');
        props[k] = v.join('=');
      } else if (a.startsWith('--property=')) {
        const [k, ...v] = a.slice(11).split('=');
        props[k] = v.join('=');
      } else if (a === '--scope') scope = true;
      else if (a === '-u' || a === '--unit') unit = args.shift();
      else if (a.startsWith('--unit=')) unit = a.slice(7);
    }
    if (!args.length) return usageError(ctx, 'Command line to execute required.');
    if (ctx.user.uid !== 0) {
      ctx.err('Failed to start transient scope unit: Access denied\n');
      return 1;
    }
    const name = `${unit ?? `run-r${Math.floor(m.now() % 1e8).toString(16)}`}.${scope ? 'scope' : 'service'}`;
    const cg = `/system.slice/${name}`;
    m.kernel.mkCgroup(`/sys/fs/cgroup${cg}`);
    const w = (f: string, v: string) => m.vfs.writeFileAs(`/sys/fs/cgroup${cg}/${f}`, v, ROOT_CRED, { append: true });
    if (props.MemoryMax) w('memory.max', String(memBytes(props.MemoryMax)));
    if (props.MemoryHigh) w('memory.high', String(memBytes(props.MemoryHigh)));
    if (props.TasksMax) w('pids.max', props.TasksMax);
    if (props.CPUQuota) w('cpu.max', `${Math.round(parseFloat(props.CPUQuota) * 1000)} 100000`);
    ctx.err(`Running ${scope ? 'scope' : 'as unit'}: ${name}\n`);
    const pid = (ctx as CmdContext & { pid: number }).pid;
    const me = m.procs.get(pid) as KProc | undefined;
    if (me) me.cgroup = cg;
    m.systemd.log('systemd', 1, `Started ${name} - /usr/bin/${args[0]}.`, { unit: name });
    const code = await m.runArgv(ctx, args, { user: ctx.user, capEff: me?.capEff ?? m.shellProc().capEff }, { ppid: pid });
    return code;
  },
};

const systemdCgls: ShellCommand = {
  ...cmdDoc({
    name: 'systemd-cgls',
    summary: bi('показать дерево cgroup с процессами', 'show the cgroup tree with processes'),
    whatis: 'Recursively show control group contents',
    synopsis: ['systemd-cgls [OPTIONS...] [CGROUP...]'],
    description: 'systemd-cgls recursively shows the contents of the selected Linux control group hierarchy in a tree: the slices, the services and scopes inside them, and their processes.',
    seeAlso: 'systemctl(1), systemd-cgtop(1), cgroups(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const paths = m.kernel.cgroupPaths().filter((p) => p !== '/');
    const out: string[] = ['Control group /:'];
    const kids = (parent: string) => paths.filter((p) => p.slice(0, p.lastIndexOf('/')) === (parent === '/' ? '' : parent));
    const walk = (cg: string, prefix: string) => {
      const children = kids(cg);
      const procs = m.kernel.procsIn(cg, false);
      const items: ({ kind: 'cg'; path: string } | { kind: 'p'; p: KProc })[] = [...procs.map((p) => ({ kind: 'p' as const, p })), ...children.map((c) => ({ kind: 'cg' as const, path: c }))];
      items.forEach((it, i) => {
        const last = i === items.length - 1;
        if (it.kind === 'p') out.push(`${prefix}${last ? '└─' : '├─'}${it.p.pid} ${it.p.argv.join(' ')}`);
        else {
          out.push(`${prefix}${last ? '└─' : '├─'}${it.path.split('/').pop()}`);
          walk(it.path, prefix + (last ? '  ' : '│ '));
        }
      });
    };
    walk('/', '');
    ctx.out(out.join('\n') + '\n');
    return 0;
  },
};

const systemdAnalyze: ShellCommand = {
  ...cmdDoc({
    name: 'systemd-analyze',
    summary: bi('время загрузки и разбор настроек systemd', 'analyze boot time and systemd settings'),
    whatis: 'Analyze and debug system manager',
    synopsis: ['systemd-analyze [OPTIONS...] [time | blame | syscall-filter [SET...] | verify FILE]'],
    description: 'systemd-analyze may be used to determine system boot-up performance statistics and retrieve other state and tracing information from the system and service manager. blame lists the units by the time they took to start; syscall-filter lists the system calls in the groups SystemCallFilter= understands (@mount, @reboot, @raw-io, @system-service…).',
    seeAlso: 'systemd(1), systemctl(1), systemd.exec(5)',
    url: 'https://man7.org/linux/man-pages/man1/systemd-analyze.1.html',
  }),
  run(ctx) {
    const m = M(ctx);
    const [sub = 'time', ...rest] = ctx.argv.slice(1);
    if (sub === 'time') {
      ctx.out('Startup finished in 1.204s (kernel) + 2.870s (userspace) = 4.075s\nmulti-user.target reached after 2.811s in userspace.\n');
      return 0;
    }
    if (sub === 'blame') {
      const units = [...m.systemd.units.values()].filter((u) => u.config);
      const t = (n: string) => ({ 'ssh.service': 412, 'cron.service': 38, 'systemd-journald.service': 211, 'nginx.service': 187 })[n] ?? 90 + (n.length * 37) % 600;
      for (const u of units.sort((a, b) => t(b.name) - t(a.name))) ctx.out(`${String(t(u.name)).padStart(5)}ms ${u.name}\n`);
      return 0;
    }
    if (sub === 'syscall-filter') {
      const sets: Record<string, string> = {
        '@mount': 'chroot\nfsconfig\nfsmount\nfsopen\nfspick\nmount\nmount_setattr\nmove_mount\nopen_tree\npivot_root\numount\numount2',
        '@reboot': 'kexec_file_load\nkexec_load\nreboot',
        '@raw-io': 'ioperm\niopl\npciconfig_iobase\npciconfig_read\npciconfig_write',
        '@clock': 'adjtimex\nclock_adjtime\nclock_settime\nsettimeofday',
        '@module': 'delete_module\nfinit_module\ninit_module',
      };
      const want = rest.length ? rest : Object.keys(sets);
      for (const s of want) {
        if (!sets[s]) {
          ctx.err(`Filter set "${s}" not found.\n`);
          return 1;
        }
        ctx.out(`${s}\n${sets[s].split('\n').map((l) => `    ${l}`).join('\n')}\n\n`);
      }
      return 0;
    }
    if (sub === 'verify') {
      for (const f of rest) {
        try {
          const text = ctx.fs.readFile(f);
          if (!/^\[Service\]/m.test(text)) ctx.err(`${f}: Service has no [Service] section.\n`);
          if (!/^ExecStart=/m.test(text)) ctx.err(`${f}: Service lacks both ExecStart= and ExecStop= setting. Refusing.\n`);
          const exe = /^ExecStart=[-@+!]*(\S+)/m.exec(text)?.[1];
          if (exe && exe.startsWith('/') && !m.vfs.statAs(exe, ROOT_CRED)) ctx.err(`${f}: Command ${exe} is not executable: No such file or directory\n`);
        } catch {
          ctx.err(`Failed to prepare filename ${f}: No such file or directory\n`);
          return 1;
        }
      }
      return 0;
    }
    ctx.err(`Unknown command verb '${sub}'.\n`);
    return 1;
  },
};

const serviceCommand: ShellCommand = {
  name: 'service',
  summary: bi('управлять службой', 'control a service'),
  help: 'service NAME start|stop|restart|reload|status',
  run(ctx) {
    const [, name, action] = ctx.argv;
    if (!name || !action) { ctx.err('usage: service NAME ACTION\n'); return 2; }
    return systemctl.run({ ...ctx, argv: ['systemctl', action, name] });
  },
};

export const SYSTEMD_COMMANDS: ShellCommand[] = [serviceCommand, systemctl, journalctl, systemdRun, systemdCgls, systemdAnalyze];
