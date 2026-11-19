// X1, screens 5–8 (07 §5.3): the deployment pipeline as an organisational
// path. Where continuous integration ends, what makes continuous delivery,
// what turns it into continuous deployment, how batch size and automated
// checks move the risk, and what rollback buys. The risk numbers come from
// the flowlab model (engine/flowlab/sim.ts), so they match the simulator.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';
import { diagnoseMinutes, pFail, restoreMinutes } from '../../../engine/flowlab/sim';

type P = { build: string; last: string; automation: number; batch: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
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

export const pipelineModel = defineModel<P>({
  id: 'method.x.pipeline',
  block: 'methodology',
  title: bi('Конвейер: от слияния до прода', 'The pipeline: from merge to production'),
  summary: bi(
    'Путь изменения после того, как разработчик слил его в общую ветку. Переключайте сборку, последний шаг, долю проверок машиной и размер партии; уберите откат.',
    'The path of a change after a developer merged it into the shared branch. Switch the build, the last step, the share of machine checks and the batch size; remove the rollback.',
  ),
  concepts: ['method.ci', 'method.cdelivery', 'method.cdeployment', 'method.pipeline', 'method.rollback'],
  diagram: {
    width: 960,
    height: 340,
    nodes: [
      { id: 'merge', label: bi('Слияние', 'Merge'), sub: 'main', family: 'ci-source', x: 24, y: 72, w: 128, h: 56, card: card(bi('Разработчик сливает изменение в общую ветку — хотя бы раз в день, маленькими порциями.', 'A developer merges the change into the shared branch, at least daily, in small pieces.'), bi('Разработчик.', 'A developer.'), { doc: FOWLER }) },
      { id: 'build', label: bi('Сборка', 'Build'), sub: '', family: 'ci-build', x: 200, y: 72, w: 128, h: 56, card: card(bi('Из исходного кода получают то, что можно запустить. Вручную — когда у кого-то дойдут руки; автоматически — сразу после слияния.', 'The source code is turned into something that can run. By hand: when someone gets round to it; automatically: right after the merge.'), bi('Человек или сервер сборки.', 'A person or a build server.')) },
      { id: 'checks', label: bi('Автотесты', 'Automated tests'), sub: '', family: 'ci-test', x: 376, y: 72, w: 136, h: 56, card: card(bi('Проверки, которые выполняет машина за минуты. Что не проверяет машина, проверяет человек — часами.', 'Checks a machine runs in minutes. What the machine does not check, a person checks, in hours.'), bi('Сервер сборки; тесты пишут разработчики и тестировщики.', 'The build server; developers and testers write the tests.')) },
      { id: 'staging', label: bi('Стенд', 'Staging'), sub: '', family: 'ci-deploy', x: 560, y: 72, w: 128, h: 56, card: card(bi('Копия прода для проверки: изменение выкладывают туда тем же способом, что и на прод.', 'A copy of production for checking: the change is deployed there the same way as to production.'), bi('Конвейер.', 'The pipeline.')) },
      { id: 'gate', label: bi('Выпуск', 'Release'), sub: '', family: 'cp', shape: 'hex', x: 736, y: 72, w: 112, h: 56, card: card(bi('Последний шаг. Кнопка — непрерывная доставка: любое проверенное изменение можно выпустить в любой момент. Стрелка «сама» — непрерывное развёртывание.', 'The last step. A button means continuous delivery: any checked change can be released at any moment. An automatic arrow means continuous deployment.'), bi('Человек с кнопкой или сам конвейер.', 'A person with a button, or the pipeline itself.'), { doc: CD }) },
      { id: 'prod', label: bi('Прод', 'Production'), sub: '', family: 'node', shape: 'rack', x: 736, y: 232, w: 112, h: 64, card: card(bi('Рабочая версия сайта. Выкладка везёт сюда партию изменений.', 'The working site. A deployment brings a batch of changes here.'), bi('Эксплуатация и конвейер.', 'Operations and the pipeline.')) },
      { id: 'batch', label: bi('Партия', 'Batch'), sub: '', family: 'gauge', shape: 'buffer', x: 520, y: 240, w: 152, h: 48, card: card(bi('Изменения, которые уходят на прод за одну выкладку. Чем больше партия, тем выше риск и тем дольше искать виноватое изменение.', 'The changes that go to production in one deployment. The bigger the batch, the higher the risk and the longer it takes to find the faulty change.'), bi('Правило команды: как часто выкладываем.', 'A team rule: how often we deploy.')) },
    ],
    edges: [
      { id: 'e-build', from: 'merge', to: 'build', label: bi('ждём сборку', 'waiting for a build'), card: card(bi('Без автосборки изменение ждёт, пока сборку запустят руками.', 'Without automatic builds the change waits until someone starts a build by hand.'), bi('Никто: это ожидание.', 'Nobody: it is waiting.')) },
      { id: 'e-checks', from: 'build', to: 'checks', label: bi('собрано', 'built'), card: card(bi('Собранное сразу проверяется.', 'What was built is checked at once.'), bi('Конвейер.', 'The pipeline.')) },
      { id: 'e-staging', from: 'checks', to: 'staging', label: bi('проверки зелёные', 'checks are green'), card: card(bi('Дальше идёт только то, что прошло проверки. Красный результат чинят первым делом.', 'Only what passed the checks goes on. A red result is fixed first.'), bi('Конвейер.', 'The pipeline.'), { doc: FOWLER }) },
      { id: 'e-gate', from: 'staging', to: 'gate', label: bi('готово к выпуску', 'ready to release'), card: card(bi('Изменение проверено на стенде и может уйти на прод.', 'The change is checked on staging and may go to production.'), bi('Конвейер.', 'The pipeline.')) },
      { id: 'e-prod', from: 'gate', to: 'batch', via: [[792, 200], [596, 200]], label: bi('в партию', 'into the batch'), labelAt: 0.35, card: card(bi('Изменения копятся, пока не наберётся партия на выкладку.', 'Changes pile up until a batch for a deployment is collected.'), bi('Правило команды.', 'A team rule.')) },
      { id: 'e-deploy', from: 'batch', to: 'prod', label: bi('выкладка', 'deployment'), card: card(bi('Партия уезжает на прод одной выкладкой.', 'The batch goes to production in one deployment.'), bi('Эксплуатация или конвейер.', 'Operations or the pipeline.')) },
      { id: 'e-rollback', from: 'prod', to: 'staging', via: [[792, 320], [712, 320], [712, 100]], dashed: true, label: bi('откат', 'rollback'), labelAt: 0.3, card: card(bi('Если выкладка сломала сайт, прод возвращают к прошлой версии за минуты, а чинят потом.', 'When a deployment breaks the site, production is returned to the previous version in minutes, and the fix comes later.'), bi('Дежурный, одной командой или кнопкой.', 'The on-call engineer, with one command or button.')) },
    ],
    groups: [
      { id: 'g-ci', label: bi('непрерывная интеграция', 'continuous integration'), around: ['merge', 'build', 'checks'], family: 'ci-build', dash: 'dash', pad: 12, card: card(bi('Заканчивается после автотестов: изменение слито, собрано и проверено машиной. До прода CI не доходит.', 'It ends after the automated tests: the change is merged, built and checked by a machine. CI does not reach production.'), bi('Вся команда: каждый сливает часто.', 'The whole team: everyone merges often.'), { doc: FOWLER }) },
    ],
  },
  params: [
    {
      id: 'build',
      label: bi('Сборка', 'Build'),
      kind: 'choice',
      options: [
        { id: 'manual', label: bi('вручную', 'by hand') },
        { id: 'auto', label: bi('после каждого слияния', 'after every merge') },
      ],
      default: 'manual',
      near: 'build',
    },
    {
      id: 'last',
      label: bi('Последний шаг', 'The last step'),
      kind: 'choice',
      options: [
        { id: 'button', label: bi('кнопка', 'a button') },
        { id: 'auto', label: bi('сам', 'by itself') },
      ],
      default: 'button',
      near: 'gate',
      predict: {
        prompt: bi('Кнопку убрали: всё, что прошло проверки, уходит на прод само. Как это называется?', 'The button is gone: everything that passed the checks goes to production by itself. What is it called?'),
        options: [
          { id: 'deploy', text: bi('Непрерывное развёртывание', 'Continuous deployment') },
          { id: 'delivery', text: bi('Непрерывная доставка', 'Continuous delivery') },
          { id: 'ci', text: bi('Непрерывная интеграция', 'Continuous integration') },
        ],
        resolve: () => 'deploy',
      },
    },
    { id: 'automation', label: bi('Доля проверок машиной, %', 'Share of checks done by machines, %'), kind: 'range', min: 0, max: 100, step: 20, unit: '%', default: 0, near: 'checks' },
    {
      id: 'batch',
      label: bi('Изменений в одной выкладке', 'Changes per deployment'),
      kind: 'range',
      min: 1,
      max: 20,
      step: 1,
      default: 10,
      near: 'batch',
      predict: {
        prompt: bi('Выкладываем по одному изменению вместо десяти. Что станет с риском одной выкладки?', 'We deploy one change at a time instead of ten. What happens to the risk of one deployment?'),
        options: [
          { id: 'down', text: bi('Упадёт в несколько раз', 'It falls several times over') },
          { id: 'up', text: bi('Вырастет: выкладок больше', 'It grows: there are more deployments') },
          { id: 'same', text: bi('Не изменится', 'It stays the same') },
        ],
        resolve: (prev, next) => ((next[next.length - 1].metrics?.risk ?? 0) < (prev[prev.length - 1].metrics?.risk ?? 0) ? 'down' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-rollback',
      label: bi('Убрать откат', 'Remove the rollback'),
      remove: ['e-rollback'],
      predict: {
        prompt: bi('Отката нет. Выкладка сломала оплату. Что будет?', 'There is no rollback. A deployment broke the checkout. What happens?'),
        options: [
          { id: 'hotfix', text: bi('Чинят на ходу хотфиксом: дольше, и это ещё одна, внеплановая выкладка', 'They fix it live with a hotfix: longer, and one more, unplanned deployment') },
          { id: 'same', text: bi('Ничего: подождут своей очереди', 'Nothing: they just wait') },
        ],
        resolve: () => 'hotfix',
      },
    },
  ],
  metrics: [
    { id: 'lead', label: bi('от слияния до прода', 'merge to production'), unit: 'h' },
    { id: 'risk', label: bi('риск выкладки', 'deployment risk'), unit: '%' },
    { id: 'freq', label: bi('выкладок в неделю', 'deployments a week') },
    { id: 'restore', label: bi('восстановление', 'recovery'), unit: 'min' },
  ],
  run(p, broken): Step[] {
    const noRb = broken.has('no-rollback');
    const n = pipeNumbers(p, !noRb);
    const metrics = { lead: n.leadHours, risk: n.risk, freq: n.deploysPerWeek, restore: n.diagnose + n.restore };
    const steps: Step[] = [
      { id: 'merge', label: bi('слияние', 'merge'), caption: bi('Разработчик слил небольшое изменение в общую ветку. Дальше его путь до покупателей.', 'A developer merged a small change into the shared branch. Now its path to the customers.'), focus: ['merge'], states: { merge: 'on', 'e-rollback': noRb ? 'off' : 'on' }, values: { gate: p.last === 'auto' ? 'auto' : '[ Release ]', batch: `0 / ${p.batch}` }, fill: { batch: 0 } },
      p.build === 'auto'
        ? { id: 'build', label: bi('сборка', 'build'), caption: bi('Сборка запускается сама сразу после слияния: десять минут — и изменение собрано.', 'The build starts by itself right after the merge: ten minutes and the change is built.'), focus: ['e-build', 'build'], tokens: [{ edge: 'e-build', label: '0:10' }], values: { build: 'auto' }, states: { 'e-build': 'ok' } }
        : { id: 'build', label: bi('ждём сборку', 'wait for build'), caption: bi('Сборку запускают руками, когда у кого-то дойдут руки: изменение ждёт день, а ошибки в нём ещё никто не видел.', 'The build is started by hand when someone gets round to it: the change waits a day, and nobody has seen its mistakes yet.'), focus: ['e-build', 'build'], tokens: [{ edge: 'e-build', label: '8:00' }], values: { build: 'manual' }, states: { 'e-build': 'warn' } },
      {
        id: 'checks',
        label: bi('проверки', 'checks'),
        caption: fmt(bi('Машина проверяет {a}% сценариев за минуты, остальное — человек, ещё {h} ч. Здесь заканчивается непрерывная интеграция: изменение слито, собрано и проверено.', 'The machine checks {a}% of the scenarios in minutes, a person does the rest in {h} more hours. Continuous integration ends here: the change is merged, built and checked.'), { a: p.automation, h: Math.round((1 - p.automation / 100) * 6 * 10) / 10 }),
        focus: ['checks', 'g-ci'],
        tokens: [{ edge: 'e-checks' }],
        values: { checks: `${p.automation}% auto` },
        states: { checks: 'ok' },
      },
      { id: 'staging', label: bi('стенд', 'staging'), caption: bi('Проверки зелёные — изменение выкладывают на стенд тем же способом, что и на прод.', 'The checks are green: the change goes to staging the same way it will go to production.'), focus: ['staging', 'e-staging'], tokens: [{ edge: 'e-staging' }], states: { staging: 'ok' } },
      p.last === 'auto'
        ? { id: 'gate', label: bi('сам', 'auto'), caption: bi('Кнопки нет: всё, что прошло проверки, уходит дальше само. Это непрерывное развёртывание.', 'There is no button: everything that passed the checks moves on by itself. This is continuous deployment.'), focus: ['gate', 'e-gate'], tokens: [{ edge: 'e-gate' }], states: { gate: 'ok' } }
        : { id: 'gate', label: bi('кнопка', 'button'), caption: bi('Изменение готово к выпуску в любой момент; выпускает человек одной кнопкой. Это непрерывная доставка: готовность есть всегда, решение — за человеком.', 'The change is ready to be released at any moment; a person releases it with one button. This is continuous delivery: always ready, a human decides.'), focus: ['gate', 'e-gate'], tokens: [{ edge: 'e-gate' }], states: { gate: 'wait' } },
      {
        id: 'batch',
        label: bi('партия', 'batch'),
        caption: p.batch === 1 ? bi('Партия из одного изменения: выкладка уходит сразу.', 'A batch of one change: the deployment goes at once.') : fmt(bi('Изменение ждёт, пока наберётся партия из {b}: в среднем ещё {h} ч.', 'The change waits until a batch of {b} is collected: {h} more hours on average.'), { b: p.batch, h: Math.round(((p.batch - 1) / 2) * 4 * 10) / 10 }),
        focus: ['batch', 'e-prod'],
        tokens: [{ edge: 'e-prod' }],
        values: { batch: `${p.batch} / ${p.batch}` },
        fill: { batch: 1 },
      },
      {
        id: 'deploy',
        label: bi('выкладка', 'deploy'),
        caption: fmt(bi('Партия из {b} изм. уходит на прод. Риск, что выкладка сломает сайт, — {r}%. Путь от слияния до прода — {l} рабочих ч.', 'A batch of {b} changes goes to production. The risk that the deployment breaks the site is {r}%. From merge to production: {l} working hours.'), { b: p.batch, r: n.risk, l: n.leadHours }),
        focus: ['e-deploy', 'prod'],
        tokens: [{ edge: 'e-deploy', label: `×${p.batch}` }],
        states: { prod: n.risk > 30 ? 'warn' : 'ok' },
        values: { prod: `risk ${n.risk}%`, batch: `0 / ${p.batch}` },
        fill: { batch: 0 },
        metrics,
      },
    ];
    if (noRb) {
      steps.push({
        id: 'hotfix',
        label: bi('хотфикс', 'hotfix'),
        caption: fmt(bi('Выкладка сломала оплату. Отката нет: ищут причину среди {b} изменений {d} мин, потом пишут исправление и выкладывают его ещё раз — {r} мин. Это вторая, внеплановая выкладка.', 'The deployment broke the checkout. There is no rollback: finding the cause among {b} changes takes {d} min, then a fix is written and deployed again, {r} min. That is a second, unplanned deployment.'), { b: p.batch, d: n.diagnose, r: n.restore }),
        focus: ['prod'],
        states: { prod: 'err', 'e-rollback': 'off' },
        metrics,
        broken: { at: 'prod', message: `deploy #42 (hotfix, unplanned): fix for checkout\nrecovery: ${n.diagnose + n.restore} min`, caption: bi('без отката сайт чинят вперёд: дольше, с риском, и это ещё одна выкладка.', 'without a rollback the site is fixed forward: longer, risky, and one more deployment.') },
      });
    } else {
      steps.push({
        id: 'rollback',
        label: bi('если сбой', 'if it fails'),
        caption: fmt(bi('Если выкладка сломает сайт: причину ищут среди {b} изменений {d} мин, а откатывают к прошлой версии за {r} мин и спокойно чинят потом.', 'If the deployment breaks the site: finding the cause among {b} changes takes {d} min, and rolling back to the previous version takes {r} min; the fix comes later, calmly.'), { b: p.batch, d: n.diagnose, r: n.restore }),
        focus: ['e-rollback', 'staging'],
        tokens: [{ edge: 'e-rollback', label: 'v41' }],
        states: { 'e-rollback': 'on' },
        metrics,
      });
    }
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m0 = prev[prev.length - 1].metrics ?? {};
    const m1 = next[next.length - 1].metrics ?? {};
    const v = { l0: m0.lead ?? 0, l1: m1.lead ?? 0, r0: m0.risk ?? 0, r1: m1.risk ?? 0, f1: m1.freq ?? 0, s0: m0.restore ?? 0, s1: m1.restore ?? 0 };
    if (change.kind === 'break') return change.on ? fmt(bi('Без отката восстановление {s0} → {s1} мин: путь идёт через хотфикс, и появляется вторая, внеплановая выкладка.', 'Without rollback, recovery goes {s0} → {s1} min: the path goes through a hotfix, and a second, unplanned deployment appears.'), v) : bi('Откат вернулся: восстановление снова за минуты.', 'Rollback is back: recovery takes minutes again.');
    switch (change.id) {
      case 'build':
        return b.build === 'auto' ? fmt(bi('Автосборка после слияния: ожидание «ждём сборку» исчезло, путь {l0} → {l1} ч. Ошибку видно через минуты, а не завтра.', 'Automatic build after the merge: the “waiting for a build” wait is gone, the path goes {l0} → {l1} h. A mistake shows up in minutes, not tomorrow.'), v) : fmt(bi('Сборка снова вручную: путь {l0} → {l1} ч.', 'Builds by hand again: the path goes {l0} → {l1} h.'), v);
      case 'last':
        return b.last === 'auto' ? fmt(bi('Последний шаг сам: это уже непрерывное развёртывание. Путь {l0} → {l1} ч — ушло ожидание кнопки.', 'The last step goes by itself: this is continuous deployment now. The path goes {l0} → {l1} h: the wait for the button is gone.'), v) : bi('Снова кнопка: непрерывная доставка — выпустить можно в любой момент, решает человек.', 'A button again: continuous delivery — release is possible at any moment, a person decides.');
      case 'automation':
        return fmt(bi('Проверок машиной {x}% → {y}%: риск выкладки {r0}% → {r1}%, путь {l0} → {l1} ч.', 'Machine checks {x}% → {y}%: deployment risk {r0}% → {r1}%, the path {l0} → {l1} h.'), { x: a.automation as number, y: b.automation as number, ...v });
      default:
        return fmt(bi('Партия {x} → {y}: риск выкладки {r0}% → {r1}%, путь изменения {l0} → {l1} ч, выкладок в неделю {f1}. Меньше партия — и быстрее, и надёжнее.', 'Batch {x} → {y}: deployment risk {r0}% → {r1}%, the path of a change {l0} → {l1} h, {f1} deployments a week. A smaller batch is both faster and safer.'), { x: a.batch as number, y: b.batch as number, ...v });
    }
  },
});
