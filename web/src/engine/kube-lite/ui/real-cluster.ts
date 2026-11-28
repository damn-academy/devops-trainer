// An optional real cluster for a lesson: the kube-wasm control plane with one
// worker node in the RV64 emulator (src/engine/kube-wasm/node.html), opened in
// its own tab on request. The lesson itself keeps working in the simulator;
// the section is complete as soon as it is shown.

import './kube.css';
import { clear, h } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';

export const REAL_CLUSTER_PATH = 'src/engine/kube-wasm/node.html?node=/rv64/node/node.json';

const L = {
  title: bi('То же в настоящем Kubernetes', 'The same in real Kubernetes'),
  body: bi(
    'Задания этого урока проверяет тренажёр. Если хотите повторить их на настоящем Kubernetes, откройте кластер во вкладке. Это настоящие kube-apiserver, планировщик и контроллеры версии 1.37 и один рабочий узел с kubelet в эмуляторе процессора RISC-V. Слева вы пишете команды kubectl, справа видна консоль узла. Из образов есть только busybox, поэтому для подов берите его.',
    'The trainer checks the tasks of this lesson. To repeat them on real Kubernetes, open the cluster in a tab. It runs the real kube-apiserver, scheduler and controllers of version 1.37 and one worker node with a kubelet in a RISC-V processor emulator. You type kubectl commands on the left and see the node console on the right. The only image available is busybox, so use it for pods.',
  ),
  needs: bi(
    'Нужен компьютер, а не телефон: вкладка займёт около 3 ГБ памяти, а при первом открытии скачает около 200 МБ. Узел будет готов примерно через 10 секунд, а новый под запустится минуты через три. Во второй раз почти всё возьмётся из кэша браузера.',
    'You need a computer, not a phone: the tab takes about 3 GB of memory and downloads about 200 MB the first time. The node is ready in about 10 seconds, and a new pod starts in about three minutes. The second time almost everything comes from the browser cache.',
  ),
  open: bi('Открыть настоящий кластер', 'Open the real cluster'),
  unsupported: bi(
    'Этот браузер не даёт странице общую память между потоками, без неё кластер не запустится. Откройте урок в свежем Chrome, Edge или Firefox на компьютере.',
    'This browser does not give the page memory shared between threads, and the cluster cannot start without it. Open the lesson in a recent Chrome, Edge or Firefox on a computer.',
  ),
};

function mountRealCluster(root: HTMLElement, _props: unknown, ctx: WidgetCtx): Mounted {
  const supported = typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;
  const href = new URL(REAL_CLUSTER_PATH, document.baseURI).href;
  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('h3', {}, t(L.title)),
      h('p', {}, t(L.body)),
      h('p.kx-note', {}, t(L.needs)),
      supported
        ? h('div', {}, h('a.btn.primary', { href, target: '_blank', rel: 'noopener' }, t(L.open)))
        : h('p.kx-note', {}, t(L.unsupported)),
    ),
  );
  ctx.complete();
  return { dispose() {}, describe: () => `${t(L.title)}. ${t(L.body)}` };
}

export const realClusterWidget: WidgetReg = { id: 'k8s.real-cluster', mount: mountRealCluster };
