// KM00 (05 §4.2), without a single Kubernetes term: three servers, five
// containers, a list of what must run. By hand you place them, notice a dead
// server, move its containers, update one by one; a system does the same
// three jobs — choose a place, keep it running, remember the list — in
// seconds. The three jobs become the scheduler, the controller and the
// desired state in the next lessons.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { edge, metric, node } from './kit';

type P = { who: string; failure: boolean; update: boolean };

export const dispatchModel = defineModel<P>({
  id: 'k8s.dispatch',
  block: 'k8s-1',
  title: bi('Диспетчер вручную и диспетчер-программа', 'A dispatcher by hand and a dispatcher program'),
  summary: bi('Пять контейнеров, три сервера и список «что должно работать». Сравните, сколько это занимает руками и как то же делает программа.', 'Five containers, three servers and a list of "what must run". Compare how long it takes by hand and how a program does the same.'),
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      node('list', bi('список «что должно работать»', 'the list of "what must run"'), 'obj', 'doc', 24, 30, 260, 110, bi('Пять контейнеров с нужной памятью: shop ×2 (512 МБ), api ×2 (1 ГБ), cache (2 ГБ). Это и есть описание, которое надо держать.', 'Five containers with the memory they need: shop ×2 (512 MB), api ×2 (1 GB), cache (2 GB). This is the description that has to be kept.'), bi('вы', 'you'), undefined, undefined, '5 containers'),
      node('who', bi('кто раскладывает', 'who places them'), 'process', 'box', 360, 50, 240, 70, bi('Человек с терминалом или программа: делает одни и те же три вещи.', 'A person with a terminal or a program: does the same three things.'), bi('вы или система', 'you or a system'), undefined, undefined, 'by hand'),
      node('s1', bi('сервер 1 · 4 ГБ', 'server 1 · 4 GB'), 'node', 'rack', 24, 230, 280, 120, bi('Машина с 4 ГБ памяти для контейнеров.', 'A machine with 4 GB of memory for containers.'), bi('ЦОД или облако', 'a data centre or a cloud'), undefined, undefined, 'shop, api'),
      node('s2', bi('сервер 2 · 4 ГБ', 'server 2 · 4 GB'), 'node', 'rack', 340, 230, 280, 120, bi('Машина с 4 ГБ памяти.', 'A machine with 4 GB of memory.'), bi('ЦОД или облако', 'a data centre or a cloud'), undefined, undefined, 'shop, api'),
      node('s3', bi('сервер 3 · 4 ГБ', 'server 3 · 4 GB'), 'node', 'rack', 656, 230, 280, 120, bi('Машина с 4 ГБ памяти.', 'A machine with 4 GB of memory.'), bi('ЦОД или облако', 'a data centre or a cloud'), undefined, undefined, 'cache'),
    ],
    edges: [
      edge('e-read', 'list', 'who', bi('читает список', 'read the list'), bi('Чтобы что-то разложить, надо знать, что должно работать.', 'To place anything you have to know what must run.'), bi('диспетчер', 'the dispatcher')),
      edge('e-1', 'who', 's1', bi('запустить · проверять', 'start · check'), bi('Запустить контейнер здесь и потом проверять, что он жив.', 'Start a container here and then keep checking that it is alive.'), bi('диспетчер', 'the dispatcher')),
      edge('e-2', 'who', 's2', bi('запустить · проверять', 'start · check'), bi('Запустить контейнер здесь и проверять.', 'Start a container here and keep checking.'), bi('диспетчер', 'the dispatcher')),
      edge('e-3', 'who', 's3', bi('запустить · проверять', 'start · check'), bi('Запустить контейнер здесь и проверять.', 'Start a container here and keep checking.'), bi('диспетчер', 'the dispatcher')),
    ],
  },
  params: [
    { id: 'who', label: bi('Кто раскладывает', 'Who places them'), kind: 'choice', default: 'hand', options: [{ id: 'hand', label: bi('вы, руками', 'you, by hand') }, { id: 'auto', label: bi('программа', 'a program') }], near: 'who', predict: { prompt: bi('Теперь раскладывает программа. Что она должна уметь, чтобы заменить вас?', 'Now a program places them. What must it be able to do to replace you?'), options: [{ id: 'three', text: bi('Выбрать место, следить, помнить список', 'Choose a place, keep watch, remember the list') }, { id: 'one', text: bi('Только запустить контейнеры', 'Only start the containers') }], resolve: () => 'three' } },
    { id: 'failure', label: bi('Сервер 2 гаснет', 'Server 2 goes dark'), kind: 'toggle', default: false, near: 's2', predict: { prompt: bi('Сервер 2 погас. Сколько контейнеров надо переложить и куда они поместятся?', 'Server 2 went dark. How many containers must be moved, and where do they fit?'), options: [{ id: 'two', text: bi('Два, на серверы 1 и 3 — если хватит памяти', 'Two, onto servers 1 and 3 — if there is enough memory') }, { id: 'none', text: bi('Ни одного, они переедут сами', 'None, they move by themselves') }], resolve: () => 'two' } },
    { id: 'update', label: bi('Выкатить версию 2 по одному', 'Roll out version 2 one by one'), kind: 'toggle', default: false, near: 'list' },
  ],
  breaks: [
    { id: 'no-list', label: bi('Список потерян', 'The list is lost'), remove: ['list', 'e-read'], boundary: 'storage', predict: { prompt: bi('Списка нет. Сможет ли диспетчер вернуть всё после сбоя?', 'There is no list. Can the dispatcher restore everything after a failure?'), options: [{ id: 'no', text: bi('Нет: неизвестно, что должно работать', 'No: nobody knows what must run') }, { id: 'yes', text: bi('Да, по памяти', 'Yes, from memory') }], resolve: () => 'no' } },
  ],
  metrics: [{ id: 'minutes', label: bi('заняло', 'took'), unit: 'min' }],
  run(p, broken): Step[] {
    const hand = p.who === 'hand';
    const s: Step[] = [];
    const t = (handMin: number) => (hand ? handMin : Math.round(handMin * 10) / 600);
    let total = 0;
    if (broken.has('no-list')) {
      s.push({ id: 'lost', label: bi('нет списка', 'no list'), caption: bi('Что должно работать, записано только в головах — и в выключенном сервере.', 'What must run is written only in people’s heads — and on the server that is off.'), focus: ['who'], states: { list: 'off' }, metrics: { minutes: 0 }, broken: { at: 'list', message: '?', caption: bi('без описания желаемого восстановить систему нечем: сначала нужен список, потом всё остальное.', 'without a description of what is wanted there is nothing to restore the system from: first the list, then everything else.') } });
      return s;
    }
    total += t(15);
    s.push({ id: 'place', label: bi('разложить', 'place'), caption: hand ? bi('Вы читаете список, прикидываете память и запускаете пять контейнеров: shop и api на серверы 1 и 2, cache — на 3. Около 15 минут.', 'You read the list, add up the memory and start five containers: shop and api on servers 1 and 2, cache on 3. About 15 minutes.') : bi('Программа читает список, считает свободную память и запускает пять контейнеров за секунды.', 'The program reads the list, counts free memory and starts five containers in seconds.'), focus: ['list', 'e-read', 'who', 'e-1', 'e-2', 'e-3'], tokens: [{ edge: 'e-1' }, { edge: 'e-2' }, { edge: 'e-3' }], values: { who: hand ? 'by hand' : 'program' }, metrics: { minutes: Math.round(total * 10) / 10 } });
    if (p.failure) {
      s.push({ id: 'dark', label: bi('сбой', 'failure'), caption: hand ? bi('Сервер 2 погас ночью. Узнаете вы об этом, когда позвонят клиенты.', 'Server 2 went dark at night. You learn about it when customers call.') : bi('Сервер 2 погас. Программа проверяет серверы постоянно и замечает это через десятки секунд.', 'Server 2 went dark. The program checks the servers all the time and notices within tens of seconds.'), focus: ['s2'], states: { s2: 'err' }, values: { s2: 'down' } });
      total += t(25);
      s.push({ id: 'move', label: bi('переложить', 'move'), caption: hand ? bi('Вы перезапускаете shop и api с сервера 2 на серверах 1 и 3, следя, чтобы не переполнить память. Ещё около 25 минут.', 'You restart shop and api from server 2 on servers 1 and 3, careful not to overfill the memory. About 25 more minutes.') : bi('Программа сравнивает список с тем, что работает, видит двух недостающих и запускает их там, где хватает памяти.', 'The program compares the list with what is running, sees two missing and starts them where there is enough memory.'), focus: ['e-1', 'e-3', 's1', 's3'], tokens: [{ edge: 'e-1', label: 'api' }, { edge: 'e-3', label: 'shop' }], values: { s1: 'shop, api, api', s3: 'cache, shop' }, metrics: { minutes: Math.round(total * 10) / 10 } });
    }
    if (p.update) {
      total += t(20);
      s.push({ id: 'update', label: bi('версия 2', 'version 2'), caption: hand ? bi('Версию 2 вы выкатываете по одному контейнеру: запустить новый, проверить, остановить старый — пять раз. Около 20 минут, и сервис всё это время работает.', 'You roll out version 2 one container at a time: start a new one, check it, stop an old one — five times. About 20 minutes, and the service keeps working.') : bi('Программа делает ту же замену по одному, сама проверяя каждый новый контейнер.', 'The program does the same one-by-one replacement, checking every new container itself.'), focus: ['list', 'who'], values: { list: '5 containers, v2' }, metrics: { minutes: Math.round(total * 10) / 10 } });
    }
    s.push({ id: 'three', label: bi('три дела', 'three jobs'), caption: bi('Вы делали три вещи: выбирали место для каждого контейнера, следили, чтобы всё работало, и держали в голове список. Именно их Kubernetes делает вместо вас.', 'You did three things: chose a place for every container, watched that everything kept working, and kept the list in your head. These are exactly what Kubernetes does for you.'), focus: ['who', 'list'], metrics: { minutes: Math.round(total * 10) / 10 } });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Без списка нечего восстанавливать: всё держится на описании желаемого.', 'Without the list there is nothing to restore: everything rests on the description of what is wanted.') : bi('Список вернулся.', 'The list is back.');
    if (change.id === 'who')
      return b.who === 'hand'
        ? fmt(bi('Руками: {a} → {b} минут на те же действия.', 'By hand: {a} → {b} minutes for the same actions.'), { a: metric(prev, 'minutes'), b: metric(next, 'minutes') })
        : fmt(bi('Программа: {a} → {b} минут на те же действия.', 'A program: {a} → {b} minutes for the same actions.'), { a: metric(prev, 'minutes'), b: metric(next, 'minutes') });
    return fmt(bi('Теперь {m} минут.', 'Now {m} minutes.'), { m: metric(next, 'minutes') });
  },
});
