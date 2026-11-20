// The images of the course registry (05 §5.2) as behaviour, not bytes: what
// a container started from each one does on a simulated node. A tag that is
// not here does not exist in the registry (ErrImagePull → ImagePullBackOff).

export interface ImageBehaviour {
  /** Size reported by "Successfully pulled image … Image size: N bytes". */
  size: number;
  /** Ports the process listens on (TCP). */
  ports: number[];
  /** HTTP paths that answer 200; anything else is 404. Empty: not an HTTP server. */
  http?: string[];
  /** The process exits by itself after this many ms (with exitCode). */
  exitAfter?: number;
  exitCode?: number;
  /** Lines printed to stdout at start; {pod} {ip} {version} {env:X} are filled in. */
  logs: string[];
  /** The last line before a crash (stderr). */
  crashLine?: string;
  /** Milliseconds before the server answers (startup probe lesson). */
  warmup?: number;
  /** Memory the process allocates: from the env var MEM_MB, or a constant in MiB. */
  memMiB?: number | 'MEM_MB';
  /** The body of GET /. */
  body?: string;
  /** The process ignores SIGTERM (waits for SIGKILL after the grace period). */
  ignoresTerm?: boolean;
  /** An exit code and duration from env (trainer/job). */
  fromEnv?: boolean;
  /** Tools inside the image (kubectl exec): curl, nslookup, sh… */
  tools: string[];
  /** A server whose answers come from the cluster state (the Prometheus HTTP API). */
  handler?: 'prometheus';
}

const webLogs = ['listening on :{port}', 'version {version}, greeting "{env:GREETING}"'];
const webTools = ['sh', 'cat', 'ls', 'env', 'printenv', 'hostname', 'echo', 'wget'];

export const IMAGES: Record<string, ImageBehaviour> = {
  'trainer/web:1.0': { size: 4_718_592, ports: [80], http: ['/', '/healthz', '/ready'], logs: webLogs, body: 'Hello from {pod} ({ip}), version 1.0', tools: webTools },
  'trainer/web:1.1': { size: 4_734_976, ports: [80], http: ['/', '/healthz', '/ready'], logs: webLogs, body: 'Hello from {pod} ({ip}), version 1.1', tools: webTools },
  'trainer/web:2.0': { size: 4_751_360, ports: [80], http: ['/', '/healthz', '/ready'], logs: ['starting version 2.0'], exitAfter: 3000, exitCode: 1, crashLine: 'panic: config not found', tools: webTools },
  'trainer/web:2.1': { size: 4_767_744, ports: [80], http: ['/', '/healthz', '/ready'], logs: ['loading cache (this takes 40s)'], warmup: 40_000, body: 'Hello from {pod} ({ip}), version 2.1', tools: webTools },
  'trainer/web:8080': { size: 4_718_592, ports: [8080], http: ['/', '/healthz', '/ready'], logs: webLogs, body: 'Hello from {pod} ({ip}), version 1.0', tools: webTools },
  'trainer/client:1.0': { size: 9_437_184, ports: [], logs: [], tools: ['sh', 'curl', 'nslookup', 'dig', 'cat', 'ls', 'env', 'printenv', 'hostname', 'echo', 'wget', 'nc'] },
  'trainer/hog:1.0': { size: 3_145_728, ports: [], logs: ['allocating {env:MEM_MB} MiB'], memMiB: 'MEM_MB', tools: ['sh', 'cat'] },
  'trainer/job:1.0': { size: 2_097_152, ports: [], logs: ['working for {env:DURATION} seconds'], fromEnv: true, tools: ['sh'] },
  'busybox:1.37': { size: 2_202_009, ports: [], logs: [], tools: ['sh', 'cat', 'ls', 'env', 'printenv', 'hostname', 'echo', 'wget', 'nslookup', 'sleep'] },
  'nginx:1.27': { size: 72_351_744, ports: [80], http: ['/'], logs: ['/docker-entrypoint.sh: Configuration complete; ready for start up'], body: '<!DOCTYPE html><title>Welcome to nginx!</title>', tools: ['sh', 'cat', 'ls', 'env', 'printenv', 'hostname', 'echo', 'curl'] },
  'nginx:1.29': { size: 72_351_744, ports: [80], http: ['/'], logs: ['/docker-entrypoint.sh: Configuration complete; ready for start up'], body: '<!DOCTYPE html><title>Welcome to nginx!</title>', tools: ['sh', 'cat', 'ls', 'env', 'printenv', 'hostname', 'echo', 'curl'] },
  'rancher/mirrored-coredns-coredns:1.12.3': { size: 21_430_272, ports: [53, 8080, 8181, 9153], http: ['/health', '/ready'], logs: ['.:53', '[INFO] plugin/reload: Running configuration SHA512 = 1b226df79860026c6a52e67daa10d7f0d57ec5b023288ec00c5e05f93523c894564e15b91770d3a07ae1cfbe861d15b37d4a0027e69c546ab112970993a3b03b', 'CoreDNS-1.12.3', 'linux/amd64, go1.24.6, 4b8d1a4'], tools: [] },
  // Cluster add-ons (the layered constructor).
  'quay.io/metallb/controller:v0.15.2': { size: 31_457_280, ports: [7472], logs: ['{"caller":"main.go:159","msg":"MetalLB controller starting version 0.15.2"}'], tools: [] },
  'quay.io/metallb/speaker:v0.15.2': { size: 53_477_376, ports: [7472], logs: ['{"caller":"main.go:115","msg":"MetalLB speaker starting version 0.15.2"}'], tools: [] },
  'traefik:v3.6.1': { size: 52_428_800, ports: [8000, 8443, 8080], http: ['/ping'], logs: ['INF Traefik version 3.6.1 built on 2025-11-18T09:00:00Z version=3.6.1', 'INF Starting provider *gateway.Provider', 'INF Starting provider *ingress.Provider'], tools: ['sh', 'cat', 'ls', 'env', 'wget'] },
  'registry.k8s.io/sig-storage/hostpathplugin:v1.17.0': { size: 32_505_856, ports: [9898], http: ['/healthz'], logs: ['Driver: hostpath.csi.k8s.io', 'Version: v1.17.0'], tools: [] },
  'quay.io/jetstack/cert-manager-controller:v1.19.1': { size: 39_845_888, ports: [9402], logs: ['"starting controller" version="v1.19.1"'], tools: [] },
  'quay.io/jetstack/cert-manager-webhook:v1.19.1': { size: 33_554_432, ports: [10250], logs: ['"serving webhook" address=":10250"'], tools: [] },
  'registry.k8s.io/metrics-server/metrics-server:v0.8.0': { size: 20_971_520, ports: [10250], logs: ['"Serving securely on [::]:10250"'], tools: [] },
  'ghcr.io/fluxcd/source-controller:v1.7.3': { size: 44_040_192, ports: [9090], logs: ['{"level":"info","msg":"starting manager"}'], tools: [] },
  'ghcr.io/fluxcd/kustomize-controller:v1.7.2': { size: 41_943_040, ports: [8080], logs: ['{"level":"info","msg":"starting manager"}'], tools: [] },
  'quay.io/prometheus/prometheus:v3.7.3': { size: 136_314_880, ports: [9090], http: ['/-/ready', '/-/healthy', '/api/v1/targets', '/api/v1/alerts', '/api/v1/query'], handler: 'prometheus', logs: ['level=INFO source=main.go:1120 msg="Server is ready to receive web requests."'], tools: ['sh', 'cat', 'ls', 'env', 'wget'] },
  'quay.io/prometheus/node-exporter:v1.10.2': { size: 24_117_248, ports: [9100], http: ['/metrics'], logs: ['level=INFO source=tls_config.go:347 msg="Listening on" address=[::]:9100'], tools: [] },
  'registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.17.0': { size: 41_943_040, ports: [8080, 8081], http: ['/metrics', '/healthz'], logs: ['"Starting kube-state-metrics"'], tools: [] },
  'redis:8': { size: 52_428_800, ports: [6379], logs: ['Ready to accept connections tcp'], tools: ['sh', 'cat', 'ls', 'env'] },
};

/** Normalise a reference: 'nginx' → 'nginx:latest', 'docker.io/trainer/web:1.0' → 'trainer/web:1.0'. */
export function imageRef(ref: string): string {
  let r = ref.trim().replace(/^docker\.io\//, '').replace(/^library\//, '');
  if (r.includes('@')) return r;
  const slash = r.lastIndexOf('/');
  if (!r.slice(slash + 1).includes(':')) r += ':latest';
  return r;
}

/** Aliases: busybox and the newest tags. */
const ALIASES: Record<string, string> = {
  'busybox:latest': 'busybox:1.37',
  'nginx:latest': 'nginx:1.29',
  'redis:latest': 'redis:8',
  'trainer/client:latest': 'trainer/client:1.0',
  'trainer/hog:latest': 'trainer/hog:1.0',
  'trainer/job:latest': 'trainer/job:1.0',
};

export function lookupImage(ref: string): ImageBehaviour | undefined {
  const r = imageRef(ref);
  return IMAGES[r] ?? IMAGES[ALIASES[r] ?? ''];
}

/** The fully qualified name containerd prints in pull errors. */
export function fqImage(ref: string): string {
  const r = imageRef(ref);
  const first = r.split('/')[0];
  if (r.includes('/') && (first.includes('.') || first.includes(':'))) return r;
  return `docker.io/${r.includes('/') ? r : `library/${r}`}`;
}

/** A digest stable per reference (status.containerStatuses[].imageID). */
export function imageDigest(ref: string, hash: (s: string) => string): string {
  return `${fqImage(ref).replace(/:[^:/]+$/, '')}@sha256:${hash(imageRef(ref))}`;
}
