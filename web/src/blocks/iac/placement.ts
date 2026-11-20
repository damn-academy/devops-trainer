// The placement check of the IaC block (01 §4): its own bank, so that an
// experienced learner does not meet the same questions again in the lessons.
// Practical tasks are checked by the state of the simulated hosts and cloud;
// the options of every question are of comparable length, and each wrong one
// is a real misconception.

import { bi } from '../../core/i18n';
import type { Facts, PlacementTask } from '../../core/types';
import { lastRun } from './ans/command';
import { ansSetup, cloud, host, INV, OPS, SITE_PLAY, TEMPLATE, tf, TF_HEAD, TF_NET, TF_VM, tfSetup } from './content';
import { DRIFT_SETUP, IMPORT_SETUP } from './content-2';

const NO_HANDLER_PLAY = `- name: Web servers serve the cafe site
  hosts: web
  become: true
  tasks:
    - name: nginx is installed
      ansible.builtin.apt:
        name: nginx
        state: present

    - name: The site config is in place
      ansible.builtin.template:
        src: cafe.conf.j2
        dest: /etc/nginx/sites-enabled/cafe.conf

    - name: nginx is running
      ansible.builtin.service:
        name: nginx
        state: started
`;

const plan = (f: Facts) => tf(f)?.lastPlan;
const vms = (f: Facts | undefined) => (f ? cloud(f).filter((r) => r.type === 'edu_vm') : []);

export const iacPlacement: PlacementTask[] = [
  // ── intermediate: has run ready-made code ──
  {
    id: 'iac.place.adhoc',
    level: 'intermediate',
    key: true,
    concepts: ['iac.module', 'iac.inventory'],
    kind: 'task',
    setup: ansSetup({ 'inventory.ini': INV }),
    task: { id: 'p1', prompt: bi('Поставьте пакет `chrony` на все хосты группы db и только на них.', 'Install the `chrony` package on all hosts of the db group and only on them.'), check: { when: (f) => !!host(f, 'db1')?.packages.includes('chrony') && !host(f, 'web1')?.packages.includes('chrony') } },
  },
  {
    id: 'iac.place.dry-run',
    level: 'intermediate',
    key: true,
    concepts: ['iac.check-mode', 'iac.playbook'],
    kind: 'task',
    setup: ansSetup({ 'inventory.ini': INV, 'site.yml': SITE_PLAY, 'templates/cafe.conf.j2': TEMPLATE }),
    task: {
      id: 'p-dry',
      prompt: bi(
        'В каталоге `~/ops` лежит плейбук `site.yml`, который коллега написал для группы web. Прежде чем применять его к рабочим серверам, узнайте, что он изменил бы на хостах, и при этом ничего на них не меняйте.',
        'The directory `~/ops` holds the playbook `site.yml` a colleague wrote for the web group. Before applying it to the production servers, find out what it would change on the hosts, and change nothing on them while doing so.',
      ),
      check: { when: (f) => !!lastRun(f)?.check && !host(f, 'web1')?.packages.includes('nginx') && !host(f, 'web2')?.packages.includes('nginx') },
    },
  },
  {
    id: 'iac.place.tf-run',
    level: 'intermediate',
    key: true,
    concepts: ['iac.plan', 'iac.provider'],
    kind: 'task',
    setup: tfSetup(TF_HEAD + TF_NET + TF_VM),
    task: {
      id: 'p-run',
      prompt: bi('В каталоге `~/infra` лежит готовый код сети и ВМ для облака Edu Cloud, а само облако пока пустое. Создайте всё, что описано в этом коде.', 'The directory `~/infra` holds ready code for a network and a VM in the Edu Cloud, and the cloud itself is still empty. Create everything this code describes.'),
      check: { when: (f) => vms(f).length === 1 && cloud(f).some((r) => r.type === 'edu_network') && (tf(f)?.state.length ?? 0) === 2 },
    },
  },
  {
    id: 'iac.place.recap',
    level: 'intermediate',
    key: false,
    concepts: ['iac.idempotence'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.recap',
      kind: 'mcq',
      concepts: ['iac.idempotence'],
      prompt: bi('Плейбук прогнали дважды подряд, хосты между прогонами никто не трогал, а код не меняли. На втором прогоне PLAY RECAP показывает `changed=1` на каждом хосте. О чём это говорит?', 'The playbook was run twice in a row, nobody touched the hosts in between, and the code did not change. On the second run PLAY RECAP shows `changed=1` on every host. What does that tell you?'),
      options: [
        { id: 'action', text: bi('Одна задача описывает действие, а не состояние, и выполняет его на каждом прогоне', 'One task describes an action rather than a state and performs it on every run'), correct: true },
        { id: 'drift', text: bi('За минуту между прогонами хосты разошлись с описанием, и Ansible вернул их обратно', 'In the minute between the runs the hosts drifted from the description, and Ansible brought them back'), why: bi('Хосты между прогонами никто не трогал, поэтому расходиться им было не с чего. Задача, которая на каждом прогоне отвечает changed, сама меняет хост каждый раз.', 'Nobody touched the hosts between the runs, so they had no reason to drift. A task that answers changed on every run changes the host itself every time.') },
        { id: 'always', text: bi('Ansible всегда отмечает changed одну задачу, потому что заново собирает факты о хосте', 'Ansible always marks one task changed, because it gathers the facts about the host again'), why: bi('Сбор фактов ничего на хосте не меняет и в итоге не считается. Правильный плейбук на втором прогоне даёт `changed=0`.', 'Gathering facts changes nothing on the host and does not count in the recap. A correct playbook gives `changed=0` on the second run.') },
        { id: 'unsaved', text: bi('Первый прогон не сохранил изменения на диске хоста, и второй повторил их заново', 'The first run did not save its changes to the host’s disk, and the second one repeated them'), why: bi('Модуль меняет хост сразу, и изменения остаются. Если задача снова отвечает changed, значит, она делает что-то, чего нельзя «уже сделать», например дописывает строку.', 'A module changes the host at once, and the changes stay. If a task answers changed again, it does something that can never be “already done”, such as appending a line.') },
      ],
    },
  },
  {
    id: 'iac.place.replace',
    level: 'intermediate',
    key: false,
    concepts: ['iac.plan'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.replace',
      kind: 'mcq',
      concepts: ['iac.plan'],
      prompt: bi('План кончается строкой `Plan: 1 to add, 0 to change, 1 to destroy.`, а рядом с ВМ web стоит знак `-/+`. Что случится с машиной при apply?', 'The plan ends with `Plan: 1 to add, 0 to change, 1 to destroy.`, and the VM web is marked `-/+`. What happens to the machine on apply?'),
      options: [
        { id: 'new', text: bi('Её удалят и создадут вместо неё новую машину с новым ID', 'It is deleted and a new machine with a new ID is created in its place'), correct: true },
        { id: 'inplace', text: bi('Её изменят на месте, а потом перезагрузят, чтобы правка вступила в силу', 'It is changed in place and then rebooted so that the edit takes effect'), why: bi('Изменение на месте план помечает знаком `~` и считает в «to change». Знак `-/+` и пара «1 to add, 1 to destroy» означают пересоздание.', 'An in-place change is marked `~` and counted under “to change”. The sign `-/+` and the pair “1 to add, 1 to destroy” mean a replacement.') },
        { id: 'second', text: bi('Terraform создаст вторую такую же машину, а первую удалит, когда та освободится', 'Terraform creates a second machine like it and deletes the first when it becomes free'), why: bi('Новая машина заменяет старую в том же адресе. Ждать, пока машина «освободится», Terraform не умеет, а порядок «сначала новая» включают отдельно, блоком lifecycle.', 'The new machine replaces the old one at the same address. Terraform does not wait for a machine to “become free”; the order “new one first” is switched on separately, with a lifecycle block.') },
        { id: 'ask', text: bi('Terraform остановится и спросит, какую из двух машин оставить в облаке', 'Terraform stops and asks which of the two machines to keep in the cloud'), why: bi('План уже сказал, что произойдёт, и apply спрашивает только одно: применять ли этот план целиком.', 'The plan has already said what will happen, and apply asks only one thing: whether to apply this plan as a whole.') },
      ],
    },
  },
  {
    id: 'iac.place.wait',
    level: 'intermediate',
    key: false,
    concepts: ['iac.operation'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.wait',
      kind: 'mcq',
      concepts: ['iac.operation'],
      prompt: bi('Скрипт создаёт ВМ запросом к API облака, передаёт в запросе ключ SSH, получает ответ `202 Accepted` и сразу запускает `ssh` на новую машину. Соединение не устанавливается. В чём ошибка скрипта?', 'A script creates a VM with a request to the cloud API, passes an SSH key in the request, gets `202 Accepted` and immediately runs `ssh` to the new machine. The connection is not established. What is wrong with the script?'),
      options: [
        { id: 'wait', text: bi('Он не дождался, пока операция создания машины перейдёт в статус DONE', 'It did not wait for the creation operation to reach the status DONE'), correct: true },
        { id: 'refused', text: bi('Ответ 202 означает, что облако отказало, и машину вовсе не создали', 'The answer 202 means the cloud refused, and the machine was never created'), why: bi('Коды, которые начинаются с 2, означают успех. Ответ 202 значит «запрос принят, работа идёт», а результат сообщит операция.', 'Codes starting with 2 mean success. 202 means “the request is accepted, the work is going on”, and the operation reports the result.') },
        { id: 'key', text: bi('Ключ SSH облако добавляет на машину только после её первой перезагрузки', 'The cloud adds the SSH key to the machine only after its first reboot'), why: bi('Ключ попадает на машину при первой загрузке. Соединение не устанавливается потому, что машина ещё загружается.', 'The key reaches the machine at its first boot. The connection fails because the machine is still booting.') },
        { id: 'addr', text: bi('Облако сменит адрес машины после загрузки, поэтому ssh ушёл не туда', 'The cloud changes the machine’s address after boot, so ssh went to the wrong place'), why: bi('Адрес машины не меняется при загрузке. Пока операция не закончилась, по этому адресу ещё никто не отвечает.', 'The address does not change at boot. Until the operation is over, nobody answers at that address yet.') },
      ],
    },
  },

  // ── experienced: has written small configurations ──
  {
    id: 'iac.place.tf',
    level: 'experienced',
    key: true,
    concepts: ['iac.plan', 'iac.resource'],
    kind: 'task',
    setup: tfSetup(TF_HEAD + TF_NET),
    task: { id: 'p2', prompt: bi('Добавьте в код ВМ `api` с образом ubuntu-24.04 и двумя ядрами, подключите её к сети `edu_network.main` и создайте эту машину.', 'Add to the code a VM `api` with the ubuntu-24.04 image and two cores, connect it to the network `edu_network.main` and create the machine.'), check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.name === 'api') } },
  },
  {
    id: 'iac.place.accept-drift',
    level: 'experienced',
    key: true,
    concepts: ['iac.drift', 'iac.state'],
    kind: 'task',
    setup: DRIFT_SETUP,
    task: {
      id: 'p-drift',
      prompt: bi(
        'Ночью дежурный поставил ВМ web четыре ядра в консоли облака, а в коде по-прежнему записано два. Команда решила оставить четыре ядра. Сделайте так, чтобы `terraform plan` показывал `No changes`, а у машины в облаке остались четыре ядра.',
        'At night the on-call engineer gave the VM web four cores in the cloud console, while the code still says two. The team decided to keep four cores. Make `terraform plan` show `No changes`, with the machine in the cloud still having four cores.',
      ),
      check: { when: (f) => vms(f).some((r) => r.attrs.name === 'web' && r.attrs.cores === 4) && !!plan(f) && plan(f)!.add + plan(f)!.change + plan(f)!.destroy === 0 },
    },
  },
  {
    id: 'iac.place.handler',
    level: 'experienced',
    key: true,
    concepts: ['iac.handler'],
    kind: 'task',
    setup: ansSetup({ 'inventory.ini': INV + '\n[web:vars]\nhttp_port=8080\n', 'site.yml': NO_HANDLER_PLAY, 'templates/cafe.conf.j2': TEMPLATE }),
    task: {
      id: 'p-handler',
      prompt: bi(
        'Плейбук `site.yml` раскладывает конфигурацию nginx, но nginx её не перечитывает, и новая конфигурация начинает работать только после перезагрузки сервера. Сделайте так, чтобы nginx перезагружал конфигурацию (`state: reloaded`) после каждого её изменения и только тогда, и прогоните плейбук.',
        'The playbook `site.yml` lays out the nginx config, but nginx does not reread it, and a new config takes effect only after the server reboots. Make nginx reload its config (`state: reloaded`) after every change of it and only then, and run the playbook.',
      ),
      check: {
        when: (f) => {
          const r = lastRun(f);
          const play = f.files[`${OPS}/site.yml`]?.text ?? '';
          return /notify:/.test(play) && /handlers:/.test(play) && !!r && !r.check && r.tasks.some((x) => x.handler && x.status === 'changed') && Object.values(r.recap).every((x) => x.failed === 0);
        },
      },
    },
  },
  {
    id: 'iac.place.adopt',
    level: 'experienced',
    key: false,
    concepts: ['iac.import'],
    kind: 'task',
    setup: IMPORT_SETUP,
    task: {
      id: 'p-adopt',
      prompt: bi('Кроме ВМ web, описанной в коде, в облаке работает машина legacy, которую создали вручную, и её покажет команда `edu vm list`. Возьмите её под управление кода как `edu_vm.legacy`, не создавая новых машин. В конце `terraform plan` должен показать `No changes`.', 'Besides the VM web described in the code, the cloud runs a machine legacy made by hand; `edu vm list` shows it. Take it under the code’s management as `edu_vm.legacy` without creating new machines. At the end `terraform plan` must show `No changes`.'),
      check: {
        when: (f, start) => {
          const legacy = vms(start).find((r) => r.attrs.name === 'legacy');
          const p = plan(f);
          return !!legacy && tf(f)?.state.find((s) => s.address === 'edu_vm.legacy')?.id === legacy.id && vms(f).length === 2 && !!p && p.add + p.change + p.destroy === 0 && !p.applied;
        },
      },
    },
  },
  {
    id: 'iac.place.state-rm',
    level: 'experienced',
    key: true,
    concepts: ['iac.state'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.state-rm',
      kind: 'mcq',
      concepts: ['iac.state'],
      prompt: bi('Коллега выполнил `terraform state rm edu_vm.web`, а код и облако не трогал. Машина web по-прежнему работает. Что предложит следующий `terraform plan`?', 'A colleague ran `terraform state rm edu_vm.web` and touched neither the code nor the cloud. The machine web is still running. What will the next `terraform plan` propose?'),
      options: [
        { id: 'create', text: bi('Создать ещё одну ВМ web, потому что о работающей Terraform больше не знает', 'Create one more VM web, because Terraform no longer knows about the running one'), correct: true },
        { id: 'none', text: bi('Ничего, потому что машина в облаке осталась такой же, как в коде', 'Nothing, because the machine in the cloud is still the same as in the code'), why: bi('Terraform сравнивает код с тем, что записано в state, а записи о машине больше нет. Для него адрес `edu_vm.web` пуст, и план предлагает его заполнить.', 'Terraform compares the code with what the state records, and the record of the machine is gone. For it the address `edu_vm.web` is empty, and the plan proposes to fill it.') },
        { id: 'delete', text: bi('Удалить машину из облака, потому что записи о ней в state уже нет', 'Delete the machine from the cloud, because there is no record of it in the state any more'), why: bi('Удалить Terraform может только то, что записано в state. Машина без записи для него не существует, поэтому трогать её он не станет.', 'Terraform can delete only what the state records. A machine without a record does not exist for it, so it will not touch it.') },
        { id: 'find', text: bi('Найти машину в облаке по имени web и снова записать её в state', 'Find the machine in the cloud by the name web and write it into the state again'), why: bi('По именам и атрибутам Terraform объекты не ищет. Вернуть машину в state можно только явно, блоком import или командой `terraform import`.', 'Terraform does not look objects up by names or attributes. The machine can return to the state only explicitly, with an import block or `terraform import`.') },
      ],
      explain: bi('Связь адреса в коде с объектом в облаке хранится только в state. Команда `state rm` разрывает эту связь, не трогая облако.', 'The link between an address in the code and an object in the cloud is kept only in the state. `state rm` breaks that link without touching the cloud.'),
    },
  },
  {
    id: 'iac.place.play-vars',
    level: 'experienced',
    key: false,
    concepts: ['iac.var-precedence'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.play-vars',
      kind: 'mcq',
      concepts: ['iac.var-precedence'],
      prompt: bi('В `host_vars/web1.yml` записано `http_port: 8081`, а в секции `vars:` сценария для группы web записано `http_port: 9090`. Плейбук запускают без `-e`. Какой порт получит web1?', '`host_vars/web1.yml` says `http_port: 8081`, and the `vars:` section of the play for the web group says `http_port: 9090`. The playbook is run without `-e`. Which port does web1 get?'),
      options: [
        { id: 'play', text: bi('9090, потому что vars сценария стоят выше всего, что задано в инвентаре', '9090, because the play’s vars stand above everything set in the inventory'), correct: true },
        { id: 'host', text: bi('8081, потому что переменная хоста описывает web1 точнее, чем сценарий', '8081, because the host variable describes web1 more precisely than the play'), why: bi('Правило «чем точнее, тем выше» действует только внутри инвентаря. Vars сценария задают сознательно, для этого запуска, и они стоят выше host_vars.', 'The rule “the more precise, the higher” holds only inside the inventory. A play’s vars are set deliberately, for this run, and they stand above host_vars.') },
        { id: 'error', text: bi('Ansible остановится с ошибкой, потому что одна переменная задана дважды', 'Ansible stops with an error, because one variable is set twice'), why: bi('Одна переменная в нескольких местах встречается постоянно, и для этого и нужен приоритет. Ansible выбирает значение с самой высокой ступени.', 'One variable in several places is common, and that is what precedence is for. Ansible picks the value from the highest step.') },
        { id: 'last', text: bi('То значение, которое Ansible прочитал последним, а это host_vars', 'Whichever value Ansible read last, and that is host_vars'), why: bi('Порядок чтения файлов ничего не решает. Значение выбирается по ступени, на которой оно задано.', 'The order in which files are read decides nothing. The value is chosen by the step it is set on.') },
      ],
    },
  },
  {
    id: 'iac.place.no-lock',
    level: 'experienced',
    key: true,
    concepts: ['iac.remote-state', 'iac.state-lock'],
    kind: 'quiz',
    item: {
      id: 'iac.place.q.no-lock',
      kind: 'mcq',
      concepts: ['iac.state-lock'],
      prompt: bi('State лежит в общем бакете, но блокировка в backend не настроена. Два инженера одновременно запускают apply с разными правками. Что может случиться?', 'The state is in a shared bucket, but locking is not set up in the backend. Two engineers run apply at the same time with different edits. What can happen?'),
      options: [
        { id: 'lost', text: bi('Второй apply запишет свой state поверх первого, и созданное первым выпадет из state', 'The second apply writes its state over the first, and what the first created falls out of the state'), correct: true },
        { id: 'wait', text: bi('Второй apply дождётся, пока первый закончит, а потом применит свои правки', 'The second apply waits for the first to finish and then applies its own edits'), why: bi('Ждать умеет только запуск, который видит блокировку. Без неё оба запуска читают одну версию state и пишут каждый свою.', 'Only a run that sees a lock can wait. Without one both runs read the same version of the state and each writes its own.') },
        { id: 'cloud', text: bi('Облако откажет второму запуску кодом 409, поэтому сломаться ничего не может', 'The cloud refuses the second run with 409, so nothing can break'), why: bi('Код 409 облако вернёт, только если два запроса создают объект с одним именем. Разные правки облако примет обе, а потерян будет state.', 'The cloud returns 409 only when two requests create an object with the same name. It accepts different edits, and what gets lost is the state.') },
        { id: 'merge', text: bi('Backend объединит обе версии state, ведь правки касаются разных ресурсов', 'The backend merges both versions of the state, since the edits touch different resources'), why: bi('Backend хранит state одним объектом и ничего не объединяет. Объект, записанный последним, заменяет предыдущий целиком.', 'The backend keeps the state as one object and merges nothing. The object written last replaces the previous one whole.') },
      ],
      explain: bi('Поэтому в блоке backend включают блокировку (`use_lockfile = true` для s3), и второй запуск получает `Error acquiring the state lock`.', 'That is why locking is switched on in the backend block (`use_lockfile = true` for s3), and the second run gets `Error acquiring the state lock`.'),
    },
  },
];
