// Stage 2 (05 §11.4): an etcd snapshot and a restore. The snapshot is taken
// from the running etcd over TLS (etcdctl), the restore works on a file and
// writes a new data directory (etcdutl in etcd 3.6). Then the static pod
// manifest is pointed at the new directory and the kubelet restarts etcd.
// Everything written after the snapshot is gone — the knob counts it.
//
// Reading order: at first only the API server and the running etcd are on
// screen; the snapshot tools, the file, the new directory and the manifest
// appear as you use them.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { after: number; tool: string; stopApi: boolean };

/** How many objects come back and how many are lost when restoring a snapshot taken `after` writes ago. */
export function restoreOutcome(p: P): { kept: number; lost: number; ok: boolean } {
  const base = 412;
  if (p.tool === 'etcdctl') return { kept: 0, lost: 0, ok: false };
  return { kept: base, lost: p.after, ok: true };
}

const YOU = bi('Команду запускаете вы на cp-1.', 'You, on cp-1.');

const diagram = {
  width: 960,
  height: 470,
  nodes: [
    box('api', 'kube-apiserver', 'cp', 'hex', [24, 40, 210, 56], 'server', bi('Единственный, кто пишет в etcd. На время восстановления его останавливают, чтобы он не писал в старую базу.', 'The only writer to etcd; stopped during a restore.'), bi('Работает статическим подом.', 'A static pod.'), { see: 'kubectl get --raw /readyz' }),
    box('etcd', 'etcd', 'store', 'box', [380, 40, 210, 56], 'database', bi('Работающий etcd. Данные он хранит в каталоге /var/lib/etcd и принимает соединения на порту 2379 только по TLS.', 'The running etcd: data in /var/lib/etcd, TLS-only on 2379.'), bi('Работает статическим подом по файлу etcd.yaml.', 'A static pod from etcd.yaml.'), { see: 'sudo crictl ps --name etcd', doc: D.etcdRecovery, sub: '/var/lib/etcd' }),
    box('ctl', 'etcdctl', 'user', 'pill', [380, 170, 210, 48], 'terminal', bi('Клиент работающего etcd. Команда snapshot save снимает снимок по сети, предъявляя сертификаты центра etcd.', 'The client of a running etcd: snapshot save over TLS.'), YOU, { see: 'etcdctl snapshot save --help' }),
    box('snap', 'etcd-2026-11-18.db', 'store', 'doc', [716, 150, 220, 76], 'disk', bi('В файле снимка хранятся все ключи /registry/… на момент снимка, номер ревизии и хеш. Храните копию вне узла.', 'Every /registry/… key at that moment, the revision and a hash; keep a copy off the node.'), bi('Файл пишет etcdctl snapshot save.', 'etcdctl snapshot save.'), { see: 'etcdutl snapshot status etcd-2026-11-18.db -w table' }),
    box('utl', 'etcdutl', 'user', 'pill', [716, 290, 220, 48], 'terminal', bi('Утилита для файлов etcd. Команды status и restore работают без сервера, напрямую с файлом.', 'Works on etcd files: status and restore need no server.'), YOU, { see: 'etcdutl snapshot restore --help' }),
    box('newdir', '/var/lib/etcd-restore', 'store', 'doc', [380, 290, 210, 70], 'folder', bi('Новый каталог данных, который создаёт команда etcdutl snapshot restore. В уже существующий каталог эта команда писать отказывается.', 'A new data directory; restore refuses an existing one.'), bi('Создаёт etcdutl snapshot restore.', 'etcdutl snapshot restore.')),
    box('mf', 'etcd.yaml', 'obj', 'doc', [24, 290, 210, 70], 'file', bi('Манифест статического пода etcd. Его том etcd-data указывает через hostPath на каталог данных, поэтому стоит поменять путь, и kubelet перезапустит etcd на других данных.', 'The etcd manifest: change the hostPath and the kubelet restarts etcd on other data.'), bi('Файл записал kubeadm init, а правите его вы.', 'Written by kubeadm init, edited by you.'), { see: 'sudo grep -A2 etcd-data /etc/kubernetes/manifests/etcd.yaml', doc: D.staticPods, sub: 'hostPath: /var/lib/etcd' }),
  ],
  edges: [
    edge('e-write', 'api', 'etcd', 'TLS :2379', bi('API-сервер записывает в etcd каждое изменение объекта.', 'Every object change.'), bi('Пишет kube-apiserver.', 'kube-apiserver.')),
    edge('e-save', 'ctl', 'etcd', bi('снять снимок', 'take a snapshot'), bi('Снимок снимают по сети, и для этого нужны флаги --cacert, --cert и --key с файлами из /etc/kubernetes/pki/etcd.', 'Needs --cacert, --cert, --key from pki/etcd.'), bi('etcdctl', 'etcdctl')),
    edge('e-file', 'ctl', 'snap', bi('файл .db', '.db file'), bi('Снимок записывается в файл, а копию этого файла переносят с узла на другую машину.', 'The snapshot goes into a file; a copy leaves the node.'), bi('etcdctl', 'etcdctl')),
    edge('e-read', 'snap', 'utl', bi('читает файл', 'reads the file'), bi('Команда restore берёт данные из файла снимка, а к работающему серверу etcd не обращается.', 'restore reads the file, not the server.'), bi('etcdutl', 'etcdutl')),
    edge('e-restore', 'utl', 'newdir', bi('новый каталог', 'new directory'), bi('Команда restore создаёт новый каталог данных с новым идентификатором кластера etcd.', 'A new directory with a new cluster ID.'), bi('etcdutl', 'etcdutl')),
    edge('e-point', 'mf', 'newdir', bi('новый путь', 'new path'), bi('В манифесте меняется один путь.', 'One path changes in the manifest.'), bi('Правите вы.', 'You.')),
    edge('e-kubelet', 'mf', 'etcd', bi('перезапуск etcd', 'etcd restart'), bi('kubelet видит изменённый файл и пересоздаёт под etcd.', 'The kubelet recreates the etcd pod.'), bi('Перезапускает kubelet.', 'The kubelet.'), { via: [[129, 200], [300, 200], [300, 80]], labelAt: 0.3 }),
  ],
};

const ALL = idsOf(diagram);

export const etcdRestoreModel = defineModel<P>({
  id: 'k8s.etcd-restore',
  frame: 'visible',
  block: 'k8s-2',
  title: bi('Как снять снимок etcd и восстановиться из него', 'How to snapshot etcd and restore'),
  summary: bi(
    'Снимок снимают с работающего etcd по сети, а восстанавливают из файла в новый каталог данных, после чего переключают на этот каталог статический под etcd. Всё, что было записано после снимка, при восстановлении пропадает, поэтому снимки делают по расписанию.',
    'Snapshot from the running etcd, restore from the file into a new directory, then point the static pod at it. Everything written after the snapshot is lost.',
  ),
  intro: bi(
    'Сейчас на схеме API-сервер и работающий etcd. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». По ходу вы снимете снимок, кластер поработает ещё какое-то время, кто-то удалит namespace, и вы восстановитесь. Инструменты, файл снимка, новый каталог и манифест etcd появятся, когда до них дойдёт дело. Счётчики под схемой покажут, сколько объектов вернулось и сколько потеряно. Потом поменяйте в «Параметрах» инструмент и включите поломки.',
    'For now: the API server and the running etcd. Press “Start from the first step” and go on with “Step forward”: you take a snapshot, the cluster works on, someone deletes a namespace, and you restore. The counters show objects back and lost. Then change the tool and switch on the breaks.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:database', 'работающий etcd', 'the running etcd'),
    mark('icon:terminal', 'команда, которую запускаете вы', 'a command you run'),
    mark('icon:disk', 'файл снимка', 'the snapshot file'),
    mark('ok', 'шаг выполнен', 'the step is done'),
    mark('err', 'здесь восстановление сорвалось', 'the restore failed here'),
  ],
  stopLabel: bi('Восстановление сорвалось', 'The restore failed'),
  concepts: ['k8s.etcd-snapshot', 'k8s.static-pod'],
  diagram,
  params: [
    {
      id: 'after',
      label: bi('Сколько объектов записали после снимка', 'Objects written after the snapshot'),
      kind: 'range',
      min: 0,
      max: 50,
      step: 10,
      default: 10,
      near: 'snap',
      group: bi('Снимок', 'The snapshot'),
      predict: { prompt: bi('После снимка в кластер записали выбранное число объектов, а потом кластер восстановили из снимка. Что стало с этими объектами?', 'Objects were written after the snapshot, then you restored. Where are they?'), options: [{ id: 'lost', text: bi('Пропали, потому что в снимке их нет', 'Gone: not in the snapshot') }, { id: 'merged', text: bi('Остались, потому что etcd объединит старые и новые данные', 'Still there: etcd merges') }], resolve: () => 'lost' },
    },
    {
      id: 'tool',
      label: bi('Какой командой восстанавливаете снимок', 'The restore command'),
      kind: 'choice',
      default: 'etcdutl',
      near: 'utl',
      group: bi('Восстановление', 'The restore'),
      options: [
        { id: 'etcdutl', label: bi('etcdutl snapshot restore', 'etcdutl snapshot restore') },
        { id: 'etcdctl', label: bi('etcdctl snapshot restore', 'etcdctl snapshot restore') },
      ],
      predict: { prompt: bi('В etcd версии 3.6 вы выбрали другую команду восстановления. Что будет?', 'With etcd 3.6 you pick another restore command. What happens?'), options: [{ id: 'fail', text: bi('Команда завершится ошибкой, потому что у этой программы такой команды нет', 'An error: no such command') }, { id: 'ok', text: bi('Восстановление пройдёт', 'It works') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'fail' : 'ok') },
    },
    { id: 'stopApi', label: bi('API-сервер останавливают на время восстановления', 'The API server is stopped during the restore'), kind: 'toggle', default: true, near: 'api', levels: ['intermediate', 'experienced'], group: bi('Восстановление', 'The restore') },
  ],
  breaks: [
    {
      id: 'samedir',
      label: bi('Восстановить в существующий каталог /var/lib/etcd', 'Restore into the existing /var/lib/etcd'),
      remove: ['newdir'],
      boundary: 'storage',
      predict: { prompt: bi('Вы восстанавливаете снимок в каталог данных, который уже существует. Что ответит команда restore?', 'You restore into an existing directory. What does restore answer?'), options: [{ id: 'refuse', text: bi('Откажется писать в этот каталог', 'It refuses') }, { id: 'overwrite', text: bi('Перезапишет каталог', 'It overwrites') }], resolve: () => 'refuse' },
    },
    {
      id: 'nopoint',
      label: bi('Забыть поменять путь (hostPath) в etcd.yaml', 'Forget to change the hostPath in etcd.yaml'),
      remove: ['e-point'],
      boundary: 'storage',
      predict: { prompt: bi('Снимок восстановлен в новый каталог, а манифест etcd никто не тронул. Какие данные увидит кластер?', 'Restored, manifest untouched. Which data does the cluster see?'), options: [{ id: 'old', text: bi('Те же, что были до восстановления', 'The same as before') }, { id: 'snap', text: bi('Данные из снимка', 'The snapshot’s') }], resolve: () => 'old' },
    },
  ],
  metrics: [
    { id: 'kept', label: bi('объектов вернулось', 'objects back') },
    { id: 'lost', label: bi('объектов потеряно', 'objects lost') },
  ],
  run(p, broken): Step[] {
    const o = restoreOutcome(p);
    const s: Step[] = [];
    const zero = { kept: 0, lost: 0 };
    s.push({
      id: 'save',
      label: bi('снимок', 'snapshot'),
      caption: bi('Вы снимаете снимок с работающего etcd. Программа etcdctl обращается на 127.0.0.1:2379 с сертификатами из /etc/kubernetes/pki/etcd и записывает файл.', 'etcdctl takes a snapshot over TLS and writes a file.'),
      focus: ['ctl', 'e-save', 'e-file'],
      reveal: ['ctl', 'e-save', 'e-file', 'snap'],
      tokens: [{ edge: 'e-file', label: '5.1 MB' }],
      say: { ctl: bi('etcdctl снимает снимок с работающего etcd и записывает его в файл.', 'etcdctl snapshots etcd into a file.') },
      states: { ...only(ALL, 'api', 'etcd', 'e-write'), snap: 'ok' },
      metrics: zero,
    });
    s.push({
      id: 'status',
      label: bi('проверка', 'status'),
      caption: bi('Команда etcdutl snapshot status показывает хеш, ревизию, число ключей и размер файла. Так вы убеждаетесь, что файл цел, ещё до того, как он понадобится.', 'etcdutl snapshot status shows hash, revision, keys and size: you know the file is whole before you need it.'),
      focus: ['utl', 'e-read'],
      reveal: ['utl', 'e-read'],
      tokens: [{ edge: 'e-read', label: 'status' }],
      say: { utl: bi('etcdutl читает файл снимка и проверяет, что он цел.', 'etcdutl checks the file.') },
      values: { snap: t(bi('ревизия 18342 · 412 ключей', 'rev 18342 · 412 keys')) },
      metrics: zero,
    });
    s.push({
      id: 'later',
      label: bi('позже', 'later'),
      caption: fmt(bi('Кластер работает дальше, и после снимка в него записывают ещё {n} объектов. Потом случается беда, и кто-то удаляет namespace с приложением.', 'The cluster goes on: {n} more objects. Then someone deletes a namespace.'), { n: p.after }),
      focus: ['api', 'e-write'],
      tokens: [{ edge: 'e-write', label: `+${p.after}` }],
      say: { api: fmt(bi('API-сервер записывает в etcd ещё {n} объектов, а потом записывает удаление namespace.', 'The API server writes {n} more objects, then a namespace deletion.'), { n: p.after }) },
      metrics: zero,
    });
    s.push({
      id: 'stop',
      label: bi('стоп API', 'stop API'),
      caption: p.stopApi
        ? bi('Вы убираете манифест kube-apiserver из /etc/kubernetes/manifests, kubelet останавливает API-сервер, и в старую базу больше никто не пишет.', 'You move the API server manifest out: nobody writes to the old database.')
        : bi('API-сервер оставили работать. Он продолжает писать в старую базу, а после переключения увидит данные, которые расходятся с его кэшем, и контроллеры получат странные события.', 'The API server keeps running and will see data that disagree with its cache.'),
      focus: ['api'],
      say: { api: p.stopApi ? bi('API-сервер остановлен и в etcd больше не пишет.', 'The API server is stopped.') : bi('API-сервер продолжает писать в старую базу.', 'The API server keeps writing to the old database.') },
      states: { api: p.stopApi ? 'off' : 'warn' },
      metrics: zero,
    });
    if (p.tool === 'etcdctl') {
      s.push({
        id: 'wrongtool',
        label: 'etcdctl',
        caption: bi('В etcd 3.6 у etcdctl нет команды restore: работу с файлами перенесли в etcdutl.', 'In etcd 3.6 etcdctl has no restore: it moved to etcdutl.'),
        focus: ['utl'],
        say: { utl: bi('Команда etcdctl snapshot restore завершается ошибкой «unknown command».', 'etcdctl snapshot restore fails: unknown command.') },
        states: { utl: 'err' },
        metrics: zero,
        broken: { at: 'utl', message: '$ sudo etcdctl snapshot restore etcd-2026-11-18.db --data-dir /var/lib/etcd-restore\nError: unknown command "restore" for "etcdctl snapshot"', caption: bi('на команде восстановления. Инструкции в интернете часто написаны для версии 3.5, поэтому проверяйте, какая версия у вас.', 'at the restore command: instructions online are often for 3.5; check your version.') },
      });
      return s;
    }
    if (broken.has('samedir')) {
      s.push({
        id: 'exists',
        label: 'restore',
        caption: bi('Команда restore не пишет поверх существующего каталога и так защищает живые данные от случайной перезаписи.', 'restore does not overwrite an existing directory.'),
        focus: ['utl'],
        say: { utl: bi('etcdutl отказывается писать в существующий каталог /var/lib/etcd.', 'etcdutl refuses the existing directory.') },
        states: { utl: 'err' },
        metrics: zero,
        broken: { at: 'utl', message: '$ sudo etcdutl snapshot restore etcd-2026-11-18.db --data-dir /var/lib/etcd\nError: data-dir "/var/lib/etcd" exists', caption: bi('на восстановлении. Восстанавливайте в новый каталог и переключайте на него манифест.', 'at the restore: use a new directory and point the manifest at it.') },
      });
      return s;
    }
    s.push({
      id: 'restore',
      label: 'restore',
      caption: bi('etcdutl читает файл и создаёт новый каталог данных с новым идентификатором кластера etcd, чтобы прежние участники кластера не спутали его со старым.', 'etcdutl writes a new directory with a new cluster ID.'),
      focus: ['utl', 'e-restore'],
      reveal: ['newdir', 'e-restore'],
      tokens: [{ edge: 'e-restore', label: bi('412 ключей', '412 keys') }],
      say: { utl: bi('etcdutl восстанавливает снимок в новый каталог /var/lib/etcd-restore.', 'etcdutl restores into /var/lib/etcd-restore.') },
      states: { newdir: 'ok' },
      metrics: zero,
    });
    if (broken.has('nopoint')) {
      s.push({
        id: 'same',
        label: bi('те же данные', 'same data'),
        caption: bi('Новый каталог готов, но etcd.yaml по-прежнему указывает на /var/lib/etcd. kubelet ничего не перезапускал, и кластер видит прежние данные, в которых удалённого namespace нет.', 'The manifest still points at /var/lib/etcd: nothing restarted, the old data stays.'),
        focus: ['etcd'],
        reveal: ['mf'],
        say: { etcd: bi('etcd по-прежнему работает на старом каталоге /var/lib/etcd.', 'etcd still runs on /var/lib/etcd.') },
        states: { mf: 'err' },
        metrics: zero,
        broken: { at: 'mf', message: '$ kubectl get ns shop\nError from server (NotFound): namespaces "shop" not found', caption: bi('на манифесте etcd. Восстановление закончено только тогда, когда etcd запущен на новом каталоге.', 'at the manifest: a restore ends only when etcd runs on the new directory.') },
      });
      return s;
    }
    s.push({
      id: 'point',
      label: 'hostPath',
      caption: bi('Вы меняете в etcd.yaml путь тома etcd-data на /var/lib/etcd-restore. kubelet видит изменённый файл и пересоздаёт под etcd уже на новых данных.', 'You point etcd-data at /var/lib/etcd-restore; the kubelet recreates etcd on the new data.'),
      focus: ['mf', 'e-point', 'e-kubelet'],
      reveal: ['mf', 'e-point', 'e-kubelet'],
      tokens: [{ edge: 'e-kubelet', label: bi('перезапуск etcd', 'restart etcd') }],
      say: { mf: bi('Манифест etcd теперь указывает на каталог /var/lib/etcd-restore.', 'The manifest now points at /var/lib/etcd-restore.') },
      values: { mf: 'hostPath: /var/lib/etcd-restore', etcd: '/var/lib/etcd-restore' },
      states: { etcd: 'ok' },
      metrics: { kept: o.kept, lost: o.lost },
    });
    s.push({
      id: 'back',
      label: bi('API снова', 'API back'),
      caption: fmt(bi('Вы возвращаете манифест API-сервера, и кластер снова отвечает. Удалённый namespace вернулся, а {n} объектов, записанных после снимка, пропали. Контроллеры создадут заново то, что смогут, а остальное придётся применить ещё раз.', 'The API server is back; the namespace is back; {n} objects written after the snapshot are gone.'), { n: o.lost }),
      focus: ['api'],
      say: { api: bi('API-сервер снова работает и видит данные из снимка.', 'The API server runs again on the snapshot’s data.') },
      states: { api: 'ok' },
      metrics: { kept: o.kept, lost: o.lost },
    });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Посмотрите, на каком шаге восстановление обрывается и что вам скажет инструмент.', 'See where the restore breaks and what the tool says.') : bi('Восстановление снова идёт по порядку.', 'The restore runs in order again.');
    if (change.id === 'after') return fmt(bi('Потеряно объектов: {n}. Чем реже снимки, тем больше потеря.', '{n} objects lost: rarer snapshots, bigger losses.'), { n: metric(next, 'lost') });
    if (change.id === 'tool') return b.tool === 'etcdctl' ? bi('etcdctl работает с сервером, а с файлами работает etcdutl.', 'etcdctl talks to a server, etcdutl works with files.') : bi('С файлом снимка правильно работать программой etcdutl.', 'etcdutl is right for a snapshot file.');
    return b.stopApi ? bi('Пока подменяют базу, писать в неё некому.', 'Nobody writes while the database is swapped.') : bi('Работающий API-сервер во время подмены базы становится источником странных ошибок.', 'A running API server during the swap causes strange errors.');
  },
});
