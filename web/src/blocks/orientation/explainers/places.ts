// One build, three environments, three configurations (F10, F11): the same
// program goes to the developer's laptop, the test stand and production; only
// the settings beside it differ.
//
// Reading order: at the start there is only the build. Each environment
// appears when the build reaches it, and right after it the settings file it
// reads; the customers appear last. With the settings baked into the code
// there are three builds and no settings files at all.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, startWith, tr } from './kit';

type P = { inside: boolean; parity: string };

const CONFIG = { url: 'https://12factor.net/config', label: 'Twelve-Factor › Config' };
const PARITY = { url: 'https://12factor.net/dev-prod-parity', label: 'Twelve-Factor › Dev/prod parity' };
const ALL = ['devConf', 'testConf', 'prodConf', 'dev', 'test', 'prod', 'users', 'artifact', 'e-dc', 'e-tc', 'e-pc', 'e-wrong', 'e-adev', 'e-atest', 'e-aprod', 'e-serve'];

export const placesModel = defineModel<P>({
  id: 'orient.places',
  frame: 'visible',
  block: 'orient',
  title: bi('Одна сборка, три окружения', 'One build, three environments'),
  summary: bi(
    'Одна и та же сборка магазина, версия 1.5.0, попадает на ноутбук разработчика, на тестовый стенд и в рабочее окружение, где ей пользуются покупатели. Рядом с ней в каждом месте лежит свой файл настроек, и только он говорит программе, куда отправлять платежи: в учебную платёжную систему или в настоящую.',
    'The same build of the shop, version 1.5.0, goes to the developer’s laptop, the test stand and production. Next to it in each place lies its own settings file, and only that file tells the program where to send payments.',
  ),
  intro: bi(
    'Сейчас на схеме только сборка 1.5.0. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечено то, что работает сейчас, облачко говорит, что оно делает, а карточка на линии показывает, что передаётся: сама сборка или строка из файла настроек.\n\nКогда дойдёте до покупателей, включите в «Параметрах» настройки, записанные в сам код, и посмотрите на число сборок под схемой. Потом поставьте на стенд предыдущую версию системы, а в блоке «Сломать» положите в рабочее окружение не тот файл.',
    'Now the diagram shows only build 1.5.0. Press “Start from the first step”, then go on with “Step forward” above the diagram. What works is highlighted, the callout says what it does, the card on the line shows the build or a line of the settings file.\n\nAt the customers, switch on settings baked into the code in “Parameters” and watch the number of builds. Then make the stand’s system older, and in “Break it” put the wrong file into production.',
  ),
  legend: [
    { mark: 'active', text: bi('то, что работает сейчас', 'what works now') },
    { mark: 'say', text: bi('что оно делает', 'what it does') },
    { mark: 'token', text: bi('сборка или строка из файла настроек', 'the build or a line of settings') },
    { mark: 'icon:container', text: bi('сборка программы', 'the build') },
    { mark: 'icon:file', text: bi('файл настроек', 'a settings file') },
    { mark: 'icon:terminal', text: bi('ноутбук разработчика', 'the developer’s laptop') },
    { mark: 'icon:server', text: bi('серверы стенда и рабочего окружения', 'the stand’s and production servers') },
    { mark: 'icon:user', text: bi('покупатели', 'the customers') },
    { mark: 'ok', text: bi('проверка пройдена', 'check passed') },
    { mark: 'warn', text: bi('здесь кроется риск', 'a risk here') },
    { mark: 'err', text: bi('здесь всё сломалось', 'everything broke here') },
  ],
  stopLabel: bi('Выкладка остановилась', 'The deploy stopped'),
  concepts: ['orient.environments', 'orient.config'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'devConf', label: 'dev.conf', icon: 'file', sub: 'pay=sandbox', family: 'obj', shape: 'doc', x: 24, y: 24, w: 192, h: 64, card: card(bi('В этом файле лежат настройки для ноутбука разработчика: учебная база, учебная платёжная система и подробный журнал работы.', 'Settings for the developer’s laptop: a test database, test payments, a detailed log.'), bi('Файл ведёт сам разработчик.', 'The developer.'), { see: 'cat config/dev.conf', doc: CONFIG }) },
      { id: 'testConf', label: 'test.conf', icon: 'file', sub: 'pay=sandbox', family: 'obj', shape: 'doc', x: 264, y: 24, w: 192, h: 64, card: card(bi('В этом файле лежат настройки тестового стенда. Всё устроено как в рабочем окружении, только платёжная система учебная, а в базе ненастоящие покупатели.', 'Test stand settings: as in production, but pretend payments and fake customers.'), bi('Файл ведут тестировщики вместе с инженерами эксплуатации.', 'Testers and operations.'), { see: 'cat config/test.conf', doc: CONFIG }) },
      { id: 'prodConf', label: 'prod.conf', icon: 'file', sub: 'pay=real', family: 'obj', shape: 'doc', x: 506, y: 24, w: 192, h: 64, card: card(bi('В этом файле лежат настройки рабочего окружения, то есть адреса настоящей платёжной системы и настоящей базы. Пароли от них хранятся здесь, а не в коде, и видят их только те, кому положено.', 'Production settings: real payments, the real database; their passwords live here, not in the code.'), bi('Файл ведут инженеры эксплуатации.', 'Operations.'), { see: 'cat config/prod.conf', doc: CONFIG }) },
      { id: 'dev', label: bi('Ноутбук разработчика', 'Developer’s laptop'), icon: 'terminal', sub: 'dev', family: 'node', shape: 'rack', x: 24, y: 160, w: 192, h: 72, card: card(bi('Ноутбук разработчика служит окружением разработки. Здесь программу пишут и запускают десятки раз в день, и сломать её тут не страшно.', 'The development environment: run dozens of times a day; breaking it is harmless.'), bi('Ноутбуком пользуется разработчик.', 'The developer.')) },
      { id: 'test', label: bi('Тестовый стенд', 'Test stand'), icon: 'server', sub: 'test · Debian 13', family: 'node', shape: 'rack', x: 264, y: 160, w: 192, h: 72, card: card(bi('Тестовый стенд состоит из отдельных серверов, устроенных как можно ближе к рабочим: та же операционная система, те же версии программ, но без настоящих покупателей. Здесь новую версию проверяют.', 'Servers built like production, without real customers; new versions are checked here.'), bi('Стенд готовят инженеры эксплуатации, а проверяют на нём тестировщики.', 'Operations prepare it, testers check on it.'), { doc: PARITY }) },
      { id: 'prod', label: bi('Рабочее окружение', 'Production'), icon: 'server', sub: 'prod · Debian 13', family: 'node', shape: 'rack', x: 496, y: 160, w: 212, h: 72, card: card(bi('На этих серверах работает магазин для настоящих покупателей. В командах это окружение называют продом. Ошибка здесь стоит денег и доверия.', 'The servers real customers use (“prod”). A mistake here costs money.'), bi('Рабочим окружением занимаются инженеры эксплуатации.', 'Operations.')) },
      { id: 'users', label: bi('Покупатели', 'Customers'), icon: 'user', sub: { ru: 'настоящие деньги', en: 'real money' }, family: 'user', x: 800, y: 160, w: 144, h: 72, card: card(bi('Магазином пользуются настоящие люди с настоящими банковскими картами. Они видят только рабочее окружение.', 'Real people with real cards; they see only production.'), bi('Покупатели сами пришли в магазин.', 'They came by themselves.')) },
      { id: 'artifact', label: bi('Сборка 1.5.0', 'Build 1.5.0'), icon: 'container', sub: 'shop-1.5.0', family: 'store', x: 264, y: 312, w: 192, h: 64, card: card(bi('Сборка у всех окружений одна. В каждое из них попадает один и тот же файл, поэтому до покупателей доходит та самая сборка, которую проверили на стенде.', 'One build: the same file goes everywhere, so what was checked reaches the customers.'), bi('Сборку сделала команда разработки.', 'The build.')) },
    ],
    edges: [
      { id: 'e-dc', from: 'devConf', to: 'dev', label: bi('настройки', 'settings'), card: card(bi('При запуске программа читает файл настроек своего окружения.', 'At start the program reads its environment’s settings file.'), bi('Файл читает программа.', 'The program.')) },
      { id: 'e-tc', from: 'testConf', to: 'test', label: bi('настройки', 'settings'), card: card(bi('Код программы тот же самый, меняются только значения в файле.', 'The code is the same; only the values change.'), bi('Файл читает программа.', 'The program.')) },
      { id: 'e-pc', from: 'prodConf', to: 'prod', label: bi('настройки', 'settings'), card: card(bi('В рабочем окружении программа читает prod.conf, и только его.', 'In production the program reads prod.conf only.'), bi('Файл читает программа.', 'The program.')) },
      { id: 'e-wrong', from: 'testConf', to: 'prod', dashed: true, labelAt: 0.55, label: bi('не тот файл', 'the wrong file'), card: card(bi('По ошибке в рабочее окружение положили файл настроек тестового стенда.', 'By mistake production got the test stand’s settings.'), bi('Такую ошибку делает человек при выкладке.', 'A person, while deploying.')) },
      { id: 'e-adev', from: 'artifact', to: 'dev', via: [[120, 344]], label: bi('та же сборка', 'same build'), card: card(bi('Разработчик запускает ту же сборку, которая потом попадёт на стенд и к покупателям.', 'The developer runs the very build that travels on.'), bi('Сборку запускает разработчик.', 'The developer.')) },
      { id: 'e-atest', from: 'artifact', to: 'test', label: bi('на проверку', 'to be checked'), card: card(bi('Сборку ставят на стенд и проверяют.', 'The build is installed on the stand and checked.'), bi('Сборку на стенд ставят и проверяют тестировщики.', 'Testers.')) },
      { id: 'e-aprod', from: 'artifact', to: 'prod', via: [[602, 344]], label: bi('выкладка', 'deploy'), card: card(bi('Проверенную сборку выкладывают в рабочее окружение без пересборки.', 'The checked build is deployed without rebuilding.'), bi('Сборку выкладывают инженеры эксплуатации.', 'Operations.')) },
      { id: 'e-serve', from: 'prod', to: 'users', label: bi('страницы и оплата', 'pages and payments'), card: card(bi('Рабочее окружение обслуживает покупателей и списывает деньги через платёжную систему, адрес которой взят из файла настроек.', 'Production serves the customers and charges them via the payment system from the settings.'), bi('Покупателей обслуживает программа в рабочем окружении.', 'The program in production.')) },
    ],
  },
  params: [
    {
      id: 'inside',
      label: bi('Адрес оплаты и пароль записаны в сам исходный код', 'Payment address and password written into the code'),
      group: bi('Где лежат настройки', 'Where the settings live'),
      kind: 'toggle',
      default: false,
      near: 'artifact',
      predict: {
        prompt: bi('Адрес платёжной системы и пароль к ней теперь записаны в самом исходном коде, а в каждом окружении они свои. Сколько разных сборок понадобится на три окружения?', 'The payment address and password are now in the source code, and each environment has its own. How many builds do three environments need?'),
        options: [
          { id: 'one', text: bi('Понадобится одна сборка, как и раньше', 'One build, as before') },
          { id: 'three', text: bi('Понадобятся три сборки, на каждое окружение своя', 'Three builds, one per environment') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.builds ?? 1) > 1 ? 'three' : 'one'),
      },
    },
    {
      id: 'parity',
      label: bi('Операционная система на тестовом стенде', 'The test stand’s system'),
      group: bi('Тестовый стенд', 'The test stand'),
      kind: 'choice',
      default: 'close',
      near: 'test',
      options: [
        { id: 'close', label: bi('Debian 13, та же система, что в рабочем окружении', 'Debian 13, the same system as in production') },
        { id: 'far', label: bi('Debian 12, которая отстаёт от рабочего окружения на версию', 'Debian 12, a version behind production') },
      ],
      predict: {
        prompt: bi('Вы изменили систему на тестовом стенде, а в рабочем окружении по-прежнему Debian 13. Сборка прошла все проверки на стенде. Как она поведёт себя у покупателей?', 'You changed the stand’s system; production still runs Debian 13. The build passed every check on the stand. How will it behave for the customers?'),
        options: [
          { id: 'works', text: bi('Сборка будет работать так же, как на стенде', 'The build works as it did on the stand') },
          { id: 'surprise', text: bi('Сборка может сломаться на том, чего на стенде не было', 'The build may break on what the stand did not have') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.id === 'serve' && s.states?.users === 'warn') ? 'surprise' : 'works'),
      },
    },
  ],
  breaks: [
    {
      id: 'wrong-config',
      label: bi('В рабочее окружение положили test.conf вместо prod.conf', 'test.conf was put into production instead of prod.conf'),
      remove: ['e-pc'],
      predict: {
        prompt: bi('В рабочее окружение по ошибке положили файл настроек тестового стенда, а сборка та же, что прошла проверки. Что заметят первым?', 'Production got the test stand’s settings by mistake; the build is the checked one. What will be noticed first?'),
        options: [
          { id: 'money', text: bi('Заказы идут, а денег на счёте магазина нет', 'Orders come in, but no money arrives') },
          { id: 'crash', text: bi('Сайт сразу перестанет открываться', 'The site stops opening at once') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'prod' && s.id === 'serve') ? 'money' : 'crash'),
      },
    },
    {
      id: 'no-config',
      label: bi('Файл prod.conf забыли положить в рабочее окружение', 'prod.conf was not put into production'),
      remove: ['prodConf', 'e-pc'],
      predict: {
        prompt: bi('Файл prod.conf забыли положить в рабочее окружение. Что сделает программа при запуске?', 'Nobody put prod.conf into production. What does the program do at start?'),
        options: [
          { id: 'stop', text: bi('Программа не запустится и напишет, какого файла ей не хватает', 'The program will not start and names the missing file') },
          { id: 'guess', text: bi('Программа запустится с настройками разработчика', 'The program starts with the developer’s settings') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'no-config') ? 'stop' : 'guess'),
      },
    },
  ],
  metrics: [
    { id: 'builds', label: bi('сколько сборок нужно на один выпуск', 'builds per release') },
    { id: 'checked', label: bi('покупатели получили проверенную сборку', 'customers run the checked build'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const inside = p.inside;
    const far = p.parity === 'far';
    const metrics = { builds: inside ? 3 : 1, checked: inside ? 0 : 100 };
    const steps: Step[] = [
      {
        id: 'build',
        label: bi('сборка', 'build'),
        caption: inside
          ? bi('Адрес оплаты и пароль записаны в самом коде, а в каждом окружении они свои. Поэтому собирать приходится три разные программы: для ноутбука, для стенда и для рабочего окружения.', 'The settings are in the code, so three different programs are built.')
          : bi('Команда собрала одну программу, версию 1.5.0. Настроек внутри неё нет, потому что программа ожидает, что в каждом окружении рядом с ней положат файл настроек.', 'One program is built, 1.5.0. It carries no settings: it expects a settings file next to it.'),
        focus: ['artifact'],
        say: { artifact: inside ? bi('Собраны три программы, и в каждой зашиты свои настройки.', 'Three programs, each with its settings inside.') : bi('Собрана одна программа 1.5.0, настроек в ней нет.', 'One program, 1.5.0, with no settings inside.') },
        states: { ...startWith(ALL, 'artifact'), artifact: inside ? 'warn' : 'on' },
        values: { artifact: inside ? 'shop-dev · shop-test · shop-prod' : 'shop-1.5.0', test: far ? 'test · Debian 12' : 'test · Debian 13', prod: 'prod · Debian 13', users: tr('настоящие деньги', 'real money') },
        metrics,
      },
      {
        id: 'dev',
        label: bi('ноутбук', 'laptop'),
        caption: inside ? bi('Разработчик запускает у себя сборку shop-dev, в которую зашиты учебные настройки.', 'The developer runs shop-dev, with test settings inside.') : bi('Разработчик запускает сборку 1.5.0 у себя на ноутбуке, чтобы убедиться, что она запускается и работает.', 'The developer runs 1.5.0 on the laptop.'),
        focus: ['e-adev', 'dev'],
        reveal: ['dev', 'e-adev'],
        tokens: [{ edge: 'e-adev', label: inside ? 'shop-dev' : 'shop-1.5.0' }],
        say: { dev: inside ? bi('На ноутбуке работает сборка shop-dev.', 'The laptop runs shop-dev.') : bi('Ноутбук разработчика запускает сборку 1.5.0.', 'The laptop runs build 1.5.0.') },
        states: { dev: 'on' },
        metrics,
      },
    ];
    if (!inside)
      steps.push({
        id: 'devConf',
        label: 'dev.conf',
        caption: bi('При запуске программа читает файл dev.conf, который лежит рядом с ней. Из него она узнаёт, что платить нужно в учебную платёжную систему, где деньги ненастоящие.', 'At start the program reads dev.conf and learns to pay into the pretend system.'),
        focus: ['devConf', 'e-dc'],
        reveal: ['devConf', 'e-dc'],
        tokens: [{ edge: 'e-dc', label: 'pay=sandbox' }],
        say: { devConf: bi('Файл dev.conf велит платить в учебную систему.', 'dev.conf says: pay into the sandbox.') },
        states: { dev: 'ok' },
        metrics,
      });
    else steps[steps.length - 1].states = { dev: 'ok' };
    steps.push({
      id: 'test',
      label: bi('стенд', 'stand'),
      caption: inside
        ? bi('На стенд ставят другую сборку, shop-test. Её проверяют, и проверки проходят, но проверили shop-test, а не ту программу, которая пойдёт к покупателям.', 'The stand gets another build, shop-test; it passes, but it is not what goes to the customers.')
        : far
          ? bi('Ту же сборку 1.5.0 ставят на тестовый стенд. Стенд давно не обновляли, и система на нём отстаёт на версию от рабочего окружения, но проверки всё равно проходят.', 'The same 1.5.0 goes to the stand, whose system is a version behind production. The checks pass.')
          : bi('Ту же сборку 1.5.0 ставят на тестовый стенд. Стенд устроен так же, как рабочее окружение, с той же системой Debian 13, и тестировщики проверяют на нём всё, что купит покупатель.', 'The same 1.5.0 goes to the stand, built like production. Testers check it.'),
      focus: ['e-atest', 'test'],
      reveal: ['test', 'e-atest'],
      tokens: [{ edge: 'e-atest', label: inside ? 'shop-test' : 'shop-1.5.0' }],
      say: {
        test: far
          ? bi('Стенд с системой Debian 12 проверяет сборку, и проверки проходят.', 'The Debian 12 stand checks the build; it passes.')
          : bi('Стенд проверяет сборку, и все проверки проходят.', 'The stand checks the build; everything passes.'),
      },
      states: { test: far ? 'warn' : 'ok' },
      metrics,
    });
    if (!inside)
      steps.push({
        id: 'testConf',
        label: 'test.conf',
        caption: bi('На стенде рядом со сборкой лежит test.conf. Платёжная система здесь тоже учебная, поэтому тестировщики оформляют заказы, не тратя настоящих денег.', 'On the stand test.conf lies next to the build; payments are pretend there too.'),
        focus: ['testConf', 'e-tc'],
        reveal: ['testConf', 'e-tc'],
        tokens: [{ edge: 'e-tc', label: 'pay=sandbox' }],
        say: { testConf: bi('Файл test.conf тоже велит платить в учебную систему.', 'test.conf also says: pay into the sandbox.') },
        metrics,
      });
    steps.push({
      id: 'prod',
      label: bi('выкладка', 'deploy'),
      caption: inside
        ? bi('В рабочее окружение выкладывают третью сборку, shop-prod. На стенде её никто не проверял, и работает ли она, станет ясно уже на покупателях.', 'Production gets a third build, shop-prod, which nobody checked.')
        : bi('Ту самую сборку 1.5.0, которая прошла стенд, без пересборки выкладывают в рабочее окружение. Программа та же байт в байт.', 'The very build that passed the stand is deployed, byte for byte.'),
      focus: ['e-aprod', 'prod'],
      reveal: ['prod', 'e-aprod'],
      tokens: [{ edge: 'e-aprod', label: inside ? 'shop-prod' : 'shop-1.5.0' }],
      say: { prod: inside ? bi('Рабочее окружение получает сборку shop-prod, которую никто не проверял.', 'Production gets shop-prod, never checked.') : bi('Рабочее окружение получает проверенную сборку 1.5.0.', 'Production gets the checked build 1.5.0.') },
      states: { prod: inside ? 'warn' : 'on' },
      metrics,
    });
    if (broken.has('no-config') && !inside) {
      steps.push({
        id: 'no-config',
        label: bi('нет настроек', 'no settings'),
        caption: bi('При запуске программа ищет рядом с собой prod.conf и не находит его. Угадывать, куда отправлять платежи, она не станет, поэтому останавливается и пишет, какого файла ей не хватает.', 'At start the program looks for prod.conf and does not find it. It does not guess: it stops and names the missing file.'),
        focus: ['prod'],
        reveal: ['prodConf'],
        say: { prod: bi('Программа не нашла prod.conf и не запустилась.', 'No prod.conf: the program does not start.') },
        states: { prod: 'err', prodConf: 'err' },
        metrics,
        broken: { at: 'prod', message: 'shop: cannot read /etc/shop/prod.conf: No such file or directory', caption: bi('в рабочем окружении. Сборка без настроек не знает, куда отправлять платежи, и поэтому отказывается запускаться.', 'in production: a build without settings does not know where to go and refuses to start.') },
      });
      return steps;
    }
    const wrong = broken.has('wrong-config') && !inside;
    if (wrong)
      steps.push({
        id: 'wrong',
        label: bi('не тот файл', 'wrong file'),
        caption: bi('При выкладке кто-то положил рядом с программой test.conf вместо prod.conf. Программа читает файл, который ей дали, и узнаёт из него, что платить нужно в учебную систему.', 'Someone put test.conf next to the program instead of prod.conf; the program reads what it was given.'),
        focus: ['e-wrong', 'prod'],
        reveal: ['e-wrong'],
        tokens: [{ edge: 'e-wrong', label: 'pay=sandbox' }],
        say: { prod: bi('Программа прочитала test.conf и будет платить в учебную систему.', 'The program read test.conf: pay into the sandbox.') },
        states: { prod: 'warn' },
        values: { prod: 'prod · test.conf (!)' },
        metrics,
      });
    else if (!inside)
      steps.push({
        id: 'prodConf',
        label: 'prod.conf',
        caption: bi('В рабочем окружении рядом с программой лежит prod.conf. Из него программа узнаёт адрес настоящей платёжной системы и пароль к ней.', 'In production prod.conf gives the real payment system and its password.'),
        focus: ['prodConf', 'e-pc'],
        reveal: ['prodConf', 'e-pc'],
        tokens: [{ edge: 'e-pc', label: 'pay=real' }],
        say: { prodConf: bi('Файл prod.conf велит платить в настоящую платёжную систему.', 'prod.conf says: pay for real.') },
        metrics,
      });
    steps.push({
      id: 'serve',
      label: bi('покупатели', 'customers'),
      caption: wrong
        ? bi('Сайт работает, покупатели оформляют заказы, и каждый заказ помечается оплаченным. Но платежи уходят в учебную систему, и настоящих денег магазин не получает.', 'The site works and orders are marked paid, but payments go to the pretend system: no money arrives.')
        : inside
          ? bi('Покупатели пользуются сборкой, которую до них не видел никто, даже тестировщики. Если в ней ошибка, первыми её найдут покупатели.', 'The customers use a build nobody checked; they will find its errors first.')
          : far
            ? bi('В рабочем окружении система новее, чем на стенде, и программа спотыкается на том, чего на стенде не было, поэтому часть заказов не проходит. Чем сильнее стенд отличается от рабочего окружения, тем больше таких сюрпризов.', 'Production’s system is newer than the stand’s, and the program trips on what the stand lacked.')
            : bi('Покупатели пользуются той самой сборкой, которую проверили на стенде, и платят настоящими деньгами. Различаются окружения только файлом настроек.', 'The customers use the checked build and pay real money. The environments differ only in the settings file.'),
      focus: ['e-serve', 'users'],
      reveal: ['users', 'e-serve'],
      tokens: [{ edge: 'e-serve', label: wrong ? bi('заказ «оплачен», денег нет', 'order “paid”, no money') : bi('заказ и оплата', 'order and payment') }],
      say: {
        users: wrong
          ? bi('Покупатели оформляют заказы, а деньги с их карт не списываются.', 'Customers order, but their cards are not charged.')
          : far
            ? bi('У части покупателей заказы не проходят.', 'Some customers’ orders fail.')
            : bi('Покупатели оформляют заказы и платят настоящими деньгами.', 'Customers order and pay real money.'),
      },
      states: { users: wrong || far || inside ? 'warn' : 'ok', prod: wrong ? 'err' : far || inside ? 'warn' : 'ok' },
      metrics,
      ...(wrong
        ? { broken: { at: 'prod', message: 'payment gateway: sandbox mode — card not charged, order #10482 marked paid', caption: bi('в рабочем окружении. Программа та же, что на стенде, а окружение ей задаёт файл настроек, поэтому перепутанный файл перепутал и окружения.', 'in production: the program is the same; the settings file makes the environment, and a mixed-up file mixed them up.') } }
        : {}),
    });
    return steps;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку выключили, и в рабочем окружении снова лежит свой файл настроек.', 'The break is removed: production has its own settings file again.');
      return change.id === 'wrong-config'
        ? bi('Программа сама не знает, где она работает, и узнаёт это только из файла настроек. Чужой файл превратил рабочее окружение в учебный стенд с настоящими покупателями.', 'The settings file tells the program where it runs; the wrong file turned production into a practice stand.')
        : bi('Без файла настроек программа в рабочем окружении не запускается и называет недостающий файл. Такое поведение лучше, чем попытка угадать.', 'Without its settings file the program does not start and names the file.');
    }
    if (change.id === 'inside')
      return b.inside
        ? bi('Настройки теперь записаны в код, поэтому сборок стало три, и к покупателям попадает та, которую никто не проверял.', 'Settings in the code: three builds, and the one in production was never checked.')
        : bi('Настройки снова лежат рядом с программой, а не внутри неё. Поэтому сборка остаётся одна на все окружения, и в рабочее окружение попадает та самая сборка, которую проверили на тестовом стенде.', 'The settings lie next to the program again: one build for all, and the checked one reaches production.');
    return b.parity === 'far'
      ? bi('Стенд отстал от рабочего окружения на версию системы. Проверки на нём проходят, а у покупателей программа встречает то, чего никогда не видела.', 'The stand fell behind production: tests pass, while production meets the unseen.')
      : bi('Стенд снова устроен как рабочее окружение, и то, что прошло проверку там, сработает и у покупателей.', 'The stand is like production again.');
  },
});
