// Interactive scheme for the correlation lesson: one summer in a resort town.
// Two dials set the strength of the visible link between ice cream sales and
// drownings and the share of that link driven by the hidden third factor
// (hot weather); the "same-heat comparison" break holds the third factor
// fixed, and the visible link collapses when it was spurious. The metric
// under the diagram always shows both numbers: what you see now and what
// would remain after comparing days with equal heat.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';

type P = { strength: number; confounder: number };

const card = (whatRu: string, whoRu: string, whatEn: string, whoEn: string) => ({
  what: bi(whatRu, whatEn),
  who: bi(whoRu, whoEn),
});

/** The visible link r of the last step (what the metric shows now). */
const finalR = (steps: Step[]): number => steps[steps.length - 1]?.metrics?.r as number;
/** The residual link that would remain after the within-groups comparison. */
const finalLeft = (steps: Step[]): number => steps[steps.length - 1]?.metrics?.left as number;

const residualOf = (p: P) => Math.round((Math.round(p.strength) * (100 - Math.round(p.confounder))) / 100);

export function correlationChange(observed: number, left: number): 'collapse' | 'partial' | 'stay' {
  const ratio = observed ? left / observed : 1;
  return ratio < .2 ? 'collapse' : ratio <= .9 ? 'partial' : 'stay';
}
const comparisonCaption = (observed: number, left: number): Bi => {
  const captions = {
    collapse: bi("Сравнение дней с одинаковой жарой убрало почти всю связь: показатель r упал с {observed} до {left}. В этой модели совместный рост мороженого и утоплений создавала жара, и без её влияния он почти исчез. Так выглядит ложная связь, которую ловят на сравнении внутри групп.", "Comparing days with equal heat removed almost all the association: r fell from {observed} to {left}. Heat generated almost all the joint change in this model."),
    partial: bi("Сравнение дней с одинаковой жарой уменьшило связь: показатель r упал с {observed} до {left}. Жара объясняла часть совместного роста, а оставшаяся часть ничем в модели не объяснена: это может быть другая общая причина, случайность или прямое влияние, и одно сравнение между ними не выбирает.", "Comparing days with equal heat reduced the association: r fell from {observed} to {left}. The remainder is unexplained: another common cause, chance or a direct effect are possible."),
    stay: bi("Сравнение дней с одинаковой жарой почти не изменило связь: показатель r остался около {left}. Жара эту связь не объясняет, но причину это ещё не доказывает: связь может создавать другой общий фактор, которого нет на схеме.", "Comparing days with equal heat barely changed the association: r remains near {left}. Heat does not explain it, but another common cause is still possible."),
  };
  return fmt(captions[correlationChange(observed, left)], { observed, left });
};

export const correlationModel = defineModel<P>({
  id: 'scithink.correlation',
  block: 'scithink',
  frame: 'visible',
  title: bi('Корреляция и скрытый третий фактор', 'Correlation and the hidden third factor'),
  summary: bi(
    'Схема показывает одно лето в курортном городе. Слева продажи мороженого, справа число утоплений, внизу — жара, третий фактор, который двигает обеими линиями. Двигайте ползунки и включите сравнение дней с одинаковой жарой, чтобы увидеть, что останется от видимой связи.',
    'The diagram shows one summer in a resort town. Ice cream sales on the left, drownings on the right, and at the bottom the heat — the third factor that drives both lines. Move the dials and switch on the same-heat comparison to see what remains of the visible link.',
  ),
  intro: bi(
    'Листайте шаги стрелками под схемой. В «Параметрах» два ползунка: сначала «Сила связи на виду», потом «Доля связи, которую объясняет жара». Под схемой всегда два числа: совместный рост, который видно сейчас, и остаток, который останется при сравнении дней с одинаковой жарой. После первого прохода включите это сравнение в «Поломках» и посмотрите, что стало с показателями. Карточки узлов и линий открываются щелчком.',
    'Step through with the arrows under the diagram. Under "Parameters" there are two dials: first the strength of the visible link, then the share of the link explained by heat. Under the diagram there are always two numbers: the joint rise visible now, and the remainder that survives comparing days with equal heat. After the first pass, switch that comparison on under "Breakages" and watch the metrics. Cards on nodes and lines open on click.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, о котором говорит шаг', 'the participant the step is about') },
    { mark: 'say', text: bi('что этот участник делает', 'what that participant does') },
    { mark: 'err', text: bi('связь, которая исчезает при сравнении внутри групп', 'the link that vanishes within groups') },
  ],
  stopLabel: bi('Сравнение остановило цепочку', 'The comparison stopped the chain'),
  concepts: ['scithink.correlation', 'scithink.confounder'],
  diagram: {
    width: 960,
    height: 430,
    nodes: [
      {
        id: 'ice', label: bi('Мороженое', 'Ice cream'), family: 'flow', x: 40, y: 80, w: 220, h: 80,
        sub: bi('продажи за лето', 'sales over the summer'),
        card: card(
          'Продажи мороженого в городе за лето. Линия продаж растёт и падает вместе с температурой: в жару мороженое покупают чаще. Узел стоит слева, потому что в заголовках новостей именно с него обычно начинают.',
          'Продажи считают кассы магазинов и киосков; городской отчёт обобщает их помесячно.',
          'Ice cream sales in the city over the summer. The sales line rises and falls with the temperature: heat makes people buy ice cream more often. The node stands on the left because news headlines usually start from it.',
          'Sales are counted by shop and kiosk tills; the city report aggregates them by month.',
        ),
      },
      {
        id: 'drown', label: bi('Утопления', 'Drowning deaths'), family: 'l7', x: 700, y: 80, w: 220, h: 80,
        sub: bi('случаи за лето', 'cases over the summer'),
        card: card(
          'Число несчастных случаев на воде в городе за лето. В жару люди чаще идут к воде, поэтому линия случаев тоже растёт вместе с температурой. Совместный рост с продажами мороженого — наблюдение, которое само по себе не объясняет, кто кого вызывает.',
          'Случаи регистрируют спасательные службы и больницы; городская статистика публикует их ежемесячно.',
          'The number of water accidents in the city over the summer. In hot weather people go to the water more often, so the case line also rises with the temperature. The joint rise with ice cream sales is an observation that by itself does not explain who causes whom.',
          'Cases are recorded by rescue services and hospitals; the city statistics publish them monthly.',
        ),
      },
      {
        id: 'heat', label: bi('Жара', 'Hot weather'), family: 'gauge', x: 370, y: 300, w: 220, h: 80,
        sub: bi('третий фактор', 'the third factor'),
        card: card(
          'Третий фактор, которого нет в заголовке: жаркая погода. Жара и поднимает продажи мороженого, и тянет людей к воде, поэтому обе линии растут вместе, хотя мороженое и утопления друг друга не вызывают. Пока жару не зафиксировать, её вклад не отличить от настоящей связи.',
          'Погоду измеряет метеослужба; в модели жара задана ползунком «Доля связи, которую объясняет жара».',
          'The third factor missing from the headline: hot weather. Heat lifts ice cream sales and draws people to the water at once, so both lines rise together even though ice cream and drownings do not cause each other. Until heat is held fixed, its contribution cannot be told apart from a real link.',
          'Weather is measured by the meteorological service; in this model heat is set by the "Share of the link explained by heat" dial.',
        ),
      },
    ],
    edges: [
      {
        id: 'e-link', from: 'ice', to: 'drown', label: bi('растут вместе', 'rise together'),
        card: card(
          'Видимая связь: когда растут продажи мороженого, растёт и число утоплений. Это совместное изменение двух величин, то есть корреляция; она фиксирует, что линии двигаются вместе, и не говорит, что одна толкает другую.',
          'Связь считается по городским данным за лето; её силу показывает показатель r под схемой.',
          'The visible link: when ice cream sales rise, so does the number of drownings. This is two quantities changing together — a correlation; it records that the lines move in step and says nothing about one pushing the other.',
          'The link is computed from the city’s summer data; the r metric under the diagram shows its strength.',
        ),
      },
      {
        id: 'e-heat-ice', from: 'heat', to: 'ice', via: [[480, 235], [150, 235]], labelAt: 0.5, label: bi('от жары растут продажи', 'heat lifts sales'),
        card: card(
          'Влияние жары на продажи: в тёплые дни мороженое покупают чаще. Эта линия — настоящая причина роста продаж, и она не исчезает ни при каком сравнении.',
          'Зависимость мороженого от погоды хорошо известна торговцам и видна в помесячных продажах.',
          'Heat’s influence on sales: people buy ice cream more often on warm days. This line is the real cause of the sales rise, and it survives any comparison.',
          'The dependence of ice cream on weather is well known to sellers and visible in monthly sales.',
        ),
      },
      {
        id: 'e-heat-drown', from: 'heat', to: 'drown', via: [[480, 235], [810, 235]], labelAt: 0.5, label: bi('жара тянет людей к воде', 'heat draws people to the water'),
        card: card(
          'Влияние жары на случаи на воде: в тёплые дни люди чаще купаются и чаще оказываются у воды, поэтому число несчастных случаев растёт. Как и вторая линия жары, эта связь остаётся при любом сравнении.',
          'Сезонность случаев на воде видна в спасательной статистике каждого года.',
          'Heat’s influence on water accidents: on warm days people swim and gather near water more often, so the number of accidents rises. Like the other heat line, this link remains under any comparison.',
          'The seasonality of water accidents is visible in rescue statistics every year.',
        ),
      },
    ],
  },
  params: [
    {
      id: 'strength', kind: 'range', min: 10, max: 90, step: 5, default: 60,
      label: bi('Сила связи на виду', 'Strength of the visible link'),
      unit: bi(' из 100', ' of 100'),
      near: 'e-link',
      group: bi('Связь на виду', 'The visible link'),
      predict: {
        prompt: bi('Вы меняете, насколько вместе растут продажи мороженого и число утоплений. Что покажет показатель r под схемой?', 'You change how closely ice cream sales and drownings rise together. What will the r metric under the diagram show?'),
        options: [
          { id: 'up', text: bi('r вырастет', 'r will rise') },
          { id: 'down', text: bi('r упадёт', 'r will fall') },
        ],
        resolve: (prev, next) => (finalR(next) > finalR(prev) ? 'up' : 'down'),
      },
    },
    {
      id: 'confounder', kind: 'range', min: 0, max: 100, step: 5, default: 70,
      label: bi('Доля связи, которую объясняет жара', 'Share of the link explained by heat'),
      unit: '%',
      near: 'heat',
      group: bi('Скрытый фактор', 'The hidden factor'),
      predict: {
        prompt: bi('Вы меняете, какая доля видимой связи объясняется жарой. Что покажет остаток при сравнении дней с одинаковой жарой?', 'You change the share of the visible link explained by heat. What will the remainder show after comparing days with equal heat?'),
        options: [
          { id: 'more', text: bi('Останется меньше', 'Less will remain') },
          { id: 'less', text: bi('Останется больше', 'More will remain') },
        ],
        resolve: (prev, next) => (finalLeft(next) < finalLeft(prev) ? 'more' : 'less'),
      },
    },
  ],
  breaks: [
    {
      id: 'within',
      label: bi('Сравнить дни с одинаковой жарой', 'Compare days with equal heat'),
      remove: [],
      predict: {
        prompt: bi('Что станет с показателем r, если сравнивать только дни с одинаковой жарой?', 'If you compare only days with equal heat, what happens to the r metric?'),
        options: [
          { id: 'collapse', text: bi("Связь почти исчезнет", "The association will nearly disappear") },
          { id: 'partial', text: bi("Связь заметно уменьшится, но останется", "The association will decrease but remain") },
          { id: 'stay', text: bi("Связь почти не изменится", "The association will barely change") },
        ],
        resolve: (_prev, next) => correlationChange(next[0].metrics!.r, finalLeft(next)),
      },
    },
  ],
  metrics: [
    { id: 'r', label: bi('Совместный рост, r (баллов из 100)', 'Joint rise, r (points out of 100)') },
    { id: 'left', label: bi('Остаток при сравнении внутри групп (баллов из 100)', 'Remainder within groups (points out of 100)') },
  ],
  run(p, broken) {
    const observed = Math.round(p.strength);
    const explained = Math.round(p.confounder);
    const left = residualOf(p);
    const isolated = broken.has('within');

    const steps: Step[] = [
      {
        id: 'data', label: bi('данные', 'data'),
        caption: fmt(
          bi(
            'Смотрим одно лето. Когда растут продажи мороженого, растёт и число утоплений, и их совместный рост оценивается в {r} баллов из 100. На глаз это выглядит как настоящая зависимость одного от другого.',
            'We look at one summer. When ice cream sales rise, the number of drownings rises too, and their joint rise is rated {r} points out of 100. To the eye it looks like a real dependence of one on the other.',
          ),
          { r: observed },
        ),
        focus: ['ice', 'drown', 'e-link'],
        metrics: { r: observed, left },
      },
      {
        id: 'data-voice', label: bi('данные', 'data'),
        focus: ['ice'],
        caption: bi('Мои продажи растут, и рядом растёт число случаев на воде. Красиво выходит, что я виноват.', 'My sales rise, and next to me the number of water accidents rises. It makes a neat picture with me as the culprit.'),
        metrics: { r: observed, left },
      },
      {
        id: 'factor', label: bi('третий фактор', 'third factor'),
        caption: bi(
          'Третьим участником оказывается жара. От неё растут продажи мороженого, и она тянет людей к воде, поэтому обе линии растут вместе с температурой, а прямая связь между мороженым и утоплениями может отсутствовать вовсе. Этот участник редко попадает в заголовки.',
          'The third participant turns out to be the heat. Sales of ice cream rise from it, and it draws people to the water, so both lines rise with the temperature, while the direct link between ice cream and drownings may be missing entirely. This participant rarely makes it into headlines.',
        ),
        focus: ['heat', 'e-heat-ice', 'e-heat-drown'],
        metrics: { r: observed, left },
      },
      {
        id: 'factor-voice', label: bi('третий фактор', 'third factor'),
        focus: ['heat'],
        caption: bi('Это я двигаю обеих, и покупателей к мороженому, и людей к воде. Этот совместный рост делаю я.', 'I am the one moving both, the buyers to the ice cream and the people to the water. I make this joint rise happen.'),
        metrics: { r: observed, left },
      },
    ];
    if (!isolated) {
      steps.push({
        id: 'verdict', label: bi('вывод', 'verdict'),
        caption: fmt(
          bi(
            'Видимая связь — {r} баллов из 100, и жара объясняет {share}% этой динамики. Если сравнивать дни с одинаковой жарой, совместный рост опустится до {left} баллов из 100. Совместный рост — наблюдение, а не механизм: он сам по себе не говорит, что мороженое влияет на случаи на воде.',
            'The visible link is {r} points out of 100, and heat explains {share}% of that dynamics. Comparing days with equal heat drops the joint rise to {left} points out of 100. A joint rise is an observation, not a mechanism: by itself it does not say that ice cream affects water accidents.',
          ),
          { r: observed, share: explained, left },
        ),
        focus: ['e-link', 'heat'],
        metrics: { r: observed, left },
      });
      return steps;
    }
    const caption = comparisonCaption(observed, left);
    steps.push({
      id: 'within', label: bi('внутри групп', 'within groups'),
      caption, focus: ['e-link', 'heat'], metrics: { r: left, left },
      ...(correlationChange(observed, left) === 'collapse' ? {
        broken: { at: 'e-link', message: `r ${observed} → ${left}`, caption },
      } : {}),
    });
    return steps;
  },
  explainDelta(prev, next, change, _prevParams, nextParams): Bi {
    const a = finalR(prev);
    const b = finalR(next);
    if (change.kind === 'break') {
      return change.on
        ? fmt(bi('Сравнение внутри одинаковой жары убрало влияние третьего фактора: совместный рост изменился с {a} до {b} баллов из 100.', 'The within-groups comparison removed the third factor’s influence: the joint rise changed from {a} to {b} points out of 100.'), { a, b })
        : fmt(bi('Прямая связь вернулась на уровень всего лета целиком: совместный рост снова {b} баллов из 100.', 'The direct link returned to the level of the whole summer: the joint rise is {b} points out of 100 again.'), { a, b });
    }
    if (change.id === 'strength') {
      return fmt(bi('Сила видимой связи изменилась, и совместный рост стал {b} вместо {a} баллов из 100.', 'The strength of the visible link changed, and the joint rise is now {b} instead of {a} points out of 100.'), { a, b });
    }
    const p = nextParams;
    return fmt(bi('Доля связи, которую объясняет жара, теперь {share}%, поэтому при сравнении внутри одинаковой жары останется {left} баллов из 100.', 'The share of the link explained by heat is now {share}%, so within-groups comparison leaves {left} points out of 100.'), {
      share: Math.round(p.confounder),
      left: residualOf(p),
    });
  },
});

// Reuse authored labels/cards; a phone needs a readable overview of all three nodes.
correlationModel.diagram.narrow = {
  width: 340, height: 520,
  nodes: correlationModel.diagram.nodes.map(n => ({ ...n, x: 60, y: ({ heat: 20, ice: 210, drown: 400 } as Record<string, number>)[n.id] })),
  edgeVia: { 'e-link': [], 'e-heat-ice': [], 'e-heat-drown': [[25, 60], [25, 440]] },
};
