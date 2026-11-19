// Facts of the Docker simulator (04 §15.5–15.6, dt.facts/v1): the scopes
// `containers`, `images`, `networks`, `volumes`, `builds`, `registry`,
// `http` and `docker`. Field names follow 15.5, so the same predicates can
// later run against `trainer-check docker` on a real VM.

import type { FactsProvider, SimMachineApi } from '../../core/types';
import { dockerOf, imageSize, refreshSync, upperSize } from './engine';
import { httpFacts } from './http';
import { dockerDiff } from './rootfs';

const scope = (name: string, collect: (m: SimMachineApi) => unknown): FactsProvider => ({ scope: name, collect });

export const DSIM_FACTS: FactsProvider[] = [
  scope('containers', (m) => {
    const st = dockerOf(m).s;
    refreshSync(m, st);
    return st.containers.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      imageId: c.imageId,
      state: c.status,
      running: c.status === 'running',
      exitCode: c.exitCode,
      restartCount: c.restartCount,
      oomKilled: c.oomKilled,
      stopDurationMs: c.stopDurationMs,
      sizeRw: upperSize(c),
      health: c.health,
      pid: c.pid,
      procs: c.procs.map((p) => ({ pid: p.nspid, hostPid: p.hostPid, cmd: p.comm, state: p.state })),
      pid1: c.procs[0]?.comm ?? null,
      ports: c.hostConfig.portBindings.map((b) => ({ host: `${b.hostIp || '0.0.0.0'}:${b.hostPort}`, hostPort: b.hostPort, container: `${b.containerPort}/${b.proto}`, containerPort: b.containerPort })),
      networks: Object.fromEntries(Object.entries(c.networks).map(([n, e]) => [n, { ip: e.ip, aliases: e.aliases }])),
      networkNames: Object.keys(c.networks),
      mounts: c.mounts.map((x) => ({ type: x.type, source: x.source, target: x.target, ro: x.ro })),
      config: { User: c.config.User ?? '', Cmd: c.config.Cmd ?? [], Entrypoint: c.config.Entrypoint ?? [], Env: c.config.Env ?? [], StopSignal: c.config.StopSignal ?? null, WorkingDir: c.config.WorkingDir ?? '', Healthcheck: c.config.Healthcheck ?? null, Labels: c.labels },
      hostConfig: {
        memory: c.hostConfig.memory,
        pidsLimit: c.hostConfig.pidsLimit,
        cpus: c.hostConfig.cpus,
        init: c.hostConfig.init,
        stopTimeout: c.hostConfig.stopTimeout,
        stopSignal: c.hostConfig.stopSignal,
        restartPolicy: c.hostConfig.restartPolicy.name,
        readonly: c.hostConfig.readonlyRootfs,
        capAdd: c.hostConfig.capAdd,
        capDrop: c.hostConfig.capDrop,
        privileged: c.hostConfig.privileged,
        securityOpt: c.hostConfig.securityOpt,
        user: c.hostConfig.user,
        networkMode: c.hostConfig.networkMode,
        autoRemove: c.hostConfig.autoRemove,
        logConfig: c.hostConfig.logConfig,
      },
      program: c.program ? { kind: c.program.kind, comm: c.program.comm, listens: c.program.listens, handles: c.program.handles, shellParent: !!c.program.shellParent } : null,
      logs: c.logs.map((l) => l.line).join('\n'),
      diff: dockerDiff(st, c),
      compose: c.compose ?? null,
    }));
  }),
  scope('images', (m) => {
    const st = dockerOf(m).s;
    return st.images.map((i) => ({
      id: i.id,
      tags: i.repoTags,
      ref: i.repoTags[0] ?? '<none>:<none>',
      digests: i.repoDigests,
      dangling: !i.repoTags.length,
      platform: i.platform,
      size: imageSize(st, i),
      layers: i.layers.length,
      user: i.config.config.User ?? '',
      cmd: i.config.config.Cmd ?? [],
      entrypoint: i.config.config.Entrypoint ?? [],
      env: i.config.config.Env ?? [],
      healthcheck: !!i.config.config.Healthcheck,
      stopSignal: i.config.config.StopSignal ?? null,
      history: i.config.history.map((h) => h.created_by),
      exposed: Object.keys(i.config.config.ExposedPorts ?? {}),
    }));
  }),
  scope('networks', (m) => {
    const st = dockerOf(m).s;
    return st.networks.map((n) => ({ name: n.name, id: n.id, driver: n.driver, subnet: n.subnet, builtin: n.builtin, internal: n.internal, containers: st.containers.filter((c) => c.networks[n.name]).map((c) => c.name) }));
  }),
  scope('volumes', (m) => {
    const st = dockerOf(m).s;
    return st.volumes.map((v) => ({ name: v.name, files: Object.keys(v.files), usedBy: st.containers.filter((c) => c.mounts.some((x) => x.type === 'volume' && x.source === v.name)).map((c) => c.name), anonymous: /^[0-9a-f]{64}$/.test(v.name) }));
  }),
  scope('builds', (m) => dockerOf(m).s.builds.map((b) => ({ ...b, cachedSteps: b.steps.filter((s) => s.cached).map((s) => s.text), rebuiltSteps: b.steps.filter((s) => !s.cached && s.layer).map((s) => s.text) }))),
  scope('registry', (m) => {
    const r = dockerOf(m).s.registry;
    return { repos: Object.fromEntries(Object.entries(r.repos).map(([k, v]) => [k, { tags: Object.keys(v), digests: v }])), repoNames: Object.keys(r.repos), log: r.log.slice(-60) };
  }),
  scope('http', (m) => httpFacts(m)),
  scope('docker', (m) => {
    const st = dockerOf(m).s;
    return { running: st.daemon.running, events: st.events.slice(-60).map((e) => ({ type: e.type, action: e.action, name: e.name ?? e.id })), danglingImages: st.images.filter((i) => !i.repoTags.length).length, buildCacheEntries: Object.keys(st.buildCache).length };
  }),
];
