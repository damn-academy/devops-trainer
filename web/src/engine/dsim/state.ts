// The daemon's state (04 §11.1 engine/state.ts): images, the content store of
// layers, containers, networks, volumes, the build cache, the course
// registry and the event stream. Plain JSON, so it goes into machine
// snapshots and into facts as it is.

import type { ImageConfigBody, ImageConfigDoc } from './catalog';
import type { Layer, LayerFiles } from './layers';

export type ContainerStatus = 'created' | 'running' | 'paused' | 'restarting' | 'exited' | 'dead' | 'removing';

export interface ImageRec {
  /** sha256 of the config document: the image ID. */
  id: string;
  repoTags: string[];
  repoDigests: string[];
  /** diff_ids, bottom-up; the layers themselves are in DockerState.layers. */
  layers: string[];
  config: ImageConfigDoc;
  platform: string;
  /** Model time (ms) the image was created. */
  created: number;
  /** The manifest digest it was pulled by, if any. */
  manifestDigest?: string;
}

export interface PortBinding {
  hostIp: string;
  hostPort: number;
  containerPort: number;
  proto: 'tcp' | 'udp';
}

export interface MountRec {
  type: 'volume' | 'bind' | 'tmpfs';
  /** Volume name or host path; empty for tmpfs. */
  source: string;
  target: string;
  ro: boolean;
}

export interface LogLine {
  t: number;
  s: 'stdout' | 'stderr';
  line: string;
}

/** What the main process of a container does (04 §11.4), resolved from its config when it starts. */
export interface ProgramRun {
  /** server: keeps running and answers on ports; oneshot: runs and exits; idle: keeps running quietly. */
  kind: 'server' | 'oneshot' | 'idle';
  /** Process name shown by ps (comm). */
  comm: string;
  argv: string[];
  exitCode?: number;
  listens: { port: number; bind: string; proto: 'tcp' | 'udp' }[];
  /** Signals the program has handlers for. */
  handles: string[];
  /** How the program answers HTTP: from files under a root, or a fixed body. */
  http?: { root?: string; body?: string; contentType?: string };
  memoryMb: number;
  readyAfterMs: number;
  /** PID 1 is a shell that started the program as a child (shell form with several commands). */
  shellParent?: boolean;
  /** The program forked into the background and the foreground process exited (CMD service nginx start). */
  daemonized?: boolean;
  /** A human note when the simulator does not know the program. */
  note?: string;
}

export interface ContainerProc {
  nspid: number;
  hostPid: number;
  comm: string;
  argv: string[];
  ppid: number;
  state: 'R' | 'S' | 'Z';
}

export interface ContainerRec {
  id: string;
  name: string;
  /** The image reference as given: nginx:1.30-alpine. */
  image: string;
  imageId: string;
  created: number;
  status: ContainerStatus;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  oomKilled: boolean;
  restartCount: number;
  /** How long the last `docker stop` took, in model milliseconds. */
  stopDurationMs: number | null;
  /** The last stop was a manual stop (unless-stopped does not restart it). */
  stoppedByUser: boolean;
  pid: number;
  procs: ContainerProc[];
  config: ImageConfigBody & { Hostname: string; Tty: boolean; OpenStdin: boolean; Image: string };
  hostConfig: {
    memory: number;
    pidsLimit: number | null;
    cpus: number;
    init: boolean;
    autoRemove: boolean;
    restartPolicy: { name: 'no' | 'on-failure' | 'always' | 'unless-stopped'; maximumRetryCount: number };
    portBindings: PortBinding[];
    networkMode: string;
    readonlyRootfs: boolean;
    capAdd: string[];
    capDrop: string[];
    privileged: boolean;
    securityOpt: string[];
    stopTimeout: number | null;
    stopSignal: string | null;
    user: string;
    logConfig: { type: string; config: Record<string, string> };
    tmpfs: string[];
    sysctls: Record<string, string>;
  };
  networks: Record<string, { ip: string; aliases: string[]; mac: string }>;
  mounts: MountRec[];
  /** The writable layer (upperdir). */
  upper: LayerFiles;
  /** tmpfs contents by target (lost on stop). */
  tmpfsData: Record<string, LayerFiles>;
  logs: LogLine[];
  program: ProgramRun | null;
  health: 'starting' | 'healthy' | 'unhealthy' | null;
  compose?: { project: string; service: string; number: number };
  labels: Record<string, string>;
  /** A build step's container: its lower layers are the stage so far, not an image. */
  buildLayers?: string[];
}

export interface NetworkRec {
  id: string;
  name: string;
  driver: 'bridge' | 'host' | 'null';
  subnet: string;
  gateway: string;
  internal: boolean;
  builtin: boolean;
  created: number;
  labels: Record<string, string>;
}

export interface VolumeRec {
  name: string;
  created: number;
  files: LayerFiles;
  labels: Record<string, string>;
  /** Content was copied from the image the first time it was mounted. */
  populated: boolean;
}

export interface BuildStepRec {
  n: number;
  stage: string;
  text: string;
  cached: boolean;
  ms: number;
  layer: boolean;
  mounts?: string[];
}

export interface BuildRec {
  tags: string[];
  imageId: string;
  size: number;
  steps: BuildStepRec[];
  contextBytes: number;
  at: number;
  ok: boolean;
}

export interface RegistryLog {
  method: string;
  path: string;
  status: number;
}

export interface RegistryState {
  /** repo (registry.lab/learner/web) → tag → manifest digest. */
  repos: Record<string, Record<string, string>>;
  /** manifest or index digest → JSON text. */
  manifests: Record<string, string>;
  /** blob digests the registry holds (configs and layers). */
  blobs: string[];
  log: RegistryLog[];
}

export interface DockerEvent {
  t: number;
  type: 'container' | 'image' | 'network' | 'volume';
  action: string;
  id: string;
  name?: string;
  attrs?: Record<string, string>;
}

export interface DockerSnapshot {
  v: 1;
  images: ImageRec[];
  layers: Record<string, Layer>;
  containers: ContainerRec[];
  networks: NetworkRec[];
  volumes: VolumeRec[];
  buildCache: Record<string, { diffId: string | null; createdBy: string }>;
  builds: BuildRec[];
  registry: RegistryState;
  events: DockerEvent[];
  seq: number;
  /** Host ports taken by other programs (not Docker): "port is already allocated" drills. */
  hostPortsBusy: number[];
  /** Host sysctl net.ipv4.ip_forward. */
  ipForward: boolean;
  daemon: { running: boolean; dockerdPid: number; containerdPid: number };
}

export function emptyState(): DockerSnapshot {
  return {
    v: 1,
    images: [],
    layers: {},
    containers: [],
    networks: [
      { id: 'b1f0a8c4e2d94f6b9a3c7e5d1f2a4b6c8d0e1f3a5b7c9d2e4f6a8b0c1d3e5f7a', name: 'bridge', driver: 'bridge', subnet: '172.17.0.0/16', gateway: '172.17.0.1', internal: false, builtin: true, created: 0, labels: {} },
      { id: 'c2e1b9d5f3a04e7c8b2d6f4a0e1c3b5d7f9a2c4e6b8d0f1a3c5e7b9d2f4a6c8e', name: 'host', driver: 'host', subnet: '', gateway: '', internal: false, builtin: true, created: 0, labels: {} },
      { id: 'd3f2c0e6a4b15f8d9c3e7a5b1f2d4c6e8a0b3d5f7c9e1a2b4d6f8a0c2e4b6d8f', name: 'none', driver: 'null', subnet: '', gateway: '', internal: false, builtin: true, created: 0, labels: {} },
    ],
    volumes: [],
    buildCache: {},
    builds: [],
    registry: { repos: {}, manifests: {}, blobs: [], log: [] },
    events: [],
    seq: 0,
    hostPortsBusy: [],
    ipForward: true,
    daemon: { running: false, dockerdPid: 0, containerdPid: 0 },
  };
}

/** The engine state attached to a machine as `machine.ext('docker')`; Snapshotable. */
export class DockerState {
  s: DockerSnapshot = emptyState();
  /** Real seconds per model second while `docker stop` waits (tests set 0). */
  timeScale = 0.3;
  snapshot(): DockerSnapshot {
    return JSON.parse(JSON.stringify(this.s)) as DockerSnapshot;
  }
  restore(x: unknown): void {
    const v = x as DockerSnapshot;
    if (v && v.v === 1) this.s = JSON.parse(JSON.stringify(v)) as DockerSnapshot;
  }
}
