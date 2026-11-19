// Offline snapshots of the documentation block 9 points to: Argo CD
// (Apache-2.0, © The Argo Project Authors) and the Kubernetes version skew
// policy (CC BY 4.0, © The Kubernetes Authors). Only the sections the lessons
// and the doc ladder need; each page links to the original.

import type { DocPage } from '../../core/types';

const ARGO = 'Apache-2.0, © The Argo Project Authors (argoproj/argo-cd docs)';

export const KCODE_DOCS: DocPage[] = [
  {
    id: 'web/argo-cd.readthedocs.io/declarative-setup',
    source: 'argo-cd',
    title: 'Argo CD — Declarative Setup',
    url: 'https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/',
    license: ARGO,
    version: 'v3.1',
    sections: [
      { id: 'DESCRIPTION', title: 'Declarative Setup', body: 'Argo CD applications, projects and settings can be defined declaratively using Kubernetes manifests. These can be updated using kubectl apply, without needing to touch the argocd command-line tool.\n\nAll resources, including Application and AppProject specs, have to be installed in the Argo CD namespace (by default argocd).' },
      {
        id: 'applications',
        title: 'Applications',
        body: 'The Application CRD is the Kubernetes resource object representing a deployed application instance in an environment. It is defined by two key pieces of information:\n\n  source       reference to the desired state in Git (repository, revision, path, environment)\n  destination  reference to the target cluster and namespace. For the cluster one of server or name can be used, but not both.\n\nA minimal Application spec is as follows:\n\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: guestbook\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://github.com/argoproj/argocd-example-apps.git\n    targetRevision: HEAD\n    path: guestbook\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: guestbook\n\nThe namespace must match the namespace of your Argo CD instance - typically this is argocd.',
      },
      { id: 'status', title: 'Application status', body: 'The status of an Application reports two things:\n\n  status.sync.status    Synced when the live state matches the target state in Git, OutOfSync when it does not, Unknown when the target state cannot be loaded\n  status.health.status  Healthy, Progressing, Degraded, Suspended, Missing or Unknown, computed from the health of its resources\n\nstatus.conditions lists errors such as ComparisonError when the manifests cannot be generated.' },
    ],
  },
  {
    id: 'web/argo-cd.readthedocs.io/auto-sync',
    source: 'argo-cd',
    title: 'Argo CD — Automated Sync Policy',
    url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/',
    license: ARGO,
    version: 'v3.1',
    sections: [
      {
        id: 'automated',
        title: 'Automated Sync Policy',
        body: 'Argo CD has the ability to automatically sync an application when it detects differences between the desired manifests in Git, and the live state in the cluster. A benefit of automatic sync is that CI/CD pipelines no longer need direct access to the Argo CD API server to perform the deployment.\n\nspec:\n  syncPolicy:\n    automated: {}\n\nAn automated sync will only be performed if the application is OutOfSync. An automated sync will only attempt one synchronization per unique combination of commit SHA1 and application parameters. Rollback cannot be performed against an application with automated sync enabled.\n\nArgo CD polls Git repositories every three minutes by default to detect changes; a webhook removes the delay.',
      },
      {
        id: 'prune',
        title: 'Automatic Pruning',
        body: 'By default (and as a safety mechanism), automated sync will not delete resources when Argo CD detects the resource is no longer defined in Git. To prune the resources, a manual sync can always be performed (with pruning checked). Pruning can also be enabled to happen automatically as part of the automated sync by running:\n\nspec:\n  syncPolicy:\n    automated:\n      prune: true',
      },
      {
        id: 'self-heal',
        title: 'Automatic Self-Healing',
        body: 'By default, changes that are made to the live cluster will not trigger automated sync. To enable automatic sync when the live cluster\'s state deviates from the state defined in Git, run:\n\nspec:\n  syncPolicy:\n    automated:\n      selfHeal: true\n\nWith self-heal enabled the controller re-syncs a few seconds after it notices a difference.',
      },
    ],
  },
  {
    id: 'web/argo-cd.readthedocs.io/diffing',
    source: 'argo-cd',
    title: 'Argo CD — Diffing Customization',
    url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/',
    license: ARGO,
    version: 'v3.1',
    sections: [
      { id: 'DESCRIPTION', title: 'Diffing Customization', body: 'It is possible for an application to be OutOfSync even immediately after a successful Sync operation. Some reasons for this might be: there is a bug in the manifest, where it contains extra or unknown fields; a controller in the cluster changes a field after it is applied; a person or an autoscaler deliberately manages a field that is also in Git.\n\nIn case it is impractical to fix the upstream issue, Argo CD allows you to optionally ignore differences of problematic resources. The diffing customization can be configured for single or multiple application resources or at a system level.' },
      {
        id: 'application-level-configuration',
        title: 'Application Level Configuration',
        body: 'Argo CD allows ignoring differences at a specific JSON path, using RFC6902 JSON patches and JQ path expressions. It is also possible to ignore differences from fields owned by specific managers defined in metadata.managedFields in live resources.\n\nThe following sample application is configured to ignore differences in spec.replicas for all deployments:\n\nspec:\n  ignoreDifferences:\n  - group: apps\n    kind: Deployment\n    jsonPointers:\n    - /spec/replicas\n\nTo ignore a single resource, add name (and namespace) to the entry.',
      },
      {
        id: 'respect-ignore-difference-configs',
        title: 'Respect ignoreDifferences during a sync',
        body: 'By default, ignoreDifferences only affects the comparison: a sync still applies the whole manifest from Git and overwrites the ignored field. To make the sync leave those fields as they are in the live object, add the sync option:\n\nspec:\n  syncPolicy:\n    syncOptions:\n    - RespectIgnoreDifferences=true\n\nThis is useful when another actor (a person, an autoscaler) owns the field, for example spec.replicas.',
      },
    ],
  },
  {
    id: 'web/argo-cd.readthedocs.io/sync-options',
    source: 'argo-cd',
    title: 'Argo CD — Sync Options',
    url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/',
    license: ARGO,
    version: 'v3.1',
    sections: [
      { id: 'create-namespace', title: 'Create Namespace', body: 'The namespace referenced by destination.namespace is created if it is missing:\n\nspec:\n  syncPolicy:\n    syncOptions:\n    - CreateNamespace=true' },
      { id: 'respect-ignore-difference-configs', title: 'Respect ignore differences configs', body: 'RespectIgnoreDifferences=true makes the sync use the ignoreDifferences configuration: the ignored fields keep their live values when the resource is applied. Without it ignoreDifferences affects only the comparison.' },
      { id: 'prune-last', title: 'Prune Last', body: 'PruneLast=true deletes the resources that are no longer in Git at the end of a sync, after the other resources were applied and became healthy.' },
    ],
  },
  {
    id: 'web/argo-cd.readthedocs.io/tracking-strategies',
    source: 'argo-cd',
    title: 'Argo CD — Tracking and Deployment Strategies',
    url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/tracking_strategies/',
    license: ARGO,
    version: 'v3.1',
    sections: [
      { id: 'DESCRIPTION', title: 'Tracking and Deployment Strategies', body: 'An Argo CD application spec provides several different ways of tracking Kubernetes resource manifests in Git: the field spec.source.targetRevision decides which revision of the repository the application follows.' },
      { id: 'commit-pinning', title: 'Commit Pinning', body: 'If a Git commit SHA is specified, the app is effectively pinned to the manifests defined at the specified commit. This is the most restrictive of the techniques and is typically used to control production environments.' },
      { id: 'tag-tracking', title: 'Tag Tracking', body: 'If a tag is specified, the manifests at the specified Git tag will be used to perform the sync comparison. This provides some advantages over branch tracking in that a tag is generally considered more stable, and less frequently updated, with some manual judgement of what constitutes a tag.\n\nspec:\n  source:\n    targetRevision: v1.4.0\n\nA new release then means a new tag and a change of targetRevision, not just a commit to a branch.' },
      { id: 'branch-tracking', title: 'Branch Tracking', body: 'If a branch name or a symbolic reference (like HEAD) is specified, Argo CD will continually compare live state against the resource manifests defined at the tip of the specified branch or the resolved commit of the symbolic reference.' },
    ],
  },
  {
    id: 'web/kubernetes.io/releases/version-skew-policy',
    source: 'kubernetes.io',
    title: 'Version Skew Policy',
    url: 'https://kubernetes.io/releases/version-skew-policy/',
    license: 'CC BY 4.0, © The Kubernetes Authors (kubernetes/website)',
    version: 'v1.37',
    sections: [
      { id: 'supported-versions', title: 'Supported versions', body: 'The Kubernetes project maintains release branches for the most recent three minor releases. Kubernetes 1.19 and newer receive approximately 1 year of patch support.' },
      { id: 'kube-apiserver', title: 'kube-apiserver', body: 'In highly-available (HA) clusters, the newest and oldest kube-apiserver instances must be within one minor version.' },
      { id: 'kubelet', title: 'kubelet', body: 'kubelet must not be newer than kube-apiserver.\nkubelet may be up to three minor versions older than kube-apiserver.\n\nExample: kube-apiserver is at 1.37; kubelet is supported at 1.37, 1.36, 1.35, and 1.34.' },
      { id: 'supported-component-upgrade-order', title: 'Supported component upgrade order', body: 'The supported version skew between components has implications on the order in which components must be upgraded. Upgrade kube-apiserver first (the control plane), then kube-controller-manager, kube-scheduler and cloud-controller-manager, then the kubelet on the nodes. Drain a node before upgrading its kubelet in place. Minor version upgrades are done one minor version at a time.' },
    ],
  },
];
