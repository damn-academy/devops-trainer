// #/about and #/about/<page>: the «Справка» section. Five pages (what the
// course is, how to use it, how it is built, how to run it yourself, how to
// contribute) share one navigation; the texts are in about-content.ts. The
// «How it is built» page carries a diagram of the three kinds of machines in
// which every element is a button that opens its card under the diagram.
// The «?» panel of the top bar stays the quick help and links here.

import './about.css';
import { h } from '../core/dom';
import { bi, t, type Bi } from '../core/i18n';
import { href } from '../core/router';
import { emptyState, prose, setTitle, type Page } from './common';
import { ABOUT_PAGES, ABOUT_TITLE, type AboutPageDef, type AboutPageId } from './about-content';

export { ABOUT_PAGES, ABOUT_TITLE } from './about-content';

export const ABOUT_LINK = bi('Справка о платформе', 'About the platform');

export function aboutHref(page?: AboutPageId): string {
  return href({ name: 'about', page: page && page !== 'what' ? page : undefined });
}

// ── The diagram of «How it is built» ──

interface DgItem {
  id: string;
  label: Bi;
  card: Bi;
  /** Drawn with a dashed border: not used in the course yet. */
  experimental?: boolean;
}

interface DgGroup {
  id: string;
  title: Bi;
  items: DgItem[];
  experimental?: boolean;
}

const it = (id: string, label: Bi, card: Bi, experimental = false): DgItem => ({ id, label, card, experimental });

const SERVER: DgGroup = {
  id: 'server',
  title: bi('Сервер курса', 'The course’s server'),
  items: [
    it(
      'site',
      bi('Статический сайт', 'Static site'),
      bi(
        'Набор файлов, который отдаёт обычный веб-сервер, например nginx: страницы курса, уроки, симуляторы и образы настоящего Linux. Сервера приложений у курса нет, и прогресс учеников на сервер не попадает. Веб-сервер должен отправлять заголовки изоляции страницы, без которых эмулятор v86 не запустится.',
        'A set of files served by an ordinary web server such as nginx: the course pages, lessons, simulators and real Linux images. The course has no application server, and learners’ progress never reaches the server. The web server must send the page isolation headers, without which the v86 emulator does not start.',
      ),
    ),
    it(
      'feedback',
      bi('Сервис обратной связи', 'Feedback service'),
      bi(
        'Необязательная программа на Go, которая принимает сообщения, отправленные кнопкой «Сообщить о проблеме», и показывает их автору на странице администратора. Ответы автора ученик читает на странице «Мои сообщения».',
        'An optional Go program that receives the messages sent with “Report a problem” and shows them to the author on an administration page. The learner reads the author’s replies on the “My messages” page.',
      ),
    ),
  ],
};

const SIMS: DgGroup = {
  id: 'sims',
  title: bi('Симуляторы на TypeScript', 'Simulators in TypeScript'),
  items: [
    it('stand', bi('«Стенд»: Linux', '“Stand”: Linux'), bi('Симулятор Linux с файлами, правами, пользователями, процессами, bash, systemd, пространствами имён и cgroups. На нём идут первые уроки блока Linux, и он работает даже на телефоне.', 'A Linux simulator with files, permissions, users, processes, bash, systemd, namespaces and cgroups. The first lessons of the Linux block run on it, and it works even on a phone.')),
    it('simnet', bi('sim-net: сеть', 'sim-net: network'), bi('Симулятор сети, в котором есть маршруты, netfilter, NAT, ARP, TCP, DNS, HTTP и TLS. Его события рисуют схемы сетевого блока, а результат каждого опыта воспроизводим.', 'A network simulator with routes, netfilter, NAT, ARP, TCP, DNS, HTTP and TLS. Its events draw the diagrams of the networking block, and every experiment gives a reproducible result.')),
    it('dsim', bi('dsim: Docker', 'dsim: Docker'), bi('Симулятор Docker, в котором есть образы из слоёв, сборка с кэшем, сети контейнеров, Compose и реестр образов курса.', 'A Docker simulator with layered images, a build cache, container networks, Compose and the course’s image registry.')),
    it('kubelite', bi('kube-lite: Kubernetes', 'kube-lite: Kubernetes'), bi('Модель Kubernetes с API-сервером, контроллерами, которые ведут настоящие циклы согласования, планировщиком, kubelet, RBAC, StatefulSet и Helm. С ней работает команда kubectl на первом этапе Kubernetes.', 'A Kubernetes model with an API server, controllers that run real reconcile loops, a scheduler, kubelets, RBAC, StatefulSets and Helm. kubectl works against it in the first Kubernetes stage.')),
    it('flowlab', bi('flowlab: Kanban', 'flowlab: Kanban'), bi('Симулятор потока работы команды на доске Kanban для блока методологии: задачи, очереди, выкладки и инциденты.', 'A simulator of a team’s flow of work on a Kanban board for the methodology block: tasks, queues, deploys and incidents.')),
    it('iac', bi('Ansible и Terraform', 'Ansible and Terraform'), bi('Симуляторы Ansible и Terraform. Первый выполняет инвентарь, модули, роли и обработчики, второй читает настоящий HCL, строит план, ведёт состояние и показывает дрейф.', 'The Ansible and Terraform simulators. The first runs inventories, modules, roles and handlers; the second reads real HCL, builds a plan, keeps state and shows drift.')),
  ],
};

const REAL: DgGroup = {
  id: 'real',
  title: bi('Настоящий Linux в v86', 'Real Linux in v86'),
  items: [
    it('v86', bi('Машины v86', 'v86 machines'), bi('Эмулятор 32-битного компьютера x86, в котором работают настоящее ядро Linux 6.18 и Alpine Linux. Каждая машина работает в своём потоке браузера и стартует из снимка загрузки, сделанного при сборке сайта.', 'An emulator of a 32-bit x86 computer that runs the real Linux 6.18 kernel and Alpine Linux. Each machine runs in its own browser thread and starts from a boot snapshot made when the site was built.')),
    it('switch', bi('Коммутатор', 'Switch'), bi('Обучаемый коммутатор второго уровня с таблицей MAC-адресов и виртуальными сетями 802.1Q. Он соединяет сетевые карты машин v86 и узел лаборатории, а каждое его решение видно на схемах.', 'A learning layer-2 switch with a MAC address table and 802.1Q virtual networks. It connects the network cards of the v86 machines and the lab host, and every decision it makes is visible on the diagrams.')),
    it('labhost', bi('Узел лаборатории 10.0.0.1', 'Lab host 10.0.0.1'), bi('Сетевой узел на TypeScript, который работает в странице. Он раздаёт адреса по DHCP, отвечает на запросы DNS для зоны .lab, держит HTTP и зеркало пакетов mirror.lab.', 'A network host written in TypeScript that runs in the page. It hands out addresses over DHCP, answers DNS queries for the .lab zone, and serves HTTP and the package mirror mirror.lab.')),
    it('cloud', bi('Облако api.cloud.lab', 'Cloud api.cloud.lab'), bi('REST API, устроенный как у настоящих облаков. Запрос на создание машины запускает новую машину v86, а провайдер Terraform под названием lab позволяет управлять облаком из кода.', 'A REST API built like those of real clouds. A request to create a machine boots a new v86 machine, and the Terraform provider named lab lets you manage the cloud from code.')),
    it('git', bi('Сервер git.lab', 'git.lab server'), bi('Сервер Git с протоколом smart HTTP. После каждого push он запускает конвейер CI на рабочей машине ученика.', 'A Git server with the smart HTTP protocol. After every push it starts the CI pipeline on the learner’s workstation.')),
  ],
};

const RV64: DgGroup = {
  id: 'rv64',
  title: bi('В разработке', 'In development'),
  experimental: true,
  items: [
    it(
      'rv64',
      bi('Движок RV64', 'RV64 engine'),
      bi(
        'Собственный эмулятор 64-битного процессора RISC-V с JIT-компилятором в WebAssembly. В курсе он пока не используется: он нужен, чтобы однажды запустить во вкладке настоящий Kubernetes, который требует 64-битного процессора.',
        'Our own emulator of a 64-bit RISC-V processor with a JIT compiler to WebAssembly. The course does not use it yet: it is needed to one day run real Kubernetes in the tab, which requires a 64-bit processor.',
      ),
      true,
    ),
  ],
};

const TAB_BASE: DgItem[] = [
  it('check', bi('Проверка целей', 'Goal checks'), bi('Каждая машина отдаёт факты о своём состоянии в формате dt.facts/v1, и цель урока проверяется как условие над этими фактами, а не над набранным текстом. Поэтому одна цель работает в симуляторе, в v86 и на настоящей машине.', 'Every machine gives facts about its state in the dt.facts/v1 format, and a lesson’s goal is checked as a condition over these facts rather than over the typed text. So one goal works in the simulator, in v86 and on a real machine.')),
  it('store', bi('Хранилище браузера', 'Browser storage'), bi('Журнал событий прогресса в IndexedDB и снимки машин в OPFS. Эти данные не покидают браузер, пока вы сами не выгрузите прогресс в файл или не перенесёте его на другое устройство.', 'The progress event log in IndexedDB and the machine snapshots in OPFS. This data does not leave the browser until you export progress to a file or transfer it to another device yourself.')),
];

const HOST: DgGroup = {
  id: 'host',
  title: bi('Ваш компьютер или облако', 'Your computer or a cloud'),
  items: [
    it('dtlab', bi('dtlab', 'dtlab'), bi('Программа на Go, которая запускает машины курса через QEMU, раздаёт курс с вашего компьютера и одной командой убирает всё, что добавила.', 'A Go program that runs the course’s machines through QEMU, serves the course from your computer and removes everything it added with one command.')),
    it('learner', bi('Машина ученика', 'Learner machine'), bi('Виртуальная машина с Linux для экзаменов по Linux и сетям. Её вы администрируете сами, как настоящий сервер.', 'A Linux virtual machine for the Linux and Networks exams. You administer it yourself, like a real server.')),
    it('kubeadm', bi('Узлы kubeadm', 'kubeadm nodes'), bi('Чистые узлы Ubuntu 24.04, на которых вы своими руками собираете кластер Kubernetes на втором этапе блока Kubernetes.', 'Bare Ubuntu 24.04 nodes on which you assemble a Kubernetes cluster by hand in the second stage of the Kubernetes block.')),
    it('kuberoot', bi('Кластер kuberoot', 'kuberoot cluster'), bi('Готовый кластер Kubernetes на дистрибутиве kuberoot со своим ядром, установщиком и API узла. Он нужен блокам о выкладке, GitOps и мониторинге.', 'A ready Kubernetes cluster on the kuberoot distribution, which has its own kernel, installer and node API. The blocks about deploys, GitOps and monitoring need it.')),
    it('cloudvm', bi('Машины в облаке', 'Cloud machines'), bi('Виртуальные машины, которые вы заказываете у своего облачного провайдера вместо dtlab. Курс на них ничего не запускает, а только показывает команды и проверяет результат по фактам.', 'Virtual machines you order from your own cloud provider instead of dtlab. The course runs nothing on them; it only shows commands and checks the result by facts.')),
    it('checker', bi('Скрипт trainer-check.sh', 'trainer-check.sh script'), bi('Скрипт проверки, который только читает состояние машины и печатает блок фактов с одноразовым кодом попытки. Его можно прочитать перед запуском, а dtlab запускает его сам командой dtlab facts.', 'A check script that only reads the state of the machine and prints a block of facts with the attempt’s one-time code. It can be read before it is run, and dtlab runs it itself with dtlab facts.')),
  ],
};

const LINK_DOWN = bi('файлы курса и образы машин', 'course files and machine images');
const LINK_UP = bi('сообщения, которые вы отправили сами', 'messages you sent yourself');
const LINK_FACTS = bi('факты о состоянии машин', 'facts about the machines’ state');
const LINK_HOST = bi('блок фактов, вставленный в поле экзамена или полученный от dtlab', 'a block of facts pasted into the exam or received from dtlab');
const DG_HINT = bi('Нажмите на любой элемент схемы, и здесь появится его объяснение.', 'Press any element of the diagram, and its explanation appears here.');
const DG_CAPTION = bi(
  'Схема показывает, где работает каждая часть курса. Сплошной рамкой обведены части, которые работают в курсе сейчас, а пунктирной рамкой обведён движок, который ещё в разработке. У каждой стрелки подписано, что по ней передаётся.',
  'The diagram shows where each part of the course runs. Solid frames mark the parts the course has today, and a dashed frame marks the engine still in development. The arrows are labelled with what travels along them.',
);

function link(dir: 'down' | 'up' | 'both', ...labels: Bi[]): HTMLElement {
  return h(
    'div.ab-link',
    { 'data-dir': dir },
    ...labels.map((l, i) => h('span.ab-link-label', {}, h('span.ab-arrow', { 'aria-hidden': 'true' }, dir === 'both' ? (i ? '↑' : '↓') : dir === 'down' ? '↓' : '↑'), ' ', t(l))),
  );
}

/** The diagram of the three kinds of machines, with a card for every element. */
export function tiersDiagram(): HTMLElement {
  const card = h('div.ab-card', { 'aria-live': 'polite' }, h('p.muted', {}, t(DG_HINT)));
  const buttons: HTMLButtonElement[] = [];
  const btn = (item: DgItem) => {
    const b = h('button.ab-node', { type: 'button', 'data-node': item.id, 'aria-pressed': 'false' }, t(item.label)) as HTMLButtonElement;
    if (item.experimental) b.classList.add('ab-exp');
    b.addEventListener('click', () => {
      for (const o of buttons) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      card.replaceChildren(h('h3', {}, t(item.label)), h('p', {}, t(item.card)));
    });
    buttons.push(b);
    return b;
  };
  const group = (g: DgGroup) => {
    const el = h('div.ab-group', { 'data-group': g.id }, h('p.ab-group-title', {}, t(g.title)), h('div.ab-nodes', {}, ...g.items.map(btn)));
    if (g.experimental) el.classList.add('ab-exp');
    return el;
  };
  const zone = (id: string, title: Bi, ...body: HTMLElement[]) => h('section.ab-zone', { 'data-zone': id, 'aria-label': t(title) }, h('p.ab-zone-title', {}, t(title)), ...body);
  return h(
    'figure.ab-diagram',
    {},
    h(
      'div.ab-dg',
      {},
      zone('server', SERVER.title, h('div.ab-nodes', {}, ...SERVER.items.map(btn))),
      link('both', LINK_DOWN, LINK_UP),
      zone(
        'tab',
        bi('Вкладка браузера', 'The browser tab'),
        h('div.ab-groups', {}, group(SIMS), group(REAL), group(RV64)),
        link('down', LINK_FACTS),
        h('div.ab-nodes.ab-base', {}, ...TAB_BASE.map(btn)),
      ),
      link('up', LINK_HOST),
      zone('host', HOST.title, h('div.ab-nodes', {}, ...HOST.items.map(btn))),
    ),
    h('figcaption.small.muted', {}, t(DG_CAPTION)),
    card,
  );
}

// ── The page ──

function navBar(current: AboutPageId): HTMLElement {
  return h(
    'nav.ab-nav',
    { 'aria-label': t(ABOUT_TITLE) },
    ...ABOUT_PAGES.map((pg) => h('a.ab-tab', { href: aboutHref(pg.id), 'aria-current': pg.id === current ? 'page' : undefined, 'data-page': pg.id }, t(pg.nav))),
  );
}

function contents(pg: AboutPageDef, root: () => HTMLElement): HTMLElement {
  return h(
    'details.ab-toc',
    {},
    h('summary', {}, t(bi('Разделы этой страницы', 'Sections of this page'))),
    h(
      'ol',
      {},
      ...pg.sections.map((s) =>
        h(
          'li',
          {},
          h(
            'button.ab-toc-link',
            {
              type: 'button',
              onclick: () => root().querySelector<HTMLElement>(`#ab-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            },
            t(s.title),
          ),
        ),
      ),
    ),
  );
}

export function aboutPage(id: string | undefined): Page {
  const pg = ABOUT_PAGES.find((x) => x.id === (id ?? 'what'));
  if (!pg) return { el: emptyState(bi('Такой страницы справки нет', 'There is no such help page'), undefined, { label: bi('Открыть справку', 'Open help'), href: aboutHref() }) };
  setTitle(`${t(pg.title)} · ${t(ABOUT_TITLE)}`);
  const index = ABOUT_PAGES.indexOf(pg);
  const prev = ABOUT_PAGES[index - 1];
  const next = ABOUT_PAGES[index + 1];
  let el!: HTMLElement;
  const sections = pg.sections.map((s) =>
    h('section.ab-sec', { id: `ab-${s.id}`, 'data-section': s.id }, h('h2', {}, t(s.title)), prose(s.body), pg.id === 'how' && s.id === 'tiers' ? tiersDiagram() : null),
  );
  el = h(
    'div.about',
    { 'data-page': pg.id },
    h('p.ab-kicker', {}, t(ABOUT_TITLE)),
    navBar(pg.id),
    h('h1', {}, t(pg.title)),
    prose(pg.lede, 'prose.lede'),
    contents(pg, () => el),
    ...sections,
    h(
      'nav.ab-pager',
      { 'aria-label': t(bi('Соседние страницы справки', 'Neighbouring help pages')) },
      prev ? h('a.btn.ghost', { href: aboutHref(prev.id), rel: 'prev' }, `← ${t(prev.nav)}`) : h('span'),
      next ? h('a.btn', { href: aboutHref(next.id), rel: 'next' }, `${t(next.nav)} →`) : null,
    ),
  );
  return { el };
}
