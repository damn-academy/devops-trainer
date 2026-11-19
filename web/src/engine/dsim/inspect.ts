// `docker inspect` documents: the field names of the Docker Engine API, so
// that --format templates from real docs work here too.

import type { SimMachineApi } from '../../core/types';
import { imageSize, upperSize } from './engine';
import type { ContainerRec, DockerSnapshot, ImageRec, NetworkRec, VolumeRec } from './state';

const iso = (t: number | null) => (t ? new Date(t).toISOString().replace('Z', '000000Z').replace(/\.(\d{3})0+Z$/, '.$1000000Z') : '0001-01-01T00:00:00Z');

export function containerDoc(st: DockerSnapshot, c: ContainerRec, m: SimMachineApi): Record<string, unknown> {
  void m;
  const argv = [...(c.config.Entrypoint ?? []), ...(c.config.Cmd ?? [])];
  const restartPolicyName = c.hostConfig.restartPolicy.name;
  const ports: Record<string, { HostIp: string; HostPort: string }[] | null> = {};
  for (const p of Object.keys(c.config.ExposedPorts ?? {})) ports[p] = null;
  for (const b of c.hostConfig.portBindings) (ports[`${b.containerPort}/${b.proto}`] ??= [])!.push({ HostIp: b.hostIp || '0.0.0.0', HostPort: String(b.hostPort) });
  return {
    Id: c.id,
    Created: iso(c.created),
    Path: argv[0] ?? '',
    Args: argv.slice(1),
    State: {
      Status: c.status,
      Running: c.status === 'running',
      Paused: c.status === 'paused',
      Restarting: c.status === 'restarting',
      OOMKilled: c.oomKilled,
      Dead: c.status === 'dead',
      Pid: c.pid,
      ExitCode: c.exitCode ?? 0,
      Error: '',
      StartedAt: iso(c.startedAt),
      FinishedAt: iso(c.finishedAt),
      ...(c.health ? { Health: { Status: c.health, FailingStreak: 0, Log: [] } } : {}),
    },
    Image: c.imageId,
    Name: `/${c.name}`,
    RestartCount: c.restartCount,
    Driver: 'overlayfs',
    Platform: 'linux',
    HostConfig: {
      Binds: c.mounts.filter((x) => x.type !== 'tmpfs').map((x) => `${x.source}:${x.target}${x.ro ? ':ro' : ''}`),
      NetworkMode: c.hostConfig.networkMode,
      PortBindings: Object.fromEntries(Object.entries(ports).filter(([, v]) => v)),
      RestartPolicy: { Name: restartPolicyName, MaximumRetryCount: c.hostConfig.restartPolicy.maximumRetryCount },
      AutoRemove: c.hostConfig.autoRemove,
      CapAdd: c.hostConfig.capAdd.length ? c.hostConfig.capAdd : null,
      CapDrop: c.hostConfig.capDrop.length ? c.hostConfig.capDrop : null,
      Privileged: c.hostConfig.privileged,
      ReadonlyRootfs: c.hostConfig.readonlyRootfs,
      SecurityOpt: c.hostConfig.securityOpt.length ? c.hostConfig.securityOpt : null,
      Memory: c.hostConfig.memory,
      NanoCpus: Math.round(c.hostConfig.cpus * 1e9),
      PidsLimit: c.hostConfig.pidsLimit,
      Init: c.hostConfig.init || null,
      LogConfig: { Type: c.hostConfig.logConfig.type, Config: c.hostConfig.logConfig.config },
      Tmpfs: c.hostConfig.tmpfs.length ? Object.fromEntries(c.hostConfig.tmpfs.map((t) => [t, ''])) : null,
      Sysctls: c.hostConfig.sysctls,
    },
    Mounts: c.mounts.map((x) => ({
      Type: x.type,
      ...(x.type === 'volume' ? { Name: x.source, Source: `/var/lib/docker/volumes/${x.source}/_data`, Driver: 'local' } : { Source: x.source }),
      Destination: x.target,
      Mode: x.ro ? 'ro' : '',
      RW: !x.ro,
      Propagation: x.type === 'bind' ? 'rprivate' : '',
    })),
    Config: {
      Hostname: c.config.Hostname,
      User: c.config.User ?? '',
      Tty: c.config.Tty,
      OpenStdin: c.config.OpenStdin,
      ExposedPorts: c.config.ExposedPorts ?? {},
      Env: c.config.Env ?? [],
      Cmd: c.config.Cmd,
      Image: c.image,
      WorkingDir: c.config.WorkingDir ?? '',
      Entrypoint: c.config.Entrypoint,
      Labels: c.labels,
      ...(c.config.StopSignal ? { StopSignal: c.config.StopSignal } : {}),
      ...(c.hostConfig.stopTimeout !== null ? { StopTimeout: c.hostConfig.stopTimeout } : {}),
      ...(c.config.Healthcheck ? { Healthcheck: c.config.Healthcheck } : {}),
    },
    NetworkSettings: {
      Ports: ports,
      Networks: Object.fromEntries(
        Object.entries(c.networks).map(([n, e]) => {
          const net = st.networks.find((x) => x.name === n);
          return [n, { Aliases: e.aliases.length ? e.aliases : null, NetworkID: net?.id ?? '', IPAddress: c.status === 'running' ? e.ip : '', Gateway: c.status === 'running' ? (net?.gateway ?? '') : '', MacAddress: e.mac, IPPrefixLen: e.ip ? 16 : 0, DNSNames: net && !net.builtin ? [c.name, c.id.slice(0, 12)] : null }];
        }),
      ),
    },
    SizeRw: upperSize(c),
  };
}

export function imageDoc(st: DockerSnapshot, img: ImageRec): Record<string, unknown> {
  const cfg = img.config.config;
  return {
    Id: img.id,
    RepoTags: img.repoTags,
    RepoDigests: img.repoDigests,
    Created: img.config.created,
    Config: {
      Env: cfg.Env ?? [],
      Cmd: cfg.Cmd ?? null,
      Entrypoint: cfg.Entrypoint ?? null,
      WorkingDir: cfg.WorkingDir ?? '',
      User: cfg.User ?? '',
      ExposedPorts: cfg.ExposedPorts ?? null,
      Labels: cfg.Labels ?? null,
      ...(cfg.StopSignal ? { StopSignal: cfg.StopSignal } : {}),
      ...(cfg.Healthcheck ? { Healthcheck: cfg.Healthcheck } : {}),
      ...(cfg.Volumes ? { Volumes: cfg.Volumes } : {}),
    },
    Architecture: img.config.architecture,
    ...(img.config.variant ? { Variant: img.config.variant } : {}),
    Os: img.config.os,
    Size: imageSize(st, img),
    RootFS: { Type: 'layers', Layers: img.layers },
    Metadata: { LastTagTime: '0001-01-01T00:00:00Z' },
  };
}

export function networkDoc(st: DockerSnapshot, n: NetworkRec): Record<string, unknown> {
  const containers: Record<string, unknown> = {};
  for (const c of st.containers) {
    const e = c.networks[n.name];
    if (e && c.status === 'running') containers[c.id] = { Name: c.name, MacAddress: e.mac, IPv4Address: e.ip ? `${e.ip}/16` : '', IPv6Address: '' };
  }
  return {
    Name: n.name,
    Id: n.id,
    Created: iso(n.created || Date.UTC(2026, 10, 18, 8, 0, 0)),
    Scope: 'local',
    Driver: n.driver,
    EnableIPv6: false,
    IPAM: { Driver: 'default', Options: {}, Config: n.subnet ? [{ Subnet: n.subnet, Gateway: n.gateway }] : [] },
    Internal: n.internal,
    Attachable: false,
    Containers: containers,
    Options: n.name === 'bridge' ? { 'com.docker.network.bridge.default_bridge': 'true', 'com.docker.network.bridge.enable_icc': 'true', 'com.docker.network.bridge.enable_ip_masquerade': 'true', 'com.docker.network.bridge.name': 'docker0' } : {},
    Labels: n.labels,
  };
}

export function volumeDoc(v: VolumeRec): Record<string, unknown> {
  return { CreatedAt: iso(v.created).replace(/\.\d+Z$/, 'Z'), Driver: 'local', Labels: v.labels, Mountpoint: `/var/lib/docker/volumes/${v.name}/_data`, Name: v.name, Options: null, Scope: 'local' };
}
