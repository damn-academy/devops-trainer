// Stage 2 (05 §11.4): an etcd snapshot and a restore. The snapshot is taken
// from the running etcd over TLS (etcdctl), the restore works on a file and
// writes a new data directory (etcdutl in etcd 3.6). Then the static pod
// manifest is pointed at the new directory and the kubelet restarts etcd.
// Everything written after the snapshot is gone — the knob counts it.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { after: number; tool: string; stopApi: boolean };

/** How many objects come back and how many are lost when restoring a snapshot taken `after` writes ago. */
export function restoreOutcome(p: P): { kept: number; lost: number; ok: boolean } {
  const base = 412;
  if (p.tool === 'etcdctl') return { kept: 0, lost: 0, ok: false };
  return { kept: base, lost: p.after, ok: true };
}

export const etcdRestoreModel = defineModel<P>({
  id: 'k8s.etcd-restore',
  block: 'k8s-2',
  title: bi('Снимок etcd и восстановление', 'An etcd snapshot and a restore'),
  summary: bi('Снимок снимают с работающего etcd, а восстанавливают в новый каталог из файла. Всё, что записали после снимка, при восстановлении пропадает — поэтому снимки делают по расписанию.', 'A snapshot is taken from the running etcd, and restored from a file into a new directory. Everything written after the snapshot is lost on restore — which is why snapshots run on a schedule.'),
  concepts: ['k8s.etcd-snapshot', 'k8s.static-pod'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('api', 'kube-apiserver', 'cp', 'hex', 24, 40, 200, 56, bi('Единственный, кто пишет в etcd. На время восстановления его останавливают, чтобы он не писал в старую базу.', 'The only writer to etcd. During a restore it is stopped so it does not write to the old database.'), bi('статический под', 'a static pod'), 'kubectl get --raw /readyz'),
      node('etcd', 'etcd', 'store', 'box', 380, 40, 200, 56, bi('Работающий etcd: данные в /var/lib/etcd, клиентский порт 2379 только по TLS.', 'The running etcd: data in /var/lib/etcd, client port 2379 over TLS only.'), bi('статический под из etcd.yaml', 'a static pod from etcd.yaml'), 'sudo crictl ps --name etcd', D.etcdRecovery, '/var/lib/etcd'),
      node('ctl', 'etcdctl', 'user', 'pill', 380, 170, 200, 44, bi('Клиент работающего etcd: snapshot save по сети, с сертификатами CA etcd.', 'The client of a running etcd: snapshot save over the network, with the etcd CA certificates.'), bi('вы, на cp-1', 'you, on cp-1'), 'etcdctl snapshot save --help'),
      node('snap', 'etcd-2026-11-18.db', 'store', 'doc', 720, 150, 216, 76, bi('Файл снимка: все ключи /registry/… на момент снимка, ревизия и хеш. Храните его вне узла.', 'The snapshot file: every /registry/… key at the moment of the snapshot, the revision and a hash. Keep it off the node.'), bi('etcdctl snapshot save', 'etcdctl snapshot save'), 'etcdutl snapshot status etcd-2026-11-18.db -w table'),
      node('utl', 'etcdutl', 'user', 'pill', 720, 290, 216, 44, bi('Утилита для файлов etcd: status и restore работают без сервера.', 'The utility for etcd files: status and restore work without a server.'), bi('вы, на cp-1', 'you, on cp-1'), 'etcdutl snapshot restore --help'),
      node('newdir', '/var/lib/etcd-restore', 'store', 'doc', 380, 290, 200, 70, bi('Новый каталог данных, который пишет restore. В существующий каталог restore писать откажется.', 'A new data directory written by restore. Restore refuses to write into an existing one.'), bi('etcdutl snapshot restore', 'etcdutl snapshot restore')),
      node('mf', 'etcd.yaml', 'obj', 'doc', 24, 290, 200, 70, bi('Манифест статического пода etcd: том etcd-data — hostPath на каталог данных. Поменяете путь — kubelet перезапустит etcd с другими данными.', 'The static pod manifest of etcd: the etcd-data volume is a hostPath to the data directory. Change the path and the kubelet restarts etcd with other data.'), bi('kubeadm init, правите вы', 'kubeadm init, edited by you'), 'sudo grep -A2 etcd-data /etc/kubernetes/manifests/etcd.yaml', D.staticPods, 'hostPath: /var/lib/etcd'),
    ],
    edges: [
      edge('e-write', 'api', 'etcd', 'TLS :2379', bi('API-сервер пишет каждое изменение объекта.', 'The API server writes every object change.'), bi('kube-apiserver', 'kube-apiserver')),
      edge('e-save', 'ctl', 'etcd', 'snapshot save', bi('Снимок по сети: нужны --cacert, --cert и --key из /etc/kubernetes/pki/etcd.', 'A snapshot over the network: it needs --cacert, --cert and --key from /etc/kubernetes/pki/etcd.'), bi('etcdctl', 'etcdctl')),
      edge('e-file', 'ctl', 'snap', bi('файл .db', '.db file'), bi('Снимок ложится в файл; его копию увозят с узла.', 'The snapshot goes into a file; a copy of it is taken off the node.'), bi('etcdctl', 'etcdctl')),
      edge('e-read', 'snap', 'utl', bi('читает', 'reads'), bi('restore читает файл, а не сервер.', 'restore reads the file, not the server.'), bi('etcdutl', 'etcdutl')),
      edge('e-restore', 'utl', 'newdir', 'restore', bi('Новый каталог с новым кластерным ID etcd.', 'A new directory with a new etcd cluster ID.'), bi('etcdutl', 'etcdutl')),
      edge('e-point', 'mf', 'newdir', 'hostPath', bi('Правка одного пути в манифесте.', 'An edit of one path in the manifest.'), bi('вы', 'you')),
      edge('e-kubelet', 'mf', 'etcd', bi('kubelet перезапускает', 'the kubelet restarts'), bi('kubelet видит изменённый файл и пересоздаёт под etcd.', 'The kubelet sees the changed file and recreates the etcd pod.'), bi('kubelet', 'kubelet'), { via: [[124, 200], [300, 200], [300, 80]], labelAt: 0.3 }),
    ],
  },
  params: [
    {
      id: 'after',
      label: bi('Объектов записали после снимка', 'Objects written after the snapshot'),
      kind: 'range',
      min: 0,
      max: 50,
      step: 10,
      default: 10,
      near: 'snap',
      predict: { prompt: bi('После снимка создали 20 объектов, потом восстановились. Где они?', '20 objects were created after the snapshot, then you restored. Where are they?'), options: [{ id: 'lost', text: bi('Пропали: в снимке их нет', 'Gone: they are not in the snapshot') }, { id: 'merged', text: bi('Остались: etcd сольёт данные', 'Still there: etcd merges the data') }], resolve: () => 'lost' },
    },
    {
      id: 'tool',
      label: bi('Чем восстанавливаем', 'Restore with'),
      kind: 'choice',
      default: 'etcdutl',
      near: 'utl',
      options: [
        { id: 'etcdutl', label: bi('etcdutl snapshot restore', 'etcdutl snapshot restore') },
        { id: 'etcdctl', label: bi('etcdctl snapshot restore', 'etcdctl snapshot restore') },
      ],
      predict: { prompt: bi('В etcd 3.6 вы набрали etcdctl snapshot restore. Что будет?', 'With etcd 3.6 you typed etcdctl snapshot restore. What happens?'), options: [{ id: 'fail', text: bi('Ошибка: такой команды у etcdctl больше нет', 'An error: etcdctl no longer has that command') }, { id: 'ok', text: bi('Сработает так же', 'It works the same') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'fail' : 'ok') },
    },
    { id: 'stopApi', label: bi('Остановить API-сервер на время восстановления', 'Stop the API server during the restore'), kind: 'toggle', default: true, near: 'api', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'samedir',
      label: bi('Восстановить в /var/lib/etcd (существующий каталог)', 'Restore into /var/lib/etcd (an existing directory)'),
      remove: ['newdir'],
      boundary: 'storage',
      predict: { prompt: bi('Каталог данных уже существует. Что ответит restore?', 'The data directory already exists. What does restore answer?'), options: [{ id: 'refuse', text: bi('Откажется писать', 'It refuses to write') }, { id: 'overwrite', text: bi('Перезапишет', 'It overwrites') }], resolve: () => 'refuse' },
    },
    {
      id: 'nopoint',
      label: bi('Забыть поменять hostPath в etcd.yaml', 'Forget to change the hostPath in etcd.yaml'),
      remove: ['e-point'],
      boundary: 'storage',
      predict: { prompt: bi('Снимок восстановлен, манифест не тронут. Какие данные увидит кластер?', 'The snapshot is restored, the manifest untouched. Which data does the cluster see?'), options: [{ id: 'old', text: bi('Те же, что до восстановления', 'The same as before the restore') }, { id: 'snap', text: bi('Из снимка', 'The snapshot’s') }], resolve: () => 'old' },
    },
  ],
  metrics: [
    { id: 'kept', label: bi('объектов вернулось', 'objects back') },
    { id: 'lost', label: bi('объектов потеряно', 'objects lost') },
  ],
  run(p, broken): Step[] {
    const o = restoreOutcome(p);
    const s: Step[] = [];
    s.push({ id: 'save', label: 'save', caption: bi('Снимок с работающего etcd: etcdctl ходит на 127.0.0.1:2379 с сертификатами из /etc/kubernetes/pki/etcd и пишет файл.', 'A snapshot of the running etcd: etcdctl goes to 127.0.0.1:2379 with the certificates from /etc/kubernetes/pki/etcd and writes a file.'), focus: ['ctl', 'e-save', 'e-file', 'snap'], tokens: [{ edge: 'e-save', label: 'Snapshot' }, { edge: 'e-file', label: '5.1 MB' }], states: { snap: 'ok' }, metrics: { kept: 0, lost: 0 } });
    s.push({ id: 'status', label: 'status', caption: bi('etcdutl snapshot status показывает хеш, ревизию, число ключей и размер — так вы знаете, что файл цел, ещё до беды.', 'etcdutl snapshot status shows the hash, the revision, the number of keys and the size — so you know the file is whole before trouble comes.'), focus: ['snap', 'utl', 'e-read'], values: { snap: 'rev 18342 · 412 keys' }, metrics: { kept: 0, lost: 0 } });
    s.push({ id: 'later', label: bi('позже', 'later'), caption: fmt(bi('Кластер живёт дальше: после снимка записано ещё {n} объектов. Потом происходит беда — кто-то удалил namespace с приложением.', 'The cluster lives on: {n} more objects are written after the snapshot. Then trouble comes — someone deleted a namespace with an application.'), { n: p.after }), focus: ['api', 'e-write', 'etcd'], tokens: [{ edge: 'e-write', label: `+${p.after}` }], metrics: { kept: 0, lost: 0 } });
    s.push({ id: 'stop', label: bi('стоп API', 'stop API'), caption: p.stopApi ? bi('Манифест kube-apiserver убран из /etc/kubernetes/manifests: kubelet остановил API-сервер, в старую базу больше никто не пишет.', 'The kube-apiserver manifest was moved out of /etc/kubernetes/manifests: the kubelet stopped the API server, nobody writes to the old database any more.') : bi('API-сервер оставили работать: он продолжает писать в старую базу и после переключения увидит данные, которые расходятся с его кэшем. Контроллеры получат странные события.', 'The API server was left running: it keeps writing to the old database and after the switch sees data that disagree with its cache. Controllers get strange events.'), focus: ['api'], states: { api: p.stopApi ? 'off' : 'warn' }, metrics: { kept: 0, lost: 0 } });
    if (p.tool === 'etcdctl') {
      s.push({ id: 'wrongtool', label: 'etcdctl', caption: bi('В etcd 3.6 команды restore у etcdctl больше нет: работа с файлами перенесена в etcdutl.', 'In etcd 3.6 etcdctl no longer has restore: file work moved to etcdutl.'), focus: ['utl'], states: { utl: 'err' }, metrics: { kept: 0, lost: 0 }, broken: { at: 'utl', message: '$ sudo etcdctl snapshot restore etcd-2026-11-18.db --data-dir /var/lib/etcd-restore\nError: unknown command "restore" for "etcdctl snapshot"', caption: bi('инструкции в интернете часто написаны под 3.5; проверяйте версию.', 'instructions on the internet are often written for 3.5; check your version.') } });
      return s;
    }
    if (broken.has('samedir')) {
      s.push({ id: 'exists', label: 'restore', caption: bi('restore не пишет поверх существующего каталога: так он защищает живые данные от случайной перезаписи.', 'restore does not write over an existing directory: that protects live data from an accidental overwrite.'), focus: ['utl', 'etcd'], states: { utl: 'err' }, metrics: { kept: 0, lost: 0 }, broken: { at: 'utl', message: '$ sudo etcdutl snapshot restore etcd-2026-11-18.db --data-dir /var/lib/etcd\nError: data-dir "/var/lib/etcd" exists', caption: bi('восстанавливайте в новый каталог и переключайте на него манифест.', 'restore into a new directory and point the manifest at it.') } });
      return s;
    }
    s.push({ id: 'restore', label: 'restore', caption: bi('etcdutl читает файл и пишет новый каталог данных — с новым ID кластера etcd, чтобы старые участники не перепутали его с прежним.', 'etcdutl reads the file and writes a new data directory — with a new etcd cluster ID, so old members do not mistake it for the previous one.'), focus: ['e-read', 'utl', 'e-restore', 'newdir'], tokens: [{ edge: 'e-read' }, { edge: 'e-restore', label: '412 keys' }], states: { newdir: 'ok' }, metrics: { kept: 0, lost: 0 } });
    if (broken.has('nopoint')) {
      s.push({ id: 'same', label: bi('те же данные', 'same data'), caption: bi('Каталог восстановлен, но etcd.yaml по-прежнему смотрит в /var/lib/etcd: kubelet ничего не перезапускал, кластер видит прежние данные без удалённого namespace.', 'The directory is restored, but etcd.yaml still points at /var/lib/etcd: the kubelet restarted nothing, the cluster sees the old data without the deleted namespace.'), focus: ['mf', 'etcd'], states: { mf: 'err' }, metrics: { kept: 0, lost: 0 }, broken: { at: 'mf', message: '$ kubectl get ns shop\nError from server (NotFound): namespaces "shop" not found', caption: bi('восстановление закончено только тогда, когда etcd запущен на новом каталоге.', 'a restore is finished only when etcd runs on the new directory.') } });
      return s;
    }
    s.push({ id: 'point', label: 'hostPath', caption: bi('В etcd.yaml путь тома etcd-data заменён на /var/lib/etcd-restore. kubelet увидел изменённый файл и пересоздал под etcd на новых данных.', 'In etcd.yaml the etcd-data volume path is replaced with /var/lib/etcd-restore. The kubelet saw the changed file and recreated the etcd pod on the new data.'), focus: ['mf', 'e-point', 'e-kubelet', 'etcd'], tokens: [{ edge: 'e-point' }, { edge: 'e-kubelet', label: 'restart etcd' }], values: { mf: 'hostPath: /var/lib/etcd-restore', etcd: '/var/lib/etcd-restore' }, states: { etcd: 'ok' }, metrics: { kept: o.kept, lost: o.lost } });
    s.push({ id: 'back', label: bi('API назад', 'API back'), caption: fmt(bi('Манифест API-сервера вернули: кластер снова отвечает. Удалённый namespace на месте; {n} объектов, записанных после снимка, пропали — контроллеры воссоздадут то, что могут, остальное придётся применить заново.', 'The API server manifest is back: the cluster answers again. The deleted namespace is back; {n} objects written after the snapshot are gone — controllers recreate what they can, the rest has to be applied again.'), { n: o.lost }), focus: ['api', 'e-write'], states: { api: 'ok' }, metrics: { kept: o.kept, lost: o.lost } });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Посмотрите, на каком шаге восстановление обрывается и что вам скажет инструмент.', 'See at which step the restore breaks and what the tool tells you.') : bi('Восстановление снова идёт по порядку.', 'The restore runs in order again.');
    if (change.id === 'after') return fmt(bi('Потеряется {n} объектов: чем реже снимки, тем больше потеря.', '{n} objects will be lost: the rarer the snapshots, the bigger the loss.'), { n: metric(next, 'lost') });
    if (change.id === 'tool') return b.tool === 'etcdctl' ? bi('etcdctl говорит с сервером, etcdutl работает с файлами.', 'etcdctl talks to a server, etcdutl works with files.') : bi('etcdutl — правильный инструмент для файла снимка.', 'etcdutl is the right tool for a snapshot file.');
    return b.stopApi ? bi('Писать в базу во время подмены некому.', 'Nobody writes to the database while it is swapped.') : bi('Работающий API-сервер во время подмены базы — источник странных ошибок.', 'A running API server while the database is swapped is a source of strange errors.');
  },
});
