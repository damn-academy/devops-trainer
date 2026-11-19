// The final segment (route id `final`): the on-call shift and the capstone
// exam outline (10 §6.4, §6.5).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';

const SRC = {
  sreIncidents: { title: 'Google SRE Book — Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
  srePostmortem: { title: 'Google SRE Book — Postmortem Culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
  sreOncall: { title: 'Google SRE Workbook — On-Call', url: 'https://sre.google/workbook/on-call/' },
  kanbanRu: { title: 'Канбан (разработка) — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%B0%D0%BD%D0%B1%D0%B0%D0%BD_(%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B0)' },
  itilRu: { title: 'ITIL — Википедия', url: 'https://ru.wikipedia.org/wiki/ITIL' },
  kts: { title: 'KTS: как мы перевели собеседования DevOps на тренажёр (Хабр)', url: 'https://habr.com/ru/companies/kts/articles/795277/' },
  kubeadm: { title: 'Kubernetes — Creating a cluster with kubeadm', url: 'https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/' },
  k3s: { title: 'K3s documentation', url: 'https://docs.k3s.io/' },
  tf: { title: 'Terraform — Language documentation', url: 'https://developer.hashicorp.com/terraform/language' },
  argo: { title: 'Argo CD — documentation', url: 'https://argo-cd.readthedocs.io/en/stable/' },
  setupRu: { title: 'Установка Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/' },
  componentsRu: { title: 'Компоненты Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/overview/components/' },
};

export const L_ONCALL: Lesson = {
  id: 'final.oncall',
  block: 'final',
  title: bi('Смена дежурного', 'The on-call shift'),
  summary: bi('Три инцидента с перекрытием за 60 минут: приоритет по влиянию, сначала вернуть сервис, статус команде, разбор без виноватых.', 'Three overlapping incidents in 60 minutes: priority by impact, restore first, status to the team, a blameless review.'),
  introduces: ['career.oncall', 'career.priority', 'career.blameless'],
  uses: [],
  tier: 'core',
  minutes: 75,
  sources: { en: [SRC.sreIncidents, SRC.srePostmortem, SRC.sreOncall], ru: [SRC.kanbanRu, SRC.itilRu, SRC.kts] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Перед итоговым экзаменом — одна [[career.oncall|смена дежурного]]. Это генеральная репетиция и собеседования, и первой работы: за 60 минут придут три инцидента, второй — пока ты разбираешь первый. Проверяется не только починка, но и то, как ты ведёшь себя на дежурстве.',
        'Before the final exam comes one [[career.oncall|on-call shift]]. It is a dress rehearsal for both the interview and the first job: three incidents arrive in 60 minutes, the second while you are still on the first. Not only the fix is checked, but how you behave on call.',
      ),
    },
    {
      id: 'rules',
      kind: 'text',
      step: 'explain',
      title: bi('Правила смены', 'The rules of the shift'),
      body: bi(
        '**Приоритет по влиянию.** Первым берут инцидент, от которого сильнее всего страдают пользователи, а не тот, что пришёл раньше: сломанная оплата важнее диска, который заполнится через четыре часа, а диск важнее красного конвейера, который мешает только выкладкам. Это [[career.priority]]. Отложенный инцидент не забывают, а объявляют в чате: «вижу, возьму после текущего».\n\n**Один инцидент в работе.** На доске дежурного «Новое → Разбираю → Смягчено → Закрыто» в колонке «Разбираю» не больше одной карточки. Переключение между двумя пожарами тушит оба медленнее.\n\n**Метод тот же, что на собеседовании.** Уточнить, подтвердить симптом, назвать уровень по улике, не уничтожать улики, сначала вернуть сервис — откатив то изменение, которое вызвало сбой, — потом чинить и проверить.\n\n**Статус команде** — влияние, что делаем, когда следующий статус.\n\n**Разбор после каждого инцидента** — в четыре строки: хронология, влияние, способствующие факторы, действия. Не «кто виноват» и не одна «корневая причина», а условия системы, которые сделали сбой возможным и не дали его поймать раньше. Это [[career.blameless]].',
        '**Priority by impact.** The incident that hurts users most is taken first, not the one that came first: broken checkout beats a disk that fills in four hours, and the disk beats a red pipeline that only blocks releases. That is [[career.priority]]. A deferred incident is not forgotten but announced in the chat: “seen it, will take it after the current one”.\n\n**One incident in progress.** On the on-call board “New → Investigating → Mitigated → Closed” the Investigating column holds at most one card. Switching between two fires puts both out more slowly.\n\n**The method is the same as at an interview.** Ask, confirm the symptom, name the layer from evidence, do not destroy evidence, restore the service first — by rolling back the change that caused the failure — then fix and verify.\n\n**Status to the team**: impact, what we do, when the next update is.\n\n**A review after each incident** in four lines: timeline, impact, contributing factors, actions. Not “who is to blame” and not a single “root cause”, but the conditions of the system that made the failure possible and kept it from being caught earlier. That is a [[career.blameless]].',
      ),
    },
    {
      id: 'env',
      kind: 'callout',
      tone: 'note',
      title: bi('Где идёт смена', 'Where the shift runs'),
      body: bi('В этой версии курса смена идёт в симуляторе: команды и выбор следующего шага показывают то, что показал бы настоящий сервер для скрытой причины. Полная версия на связанных машинах в браузере придёт вместе с ними; правила и рубрика останутся теми же.', 'In this version of the course the shift runs in the simulator: commands and next-step choices show what a real server would show for the hidden cause. The full version on linked machines in the browser comes with them; the rules and the rubric stay the same.'),
    },
    { id: 'shift', kind: 'widget', step: 'practice', widget: 'career.oncall' },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.priority', 'career.q.blameless', 'career.q.wip'],
    },
  ],
};

export const L_CAPSTONE: Lesson = {
  id: 'final.capstone',
  block: 'final',
  title: bi('Итоговый экзамен: построить, починить, защитить', 'The final exam: build, fix, defend'),
  summary: bi('Три облачные машины, Terraform и Ansible, кластер, конвейер, мониторинг; поломка за 60 минут; защита проекта; обязательная уборка.', 'Three cloud machines, Terraform and Ansible, a cluster, a pipeline, monitoring; a failure in 60 minutes; a project defence; a mandatory cleanup.'),
  introduces: ['career.capstone', 'career.cleanup'],
  uses: ['career.oncall'],
  tier: 'core',
  minutes: 40,
  sources: { en: [SRC.kubeadm, SRC.k3s, SRC.tf, SRC.argo], ru: [SRC.setupRu, SRC.componentsRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '[[career.capstone|Итоговый экзамен]] подтверждает, что ты можешь сделать и защитить небольшую, но настоящую систему. Он идёт на трёх облачных машинах, которые ты сам заказываешь Terraform и настраиваешь Ansible. Тренажёр на этих машинах ничего не исполняет сам: он показывает шаги, считает стоимость и проверяет результат. Здесь — план экзамена; отмечай выполненное, отметки сохраняются.',
        'The [[career.capstone|final exam]] confirms that you can build and defend a small but real system. It runs on three cloud machines that you order with Terraform and configure with Ansible yourself. The trainer runs nothing on those machines by itself: it shows the steps, counts the cost and checks the result. Here is the plan of the exam; tick what is done, the ticks are saved.',
      ),
    },
    {
      id: 'a',
      kind: 'text',
      step: 'explain',
      title: bi('Часть А. Построить', 'Part A. Build'),
      body: bi(
        'До 14 дней своим темпом; код и конвейер отлаживаешь у себя на одной машине, а финальная сборка — заказ трёх машин и подъём всего из кода с нуля — укладывается в одну сессию. За основу удобно взять сервис пет-проекта 3.\n\n- **A1.** Публичный репозиторий с README по шаблону.\n- **A2.** Конвейер: линт → тесты → сборка образа с тегом по коммиту → публикация в registry → выкладка; с веток, кроме main, выкладки нет.\n- **A3.** Три машины создаёт Terraform, Ansible готовит узлы; повторный прогон плейбука — `changed=0`, повторный `terraform plan` — `No changes`.\n- **A4.** Кластер из трёх узлов: для новичка и среднего — k3s (один сервер и два агента), для опытного — kubeadm с сетевым плагином и классом хранилища. Приложение выкладывается Helm-чартом через Argo CD.\n- **A4б.** Только опытный: снимок etcd по расписанию и проверенное восстановление, обновление на следующую минорную версию, сроки сертификатов больше 30 дней.\n- **A5.** Мониторинг: дашборд с четырьмя золотыми сигналами, алерт на долю ошибок с `for:`, доставка алерта в мессенджер.\n- **A6.** Базовая безопасность: вход по ключам, пароль выключен, межсетевой экран открывает только нужное, секретов в репозитории нет.\n- **A7.** Задача вне курса по документации: PodDisruptionBudget, распределение подов по узлам или автомасштабирование по CPU.\n- **A8.** Всё поднимается из кода с нуля на пустом проекте.',
        'Up to 14 days at your own pace; you debug the code and pipeline on one machine of your own, and the final build — ordering three machines and bringing everything up from code from scratch — fits in one session. Project 3’s service is a convenient base.\n\n- **A1.** A public repository with a README from the template.\n- **A2.** A pipeline: lint → tests → image build tagged by commit → push to a registry → release; branches other than main do not release.\n- **A3.** Terraform creates three machines, Ansible prepares the nodes; a repeated playbook run gives `changed=0`, a repeated `terraform plan` says `No changes`.\n- **A4.** A three-node cluster: for beginners and intermediates k3s (one server and two agents), for the experienced kubeadm with a network plugin and a storage class. The application is released as a Helm chart through Argo CD.\n- **A4b.** Experienced only: a scheduled etcd snapshot and a tested restore, an upgrade to the next minor version, certificate expiry beyond 30 days.\n- **A5.** Monitoring: a dashboard with the four golden signals, an error-ratio alert with `for:`, the alert delivered to a messenger.\n- **A6.** Basic security: key-only login, passwords off, the firewall opens only what is needed, no secrets in the repository.\n- **A7.** A task beyond the course, from the documentation: a PodDisruptionBudget, spreading pods across nodes, or CPU autoscaling.\n- **A8.** Everything comes up from code from scratch in an empty project.',
      ),
    },
    {
      id: 'bc',
      kind: 'text',
      step: 'explain',
      title: bi('Части Б и В. Починить и защитить', 'Parts B and C. Fix and defend'),
      body: bi(
        '**Часть Б — 60 минут, жёсткий таймер.** В систему вносится одна обратимая поломка, которая не трогает твои данные; полный список возможных поломок и команды отката показываются заранее. Это та же [[career.oncall|смена дежурного]], только на настоящих машинах: после «починил» все проверки части А снова зелёные, данные целы, статус и разбор написаны.\n\n**Часть В — 40 минут.** Мок-интервьюер получает README, схему, файл конвейера и протокол частей А и Б и спрашивает по твоему проекту: что k3s спрятал от тебя по сравнению с kubeadm (или что ты получил и потерял, выбрав kubeadm); что будет, если упадёт узел с Prometheus; как откатить выкладку; где здесь единая точка отказа; что бы ты сделал иначе. Порог — средний балл не ниже 2 из 3 и ни одного нуля по честности. Ту же защиту стоит пройти и с живым человеком.',
        '**Part B — 60 minutes, hard timer.** One reversible failure that does not touch your data is planted in the system; the full list of possible failures and their rollback commands is shown in advance. It is the same [[career.oncall|on-call shift]], only on real machines: after “fixed”, every check of part A is green again, the data is intact, the status and the review are written.\n\n**Part C — 40 minutes.** The mock interviewer gets the README, the diagram, the pipeline file and the protocol of parts A and B and asks about your project: what k3s hid from you compared with kubeadm (or what you gained and lost by choosing kubeadm); what happens if the node running Prometheus fails; how to roll back a release; where the single point of failure is; what you would do differently. To pass: a mean score of at least 2 of 3 and no zero for honesty. It is worth doing the same defence with a live person too.',
      ),
    },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      title: bi('Стоимость', 'Cost'),
      body: bi('До заказа посчитай «3 машины × размер × часы» у выбранного провайдера и отдельно — цену суток, если забыть удалить. Требования к узлам kubeadm — не меньше 2 vCPU и 2 ГБ памяти на управляющий узел. Всё, что можно, отлаживай на одной машине: финальная сборка из кода — одна сессия, а не две недели аренды.', 'Before ordering, work out “3 machines × size × hours” at your chosen provider, and separately the price of a day if you forget to delete them. kubeadm needs at least 2 vCPUs and 2 GB of memory on the control-plane node. Debug whatever you can on one machine: the final build from code is one session, not two weeks of rent.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      title: bi('Уборка — обязательна', 'Cleanup is mandatory'),
      body: bi('Протокол не выдаётся, пока не сделана [[career.cleanup|уборка]]: последняя строка `terraform destroy` — `Destroy complete! Resources: N destroyed.`, где N совпадает с числом ресурсов в state, затем пустой `terraform state list` и пустой список машин провайдера по метке экзамена. Если хочешь оставить сервис живым для работодателя, оставь одну машину и знай её месячную цену.', 'The protocol is not issued until the [[career.cleanup|cleanup]] is done: the last line of `terraform destroy` reads `Destroy complete! Resources: N destroyed.` where N equals the number of resources in the state, then an empty `terraform state list` and an empty list of provider machines with the exam label. If you want to keep the service alive for employers, keep one machine and know its monthly price.'),
    },
    { id: 'checklist', kind: 'widget', step: 'practice', widget: 'career.checklist', props: { kind: 'capstone' } },
    {
      id: 'protocol',
      kind: 'text',
      step: 'exit',
      body: bi(
        'Итог — протокол: что проверено, какие проверки прошли, режим работы («экзамен» или «тренировка»), ссылки на репозиторий и живой сервис, итог защиты с цитатами, отметка уборки. Протокол — не сертификат, и мы так его и называем: работодателю нужен не значок, а репозиторий, который он может открыть, и человек, который его объяснит.',
        'The result is a protocol: what was checked, which checks passed, the mode (“exam” or “training”), links to the repository and the live service, the defence result with quotes, the cleanup mark. The protocol is not a certificate, and we call it what it is: an employer needs not a badge but a repository they can open and a person who can explain it.',
      ),
    },
  ],
};
