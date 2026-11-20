// KM00 (05 §4.2), without a single Kubernetes term: three servers, five
// containers, a list of what must run. By hand you place them, notice a dead
// server, move its containers, update one by one; a program does the same
// three jobs — choose a place, keep watch, remember the list — in seconds.
// The three jobs become the scheduler, the controller and the desired state
// in the next lessons.
//
// Reading order: at first only the list and the dispatcher are on screen; the
// servers appear when the dispatcher starts placing containers. The person and
// the program are two nodes in the same place, and the run shows one of them.

import { defineModel } from '../../../core/define';
import { bi, fmt, t as tr, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { who: string; failure: boolean; update: boolean };

const store = bi('Сервер стоит в дата-центре или арендован в облаке, и на нём уже установлен Docker.', 'The server stands in a data centre or is rented in a cloud; Docker is already installed on it.');

const diagram = {
  width: 960,
  height: 440,
  nodes: [
    box('list', bi('Список того, что должно работать', 'The list of what must run'), 'obj', 'doc', [24, 40, 270, 96], 'file', bi('Список пяти контейнеров, которые должны работать, и памяти, которая нужна каждому из них: два контейнера магазина shop по 512 МБ, два контейнера api по 1 ГБ и один контейнер cache на 2 ГБ. Всё остальное диспетчер выводит из этого списка.', 'Five containers that must run and the memory each needs: shop ×2 (512 MB), api ×2 (1 GB), cache (2 GB). Everything else the dispatcher derives from this list.'), bi('Список составляете вы, когда решаете, из чего состоит сервис.', 'You write the list when you decide what the service consists of.'), { sub: 'shop ×2 · api ×2 · cache' }),
    box('hand', bi('Диспетчер, то есть вы сами', 'The dispatcher, that is you'), 'user', 'box', [430, 52, 240, 72], 'user', bi('Человек с терминалом, который сам выбирает сервер для каждого контейнера, запускает его командой `docker run` и потом время от времени проверяет, что всё работает.', 'A person at a terminal who picks a server for each container, starts it with `docker run` and checks now and then that it works.'), bi('Эту работу делает дежурный инженер.', 'The on-call engineer does it.')),
    box('bot', bi('Диспетчер-программа', 'The dispatcher program'), 'process', 'box', [430, 52, 240, 72], 'process', bi('Программа, которая делает те же три работы, что и человек: выбирает сервер по свободной памяти, каждые несколько секунд проверяет серверы и сверяет то, что работает, со списком.', 'A program doing the same three jobs: picks a server by free memory, checks the servers every few seconds and compares what runs with the list.'), bi('В следующих уроках такой программой будет Kubernetes.', 'In the next lessons this program is Kubernetes.')),
    box('s1', bi('Сервер 1, 4 ГБ', 'Server 1 · 4 GB'), 'node', 'rack', [24, 270, 280, 110], 'server', bi('Машина, на которой для контейнеров есть 4 ГБ памяти.', 'A machine with 4 GB of memory for containers.'), store, { sub: 'shop, api' }),
    box('s2', bi('Сервер 2, 4 ГБ', 'Server 2 · 4 GB'), 'node', 'rack', [340, 270, 280, 110], 'server', bi('Вторая машина с 4 ГБ памяти для контейнеров. Её можно выключить ручкой «Ночью выключается сервер 2».', 'The second machine with 4 GB; the knob “Server 2 goes down at night” turns it off.'), store, { sub: 'shop, api' }),
    box('s3', bi('Сервер 3, 4 ГБ', 'Server 3 · 4 GB'), 'node', 'rack', [656, 270, 280, 110], 'server', bi('Третья машина с 4 ГБ памяти для контейнеров.', 'The third machine with 4 GB of memory.'), store, { sub: 'cache' }),
  ],
  edges: [
    edge('e-read', 'list', 'hand', bi('что запустить', 'what to start'), bi('Диспетчер читает список, потому что без него неизвестно, какие контейнеры и сколько их нужно запустить.', 'The dispatcher reads the list: without it nobody knows what to start and how many.'), bi('Список читает диспетчер.', 'The dispatcher reads it.')),
    edge('e-read2', 'list', 'bot', bi('что запустить', 'what to start'), bi('Программа читает тот же список, что и человек.', 'The program reads the same list.'), bi('Список читает программа.', 'The program reads it.')),
    edge('e-1', 'hand', 's1', bi('запуск и проверка', 'start and check'), bi('По этой линии диспетчер запускает контейнеры на сервере 1 и потом проверяет, что они работают.', 'Along this line the dispatcher starts containers on server 1 and checks them.'), bi('Команды отдаёт диспетчер.', 'The dispatcher.'), { via: [[164, 200]] }),
    edge('e-2', 'hand', 's2', bi('запуск и проверка', 'start and check'), bi('По этой линии диспетчер запускает контейнеры на сервере 2 и проверяет их.', 'Starts and checks containers on server 2.'), bi('Команды отдаёт диспетчер.', 'The dispatcher.'), { labelAt: 0.8 }),
    edge('e-3', 'hand', 's3', bi('запуск и проверка', 'start and check'), bi('По этой линии диспетчер запускает контейнеры на сервере 3 и проверяет их.', 'Starts and checks containers on server 3.'), bi('Команды отдаёт диспетчер.', 'The dispatcher.'), { via: [[796, 200]] }),
  ],
};

const ALL = idsOf(diagram);

export const dispatchModel = defineModel<P>({
  id: 'k8s.dispatch',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как раскладывают контейнеры по серверам', 'How containers are placed on servers'),
  summary: bi(
    'Пять контейнеров нужно разложить по трём серверам так, чтобы всем хватило памяти, потом пережить ночной сбой одного сервера и утром выложить новую версию магазина. Схема показывает, как эту работу делает человек и как её делает программа, и считает, сколько минут на неё уходит.',
    'Five containers must be placed on three servers so that each has enough memory, then a night failure of one server survived and a new shop version rolled out in the morning. The diagram shows a person and a program doing it and counts the minutes.',
  ),
  intro: bi(
    'Сейчас на схеме только список того, что должно работать, и диспетчер, то есть вы сами. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Серверы появятся, когда диспетчер начнёт раскладывать контейнеры. Потом включите в «Параметрах» ночной сбой и выкладку новой версии, а напоследок поручите работу программе и сравните минуты под схемой.',
    'For now the diagram shows only the list of what must run and the dispatcher, that is you. Press “Start from the first step”, then go on with “Step forward”. The servers appear when the dispatcher starts placing containers. Then turn on the night failure and the rollout in “Parameters”, and finally hand the job to a program and compare the minutes under the diagram.',
  ),
  legend: [...LEGEND_BASE, mark('icon:file', 'список того, что должно работать', 'the list of what must run'), mark('icon:user', 'диспетчер-человек', 'the human dispatcher'), mark('icon:process', 'диспетчер-программа', 'the program'), mark('icon:server', 'сервер с памятью для контейнеров', 'a server with memory for containers'), mark('err', 'сервер выключен', 'the server is down')],
  stopLabel: bi('Работа остановилась', 'The work stopped'),
  diagram,
  params: [
    {
      id: 'who',
      label: bi('Кто раскладывает контейнеры', 'Who places the containers'),
      kind: 'choice',
      default: 'hand',
      group: bi('Диспетчер', 'The dispatcher'),
      options: [
        { id: 'hand', label: bi('вы сами, командами в терминале', 'you, with commands') },
        { id: 'auto', label: bi('программа', 'a program') },
      ],
      near: 'hand',
      predict: {
        prompt: bi('Теперь контейнеры раскладывает программа. Сколько из тех работ, что вы делали руками, ей нужно уметь, чтобы заменить вас полностью, в том числе ночью?', 'Now a program places the containers. How many of the jobs you did by hand must it do to replace you fully, at night too?'),
        options: [
          { id: 'three', text: bi('Все три работы, то есть выбирать сервер, следить за серверами и помнить список', 'Three: pick a server, watch the servers, remember the list') },
          { id: 'one', text: bi('Только одну, потому что контейнеры достаточно запустить, а дальше они работают сами', 'One: start the containers, then they run by themselves') },
        ],
        resolve: () => 'three',
      },
    },
    {
      id: 'failure',
      label: bi('Ночью выключается сервер 2', 'Server 2 goes down at night'),
      kind: 'toggle',
      default: false,
      group: bi('Что случается с сервисом', 'What happens to the service'),
      near: 's2',
      predict: {
        prompt: bi('Ночью выключается сервер 2, на котором работали один контейнер shop и один контейнер api. Сколько контейнеров диспетчеру нужно запустить заново и где?', 'Server 2, which ran one shop and one api, goes down at night. How many containers must be started again, and where?'),
        options: [
          { id: 'two', text: bi('Два, на серверах 1 и 3, где хватает свободной памяти', 'Two, on servers 1 and 3, where there is free memory') },
          { id: 'none', text: bi('Ни одного, потому что контейнеры сами перезапустятся на соседних серверах', 'None: the containers move to the neighbours by themselves') },
        ],
        resolve: () => 'two',
      },
    },
    { id: 'update', label: bi('Утром выходит версия 2 магазина, и её нужно выложить, не останавливая сайт', 'In the morning shop v2 comes out and must be rolled out without stopping the site'), kind: 'toggle', default: false, group: bi('Что случается с сервисом', 'What happens to the service'), near: 'list' },
  ],
  breaks: [
    {
      id: 'no-list',
      label: bi('Список того, что должно работать, никто не записал', 'Nobody wrote down the list of what must run'),
      remove: ['list', 'e-read', 'e-read2'],
      boundary: 'storage',
      predict: {
        prompt: bi('Список того, что должно работать, нигде не записан. Сможет ли диспетчер, человек или программа, разложить контейнеры по серверам?', 'The list of what must run is written down nowhere. Can the dispatcher, a person or a program, place the containers?'),
        options: [
          { id: 'no', text: bi('Нет, потому что неизвестно, какие контейнеры и сколько их запускать', 'No, because nobody knows which containers to start and how many') },
          { id: 'yes', text: bi('Да, потому что программа сама найдёт на серверах образы и запустит их', 'Yes, because a program finds the images on the servers and starts them') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [{ id: 'minutes', label: bi('минут ушло на работу', 'minutes of work') }],
  run(p, broken): Step[] {
    const hand = p.who === 'hand';
    const me = hand ? 'hand' : 'bot';
    const read = hand ? 'e-read' : 'e-read2';
    const s: Step[] = [];
    /** By hand the work takes minutes, a program does it in seconds (a hundredth of the time). */
    const t = (handMin: number) => (hand ? handMin : Math.round(handMin * 10) / 600);
    let total = 0;
    const minutes = () => ({ minutes: Math.round(total * 100) / 100 });
    const first = only(ALL, 'list', me);
    if (broken.has('no-list')) {
      s.push({
        id: 'lost',
        label: bi('нет списка', 'no list'),
        caption: bi('Диспетчер собирается разложить контейнеры, но списка того, что должно работать, нет, потому что о нём помнили только люди, а записать его никто не успел. Поэтому неизвестно, какие контейнеры нужны и сколько их, и работа останавливается, не начавшись.', 'The dispatcher is about to place containers, but there is no list: only people remembered it. Nobody knows which containers are needed and how many, so the work stops before it starts.'),
        focus: [me],
        say: { [me]: bi('Диспетчер ищет список того, что должно работать, и не находит его.', 'The dispatcher looks for the list and finds none.') },
        states: { ...first, list: 'err' },
        metrics: { minutes: 0 },
        broken: { at: 'list', message: 'cat /srv/ops/services.txt: No such file or directory', caption: bi('ещё до первого запуска. Без описания того, что должно работать, диспетчеру не на что опереться: он не знает, какие контейнеры раскладывать и какие восстанавливать после сбоя. Поэтому сначала нужен список, а всё остальное потом.', 'before the first start: without a description of what must run there is nothing to place or restore from; the list comes first.') },
      });
      return s;
    }
    s.push({
      id: 'list',
      label: bi('список', 'list'),
      caption: bi('Всё начинается со списка, в котором записаны пять контейнеров и память, которая нужна каждому из них. Всего контейнерам нужно 5 ГБ, а на трёх серверах есть 12 ГБ, так что место найдётся, если разложить контейнеры с умом.', 'It starts with the list: five containers and the memory each needs, 5 GB in all, while the three servers have 12 GB.'),
      focus: ['list'],
      say: { list: bi('В списке два контейнера shop по 512 МБ, два контейнера api по 1 ГБ и один контейнер cache на 2 ГБ.', 'The list: shop ×2 at 512 MB, api ×2 at 1 GB, cache at 2 GB.') },
      states: first,
      metrics: minutes(),
    });
    s.push({
      id: 'read',
      label: bi('прочитать', 'read'),
      caption: hand ? bi('Вы читаете список и прикидываете, какой контейнер на какой сервер поставить, чтобы ни на одном сервере не кончилась память.', 'You read the list and work out where each container goes so no server runs out of memory.') : bi('Программа читает тот же список и сама считает, сколько памяти свободно на каждом сервере.', 'The program reads the same list and counts the free memory on each server itself.'),
      focus: [read, me],
      reveal: [read],
      tokens: [{ edge: read, label: bi('5 контейнеров', '5 containers') }],
      say: { [me]: hand ? bi('Вы складываете память: один контейнер shop и один контейнер api вместе занимают 1,5 ГБ, а один контейнер cache занимает 2 ГБ.', 'You add up: shop and api take 1.5 GB together, cache alone 2 GB.') : bi('Программа сравнивает нужную память со свободной на каждом сервере.', 'The program compares the memory needed with the free memory on each server.') },
      metrics: minutes(),
    });
    total += t(15);
    s.push({
      id: 'place',
      label: bi('разложить', 'place'),
      caption: hand
        ? bi('Вы запускаете контейнеры командой `docker run`: shop и api на серверах 1 и 2, cache на сервере 3. На это уходит около 15 минут, потому что каждый запуск нужно набрать и проверить.', 'You start the containers with `docker run`: shop and api on servers 1 and 2, cache on server 3. About 15 minutes, since each start has to be typed and checked.')
        : bi('Программа раскладывает те же пять контейнеров так же, как вы, но за несколько секунд, потому что ей не нужно ничего набирать руками.', 'The program places the same five containers in a few seconds.'),
      focus: [me, 'e-1', 'e-2', 'e-3'],
      reveal: ['s1', 's2', 's3', 'e-1', 'e-2', 'e-3'],
      tokens: [
        { edge: 'e-1', label: 'shop, api' },
        { edge: 'e-2', label: 'shop, api' },
        { edge: 'e-3', label: 'cache' },
      ],
      say: { [me]: bi('Диспетчер запускает shop и api на первых двух серверах, а cache на третьем.', 'The dispatcher starts shop and api on the first two servers and cache on the third.') },
      values: { s1: tr(bi('shop, api · 1,5 из 4 ГБ', 'shop, api · 1.5 / 4 GB')), s2: tr(bi('shop, api · 1,5 из 4 ГБ', 'shop, api · 1.5 / 4 GB')), s3: tr(bi('cache · 2 из 4 ГБ', 'cache · 2 / 4 GB')) },
      metrics: minutes(),
    });
    if (p.failure) {
      s.push({
        id: 'dark',
        label: bi('сбой', 'failure'),
        caption: bi('Ночью сервер 2 выключается, и вместе с ним останавливаются один контейнер shop и один контейнер api. Магазин пока отвечает с сервера 1, но уже без запаса.', 'At night server 2 goes down with one shop and one api. The shop still answers from server 1, but with no reserve.'),
        focus: ['s2'],
        say: { s2: bi('Сервер 2 не отвечает, и контейнеры shop и api на нём остановились.', 'Server 2 does not answer; its shop and api have stopped.') },
        states: { s2: 'err', 'e-2': 'err' },
        values: { s2: tr(bi('выключен', 'down')) },
        metrics: minutes(),
      });
      s.push({
        id: 'notice',
        label: bi('заметить', 'notice'),
        caption: hand
          ? bi('Ночью за серверами никто не смотрит, поэтому о сбое вы узнаёте только утром, когда звонят клиенты. Всё это время у магазина нет запаса, и второй сбой оставил бы его без единого контейнера.', 'Nobody watches at night, so you learn of the failure in the morning from customers.')
          : bi('Программа проверяет серверы каждые несколько секунд и замечает сбой меньше чем через минуту, ночью так же, как днём.', 'The program checks the servers every few seconds and notices within a minute, at night as by day.'),
        focus: [me],
        say: { [me]: hand ? bi('Вы узнаёте о сбое от клиентов, которые звонят утром.', 'You learn of it from customers calling in the morning.') : bi('Программа видит, что сервер 2 не ответил на проверку, и сверяет работающие контейнеры со списком.', 'The program sees server 2 missed its check and compares what runs with the list.') },
        metrics: minutes(),
      });
      total += t(25);
      s.push({
        id: 'move',
        label: bi('переложить', 'move'),
        caption: hand
          ? bi('Вы сверяете список с тем, что осталось, и запускаете недостающие контейнеры там, где хватает памяти: api на сервере 1, shop на сервере 3. Это ещё около 25 минут.', 'You compare the list with what is left and start the missing containers where memory allows: api on server 1, shop on server 3. About 25 more minutes.')
          : bi('Программа видит, что по списку не хватает одного shop и одного api, и запускает их на серверах 1 и 3, где хватает памяти.', 'The program sees one shop and one api missing and starts them on servers 1 and 3.'),
        focus: [me, 'e-1', 'e-3'],
        tokens: [
          { edge: 'e-1', label: 'api' },
          { edge: 'e-3', label: 'shop' },
        ],
        say: { [me]: bi('Диспетчер запускает недостающие api и shop на серверах, где ещё есть память.', 'The dispatcher starts the missing api and shop where there is memory.') },
        values: { s1: tr(bi('shop, api, api · 2,5 из 4 ГБ', 'shop, api, api · 2.5 / 4 GB')), s3: tr(bi('cache, shop · 2,5 из 4 ГБ', 'cache, shop · 2.5 / 4 GB')) },
        states: { s1: 'ok', s3: 'ok' },
        metrics: minutes(),
      });
    }
    if (p.update) {
      total += t(20);
      const where = p.failure ? ['e-1', 'e-3'] : ['e-1', 'e-2'];
      s.push({
        id: 'update',
        label: bi('версия 2', 'version 2'),
        caption: hand
          ? bi('Утром выходит версия 2 магазина. Вы заменяете контейнеры shop по одному: запускаете новый, проверяете, что он отвечает, и только потом останавливаете старый. Так сайт всё время работает, но на две замены уходит около 20 минут.', 'Shop v2: you replace the shop containers one at a time, start new, check, stop old. The site keeps working, but it takes about 20 minutes.')
          : bi('Программа заменяет контейнеры shop по одному тем же способом, что и вы, и сама проверяет, что каждый новый контейнер отвечает.', 'The program replaces the shop containers one by one the same way and checks each new one itself.'),
        focus: [me, ...where],
        tokens: where.map((e) => ({ edge: e, label: 'shop v2' })),
        say: { [me]: bi('Диспетчер запускает новый контейнер shop, проверяет его и только потом останавливает старый.', 'The dispatcher starts a new shop, checks it, then stops the old one.') },
        values: { list: 'shop v2 ×2 · api ×2 · cache' },
        metrics: minutes(),
      });
    }
    s.push({
      id: 'three',
      label: bi('три работы', 'three jobs'),
      caption: bi('Оглянитесь на пройденные шаги: диспетчер выбирал сервер для каждого контейнера, следил, чтобы серверы работали, и держал перед глазами список. Эти три работы Kubernetes делает вместо вас, и в следующих уроках у каждой появится своё имя.', 'Look back: the dispatcher chose a server for each container, watched the servers and kept the list at hand. Kubernetes does these three jobs for you; each gets a name in the next lessons.'),
      focus: [me],
      say: { [me]: bi('Диспетчер выбирает место, следит за серверами и помнит список, и так всё время, пока работает сервис.', 'The dispatcher picks a place, watches the servers and remembers the list, for as long as the service runs.') },
      metrics: minutes(),
    });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Списка больше нет, и диспетчер останавливается на первом же шаге, потому что ему неизвестно, что запускать. Всё остальное держится на этом описании.', 'Without the list the dispatcher stops at the first step: it does not know what to start.')
        : bi('Список снова записан, и диспетчер может разложить контейнеры.', 'The list is back; the containers can be placed.');
    if (change.id === 'who')
      return fmt(
        b.who === 'hand' ? bi('Работу снова делаете вы, и вместо {a} мин на те же действия уходит {b} мин.', 'You do it again: {a} → {b} min for the same work.') : bi('Работу делает программа, и вместо {a} мин вашего времени на те же действия уходит {b} мин работы программы, причём без вашего участия и ночью так же, как днём. Ждать замену после сбоя всё равно приходится: настоящий кластер, как покажет урок об устройстве кластера, переносит контейнеры с выключенного сервера примерно через шесть минут, потому что сначала убеждается, что сервер не вернётся сам.', 'A program does it: instead of {a} min of your time the same actions take {b} min of the program’s work, without you and at night just as by day. You still wait for the replacement after a failure: a real cluster, as the lesson on the cluster’s parts shows, moves containers off a dead server after about six minutes, because it first makes sure the server will not come back by itself.'),
        { a: metric(prev, 'minutes'), b: metric(next, 'minutes') },
      );
    return fmtb(bi('Работы стало {d}, и теперь на неё уходит {m} мин.', 'The work changed: now {m} min.'), { d: metric(next, 'minutes') > metric(prev, 'minutes') ? bi('больше', 'more') : bi('меньше', 'less'), m: metric(next, 'minutes') });
  },
});
