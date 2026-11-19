// One build, three environments, three configurations (F10, F11): the same
// program goes to the developer's laptop, the test stand and production; only
// the settings beside it differ.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { inside: boolean; parity: string };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const CONFIG = { url: 'https://12factor.net/config', label: 'Twelve-Factor › Config' };
const PARITY = { url: 'https://12factor.net/dev-prod-parity', label: 'Twelve-Factor › Dev/prod parity' };

export const placesModel = defineModel<P>({
  id: 'orient.places',
  block: 'orient',
  title: bi('Одна сборка, три окружения', 'One build, three environments'),
  summary: bi(
    'Одна и та же программа попадает к разработчику, на тестовый стенд и на прод; рядом с ней в каждом месте лежит свой файл настроек. Зашейте настройки в код, разведите стенд и прод, перепутайте файлы.',
    'The same program goes to the developer, to the test stand and to production; next to it in each place lies its own settings file. Bake the settings into the code, let the stand fall behind production, mix up the files.',
  ),
  concepts: ['orient.environments', 'orient.config'],
  diagram: {
    width: 960,
    height: 352,
    nodes: [
      { id: 'devConf', label: 'dev.conf', sub: 'pay=sandbox', family: 'obj', shape: 'doc', x: 24, y: 24, w: 192, h: 56, card: card(bi('Настройки для ноутбука разработчика: тестовая база, тестовая оплата, подробный журнал.', 'Settings for the developer’s laptop: a test database, test payments, a detailed log.'), bi('Разработчик.', 'The developer.'), { see: 'cat config/dev.conf', doc: CONFIG }) },
      { id: 'testConf', label: 'test.conf', sub: 'pay=sandbox', family: 'obj', shape: 'doc', x: 264, y: 24, w: 192, h: 56, card: card(bi('Настройки тестового стенда: всё как на проде, только оплата учебная и база с ненастоящими покупателями.', 'Settings of the test stand: everything as in production, except the payments are pretend and the database holds fake customers.'), bi('Тестировщики и эксплуатация.', 'Testers and operations.'), { see: 'cat config/test.conf', doc: CONFIG }) },
      { id: 'prodConf', label: 'prod.conf', sub: 'pay=real', family: 'obj', shape: 'doc', x: 504, y: 24, w: 192, h: 56, card: card(bi('Настройки прода: настоящая оплата, настоящая база. Пароли от них лежат здесь, а не в коде.', 'Production settings: real payments, the real database. Their passwords live here, not in the code.'), bi('Эксплуатация.', 'Operations.'), { see: 'cat config/prod.conf', doc: CONFIG }) },
      { id: 'dev', label: bi('Ноутбук разработчика', 'Developer’s laptop'), sub: 'dev', family: 'node', shape: 'rack', x: 24, y: 144, w: 192, h: 64, card: card(bi('Окружение разработки: здесь программу пишут и запускают десятки раз в день. Сломать не страшно.', 'The development environment: the program is written and run here dozens of times a day. Breaking it is harmless.'), bi('Разработчик.', 'The developer.')) },
      { id: 'test', label: bi('Тестовый стенд', 'Test stand'), sub: 'test', family: 'node', shape: 'rack', x: 264, y: 144, w: 192, h: 64, card: card(bi('Копия прода для проверки: те же серверы и та же система, но без настоящих покупателей.', 'A copy of production for checking: the same servers and the same system, but no real customers.'), bi('Эксплуатация готовит, тестировщики проверяют.', 'Operations prepare it, testers check on it.'), { doc: PARITY }) },
      { id: 'prod', label: bi('Прод', 'Production'), sub: 'prod', family: 'node', shape: 'rack', x: 504, y: 144, w: 192, h: 64, card: card(bi('Рабочее окружение, которым пользуются покупатели. Ошибка здесь стоит денег.', 'The working environment the customers use. A mistake here costs money.'), bi('Эксплуатация.', 'Operations.')) },
      { id: 'users', label: bi('Покупатели', 'Customers'), sub: 'real money', family: 'user', x: 760, y: 144, w: 176, h: 64, card: card(bi('Настоящие люди с настоящими картами. Они видят только прод.', 'Real people with real cards. They see only production.'), bi('Сами пришли в магазин.', 'They came to the shop themselves.')) },
      { id: 'artifact', label: bi('Программа 1.5.0', 'Program 1.5.0'), sub: 'shop-1.5.0', family: 'store', x: 264, y: 272, w: 192, h: 56, card: card(bi('Одна сборка. В каждое окружение попадает один и тот же файл: тот, что проверили на стенде, доходит и до прода.', 'One build. The same file goes to every environment: the one checked on the stand is the one that reaches production.'), bi('Сборка.', 'The build.')) },
    ],
    edges: [
      { id: 'e-dc', from: 'devConf', to: 'dev', label: bi('настройки', 'settings'), card: card(bi('Программа при запуске читает файл настроек своего окружения.', 'At start the program reads the settings file of its environment.'), bi('Программа.', 'The program.')) },
      { id: 'e-tc', from: 'testConf', to: 'test', label: bi('настройки', 'settings'), card: card(bi('Код у программы тот же, меняются лишь значения из файла.', 'The code is the same; only the values in the file change.'), bi('Программа.', 'The program.')) },
      { id: 'e-pc', from: 'prodConf', to: 'prod', label: bi('настройки', 'settings'), card: card(bi('На проде программа читает prod.conf — и только его.', 'In production the program reads prod.conf, and only that.'), bi('Программа.', 'The program.')) },
      { id: 'e-adev', from: 'artifact', to: 'dev', via: [[120, 300]], label: bi('та же сборка', 'same build'), card: card(bi('Разработчик запускает ту же сборку, которая попадёт дальше, на стенд и прод.', 'The developer runs the same build that will travel further.'), bi('Разработчик.', 'The developer.')) },
      { id: 'e-atest', from: 'artifact', to: 'test', label: bi('проверка', 'check'), card: card(bi('Сборку ставят на стенд и проверяют.', 'The build is installed on the stand and checked.'), bi('Тестировщики.', 'Testers.')) },
      { id: 'e-aprod', from: 'artifact', to: 'prod', via: [[600, 300]], label: bi('выкладка', 'deploy'), card: card(bi('Проверенную сборку выкладывают на прод без пересборки.', 'The checked build is deployed to production without rebuilding.'), bi('Эксплуатация.', 'Operations.')) },
      { id: 'e-serve', from: 'prod', to: 'users', label: bi('страницы и оплата', 'pages and payments'), card: card(bi('Прод обслуживает покупателей и списывает деньги через настоящую платёжную систему.', 'Production serves the customers and charges them through the real payment system.'), bi('Программа на проде.', 'The program in production.')) },
    ],
  },
  params: [
    {
      id: 'inside',
      label: bi('Настройки зашиты в код', 'Settings baked into the code'),
      kind: 'toggle',
      default: false,
      near: 'artifact',
      predict: {
        prompt: bi('Адрес оплаты и пароль записали прямо в исходный код. Сколько сборок теперь нужно на три окружения?', 'The payment address and password were written straight into the source code. How many builds do three environments need now?'),
        options: [
          { id: 'one', text: bi('Одна, как и раньше', 'One, as before') },
          { id: 'three', text: bi('Три — на каждое окружение своя', 'Three, one per environment') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.builds ?? 1) > 1 ? 'three' : 'one'),
      },
    },
    {
      id: 'parity',
      label: bi('Насколько стенд похож на прод', 'How alike the stand and production are'),
      kind: 'choice',
      default: 'close',
      near: 'test',
      options: [
        { id: 'close', label: bi('как близнецы', 'like twins') },
        { id: 'far', label: bi('другая версия системы', 'another system version') },
      ],
    },
  ],
  breaks: [
    {
      id: 'wrong-config',
      label: bi('На прод положили test.conf', 'test.conf was put into production'),
      remove: ['e-pc'],
      predict: {
        prompt: bi('На проде по ошибке лежит файл настроек тестового стенда. Что заметят первыми?', 'By mistake production has the test stand’s settings file. What will be noticed first?'),
        options: [
          { id: 'money', text: bi('Заказы идут, а денег нет: оплата учебная', 'Orders come in but no money: the payments are pretend') },
          { id: 'crash', text: bi('Сайт сразу упадёт', 'The site goes down at once') },
        ],
        resolve: () => 'money',
      },
    },
    {
      id: 'no-config',
      label: bi('На проде нет файла настроек', 'No settings file in production'),
      remove: ['prodConf', 'e-pc'],
      predict: {
        prompt: bi('Файл prod.conf забыли положить на прод. Что сделает программа при запуске?', 'Nobody put prod.conf into production. What does the program do at start?'),
        options: [
          { id: 'stop', text: bi('Не запустится и напишет, какого файла нет', 'It will not start and says which file is missing') },
          { id: 'guess', text: bi('Запустится с настройками разработчика', 'It starts with the developer’s settings') },
        ],
        resolve: () => 'stop',
      },
    },
  ],
  metrics: [
    { id: 'builds', label: bi('сборок на выпуск', 'builds per release') },
    { id: 'checked', label: bi('на проде то, что проверено', 'production runs what was checked'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const builds = p.inside ? 3 : 1;
    const checked = p.inside ? 0 : 100;
    const metrics = { builds, checked };
    const steps: Step[] = [
      {
        id: 'build',
        label: bi('сборка', 'build'),
        caption: p.inside
          ? bi('Настройки зашиты в код, поэтому на каждое окружение собирают свою программу — три разных файла.', 'The settings are baked into the code, so a separate program is built for each environment: three different files.')
          : bi('Собрана одна программа, 1.5.0. Настроек в ней нет: она ждёт, что их дадут рядом.', 'One program is built, 1.5.0. It carries no settings: it expects to be given them alongside.'),
        focus: ['artifact'],
        states: { artifact: p.inside ? 'warn' : 'on' },
        values: { artifact: p.inside ? 'shop-dev · shop-test · shop-prod' : 'shop-1.5.0', test: p.parity === 'far' ? 'test · Debian 12' : 'test · Debian 13', prod: 'prod · Debian 13' },
        metrics,
      },
      {
        id: 'dev',
        label: 'dev',
        caption: bi('Разработчик запускает сборку у себя с dev.conf: тестовая база, тестовая оплата.', 'The developer runs the build locally with dev.conf: a test database, test payments.'),
        focus: ['e-adev', 'dev', 'e-dc', 'devConf'],
        tokens: [{ edge: 'e-adev' }, { edge: 'e-dc', label: 'pay=sandbox' }],
        states: { dev: 'ok' },
        metrics,
      },
      {
        id: 'test',
        label: 'test',
        caption:
          p.parity === 'far'
            ? bi('На стенде с test.conf всё прошло. Только стенд давно не обновляли: система на нём на версию старше, чем на проде.', 'On the stand with test.conf everything passed. But the stand has not been updated for a while: its system is a version behind production.')
            : bi('Та же сборка на стенде с test.conf. Стенд устроен как прод, и тесты проходят.', 'The same build on the stand with test.conf. The stand is built like production, and the tests pass.'),
        focus: ['e-atest', 'test', 'e-tc', 'testConf'],
        tokens: [{ edge: 'e-atest' }, { edge: 'e-tc', label: 'pay=sandbox' }],
        states: { test: p.parity === 'far' ? 'warn' : 'ok' },
        metrics,
      },
    ];
    if (broken.has('no-config')) {
      steps.push({
        id: 'no-config',
        label: bi('нет настроек', 'no settings'),
        caption: bi('Программу выложили на прод; при запуске она ищет prod.conf и не находит. Она не гадает, а останавливается и пишет, чего ей не хватает.', 'The program was deployed to production; at start it looks for prod.conf and does not find it. It does not guess; it stops and says what is missing.'),
        focus: ['e-aprod', 'prod'],
        tokens: [{ edge: 'e-aprod' }],
        states: { prod: 'err', users: 'off' },
        metrics,
        broken: { at: 'prod', message: 'shop: cannot read /etc/shop/prod.conf: No such file or directory', caption: bi('сборка без настроек не знает, куда ходить, и честно не запускается.', 'a build without settings does not know where to go, and honestly refuses to start.') },
      });
      return steps;
    }
    if (broken.has('wrong-config')) {
      steps.push({
        id: 'wrong-config',
        label: bi('не тот файл', 'wrong file'),
        caption: bi('Программа на проде прочитала test.conf. Сайт работает, покупатели оформляют заказы, а оплата уходит в учебную систему — денег магазин не получает.', 'The program in production read test.conf. The site works and customers place orders, but the payments go to the pretend system: the shop gets no money.'),
        focus: ['prod', 'testConf', 'e-serve', 'users'],
        tokens: [{ edge: 'e-serve', label: 'pay=sandbox' }],
        states: { prod: 'err', users: 'warn' },
        values: { prod: 'prod · pay=sandbox (!)' },
        metrics,
        broken: { at: 'prod', message: 'payment gateway: sandbox mode — card not charged, order #10482 marked paid', caption: bi('программа та же, а окружение задаёт файл настроек; перепутанный файл — перепутанное окружение.', 'the program is the same, the settings file makes the environment; a mixed-up file is a mixed-up environment.') },
      });
      return steps;
    }
    steps.push({
      id: 'prod',
      label: 'prod',
      caption: p.inside
        ? bi('На прод попала отдельная сборка shop-prod — её на стенде никто не проверял. Работает ли она, станет ясно на покупателях.', 'A separate build, shop-prod, went to production, and nobody checked it on the stand. Whether it works will become clear on the customers.')
        : p.parity === 'far'
          ? bi('На проде новая версия системы, и программа падает на том, чего на стенде не было. Чем дальше стенд от прода, тем больше таких сюрпризов.', 'Production has a newer system version, and the program fails on something the stand did not have. The further the stand is from production, the more such surprises.')
          : bi('На прод выложена та самая сборка, что прошла стенд, рядом с ней prod.conf. Покупатели платят настоящими деньгами.', 'The very build that passed the stand is deployed to production, with prod.conf beside it. The customers pay with real money.'),
      focus: ['e-aprod', 'prod', 'e-pc', 'prodConf', 'e-serve', 'users'],
      tokens: [{ edge: 'e-aprod' }, { edge: 'e-pc', label: 'pay=real' }, { edge: 'e-serve' }],
      states: { prod: p.inside || p.parity === 'far' ? 'warn' : 'ok', users: p.parity === 'far' ? 'warn' : 'ok' },
      metrics,
    });
    return steps;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: на проде снова свой файл настроек.', 'The break is removed: production has its own settings file again.');
      return change.id === 'wrong-config'
        ? bi('Программа не знает, где она работает, — это ей говорит файл настроек. Чужой файл превратил прод в учебный стенд с настоящими покупателями.', 'The program does not know where it runs; the settings file tells it. Somebody else’s file turned production into a practice stand with real customers.')
        : bi('Без файла настроек программа на проде не запускается и называет недостающий файл. Это лучше, чем угадывать.', 'Without its settings file the program does not start in production and names the missing file. That is better than guessing.');
    }
    if (change.id === 'inside')
      return b.inside
        ? fmt(bi('Настройки в коде: сборок стало {n}, и на прод попадает та, которую не проверяли.', 'Settings in the code: there are now {n} builds, and the one going to production was never checked.'), { n: 3 })
        : bi('Настройки снова лежат рядом с программой, а не внутри неё. Поэтому сборка остаётся одна на все окружения, и на прод попадает та сборка, которую проверили на тестовом стенде.', 'The settings lie next to the program again rather than inside it. So one build stays for every environment, and the build that was checked on the test stand is the one that reaches production.');
    return b.parity === 'far'
      ? bi('Стенд отстал от прода: тесты на нём проходят, а на проде программа встречает то, чего не видела.', 'The stand has fallen behind production: tests pass on it, while in production the program meets what it has never seen.')
      : bi('Стенд снова как прод: что прошло там, сработает и здесь.', 'The stand is like production again: what passed there will work here.');
  },
});
