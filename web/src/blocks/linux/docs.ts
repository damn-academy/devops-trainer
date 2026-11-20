// Offline man pages of systemd that the Linux lessons and learning exams read:
// the unit file and its [Unit] section (start rate limiting), the [Service]
// section (Restart=), the resource directives and the execution environment.
// Text condensed from systemd.unit(5), systemd.service(5),
// systemd.resource-control(5) and systemd.exec(5) of systemd 257
// (LGPL-2.1-or-later); `man systemd.unit` and the others open them on the
// simulated machine.

import type { DocPage } from '../../core/types';

const SYSTEMD = { license: 'condensed from the systemd manual pages (LGPL-2.1-or-later)', version: 'systemd 257' };

export const LINUX_DOCS: DocPage[] = [
  {
    id: 'man/systemd.unit.5',
    source: 'man',
    title: 'systemd.unit(5)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html',
    ...SYSTEMD,
    sections: [
      { id: 'NAME', body: 'systemd.unit - Unit configuration' },
      { id: 'SYNOPSIS', body: 'service.service, socket.socket, device.device, mount.mount, automount.automount, swap.swap, target.target, path.path, timer.timer, slice.slice, scope.scope\n\nSystem unit search path:\n/etc/systemd/system/*\n/run/systemd/system/*\n/usr/lib/systemd/system/*' },
      {
        id: 'DESCRIPTION',
        body: 'A unit file is a plain text ini-style file that encodes information about a service, a socket, a device, a mount point, an automount point, a swap file or partition, a start-up target, a watched file system path, a timer, a resource management slice or a group of externally created processes.\n\nThis man page lists the common configuration options of all the unit types. These options need to be configured in the [Unit] or [Install] sections of the unit files. In addition to the generic [Unit] and [Install] sections, each unit may have a type-specific section, e.g. [Service] for a service unit. See systemd.service(5) for the options of that section.\n\nAfter changing a unit file, run "systemctl daemon-reload" so that the manager reads it again.',
      },
      {
        id: '[UNIT] SECTION OPTIONS',
        body: [
          'Description=',
          '       A short human readable title of the unit.',
          '',
          'Wants=',
          '       Configures (weak) requirement dependencies on other units. Units listed in this option will be started if the configuring unit is. However, if the listed units fail to start or cannot be added to the transaction, this has no impact on the validity of the transaction as a whole.',
          '',
          'Requires=',
          '       Similar to Wants=, but declares a stronger requirement dependency. If this unit gets activated, the units listed will be activated as well. If one of the other units fails to activate, this unit will not be started.',
          '',
          'After=, Before=',
          '       These two settings configure ordering dependencies between units. If unit foo.service contains the setting Before=bar.service and both units are being started, bar.service\'s start-up is delayed until foo.service has finished starting up. Note that this setting is independent of and orthogonal to the requirement dependencies as configured by Requires= and Wants=.',
          '',
          'StartLimitIntervalSec=interval, StartLimitBurst=burst',
          '       Configure unit start rate limiting. Units which are started more than burst times within an interval time span are not permitted to start any more. Use StartLimitIntervalSec= to configure the checking interval and StartLimitBurst= to configure how many starts per interval are allowed.',
          '',
          '       interval is a time span with the default unit of seconds, but other units may be specified, see systemd.time(7). The special value "infinity" can be used to limit the total number of start attempts, even if they happen at large time intervals. Defaults to DefaultStartLimitIntervalSec= in the manager configuration file (10s), and may be set to 0 to disable any kind of rate limiting. burst is a number and defaults to DefaultStartLimitBurst= (5).',
          '',
          '       These configuration options are particularly useful in conjunction with the service setting Restart= (see systemd.service(5)); however, they apply to all kinds of starts (including manual), not just those triggered by the Restart= logic.',
          '',
          '       A unit that hit the limit enters the failed state with the result "start-limit-hit". Use "systemctl reset-failed" to flush the counter and allow the unit to start again.',
        ].join('\n'),
      },
      {
        id: '[INSTALL] SECTION OPTIONS',
        body: [
          'WantedBy=, RequiredBy=',
          '       This option may be used more than once, or a space-separated list of unit names may be given. A symbolic link is created in the .wants/ or .requires/ directory of each of the listed units when this unit is installed by systemctl enable. The primary result is that the current unit will be started when the listed unit is started.',
        ].join('\n'),
      },
      { id: 'EXAMPLES', body: '# /etc/systemd/system/app.service\n[Unit]\nDescription=The app\nAfter=network-online.target\nStartLimitIntervalSec=60\nStartLimitBurst=3\n\n[Service]\nExecStart=/usr/local/bin/app\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target' },
      { id: 'SEE ALSO', body: 'systemd(1), systemctl(1), systemd.service(5), systemd.exec(5), systemd.resource-control(5), systemd.time(7)' },
    ],
  },
  {
    id: 'man/systemd.service.5',
    source: 'man',
    title: 'systemd.service(5)',
    url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html',
    ...SYSTEMD,
    sections: [
      { id: 'NAME', body: 'systemd.service - Service unit configuration' },
      { id: 'SYNOPSIS', body: 'service.service' },
      {
        id: 'DESCRIPTION',
        body: 'A unit configuration file whose name ends in ".service" encodes information about a process controlled and supervised by systemd.\n\nThis man page lists the configuration options specific to this unit type. See systemd.unit(5) for the common options of all unit configuration files, among them the start rate limiting StartLimitIntervalSec= and StartLimitBurst= of the [Unit] section. The service specific configuration options are configured in the [Service] section.',
      },
      {
        id: 'OPTIONS',
        body: [
          'Type=',
          '       Configures the mechanism via which the service notifies the manager that the service start-up has finished. One of simple, exec, forking, oneshot, dbus, notify, notify-reload or idle. If set to simple (the default if ExecStart= is specified), the service manager will consider the unit started immediately after the main service process has been forked off.',
          '',
          'ExecStart=',
          '       Commands that are executed when this service is started. The first argument must be an absolute path to an executable or a simple file name without any slashes.',
          '',
          'Restart=',
          '       Configures whether the service shall be restarted when the service process exits, is killed, or a timeout is reached. Takes one of no, on-success, on-failure, on-abnormal, on-watchdog, on-abort, or always. If set to no (the default), the service will not be restarted. If set to on-failure, the service will be restarted when the process exits with a non-zero exit code, is terminated by a signal (including on core dump, but excluding the four clean signals), when an operation times out, and when the configured watchdog timeout is triggered. If set to always, the service will be restarted regardless of whether it exited cleanly or not.',
          '',
          '       Note that service restart is subject to unit start rate limiting configured with StartLimitIntervalSec= and StartLimitBurst=, see systemd.unit(5) for details.',
          '',
          'RestartSec=',
          '       Configures the time to sleep before restarting a service (as configured with Restart=). Takes a unit-less value in seconds, or a time span value such as "5min 20s". Defaults to 100ms.',
        ].join('\n'),
      },
      { id: 'SEE ALSO', body: 'systemd(1), systemctl(1), systemd.unit(5), systemd.exec(5), systemd.resource-control(5)' },
    ],
  },
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
