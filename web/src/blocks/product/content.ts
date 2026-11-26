// Lessons of the hidden "Продукт" pilot: how B2B and open-source products are
// built, from category and go-to-market to pricing and company case studies.
// Russian is the source text; every bi() carries a faithful English
// translation. The thinking tasks of the source program (principles.ts) are
// adapted into the quiz bank below. Claude owns the prose per web/STYLE-RU.md.

import { bi } from '../../core/i18n';
import type { Concept, Lesson, QuizItem, Sources } from '../../core/types';
import { PRODUCT_PROGRAM } from './principles';

/** The honest note every lesson of this course carries: one way, not a law. */
export const PRODUCT_HONEST_NOTE = bi(
  'Это один из способов работать; законом и единственно верным решением он не служит. Жизнь сложнее любой схемы: многое зависит от контекста — продукта, рынка, людей и момента. Берите то, что применимо к вашей ситуации, и проверяйте на практике.',
  'This is one way of working, not a law and not an optimal solution. Life is more complex than any framework: much depends on context — the product, the market, the people and the moment. Take what applies to your situation and test it in practice.',
);

// ── Sources (every URL checked to resolve; titles in the source's language) ──

interface Src { title: [string, string]; url: string }
const SRC = {
  dunford: { title: ['Эйприл Данфорд, Obviously Awesome: метод позиционирования', 'April Dunford — Obviously Awesome (positioning)'], url: 'https://www.aprildunford.com/' },
  playbigger: { title: ['Play Bigger: проектирование категорий', 'Play Bigger — category design'], url: 'https://www.playbigger.com/' },
  hbrJtbd: { title: ['HBR: теория задач, на которые нанимают продукт', 'HBR — Know Your Customers’ Jobs to Be Done'], url: 'https://hbr.org/2016/09/know-your-customers-jobs-to-be-done' },
  strategyn: { title: ['Strategyn: теория задач и метод ODI, Энтони Алвик', 'Strategyn — Jobs-to-be-Done and ODI (Tony Ulwick)'], url: 'https://strategyn.com/' },
  reforge: { title: ['Reforge: программы для продуктовых команд', 'Reforge — programs for product teams'], url: 'https://www.reforge.com/' },
  openview: { title: ['OpenView: бенчмарки product-led growth, 2023', 'OpenView — 2023 Product Benchmarks'], url: 'https://openviewpartners.com/2023-product-benchmarks/' },
  highalpha: { title: ['SaaS Benchmarks 2024: NRR и рост (High Alpha, бывший OpenView)', '2024 SaaS Benchmarks — High Alpha (ex-OpenView)'], url: 'https://highalpha.com/saas-benchmarks/2024' },
  moore: { title: ['Джеффри Мур, «Пересечение пропасти»', 'Geoffrey A. Moore — Crossing the Chasm, 3rd ed.'], url: 'https://www.harpercollins.com/products/crossing-the-chasm-3rd-edition-geoffrey-a-moore' },
  torres: { title: ['Тереза Торрес, «Непрерывное открытие продуктов»', 'Teresa Torres — Continuous Discovery Habits'], url: 'https://www.producttalk.org/2021/05/continuous-discovery-habits/' },
  rice: { title: ['Intercom: метод приоритизации RICE', 'Intercom — RICE, simple prioritization for product managers'], url: 'https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/' },
  momtest: { title: ['Роб Фитцпатрик, «Мамин тест»', 'Rob Fitzpatrick — The Mom Test'], url: 'https://momtestbook.com/' },
  a16z: { title: ['a16z: от сообщества к коммерциализации открытого кода', 'a16z — Open Source: From Community to Commercialization'], url: 'https://a16z.com/open-source-from-community-to-commercialization/' },
  cncf: { title: ['CNCF: нейтральный дом для облачных проектов', 'CNCF — the neutral home for cloud-native projects'], url: 'https://www.cncf.io/' },
  gitlab: { title: ['Хендбук GitLab: компания работает на виду', 'The GitLab Handbook'], url: 'https://handbook.gitlab.com/' },
  diataxis: { title: ['Diátaxis: система технической документации', 'Diátaxis — a systematic approach to documentation'], url: 'https://diataxis.fr/' },
  stripe: { title: ['Документация Stripe как эталон быстрого старта', 'Stripe documentation — a quickstart reference'], url: 'https://docs.stripe.com/' },
} satisfies Record<string, Src>;

const sources = (...items: Src[]): Sources => ({
  en: items.map((i) => ({ title: i.title[1], url: i.url })),
  ru: items.map((i) => ({ title: i.title[0], url: i.url })),
});

// ── Lesson specs ────────────────────────────────────────────────────────────

interface LessonSpec {
  id: string;
  minutes: number;
  title: [string, string];
  summary: [string, string];
  hook: [string, string];
  principles: number[];
  introduces: string[];
  uses: string[];
  quiz: string[];
  src: Src[];
}

const LESSON_SPECS: LessonSpec[] = [
  {
    id: 'product.category',
    minutes: 14,
    title: ['Категория и клин', 'Category and the wedge'],
    summary: [
      'Почему категория важнее продукта, какие задачи решает инфраструктурный покупатель и как узкий клин превращается в платформу.',
      'Why the category beats the product, which jobs the infrastructure buyer hires for, and how a narrow wedge grows into a platform.',
    ],
    hook: [
      'Вы приходите на встречу с идеальным продуктом, а клиент спрашивает, чем вы отличаетесь от того, что у него уже стоит. Ответ на этот вопрос решается не на встрече, а за месяцы до неё — в решении о том, в какой категории вас сравнивают. Первый урок курса начинается с этого решения.',
      'You arrive at a meeting with a perfect product, and the client asks how you differ from what they already run. That question is settled not in the meeting but months before it, in the decision about the category you are compared in. The first lesson of the course starts with that decision.',
    ],
    principles: [1, 2, 3],
    introduces: ['product.category', 'product.jtbd', 'product.wedge'],
    uses: [],
    quiz: ['product.q.category-frame', 'product.q.jtbd-door'],
    src: [SRC.dunford, SRC.playbigger, SRC.hbrJtbd, SRC.strategyn],
  },
  {
    id: 'product.gtm',
    minutes: 12,
    title: ['Три двигателя роста', 'Three growth engines'],
    summary: [
      'Три способа привлекать покупателей: через продукт, через продажи и через сообщество; гибрид, в котором открытый код приводит пользователя, а сделку доводит продавец; и два рассказа о продукте: для инженера и для подписанта бюджета.',
      'Product-led, sales-led and community-led motions, the open-source-led with sales-assist hybrid, and the two narratives: bottom-up and top-down.',
    ],
    hook: [
      'У вас отличный продукт, который никто не покупает, а у соседей посредственный продукт с очередью из клиентов. Разница чаще всего не в продукте, а в том, как он доходит до покупателя и кто открывает первую дверь.',
      'Your excellent product sells to no one while a mediocre competitor has a queue of customers. The difference is usually not the product but how it reaches the buyer and who opens the first door.',
    ],
    principles: [4, 7],
    introduces: ['product.plg', 'product.sales-assist'],
    uses: [],
    quiz: ['product.q.engine-assist', 'product.q.engine-hybrid'],
    src: [SRC.reforge, SRC.openview],
  },
  {
    id: 'product.opencore',
    minutes: 14,
    title: ['Граница open-core и расширение', 'The open-core boundary and expansion'],
    summary: [
      'Что отдавать бесплатно и за что платят, как заходить маленькой сделкой и расти внутри клиента, и какую роль играет NRR.',
      'What to give away free and what companies pay for, how to land with a small deal and grow inside the account, and the role of NRR.',
    ],
    hook: [
      'Сообщество требует открыть больше, акционеры требуют продавать больше, и обе стороны правы. Между этими требованиями проходит граница open-core, и этот урок про то, как её провести и не двигать резко.',
      'The community demands more openness, the shareholders demand more sales, and both are right. The open-core boundary runs between these demands, and this lesson is about drawing it and not moving it abruptly.',
    ],
    principles: [5, 6],
    introduces: ['product.open-core', 'product.nrr'],
    uses: ['product.plg'],
    quiz: ['product.q.boundary-free', 'product.q.nrr'],
    src: [SRC.a16z, SRC.highalpha, SRC.gitlab],
  },
  {
    id: 'product.chasm',
    minutes: 14,
    title: ['Волна, плацдарм и пропасть', 'The wave, the beachhead and the chasm'],
    summary: [
      'Как ловить рыночные волны, брать один плацдарм вместо всего рынка, противостоять гиперскейлеру и переходить пропасть Мура.',
      'How to ride market waves, take one beachhead instead of the whole market, stand against a hyperscaler, and cross Moore’s chasm.',
    ],
    hook: [
      'Продукт обожают энтузиасты, статьи хвалят, звёзды набираются, а продажи стоят на месте. Значит, рынок упёрся в пропасть между любителями нового и осторожным большинством, и переход её требует отдельной кампании.',
      'Enthusiasts love the product, articles praise it, stars accumulate, and sales are flat. That means the market has hit the chasm between lovers of the new and the cautious majority, and crossing it takes a separate campaign.',
    ],
    principles: [8, 9, 10, 11],
    introduces: ['product.beachhead', 'product.chasm'],
    uses: ['product.wedge'],
    quiz: ['product.q.chasm-gap', 'product.q.wave'],
    src: [SRC.moore, SRC.dunford],
  },
  {
    id: 'product.first-minutes',
    minutes: 10,
    title: ['Первые минуты с продуктом', 'The first minutes with the product'],
    summary: [
      'Время до первой ценности и знакомство с продуктом как воронка, где чинят самое узкое звено.',
      'Time to value and onboarding as a funnel where the narrowest step gets fixed first.',
    ],
    hook: [
      'Пользователь скачал продукт в пятницу вечером и дал ему до конца фильма. Если первого результата нет за эти минуты, продукт удалят, и никакие великие возможности не помогут.',
      'The user downloaded the product on a Friday evening and gave it until the end of the movie. If there is no first result within those minutes, the product gets deleted, and no great capabilities will help.',
    ],
    principles: [12, 14],
    introduces: ['product.ttv'],
    uses: [],
    quiz: ['product.q.ttv-competitor', 'product.q.funnel-narrow'],
    src: [SRC.openview, SRC.reforge],
  },
  {
    id: 'product.interfaces',
    minutes: 10,
    title: ['Документация и интерфейсы', 'Documentation and interfaces'],
    summary: [
      'Почему документация — это продукт и почему API с командной строкой для инженера важнее экрана.',
      'Why documentation is the product, and why the API and the CLI matter more to an engineer than any screen.',
    ],
    hook: [
      'В три часа ночи инженер ищет ответ в вашей документации и разговаривает с продуктом через командную строку. Для него это и есть лицо компании: этот урок про документацию и интерфейсы как часть продукта.',
      'At three in the morning an engineer searches your documentation and talks to the product through the command line. To them that is the face of the company: this lesson is about documentation and interfaces as part of the product.',
    ],
    principles: [13, 15],
    introduces: [],
    uses: ['product.ttv'],
    quiz: ['product.q.docs-page', 'product.q.api-first'],
    src: [SRC.diataxis, SRC.stripe],
  },
  {
    id: 'product.discovery',
    minutes: 12,
    title: ['Непрерывное открытие продукта', 'Continuous product discovery'],
    summary: [
      'Практика еженедельного контакта с пользователями вместо плановой фазы исследований и дерево возможностей и решений Терезы Торрес.',
      'A weekly contact with users instead of a scheduled research phase, and Teresa Torres’s opportunity-solution tree.',
    ],
    hook: [
      'Дорожная карта на год составлена, а через квартал выясняется, что половина пунктов никому не нужна. Этот урок про то, как держать продукт в контакте с реальностью каждую неделю, без ожидания следующего планового периода.',
      'The year-long roadmap is written, and a quarter later half of its items turn out to be needed by no one. This lesson is about keeping the product in touch with reality every week, not once per planning cycle.',
    ],
    principles: [16, 17],
    introduces: ['product.ost'],
    uses: ['product.jtbd'],
    quiz: ['product.q.ost-order', 'product.q.solution-love'],
    src: [SRC.torres],
  },
  {
    id: 'product.priorities',
    minutes: 14,
    title: ['Приоритеты и проверка собственной продукцией', 'Priorities and dogfooding'],
    summary: [
      'Приоритизация RICE, дорожная карта как список того, чего не делаем, отличие сигнала от шума и разговоры по «Маминому тесту».',
      'RICE prioritization, the roadmap as a list of what we do not do, telling signal from noise, and conversations by The Mom Test.',
    ],
    hook: [
      'Запросов больше, чем людей, в десять раз, и каждый кажется срочным. Этот урок про то, как выбирать, что делать, без самообмана и как отличать сигнал от шума. Как отказать конкретному клиенту и продажам, не разрушая отношений, разобрано в уроке «Сигналы сообщества как источник открытия продукта», в разделе «Как отказать клиенту и продажам».',
      'There are ten times more requests than people, and every one feels urgent. This lesson is about choosing honestly what to do and telling signal from noise. How to turn down a specific customer and the sales team without wrecking relationships is covered in the lesson “Community signals as a source of product discovery”, in the section “Saying no to a customer and sales”.',
    ],
    principles: [18, 19, 20],
    introduces: ['product.rice'],
    uses: ['product.ost'],
    quiz: ['product.q.rice-math', 'product.q.signal', 'product.q.mom-test'],
    src: [SRC.rice, SRC.momtest],
  },
  {
    id: 'product.oss',
    minutes: 14,
    title: ['Стратегия открытого кода', 'Open-source strategy'],
    summary: [
      'Петля «сообщество — продукт», монетизация без предательства, управление проектом как актив и дефолт экосистемы.',
      'The community-product loop, monetization without betrayal, governance as an asset, and the ecosystem default.',
    ],
    hook: [
      'Открытый код приносит пользователей, но не приносит денег сам по себе. Этот урок про то, как строить бизнес вокруг открытого проекта, не сжигая сообщество, которое этот проект создало.',
      'Open source brings users but brings no money by itself. This lesson is about building a business around an open project without burning the community that created it.',
    ],
    principles: [21, 22, 23, 24],
    introduces: ['product.governance'],
    uses: ['product.open-core', 'product.plg'],
    quiz: ['product.q.governance-why', 'product.q.default'],
    src: [SRC.a16z, SRC.cncf],
  },
  {
    id: 'product.pricing',
    minutes: 12,
    title: ['Цена: метрика ценности и упаковка', 'Pricing: the value metric and packaging'],
    summary: [
      'Как привязать цену к выгоде клиента и как собрать тарифы, которые продают сами.',
      'How to tie the price to the customer’s benefit and how to assemble tiers that sell themselves.',
    ],
    hook: [
      'Два продукта с одинаковыми возможностями зарабатывают в десять раз разное, и разница — в метрике ценности и упаковке. Этот урок про то, как привязать цену к выгоде клиента.',
      'Two products with identical capabilities earn ten times different amounts, and the difference is the value metric and packaging. This lesson is about tying the price to the customer’s benefit.',
    ],
    principles: [25, 26],
    introduces: ['product.value-metric'],
    uses: ['product.nrr'],
    quiz: ['product.q.metric-monitor', 'product.q.tiers-blur'],
    src: [SRC.reforge, SRC.highalpha],
  },
];

function principlesBody(ns: number[]): [string, string] {
  const ru: string[] = [];
  const en: string[] = [];
  // Principles are numbered inside the lesson, so a lesson never shows gaps.
  let i = 0;
  for (const mod of PRODUCT_PROGRAM) {
    for (const p of mod.principles) {
      if (!ns.includes(p.n)) continue;
      i++;
      ru.push(`**${i}. ${p.title[0]}.** ${p.body.join('\n\n')}`);
      en.push(`**${i}. ${p.title[1]}.** ${p.bodyEn.join('\n\n')}`);
    }
  }
  return [ru.join('\n\n'), en.join('\n\n')];
}

function lessonFor(spec: LessonSpec): Lesson {
  const [bodyRu, bodyEn] = principlesBody(spec.principles);
  return {
    id: spec.id,
    block: 'product',
    title: bi(spec.title[0], spec.title[1]),
    summary: bi(spec.summary[0], spec.summary[1]),
    introduces: spec.introduces,
    uses: spec.uses,
    tier: 'core',
    minutes: spec.minutes,
    sources: sources(...spec.src),
    sections: [
      { id: 'hook', kind: 'text', step: 'hook', body: bi(spec.hook[0], spec.hook[1]) },
      { id: 'principles', kind: 'text', step: 'explain', title: bi('Принципы работы', 'Working principles'), body: bi(bodyRu, bodyEn) },
      { id: 'practice', kind: 'text', step: 'practice', title: bi('Задания по темам модуля', 'Module practice'), body: bi(...([0, 1] as const).map(lang => PRODUCT_PROGRAM.flatMap(m => m.principles).filter(p => spec.principles.includes(p.n)).map(p => `- ${p.task[lang]}`).join('\n')) as [string, string]) },
      ...(spec.quiz.length
        ? [{ id: 'quiz', kind: 'quiz' as const, step: 'practice' as const, title: bi('Проверьте себя', 'Check yourself'), items: spec.quiz }]
        : []),
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: PRODUCT_HONEST_NOTE },
    ],
  };
}

export const PRODUCT_LESSONS: Lesson[] = LESSON_SPECS.map(lessonFor);

// ── Concepts ────────────────────────────────────────────────────────────────

export const PRODUCT_CONCEPTS: Concept[] = [
  {
    id: 'product.category',
    term: bi('категория', 'category'),
    short: bi('Рамка, в которой покупатель сравнивает вас с двумя-тремя знакомыми альтернативами; её решают до списка возможностей.', 'The frame in which the buyer compares you with two or three familiar alternatives; it is decided before any feature list.'),
    introducedIn: 'product.category',
    scan: false,
  },
  {
    id: 'product.jtbd',
    term: bi('задача, на которую нанимают продукт', 'the job the product is hired for'),
    short: bi('Задача покупателя, которую он решает продуктом: снять риск, сократить время, перестать зависеть от эксперта.', 'The buyer’s job the product is brought in to do: remove a risk, save time, stop depending on one expert.'),
    introducedIn: 'product.category',
    scan: false,
  },
  {
    id: 'product.wedge',
    term: bi('клин', 'the wedge'),
    short: bi('Узкая задача, где продукт незаменим и через которую он входит в компанию клиента.', 'The narrow job where the product is irreplaceable and through which it enters the customer’s company.'),
    introducedIn: 'product.category',
    scan: false,
  },
  {
    id: 'product.plg',
    term: bi('рост через продукт (PLG)', 'product-led growth (PLG)'),
    short: bi('Движение, при котором продукт сам приводит пользователей: пробуют без продавца и платят без звонка.', 'The motion where the product brings users itself: they try it without a seller and pay without a call.'),
    introducedIn: 'product.gtm',
    scan: false,
  },
  {
    id: 'product.sales-assist',
    term: bi('sales-assist', 'sales-assist'),
    short: bi('Человек, который доводит крупную сделку внутри компании после того, как продукт привёл пользователя.', 'The human who closes the large deal inside a company after the product brought the user in.'),
    introducedIn: 'product.gtm',
    scan: false,
  },
  {
    id: 'product.open-core',
    term: bi('open-core', 'open-core'),
    short: bi('Модель с открытым ядром и платными возможностями для компаний вроде безопасности, масштаба и поддержки.', 'A model with an open core and paid company-facing features such as security, scale and support.'),
    introducedIn: 'product.opencore',
    scan: false,
  },
  {
    id: 'product.nrr',
    term: bi('чистое удержание выручки (NRR)', 'net revenue retention (NRR)'),
    short: bi('Доля выручки от существующих клиентов в этом году по сравнению с прошлым; выше 100% значит рост внутри клиентов.', 'The share of revenue from existing customers this year compared with last; above 100% means growth inside the base.'),
    introducedIn: 'product.opencore',
    scan: false,
  },
  {
    id: 'product.beachhead',
    term: bi('плацдарм', 'beachhead'),
    short: bi('Один узкий сегмент, который берут целиком и где становятся эталоном перед расширением в соседние.', 'One narrow segment taken whole, where you become the reference before expanding to adjacent ones.'),
    introducedIn: 'product.chasm',
    scan: false,
  },
  {
    id: 'product.chasm',
    term: bi('пропасть', 'the chasm'),
    short: bi('Разрыв между ранними последователями и прагматиками, которые покупают только по чужому примеру.', 'The gap between early adopters and pragmatists, who buy only on someone else’s example.'),
    introducedIn: 'product.chasm',
    scan: false,
  },
  {
    id: 'product.ttv',
    term: bi('время до первой ценности', 'time to value'),
    short: bi('Время от первого запуска до первого результата, за которое пользователь решает, остаться ли с продуктом.', 'The time from first launch to first result, within which the user decides whether to stay with the product.'),
    introducedIn: 'product.first-minutes',
    scan: false,
  },
  {
    id: 'product.ost',
    term: bi('дерево возможностей и решений', 'the opportunity-solution tree'),
    short: bi('Карта от исхода к возможностям, от возможностей к решениям и от решений к экспериментам.', 'A map from outcome to opportunities, from opportunities to solutions, and from solutions to experiments.'),
    introducedIn: 'product.discovery',
    scan: false,
  },
  {
    id: 'product.rice',
    term: bi('RICE', 'RICE'),
    short: bi('Оценка идей четырьмя числами — охват, влияние, уверенность и трудоёмкость; деление показывает цену выбора.', 'Scoring ideas with four numbers — reach, impact, confidence and effort; the division shows the price of the choice.'),
    introducedIn: 'product.priorities',
    scan: false,
  },
  {
    id: 'product.governance',
    term: bi('управление проектом', 'governance'),
    short: bi('Правила владения проектом — кто принимает решения и кому принадлежат марка с репозиторием.', 'The rules of project ownership: who makes decisions and who owns the brand and the repository.'),
    introducedIn: 'product.oss',
    scan: false,
  },
  {
    id: 'product.value-metric',
    term: bi('метрика ценности', 'the value metric'),
    short: bi('Единица, за которую платят клиенты и которая растёт вместе с их успехом: узел, пользователь, гигабайт, запрос.', 'The unit customers pay for that grows with their success: a node, a user, a gigabyte, a request.'),
    introducedIn: 'product.pricing',
    scan: false,
  },
];

// ── Quiz bank: the thinking tasks of the program adapted to platform items ──

export const PRODUCT_QUIZ: QuizItem[] = [
  {
    id: 'product.q.category-frame',
    kind: 'mcq',
    concepts: ['product.category'],
    refs: { lesson: 'product.category' },
    prompt: bi(
      'Ваш продукт решает задачу иначе всех на рынке. С чем покупатель будет сравнивать его, когда ему предложат выбрать?',
      'Your product solves the job differently from everyone on the market. What will the buyer compare it with when asked to choose?',
    ),
    options: [
      { id: 'frame', text: bi('С двумя-тремя решениями, которые он уже знает и считает похожими', 'With the two or three solutions they already know and consider similar'), correct: true, why: bi('Категория задаёт рамку сравнения, и в неё всегда помещаются знакомые альтернативы, включая вариант «не менять ничего».', 'The category sets the comparison frame, and it always holds familiar alternatives, including “change nothing”.') },
      { id: 'matrix', text: bi('Со всеми продуктами рынка по полному списку возможностей', 'With every product on the market across the full feature list'), why: bi('Сравнение идёт с узким кругом знакомых альтернатив, и полный список возможностей эту рамку не задаёт.', 'The comparison runs against a narrow circle of familiar alternatives, and a full feature list does not set that frame.') },
      { id: 'nothing', text: bi('Ни с чем, потому что у новой категории нет альтернатив', 'With nothing, because a new category has no alternatives'), why: bi('Даже новая категория сражается со старым способом работы, и «не буду ничего менять» — тоже альтернатива.', 'Even a new category fights the old way of working, and “I won’t change anything” is an alternative too.') },
    ],
  },
  {
    id: 'product.q.jtbd-door',
    kind: 'mcq',
    concepts: ['product.jtbd'],
    refs: { lesson: 'product.category' },
    prompt: bi(
      'Какой разговор обычно открывает дверь к сделке с инфраструктурным покупателем?',
      'Which conversation usually opens the door to a deal with an infrastructure buyer?',
    ),
    options: [
      { id: 'job', text: bi('Разговор о его задаче и о том, сколько времени и денег она ему стоит', 'A conversation about their job and the risk, time and money it takes away'), correct: true, why: bi('Покупатель узнаёт и признаёт свою задачу, а разговор о возможностях сравнивает вас с каталогом конкурентов.', 'The buyer recognises and owns their job, while a features conversation compares you with a catalogue of competitors.') },
      { id: 'features', text: bi('Разговор о возможностях продукта и плане его развития на год вперёд', 'A conversation about the product’s features and roadmap'), why: bi('Возможности оценивают все подряд, и такой разговор превращает встречу в сравнение списков.', 'Everyone evaluates features, so this conversation turns the meeting into a comparison of lists.') },
      { id: 'stack', text: bi('Разговор о технологиях, на которых построен продукт, и об их надёжности', 'A conversation about the technologies behind the product'), why: bi('Технологии волнуют вашу команду, а покупателя волнует задача и последствия для его компании.', 'Technologies concern your team; the buyer cares about the job and the consequences for their company.') },
    ],
  },
  {
    id: 'product.q.engine-assist',
    kind: 'mcq',
    concepts: ['product.plg', 'product.sales-assist'],
    refs: { lesson: 'product.gtm' },
    prompt: bi(
      'Инженер скачал продукт без звонка продавцу, команда пользуется им месяц, и тут приходит запрос на закупку от компании. Как называется такой путь от знакомства до сделки?',
      'An engineer downloaded the product with no call to a seller, the team has used it for a month, and then a procurement request arrives from the company. What is this path from first contact to deal called?',
    ),
    options: [
      { id: 'plg-assist', text: bi('Рост через продукт с помощью продавца, когда продукт приводит пользователя, а сделку доводит человек', 'Product-led growth with sales-assist: the product brings the user, a human closes the deal'), correct: true, why: bi('Первую дверь открыл продукт без продавца, а крупную сделку закрыл уже человек, и это ровно гибрид из урока.', 'The product opened the first door with no seller, and a human closed the large deal — exactly the hybrid from the lesson.') },
      { id: 'sales-led', text: bi('Продажи через продавцов, потому что сделку в итоге закрыл продавец и договор подписан через него', 'Sales-led, because a seller closed the deal in the end'), why: bi('Продавец доводил сделку, но не открывал её: двигатель определяет тот, кто приводит пользователя первым.', 'The seller advanced the deal but did not open it: the engine is defined by whoever brings the user first.') },
      { id: 'community', text: bi('Рост через сообщество, потому что продукт открытый и пользователи пришли из сообщества', 'Community-led, because the product is open source'), why: bi('Открытый код сам по себе не делает движение community-led: здесь продукт привёл пользователя напрямую.', 'Open source alone does not make a motion community-led: here the product brought the user directly.') },
    ],
  },
  {
    id: 'product.q.engine-hybrid',
    kind: 'multi',
    concepts: ['product.plg'],
    refs: { lesson: 'product.gtm' },
    prompt: bi(
      'Что из перечисленного верно для движения open-source-led со sales-assist?',
      'Which of the following is true for the open-source-led with sales-assist motion?',
    ),
    options: [
      { id: 'free-try', text: bi('Инженер пробует продукт бесплатно и без продавца', 'The engineer tries the product for free and without a seller'), correct: true },
      { id: 'human-close', text: bi('Крупную сделку внутри компании доводит человек', 'A human closes the large deal inside the company'), correct: true },
      { id: 'seller-first', text: bi('Первую дверь открывает продавец холодным письмом', 'A seller opens the first door with a cold email'), why: bi('Первую дверь в этом движении открывает продукт или сообщество, а продавец подключается позже.', 'In this motion the first door is opened by the product or the community, and the seller joins later.') },
      { id: 'fixed-price', text: bi('Цена фиксирована и переговоров не бывает', 'The price is fixed and there are no negotiations'), why: bi('Крупные сделки почти всегда идут с обсуждением условий, и это нормальная часть движения со sales-assist.', 'Large deals almost always involve negotiating terms, which is a normal part of the sales-assist motion.') },
    ],
  },
  {
    id: 'product.q.boundary-free',
    kind: 'mcq',
    concepts: ['product.open-core'],
    refs: { lesson: 'product.opencore' },
    prompt: bi(
      'Что стоит отдавать бесплатно, чтобы модель open-core не развалилась?',
      'What is worth giving away free so that the open-core model does not collapse?',
    ),
    options: [
      { id: 'whole-small', text: bi('Целое решение одной задачи для маленькой команды', 'A complete solution to one job for a small team'), correct: true, why: bi('Маленькие команды распространяют продукт и рассказывают о нём, а компании платят за другой набор вещей.', 'Small teams spread the product and talk about it, while companies pay for a different set of things.') },
      { id: 'greedy', text: bi('Самые ценные возможности, чтобы платная версия продавалась дороже', 'The most valuable features, so the paid version sells dearer'), why: bi('Жадная граница провоцирует форк и сжигает доверие сообщества, на котором держится вся модель.', 'A greedy boundary provokes a fork and burns the community trust the whole model rests on.') },
      { id: 'trial', text: bi('Демо-версию с ограничением по времени пользования', 'A demo limited by time of use'), why: bi('Лимит по времени не даёт продукту войти в привычку, а привычка и есть канал распространения.', 'A time limit keeps the product from becoming a habit, and habit is the distribution channel.') },
    ],
  },
  {
    id: 'product.q.nrr',
    kind: 'mcq',
    concepts: ['product.nrr'],
    refs: { lesson: 'product.opencore' },
    prompt: bi(
      'Клиент начал с одной команды и пяти процентов бюджета, а через год продуктом пользуется сорок процентов отдела. Какая метрика описывает такой рост?',
      'A client started with one team and five percent of the budget, and a year later forty percent of the department uses the product. Which metric describes this growth?',
    ),
    options: [
      { id: 'nrr', text: bi('Чистое удержание выручки, потому что выручка выросла внутри клиента', 'Net revenue retention, because revenue grew inside an existing customer'), correct: true, why: bi('Чистое удержание выше ста процентов означает, что клиенты платят больше, чем год назад, и компания растёт без новых сделок.', 'Net retention above one hundred percent means customers pay more than a year ago, and the company grows without new deals.') },
      { id: 'cac', text: bi('Стоимость привлечения клиента, потому что клиент вырос сам по себе', 'Customer acquisition cost, because the customer grew on their own'), why: bi('Эта сделка ничего не привлекала: клиент уже был внутри, и важен рост внутри него, и цена входа здесь вторична.', 'This deal acquired nothing: the customer was already inside, and the growth inside them matters, not the entry price.') },
      { id: 'conversion', text: bi('Конверсия пробной версии в оплату, потому что клиент когда-то начинал маленьким', 'Trial-to-paid conversion, because the customer once started small'), why: bi('Клиент давно платит, и здесь измеряется не первый платёж, а расширение со временем.', 'The customer has paid for a long time; what is measured here is expansion over time, not the first payment.') },
    ],
  },
  {
    id: 'product.q.chasm-gap',
    kind: 'mcq',
    concepts: ['product.chasm'],
    refs: { lesson: 'product.chasm' },
    prompt: bi(
      'Энтузиасты ставят продукт на новые машины каждую неделю, а осторожные компании отвечают «посмотрим через год». Что между этими группами?',
      'Enthusiasts put the product on new machines every week, while cautious companies answer “let’s see in a year”. What lies between these groups?',
    ),
    options: [
      { id: 'chasm', text: bi('Пропасть между ранними последователями и прагматиками, которым нужен чужой опыт', 'The chasm between early adopters and pragmatists, who care about others’ experience, not novelty'), correct: true, why: bi('Прагматик покупает по примеру других, и продукт, который восторгает энтузиастов, проваливается у него без эталонных историй.', 'A pragmatist buys on others’ example, and a product that delights enthusiasts fails with them without lighthouse stories.') },
      { id: 'price', text: bi('Вопрос цены, который осторожные компании решают скидкой к концу квартала', 'A pricing question solved with a quarter-end discount'), why: bi('«Посмотрим через год» говорит про доверие и привычку, деньги здесь вторичны, и скидка пропасть не переходит.', '“Let’s see in a year” is about trust and habit, not money, and a discount does not cross the chasm.') },
      { id: 'features', text: bi('Недостаток единого входа, аудита и поддержки, которые нужны большим компаниям', 'A lack of features for large companies'), why: bi('Чаще всего возможностей хватает, и не хватает примеров успешного использования в похожих компаниях.', 'More often the features are enough; what is missing are examples of successful use in similar companies.') },
    ],
  },
  {
    id: 'product.q.wave',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.chasm' },
    prompt: bi(
      'Какое из событий урок называет волной, которая приводит покупателей к открытым облачным платформам?',
      "Which of these events does the lesson name as a wave that brings buyers to open cloud platforms?",
    ),
    options: [
      { id: 'repatriation', text: bi('Возврат нагрузок из публичных облаков и уход клиентов VMware', 'The repatriation of workloads from public clouds and the exodus of VMware customers after the ownership change'), correct: true, why: bi('Репатриация нагрузок и уход с VMware создают спрос на открытые платформы в собственных центрах обработки данных.', 'Workload repatriation and the VMware exodus create demand for open platforms in on-premise data centres.') },
      { id: 'gpu', text: bi('Дешевеющие видеокарты, которые делают GPU доступными каждой компании', 'Cheaper GPUs making graphics cards affordable for every company'), why: bi('Урок называет волной обратное, дефицит видеокарт, и эта волна относится к другой категории продуктов.', 'The lesson names the opposite, a GPU shortage, as a wave, and it belongs to a different product category.') },
      { id: 'micro', text: bi('Мода на микросервисы, которая заставляет всех перестраивать архитектуру', 'The microservices fashion forcing everyone to re-architect'), why: bi('Микросервисы давно стали бытовой практикой, а волна — событие, которое меняет спрос за считаные кварталы.', 'Microservices became everyday practice long ago; a wave is an event that shifts demand within a few quarters.') },
    ],
  },
  {
    id: 'product.q.ttv-competitor',
    kind: 'mcq',
    concepts: ['product.ttv'],
    refs: { lesson: 'product.first-minutes' },
    prompt: bi(
      'Кто главный конкурент продукта в первый вечер знакомства с ним?',
      'Who is the product’s main competitor on the first evening of acquaintance?',
    ),
    options: [
      { id: 'habit', text: bi('Привычный способ работы и желание ничего не менять', 'The current way of working that says “I won’t change anything”'), correct: true, why: bi('Переключение стоит усилий, и большинство пользователей выбирает привычку, если первый успех откладывается.', 'Switching costs effort, and most users choose the habit when the first success is delayed.') },
      { id: 'rival', text: bi('Другой продукт той же категории с похожими возможностями', 'Another product of the same category with similar features'), why: bi('До сравнения с конкурентами дело доходит редко: пользователь уходит раньше, на шаге установки и первого запуска.', 'The comparison with competitors rarely happens: the user leaves earlier, at install and first launch.') },
      { id: 'setup', text: bi('Сложность настройки, которая путает в первый запуск', 'The setup complexity that confuses the first run'), why: bi('Сложность настройки остаётся препятствием на пути; настоящий конкурент — отказ от изменений.', 'Setup complexity is an obstacle on the path, not a competitor: the competitor is refusal to change.') },
    ],
  },
  {
    id: 'product.q.funnel-narrow',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.first-minutes' },
    prompt: bi(
      'За месяц у продукта тысяча посетителей, триста скачали его, двести десять запустили и двенадцать получили результат. Что чинить в первую очередь?',
      'In a month the product had a thousand visitors, three hundred downloads, two hundred and ten launches and twelve successful results. What do you fix first?',
    ),
    options: [
      { id: 'launch-result', text: bi('Переход от запуска к результату, до которого доходит меньше одного из десяти запустивших', 'The launch-to-result transition, because fewer than one in ten who launch reach a result'), correct: true, why: bi('Из двухсот десяти запустивших до результата дошли двенадцать, около шести процентов, тогда как от посещения до скачивания доходят тридцать процентов, а от скачивания до запуска — семьдесят. Это самое узкое звено воронки, и люди теряются на нём уже после того, как потратили время на установку.', 'Of the 210 who launched, twelve reached a result, about six percent, while thirty percent of visitors download and seventy percent of downloads launch. It is the narrowest step, and people drop there after they have already spent time installing.') },
      { id: 'top', text: bi('Верх воронки, чтобы с большим числом посетителей до результата дошло больше людей', 'The top of the funnel and visitor acquisition'), why: bi('Лить воду в решето бесполезно: новые посетители стекут через то же отверстие, что и старые.', 'Pouring water into a sieve is useless: new visitors drain through the same hole as the old ones.') },
      { id: 'download', text: bi('Переход от посещения к скачиванию, на котором теряется семьсот человек', 'The visit-to-download transition'), why: bi('До скачивания доходят три из десяти посетителей, и хотя переход можно улучшить, он не самый узкий.', 'Three of ten visitors download; the step can be improved, but it is not the narrowest one.') },
    ],
  },
  {
    id: 'product.q.docs-page',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.interfaces' },
    prompt: bi(
      'Какая страница документации чаще всего решает, останется ли новый пользователь с инфраструктурным продуктом?',
      'Which documentation page most often decides whether a new user stays with an infrastructure product?',
    ),
    options: [
      { id: 'quickstart', text: bi('Страница быстрого старта', 'The quickstart page, because it leads to the first result'), correct: true, why: bi('Первый успех за считаные минуты удерживает сильнее любой маркетинговой страницы.', 'A first success within minutes retains better than any marketing page.') },
      { id: 'reference', text: bi('Полный справочник по API со всеми параметрами и примерами', 'The complete API reference with every parameter'), why: bi('Справочник читают те, кто уже решил остаться: он помогает работать, но не приводит к первому успеху.', 'The reference is read by those who have already decided to stay: it helps the work but does not lead to the first success.') },
      { id: 'architecture', text: bi('Архитектурный обзор с диаграммами компонентов', 'The architecture overview with component diagrams'), why: bi('Обзор помогает принять решение о выборе продукта, но решение остаться принимает первая рабочая команда.', 'The overview helps choose the product, but the decision to stay is made by the first working team.') },
    ],
  },
  {
    id: 'product.q.api-first',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.interfaces' },
    prompt: bi(
      'Что инженер изучает раньше маркетинговой страницы при выборе инфраструктурного продукта?',
      'What does an engineer study before the marketing page when choosing an infrastructure product?',
    ),
    options: [
      { id: 'api', text: bi('API и командную строку, чтобы понять, впишется ли продукт в его работу', 'The API and the CLI, because they tell him whether the product fits his work'), correct: true, why: bi('Инженер мыслит скриптами и автоматизацией, и интерфейс продукта для него — это прежде всего API.', 'An engineer thinks in scripts and automation, and for them the product interface is above all the API.') },
      { id: 'story', text: bi('Историю компании и её миссию на главной странице, чтобы понять, надолго ли она', 'The company story and its mission on the home page'), why: bi('Миссию читают позже, когда продукт уже вписался в ежедневную работу.', 'The mission is read later, when the product has already fit into daily work.') },
      { id: 'reviews', text: bi('Отзывы коллег в социальных сетях и на форумах вроде Reddit и Hacker News', 'Colleagues’ reviews on social networks and forums'), why: bi('Отзывы влияют на короткий список кандидатов, но решение принимает чтение API и первый запуск.', 'Reviews shape the shortlist, but the decision comes from reading the API and the first launch.') },
    ],
  },
  {
    id: 'product.q.ost-order',
    kind: 'order',
    concepts: ['product.ost'],
    refs: { lesson: 'product.discovery' },
    prompt: bi(
      'Расставьте шаги дерева возможностей и решений в том порядке, в котором их ищут.',
      'Put the steps of the opportunity-solution tree in the order they are explored.',
    ),
    steps: [
      { id: 'outcome', text: bi('Желаемый исход', 'Desired outcome'), why: bi('Дерево начинается с исхода, который команда хочет получить для бизнеса.', 'The tree starts with the outcome the team wants for the business.') },
      { id: 'opportunity', text: bi('Возможность из жизни пользователя', 'An opportunity from the user’s life'), why: bi('Исход ветвится в возможности, то есть в боли и желания пользователей.', 'The outcome branches into opportunities, the pains and desires of users.') },
      { id: 'solution', text: bi('Решение этой возможности', 'A solution for that opportunity'), why: bi('Решения придумывают только после того, как найдена возможность.', 'Solutions are invented only after the opportunity, not before.') },
      { id: 'experiment', text: bi('Эксперимент для проверки решения', 'An experiment to test the solution'), why: bi('Каждое решение проверяют экспериментом, прежде чем строить его в продукте.', 'Every solution is tested with an experiment before it is built into the product.') },
    ],
  },
  {
    id: 'product.q.solution-love',
    kind: 'mcq',
    concepts: ['product.ost'],
    refs: { lesson: 'product.discovery' },
    prompt: bi(
      'Команда влюбилась в своё решение и теперь ищет ему задачу. Что в этой ситуации нарушено?',
      'A team fell in love with its solution and is now hunting for a job for it. What is violated here?',
    ),
    options: [
      { id: 'order', text: bi('Порядок, при котором сначала ищут возможность, а потом решение', 'The order of the tree: the opportunity comes first, and the solution is invented after'), correct: true, why: bi('Дерево Торрес переворачивает этот порядок и переводит спор с идеи на карту целиком.', 'Torres’s tree flips this order and moves the argument from the idea to the whole map.') },
      { id: 'ambition', text: bi('Недостаток амбиций у команды, которая боится больших задач', 'A lack of ambition in the team'), why: bi('Амбиции тут ни при чём: проблема в порядке мышления, и размер замысла ни при чём.', 'Ambition is not the issue: the problem is the order of thinking, not the size of the vision.') },
      { id: 'velocity', text: bi('Скорость релизов, которая падает от долгих обсуждений', 'Release velocity, which long discussions slow down'), why: bi('Скорость релизов не спасает от решения без задачи, потому что оно так и не найдёт своих пользователей.', 'Release velocity does not save a solution without a job, because it will never find its users.') },
    ],
  },
  {
    id: 'product.q.rice-math',
    kind: 'mcq',
    concepts: ['product.rice'],
    refs: { lesson: 'product.priorities' },
    prompt: bi(
      'Первая фича затронет тысячу клиентов с влиянием один, вторая — пятьсот клиентов с влиянием три. Уверенность и трудоёмкость одинаковы. Какая фича выше по RICE?',
      'The first feature reaches a thousand customers with impact one, the second reaches five hundred customers with impact three. Confidence and effort are equal. Which feature ranks higher in RICE?',
    ),
    options: [
      { id: 'second', text: bi('Вторая: 500 × 3 = 1500 баллов против 1000 × 1 = 1000, остальные множители равны', 'The second, because five hundred times three is one and a half thousand, while a thousand times one is a thousand'), correct: true, why: bi('RICE перемножает охват и влияние, поэтому вторая фича в полтора раза опережает первую при тех же затратах.', 'RICE multiplies reach by impact, so the second feature is one and a half times ahead of the first at equal cost.') },
      { id: 'first', text: bi('Первая, потому что она затронет вдвое больше клиентов, а охват в RICE стоит первым', 'The first, because it reaches twice as many people'), why: bi('Охват без влияния обманывает, потому что тысяча слабых касаний слабее пятисот сильных.', 'Reach without impact deceives, because a thousand weak touches are weaker than five hundred strong ones.') },
      { id: 'equal', text: bi('Нельзя сравнить: влияние — субъективная оценка, и без точных данных о будущем RICE не работает', 'They cannot be compared without exact data about the future'), why: bi('RICE придуман ровно для сравнения разнородных идей на приблизительных, но откровенных оценках.', 'RICE exists precisely to compare heterogeneous ideas on approximate but honest estimates.') },
    ],
  },
  {
    id: 'product.q.signal',
    kind: 'multi',
    concepts: [],
    refs: { lesson: 'product.priorities' },
    prompt: bi(
      'Что из этого сигнал для дорожной карты, а что шум?',
      'Which of these is a signal for the roadmap rather than noise?',
    ),
    options: [
      { id: 'repeat', text: bi('Один и тот же запрос от трёх целевых клиентов за месяц', 'The same request from three target customers within a month'), correct: true },
      { id: 'metric', text: bi('Рост числа отказов после последнего релиза', 'A rise in the number of failures after the last release'), correct: true },
      { id: 'tweet', text: bi('Громкий пост нецелевой аудитории с критикой продукта', 'A loud post from a non-target audience criticising the product'), why: bi('Шум громок, но приходит не от вашего сегмента и не связан с ценностью продукта.', 'Noise is loud, but it comes from outside your segment and is unrelated to the product’s value.') },
      { id: 'one-big', text: bi('Просьба одного крупного клиента сделать функцию только для него, пока задачу за ней никто не исследовал', 'One large customer asking for a feature only for themselves before anyone has examined the problem behind it'), why: bi('Пока задача за просьбой не исследована, это ещё не сигнал для дорожной карты: сигнал повторяется и приходит от сегмента. Сразу считать её шумом тоже нельзя: как исследовать такой запрос и отказать, если он не подтвердился, разобрано в уроке о сигналах сообщества.', 'Until the problem behind the request is examined, it is not yet a roadmap signal: a signal repeats and comes from a segment. Nor can it be dismissed as noise at once: how to examine such a request and say no if it is not confirmed is covered in the community-signals lesson.') },
    ],
  },
  {
    id: 'product.q.mom-test',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.priorities' },
    prompt: bi(
      'По правилам «Маминого теста» какой вопрос задают пользователю правильно?',
      'By the rules of The Mom Test, which question to a user is asked correctly?',
    ),
    options: [
      { id: 'past', text: bi('«Как вы решали эту задачу в прошлый раз и сколько это стоило?»', '“Tell me how you solved this job last time and what it cost you”'), correct: true, why: bi('Вопрос о прошлом поведении и потраченных деньгах даёт проверяемые факты вместо вежливых обещаний.', 'A question about past behaviour and spent money gives verifiable facts rather than polite promises.') },
      { id: 'future', text: bi('«Вы бы купили продукт, который решает эту задачу автоматически?»', '“Would you buy a product that solves this job automatically?”'), why: bi('О гипотетическом будущем люди отвечают вежливо и неправдиво, ведь «купил бы» ничего не стоит.', 'About the hypothetical future people answer politely and untruthfully, because “I would buy it” costs nothing.') },
      { id: 'opinion', text: bi('«Как вам идея такого продукта, нравится ли она вам?»', '“How do you like the idea of such a product, do you like it?”'), why: bi('Мнение об идее не предсказывает покупку: люди хвалят идеи из вежливости и не покупают потом.', 'An opinion about the idea does not predict a purchase: people praise ideas out of politeness and then do not buy.') },
    ],
  },
  {
    id: 'product.q.governance-why',
    kind: 'mcq',
    concepts: ['product.governance'],
    refs: { lesson: 'product.oss' },
    prompt: bi(
      'Почему передача проекта под крыло CNCF помогает продавать энтерпрайзу?',
      'Why does handing a project over to the CNCF help sell to enterprises?',
    ),
    options: [
      { id: 'neutral', text: bi('Проект становится нейтральным и переживёт компанию', 'The project becomes neutral and will not disappear with the sale of the company'), correct: true, why: bi('Покупатель боится зависимости от одного вендора, а нейтральный фонд снимает этот риск.', 'The buyer fears dependence on a single vendor, and a neutral foundation removes that risk.') },
      { id: 'free-dev', text: bi('Фонд выделит проекту своих разработчиков, и код будут писать бесплатно', 'The foundation will send its own developers to write code for free'), why: bi('Фонд не пишет код за вас: он даёт нейтральность и правила игры, а код пишет сообщество.', 'The foundation does not write code for you: it provides neutrality and rules, while the community writes the code.') },
      { id: 'brand', text: bi('Марка проекта навсегда перейдёт к фонду и перестанет быть вашей', 'The project brand will pass to the foundation forever and stop being yours'), why: bi('Речь не о марке, а о доверии: связь компании с проектом сохраняется, а купить его становится легче.', 'It is not about the brand but about trust: the company’s bond with the project stays, and buying it gets easier.') },
    ],
  },
  {
    id: 'product.q.default',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.oss' },
    prompt: bi(
      'Какая позиция даёт воронку, которую нельзя купить рекламой?',
      'Which position provides a funnel that cannot be bought with advertising?',
    ),
    options: [
      { id: 'default', text: bi('Выбор по умолчанию в экосистеме', 'The ecosystem default, because it arrives ready-made and is not changed without a reason'), correct: true, why: bi('Дефолт выбирают без выбора, и каждый следующий пользователь приходит уже с установленным продуктом.', 'The default is chosen without choosing, and every next user arrives with the product already installed.') },
      { id: 'cheap', text: bi('Самая низкая цена на рынке среди похожих продуктов, которую нельзя перебить', 'The lowest price on the market among similar products'), why: bi('Цена конкурирует в момент покупки, а дефолт работает до всякой покупки.', 'Price competes at the moment of purchase, while the default works before any purchase.') },
      { id: 'ads', text: bi('Самая широкая рекламная кампания среди конкурентов на всех площадках сразу', 'The widest advertising campaign among competitors'), why: bi('Реклама покупает внимание; привычку даёт только положение решения по умолчанию.', 'Advertising buys attention, not habit, and only the status of the default buys habit.') },
    ],
  },
  {
    id: 'product.q.metric-monitor',
    kind: 'mcq',
    concepts: ['product.value-metric'],
    refs: { lesson: 'product.pricing' },
    prompt: bi(
      'За что правильнее считать деньги сервису мониторинга инфраструктуры?',
      'What is the right thing for an infrastructure monitoring service to charge for?',
    ),
    options: [
      { id: 'node', text: bi('За объём наблюдаемой инфраструктуры', 'For the volume of monitored infrastructure, because the bill grows with the customer’s trust'), correct: true, why: bi('Метрика ценности должна расти вместе с успехом клиента, и число узлов подходит под это требование лучше прочих.', 'The value metric should grow with the customer’s success, and the node count fits that requirement best.') },
      { id: 'fixed', text: bi('Фиксированную плату за продукт целиком, чтобы клиенту было проще планировать бюджет', 'A fixed fee for the whole product regardless of size'), why: bi('При фиксе вы не растёте вместе с клиентом: ему выгодно увеличивать нагрузку, а вам нет.', 'With a fixed fee you do not grow with the customer: expanding their load benefits them, not you.') },
      { id: 'admin', text: bi('За каждого администратора, который смотрит в дашборд, как в большинстве SaaS', 'For every administrator who looks at the dashboard'), why: bi('У клиента один администратор на весь дата-центр, и такая метрика не вырастет вместе с его успехом.', 'A customer has one administrator for the whole data centre, so such a metric will not grow with their success.') },
    ],
  },
  {
    id: 'product.q.tiers-blur',
    kind: 'mcq',
    concepts: [],
    refs: { lesson: 'product.pricing' },
    prompt: bi(
      'Чем опасна размытая граница между бесплатной и корпоративной версиями продукта?',
      'What makes a blurred boundary between the free and the enterprise versions dangerous?',
    ),
    options: [
      { id: 'trust', text: bi('Конфликтом с сообществом и потерей доверия, которое копилось годами', 'Conflict with the community and the loss of trust, which takes years to build'), correct: true, why: bi('Если вчерашнее бесплатное сегодня платное, сообщество чувствует обман, и форк не заставит себя долго ждать.', 'When yesterday’s free feature becomes paid, the community feels cheated, and a fork will not be long in coming.') },
      { id: 'small', text: bi('Меньшей выручкой от маленьких команд, которые перестанут платить за корпоративную версию', 'Smaller revenue from small teams'), why: bi('Маленькие команды почти не платят в любом случае, и ущерб приходится не на эту строку.', 'Small teams barely pay anyway, so the damage does not land on this line.') },
      { id: 'invoices', text: bi('Сложностью выставления счетов, потому что бухгалтерия не поймёт, за что платят', 'The complexity of invoicing the accountants'), why: bi('Счета выставлять не сложнее, а вот объяснять сообществу, почему граница сдвинулась без предупреждения, сложно.', 'Invoicing is no harder; what is hard is explaining to the community why the boundary moved without warning.') },
    ],
  },
];
