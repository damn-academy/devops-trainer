// The terminal engine's registrations: shell built-ins, the basic commands
// every simulated machine has, and the full tier-A command set of the Linux
// block ("Стенд"): files, text, users, processes, systemd, packages, disks,
// the network as the machine sees it, SSH and the kernel's isolation tools.

import { defineModule } from '../../core/define';
import type { SetupHook, SimMachineApi } from '../../core/types';
import { BASIC_COMMANDS } from './commands/basic';
import { BUILTINS } from './commands/builtins';
import { FILE_COMMANDS } from './commands/files';
import { KERNEL_COMMANDS } from './commands/kernelcmds';
import { PKG_COMMANDS, installPackage } from './commands/pkg';
import { PROC_COMMANDS } from './commands/procs';
import { SHELL_COMMANDS } from './commands/shellx';
import { SYSTEMD_COMMANDS } from './commands/sysd';
import { SYSTEM_COMMANDS } from './commands/system';
import { TEXT_COMMANDS } from './commands/text';
import { USER_COMMANDS } from './commands/users';
import { PROGRAMS, isBgError, type SimMachine } from './shell';
import { CAP_FULL, capHex } from './kernel';
import { FALLBACK } from './registry';
import './bridge';

/**
 * TerminalSetup.ext.linux: packages to have installed and programs to have
 * running in the background before the learner arrives:
 *   { packages: ['nginx'], procs: [{ argv: ['burner'], user: 'learner' }] }
 */
const linuxSetup: SetupHook = {
  key: 'linux',
  async apply(m: SimMachineApi, value: unknown) {
    const sm = m as unknown as SimMachine;
    const v = (value ?? {}) as { packages?: string[]; procs?: { argv: string[]; user?: string }[] };
    for (const p of v.packages ?? []) await installPackage(sm, p);
    for (const p of v.procs ?? []) {
      const name = p.argv[0].split('/').pop()!;
      const spec = PROGRAMS.get(name);
      const user = sm.users.find((u) => u.name === (p.user ?? 'learner')) ?? sm.users[0];
      const as = { user, capEff: capHex(user.uid === 0 ? CAP_FULL : 0n) };
      const extra = spec?.background?.(p.argv, sm, as);
      if (!extra || isBgError(extra)) continue;
      const pid = sm.forkRaw({ cmd: name, argv: p.argv, uid: user.uid, ppid: 1, capEff: as.capEff, cgroup: user.uid === 0 ? '/user.slice' : `/user.slice/user-${user.uid}.slice/session-1.scope`, tty: '?', state: extra.cpuWant ? 'R' : 'S', ...extra } as never);
      const proc = sm.procs.get(pid) as { until?: number } | undefined;
      if (proc && typeof extra.until === 'number') proc.until = sm.now() + extra.until;
    }
  },
};

export const ALL_COMMANDS = [...BUILTINS, ...BASIC_COMMANDS, ...SHELL_COMMANDS, ...FILE_COMMANDS, ...TEXT_COMMANDS, ...USER_COMMANDS, ...PROC_COMMANDS, ...SYSTEM_COMMANDS, ...SYSTEMD_COMMANDS, ...PKG_COMMANDS, ...KERNEL_COMMANDS];

// ip, ss, curl, ping and nginx belong to the network engine when it is in the build.
for (const c of [...SYSTEM_COMMANDS, ...PROC_COMMANDS]) if (['ip', 'ss', 'curl', 'ping', 'nginx'].includes(c.name)) FALLBACK.add(c);

export default defineModule({
  commands: ALL_COMMANDS,
  setup: [linuxSetup],
});
