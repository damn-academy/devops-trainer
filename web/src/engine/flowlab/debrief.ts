// The debrief after a scenario (07 §10): your run step by step, your run
// against the baseline and reference bots on the same seed, the three
// decisions that changed most (counterfactual replays), "explain it
// yourself", and how your predictions matched the model. No score.

import { clear, h, icon, put } from '../../core/dom';
import { bi, fmt, lang, t, type Bi } from '../../core/i18n';
import type { NewEvent } from '../../core/types';
import { money, RUB_PER_USD } from './money';
import { bots, counterfactuals } from './bots';
import { cfdChart, linesChart } from './charts';
import { metrics } from './metrics';
import { THEORY } from './theory';
import type { FlowMetrics, Scenario, State } from './types';

export interface DebriefOpts {
  back(): void;
  again(seed: number): void;
  record(e: NewEvent): void;
}

/** Which key ideas of the model answer an explanation mentions (stems, case-insensitive). */
export function explainHits(sc: Scenario, text: string): boolean[] {
  const low = text.toLowerCase();
  return sc.explain.keys.map((k) => [...k.ru, ...k.en].some((stem) => low.includes(stem.toLowerCase())));
}

interface Row {
  label: Bi;
  key: keyof FlowMetrics;
  fmt: (v: number) => string;
  better: 'low' | 'high';
}

export function mountDebrief(root: HTMLElement, sc: Scenario, s: State, o: DebriefOpts): { dispose(): void } {
  const me = metrics(s, sc);
  const b = bots(sc, s.seed);
  const cf = counterfactuals(sc, s);
  let day = s.history.length;

  const rows: Row[] = [
    { label: bi('Готово у покупателей', 'Delivered'), key: 'doneCount', fmt: String, better: 'high' },
    { label: bi('Время цикла, 85-й процентиль', 'Cycle time, 85th percentile'), key: 'cycleP85', fmt: (v) => `${v} ${t(bi('дн.', 'd'))}`, better: 'low' },
    { label: bi('Незавершённая работа, в среднем', 'Work in progress, average'), key: 'wipAvg', fmt: String, better: 'low' },
    { label: bi('Потери от задержки', 'Cost of delay'), key: 'codLost', fmt: money, better: 'low' },
  ];
  if (sc.hasOps) rows.push({ label: bi('Потери от сбоев', 'Outage losses'), key: 'downtimeLost', fmt: money, better: 'low' });
  if (sc.columns.includes('deploy'))
    rows.push(
      { label: bi('Выкладок', 'Deployments'), key: 'deploys', fmt: String, better: 'high' },
      { label: bi('Доля неудачных изменений', 'Change failure rate'), key: 'cfr', fmt: (v) => `${Math.round(v * 100)}%`, better: 'low' },
    );
  if (sc.features.budget) rows.push({ label: bi('Остаток бюджета ошибок', 'Error budget left'), key: 'budgetLeftRatio', fmt: (v) => `${Math.round(v * 100)}%`, better: 'high' });
  if (s.cards.some((c) => c.tags?.includes('promo'))) rows.push({ label: bi('Промо-задач к сроку', 'Promo tasks by the due day'), key: 'promoByDue', fmt: String, better: 'high' });

  const el = h('div.fl-debrief');
  root.append(el);

  const stepper = h('div.fl-steps');
  const drawStep = () => {
    clear(stepper);
    const part: State = { ...s, history: s.history.slice(0, day) };
    stepper.append(
      h(
        'div.fl-step-ctl',
        {},
        h('button.icon-btn', { type: 'button', 'aria-label': t(bi('Назад', 'Back')), disabled: day <= 1, onclick: () => ((day = Math.max(1, day - 1)), drawStep()) }, icon('prev')),
        h('input.fl-step-range', {
          type: 'range',
          min: 1,
          max: s.history.length,
          value: day,
          'aria-label': t(bi('День прогона', 'Day of the run')),
          oninput: (e: Event) => {
            day = Number((e.target as HTMLInputElement).value);
            drawStep();
          },
        }),
        h('button.icon-btn', { type: 'button', 'aria-label': t(bi('Вперёд', 'Forward')), disabled: day >= s.history.length, onclick: () => ((day = Math.min(s.history.length, day + 1)), drawStep()) }, icon('next')),
        h('span.fl-step-day', {}, t(fmt(bi('День {d}', 'Day {d}'), { d: day }))),
      ),
      cfdChart(part, sc),
      h('ul.fl-step-log', {}, ...s.log.filter((e) => e.day === day).map((e) => h('li', {}, e.tone ? h('span.st-icon', { class: e.tone, 'aria-hidden': 'true' }, e.tone === 'ok' ? '✓' : e.tone === 'err' ? '⨯' : '!') : null, t(e.text)))),
    );
    stepper.querySelector<HTMLInputElement>('.fl-step-range')?.focus({ preventScroll: true });
  };

  const cum = (st: State, f: (x: State['history'][number]) => number) => st.history.map(f);
  const deliveredSeries = [
    { label: bi('вы', 'you'), cls: 'you', values: cum(s, (x) => x.doneTotal) },
    { label: bi('без методологии', 'baseline'), cls: 'base', values: cum(b.baselineState, (x) => x.doneTotal) },
    { label: bi('эталон', 'reference'), cls: 'ref', values: cum(b.referenceState, (x) => x.doneTotal) },
  ];
  const lossSeries = [
    { label: bi('вы', 'you'), cls: 'you', values: cum(s, (x) => (x.codLost + x.downtimeLost) / (lang() === 'ru' ? 1 : RUB_PER_USD)) },
    { label: bi('без методологии', 'baseline'), cls: 'base', values: cum(b.baselineState, (x) => (x.codLost + x.downtimeLost) / (lang() === 'ru' ? 1 : RUB_PER_USD)) },
    { label: bi('эталон', 'reference'), cls: 'ref', values: cum(b.referenceState, (x) => (x.codLost + x.downtimeLost) / (lang() === 'ru' ? 1 : RUB_PER_USD)) },
  ];

  const diffSentence = (): Bi => {
    const d1 = me.moneyNet - b.baseline.moneyNet;
    const d2 = b.reference.moneyNet - me.moneyNet;
    const rub = (x: number) => `${Math.round(x).toLocaleString('ru-RU')} ₽`;
    const usd = (x: number) => `$${Math.round(x / RUB_PER_USD).toLocaleString('en-US')}`;
    const ru = `${d1 >= 0 ? `На ${rub(d1)} лучше команды без методологии` : `На ${rub(-d1)} хуже команды без методологии`}, ${d2 > 0 ? `на ${rub(d2)} хуже эталона` : `на ${rub(-d2)} лучше эталона`}.`;
    const en = `${d1 >= 0 ? `${usd(d1)} better than the team without the method` : `${usd(-d1)} worse than the team without the method`}, ${d2 > 0 ? `${usd(d2)} behind the reference` : `${usd(-d2)} ahead of the reference`}.`;
    return { ru, en };
  };

  const answer = h('textarea.fl-explain', { rows: 5, 'aria-label': t(sc.explain.prompt) }) as HTMLTextAreaElement;
  const result = h('div.fl-explain-result', { 'aria-live': 'polite' });
  const check = () => {
    const hits = explainHits(sc, answer.value);
    clear(result);
    result.append(
      h('p.small', {}, t(bi('Какие ключевые мысли есть в вашем ответе (это подсказка для самопроверки, не оценка):', 'Which key ideas your answer contains (a hint for checking yourself, not a grade):'))),
      h('ul.fl-keys', {}, ...sc.explain.keys.map((k, i) => h('li', { class: hits[i] ? 'ok' : '' }, h('span.st-icon', { class: hits[i] ? 'ok' : '', 'aria-hidden': 'true' }, hits[i] ? '✓' : '·'), t(k.label)))),
      h('details.fl-model', { open: true }, h('summary', {}, t(bi('Как это объясняет эталон', 'How the model answer explains it'))), h('p', {}, t(sc.explain.model))),
    );
    o.record({ kind: 'x.flowlab.explain', scenario: sc.id, hits: hits.filter(Boolean).length, of: hits.length });
  };

  const preds = s.predictions.filter((p) => p.resolved);

  put(
    el,
    h('header.fl-debrief-head', {}, h('h3', {}, t(fmt(bi('Разбор: «{t}»', 'Debrief: “{e}”'), { t: sc.title.ru, e: sc.title.en }))), h('button.btn.ghost.small', { type: 'button', onclick: o.back }, icon('prev'), t(bi('К доске', 'Back to the board')))),
    h('p.lede', {}, t(sc.goal)),
    h('section.fl-d-sec', {}, h('h4', {}, t(bi('1. Ваш прогон по шагам', '1. Your run step by step'))), stepper),
    h(
      'section.fl-d-sec',
      {},
      h('h4', {}, t(bi('2. Ваш результат и два эталона при одинаковых исходных условиях', '2. Your run and two references on the same seed'))),
      h('p.small.muted', {}, t(bi('«Без методологии» — без лимитов, первым пришёл — первым взят, всё срочное сразу в работу, без улучшений. «Эталон» — лимит «люди на этапе + 1», вытягивание по CD3, помощь узкому месту, улучшения сразу, частые выкладки. Кубики и события у всех трёх одни и те же.', '“Baseline”: no limits, first come first served, everything urgent straight into work, no improvements. “Reference”: a limit of people on the stage + 1, pull by CD3, help for the bottleneck, improvements at once, frequent deployments. All three get the same dice and events.'))),
      h(
        'table.fl-compare',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, t(bi('вы', 'you'))), h('th', {}, t(bi('без методологии', 'baseline'))), h('th', {}, t(bi('эталон', 'reference'))))),
        h(
          'tbody',
          {},
          ...rows.map((r) => {
            const v = me[r.key];
            const best = r.better === 'low' ? v <= Math.min(b.baseline[r.key], b.reference[r.key]) : v >= Math.max(b.baseline[r.key], b.reference[r.key]);
            return h('tr', {}, h('th', {}, t(r.label)), h('td', { class: best ? 'best' : '' }, r.fmt(v)), h('td', {}, r.fmt(b.baseline[r.key])), h('td', {}, r.fmt(b.reference[r.key])));
          }),
        ),
      ),
      h('p.fl-diff', {}, t(diffSentence())),
      h('div.fl-d-charts', {}, linesChart(bi('Готово у покупателей, накопительно', 'Delivered, cumulative'), deliveredSeries, sc.days), linesChart(bi('Потери, накопительно', 'Losses, cumulative'), lossSeries, sc.days, lang() === 'ru' ? bi('₽', '₽') : bi('$', '$'))),
    ),
    h(
      'section.fl-d-sec',
      {},
      h('h4', {}, t(bi('3. Решения, которые изменили больше всего', '3. The decisions that changed the most'))),
      h('p.small.muted', {}, t(bi('Ваш прогон переигран заново с одним изменённым решением; всё остальное — ваши же решения и те же кубики.', 'Your run was replayed with one decision changed; everything else is your own decisions and the same dice.'))),
      cf.length
        ? h(
            'ol.fl-cf',
            {},
            ...cf.map((c) =>
              h(
                'li',
                { class: c.score >= 0 ? 'better' : 'worse' },
                h('p.fl-cf-did', {}, h('span.fl-cf-day', {}, t(fmt(bi('день {d}', 'day {d}'), { d: c.day }))), ' ', t(c.did)),
                h('p', {}, t(c.effect)),
                h('p.small', {}, c.score >= 0 ? t(bi('Ваше решение оказалось лучше альтернативы.', 'Your decision turned out better than the alternative.')) : t(bi('Альтернатива дала бы лучший результат.', 'The alternative would have done better.')), c.why && THEORY[c.why] ? [' ', h('a', { href: `#/lesson/${THEORY[c.why].lesson}` }, t(THEORY[c.why].title))] : null),
              ),
            ),
          )
        : h('p', {}, t(bi('Ни одно отдельное решение не изменило итог заметно: результат сложился из многих мелких.', 'No single decision changed the result noticeably: it came from many small ones.'))),
    ),
    h(
      'section.fl-d-sec',
      {},
      h('h4', {}, t(bi('4. Объясните сами', '4. Explain it yourself'))),
      h('p', {}, t(sc.explain.prompt)),
      h('p.small.muted', {}, t(bi('Как на собеседовании: что это, зачем, как работает, когда применяете.', 'As in an interview: what it is, why, how it works, when you use it.'))),
      answer,
      h('button.btn', { type: 'button', onclick: check }, t(bi('Сравнить с эталоном', 'Compare with the model answer'))),
      result,
    ),
    preds.length
      ? h(
          'section.fl-d-sec',
          {},
          h('h4', {}, t(bi('5. Ваши предсказания', '5. Your predictions'))),
          h('p', {}, t(fmt(bi('Совпало с моделью: {a} из {n}. Это обратная связь о вашей картине системы, а не оценка.', 'Matched the model: {a} of {n}. This is feedback on your picture of the system, not a grade.'), { a: preds.filter((p) => p.choice === p.resolved).length, n: preds.length }))),
        )
      : null,
    h(
      'div.fl-d-actions',
      {},
      h('button.btn', { type: 'button', onclick: () => o.again(s.seed) }, icon('repeat'), t(bi('Повторить с теми же исходными условиями', 'Again with the same seed'))),
      h('button.btn', { type: 'button', onclick: () => o.again((s.seed * 7919 + 13) % 100000) }, t(bi('Начать с другими исходными условиями', 'With a new seed'))),
    ),
  );
  drawStep();
  return { dispose: () => el.remove() };
}
