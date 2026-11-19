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

export const DEPLOY_LAB: TerminalSetup = { hostname: 'laptop', files: [{ path: '~/web.yaml', content: WEB_DEPLOY }], ext: { k8s: {} } };

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

/** NetworkPolicy lab: pay is open to everyone; two pods named client — shop/client (role=frontend) and dev/client (role=frontend, other namespace) — and a web Service in dev. */
const labelled = (namespace: string, labels: Record<string, string>) => client(namespace).replace('    app: client\n', `    app: client\n${Object.entries(labels).map(([k, v]) => `    ${k}: ${v}\n`).join('')}`);
export const NETPOL_LAB: TerminalSetup = {
  hostname: 'laptop',
  ext: {
    k8s: {
      manifests: [ns('shop'), ns('pay'), ns('dev'), deploy('pay', 'pay', 2, 'trainer/web:1.0', { app: 'pay' }), svc('pay', 'pay', { app: 'pay' }), deploy('web', 'dev', 1, 'trainer/web:1.0', { app: 'web' }), svc('web', 'dev', { app: 'web' }), labelled('shop', { role: 'frontend' }), labelled('dev', { role: 'frontend' })],
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
