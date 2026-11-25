// Lessons of the hidden marketing pilot, built from the marketing school
// (46 drip principles in ten modules, src/blocks/marketing/school.ts). The
// Russian text is the source material; the English slot of every section is a
// faithful full translation. Claude owns the prose pass per web/STYLE-RU.md.

import { bi, count } from '../../core/i18n';
import type { Concept, Lesson, QuizItem } from '../../core/types';
import { MARKETING_SCHOOL, type SchoolModule } from './school';

/** The honest note every school lesson carries: one way, not a law. It mirrors
 * the disclaimer of the sales pilot, so the two hidden courses speak alike. */
export const HONEST_NOTE = bi(
  'Это один из способов работать, а не закон и не оптимальное решение. Жизнь сложнее любой схемы: многое зависит от контекста — продукта, рынка, людей и момента. Берите то, что применимо к вашей ситуации, и проверяйте на практике.',
  'This is one way of working, not a law and not an optimal solution. Life is more complex than any framework: much depends on context — the product, the market, the people and the moment. Take what applies to your situation and test it in practice.',
);

interface LessonSpec {
  id: string;
  /** The school module this lesson is built from (module A feeds two lessons). */
  module: string;
  /** Principle numbers to carry; the whole module when absent. */
  only?: number[];
  /** Heading suffix for split modules, e.g. "уроки 1–6" / "lessons 1–6". */
  part?: [string, string];
  title: [string, string];
  minutes: number;
  hook: [string, string];
}

const MODULE_LESSON: Record<string, LessonSpec> = {
  A: {
    id: 'marketing.fundamentals',
    module: 'A',
    only: [1, 2, 3, 4, 5, 6],
    part: ['уроки 1–6', 'lessons 1–6'],
    title: ['Фундамент: категория, покупатель, каналы', 'The foundation: category, buyer, channels'],
    minutes: 15,
    hook: [
      'Вы выпустили хороший продукт, а рынок сравнивает его с чужой категорией и отвечает «дорого». Этот урок — о том, как занять рамку, в которой вы сильны, и о семи принципах, из которых собирается вся дальнейшая машина маркетинга.',
      'You shipped a good product, and the market compares it to someone else\'s category and answers "too expensive". This lesson is about taking the frame in which you are strong, and about the seven principles that the whole marketing machine is built from.',
    ],
  },
  B: {
    id: 'marketing.vaccine',
    module: 'A',
    only: [7],
    part: ['урок 7', 'lesson 7'],
    title: ['Вакцина: маркетинг на данных о покупателях', 'A vaccine: marketing on buyer data'],
    minutes: 8,
    hook: [
      'Интернет полон уверенных советов про контент-маркетинг, которые звучат как наука и работают как вред: прогревайте, продавайте через пользу, копите лояльность. Этот урок — прививка против них. Опираемся на данные о покупателях, которые институт Ehrenberg-Bass собирал десятилетиями, и разбираемся, почему рост устроен иначе, чем обещают курсы.',
      'The internet is full of confident content-marketing advice that sounds like science and works like harm: warm your audience up, sell through value, build loyalty. This lesson is a vaccine against it. We rely on buyer data that the Ehrenberg-Bass institute has collected for decades, and work out why growth works differently from what the courses promise.',
    ],
  },
  C: {
    id: 'marketing.content',
    module: 'B',
    title: ['Контент как актив', 'Content as an asset'],
    minutes: 14,
    hook: [
      'Команда публикует трое суток перед дедлайном, а через месяц непонятно, сработало ли. Этот урок — о контенте как об активе: технические материалы, которые работают годами, и машина «один инсайт — десять кусков», в которой [[marketing.geo|GEO]] уже меняет правила поиска.',
      'The team publishes three days before the deadline, and a month later nobody knows whether it worked. This lesson is about content as an asset: technical materials that work for years, and the "one insight, ten pieces" machine, in which [[marketing.geo|GEO]] is already changing the rules of search.',
    ],
  },
  D: {
    id: 'marketing.platforms',
    module: 'C',
    title: ['Платформы: где собирается профессия', 'Platforms: where the profession gathers'],
    minutes: 12,
    hook: [
      'Один и тот же пост рассылается в пять соцсетей, и нигде не работает. Этот урок — о том, что каждая площадка, от LinkedIn до профессиональных каталогов, — отдельная страна со своими законами, и о том, какие законы где действуют.',
      'The same post is blasted to five social networks, and it works nowhere. This lesson is that every platform, from LinkedIn to professional catalogues, is a separate country with its own laws — and about which laws apply where.',
    ],
  },
  E: {
    id: 'marketing.video',
    module: 'D',
    title: ['Видео: демонстрации, доклады, подкасты', 'Video: demos, talks, podcasts'],
    minutes: 10,
    hook: [
      'Доклад прозвучал, зал аплодировал — и через неделю о нём никто не помнит. Этот урок — о видео как о вечном контенте: демонстрациях, которые продают сами, докладах, коротких роликах и подкастах.',
      'The talk was delivered, the hall applauded — and a week later nobody remembers it. This lesson is about video as eternal content: demos that sell by themselves, talks, short clips and podcasts.',
    ],
  },
  F: {
    id: 'marketing.community',
    module: 'E',
    title: ['Open source и сообщество', 'Open source and community'],
    minutes: 14,
    hook: [
      'Продукт открыт год, звёзд немного, сделок ноль, и вопрос «зачем нам это» повисает в воздухе. Этот урок — об открытом коде как о маркетинге с горизонтом в годы: работа [[marketing.devrel|DevRel]], легитимность CNCF, ритуалы и адвокаты.',
      'The product has been open for a year, stars are few, deals are zero, and the question "what is this for" hangs in the air. This lesson is about open code as marketing with a horizon of years: the work of [[marketing.devrel|DevRel]], CNCF legitimacy, rituals and advocates.',
    ],
  },
  G: {
    id: 'marketing.events',
    module: 'F',
    title: ['События и воронки', 'Events and funnels'],
    minutes: 12,
    hook: [
      'Конференция прожита: стенд разобран, визитки собраны — и ни одного разговора, который продолжился бы. Этот урок — о событиях, которые оставляют активы: вебинарах, воркшопах, кулуарах и единой [[marketing.growth-loop|петле роста]], которую вы увидите на схеме ниже.',
      'The conference is over: the booth is packed up, business cards collected — and not a single conversation continues. This lesson is about events that leave assets behind: webinars, workshops, hallway tracks and the single [[marketing.growth-loop|growth loop]] you will see in the diagram below.',
    ],
  },
  H: {
    id: 'marketing.analytics',
    module: 'G',
    title: ['Аналитика без самообмана', 'Analytics without self-deception'],
    minutes: 10,
    hook: [
      'Бюджет отчитан по показам, а вопрос «что сработало» остаётся без ответа. Этот урок — об измерении без самообмана: [[marketing.leading-metric|опережающих метриках]], честной атрибуции и стеке инструментов, собранном по потребности.',
      'The budget is reported in impressions, and the question "what worked" stays unanswered. This lesson is about measurement without self-deception: [[marketing.leading-metric|leading metrics]], honest attribution and a tool stack assembled for actual needs.',
    ],
  },
  I: {
    id: 'marketing.regions',
    module: 'H',
    title: ['Регионы: США, DACH, Азия', 'Regions: the US, DACH, Asia'],
    minutes: 12,
    hook: [
      'Одна и та же кампания в США, Германии и Японии даёт три разных результата — вплоть до обратного. Этот урок — о том, почему рынки покупают по-разному, и симулятор ниже показывает, как одинаковые усилия складываются в разную выручку.',
      'The same campaign in the US, Germany and Japan gives three different results — sometimes in reverse. This lesson is about why markets buy differently, and the simulator below shows how identical efforts add up to different revenue.',
    ],
  },
  J: {
    id: 'marketing.cases',
    module: 'I',
    title: ['Разборы: что сделали HashiCorp, GitLab и другие', 'Case studies: what HashiCorp, GitLab and others did'],
    minutes: 12,
    hook: [
      'Хочется спросить: а кто-нибудь уже делал так? Этот урок — пять разборов: HashiCorp, GitLab, Grafana, MongoDB и Elastic, Vercel и Supabase. Что именно они сделали, чем это им обошлось и что из этого перенять.',
      'You want to ask: has anyone actually done this? This lesson is five case studies: HashiCorp, GitLab, Grafana, MongoDB and Elastic, Vercel and Supabase. What exactly they did, what it cost them and what to borrow.',
    ],
  },
};

function moduleBody(items: { n: number; title: string; body: string; today: string }[]): string {
  return items.map((it) => `**${it.n}. ${it.title}** ${it.body}\n\n> Сегодня: ${it.today}`).join('\n\n');
}

function moduleBodyEn(items: { n: number; title: string; body: string; today: string }[]): string {
  return items.map((it) => `**${it.n}. ${it.title}** ${it.body}\n\n> Today: ${it.today}`).join('\n\n');
}

const INTRODUCES: Record<string, string[]> = {
  A: ['marketing.category', 'marketing.icp', 'marketing.messaging', 'marketing.growth-loop'],
  B: ['marketing.reach'],
  C: ['marketing.geo'],
  D: [],
  E: [],
  F: ['marketing.devrel'],
  G: [],
  H: ['marketing.leading-metric'],
  I: [],
  J: [],
};

// Concepts used again after their lesson are listed per lesson; the events
// lesson reuses the growth loop introduced in the fundamentals lesson.
const USES: Record<string, string[]> = {
  G: ['marketing.growth-loop'],
};

const REFORGE = 'https://www.reforge.com/';

const SOURCES: Record<string, { en: { title: string; url: string }[]; ru: { title: string; url: string }[] }> = {
  A: {
    en: [
      { title: 'April Dunford — Obviously Awesome', url: 'https://www.aprildunford.com/' },
      { title: 'Play Bigger', url: 'https://www.playbigger.com/' },
      { title: 'Reforge — Marketing Strategy', url: REFORGE },
      { title: 'Reforge — Mastering Product-Led Growth', url: REFORGE },
    ],
    ru: [
      { title: 'April Dunford — Obviously Awesome', url: 'https://www.aprildunford.com/' },
      { title: 'Play Bigger', url: 'https://www.playbigger.com/' },
      { title: 'Reforge — Marketing Strategy', url: REFORGE },
      { title: 'Reforge — Mastering Product-Led Growth', url: REFORGE },
    ],
  },
  B: {
    en: [{ title: 'Byron Sharp — How Brands Grow (Ehrenberg-Bass Institute)', url: 'https://www.howbrandsgrow.com/' }],
    ru: [{ title: 'Byron Sharp — How Brands Grow (Ehrenberg-Bass Institute)', url: 'https://www.howbrandsgrow.com/' }],
  },
  C: {
    en: [{ title: 'Reforge — Mastering SEO/AEO (Ethan Smith)', url: REFORGE }],
    ru: [{ title: 'Reforge — Mastering SEO/AEO (Ethan Smith)', url: REFORGE }],
  },
  D: {
    en: [{ title: 'Jonah Berger — Contagious', url: 'https://jonahberger.com/' }],
    ru: [{ title: 'Jonah Berger — Contagious', url: 'https://jonahberger.com/' }],
  },
  E: {
    en: [{ title: 'YouTube Creators', url: 'https://www.youtube.com/creators/' }],
    ru: [{ title: 'YouTube Creators', url: 'https://www.youtube.com/creators/' }],
  },
  F: {
    en: [
      { title: 'Nadia Eghbal — Working in Public (Stripe Press)', url: 'https://press.stripe.com/working-in-public' },
      { title: 'Cloud Native Computing Foundation', url: 'https://www.cncf.io/' },
    ],
    ru: [
      { title: 'Nadia Eghbal — Working in Public (Stripe Press)', url: 'https://press.stripe.com/working-in-public' },
      { title: 'Cloud Native Computing Foundation', url: 'https://www.cncf.io/' },
    ],
  },
  G: {
    en: [{ title: 'KubeCon + CloudNativeCon', url: 'https://www.cncf.io/kubecon-cloudnativecon-events/' }],
    ru: [{ title: 'KubeCon + CloudNativeCon', url: 'https://www.cncf.io/kubecon-cloudnativecon-events/' }],
  },
  H: {
    en: [{ title: 'Reforge — Marketing Attribution', url: REFORGE }],
    ru: [{ title: 'Reforge — Marketing Attribution', url: REFORGE }],
  },
  I: {
    en: [{ title: 'Trade.gov — Country Commercial Guides', url: 'https://www.trade.gov/country-commercial-guides' }],
    ru: [{ title: 'Trade.gov — Country Commercial Guides', url: 'https://www.trade.gov/country-commercial-guides' }],
  },
  J: {
    en: [
      { title: 'HashiCorp', url: 'https://www.hashicorp.com/' },
      { title: 'GitLab', url: 'https://about.gitlab.com/' },
      { title: 'Grafana Labs', url: 'https://grafana.com/' },
      { title: 'MongoDB', url: 'https://www.mongodb.com/' },
      { title: 'Elastic', url: 'https://www.elastic.co/' },
      { title: 'Vercel', url: 'https://vercel.com/' },
      { title: 'Supabase', url: 'https://supabase.com/' },
    ],
    ru: [
      { title: 'HashiCorp', url: 'https://www.hashicorp.com/' },
      { title: 'GitLab', url: 'https://about.gitlab.com/' },
      { title: 'Grafana Labs', url: 'https://grafana.com/' },
      { title: 'MongoDB', url: 'https://www.mongodb.com/' },
      { title: 'Elastic', url: 'https://www.elastic.co/' },
      { title: 'Vercel', url: 'https://vercel.com/' },
      { title: 'Supabase', url: 'https://supabase.com/' },
    ],
  },
};

export const MARKETING_CONCEPTS: Concept[] = [
  {
    id: 'marketing.category',
    term: bi('категория', 'category'),
    short: bi(
      'Рынок, по правилам которого вас сравнивают; выбирать категорию важнее, чем перечислять функции.',
      'The market whose rules you are compared by; choosing the category matters more than listing features.',
    ),
    introducedIn: 'marketing.fundamentals',
    scan: false,
  },
  {
    id: 'marketing.icp',
    term: bi('ICP', 'ICP'),
    short: bi(
      'Портрет компании, которой продукт нужен больше всего; три признака, отсекающие не-покупателя, важнее длинного списка достоинств.',
      'The portrait of the company that needs the product most; three traits that cut out non-buyers matter more than a long list of merits.',
    ),
    introducedIn: 'marketing.fundamentals',
    scan: false,
  },
  {
    id: 'marketing.messaging',
    term: bi('месседж', 'the message'),
    short: bi(
      'Фраза о продукте, собранная из слов самих покупателей, а не из слов вендора.',
      'The phrase about the product, assembled from the buyers\' own words rather than the vendor\'s.',
    ),
    introducedIn: 'marketing.fundamentals',
    scan: false,
  },
  {
    id: 'marketing.growth-loop',
    term: bi('петля роста', 'growth loop'),
    short: bi(
      'Канал, который подпитывает сам себя: каждый круг оставляет активы, которые работают в следующем круге.',
      'A channel that feeds itself: every pass leaves assets that work in the next pass.',
    ),
    introducedIn: 'marketing.fundamentals',
    scan: false,
  },
  {
    id: 'marketing.reach',
    term: bi('охват', 'reach'),
    short: bi(
      'Количество покупателей, которые легко вспоминают продукт и легко его покупают; охват растёт быстрее лояльности.',
      'The number of buyers who easily recall the product and easily buy it; reach grows faster than loyalty.',
    ),
    introducedIn: 'marketing.vaccine',
    scan: false,
  },
  {
    id: 'marketing.geo',
    term: bi('GEO', 'GEO'),
    short: bi(
      'Оптимизация материалов под ответы ИИ-ассистентов опирается на структуру, сравнения и цифры, которые можно процитировать.',
      'Optimising materials for AI-assistant answers: structure, comparisons and numbers that can be quoted.',
    ),
    introducedIn: 'marketing.content',
    scan: false,
  },
  {
    id: 'marketing.devrel',
    term: bi('DevRel', 'DevRel'),
    short: bi(
      'Связь компании с профессией через доклады, ответы на вопросы и наставничество; продаёт доверие, а не продукт.',
      'The company\'s relationship with the profession through talks, answers and mentorship; it sells trust, not the product.',
    ),
    introducedIn: 'marketing.community',
    scan: false,
  },
  {
    id: 'marketing.leading-metric',
    term: bi('опережающая метрика', 'leading metric'),
    short: bi(
      'Признак будущих продаж, который виден уже сейчас — новые знакомства с покупателями и повторные визиты в документацию.',
      'A sign of future sales visible now: new meetings with buyers, repeat visits to the documentation.',
    ),
    introducedIn: 'marketing.analytics',
    scan: false,
  },
];

export const MARKETING_QUIZ: QuizItem[] = [
  {
    id: 'marketing.q.category',
    kind: 'mcq',
    concepts: ['marketing.category'],
    prompt: bi(
      'Конкурент предлагает ту же функцию в два раза дешевле. О чём разговаривать с рынком в первую очередь?',
      'A competitor offers the same feature twice as cheap. What should the conversation with the market be about first?',
    ),
    options: [
      { id: 'category', text: bi('О категории и о контексте, в котором продукт выигрывает', 'About the category and the context in which the product wins'), correct: true, why: bi('Покупатель сравнивает вас с рамкой в своей голове; поменяйте рамку, и функция перестанет быть единственным критерием.', 'The buyer compares you to the frame in their head; change the frame and the feature stops being the only criterion.') },
      { id: 'features', text: bi('О списке функций, где вы впереди', 'About the list of features where you are ahead'), why: bi('Список функций копируют за квартал, а рамку сравнения задаёт тот, кто описал категорию первым.', 'A feature list is copied within a quarter, and the frame of comparison is set by whoever described the category first.') },
      { id: 'price', text: bi('О цене и скидках для первых клиентов', 'About price and discounts for early customers'), why: bi('На чужой категории ценовой разговор проигрывается, потому что дешевле всегда найдётся кто-то другой.', 'A price conversation on someone else\'s category is lost, because there is always someone cheaper.') },
    ],
  },
  {
    id: 'marketing.q.icp',
    kind: 'mcq',
    concepts: ['marketing.icp'],
    prompt: bi(
      'Какой портрет покупателя реально экономит бюджет?',
      'Which buyer portrait actually saves budget?',
    ),
    options: [
      { id: 'cuts', text: bi('Тот, что описан тремя признаками, отсекающими не-покупателя до разговора', 'One described by three traits that cut out non-buyers before any conversation'), correct: true, why: bi('Каждая компания вне портрета съедает касания и не покупает; отсечение видно в деньгах уже через квартал.', 'Every company outside the portrait spends touches and never buys; the savings from cutting them show in money within a quarter.') },
      { id: 'all-leads', text: bi('Тот, что описан всеми, кто когда-либо интересовался продуктом', 'One described by everyone who ever showed interest in the product'), why: bi('Интересовались — не значит покупали; портрет из лидов любого качества размывает и каналы, и метрики.', 'Interested does not mean bought; a portrait built from leads of any quality blurs both channels and metrics.') },
      { id: 'logos', text: bi('Тот, что описан самыми крупными логотипами отрасли', 'One described by the biggest logos in the industry'), why: bi('Крупный логотип — это размер сделки, а не пригодность; гигант без нужной практики купит не скорее компании с болью.', 'A big logo is deal size, not fit; a giant without the right practice buys no sooner than a company in pain.') },
    ],
  },
  {
    id: 'marketing.q.sharp',
    kind: 'mcq',
    concepts: ['marketing.reach'],
    prompt: bi(
      'По данным Ehrenberg-Bass, откуда берётся рост категории?',
      'According to Ehrenberg-Bass data, where does category growth come from?',
    ),
    options: [
      { id: 'reach', text: bi('С охвата — с покупателей, которые легко вспоминают продукт и легко его покупают', 'From reach — from buyers who easily recall the product and easily buy it'), correct: true, why: bi('Покупатели «лёгкие»: они мало думают о категории и переключаются быстро, поэтому рынок растёт за счёт новых покупателей, а не глубины у старых.', 'Buyers are "light": they think little about the category and switch fast, so the market grows through new buyers, not depth with old ones.') },
      { id: 'loyalty', text: bi('С лояльности, то есть с глубины отношений с существующими клиентами', 'From loyalty, that is from the depth of relationships with existing customers'), why: bi('Доля лояльных в категории почти не меняется; удвоить её не выходит даже у лидеров рынка.', 'The share of loyal customers in a category barely changes; even market leaders cannot double it.') },
      { id: 'frequency', text: bi('С частоты покупок самыми активными клиентами', 'From how often the most active customers buy'), why: bi('Самые активные клиенты уже купили почти всё, что могут; потолок роста лежит за пределами собственной базы.', 'The most active customers have already bought almost everything they can; the growth ceiling lies outside your own base.') },
    ],
  },
  {
    id: 'marketing.q.geo',
    kind: 'multi',
    concepts: ['marketing.geo'],
    prompt: bi(
      'Что помогает материалу попадать в ответы ИИ-ассистентов?',
      'What helps a material get into AI-assistant answers?',
    ),
    options: [
      { id: 'howto', text: bi('Технические how-to с проверяемыми цифрами', 'Technical how-tos with checkable numbers'), correct: true, why: bi('Ассистент цитирует то, что отвечает на вопрос и легко проверяется; how-to с цифрами цитируют чаще всего.', 'An assistant quotes what answers the question and is easy to check; how-tos with numbers get quoted most.') },
      { id: 'comparisons', text: bi('Честные сравнения и таблицы', 'Honest comparisons and tables'), correct: true, why: bi('Сравнения отвечают на вопрос «что выбрать», а ассистент ищет такой ответ.', 'Comparisons answer the question "what to choose", which is the answer an assistant looks for.') },
      { id: 'gated', text: bi('Закрытые материалы за регистрацией', 'Gated materials behind a sign-up'), why: bi('Закрытый контент для ассистента не существует: он его не видит и процитировать не может.', 'Gated content does not exist for the assistant: it cannot see it and cannot quote it.') },
      { id: 'news', text: bi('Короткие новости о релизах', 'Short release news'), why: bi('Новость не отвечает на вопрос покупателя, поэтому в ответы почти не попадает.', 'News does not answer the buyer\'s question, so it barely ever makes it into answers.') },
    ],
  },
  {
    id: 'marketing.q.machine',
    kind: 'order',
    concepts: ['marketing.growth-loop'],
    prompt: bi(
      'Расставьте этапы машины «один инсайт — десять кусков» в том порядке, в котором она работает.',
      'Put the stages of the "one insight, ten pieces" machine in the order it actually works.',
    ),
    steps: [
      { id: 'insight', text: bi('Инсайт из практики записан и проверен цифрами', 'An insight from practice is written down and checked with numbers'), why: bi('Машина начинается с наблюдения, а не с темы из календаря.', 'The machine starts with an observation, not a topic from the calendar.') },
      { id: 'deep', text: bi('Из инсайта собран большой материал', 'A big material is built from the insight'), why: bi('Большой материал несёт инсайт целиком и служит сырьём для всего остального.', 'The big material carries the insight whole and serves as raw material for everything else.') },
      { id: 'pieces', text: bi('Большой материал нарезан на десять кусков', 'The big material is cut into ten pieces'), why: bi('Куски по форматам дают десять каналов без десяти тем.', 'Pieces in different formats give ten channels without ten topics.') },
      { id: 'publish', text: bi('Куски опубликованы на платформах', 'The pieces are published on the platforms'), why: bi('Опубликованный материал начинает распространяться, а распространение важнее производства.', 'A published material starts to spread, and distribution matters more than production.') },
      { id: 'questions', text: bi('Вопросы аудитории собраны и разобраны', 'The audience\'s questions are collected and worked through'), why: bi('Ответы и возражения становятся сырьём следующего круга.', 'Answers and objections become the raw material of the next pass.') },
      { id: 'next', text: bi('Новый инсайт поставлен в очередь', 'A new insight is queued'), why: bi('Петля замкнулась, потому что каждый круг подпитывает следующий.', 'The loop is closed, because every pass feeds the next one.') },
    ],
  },
  {
    id: 'marketing.q.platform',
    kind: 'mcq',
    concepts: [],
    prompt: bi(
      'Где общаться с профессией в LinkedIn, чтобы вас читали?',
      'Where should you talk to the profession on LinkedIn so that people read you?',
    ),
    options: [
      { id: 'people', text: bi('В личных профилях инженеров, которые строят продукт', 'In the personal profiles of the engineers who build the product'), correct: true, why: bi('Люди читают людей; личный профиль собирает в разы больше внимания, чем корпоративная страница.', 'People read people; a personal profile gathers many times more attention than the company page.') },
      { id: 'corp', text: bi('В корпоративной ленте от имени компании', 'In the corporate feed under the company\'s name'), why: bi('Корпоративная страница остаётся витриной, но машина — это люди, и лента компании машиной не бывает.', 'The company page stays a showcase, but the machine is people, and a company feed never is the machine.') },
      { id: 'email', text: bi('В платных рассылках по базе контактов', 'In paid mailings to a contact base'), why: bi('Рассылка — это касание, а не место, где профессия собирается; в LinkedIn она собирается в лентах людей.', 'A mailing is a touch, not a place where the profession gathers; on LinkedIn it gathers in people\'s feeds.') },
    ],
  },
  {
    id: 'marketing.q.devrel',
    kind: 'mcq',
    concepts: ['marketing.devrel'],
    prompt: bi(
      'Как понять, что DevRel начали превращать в отдел продаж?',
      'How do you tell that DevRel is being turned into a sales department?',
    ),
    options: [
      { id: 'deals', text: bi('Его стали измерять числом сделок и конверсией в покупку', 'It started being measured by the number of deals and conversion to purchase'), correct: true, why: bi('Метрика сделок заставляет продавать на каждой встрече, а доверие, накопленное месяцами, обнуляется с первой продажной фразы.', 'A deals metric makes every meeting sell, and the trust accumulated over months is reset by the first sales line.') },
      { id: 'healthy', text: bi('Его стали измерять вкладом в сообщество и репутацией', 'It started being measured by contribution to the community and reputation'), why: bi('Это здоровые метрики DevRel: вклад, вовлечённость и репутация, а не конверсия в покупку.', 'These are healthy DevRel metrics: contribution, engagement and reputation, not conversion to purchase.') },
      { id: 'talks', text: bi('Его стали отправлять на конференции с докладами', 'It started being sent to conferences with talks'), why: bi('Доклады — основная работа DevRel; ломает его не выступление, а измерение, которое превращает встречу в питч.', 'Talks are DevRel\'s core work; what breaks it is not the stage but the measurement that turns a meeting into a pitch.') },
    ],
  },
  {
    id: 'marketing.q.regions',
    kind: 'mcq',
    concepts: [],
    prompt: bi(
      'Что означает локализация для японского рынка?',
      'What does localisation mean for the Japanese market?',
    ),
    options: [
      { id: 'adapt', text: bi('Адаптация материалов и продукта под местную практику, включая примеры, нормы, платформы и партнёра соответствующего профиля', 'Adapting the materials and the product to local practice, including examples, norms, platforms and a partner of the right profile'), correct: true, why: bi('Переведённый текст сигнализирует, что вам здесь не важно; локализация — про соответствие местной практике, а не про словарь.', 'Translated text signals that you do not care; localisation is about matching local practice, not about the dictionary.') },
      { id: 'translate', text: bi('Перевод сайта и документации на японский язык', 'Translating the site and the documentation into Japanese'), why: bi('Перевод — часть работы, но без местных примеров, норм и партнёра он рынок не открывает.', 'Translation is part of the work, but without local examples, norms and a partner it does not open the market.') },
      { id: 'office', text: bi('Открытие офиса в Токио', 'Opening an office in Tokyo'), why: bi('Офис — организационное решение; локализация начинается с того, что покупатель видит в материалах и продукте.', 'An office is an organisational decision; localisation starts with what the buyer sees in the materials and the product.') },
    ],
  },
  {
    id: 'marketing.q.attribution',
    kind: 'mcq',
    concepts: ['marketing.leading-metric'],
    prompt: bi(
      'Почему модель последнего касания врёт про маркетинг инфраструктурного продукта?',
      'Why does the last-touch attribution model lie about infrastructure-product marketing?',
    ),
    options: [
      { id: 'touches', text: bi('Покупатель касается вас десятки раз за полгода, и последний клик забирает заслугу всех остальных каналов', 'A buyer touches you dozens of times over half a year, and the last click takes the credit of all the other channels'), correct: true, why: bi('Сделка выигрывается серией касаний — статьёй, докладом, ответом на вопросы; last-click приписывает всё одному последнему касанию.', 'A deal is won by a series of touches — an article, a talk, an answer; last-click attributes everything to one last touch.') },
      { id: 'count', text: bi('Потому что клики невозможно посчитать', 'Because clicks cannot be counted'), why: bi('Клики считаются легко; враньё не в подсчёте, а в приписывании всей сделки одному касанию.', 'Clicks are easy to count; the lie is not in the counting but in crediting the whole deal to one touch.') },
      { id: 'memory', text: bi('Потому что покупатель никогда не помнит, где о вас узнал', 'Because the buyer never remembers where they heard of you'), why: bi('Память покупателя действительно кривая, но проблема модели в том, что она строится на кривом воспоминании вместо полного списка касаний.', 'Buyer memory is indeed skewed, but the model\'s problem is that it builds on that skewed memory instead of the full list of touches.') },
    ],
  },
];

// The English half of the school: a faithful full translation of every item,
// module by module, so both language slots carry the same material.
export const MARKETING_SCHOOL_EN: SchoolModule[] = [
  {
    letter: 'A',
    title: 'The foundation',
    items: [
      {
        n: 1,
        title: 'The category beats the feature list.',
        body: 'The buyer compares you not to your list of features but to the market that already exists in their head. If the category is described vaguely, you are measured by someone else\'s criteria, and the loss gets blamed on your price. April Dunford\'s book "Obviously Awesome" shows that positioning is the choice of a frame in which you are strong, not an enumeration of capabilities, and "Play Bigger" adds: leaders do not fit into a category, they create one.',
        today: 'Write down what the buyer compares you to today and name one competitor for whom that frame is better. Formulate your category in one phrase made of the client\'s own words.'
      },
      {
        n: 2,
        title: 'ICP: three traits that cut out the non-buyer.',
        body: 'The portrait of the ideal buyer is useful not for what it includes but for what it cuts out. Three traits by which a company clearly does not fit save half the budget: such companies do not buy no matter how warmly you treat them. Describe the portrait through traits visible before any conversation: company size, stack, practice maturity, region.',
        today: 'From your last three deals, write down the traits the buyers had in common, and three traits by which you yourself turn a company away.'
      },
      {
        n: 3,
        title: 'The message in their words, not yours.',
        body: 'The buyer does not memorise the vendor\'s words about its own product: they are about you, not about them. Write down how clients describe the problem and the choice before you hint anything, and use their formulations on pages, in talks and in letters. This is not manipulation but translation: you speak a language the buyer recognises at once.',
        today: 'Copy three phrases from your latest client emails or reviews and use them to replace one paragraph on the home page.'
      },
      {
        n: 4,
        title: 'Brand, demand and capture are three different jobs.',
        body: 'These are three different tasks with different metrics, and mixing them means not knowing what exactly broke. Brand answers "people know and remember you", demand — "mature buyers come to you", capture — "those already choosing are brought to a request". In the Reforge Marketing Strategy program each job has its own channel, budget and success metric.',
        today: 'Colour your current channels with three colours — brand, demand, capture — and find a channel that lacks a metric of its own.'
      },
      {
        n: 5,
        title: 'A funnel led by community and product.',
        body: 'For an infrastructure product the short advertising funnel does not work: the buyer reads, tries and asks colleagues for months before writing to you. In the Reforge Mastering PLG program the funnel is longer, but every step stays with you as an asset: content, open code and documentation keep working when the advertising budget runs out.',
        today: 'Write down the path of one real user from the first touch to a request and mark which steps of that path you control yourself.'
      },
      {
        n: 6,
        title: 'Distribution beats production.',
        body: 'A good material without distribution reaches nobody, while a mediocre one delivered to the right audience has already worked. So the decision "where to publish and who carries it further" is made before writing, not after: every channel has its format, and every format needs its own owner and its own date.',
        today: 'Pick one finished material and assign it three distribution channels with concrete dates.'
      },
      {
        n: 7,
        title: 'A vaccine: marketing on buyer data.',
        body: 'The research of the Ehrenberg-Bass institute, collected by Byron Sharp in "How Brands Grow", says something uncomfortable: markets grow through reach, not loyalty. Buyers in a category are "light": they think little about it and switch easily, so the companies that grow are easy to buy (physical availability) and easy to remember (mental availability). This is a vaccine against infobusiness content marketing: the advice to "warm your audience up", "sell through value" and "build loyalty" sounds smart and works against growth.',
        today: 'Write down two numbers: how many new buyers came last quarter and how many minutes pass from the first visit to the first result. Close one of the two gaps.'
      }
    ]
  },
  {
    letter: 'B',
    title: 'Content as an asset',
    items: [
      {
        n: 8,
        title: 'Technical content: how-tos and benchmarks.',
        body: 'An engineer reads what helps them do the job: how to assemble, how to measure, how to compare. A post about the 2.0 release passes by, while a guide "how to raise a cluster in twenty minutes and what will slow it down" lives for years and brings the people who buy. An honest benchmark, weak spots included, gets quoted more than beautiful numbers.',
        today: 'Write down one task your product does faster than the alternative and write a step-by-step recipe with numbers.'
      },
      {
        n: 9,
        title: 'SEO plus GEO: answering questions.',
        body: 'Search stays the first place an engineer looks for a solution, but more and more often the answer comes not as a list of links but from an AI assistant. Optimising for answers (GEO) in the Reforge Mastering SEO/AEO program by Ethan Smith rests on the same things: clear structure, comparisons and numbers that can be quoted. If an assistant retells the category without you, you are not on the buyer\'s short list.',
        today: 'Ask any AI assistant three questions about your category and write down what is missing from the answer that you could provide.'
      },
      {
        n: 10,
        title: 'Comparison pages catch the moment of choice.',
        body: 'The query "X vs Y" is the hottest moment of the funnel: the person is already buying and only deciding what. A page of honest comparison, with a table where the competitor is sometimes stronger, catches that moment and accumulates trust. Dodging comparison is pointless: the buyer will compare anyway, only without you.',
        today: 'Check which "us versus …" pairs people search you by and write one honest comparison page, including the cases where choosing you is a mistake.'
      },
      {
        n: 11,
        title: 'Documentation is marketing.',
        body: 'For an infrastructure product the documentation is the main storefront: it is read before the purchase, the product is tried through it, and by it the buyer decides whether the product will survive production. A quick-start page that works the first time sells better than a landing page; a page with an error pushes away harder than any competitor. This is about attitude: write documentation for the reader, not to tick a box in the release notes.',
        today: 'Walk through your product\'s quick start on a clean machine and write down every point where you had to guess.'
      },
      {
        n: 12,
        title: 'One insight, ten pieces.',
        body: 'Regularity built on a new topic every day kills quality: demanding a fresh topic daily means getting water. Build the machine the other way round: once a week one real insight from practice, from it a big material, from the big one — a post, a short video, slides, an answer in the community and a paragraph in the newsletter. Ten pieces from one insight is ten channels without ten topics.',
        today: 'Pick an insight from the past week and lay out ten pieces across the channels you actually run.'
      },
      {
        n: 13,
        title: 'An opinion that cannot be copied.',
        body: 'The only content that cannot be stolen is an opinion nobody else holds. It is built over years from practice: measurements, failures, controversial conclusions. The criterion is simple: if the text can be published under someone else\'s logo untouched, it is a content plan, not a thought. Start early, publish rarely and only when there is something to say.',
        today: 'Write down one observation from practice that you are ready to argue about in public, and check it with numbers.'
      }
    ]
  },
  {
    letter: 'C',
    title: 'Platforms',
    items: [
      {
        n: 14,
        title: 'LinkedIn: people, not the company page.',
        body: 'People read people: the personal profile of an engineer or a founder gathers many times more attention than the company page. So run the personal profiles of the people who actually build the product — in the first person, about the work, with the author\'s name on every material. The company page stays a showcase, but the machine is people.',
        today: 'Pick two engineers ready to write and help them set up their profiles: a photo, a role, three topics.'
      },
      {
        n: 15,
        title: 'X/Twitter: the place of professional opinion.',
        body: 'In the IT industry X remains the platform where the profession\'s opinion is formed: debates, releases and acquaintances that later turn into deals. The format is short and fast: observations from practice, numbers, screenshots and substantive replies in other people\'s threads work. Direct advertising passes the feed by.',
        today: 'Find five active discussions in your category and leave one substantive reply a day this week.'
      },
      {
        n: 16,
        title: 'YouTube: video that gets searched.',
        body: 'Video is the longest-lived format: a five-year-old clip keeps bringing viewers, while an unrecorded talk disappears on the day it is given. YouTube works as search: people find the video when they look for how to solve a task. Sound quality matters more than the picture, because bad sound closes the video in the first seconds.',
        today: 'Pick one finished talk or webinar and publish the recording under a question-shaped title with good sound.'
      },
      {
        n: 17,
        title: 'Reddit and Hacker News: honesty instead of ads.',
        body: 'These are the most suspicious places on the internet: marketing is disliked there and honesty is valued. One rule: arrive as a participant, not a vendor — answer questions for months without a single link to yourself, and only then will your materials start being accepted. A post "we made X, here is how it works" is respected; a press-release post is torn apart.',
        today: 'Join three communities of your category and give three useful answers without a single link to your product.'
      },
      {
        n: 18,
        title: 'Developer platforms, awesome lists and CNCF.',
        body: 'The industry has places where engineers go for tools: awesome lists, CNCF catalogues, podcasts and newsletters of the profession. Getting in is external recognition that cannot be bought with ads. Jonah Berger\'s book "Contagious" explains why it works: people care about sharing what makes them look more competent in their colleagues\' eyes.',
        today: 'Find where the tool lists of your category are kept, check whether you are there, and work out the conditions for getting in.'
      }
    ]
  },
  {
    letter: 'D',
    title: 'Video',
    items: [
      {
        n: 19,
        title: 'The demo decides.',
        body: 'An engineer does not trust slides: they want to see how the product works, with delays, errors and the real interface. A five-minute demo on a real task answers more questions than an hour-long presentation. Do not cut the failed moments: how a product reacts to an error sells better than the perfect scenario.',
        today: 'Record a five-minute demo of one real task without editing and narrate what happens on the screen.'
      },
      {
        n: 20,
        title: 'Talks are eternal content.',
        body: 'One prepared talk is a stage slot, a video recording, an article, a set of short clips and slides for half a year ahead. Conferences record the talks; your job is to live until the publication and give the material a second life on your own channels. The talk\'s topic must answer the audience\'s question, not narrate the product.',
        today: 'Write down the three questions people ask you most often and pick one of them as a talk topic.'
      },
      {
        n: 21,
        title: 'Short vertical clips.',
        body: 'Short clips are the entry ticket for those who will never watch an hour-long recording: one thought in thirty seconds, one demo, one conclusion. They are cheap to produce from finished materials and give a disproportionately large reach. One rule: do not retell news, show hands and screen.',
        today: 'Cut one long material into three short clips and publish them in three places.'
      },
      {
        n: 22,
        title: 'A podcast as a channel.',
        body: 'A podcast is the only format where the listener voluntarily spends an hour with you; the trust accumulated over that hour cannot be compared with a banner. Your own podcast is years of regular work, but every episode stays and works like an article. A guest strategy works without your own studio: come as a guest to the podcasts of your category.',
        today: 'Make a list of ten podcasts in your category and pitch three hosts a topic with a guest from your team.'
      }
    ]
  },
  {
    letter: 'E',
    title: 'Open source and community',
    items: [
      {
        n: 23,
        title: 'Open code is marketing with a horizon of years.',
        body: 'Open code removes the buyer\'s main question — "what if you disappear?" — and opens a door into the professional community, where a contact cannot be spoiled with a mailing. But it is an asset with a horizon of quarters and years: the first contributors, the first mentions and the first deals arrive at different times. Whoever expects a result from open code within a month gets disappointed and abandons the work halfway, never reaching the main part.',
        today: 'Write down how many months your open project has been open, name the date by which you evaluate its work, and plan a rhythm of contribution you can keep for years.'
      },
      {
        n: 24,
        title: 'DevRel is not sales.',
        body: 'Developer relations (DevRel) builds trust between the company and the profession: talks, answers in issues, mentorship. Sales arrive by themselves, as a consequence, but measuring DevRel by deals means breaking it: with the first sales line, the trust accumulated over months is reset. DevRel\'s metrics are contribution, engagement and reputation, not conversion to purchase.',
        today: 'Split your DevRel\'s tasks into two columns — where they answer to the profession and where to the business — and remove everything that sells directly from the first column.'
      },
      {
        n: 25,
        title: 'CNCF: legitimacy that cannot be bought.',
        body: 'The CNCF program from sandbox to graduated is an external check that procurement trusts: architecture, security, community maturity. For a small vendor it is a way into the shortlist next to giants without a giant\'s budget. The path is long and open: documentation, transparent governance, real users and patience.',
        today: 'Compare your practice with the CNCF sandbox requirements for your category and name one item to close first.'
      },
      {
        n: 26,
        title: 'Rituals hold the community together.',
        body: 'A community is held not by content but by regular rituals: a weekly call, a monthly release with notes, an annual conference. A ritual is an event with a predictable shape that repeats; people get used to it like a TV series. One living ritual is worth ten one-off campaigns: it creates a place where the profession meets.',
        today: 'Pick one ritual you can repeat for years, set the first date and publicly promise to keep it.'
      },
      {
        n: 27,
        title: 'Involvement in development retains people.',
        body: 'The strongest marketing for an infrastructure product is a user who became a co-author: their fix was accepted, their problem was solved together. An involved developer will not switch to a competitor over a discount: they invested their time and reputation into the product. So good first-contribution tasks, sensible review and fast maintainer reactions are a retention channel, not engineering politeness.',
        today: 'Sort the project\'s open tasks by "can a newcomer take this in one evening" and label three of them as first-contribution tasks.'
      },
      {
        n: 28,
        title: 'Advocates beat advertising.',
        body: 'Nadia Eghbal\'s book "Working in Public" describes how open communities work: they are moved by a small core of active participants, and their work cannot be bought — only earned. An advocate who tells colleagues from their own experience why they chose you persuades better than any banner. Working with advocates is years of honest attitude: close their issues, take their talks, pay them with reputation, not money.',
        today: 'Name your project\'s five most active participants and write one of them a personal thank-you with specifics.'
      },
      {
        n: 29,
        title: 'Contribution is the community\'s currency.',
        body: 'A community answers with the same coin it is fed with: if a company takes and gives nothing back, it stops being noticed. Contribution is measured in engineers\' hours on other people\'s tasks, answers, infrastructure sponsorship and honest work with other people\'s fixes. Every hour of engineering time given to the community unpaid returns as acquaintances that cannot be bought.',
        today: 'Count how many hours last month your team\'s engineers gave to other people\'s projects and the community, and set a regular rhythm.'
      }
    ]
  },
  {
    letter: 'F',
    title: 'Events and funnels',
    items: [
      {
        n: 30,
        title: 'Webinars are a funnel, not an event.',
        body: 'A webinar is three products in one: a live event for those who came, a recording for those who will come later, and a reason to reach out for those who registered but did not show up. Registrants are the warmest leads: they gave you their time and contact. Look at the funnel whole: registrations, attendance, watch-through, questions, requests.',
        today: 'Plan one webinar around the question you get asked most often, and set a date.'
      },
      {
        n: 31,
        title: 'Your own workshops.',
        body: 'A workshop is the format where participants do things by hand under your supervision: they raise a stand, break it, fix it. It is the deepest contact with an audience in one evening: after a workshop people know the product from the inside and remember those who helped. The workshop materials stay and work like a textbook.',
        today: 'Assemble a three-hour "from zero to a working stand" workshop program from the steps you have walked yourself.'
      },
      {
        n: 32,
        title: 'Other people\'s conferences: the hallway track.',
        body: 'At someone else\'s conference the main room is not the room: the talk is a reason to gather around you the people you came to speak with. The value of the day is measured not in applause but in meetings that would not have happened in a calendar. So the conference plan is built before buying tickets: whom we want to see and what to talk about with each.',
        today: 'Pick one conference in the coming months and write down ten people you want to talk to there, with a topic for each.'
      },
      {
        n: 33,
        title: 'A talk beats sponsorship.',
        body: 'A sponsorship package buys visibility for one day, while a talk buys an opinion for years. A person who heard your thought remembers it; a person who saw a logo does not. Money given for sponsorship is almost always better spent on speaker travel, recordings and reusing the materials.',
        today: 'Review the budget of one conference and decide what in it stays with people after day zero.'
      },
      {
        n: 34,
        title: 'One machine instead of scattered channels.',
        body: 'Separate channels do not work: a webinar without content is an empty room, a talk without a recording is a vanished day, a post without a product is noise. A machine is when every effort settles into assets that the next effort uses: a talk becomes a series of posts, a webinar becomes a guide chapter, a question from issues becomes a short clip. The diagram below shows the loop in which every pass feeds the next.',
        today: 'Draw the scheme of one of your campaigns: which assets does it leave behind and who uses them next.'
      }
    ]
  },
  {
    letter: 'G',
    title: 'Analytics',
    items: [
      {
        n: 35,
        title: 'Leading metrics.',
        body: 'Sales show last quarter; they can only be managed through what is happening now. Leading metrics are signs of the future: new meetings with the buyer portrait, repeat visits to the documentation, mentions in professional chats, webinar registrations. Each alone is noisy and decides little, but by them you can see what sales will show in half a year.',
        today: 'Pick three events that by your experience precede a request, and start counting them.'
      },
      {
        n: 36,
        title: 'Attribution is curved — measure direction.',
        body: 'A buyer of an infrastructure product touches you dozens of times over half a year: an article, a talk, an answer in issues, a webinar, a conference conversation. Under the last-touch model money looks as if every other channel is useless. The Reforge Marketing Attribution program is more honest about direction and dynamics: how channels grow and which touches the won deals share, rather than crediting the whole deal to one click.',
        today: 'Write down all the touches before the request for your last three deals — from memory and from correspondence — and look at what they have in common.'
      },
      {
        n: 37,
        title: 'Marketing tools by need.',
        body: 'A tool stack is assembled for a task, not from a catalogue: every new service is data that has to be cleaned and a subscription that keeps ticking. Start with a spreadsheet and email; add a tool when you hit a ceiling without it, not when it looks nice. Replacing a tool is almost always cheaper than a year of supporting an extra one.',
        today: 'List every service the company pays for and mark the ones you have taken no data from in a quarter.'
      },
      {
        n: 38,
        title: 'A calendar is the distribution of promises.',
        body: 'A content calendar is not a publication plan but the distribution of promises: what you promised the audience and when. It holds the rhythm when motivation runs out and keeps one channel from eating all the strength. The rule is simple: the calendar shows who makes each material, and a month of backlog lies ahead.',
        today: 'Assemble a month calendar: one column for insights, one for materials by channel, one for owners.'
      }
    ]
  },
  {
    letter: 'H',
    title: 'Regions',
    items: [
      {
        n: 39,
        title: 'The US: direct, fast, in numbers.',
        body: 'The American market is big, direct and fast: it values a concrete result, a number and the speed of an answer. The buyer wants to understand what the product gives them personally within a quarter. Competitor density is the highest there, so category differentiation is the price of entry, not decoration. References and titles work there like nowhere else.',
        today: 'Look at your home page through an American buyer\'s eyes and check whether a result number stands in the first screen.'
      },
      {
        n: 40,
        title: 'DACH: precision instead of loudness.',
        body: 'Germany, Austria and Switzerland buy cautiously and for the long haul: precision, engineering depth and checkable claims matter. Loud promises push away — better say less and show the code. Data sovereignty and compliance topics in this region are not marketing hooks but conditions of the conversation.',
        today: 'Check one product page for unverifiable claims and replace them with numbers or links to code.'
      },
      {
        n: 41,
        title: 'Asia: localisation is not translation.',
        body: 'In Asia a localised site means not the language but adaptation: examples from local practice, local units and norms, local platforms and cases. Translated text on the Japanese or Korean market signals that you do not care. In many countries of the region no deal happens at all without a local partner.',
        today: 'Pick one Asian market and write down three things in your product and materials that currently do not match local practice.'
      }
    ]
  },
  {
    letter: 'I',
    title: 'Company case studies',
    items: [
      {
        n: 42,
        title: 'HashiCorp: education as a funnel.',
        body: 'HashiCorp built a funnel on open code and education: Terraform was learned from free materials, and the functions for companies were bought. A product engineers already use sells to procurement easier than any pitch. Certifications turned product knowledge into a career asset — and therefore into a reason to choose it.',
        today: 'Write down what in your product can be learned for free and where it is taught.'
      },
      {
        n: 43,
        title: 'GitLab: openness as positioning.',
        body: 'GitLab made everything public: the roadmap, prices, the handbook — even the strategy. This removed the buyer\'s main fear, "what is inside the vendor?", and turned the purchase into a comparison of open data. Openness is positioning available to a company of any size.',
        today: 'Open one closed page of your process — pricing, roadmap, incident review — and check what keeps it closed.'
      },
      {
        n: 44,
        title: 'Grafana: a platform others extend.',
        body: 'Grafana grew through community and plugins: an ecosystem where third-party authors make the product more needed than one company could. The open-core model gave a free foundation to everyone and paid capabilities to companies. A platform extended by others grows faster than a product extended only by the vendor.',
        today: 'Write down what third-party authors could attach to your product and name one extension you could help start.'
      },
      {
        n: 45,
        title: 'MongoDB and Elastic: a licence is part of marketing.',
        body: 'Both companies went through a painful licence transition: open code brought acquaintances, but cloud giants earned on their product without giving back. Changing the licence protected the business but cost the trust of part of the community. Change the licence before the community feels cheated, and with an open conversation about the reasons.',
        today: 'Check what in your licence lets a large player use the product without contributing, and formulate the rules of fair use.'
      },
      {
        n: 46,
        title: 'Vercel and Supabase: time to first result.',
        body: 'Both companies grew on developer experience: a product that works in a minute and is pleasant to show brings developers by itself, and developers bring companies. "Build it in an evening" materials work as a funnel: love first, then work, then a paid plan. Time to first result is the main metric of such marketing.',
        today: 'Time how many minutes pass for a new user from the first visit to the first result and find one step that can be removed.'
      }
    ]
  }
];

function lessonFor(letter: string): Lesson {
  const spec = MODULE_LESSON[letter]!;
  const mod = MARKETING_SCHOOL.find((m) => m.letter === spec.module)!;
  const modEn = MARKETING_SCHOOL_EN.find((m) => m.letter === spec.module)!;
  const items = spec.only ? mod.items.filter((it) => spec.only!.includes(it.n)) : mod.items;
  const itemsEn = spec.only ? modEn.items.filter((it) => spec.only!.includes(it.n)) : modEn.items;
  const headingRu = spec.part ? `Модуль ${spec.module}. ${mod.title}, ${spec.part[0]}` : `Модуль ${spec.module}. ${mod.title}`;
  const headingEn = spec.part ? `Module ${spec.module}. ${modEn.title}, ${spec.part[1]}` : `Module ${spec.module}. ${modEn.title}`;
  return {
    id: spec.id,
    block: 'marketing',
    title: bi(spec.title[0], spec.title[1]),
    summary: bi(
      `${headingRu}: ${count(items.length, ['принцип', 'принципа', 'принципов'], ['principle', 'principles'])} с задачей на каждый день.`,
      `${headingEn}: ${count(items.length, ['принцип', 'принципа', 'принципов'], ['principle', 'principles'])} with a task for each day.`,
    ),
    introduces: INTRODUCES[letter] ?? [],
    uses: USES[letter] ?? [],
    tier: 'core',
    minutes: spec.minutes,
    sources: SOURCES[letter]!,
    sections: [
      { id: 'hook', kind: 'text', step: 'hook', body: bi(spec.hook[0], spec.hook[1]) },
      {
        id: 'principles',
        kind: 'text',
        step: 'explain',
        title: bi(headingRu, headingEn),
        body: bi(moduleBody(items), moduleBodyEn(itemsEn)),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  };
}

export const MARKETING_LESSONS: Lesson[] = Object.keys(MODULE_LESSON).map(lessonFor);
