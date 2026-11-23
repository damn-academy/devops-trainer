// Lessons of the hidden sales pilot, built from the Dream 100 sales school
// (aenix-org/dream100, SALES-SCHOOL.md). The Russian text is the source
// material; the English slot of every generated section honestly says the
// translation is pending (TODO(ru-en)) instead of pretending. Claude owns the
// prose pass per web/STYLE-RU.md before this block can go public.

import { bi } from '../../core/i18n';
import type { Concept, Lesson, QuizItem } from '../../core/types';
import { SALES_SCHOOL } from './school';

/** The honest note every school lesson carries: one way, not a law. */
export const HONEST_NOTE = bi(
  'Это один из способов работать, а не закон и не оптимальное решение. Жизнь сложнее любой схемы: многое зависит от контекста — продукта, рынка, людей и момента. Берите то, что применимо к вашей ситуации, и проверяйте на практике.',
  'This is one way of working, not a law and not an optimal solution. Life is more complex than any framework: much depends on context — the product, the market, the people and the moment. Take what applies to your situation and test it in practice.',
);

const MODULE_LESSON: Record<string, { id: string; title: [string, string]; minutes: number; hook: [string, string] }> = {
  A: {
    id: 'sales.fundamentals',
    title: ['Фундамент сложных продаж', 'The foundation of complex sales'],
    minutes: 15,
    hook: [
      'Enterprise-сделка — это не «продать продукт», а провести закупочный комитет покупателя через его собственный процесс. Этот курс — ежедневная практика: одна тема, одно действие сегодня.',
      'An enterprise deal is not "selling a product" but guiding the buyer\'s procurement committee through their own process. This school is a daily practice: one topic, one action today.',
    ],
  },
  B: {
    id: 'sales.roles',
    title: ['Роли закупочного центра', 'The roles of the buying center'],
    minutes: 12,
    hook: [
      'Внутри аккаунта нет «клиента» — есть семь ролей, и каждая покупает по-своему. Схема ниже показывает, кто есть кто и как заходить к каждому.',
      'Inside an account there is no "the customer" — there are seven roles, and each buys differently. The diagram below shows who is who and how to approach each.',
    ],
  },
  C: {
    id: 'sales.segments',
    title: ['Типы компаний: как они покупают', 'Company types: how they buy'],
    minutes: 10,
    hook: [
      'Банк, телко и AI-облако покупают один и тот же продукт по-разному. Сегмент определяет первый шаг, цикл и козыри.',
      'A bank, a telecom and an AI cloud buy the same product differently. The segment decides the first step, the cycle and the winning cards.',
    ],
  },
  D: {
    id: 'sales.regions',
    title: ['Регионы и культура', 'Regions and culture'],
    minutes: 10,
    hook: [
      'Один и тот же питч в США, DACH и Японии работает по-разному — вплоть до обратного эффекта. Культура покупки — часть продукта, который вы «продаёте».',
      'The same pitch works differently in the US, DACH and Japan — sometimes in reverse. Buying culture is part of what you "sell".',
    ],
  },
  E: {
    id: 'sales.touches',
    title: ['Тактика касаний', 'The tactics of touches'],
    minutes: 12,
    hook: [
      'Касание по триггеру конвертит в разы лучше рассылки. Симулятор воронки ниже показывает, как параметры касаний складываются в встречи и сделки за квартал.',
      'A trigger-based touch converts many times better than a blast. The funnel simulator below shows how touch parameters add up to meetings and deals per quarter.',
    ],
  },
  F: {
    id: 'sales.asymmetry',
    title: ['Founder-led против гигантов', 'Founder-led against giants'],
    minutes: 8,
    hook: [
      'Маленький вендор против гиганта — проигрышная позиция только если играть по его правилам. Асимметрия — актив.',
      'A small vendor against a giant only loses if playing by the giant\'s rules. Asymmetry is an asset.',
    ],
  },
};

function moduleBody(letter: string): string {
  const mod = SALES_SCHOOL.find((m) => m.letter === letter)!;
  return mod.items.map((it) => `**${it.n}. ${it.title}.** ${it.body}\n\n> Сегодня: ${it.today}`).join('\n\n');
}

const INTRODUCES: Record<string, string[]> = {
  A: ['sales.meddic', 'sales.trigger'],
  B: ['sales.champion', 'sales.economic-buyer'],
  C: [],
  D: [],
  E: [],
  F: [],
};

const SOURCES = {
  en: [{ title: 'Cozystack — open-source cloud platform', url: 'https://cozystack.io/' }],
  ru: [{ title: 'Cozystack — открытая облачная платформа', url: 'https://cozystack.io/' }],
};

function lessonFor(letter: string): Lesson {
  const spec = MODULE_LESSON[letter]!;
  const mod = SALES_SCHOOL.find((m) => m.letter === letter)!;
  return {
    id: spec.id,
    block: 'sales',
    title: bi(spec.title[0], spec.title[1]),
    summary: bi(`Модуль ${letter}: ${mod.title}. ${mod.items.length} принципов с задачей на каждый день.`, `Module ${letter}: ${mod.title}. ${mod.items.length} principles with a task for each day.`),
    introduces: INTRODUCES[letter] ?? [],
    uses: [],
    tier: 'core',
    minutes: spec.minutes,
    sources: SOURCES,
    sections: [
      { id: 'hook', kind: 'text', step: 'hook', body: bi(spec.hook[0], spec.hook[1]) },
      {
        id: 'principles',
        kind: 'text',
        step: 'explain',
        title: bi(`Модуль ${letter}. ${mod.title}`, `Module ${letter}. ${mod.title}`),
        // TODO(ru-en): translate the school text into English; Russian is the source material.
        body: bi(moduleBody(letter), `English text is being prepared for this pilot lesson (module ${letter}, ${mod.items.length} principles). Switch to Russian to read the source material.`),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  };
}

export const SALES_LESSONS: Lesson[] = Object.keys(MODULE_LESSON).map(lessonFor);

export const SALES_CONCEPTS: Concept[] = [
  {
    id: 'sales.champion',
    term: bi('чемпион', 'champion'),
    short: bi('Внутренний человек в аккаунте, который продаёт за вас, когда вас нет в комнате; без чемпиона сделки нет.', 'The insider who sells for you when you are not in the room; without a champion there is no deal.'),
    introducedIn: 'sales.roles',
    scan: false,
  },
  {
    id: 'sales.economic-buyer',
    term: bi('экономический покупатель', 'economic buyer'),
    short: bi('Тот, кто подписывает бюджет и говорит «да»; обычно не чемпион (CTO / Head of Infra).', 'The one who signs the budget and says yes; usually not the champion (CTO / Head of Infra).'),
    introducedIn: 'sales.roles',
    scan: false,
  },
  {
    id: 'sales.meddic',
    term: bi('MEDDIC', 'MEDDIC'),
    short: bi('Карманный чеклист сделки: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion.', 'A pocket deal checklist: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion.'),
    introducedIn: 'sales.fundamentals',
    scan: false,
  },
  {
    id: 'sales.trigger',
    term: bi('триггер «почему сейчас»', 'a "why now" trigger'),
    short: bi('Событие, которое делает покупку актуальной: renewal, смена CTO, суверенный мандат. Без него откладывают вечно.', 'The event that makes the purchase urgent: a renewal, a CTO change, a sovereignty mandate. Without it deals stall forever.'),
    introducedIn: 'sales.fundamentals',
    scan: false,
  },
];

export const SALES_QUIZ: QuizItem[] = [
  {
    id: 'sales.q.champion',
    kind: 'mcq',
    concepts: ['sales.champion'],
    prompt: bi('Сделка зависла: контакт в аккаунте отвечает «всё ок, двигаемся», но никакого движения нет три месяца. Чего не хватает по MEDDIC?', 'A deal is stuck: the contact says "all good, moving" but nothing has moved for three months. Which part of MEDDIC is missing?'),
    options: [
      { id: 'champion', text: bi('Чемпиона, которому это выгодно лично', 'A champion with a personal stake'), correct: true, why: bi('«Всё ок» без личной выгоды контакта = вежливый отказ. Чемпион двигает, когда ему самому нужен результат.', '"All good" without the contact\'s personal stake is a polite no. A champion pushes when they need the result themselves.') },
      { id: 'price', text: bi('Скидки', 'A discount'), why: bi('Цена не двигает сделку без внутреннего продавца.', 'Price does not move a deal without an internal seller.') },
      { id: 'demo', text: bi('Ещё одной демонстрации', 'Another demo'), why: bi('Демо решает вопрос «что это», а не «почему они должны это купить сейчас».', 'A demo answers "what is it", not "why should they buy it now".') },
    ],
  },
  {
    id: 'sales.q.threads',
    kind: 'mcq',
    concepts: ['sales.champion'],
    prompt: bi('Сколько живых контактов стоит держать в одном энтерпрайз-аккаунте минимум?', 'What is the minimum number of live contacts to keep in one enterprise account?'),
    options: [
      { id: 'three', text: bi('Не меньше трёх', 'At least three'), correct: true, why: bi('Один контакт = одна точка отказа: уволился, охладел, оказался не тем человеком.', 'One contact is one point of failure: they quit, cool down, or turn out to be the wrong person.') },
      { id: 'one', text: bi('Оного, но золотого', 'One, but a golden one'), why: bi('«Золотой» контакт увольняется так же, как обычный.', 'A "golden" contact quits just like any other.') },
      { id: 'ten', text: bi('Не меньше десяти', 'At least ten'), correct: false, why: bi('Три-четыре живых контакта уже покрывают ключевые роли; десять — это уже не фокус.', 'Three to four live contacts already cover the key roles; ten is no longer focus.') },
    ],
  },
  {
    id: 'sales.q.first',
    kind: 'mcq',
    concepts: ['sales.trigger'],
    prompt: bi('Какое первое касание обычно работает лучше холодного письма с просьбой о звонке?', 'Which first touch usually works better than a cold email asking for a call?'),
    options: [
      { id: 'value', text: bi('Касание с ценностью: инсайт, расчёт, наблюдение', 'A touch with value: an insight, a calculation, an observation'), correct: true, why: bi('Обратимое касание с пользой почти невозможно испортить и не требит доверие.', 'A reversible value-first touch can hardly be spoiled and does not spend trust.') },
      { id: 'blast', text: bi('Рассылка по базе Apollo в 500 адресов', 'An Apollo blast to 500 addresses'), why: bi('Бласт в exec = спам-папка; Apollo — это карта закупочного центра, не рассыльщик.', 'A blast to execs lands in spam; Apollo is a map of the buying center, not a sender.') },
      { id: 'cto', text: bi('Питч генеральному директору напрямую', 'A pitch straight to the CEO'), why: bi('Холодный питч в CTO обычно мимо; к эконом-покупателю заходят через тёплого чемпиона.', 'A cold pitch to a CTO usually misses; you reach the economic buyer through a warm champion.') },
    ],
  },
  {
    id: 'sales.q.objection',
    kind: 'mcq',
    concepts: [],
    prompt: bi('«Вы маленькие, вдруг исчезнете?» — что это по смыслу?', '"You are small, what if you disappear?" — what is it, in essence?'),
    options: [
      { id: 'data', text: bi('Запрос недостающих данных, а не отказ', 'A request for missing data, not a no'), correct: true, why: bi('Возражение = запрос информации. Ответ здесь: код открыт, exit-ability заложена в архитектуру.', 'An objection is a request for information. Here the answer: the code is open, exit-ability is in the architecture.') },
      { id: 'no', text: bi('Вежливое «нет»', 'A polite "no"'), why: bi('«Нет» звучит как «не сейчас» + причина; здесь причина названа — значит, есть что закрыть.', 'A "no" sounds like "not now" plus a reason; a reason was given, so something can be closed.') },
      { id: 'price', text: bi('Просьба о скидке', 'A request for a discount'), why: bi('Это вопрос риска, а не цены.', 'This is a risk question, not a price one.') },
    ],
  },
];
