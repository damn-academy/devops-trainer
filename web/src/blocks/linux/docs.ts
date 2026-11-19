// Offline man pages the Linux learning exams read at the ladder's fifth step:
// the resource directives of systemd and the execution environment of a
// service. Text condensed from systemd.resource-control(5) and
// systemd.exec(5) of systemd 257 (LGPL-2.1-or-later); `man systemd.exec` and
// `man systemd.resource-control` open them on the simulated machine.

import type { DocPage } from '../../core/types';

const SYSTEMD = { license: 'condensed from the systemd manual pages (LGPL-2.1-or-later)', version: 'systemd 257' };

export const LINUX_DOCS: DocPage[] = [
  {
    id: 'man/systemd.resource-control.5',
    source: 'man',
    title: 'systemd.resource-control(5)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html',
    ...SYSTEMD,
    sections: [
      { id: 'NAME', body: 'systemd.resource-control - Resource control unit settings' },
      { id: 'SYNOPSIS', body: 'slice.slice, scope.scope, service.service, socket.socket, mount.mount, swap.swap' },
      {
        id: 'DESCRIPTION',
        body: 'Unit configuration files for services, slices, scopes, sockets, mount points, and swap devices share a subset of configuration options for resource control of spawned processes. Internally, this relies on the Linux Control Groups (cgroups) kernel concept for organizing processes in a hierarchical tree of named groups for the purpose of resource management.\nThe options are set in the [Service] section (or [Slice], [Scope], ...). They may also be set in a drop-in file, created with systemctl edit or by hand in /etc/systemd/system/UNIT.d/*.conf. After changing a unit file, run systemctl daemon-reload; most settings take effect on the next start of the unit.',
      },
      {
        id: 'OPTIONS',
        body: [
          'CPUWeight=weight, StartupCPUWeight=weight',
          '       These options accept an integer value or the special string "idle". If set, the cgroup v2 attribute cpu.weight is written. Takes an integer between 1 and 10000. Defaults to 100. The CPU time available to all processes is split between the cgroups of the same level in proportion to their weights: a unit with weight 200 gets twice the share of a unit with weight 100 when both want CPU at the same time. The weight only matters under contention: an otherwise idle system gives any unit all the CPU it wants.',
          '',
          'CPUQuota=',
          '       Assign the specified CPU time quota to the processes executed. Takes a percentage value, suffixed with "%". The percentage specifies how much CPU time the unit shall get at maximum, relative to the total CPU time available on one CPU. Use values > 100% for allotting CPU time on more than one CPU. This writes the cgroup v2 attribute cpu.max. The quota is a hard limit: it applies even when the system is idle.',
          '',
          'MemoryHigh=bytes',
          '       Specify the throttling limit on memory usage of the executed processes in this unit. Memory usage may go above the limit if unavoidable, but the processes are heavily slowed down and memory is taken away aggressively. Writes memory.high.',
          '',
          'MemoryMax=bytes',
          '       Specify the absolute limit on memory usage of the executed processes in this unit. If memory usage cannot be contained under the limit, the out-of-memory killer is invoked inside the unit. Takes a memory size in bytes; with the suffix K, M, G or T the size is parsed as Kilobytes, Megabytes, Gigabytes or Terabytes (with the base 1024). The special value "infinity" means no limit. Writes memory.max.',
          '',
          'TasksMax=N',
          '       Specify the maximum number of tasks that may be created in the unit. This ensures that the number of tasks accounted for the unit stays below a specific limit. Takes an absolute number of tasks or a percentage value that is taken relative to the configured maximum number of tasks on the system. Writes pids.max. Note that a task is a process or a thread.',
          '',
          'IOWeight=weight',
          '       Set the default overall block I/O weight for the executed processes, between 1 and 10000. Defaults to 100. Like CPUWeight=, it only splits the disk bandwidth under contention.',
        ].join('\n'),
      },
      { id: 'EXAMPLES', body: '# /etc/systemd/system/batch.service.d/limits.conf\n[Service]\nMemoryMax=512M\nTasksMax=100' },
      { id: 'SEE ALSO', body: 'systemd(1), systemctl(1), systemd.unit(5), systemd.service(5), systemd.exec(5), systemd-run(1)' },
    ],
  },
  {
    id: 'man/systemd.exec.5',
    source: 'man',
    title: 'systemd.exec(5)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html',
    ...SYSTEMD,
    sections: [
      { id: 'NAME', body: 'systemd.exec - Execution environment configuration' },
      { id: 'SYNOPSIS', body: 'service.service, socket.socket, mount.mount, swap.swap' },
      { id: 'DESCRIPTION', body: 'Unit configuration files for services, sockets, mount points, and swap devices share a subset of configuration options which define the execution environment of spawned processes. These options are set in the [Service] section of a service unit.' },
      {
        id: 'OPTIONS',
        body: [
          'User=, Group=',
          '       Set the UNIX user or group that the processes are executed as, respectively. Takes a single user or group name, or a numeric ID as argument. The user must exist when the unit starts, unless DynamicUser= is set. For system services a system user is usually created with useradd --system, without a login shell.',
          '',
          'DynamicUser=',
          '       Takes a boolean parameter. If set, a UNIX user and group pair is allocated dynamically when the unit is started, and released as soon as it is stopped.',
          '',
          'WorkingDirectory=',
          '       Takes a directory path relative to the service\'s root directory. Sets the working directory for executed processes.',
          '',
          'Environment=',
          '       Sets environment variables for executed processes. Takes a space-separated list of variable assignments. This option may be specified more than once.',
          '',
          'Nice=nice',
          '       Sets the default nice level (scheduling priority) for executed processes. Takes an integer between -20 (highest priority) and 19 (lowest priority).',
          '',
          'OOMScoreAdjust=',
          '       Sets the adjustment value for the Linux kernel\'s Out-Of-Memory (OOM) killer score for executed processes. Takes an integer between -1000 (to disable OOM killing of processes of this unit) and 1000 (to make killing of processes of this unit under memory pressure very likely). Writes /proc/PID/oom_score_adj. See proc(5) for details.',
          '',
          'CapabilityBoundingSet=, AmbientCapabilities=',
          '       Controls which capabilities to include in the capability bounding set for the executed process, and which ambient capabilities it receives. See capabilities(7).',
        ].join('\n'),
      },
      { id: 'SEE ALSO', body: 'systemd(1), systemctl(1), systemd.service(5), systemd.resource-control(5), capabilities(7), proc(5)' },
    ],
  },
];
