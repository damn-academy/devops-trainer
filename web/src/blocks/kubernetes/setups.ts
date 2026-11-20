// Scenario files and cluster setups shared by the lessons, the placement
// check and the quizzes. Manifests are what a learner would write by hand.

import type { TerminalSetup } from '../../core/types';

export const WEB_POD = `apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  containers:
  - name: web
    image: trainer/web:1.0
    ports:
    - containerPort: 80
`;

export const WEB_RS = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
        ports:
        - containerPort: 80
`;

export const WEB_DEPLOY = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 4
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
        ports:
        - containerPort: 80
        readinessProbe:
          httpGet:
            path: /ready
            port: 80
`;

export const WEB_SVC = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
`;

export const CLIENT_POD = `apiVersion: v1
kind: Pod
metadata:
  name: client
  labels:
    app: client
spec:
  containers:
  - name: client
    image: trainer/client:1.0
    command: ["sleep", "infinity"]
`;

const deploy = (name: string, ns: string, replicas: number, image: string, labels: Record<string, string>, port = 80) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
${Object.entries(labels).map(([k, v]) => `      ${k}: ${v}`).join('\n')}
  template:
    metadata:
      labels:
${Object.entries(labels).map(([k, v]) => `        ${k}: ${v}`).join('\n')}
    spec:
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: ${port}
`;

const svc = (name: string, ns: string, selector: Record<string, string>, port = 80, target: number | string = 80) => `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  selector:
${Object.entries(selector).map(([k, v]) => `    ${k}: ${v}`).join('\n')}
  ports:
  - port: ${port}
    targetPort: ${target}
`;

const ns = (name: string) => `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${name}\n`;
const client = (namespace: string) => CLIENT_POD.replace('  name: client\n', `  name: client\n  namespace: ${namespace}\n`);

/** A cluster with nothing of the learner's yet. */
export const EMPTY: TerminalSetup = { hostname: 'laptop', ext: { k8s: {} } };

/** The first pod lesson: a manifest file waits in the home directory. */
export const FIRST_POD: TerminalSetup = { hostname: 'laptop', files: [{ path: '~/pod.yaml', content: WEB_POD }], ext: { k8s: {} } };

export const RS_LAB: TerminalSetup = { hostname: 'laptop', files: [{ path: '~/rs.yaml', content: WEB_RS }], ext: { k8s: {} } };

/** The lab's Deployment: minReadySeconds keeps a pod that was ready for a moment and then crashed from counting as available. */
export const WEB_DEPLOY_LAB = WEB_DEPLOY.replace('spec:\n  replicas: 4\n', 'spec:\n  replicas: 4\n  minReadySeconds: 10\n');

export const DEPLOY_LAB: TerminalSetup = { hostname: 'laptop', files: [{ path: '~/web.yaml', content: WEB_DEPLOY_LAB }], ext: { k8s: {} } };

/** The Deployment already rolled out to revision 2 (1.0 → 1.1), for history and undo tasks. */
export const DEPLOY_HISTORY: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [WEB_DEPLOY, WEB_DEPLOY.replace('trainer/web:1.0', 'trainer/web:1.1')], settle: 120_000 } },
};

export const ARCH_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    { path: '~/big.yaml', content: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: big\nspec:\n  containers:\n  - name: big\n    image: trainer/web:1.0\n    resources:\n      requests:\n        memory: 6Gi\n' },
  ],
  ext: { k8s: { manifests: [deploy('web', 'default', 3, 'trainer/web:1.0', { app: 'web' })] } },
};

export const SERVICE_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [deploy('web', 'default', 3, 'trainer/web:1.0', { app: 'web' }), CLIENT_POD] } },
};

export const SERVICE_BROKEN: TerminalSetup = {
  hostname: 'laptop',
  ext: {
    k8s: {
      manifests: [ns('prod'), deploy('api', 'prod', 2, 'trainer/web:1.0', { app: 'api-v2' }), svc('api', 'prod', { app: 'api' }), client('prod')],
    },
  },
};

export const DNS_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [ns('shop'), ns('prod'), deploy('web', 'shop', 2, 'trainer/web:1.0', { app: 'web' }), svc('web', 'shop', { app: 'web' }), deploy('api', 'prod', 1, 'trainer/web:1.0', { app: 'api' }), svc('api', 'prod', { app: 'api' }), client('shop')] } },
};

export const INGRESS_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [deploy('web', 'default', 2, 'trainer/web:1.0', { app: 'web' }), WEB_SVC] } },
};

/** Four breaks, one per ladder step: DNS (wrong namespace), endpoints (selector), port (targetPort), policy. */
export const TROUBLE_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: {
    k8s: {
      manifests: [
        ns('shop'),
        ns('pay'),
        deploy('web', 'shop', 2, 'trainer/web:1.0', { app: 'web' }),
        svc('web', 'shop', { app: 'web' }, 80, 8080),
        deploy('pay', 'pay', 2, 'trainer/web:1.0', { app: 'pay' }),
        svc('pay', 'pay', { app: 'pay' }),
        `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: only-shop-frontend\n  namespace: pay\nspec:\n  podSelector:\n    matchLabels:\n      app: pay\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: shop\n      podSelector:\n        matchLabels:\n          role: frontend\n`,
        client('shop'),
      ],
    },
  },
};

export const CONFIG_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    { path: '~/app.env', content: 'GREETING=Привет\nLOG_LEVEL=info\n' },
    {
      path: '~/web-env.yaml',
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
        envFrom:
        - configMapRef:
            name: web-config
        volumeMounts:
        - name: config
          mountPath: /etc/web
      volumes:
      - name: config
        configMap:
          name: web-config
`,
    },
  ],
  ext: { k8s: {} },
};

export const HEALTH_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    {
      path: '~/hog.yaml',
      content: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: hog\nspec:\n  containers:\n  - name: hog\n    image: trainer/hog:1.0\n    env:\n    - name: MEM_MB\n      value: "300"\n    resources:\n      requests:\n        memory: 128Mi\n      limits:\n        memory: 256Mi\n',
    },
  ],
  ext: {
    k8s: {
      manifests: [
        `apiVersion: v1\nkind: Pod\nmetadata:\n  name: crash\n  labels:\n    app: crash\nspec:\n  containers:\n  - name: crash\n    image: trainer/web:2.0\n`,
        `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: shop\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: shop\n  template:\n    metadata:\n      labels:\n        app: shop\n    spec:\n      containers:\n      - name: shop\n        image: trainer/web:1.0\n        readinessProbe:\n          httpGet:\n            path: /ready\n            port: 8080\n          periodSeconds: 5\n`,
        svc('shop', 'default', { app: 'shop' }),
      ],
      settle: 60_000,
    },
  },
};

export const EXAM_LIKE: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [ns('exam'), `apiVersion: v1\nkind: Pod\nmetadata:\n  name: report\n  namespace: exam\nspec:\n  containers:\n  - name: report\n    image: trainer/web:1.O\n`] } },
};

/** NetworkPolicy lab: pay is open to everyone; three pods named client, all role=frontend — shop/client, dev/client (other namespace) and pay/client (the policy's own namespace, where the OR form lets it in) — and a web Service in dev. */
const labelled = (namespace: string, labels: Record<string, string>) => client(namespace).replace('    app: client\n', `    app: client\n${Object.entries(labels).map(([k, v]) => `    ${k}: ${v}\n`).join('')}`);
export const NETPOL_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: {
    k8s: {
      manifests: [ns('shop'), ns('pay'), ns('dev'), deploy('pay', 'pay', 2, 'trainer/web:1.0', { app: 'pay' }), svc('pay', 'pay', { app: 'pay' }), deploy('web', 'dev', 1, 'trainer/web:1.0', { app: 'web' }), svc('web', 'dev', { app: 'web' }), labelled('shop', { role: 'frontend' }), labelled('dev', { role: 'frontend' }), labelled('pay', { role: 'frontend' })],
    },
  },
};

/** CoreDNS scaled to zero: every name fails, every IP works. */
export const DNS_BROKEN: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [ns('shop'), deploy('web', 'shop', 2, 'trainer/web:1.0', { app: 'web' }), svc('web', 'shop', { app: 'web' }), client('shop')], kubectl: ['kubectl -n kube-system scale deployment coredns --replicas=0'] } },
};

export { labelled };
export { deploy, svc, ns, client };

// ── Data that outlives a pod (k8s-1.storage) ──

const pvc = (name: string, cls?: string) => `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${name}\nspec:\n${cls ? `  storageClassName: ${cls}\n` : ''}  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi\n`;
const withClaim = (name: string, claim: string, image: string) =>
  `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: ${name}\n        image: ${image}\n        volumeMounts:\n        - name: data\n          mountPath: /data\n      volumes:\n      - name: data\n        persistentVolumeClaim:\n          claimName: ${claim}\n`;

/** The database runs on its claim already; a colleague's reports app waits on a claim for a StorageClass that does not exist. */
export const STORAGE_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    { path: '~/db.yaml', content: `${pvc('data')}---\n${withClaim('db', 'data', 'redis:8')}` },
    { path: '~/reports.yaml', content: `${pvc('reports', 'fast')}---\n${withClaim('reports', 'reports', 'trainer/web:1.0')}` },
  ],
  ext: { k8s: { addons: ['csi-hostpath'], manifests: [pvc('data'), withClaim('db', 'data', 'redis:8'), pvc('reports', 'fast'), withClaim('reports', 'reports', 'trainer/web:1.0')] } },
};

// ── Scaling by load (k8s-1.scaling) ──

export const WEB_HPA = `apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: web\n  minReplicas: 1\n  maxReplicas: 6\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 50\n`;

/** metrics-server is installed; Deployment web has no CPU request yet, so an HPA on it cannot compute utilisation. */
export const SCALING_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [{ path: '~/hpa.yaml', content: WEB_HPA }],
  ext: { k8s: { addons: ['metrics-server'], manifests: [deploy('web', 'default', 1, 'trainer/web:1.0', { app: 'web' })] } },
};

// ── The way in through a controller (k8s-1.ingress) ──

const route = (gateway: string) => `apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: web\nspec:\n  parentRefs:\n  - name: ${gateway}\n    namespace: traefik\n  hostnames:\n  - shop.example\n  rules:\n  - backendRefs:\n    - name: web\n      port: 80\n`;
const blogIngress = (cls: string) => `apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: blog\nspec:\n  ingressClassName: ${cls}\n  rules:\n  - host: blog.example\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: web\n            port:\n              number: 80\n`;

/** MetalLB and Traefik are installed; the files a colleague wrote point at a Gateway and an IngressClass that do not exist. */
export const GATEWAY_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    { path: '~/route.yaml', content: route('shop-gateway') },
    { path: '~/blog.yaml', content: blogIngress('nginx') },
  ],
  ext: { k8s: { addons: ['metallb', 'traefik'], manifests: [deploy('web', 'default', 2, 'trainer/web:1.0', { app: 'web' }), WEB_SVC] } },
};

// ── Access rights (k8s-1.access) ──

const rbacApi = 'rbac.authorization.k8s.io/v1';

/** The shop runs in prod, the developers try things in dev; nobody but the administrator has rights yet. */
export const ACCESS_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: { k8s: { manifests: [ns('prod'), ns('dev'), deploy('web', 'prod', 2, 'trainer/web:1.0', { app: 'web' }), deploy('web', 'dev', 1, 'trainer/web:1.0', { app: 'web' })] } },
};

/** The status page the platform team wants to run in prod: it reads the list of pods through the API with its own service account. */
export const STATUS_POD = `apiVersion: v1
kind: Pod
metadata:
  name: status-page
  namespace: prod
spec:
  serviceAccountName: status-reader
  containers:
  - name: status
    image: trainer/client:1.0
    command: ["sleep", "infinity"]
`;

export const CI_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [{ path: '~/status.yaml', content: STATUS_POD }],
  ext: { k8s: { manifests: [ns('prod'), ns('dev'), deploy('web', 'prod', 2, 'trainer/web:1.0', { app: 'web' }), deploy('web', 'dev', 1, 'trainer/web:1.0', { app: 'web' })] } },
};

/**
 * Two colleagues' attempts that do not work: a RoleBinding for the developer
 * written into namespace default instead of prod, and a ClusterRole for the
 * monitoring account granted through a RoleBinding, which limits it to one namespace.
 */
export const RBAC_BROKEN: TerminalSetup = {
  hostname: 'laptop',
  ext: {
    k8s: {
      manifests: [
        ns('prod'),
        ns('dev'),
        ns('monitoring'),
        deploy('web', 'prod', 2, 'trainer/web:1.0', { app: 'web' }),
        deploy('web', 'dev', 1, 'trainer/web:1.0', { app: 'web' }),
        `apiVersion: ${rbacApi}\nkind: Role\nmetadata:\n  name: log-reader\n  namespace: prod\nrules:\n- apiGroups: [""]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch]\n`,
        `apiVersion: ${rbacApi}\nkind: RoleBinding\nmetadata:\n  name: developer-logs\n  namespace: default\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: log-reader\nsubjects:\n- kind: User\n  apiGroup: rbac.authorization.k8s.io\n  name: developer\n`,
        `apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: pod-watcher\n  namespace: monitoring\n`,
        `apiVersion: ${rbacApi}\nkind: ClusterRole\nmetadata:\n  name: pod-lister\nrules:\n- apiGroups: [""]\n  resources: [pods]\n  verbs: [get, list, watch]\n`,
        `apiVersion: ${rbacApi}\nkind: RoleBinding\nmetadata:\n  name: pod-watcher\n  namespace: monitoring\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: ClusterRole\n  name: pod-lister\nsubjects:\n- kind: ServiceAccount\n  name: pod-watcher\n  namespace: monitoring\n`,
      ],
    },
  },
};

// ── StatefulSets (k8s-1.storage) ──

const claimNoClass = (name: string) => `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${name}\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi\n`;

/** The class the administrator had: the right provisioner, but without the default mark. */
export const HOSTPATH_CLASS = `apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: hostpath\nprovisioner: hostpath.csi.k8s.io\nreclaimPolicy: Retain\nvolumeBindingMode: Immediate\n`;

/** The CSI driver runs, but its StorageClass was deleted during a reinstall; a claim without a class waits. */
export const NO_CLASS_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [
    { path: '~/notes.yaml', content: claimNoClass('notes') },
    { path: '~/class.yaml', content: HOSTPATH_CLASS },
  ],
  ext: { k8s: { addons: ['csi-hostpath'], kubectl: ['kubectl delete storageclass csi-hostpath-sc', 'kubectl apply -f /home/learner/notes.yaml'] } },
};

/** A headless Service and a StatefulSet of three web servers, each with a claim of its own. */
export const statefulWeb = (name = 'web', replicas = 3, image = 'trainer/web:1.0') => `apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  clusterIP: None
  selector:
    app: ${name}
  ports:
  - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
spec:
  serviceName: ${name}
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: 80
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 1Gi
`;

export const STS_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [{ path: '~/web.yaml', content: statefulWeb() }],
  ext: { k8s: { addons: ['csi-hostpath'], manifests: [CLIENT_POD] } },
};

/** The StatefulSet web already runs with its three claims. */
export const STS_RUNNING: TerminalSetup = {
  hostname: 'laptop',
  files: [{ path: '~/web.yaml', content: statefulWeb() }],
  ext: { k8s: { addons: ['csi-hostpath'], manifests: [CLIENT_POD, statefulWeb()], settle: 60_000 } },
};

// ── Helm (k8s-1.helm) ──

export const HELM_PROD_VALUES = `replicaCount: 3\nimage:\n  tag: "1.1"\nenv:\n  GREETING: Hello from prod\n`;

export const HELM_LAB: TerminalSetup = {
  hostname: 'laptop',
  files: [{ path: '~/prod.yaml', content: HELM_PROD_VALUES }],
  ext: { k8s: { manifests: [CLIENT_POD] } },
};
