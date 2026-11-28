// Dream 100 sales school: Russian principles and their English mirror.

import { bi } from '../../core/i18n';
import type { Concept, Lesson, QuizItem } from '../../core/types';
import { SALES_SCHOOL, SALES_SCHOOL_EN } from './school';

/** The course-wide note, said once in the first lesson. */
export const HONEST_NOTE = bi(
  'Это один из способов работать; законом и единственно верным решением он не служит. Жизнь сложнее любой схемы: многое зависит от контекста — продукта, рынка, людей и момента. Берите то, что применимо к вашей ситуации, и проверяйте на практике.',
  'This is one way of working, not a law and not an optimal solution. Life is more complex than any framework: much depends on context — the product, the market, the people and the moment. Take what applies to your situation and test it in practice.',
);

/** The concrete limits that every later lesson repeats instead of the general note. */
const LIMITS_NOTE = bi(
  'Принципы этого урока работают внутри границ модуля Dream 100: одному человеку — не больше трёх касаний за три недели, отказ и просьба не писать отменяют любую последовательность, а договорённость вернуться в определённую дату выполняется в эту дату.',
  'The principles of this lesson work within the limits of the Dream 100 module: no more than three touches to one person in three weeks, a refusal or a request not to be contacted cancels any sequence, and an agreement to return on a particular date is kept on that date.',
);

const MODULE_LESSON: Record<string, { id: string; title: [string, string]; minutes: number; hook: [string, string]; summary?: [string, string] }> = {
  A: {
    id: 'sales.fundamentals',
    title: ['Фундамент сложных продаж', 'The foundation of complex sales'],
    summary: ['Почему крупная сделка — это работа с закупочным комитетом, как устроены MEDDIC и поводы для разговора, и десять принципов с действием на каждый день.', 'Why a large deal is work with a buying committee, how MEDDIC and triggers work, and ten principles with an action for each day.'],
    minutes: 15,
    hook: [
      'Крупная сделка с корпоративным покупателем похожа на проводку закупочного комитета через его собственный процесс принятия решения: показать продукт для этого мало. Курс построен как ежедневная практика, в которой на каждый день приходятся одна тема и одно действие.',
      'An enterprise deal is not "selling a product" but guiding the buyer\'s procurement committee through their own process. This school is a daily practice: one topic, one action today.',
    ],
  },
  B: {
    id: 'sales.roles',
    title: ['Роли закупочного центра', 'The roles of the buying center'],
    summary: ['Семь ролей закупочного центра, как распознать чемпиона и экономического покупателя и с чего начинать разговор с каждым.', 'The seven roles of the buying center, how to recognise the champion and the economic buyer, and how to open the conversation with each.'],
    minutes: 12,
    hook: [
      'Внутри компании-покупателя продукт выбирают семь разных ролей, и каждая покупает по-своему. Схема ниже показывает, кто за что отвечает и как начинать разговор с каждым.',
      'Inside an account there is no "the customer" — there are seven roles, and each buys differently. The diagram below shows who is who and how to approach each.',
    ],
  },
  C: {
    id: 'sales.segments',
    title: ['Типы компаний: как они покупают', 'Company types: how they buy'],
    summary: ['Как покупают банки, телеком-операторы, хостинг-провайдеры и облака для нейросетей и что из этого следует для первого шага и длины сделки.', 'How banks, telecom operators, hosting providers and AI clouds buy, and what that means for the first step and the length of the deal.'],
    minutes: 10,
    hook: [
      'Банк, телеком-оператор и облако для нейросетей покупают один и тот же продукт по-разному. От сегмента зависят первый шаг, длина сделки и сильные стороны, на которые стоит опираться.',
      'A bank, a telecom and an AI cloud buy the same product differently. The segment decides the first step, the cycle and the winning cards.',
    ],
  },
  D: {
    id: 'sales.regions',
    title: ['Регионы и культура', 'Regions and culture'],
    summary: ['Как культура покупки в США, Германии, Австрии и Швейцарии, в Японии и других регионах меняет презентацию, темп и решения.', 'How buying culture in the US, Germany, Austria and Switzerland, Japan and other regions changes the pitch, the pace and the decisions.'],
    minutes: 10,
    hook: [
      'Одна и та же презентация в США, в Германии, Австрии и Швейцарии и в Японии действует по-разному, иногда даже отталкивает. Культура покупки становится частью того, что вы продаёте.',
      'The same pitch works differently in the US, DACH and Japan — sometimes in reverse. Buying culture is part of what you "sell".',
    ],
  },
  E: {
    id: 'sales.touches',
    title: ['Тактика касаний', 'The tactics of touches'],
    summary: ['Как поводы для разговора, частота и каналы касаний складываются во встречи и сделки, с симулятором воронки.', 'How triggers, frequency and channels of touches add up to meetings and deals, with the funnel simulator.'],
    minutes: 12,
    hook: [
      'Письмо или звонок по поводу, который действительно произошёл у покупателя, обычно приводит к разговору чаще, чем массовая рассылка. Симулятор воронки ниже показывает, как частота и качество касаний складываются во встречи и сделки за квартал.',
      'A touch tied to something that really happened at the buyer usually leads to a conversation more often than a mass mailing. The funnel simulator below shows how touch parameters add up to meetings and deals per quarter.',
    ],
  },
  F: {
    id: 'sales.asymmetry',
    title: ['Продажи силами основателя против гигантов', 'Founder-led sales against giants'],
    summary: ['Как маленькому вендору с продажами силами основателя выигрывать у гигантов за счёт скорости, внимания и гибкости.', 'How a small founder-led vendor wins against giants through speed, attention and flexibility.'],
    minutes: 8,
    hook: [
      'Маленький вендор проигрывает гиганту, когда играет по правилам гиганта. Разница в размере даёт маленькой компании свои преимущества: скорость, внимание основателя и гибкость, которых у гиганта нет.',
      'A small vendor against a giant only loses if playing by the giant\'s rules. Asymmetry is an asset.',
    ],
  },
};

/** Each principle's task as a full sentence, with a note on how many to take this week. */
function practiceBody(items: string[], l: 'ru' | 'en', minutes: number): string {
  const intro = l === 'ru'
    ? `К каждому принципу урока есть задание на вашем списке компаний. Делать все задания за один день не нужно: выберите на эту неделю одно-два задания к принципам, которые ближе всего к вашим сделкам, а к остальным вернитесь на следующих неделях. Чтение урока занимает около ${minutes} минут, каждое задание — от двадцати минут до часа.`
    : `Each principle in this lesson comes with a task on your company list. You do not need to do them all in one day: pick one or two tasks this week for the principles closest to your deals and return to the rest in the following weeks. Reading the lesson takes about ${minutes} minutes; each task takes from twenty minutes to an hour.`;
  const sentence = (x: string) => x.replace(/^\s*(\p{L})/u, (c) => c.toLocaleUpperCase(l));
  return `${intro}\n\n${items.map(x => `- ${sentence(x)}`).join('\n')}`;
}

function moduleBody(letter: string, en = false): string {
  const mod = (en ? SALES_SCHOOL_EN : SALES_SCHOOL).find((m) => m.letter === letter)!;
  // Numbered within the lesson: a lesson opened on its own should not start at 11.
  return mod.items.map((it, i) => `**${i + 1}. ${it.title.replace(/\.$/, '')}.** ${it.body}`).join('\n\n');
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
    summary: spec.summary ? bi(spec.summary[0], spec.summary[1]) : bi(`Модуль ${letter}: ${mod.title}.`, `Module ${letter}: ${mod.title}.`),
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
        title: bi(mod.title, SALES_SCHOOL_EN.find(m => m.letter === letter)!.title),
        body: bi(moduleBody(letter), moduleBody(letter, true)),
      },
      { id: 'practice', kind: 'text', step: 'practice', title: bi('Задания по темам модуля', 'Module practice'), body: bi(practiceBody(mod.items.map(it => it.today), 'ru', spec.minutes), practiceBody(SALES_SCHOOL_EN.find(m => m.letter === letter)!.items.map(it => it.today), 'en', spec.minutes)) },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: letter === 'A' ? HONEST_NOTE : LIMITS_NOTE },
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
    short: bi('Тот, кто подписывает бюджет и говорит «да»; обычно это не чемпион, а технический директор или руководитель инфраструктуры.', 'The one who signs the budget and says yes; usually not the champion (CTO / Head of Infra).'),
    introducedIn: 'sales.roles',
    scan: false,
  },
  {
    id: 'sales.meddic',
    term: bi('MEDDIC', 'MEDDIC'),
    short: bi('Список проверки сделки: измеримый результат (Metrics), экономический покупатель (Economic buyer), критерии решения (Decision criteria), процесс решения (Decision process), боль (Identify pain), внутренний сторонник (Champion).', 'A pocket deal checklist: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion.'),
    introducedIn: 'sales.fundamentals',
    scan: false,
  },
  {
    id: 'sales.trigger',
    term: bi('триггер «почему сейчас»', 'a "why now" trigger'),
    short: bi('Событие, которое делает покупку срочной: продление контракта, новый технический директор, требование хранить данные в своей стране. Без такого события покупку откладывают.', 'The event that makes the purchase urgent: a renewal, a CTO change, a sovereignty mandate. Without it deals stall forever.'),
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
      { id: 'champion', text: bi('Внутреннего сторонника', 'A champion with a personal stake'), correct: true, why: bi('«Всё хорошо» без личной заинтересованности контакта обычно означает вежливый отказ. Внутренний сторонник двигает сделку, когда результат нужен ему самому.', '"All good" without the contact\'s personal stake is a polite no. A champion pushes when they need the result themselves.') },
      { id: 'price', text: bi('Скидки, которая сдвинет решение к концу квартала', 'A discount'), why: bi('Цена не двигает сделку без внутреннего сторонника.', 'Price does not move a deal without a champion.') },
      { id: 'demo', text: bi('Ещё одной демонстрации для инженеров, которые не были на первой', 'Another demo'), why: bi('Демонстрация отвечает на вопрос «что это», а не «почему это нужно купить сейчас».', 'A demo answers "what is it", not "why should they buy it now".') },
    ],
  },
  {
    id: 'sales.q.threads',
    kind: 'mcq',
    concepts: ['sales.champion'],
    prompt: bi('Вы ведёте сделку с банком, где решение принимают инженер платформы, руководитель инфраструктуры и руководитель безопасности. Со сколькими людьми в банке стоит поддерживать связь как минимум?', "You are working on a bank deal where a platform engineer, the head of infrastructure and the security lead make the decision. What is the minimum number of people at the bank you should stay in contact with?"),
    options: [
      { id: 'three', text: bi('Не меньше трёх', 'At least three'), correct: true, why: bi('Если вы знаете одного человека, сделка зависит только от него: он может уволиться, потерять интерес или оказаться не тем, кто решает. Здесь в решении участвуют три роли, и с каждой нужна своя связь.', "If you know one person, the deal depends entirely on them: they may leave, lose interest or not be the decision maker. Three roles participate in this decision, and each needs its own connection.") },
      { id: 'one', text: bi('С одним, но самым влиятельным', "One, but the most influential"), why: bi('Самый влиятельный человек тоже может уволиться или сменить приоритеты, и тогда сделка останется без единого знакомого в банке.', "Even the most influential person can leave or change priorities, leaving the deal without a single familiar contact at the bank.") },
      { id: 'ten', text: bi('Не меньше десяти', 'At least ten'), correct: false, why: bi('Десять человек может понадобиться в очень большой сделке, но здесь в решении участвуют три роли; минимум — по человеку на каждую, а дальше число растёт вместе с числом участников решения.', "A very large deal may need ten people, but this decision involves three roles. The minimum is one person per role; the number grows with the number of decision participants.") },
    ],
  },
  {
    id: 'sales.q.first',
    kind: 'mcq',
    concepts: ['sales.trigger'],
    prompt: bi('Какое первое касание обычно работает лучше холодного письма с просьбой о звонке?', 'Which first touch usually works better than a cold email asking for a call?'),
    options: [
      { id: 'value', text: bi('Касание, которое что-то даёт человеку, например расчёт или наблюдение о его задаче', 'A touch with value: an insight, a calculation, an observation'), correct: true, why: bi('Обратимое касание с пользой почти невозможно испортить и не тратит доверие.', 'A reversible value-first touch can hardly be spoiled and does not spend trust.') },
      { id: 'blast', text: bi('Рассылка по базе Apollo в 500 адресов с персональным первым предложением', 'An Apollo blast to 500 addresses'), why: bi('Массовая рассылка руководителям попадает в спам. Apollo полезен как карта закупочного центра, а не как инструмент рассылки.', 'A blast to execs lands in spam; Apollo is a map of the buying center, not a sender.') },
      { id: 'cto', text: bi('Короткое письмо генеральному директору напрямую с предложением встречи', 'A pitch straight to the CEO'), why: bi('Холодное письмо руководителю с просьбой о встрече обычно остаётся без ответа: к экономическому покупателю приходят через внутреннего сторонника, который вас уже знает.', 'A cold pitch to a CTO usually misses; you reach the economic buyer through a warm champion.') },
    ],
  },
  {
    id: 'sales.q.objection',
    kind: 'mcq',
    concepts: [],
    prompt: bi('Руководитель инфраструктуры банка на второй встрече спрашивает: «Вы маленькие, вдруг исчезнете?» До этого он сам предложил пилот. Что, скорее всего, стоит за вопросом?', "At the second meeting, the bank’s infrastructure lead asks: “You are small; what if you disappear?” They previously proposed a pilot themselves. What most likely lies behind the question?"),
    options: [
      { id: 'data', text: bi('Опасение о риске, на которое нужны данные о том, что будет с системой без поставщика', "A risk concern requiring evidence: what happens to the system if the vendor disappears"), correct: true, why: bi('В этой ситуации человек уже хочет пилот, и вопрос показывает риск, который ему придётся объяснять своему руководству. Помогают факты: открытый код, возможность эксплуатировать систему без поставщика, условия передачи исходного кода и другие клиенты. Не каждое возражение означает запрос данных, и если человек прямо отказался, отказ уважают.', "Here the person already wants a pilot, and the question highlights a risk they must explain to management. Helpful facts include open code, operating the system without the vendor, source-code handover terms and other customers. Not every objection asks for information: respect an explicit refusal.") },
      { id: 'no', text: bi('Вежливый отказ от пилота, который он не решается сказать прямо', "A polite refusal of the pilot"), why: bi('Человек сам предложил пилот и задаёт конкретный вопрос о риске; так отказ обычно не звучит.', "The person proposed the pilot and is asking a specific risk question; that is not how a refusal usually sounds.") },
      { id: 'price', text: bi('Просьба о скидке за то, что банк берёт на себя риск работы с маленьким поставщиком', 'A request for a discount'), why: bi('О цене здесь ничего не сказано; вопрос касается риска.', "Nothing here concerns price; the question is about risk.") },
    ],
  },
];
