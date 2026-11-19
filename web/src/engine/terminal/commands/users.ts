// Users, groups and privileges: id, whoami, groups, who, getent, su, sudo,
// useradd, usermod, userdel, groupadd, chpasswd, passwd, umask.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand, UserAccount } from '../../../core/types';
import { CAP_FULL, capHex } from '../kernel';
import { ForkError, type SimMachine } from '../shell';
import { ROOT_CRED } from '../vfs';
import { cmdDoc, parseArgs, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;
const SECURE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

export function idLine(m: SimMachine, u: UserAccount): string {
  const uid = m.displayUid(u.uid);
  const name = (n: number) => m.users.find((x) => x.uid === n)?.name ?? String(n);
  const gname = (g: number) => m.groupName_(g);
  const userNs = m.kernel.ns.get(m.shellProc().ns.user);
  if (userNs?.uidMap) return `uid=${uid}(${name(uid)}) gid=${uid === 0 ? 0 : 65534}(${uid === 0 ? 'root' : 'nogroup'}) groups=${uid === 0 ? '0(root)' : '65534(nogroup)'},65534(nogroup)`;
  return `uid=${uid}(${name(uid)}) gid=${u.gid}(${gname(u.gid)}) groups=${u.groups.map((g) => `${g}(${gname(g)})`).join(',')}`;
}

const id: ShellCommand = {
  ...cmdDoc({
    name: 'id',
    summary: bi('показать, кто вы для системы', 'print user and group ids'),
    whatis: 'print real and effective user and group IDs',
    synopsis: ['id [OPTION]... [USER]...'],
    description: 'Print user and group information for each specified USER, or (when USER omitted) for the current process.\nThe system knows a user by the number uid; the name is for people. A user has one primary group (gid) and may be in several supplementary groups.',
    options: [
      ['-g, --group', 'print only the effective group ID'],
      ['-G, --groups', 'print all group IDs'],
      ['-n, --name', 'print a name instead of a number, for -ugG'],
      ['-u, --user', 'print only the effective user ID'],
    ],
    seeAlso: 'whoami(1), groups(1), passwd(5), group(5)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'gGnur', long: { group: 'g', groups: 'G', name: 'n', user: 'u', real: 'r' } });
    if (a.error) return usageError(ctx, a.error);
    const m = M(ctx);
    const u = a.operands[0] ? m.users.find((x) => x.name === a.operands[0] || String(x.uid) === a.operands[0]) : ctx.user;
    if (!u) {
      ctx.err(`id: '${a.operands[0]}': no such user\n`);
      return 1;
    }
    const n = a.flags.has('n');
    const gname = (g: number) => m.groups.find((x) => x.gid === g)?.name ?? String(g);
    if (a.flags.has('u')) ctx.out((n ? m.userName_(u.uid) : String(m.displayUid(u.uid))) + '\n');
    else if (a.flags.has('g')) ctx.out((n ? gname(u.gid) : String(u.gid)) + '\n');
    else if (a.flags.has('G')) ctx.out(u.groups.map((g) => (n ? gname(g) : String(g))).join(' ') + '\n');
    else ctx.out(idLine(m, u) + '\n');
    return 0;
  },
};

const whoami: ShellCommand = {
  ...cmdDoc({
    name: 'whoami',
    summary: bi('напечатать имя текущего пользователя', 'print the current user name'),
    whatis: 'print effective user name',
    synopsis: ['whoami [OPTION]...'],
    description: 'Print the user name associated with the current effective user ID. Same as id -un.',
    seeAlso: 'id(1)',
  }),
  run(ctx) {
    ctx.out(M(ctx).userName_(ctx.user.uid) + '\n');
    return 0;
  },
};

const groups: ShellCommand = {
  ...cmdDoc({
    name: 'groups',
    summary: bi('показать группы пользователя', 'print the groups a user is in'),
    whatis: 'print the groups a user is in',
    synopsis: ['groups [OPTION]... [USERNAME]...'],
    description: 'Print group memberships for each USERNAME or, if no USERNAME is specified, for the current process.\nA new group membership takes effect at the next login: a shell keeps the groups it started with.',
    seeAlso: 'id(1), usermod(8)',
  }),
  run(ctx) {
    const m = M(ctx);
    const names = ctx.argv.slice(1);
    const gname = (g: number) => m.groups.find((x) => x.gid === g)?.name ?? String(g);
    if (!names.length) {
      ctx.out(ctx.user.groups.map(gname).join(' ') + '\n');
      return 0;
    }
    let exit = 0;
    for (const n of names) {
      const u = m.users.find((x) => x.name === n);
      if (!u) {
        ctx.err(`groups: '${n}': no such user\n`);
        exit = 1;
        continue;
      }
      ctx.out(`${n} : ${u.groups.map(gname).join(' ')}\n`);
    }
    return exit;
  },
};

const who: ShellCommand = {
  ...cmdDoc({
    name: 'who',
    summary: bi('кто вошёл в систему', 'show who is logged on'),
    whatis: 'show who is logged on',
    synopsis: ['who [OPTION]... [ FILE | ARG1 ARG2 ]'],
    description: 'Print information about users who are currently logged in.',
    seeAlso: 'w(1), users(1)',
  }),
  run(ctx) {
    const m = M(ctx);
    const d = new Date(m.bootAt + 60000);
    const p = (n: number) => String(n).padStart(2, '0');
    const login = m.users.find((u) => u.uid >= 1000 && u.uid < 60000)?.name ?? 'root';
    ctx.out(`${login.padEnd(8)} pts/0        ${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} (10.0.0.1)\n`);
    return 0;
  },
};

const getent: ShellCommand = {
  ...cmdDoc({
    name: 'getent',
    summary: bi('прочитать запись из базы пользователей или групп', 'get entries from the user and group databases'),
    whatis: 'get entries from Name Service Switch libraries',
    synopsis: ['getent database [key ...]'],
    description: 'The getent command displays entries from databases supported by the Name Service Switch libraries: passwd, group, hosts, shadow (root only).',
    seeAlso: 'passwd(5), group(5), nsswitch.conf(5)',
  }),
  run(ctx) {
    const [db, ...keys] = ctx.argv.slice(1);
    const file = { passwd: '/etc/passwd', group: '/etc/group', hosts: '/etc/hosts', shadow: '/etc/shadow' }[db ?? ''];
    if (!file) {
      ctx.err(db ? `Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.\n` : 'getent: wrong number of arguments\n');
      return db ? 1 : 1;
    }
    let text: string;
    try {
      text = ctx.fs.readFile(file);
    } catch {
      return 2;
    }
    const rows = text.split('\n').filter(Boolean);
    if (!keys.length) {
      ctx.out(rows.join('\n') + '\n');
      return 0;
    }
    let found = 0;
    for (const k of keys) {
      const r = rows.find((row) => (db === 'hosts' ? row.split(/\s+/).includes(k) : row.split(':')[0] === k || row.split(':')[2] === k));
      if (r) {
        ctx.out(r + '\n');
        found++;
      }
    }
    return found ? 0 : 2;
  },
};

/** Is this user allowed to use sudo on this machine? (members of the sudo group, root) */
function sudoAllowed(m: SimMachine, u: UserAccount): boolean {
  const sudoG = m.groups.find((g) => g.name === 'sudo')?.gid;
  return u.uid === 0 || (sudoG !== undefined && u.groups.includes(sudoG));
}

const sudo: ShellCommand = {
  ...cmdDoc({
    name: 'sudo',
    section: 8,
    summary: bi('выполнить одну команду от имени root', 'run one command as root'),
    whatis: 'execute a command as another user',
    synopsis: ['sudo [-u user] command [arg ...]', 'sudo -i', 'sudo -l'],
    description:
      'sudo allows a permitted user to execute a command as the superuser or another user, as specified by the security policy in /etc/sudoers. Every use is logged in the journal.\nOn this machine members of the group sudo may run any command and are not asked for a password (/etc/sudoers.d/90-learner); on many servers the password of the user is asked.\nThe redirection of a command is done by your shell, not by sudo: in sudo echo x > /etc/file the file is opened by your shell as you, and fails. Use sudo tee instead.',
    options: [
      ['-i, --login', "Run the shell specified by the target user's password database entry as a login shell."],
      ['-u user, --user=user', 'Run the command as a user other than the default target user (usually root).'],
      ['-l, --list', 'List the allowed (and forbidden) commands for the invoking user on the current host.'],
      ['-s, --shell', 'Run the shell specified by the SHELL environment variable if it is set or the shell specified by the invoking user\'s password database entry.'],
    ],
    extra: [{ id: 'SECURITY NOTES', body: 'sudo tries to be safe when executing external commands. To prevent command spoofing, sudo checks "." and "" last when searching for a command in the user\'s PATH, and uses secure_path from sudoers instead of the PATH of the invoking user when it is set.' }],
    exit: 'Upon successful execution of a command, the exit status from sudo will be the exit status of the program that was executed. Otherwise, sudo exits with a value of 1 if there is a configuration/permission problem or if sudo cannot execute the given command.',
    seeAlso: 'su(1), sudoers(5), visudo(8)',
    url: 'https://man7.org/linux/man-pages/man8/sudo.8.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let target = 'root';
    let login = false;
    let shell = false;
    let list = false;
    while (args.length && args[0].startsWith('-')) {
      const x = args.shift()!;
      if (x === '-u') target = args.shift() ?? 'root';
      else if (x.startsWith('--user=')) target = x.slice(7);
      else if (x === '-i' || x === '--login') login = true;
      else if (x === '-s' || x === '--shell') shell = true;
      else if (x === '-l' || x === '--list') list = true;
      else if (x === '-E' || x === '-n' || x === '-H') continue;
      else if (x === '--') break;
      else {
        ctx.err(`sudo: invalid option -- '${x.replace(/^-+/, '')}'\nusage: sudo -h | -K | -k | -V\n`);
        return 1;
      }
    }
    if (!sudoAllowed(m, ctx.user)) {
      ctx.err(`${ctx.user.name} is not in the sudoers file.\n`);
      m.systemd.log('sudo', m.procs.next, `${ctx.user.name} : user NOT in sudoers ; TTY=pts/0 ; PWD=${ctx.cwd} ; USER=root ; COMMAND=${args.join(' ')}`, { prio: 2 });
      return 1;
    }
    if (list) {
      ctx.out(`Matching Defaults entries for ${ctx.user.name} on ${m.hostname}:\n    env_reset, secure_path=${SECURE_PATH}\n\nUser ${ctx.user.name} may run the following commands on ${m.hostname}:\n    (ALL : ALL) ALL\n    (ALL : ALL) NOPASSWD: ALL\n`);
      return 0;
    }
    const tu = m.users.find((u) => u.name === target);
    if (!tu) {
      ctx.err(`sudo: unknown user ${target}\nsudo: error initializing audit plugin sudoers_audit\n`);
      return 1;
    }
    const as = { user: tu, capEff: capHex(tu.uid === 0 ? CAP_FULL : 0n) };
    m.systemd.log('sudo', m.procs.next, `${ctx.user.name} : TTY=pts/0 ; PWD=${ctx.cwd} ; USER=${tu.name} ; COMMAND=${login ? '/bin/bash' : args.join(' ')}`, { prio: 5 });
    if (login || shell || !args.length) {
      if (!login && !shell) {
        ctx.err('usage: sudo -h | -K | -k | -V\nusage: sudo -v [-ABkNnS] [-g group] [-h host] [-p prompt] [-u user]\nusage: sudo -l [-ABkNnS] [-g group] [-h host] [-p prompt] [-U user] [-u user] [command [arg ...]]\nusage: sudo [-ABbEHkNnPS] [-r role] [-t type] [-C num] [-D directory] [-g group] [-h host] [-p prompt] [-R directory] [-T timeout] [-u user] [VAR=value] [-i | -s] [command [arg ...]]\n');
        return 1;
      }
      try {
        m.pushShell({ user: tu.name, login, capEff: as.capEff, env: login ? {} : { USER: tu.name, HOME: tu.home, LOGNAME: tu.name } });
      } catch (e) {
        if (e instanceof ForkError) {
          ctx.err(`sudo: ${e.message}\n`);
          return 1;
        }
        throw e;
      }
      return 0;
    }
    return m.runArgv(ctx, args, as, { env: { PATH: SECURE_PATH, HOME: tu.home, USER: tu.name, LOGNAME: tu.name, SUDO_USER: ctx.user.name } });
  },
};

const su: ShellCommand = {
  ...cmdDoc({
    name: 'su',
    summary: bi('стать другим пользователем', 'switch to another user'),
    whatis: 'run a command with substitute user and group ID',
    synopsis: ['su [options] [-] [user [argument...]]'],
    description: 'su allows commands to be run with a substitute user and group ID. When called with no user specified, su defaults to running an interactive shell as root. exit returns to the previous user.\nsu asks for the password of the target user (root on Debian has none by default, so su without sudo fails); root itself is not asked. sudo su - or sudo -i is the usual way to a root shell.',
    options: [
      ['-, -l, --login', 'Start the shell as a login shell with an environment similar to a real login: clear the environment, go to the home directory, set HOME, SHELL, USER, LOGNAME and PATH.'],
      ['-c, --command=command', 'Pass command to the shell with the -c option.'],
    ],
    seeAlso: 'sudo(8), login(1)',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let login = false;
    let command: string | undefined;
    const ops: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === '-' || x === '-l' || x === '--login') login = true;
      else if (x === '-c') command = args[++i];
      else ops.push(x);
    }
    const target = ops[0] ?? 'root';
    const tu = m.users.find((u) => u.name === target);
    if (!tu) {
      ctx.err(`su: user ${target} does not exist or the user entry does not contain all the required fields\n`);
      return 1;
    }
    if (ctx.user.uid !== 0) {
      ctx.err('Password: \nsu: Authentication failure\n');
      m.systemd.log('su', m.procs.next, `FAILED SU (to ${target}) ${ctx.user.name} on pts/0`, { prio: 5 });
      return 1;
    }
    if (!/(bash|sh)$/.test(tu.shell)) {
      ctx.out('This account is currently not available.\n');
      return 1;
    }
    const as = { user: tu, capEff: capHex(tu.uid === 0 ? CAP_FULL : 0n) };
    if (command !== undefined) return m.runLineAs(command, as, { out: ctx.out, err: ctx.err, cwd: login ? tu.home : ctx.cwd });
    m.pushShell({ user: tu.name, login, capEff: as.capEff, env: login ? {} : { USER: tu.name, HOME: tu.home, LOGNAME: tu.name } });
    return 0;
  },
};

function needRoot(ctx: CmdContext, name: string): boolean {
  if (ctx.user.uid === 0) return true;
  ctx.err(`${name}: Permission denied.\n${name}: cannot lock /etc/passwd; try again later.\n`);
  return false;
}

const useradd: ShellCommand = {
  ...cmdDoc({
    name: 'useradd',
    section: 8,
    summary: bi('создать пользователя', 'create a new user'),
    whatis: 'create a new user or update default new user information',
    synopsis: ['useradd [options] LOGIN'],
    description: 'useradd creates a new user account: a line in /etc/passwd and /etc/shadow, a group with the same name (USERGROUPS_ENAB yes), and, with -m, a home directory.\nThe account has no password until one is set (chpasswd, passwd), so nobody can log in with a password yet.',
    options: [
      ['-m, --create-home', "Create the user's home directory if it does not exist."],
      ['-s, --shell SHELL', "The name of the user's login shell. The default on Debian is /bin/sh."],
      ['-G, --groups GROUP1[,GROUP2,...]', 'A list of supplementary groups which the user is also a member of.'],
      ['-u, --uid UID', "The numerical value of the user's ID."],
      ['-d, --home-dir HOME_DIR', "The new user will be created using HOME_DIR as the value for the user's login directory."],
      ['-r, --system', 'Create a system account (UID below 1000, no home unless -m).'],
    ],
    seeAlso: 'usermod(8), userdel(8), groupadd(8), passwd(5)',
    url: 'https://man7.org/linux/man-pages/man8/useradd.8.html',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'mMrN', withValue: 'sGudgc', long: { 'create-home': 'm', shell: 's', groups: 'G', uid: 'u', 'home-dir': 'd', system: 'r', gid: 'g', comment: 'c' } });
    if (a.error) return usageError(ctx, a.error);
    if (!needRoot(ctx, 'useradd')) return 1;
    const name = a.operands[0];
    if (!name) {
      ctx.err('Usage: useradd [options] LOGIN\n');
      return 2;
    }
    const m = M(ctx);
    if (m.users.some((u) => u.name === name)) {
      ctx.err(`useradd: user '${name}' already exists\n`);
      return 9;
    }
    const groups = a.values.G?.split(',').filter(Boolean) ?? [];
    for (const g of groups) if (!m.groups.some((x) => x.name === g)) {
      ctx.err(`useradd: group '${g}' does not exist\n`);
      return 6;
    }
    const sys = a.flags.has('r');
    const uid = a.values.u ? Number(a.values.u) : sys ? Math.max(100, ...m.users.filter((u) => u.uid < 1000 && u.uid > 0).map((u) => u.uid)) + 1 : undefined;
    m.addUser(name, { uid, groups, home: a.values.d, shell: a.values.s ?? '/bin/sh', createHome: a.flags.has('m') });
    return 0;
  },
};

const usermod: ShellCommand = {
  ...cmdDoc({
    name: 'usermod',
    section: 8,
    summary: bi('изменить учётную запись пользователя', 'modify a user account'),
    whatis: 'modify a user account',
    synopsis: ['usermod [options] LOGIN'],
    description: 'The usermod command modifies the system account files. A change of groups takes effect at the next login of the user.',
    options: [
      ['-a, --append', 'Add the user to the supplementary group(s). Use only with the -G option.'],
      ['-G, --groups GROUP1[,GROUP2,...]', 'A list of supplementary groups. If the user is currently a member of a group which is not listed, the user will be removed from the group, unless -a is given.'],
      ['-s, --shell SHELL', "The path of the user's new login shell."],
      ['-L, --lock', "Lock a user's password."],
    ],
    seeAlso: 'useradd(8), gpasswd(1)',
    url: 'https://man7.org/linux/man-pages/man8/usermod.8.html',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'aLU', withValue: 'Gsdg', long: { append: 'a', groups: 'G', shell: 's', lock: 'L' } });
    if (a.error) return usageError(ctx, a.error);
    if (!needRoot(ctx, 'usermod')) return 1;
    const m = M(ctx);
    const u = m.users.find((x) => x.name === a.operands[0]);
    if (!u) {
      ctx.err(`usermod: user '${a.operands[0] ?? ''}' does not exist\n`);
      return 6;
    }
    if (a.values.G !== undefined) {
      const gids: number[] = [];
      for (const g of a.values.G.split(',').filter(Boolean)) {
        const gg = m.groups.find((x) => x.name === g);
        if (!gg) {
          ctx.err(`usermod: group '${g}' does not exist\n`);
          return 6;
        }
        gids.push(gg.gid);
      }
      u.groups = a.flags.has('a') ? [...new Set([...u.groups, ...gids])] : [u.gid, ...gids.filter((g) => g !== u.gid)];
    }
    if (a.values.s) u.shell = a.values.s;
    m.syncEtc();
    return 0;
  },
};

const userdel: ShellCommand = {
  ...cmdDoc({
    name: 'userdel',
    section: 8,
    summary: bi('удалить пользователя', 'delete a user account'),
    whatis: 'delete a user account and related files',
    synopsis: ['userdel [options] LOGIN'],
    description: 'userdel removes the account from /etc/passwd, /etc/shadow and /etc/group. Files owned by the user stay on disk and show the numeric uid.',
    options: [['-r, --remove', "Files in the user's home directory will be removed along with the home directory itself."]],
    seeAlso: 'useradd(8)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'rf', long: { remove: 'r', force: 'f' } });
    if (!needRoot(ctx, 'userdel')) return 1;
    const m = M(ctx);
    const u = m.users.find((x) => x.name === a.operands[0]);
    if (!u) {
      ctx.err(`userdel: user '${a.operands[0] ?? ''}' does not exist\n`);
      return 6;
    }
    m.users = m.users.filter((x) => x !== u);
    m.groups = m.groups.filter((g) => !(g.name === u.name && g.gid === u.gid));
    if (a.flags.has('r')) void m.runLineAs(`rm -rf ${u.home}`, { user: m.users[0], capEff: capHex(CAP_FULL) }, { out: () => {}, err: () => {} });
    m.syncEtc();
    return 0;
  },
};

const groupadd: ShellCommand = {
  ...cmdDoc({
    name: 'groupadd',
    section: 8,
    summary: bi('создать группу', 'create a new group'),
    whatis: 'create a new group',
    synopsis: ['groupadd [options] group'],
    description: 'The groupadd command creates a new group account using the values specified on the command line plus the default values from the system.',
    options: [['-g, --gid GID', 'The numerical value of the group\'s ID.'], ['-r, --system', 'Create a system group.']],
    seeAlso: 'groupdel(8), usermod(8), group(5)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'rf', withValue: 'g', long: { gid: 'g', system: 'r', force: 'f' } });
    if (!needRoot(ctx, 'groupadd')) return 1;
    const m = M(ctx);
    const name = a.operands[0];
    if (!name) {
      ctx.err('Usage: groupadd [options] GROUP\n');
      return 2;
    }
    if (m.groups.some((g) => g.name === name)) {
      ctx.err(`groupadd: group '${name}' already exists\n`);
      return 9;
    }
    const gid = a.values.g ? Number(a.values.g) : Math.max(1000, ...m.groups.filter((g) => g.gid < 60000).map((g) => g.gid), ...m.users.filter((u) => u.uid < 60000).map((u) => u.uid)) + 1;
    m.groups.push({ name, gid });
    m.syncEtc();
    return 0;
  },
};

const chpasswd: ShellCommand = {
  ...cmdDoc({
    name: 'chpasswd',
    section: 8,
    summary: bi('задать пароли из строк user:password', 'set passwords from user:password lines'),
    whatis: 'update passwords in batch mode',
    synopsis: ['chpasswd [options]'],
    description: 'The chpasswd command reads a list of user name and password pairs from standard input and uses this information to update a group of existing users. Each line is of the format: user_name:password. The password is stored hashed in /etc/shadow.',
    seeAlso: 'passwd(1), shadow(5)',
  }),
  run(ctx) {
    if (!needRoot(ctx, 'chpasswd')) return 1;
    const m = M(ctx);
    let shadow = m.vfs.readFileAs('/etc/shadow', ROOT_CRED);
    for (const l of ctx.stdin.split('\n').filter(Boolean)) {
      const [user] = l.split(':');
      if (!m.users.some((u) => u.name === user)) {
        ctx.err(`chpasswd: (line 1, user ${user}) password not changed\n`);
        return 1;
      }
      shadow = shadow.replace(new RegExp(`^${user}:[^:]*:`, 'm'), `${user}:$y$j9T$${Math.random().toString(36).slice(2, 10)}$hashed:`);
    }
    m.vfs.writeFileAs('/etc/shadow', shadow, ROOT_CRED);
    return 0;
  },
};

const passwd: ShellCommand = {
  ...cmdDoc({
    name: 'passwd',
    summary: bi('сменить пароль', 'change a user password'),
    whatis: 'change user password',
    synopsis: ['passwd [options] [LOGIN]'],
    description: 'The passwd command changes passwords for user accounts. It asks for the new password twice; this terminal cannot hide typed text, so on this machine use echo "user:password" | sudo chpasswd.\npasswd -S prints the status of an account.',
    options: [['-S, --status', 'Display account status information: the login name, L (locked), NP (no password) or P (usable password), the date of the last change.']],
    seeAlso: 'chpasswd(8), shadow(5)',
  }),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'Sl', long: { status: 'S', lock: 'l' } });
    const m = M(ctx);
    const name = a.operands[0] ?? ctx.user.name;
    if (a.flags.has('S')) {
      if (name !== ctx.user.name && ctx.user.uid !== 0) {
        ctx.err('passwd: You may not view or modify password information for root.\n');
        return 1;
      }
      const line = m.vfs.readFileAs('/etc/shadow', ROOT_CRED).split('\n').find((l) => l.startsWith(name + ':'));
      const h = line?.split(':')[1] ?? '*';
      ctx.out(`${name} ${h.startsWith('$') ? 'P' : h === '' ? 'NP' : 'L'} 2025-11-18 0 99999 7 -1\n`);
      return 0;
    }
    ctx.err('passwd: this terminal cannot read a hidden password; use: echo "USER:PASSWORD" | sudo chpasswd\n');
    return 1;
  },
};

const umask: ShellCommand = {
  name: 'umask',
  builtin: true,
  summary: bi('показать или задать маску прав новых файлов', 'show or set the mask for new files'),
  help: `umask: umask [-p] [-S] [mode]
    Display or set file mode mask.

    Sets the user file-creation mask to MODE.  If MODE is omitted, prints
    the current value of the mask.  The mask removes bits from the mode of
    new files: with umask 022 a new file gets 666 & ~022 = 644, a new
    directory 777 & ~022 = 755.

    Options:
      -S	makes the output symbolic; otherwise an octal number is output`,
  run(ctx) {
    const m = M(ctx);
    const arg = ctx.argv.slice(1).filter((x) => x !== '-p');
    if (arg[0] === '-S') {
      const v = m.vfs.umask;
      const tri = (sh: number) => `${v & (4 << sh) ? '' : 'r'}${v & (2 << sh) ? '' : 'w'}${v & (1 << sh) ? '' : 'x'}`;
      ctx.out(`u=${tri(6)},g=${tri(3)},o=${tri(0)}\n`);
      return 0;
    }
    if (!arg.length) {
      ctx.out(m.vfs.umask.toString(8).padStart(4, '0') + '\n');
      return 0;
    }
    if (!/^[0-7]{1,4}$/.test(arg[0])) {
      ctx.err(`bash: umask: ${arg[0]}: octal number out of range\n`);
      return 1;
    }
    m.vfs.umask = parseInt(arg[0], 8);
    return 0;
  },
};

export const USER_COMMANDS: ShellCommand[] = [id, whoami, groups, who, getent, sudo, su, useradd, usermod, userdel, groupadd, chpasswd, passwd, umask];
