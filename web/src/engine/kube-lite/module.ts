import { helmCommand } from './helm';
// kube-lite: the Kubernetes engine of the trainer (05 §5). It registers
// kubectl and the trainer's `cluster` panel, the k8s facts scope, the
// TerminalSetup.ext.k8s hook, the documentation pages (kubectl explain,
// kubectl --help, kubernetes.io snapshots) and the Kubernetes widgets.

import { defineModule } from '../../core/define';
import { clusterFacts } from './facts';
import { kubectlCommand } from './kubectl/index';
import { explainPages } from './kubectl/explain';
import { helpPages } from './kubectl/help';
import { K8S_WEB_PAGES } from './docs';
import { applyK8sSetup, k8sState, machineNow } from './state';
import { clusterCommand } from './trainer-cmd';
import { KUBE_WIDGETS } from './ui/widgets';

export default defineModule({
  commands: [kubectlCommand(), helmCommand(), clusterCommand()],
  facts: [
    {
      scope: 'k8s',
      collect(m) {
        const c = k8sState(m).cluster;
        if (!c) return { env: 'sim', objects: [], pods: [], nodes: [], deployments: [], services: [] };
        c.syncReal(machineNow(m));
        return clusterFacts(c);
      },
    },
  ],
  setup: [{ key: 'k8s', apply: applyK8sSetup }],
  docs: [...explainPages(), ...helpPages(), ...K8S_WEB_PAGES],
  widgets: KUBE_WIDGETS,
});
