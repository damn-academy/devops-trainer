// X1, screens 5–8 (07 §5.3): the deployment pipeline as an organisational
// path. Where continuous integration ends, what makes continuous delivery,
// what turns it into continuous deployment, how batch size and automated
// checks move the risk, and what rollback buys. The risk numbers come from
// the flowlab model (engine/flowlab/sim.ts), so they match the simulator.
//
// Reading order: at the first step only the merged change and the working
// site are on the picture. Each step of the pipeline appears when the change
// reaches it and says in a callout what it does; the frame "continuous
// integration" appears when the change leaves it. The last step shows what
// happens if the deployment breaks the site: a rollback, or a hotfix when the
// rollback is broken.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { diagnoseMinutes, pFail, restoreMinutes } from '../../../engine/flowlab/sim';
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, nWord, type Bi } from './kit';

type P = { build: string; last: string; automation: number; batch: number };

const FOWLER = { url: 'https://martinfowler.com/articles/continuousIntegration.html', label: 'Fowler › Continuous Integration' };
const CD = { url: 'https://continuousdelivery.com/', label: 'continuousdelivery.com' };

/** Changes the team merges per working day. */
export const CHANGES_PER_DAY = 2;
const RISK = 0.05;

export interface PipeNumbers {
  leadHours: number;
  risk: number;
  diagnose: number;
  restore: number;
  deploysPerWeek: number;
}

export function pipeNumbers(p: P, rollback: boolean): PipeNumbers {
  const build = p.build === 'auto' ? 0.2 : 8;
  const checks = 0.3 + (1 - p.automation / 100) * 6;
  const gate = p.last === 'auto' ? 0 : 4;
  const fill = ((p.batch - 1) / 2) * (8 / CHANGES_PER_DAY);
  const leadHours = Math.round((build + checks + gate + fill + 0.5) * 10) / 10;
  const risk = pFail(Array(p.batch).fill(RISK), p.automation / 100, p.batch);
  return { leadHours, risk: Math.round(risk * 100), diagnose: diagnoseMinutes(p.batch, false, true), restore: restoreMinutes(rollback), deploysPerWeek: Math.round(((5 * CHANGES_PER_DAY) / p.batch) * 10) / 10 };
}

/** Whether the parameters make continuous integration: an automatic build after every merge and at least some machine checks. */
const hasCI = (p: P) => p.build === 'auto' && p.automation > 0;

const ALL = ['merge', 'build', 'checks', 'staging', 'gate', 'batch', 'prod', 'prev', 'g-ci', 'e-build', 'e-checks', 'e-staging', 'e-gate', 'e-prod', 'e-deploy', 'e-rollback'];
const H = (h: number) => nWord(h, ['час', 'часа', 'часов'], ['hour', 'hours']);
const MIN = (m: number) => nWord(m, ['минуту', 'минуты', 'минут'], ['minute', 'minutes']);
/** "10 изменений" in the genitive after "из": "партия из 1 изменения". */
const CH = (n: number) => nWord(n, ['изменения', 'изменений', 'изменений'], ['change', 'changes']);
const PIPE: [string, string] = ['Этот шаг выполняет конвейер, то есть сервер, который по описанию команды сам запускает сборку, проверки и выкладку.', 'The pipeline does this step: a server that runs the build, the checks and the deployment by itself, following the team’s description.'];

export const pipelineModel = defineModel<P>({
  id: 'method.x.pipeline',
  frame: 'visible',
  block: 'methodology',
  title: b('Как изменение проходит путь от слияния до рабочего сайта', 'How a change travels from the merge to the working site'),
  summary: b(
    'Схема показывает путь одного изменения после того, как разработчик слил его в общую ветку. Изменение проходит сборку, автоматические проверки, стенд, выпуск и партию, а затем попадает на рабочий сайт с выкладкой. Пунктирная рамка показывает, где заканчивается непрерывная интеграция. Под схемой считается, сколько часов изменение идёт до рабочего сайта, насколько рискованна одна выкладка, сколько выкладок бывает в неделю, сколько минут займёт восстановление, если выкладка сломает сайт, и сколько минут потом уйдёт на поиск виноватого изменения.',
    'The diagram shows the path of one change after a developer merged it into the shared branch. The change goes through the build, the automated checks, staging, the release and the batch, and then reaches the working site with a deployment. The dashed frame shows where continuous integration ends. Under the diagram you see how many hours the change takes to reach the working site, how risky one deployment is, how many deployments happen a week, how many minutes recovery takes if a deployment breaks the site, and how many minutes it then takes to find the faulty change.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видны только слитое изменение и рабочий сайт. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждый шаг конвейера появляется, когда до него доходит изменение, и говорит в облачке, что он делает. Карточка на линии показывает, сколько времени изменение ждёт на этом переходе.\n\nПосле первого прохода меняйте «Параметры» и включайте поломки в блоке «Сломать», а схема объяснит, что изменилось и почему.',
    'The diagram builds up step by step, and for now it shows only the merged change and the working site. Press “Start from the first step”, then go on with “Step forward” above the diagram. Each step of the pipeline appears when the change reaches it and says in a callout what it does. The card on the line shows how long the change waits on that transition.\n\nAfter the first pass change the “Parameters” and switch on the breaks in “Break it”, and the diagram explains what changed and why.',
  ),
  legend: [
    { mark: 'active', text: b('шаг, на котором изменение находится сейчас', 'the step the change is at now') },
    { mark: 'say', text: b('что этот шаг делает', 'what that step does') },
    { mark: 'token', text: b('сколько изменение ждёт на переходе', 'how long the change waits on a transition') },
    { mark: 'dashed', text: b('рамка непрерывной интеграции', 'the frame of continuous integration') },
    { mark: 'warn', text: b('долгое ожидание или высокий риск', 'a long wait or a high risk') },
    { mark: 'ok', text: b('шаг пройден', 'step passed') },
    { mark: 'err', text: b('выкладка сломала сайт', 'the deployment broke the site') },
    { mark: 'icon:terminal', text: b('разработчик', 'a developer') },
    { mark: 'icon:process', text: b('автоматические проверки', 'automated checks') },
    { mark: 'icon:server', text: b('стенд и рабочий сайт', 'staging and the working site') },
  ],
  stopLabel: b('Сайт сломан', 'The site is broken'),
  concepts: ['method.ci', 'method.cdelivery', 'method.cdeployment', 'method.pipeline', 'method.rollback'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('merge', b('Слияние в main', 'Merge into main'), 'ci-source', [24, 56, 168, 60], card(['Разработчик сливает своё изменение в общую ветку, которая обычно называется main. При непрерывной интеграции это делают хотя бы раз в день и маленькими порциями.', 'A developer merges their change into the shared branch, usually called main. With continuous integration this happens at least daily and in small pieces.'], ['Изменение сливает в общую ветку разработчик.', 'A developer merges.'], FOWLER), { icon: 'terminal' }),
      node('build', b('Сборка', 'Build'), 'ci-build', [288, 56, 144, 60], card(['Из исходного кода получают то, что можно запустить. Если сборку запускают вручную, изменение ждёт, пока у кого-нибудь найдётся на это время, а автоматическая сборка начинается сразу после слияния.', 'The source code is turned into something that can run. If the build is started by hand, the change waits until someone gets round to it; an automatic build starts right after the merge.'], ['Сборку запускает человек или сервер сборки.', 'A person or a build server builds it.']), { icon: 'container' }),
      node('checks', b('Автотесты', 'Automated tests'), 'ci-test', [512, 56, 144, 60], card(['Здесь машина за минуты выполняет автоматические проверки. То, чего машина не проверяет, проверяет человек, и на это уходят часы.', 'Checks a machine runs in minutes. What the machine does not check, a person checks, and that takes hours.'], ['Тесты запускает сервер сборки, а пишут их разработчики и тестировщики.', 'The build server runs the tests; developers and testers write them.']), { icon: 'process' }),
      node('staging', b('Стенд', 'Staging'), 'ci-deploy', [768, 56, 168, 60], card(['Стендом называют копию рабочего сайта, на которой проверяют изменения. Изменение выкладывают на стенд тем же способом, каким потом выложат на рабочий сайт, поэтому сама выкладка тоже проходит проверку.', 'A copy of the working site for checking. The change is deployed to staging the same way it will later go to the working site, so the deployment itself is checked too.'], PIPE), { icon: 'server' }),
      node('gate', b('Выпуск', 'Release'), 'cp', [768, 344, 168, 60], card(['Выпуском называют последний шаг перед рабочим сайтом. Если на этом шаге стоит кнопка и любое проверенное изменение можно выпустить в любой момент одним нажатием, такая практика называется непрерывной доставкой. Если кнопки нет и конвейер выпускает изменение сам, практика называется непрерывным развёртыванием.', 'The last step before the working site. If there is a button here and any checked change can be released at any moment with one press, that is continuous delivery. If there is no button and the pipeline releases the change itself, that is continuous deployment.'], ['Изменение выпускает человек кнопкой или сам конвейер.', 'A person with a button, or the pipeline itself.'], CD), { icon: 'lock' }),
      node('batch', b('Партия', 'Batch'), 'gauge', [400, 344, 176, 60], card(['Партию составляют изменения, которые уходят на рабочий сайт за одну выкладку. Чем больше партия, тем выше риск, что выкладка что-нибудь сломает, и тем дольше потом искать, какое изменение виновато.', 'The changes that go to the working site in one deployment. The bigger the batch, the higher the risk that the deployment breaks something, and the longer it takes to find the faulty change.'], ['Размер партии задаёт правило команды о том, как часто выкладывать.', 'A team rule on how often to deploy sets the batch size.']), { icon: 'folder', shape: 'buffer' }),
      node('prod', b('Рабочий сайт', 'Working site'), 'node', [24, 344, 176, 60], card(['Рабочим сайтом называют версию сайта, которой пользуются покупатели. Каждая выкладка приносит сюда партию изменений.', 'The version of the site the customers use. Each deployment brings a batch of changes here.'], ['Сайт обслуживают эксплуатация и конвейер.', 'Operations and the pipeline look after it.']), { icon: 'server' }),
      node('prev', b('Прошлая версия', 'Previous version'), 'store', [24, 216, 176, 56], card(['Здесь хранится предыдущая версия сайта, которая работала до выкладки. Конвейер хранит её, чтобы вернуть одной командой, если новая выкладка сломает сайт.', 'The version of the site that worked before the deployment. The pipeline keeps it so it can be put back with one command if the new deployment breaks the site.'], ['Прошлую версию хранит конвейер.', 'The pipeline keeps it.']), { icon: 'folder' }),
    ],
    edges: [
      edge('e-build', 'merge', 'build', b('ждёт сборки', 'waits for a build'), card(['По этой линии изменение ждёт между слиянием и сборкой. Без автоматической сборки оно лежит здесь, пока сборку не запустят вручную.', 'The time between the merge and the build. Without an automatic build the change waits here until someone starts the build by hand.'], ['Это ожидание никто не планирует, и длится оно до тех пор, пока кто-нибудь не запустит сборку.', 'Nobody plans this wait: it lasts while nobody has started the build.'])),
      edge('e-checks', 'build', 'checks', b('собрано', 'built'), card(['Собранное изменение сразу отправляется на проверку.', 'The built change goes to the checks at once.'], PIPE)),
      edge('e-staging', 'checks', 'staging', b('проверено', 'checks passed'), card(['Дальше идёт только то, что прошло проверки. Если проверка не прошла, команда первым делом чинит её, а не сливает новое.', 'Only what passed the checks goes on. If a check failed, the team fixes it first instead of merging new work.'], PIPE, FOWLER)),
      edge('e-gate', 'staging', 'gate', b('готово к выпуску', 'ready to release'), card(['Изменение проверено на стенде и может уйти на рабочий сайт.', 'The change is checked on staging and may go to the working site.'], PIPE)),
      edge('e-prod', 'gate', 'batch', b('в партию', 'into the batch'), card(['Выпущенные изменения копятся, пока не наберётся партия на одну выкладку.', 'Released changes pile up until a batch for one deployment is collected.'], ['Так говорит правило команды о выкладках.', 'The team’s deployment rule says so.'])),
      edge('e-deploy', 'batch', 'prod', b('выкладка', 'deployment'), card(['Партия уходит на рабочий сайт одной выкладкой.', 'The batch goes to the working site in one deployment.'], ['Партию выкладывает эксплуатация или конвейер.', 'Operations or the pipeline deploys it.'])),
      edge('e-rollback', 'prev', 'prod', b('откат', 'rollback'), card(['Если выкладка сломала сайт, дежурный за минуты возвращает на рабочий сайт прошлую версию, а причину ищут и чинят потом, спокойно.', 'If a deployment broke the site, the on-call engineer puts the previous version back on the working site in minutes, and the cause is found and fixed later, calmly.'], ['Откат делает дежурный одной командой или кнопкой.', 'The on-call engineer rolls back with one command or button.'])),
    ],
    groups: [
      { id: 'g-ci', label: b('непрерывная интеграция', 'continuous integration'), around: ['merge', 'build', 'checks'], family: 'ci-build', dash: 'dash', pad: 12, card: card(['Непрерывная интеграция заканчивается после автотестов, когда изменение слито, собрано и проверено машиной. До рабочего сайта она не доходит.', 'Continuous integration ends after the automated tests: the change is merged, built and checked by a machine. It does not reach the working site.'], ['Непрерывную интеграцию делает вся команда, потому что каждый разработчик часто сливает свои изменения.', 'The whole team does it: everyone merges often.'], FOWLER) },
    ],
  },
  params: [
    {
      id: 'build',
      group: b('Непрерывная интеграция', 'Continuous integration'),
      label: b('Когда запускается сборка', 'When the build starts'),
      kind: 'choice',
      options: [
        { id: 'manual', label: b('вручную, когда у кого-нибудь найдётся время', 'by hand, when someone finds the time') },
        { id: 'auto', label: b('сама после каждого слияния', 'by itself after every merge') },
      ],
      default: 'manual',
      near: 'build',
    },
    { id: 'automation', group: b('Непрерывная интеграция', 'Continuous integration'), label: b('Какую долю проверок выполняет машина, %', 'Share of checks a machine runs, %'), kind: 'range', min: 0, max: 100, step: 20, default: 0, near: 'checks' },
    {
      id: 'last',
      group: b('Выпуск на рабочий сайт', 'Release to the working site'),
      label: b('Кто выпускает проверенное изменение', 'Who releases a checked change'),
      kind: 'choice',
      options: [
        { id: 'button', label: b('человек, одной кнопкой', 'a person, with one button') },
        { id: 'auto', label: b('конвейер сам', 'the pipeline by itself') },
      ],
      default: 'button',
      near: 'gate',
      predict: {
        prompt: b('Вы меняете, кто выпускает проверенное изменение. Как называется практика, при которой каждое изменение, прошедшее проверки, уходит на рабочий сайт само, без нажатия кнопки?', 'You change who releases a checked change. What is the practice called in which every change that passed the checks goes to the working site by itself, without a button press?'),
        options: [
          { id: 'deploy', text: b('Непрерывное развёртывание', 'Continuous deployment') },
          { id: 'delivery', text: b('Непрерывная доставка', 'Continuous delivery') },
          { id: 'ci', text: b('Непрерывная интеграция', 'Continuous integration') },
        ],
        resolve: () => 'deploy',
      },
    },
    {
      id: 'batch',
      group: b('Выпуск на рабочий сайт', 'Release to the working site'),
      label: b('Сколько изменений уходит на рабочий сайт за одну выкладку', 'Changes per deployment to the working site'),
      kind: 'range',
      min: 1,
      max: 20,
      step: 1,
      default: 10,
      near: 'batch',
      predict: {
        prompt: b('Вы меняете, сколько изменений уходит за одну выкладку, а доля проверок машиной остаётся прежней. Как это скажется на риске, что одна выкладка сломает сайт?', 'You change how many changes go out in one deployment, while the share of machine checks stays the same. How does this affect the risk that one deployment breaks the site?'),
        options: [
          { id: 'down', text: b('Чем меньше изменений в выкладке, тем ниже риск', 'The fewer changes in a deployment, the lower the risk') },
          { id: 'same', text: b('Риск не зависит от того, сколько изменений в выкладке', 'The risk does not depend on how many changes are in a deployment') },
          { id: 'up', text: b('Чем меньше изменений в выкладке, тем выше риск', 'The fewer changes in a deployment, the higher the risk') },
        ],
        resolve: (prev, next) => {
          const r0 = lastMetrics(prev).risk ?? 0;
          const r1 = lastMetrics(next).risk ?? 0;
          const n0 = prev.find((s) => s.id === 'deploy')?.values?.batch ?? '';
          const n1 = next.find((s) => s.id === 'deploy')?.values?.batch ?? '';
          if (r0 === r1) return 'same';
          const fewer = parseInt(n1, 10) < parseInt(n0, 10);
          return fewer === r1 < r0 ? 'down' : 'up';
        },
      },
    },
  ],
  breaks: [
    {
      id: 'no-rollback',
      label: b('Отката нет, поэтому прошлую версию вернуть нельзя, и сайт можно починить только новой выкладкой', 'No rollback: the previous version cannot be put back, the site can only be fixed with a new deployment'),
      remove: ['prev', 'e-rollback'],
      predict: {
        prompt: b('Откатить выкладку нельзя, а очередная выкладка сломала оплату на рабочем сайте. Что будет дальше?', 'A deployment cannot be rolled back, and the latest one broke the checkout on the working site. What happens next?'),
        options: [
          { id: 'hotfix', text: b('Команда выложит срочное исправление отдельной выкладкой', 'The team deploys an urgent fix in a separate deployment') },
          { id: 'same', text: b('Исправление дождётся следующей плановой выкладки', 'The fix waits for the next planned deployment') },
          { id: 'manual', text: b('Дежурный вручную вернёт прошлую версию за те же минуты', 'The on-call engineer puts the previous version back by hand in the same minutes') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'hotfix') ? 'hotfix' : 'same'),
      },
    },
  ],
  metrics: [
    { id: 'lead', label: b('от слияния до рабочего сайта, часов', 'merge to working site, hours') },
    { id: 'risk', label: b('риск одной выкладки', 'risk of one deployment'), unit: '%' },
    { id: 'freq', label: b('выкладок в неделю', 'deployments a week') },
    { id: 'restore', label: b('восстановление после сбоя, минут', 'recovery after a failure, minutes') },
    { id: 'diagnose', label: b('поиск виноватого изменения, минут', 'finding the faulty change, minutes') },
  ],
  run(p, broken): Step[] {
    const noRb = broken.has('no-rollback');
    const n = pipeNumbers(p, !noRb);
    // Recovery is the time until the customers can pay again. With a rollback the cause is looked for after that, so it does not count.
    const metrics = { lead: n.leadHours, risk: n.risk, freq: n.deploysPerWeek, restore: noRb ? n.diagnose + n.restore : n.restore, diagnose: n.diagnose };
    const humanHours = Math.round((1 - p.automation / 100) * 6 * 10) / 10;
    const fillHours = Math.round(((p.batch - 1) / 2) * 4 * 10) / 10;
    const steps: Step[] = [];
    steps.push({
      id: 'merge',
      label: b('слияние', 'merge'),
      caption: b('Разработчик слил небольшое изменение в общую ветку main. Слева внизу находится рабочий сайт, до которого это изменение должно дойти.', 'A developer merged a small change into the shared branch main. Bottom left is the working site the change has to reach.'),
      focus: ['merge'],
      say: { merge: b('Разработчик сливает небольшое изменение в общую ветку main.', 'A developer merges a small change into the shared branch main.') },
      states: { ...hiddenExcept(ALL, 'merge', 'prod') },
      values: { batch: `0 / ${p.batch}` },
      fill: { batch: 0 },
    });
    steps.push(
      p.build === 'auto'
        ? {
            id: 'build',
            label: b('сборка', 'build'),
            caption: b('Сборка запускается сама сразу после слияния, и через десять минут изменение собрано. Если в нём есть ошибка, разработчик узнает о ней, пока ещё помнит, что делал.', 'The build starts by itself right after the merge, and ten minutes later the change is built. If it has a mistake, the developer learns about it while they still remember what they did.'),
            focus: ['e-build', 'build'],
            say: { build: b('Сборка запускается сама сразу после слияния и занимает десять минут.', 'The build starts by itself right after the merge and takes ten minutes.') },
            tokens: [{ edge: 'e-build', label: b('10 мин', '10 min') }],
            reveal: ['e-build', 'build'],
            states: { 'e-build': 'ok' },
          }
        : {
            id: 'build',
            label: b('ждёт сборки', 'wait for build'),
            caption: b('Сборку запускают вручную, когда у кого-нибудь найдётся время, и изменение ждёт её целый рабочий день. Всё это время ошибки в нём никто не видит.', 'The build is started by hand when someone gets round to it, and the change waits a whole working day for it. All that time nobody sees its mistakes.'),
            focus: ['e-build', 'build'],
            say: { build: b('Сборку запустят вручную только завтра, поэтому изменение ждёт восемь часов.', 'Someone will start the build by hand only tomorrow; the change waits eight hours.') },
            tokens: [{ edge: 'e-build', label: b('8 ч', '8 h') }],
            reveal: ['e-build', 'build'],
            states: { 'e-build': 'warn' },
          },
    );
    steps.push({
      id: 'checks',
      label: b('проверки', 'checks'),
      caption:
        p.automation === 100
          ? b('Машина проверяет все сценарии за несколько минут, и ждать человека не нужно.', 'The machine checks all the scenarios in a few minutes, and nobody has to wait for a person.')
          : p.automation === 0
            ? fmtn(b('Машина не проверяет ничего, поэтому все сценарии проверяет человек, и на это уходит {h}.', 'The machine checks nothing: a person checks every scenario, which takes {h}.'), { h: H(humanHours) })
            : fmtn(b('Машина за минуты проверяет {a} % сценариев, а остальные проверяет человек, и на это уходит ещё {h}.', 'The machine checks {a}% of the scenarios in minutes, and a person checks the rest, which takes {h} more.'), { a: p.automation, h: H(humanHours) }),
      focus: ['e-checks', 'checks'],
      say: {
        checks: p.automation === 100 ? b('Машина проверяет все сценарии за несколько минут.', 'The machine checks every scenario in a few minutes.') : p.automation === 0 ? fmtn(b('Все сценарии проверяет человек, и это займёт {h}.', 'A person checks every scenario, which takes {h}.'), { h: H(humanHours) }) : fmtn(b('Машина проверяет {a} % сценариев, а остальные человек проверит за {h}.', 'The machine checks {a}% of the scenarios; a person checks the rest in {h}.'), { a: p.automation, h: H(humanHours) }),
      },
      tokens: [{ edge: 'e-checks', label: b('сборка', 'build') }],
      reveal: ['e-checks', 'checks'],
      states: { build: 'ok', checks: humanHours >= 4 ? 'warn' : 'on' },
    });
    steps.push({
      id: 'ci',
      label: b('граница CI', 'end of CI'),
      caption: hasCI(p)
        ? b('Здесь заканчивается непрерывная интеграция. Изменение слито в общую ветку, собрано и проверено машиной, но до рабочего сайта ещё не дошло.', 'Continuous integration ends here. The change is merged into the shared branch, built and checked by a machine, but it has not reached the working site yet.')
        : p.build === 'auto'
          ? b('Рамка отмечает, где заканчивалась бы непрерывная интеграция, но её здесь нет. Сборка запускается сама, а изменение проверил только человек. Непрерывной интеграцией это станет, когда каждое слияние будут проверять и автотесты.', 'The frame marks where continuous integration would end, but there is none here. The build starts by itself, while only a person has checked the change. It becomes continuous integration once automated tests check every merge too.')
          : b('Рамка отмечает, где заканчивалась бы непрерывная интеграция, но её здесь нет, потому что сборку запускают вручную, а не после каждого слияния. Непрерывной интеграцией это станет, когда каждое слияние будут собирать и проверять машины.', 'The frame marks where continuous integration would end, but there is none here, because the build is started by hand, not after every merge. It becomes continuous integration once machines build and check every merge.'),
      focus: ['g-ci', 'checks'],
      say: { checks: hasCI(p) ? b('Проверки пройдены, и на этом непрерывная интеграция заканчивается.', 'The checks passed: continuous integration ends here.') : b('Проверки пройдены, но непрерывной интеграции нет.', 'The checks passed, but there is no continuous integration.') },
      reveal: ['g-ci'],
      states: { checks: 'ok' },
    });
    steps.push({
      id: 'staging',
      label: b('стенд', 'staging'),
      caption: b('Конвейер выкладывает изменение на стенд тем же способом, каким потом выложит на рабочий сайт, и на стенде прогоняются проверки ещё раз.', 'The pipeline deploys the change to staging the same way it will later deploy it to the working site, and the checks run again on staging.'),
      focus: ['e-staging', 'staging'],
      say: { staging: b('Конвейер выкладывает изменение на стенд, копию рабочего сайта, и проверяет его там.', 'The pipeline deploys the change to staging, a copy of the working site, and checks it there.') },
      tokens: [{ edge: 'e-staging', label: b('проверено', 'checked') }],
      reveal: ['e-staging', 'staging'],
    });
    steps.push(
      p.last === 'auto'
        ? {
            id: 'gate-auto',
            label: b('сам', 'auto'),
            caption: gateAuto(p),
            focus: ['e-gate', 'gate'],
            say: { gate: b('Конвейер сам выпускает проверенное изменение.', 'The pipeline releases the checked change by itself.') },
            tokens: [{ edge: 'e-gate', label: b('без ожидания', 'no wait') }],
            reveal: ['e-gate', 'gate'],
            states: { staging: 'ok', gate: 'ok' },
          }
        : {
            id: 'gate-button',
            label: b('кнопка', 'button'),
            caption: hasCI(p)
              ? b('Изменение готово к выпуску в любой момент, а выпускает его человек одной кнопкой, обычно в течение нескольких часов. Такая практика называется непрерывной доставкой: изменение всегда готово к выпуску, а когда его выпускать, решает человек.', 'The change is ready to be released at any moment, and a person releases it with one button, usually within a few hours. This is continuous delivery: it is always ready, and a person decides when to release.')
              : b('Выпускает изменение человек одной кнопкой, обычно в течение нескольких часов. Непрерывной доставкой такую практику назвали бы, если бы каждое изменение сначала само собиралось и проверялось машиной, а здесь этого нет.', 'A person releases the change with one button, usually within a few hours. This would be called continuous delivery if every change were first built and checked by a machine by itself, and here it is not.'),
            focus: ['e-gate', 'gate'],
            say: { gate: b('Изменение ждёт, пока человек нажмёт кнопку «Выпустить».', 'The change waits for a person to press “Release”.') },
            tokens: [{ edge: 'e-gate', label: b('4 ч', '4 h') }],
            reveal: ['e-gate', 'gate'],
            states: { staging: 'ok', gate: 'wait' },
          },
    );
    steps.push({
      id: 'batch',
      label: b('партия', 'batch'),
      caption:
        p.batch === 1
          ? b('Партия состоит из одного изменения, поэтому выкладка уходит сразу и ничего не ждёт.', 'The batch is one change, so the deployment goes at once and waits for nothing.')
          : fmtn(b('Выкладку делают, когда наберётся партия из {b}, поэтому изменение ждёт ещё в среднем {h}.', 'A deployment happens once a batch of {b} is collected, so the change waits {h} more on average.'), { b: CH(p.batch), h: H(fillHours) }),
      focus: ['e-prod', 'batch'],
      say: { batch: p.batch === 1 ? b('Партия из одного изменения уходит сразу.', 'A batch of one change goes at once.') : fmtn(b('Партия ждёт, пока в ней наберётся {b}.', 'The batch waits until it holds {b}.'), { b: nWord(p.batch, ['изменение', 'изменения', 'изменений'], ['change', 'changes']) }) },
      tokens: [{ edge: 'e-prod', label: p.batch === 1 ? b('сразу', 'at once') : fmtn(b('{h} ч', '{h} h'), { h: fillHours }) }],
      reveal: ['e-prod', 'batch'],
      values: { batch: `${p.batch} / ${p.batch}` },
      fill: { batch: 1 },
      states: { batch: p.batch > 5 ? 'warn' : 'on' },
    });
    steps.push({
      id: 'deploy',
      label: b('выкладка', 'deploy'),
      caption: fmtn(b('Партия из {b} уходит на рабочий сайт. Вероятность того, что эта выкладка сломает сайт, равна {r} %. От слияния до рабочего сайта изменение шло {l}.', 'A batch of {b} goes to the working site. The chance that this deployment breaks the site is {r}%. From the merge to the working site the change took {l}.'), { b: CH(p.batch), r: n.risk, l: H(n.leadHours) }),
      focus: ['e-deploy', 'prod'],
      say: { prod: fmtn(b('На рабочий сайт приходит партия из {b}, и с вероятностью {r} % она его сломает.', 'A batch of {b} arrives at the working site; the risk that it breaks the site is {r}%.'), { b: CH(p.batch), r: n.risk }) },
      tokens: [{ edge: 'e-deploy', label: `×${p.batch}` }],
      reveal: ['e-deploy'],
      states: { prod: n.risk > 30 ? 'warn' : 'ok', batch: 'ok' },
      values: { batch: `${p.batch} / ${p.batch}` },
      fill: { batch: 0 },
      metrics,
    });
    if (noRb) {
      steps.push({
        id: 'hotfix',
        label: b('исправление', 'hotfix'),
        caption: fmtn(b('Допустим, выкладка сломала оплату. Откатиться нельзя, поэтому команда {w}, потом пишет срочное исправление и за {r} выкладывает его. Это вторая, внеплановая выкладка.', 'Suppose the deployment broke the checkout. With no rollback the team spends {w}, then writes an urgent fix and deploys it in {r}, a second, unplanned deployment.'), { w: p.batch === 1 ? fmtn(b('{d} ищет ошибку в единственном изменении', '{d} looking for the mistake in the only change'), { d: MIN(n.diagnose) }) : fmtn(b('{d} выясняет, какое из {b} виновато', '{d} working out which of the {b} is to blame'), { d: MIN(n.diagnose), b: CH(p.batch) }), r: MIN(n.restore) }),
        focus: ['prod'],
        say: { prod: fmtn(b('Оплата не работает, и починит её только новая выкладка через {t}.', 'The checkout is down until a new deployment in {t}.'), { t: MIN(n.diagnose + n.restore) }) },
        states: { prod: 'err' },
        metrics,
        broken: { at: 'prod', message: `deploy #42 (hotfix, unplanned): fix for checkout\nrecovery: ${n.diagnose + n.restore} min`, caption: b('без отката сайт чинят новой выкладкой, а это занимает больше времени, несёт больше риска и добавляет ещё одну выкладку.', 'without a rollback the site is fixed with a new deployment: it takes longer, it is a new risk, and it is one more deployment.') },
      });
    } else {
      steps.push({
        id: 'rollback',
        label: b('если сбой', 'if it fails'),
        caption: fmtn(b('А если выкладка всё же сломает сайт, дежурный за {r} вернёт прошлую версию, и покупатели снова смогут платить. {w}', 'And if the deployment does break the site, the on-call engineer puts the previous version back in {r}, and the customers can pay again. {w}'), { w: p.batch === 1 ? fmtn(b('Ошибку в изменении найдут потом, спокойно, и на это уйдёт {d}.', 'The mistake is found later, calmly, in {d}.'), { d: MIN(n.diagnose) }) : fmtn(b('Какое из {b} виновато, выяснят потом, спокойно, и на это уйдёт {d}.', 'Which of the {b} is to blame is found later, calmly, in {d}.'), { b: CH(p.batch), d: MIN(n.diagnose) }), r: MIN(n.restore) }),
        focus: ['e-rollback', 'prev'],
        say: { prev: fmtn(b('Прошлая версия хранится наготове, поэтому откат займёт {r}.', 'The previous version is kept ready, so a rollback takes {r}.'), { r: MIN(n.restore) }) },
        tokens: [{ edge: 'e-rollback', label: 'v41' }],
        reveal: ['prev', 'e-rollback'],
        metrics,
      });
    }
    return steps;
  },
  explainDelta(prev, next, change, a, c): Bi {
    const m0 = lastMetrics(prev);
    const m1 = lastMetrics(next);
    const v = { l0: m0.lead ?? 0, l1: H(m1.lead ?? 0), r0: m0.risk ?? 0, r1: m1.risk ?? 0, f1: m1.freq ?? 0, s0: m0.restore ?? 0, s1: MIN(m1.restore ?? 0) };
    if (change.kind === 'break')
      return change.on
        ? fmtn(b('Без отката восстановление занимает {s1} вместо {s0}, потому что сайт чинят срочным исправлением, и появляется вторая, внеплановая выкладка.', 'Without rollback recovery takes {s1} instead of {s0}: the site is fixed with an urgent fix, and a second, unplanned deployment appears.'), v)
        : b('Откат вернулся, и сайт снова восстанавливают за минуты.', 'Rollback is back, and the site is again restored in minutes.');
    switch (change.id) {
      case 'build':
        return c.build === 'auto'
          ? fmtn(b('Сборка теперь запускается сама после слияния, и ожидание сборки исчезло, поэтому путь до рабочего сайта занимает {l1} вместо {l0}. Ошибку теперь видно через минуты, а не на следующий день.', 'The build now starts by itself after the merge, and the wait for a build is gone: the path to the working site takes {l1} instead of {l0}. A mistake shows up in minutes, not tomorrow.'), v)
          : fmtn(b('Сборку снова запускают вручную, и путь до рабочего сайта теперь занимает {l1} вместо {l0}.', 'The build is started by hand again: the path to the working site takes {l1} instead of {l0}.'), v);
      case 'last':
        return c.last === 'auto'
          ? join(gateAuto(c as P), fmtn(b('Путь до рабочего сайта занимает {l1} вместо {l0}, потому что ожидание кнопки исчезло.', 'The path to the working site takes {l1} instead of {l0}, because the wait for the button is gone.'), v))
          : hasCI(c as P)
            ? b('Выпуск снова идёт по кнопке, и такая практика называется непрерывной доставкой. Выпустить изменение можно в любой момент, но решение принимает человек.', 'A button again, and this is continuous delivery: a change can be released at any moment, but a person decides.')
            : b('Выпуск снова идёт по кнопке. Непрерывной доставкой это станет, когда каждое изменение будет само собираться и проверяться машиной.', 'A button again. It becomes continuous delivery once every change is built and checked by a machine by itself.');
      case 'automation':
        return fmtn(b('Машина теперь выполняет {y} % проверок вместо {x} %. Риск одной выкладки теперь {r1} % вместо {r0} %, а путь до рабочего сайта занимает {l1} вместо {l0}.', 'A machine now runs {y}% of the checks instead of {x}%. The risk of one deployment is {r1}% instead of {r0}%, the path to the working site {l1} instead of {l0}.'), { x: a.automation as number, y: c.automation as number, ...v });
      default:
        return fmtn(b('Теперь в одну выкладку уходит {yy} вместо {x}. Риск выкладки теперь {r1} % вместо {r0} %, путь изменения до рабочего сайта занимает {l1} вместо {l0}, а выкладок в неделю становится {f1}. Чем меньше изменений уходит за один раз, тем быстрее они доходят до покупателей и тем реже что-нибудь ломают.', 'One deployment now holds {yy} instead of {x}. The deployment risk is {r1}% instead of {r0}%, the path of a change to the working site {l1} instead of {l0}, {f1} deployments a week. The fewer changes go out at once, the faster they reach the customers and the less often they break something.'), { x: a.batch as number, yy: nWord(c.batch as number, ['изменение', 'изменения', 'изменений'], ['change', 'changes']), ...v });
    }
  },
});

/** What a release without a button is, given the rest of the pipeline. */
function gateAuto(p: P): Bi {
  if (!hasCI(p))
    return b('Кнопки нет, и конвейер выпускает изменения сам. Но непрерывным развёртыванием это не назвать, потому что оно опирается на непрерывную интеграцию, а её здесь нет, ведь изменение после слияния не собирается само или не проверяется автотестами.', 'There is no button, and the pipeline releases changes by itself. Yet this is not continuous deployment, which rests on continuous integration, and there is none here: after the merge the change is not built at once or not checked by tests.');
  if (p.batch > 1)
    return fmtn(b('Кнопки нет, и конвейер выпускает изменения сам, но копит их в партии по {b}, поэтому изменение уходит на рабочий сайт не сразу. Непрерывным развёртыванием практику называют, только когда каждое проверенное изменение уходит отдельно и сразу.', 'There is no button, and the pipeline releases changes by itself, but it collects them into batches of {b}, so a change does not go out at once. Continuous deployment is when every checked change goes out on its own and at once.'), { b: nWord(p.batch, ['изменение', 'изменения', 'изменений'], ['change', 'changes']) });
  return b('Кнопки здесь нет, и всё, что прошло проверки, конвейер выпускает сам, без решения человека. Такая практика называется непрерывным развёртыванием.', 'There is no button: the pipeline releases everything that passed the checks by itself, without a human decision. This practice is called continuous deployment.');
}

/** Sentences joined with spaces, empty ones dropped. */
function join(...parts: Bi[]): Bi {
  return { ru: parts.map((x) => x.ru).filter(Boolean).join(' '), en: parts.map((x) => x.en).filter(Boolean).join(' ') };
}
