// О-5 "How the AI puts a score on an answer" (10 §5.2, §9.3). A score above
// 1 counts only if its quote is found in the transcript with a word-level
// Levenshtein distance within the tolerance. The model runs the real matcher
// of engine/quiz/rubric.ts on a sample answer.
//
// Reading order: at the start only the answer, the rubric and the AI grader
// are on the picture. The quote appears when the AI returns it, then the two
// checking stages of the course, then the score. Each acting block says in a
// callout what it does; what it hands on travels along the line as a card.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { matchQuote } from '../../../engine/quiz/rubric';
import { fmtb, startWith, tr } from './util';

type P = { tolerance: number; quote: string };

export const SAMPLE = {
  transcript: bi(
    'Ну, контейнер — это обычный процесс хоста. Ядро показывает ему свой вид системы через пространства имён, а ресурсы ограничивает через си группы.',
    'Well, a container is an ordinary host process. The kernel shows it its own view of the system through namespaces, and limits its resources with see groups.',
  ),
  quotes: {
    exact: bi('Ядро показывает ему свой вид системы через пространства имён', 'The kernel shows it its own view of the system through namespaces'),
    slip: bi('ядро показывает ему свой вид системы через пространство имён', 'the kernel shows it its own view of the system through namespace'),
    paraphrase: bi('ядро показывает контейнеру собственный вид системы через пространства имён', 'the kernel shows the container its very own view of the system via namespaces'),
    invented: bi('контейнер изолирован сильнее виртуальной машины', 'a container is isolated more strongly than a virtual machine'),
  } as Record<string, Bi>,
};

/** Distances and verdicts in both languages for one quote kind. */
export function quoteCheck(kind: string, tolerance: number) {
  const q = SAMPLE.quotes[kind] ?? SAMPLE.quotes.exact;
  const ru = matchQuote(q.ru, SAMPLE.transcript.ru, tolerance);
  const en = matchQuote(q.en, SAMPLE.transcript.en, tolerance);
  return { ru, en, q };
}

const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn) });
const pct = (x: number) => `${Math.round(x * 100)} %`;
const words = (s: string) => s.split(' ').length;
const pctEn = (x: number) => `${Math.round(x * 100)}%`;

const KIND: Record<string, Bi> = {
  exact: bi('дословную цитату', 'a word-for-word quote'),
  slip: bi('цитату с одной ошибкой распознавания речи', 'a quote with one recognition slip'),
  paraphrase: bi('пересказ ответа своими словами', 'a paraphrase'),
  invented: bi('фразу, которой в ответе не было', 'a phrase that was never said'),
};

const ALL = ['tr', 'rubric', 'llm', 'quote', 'norm', 'match', 'score', 'e-tr', 'e-rub', 'e-q', 'e-n1', 'e-n2', 'e-m', 'e-s'];

export const quoteModel = defineModel<P>({
  id: 'career.quote',
  frame: 'visible',
  block: 'career',
  title: bi('Как нейросеть ставит балл за ответ', 'How the AI puts a score on an answer'),
  summary: bi(
    'После учебного интервью нейросеть ставит баллы вашему ответу по рубрике и к каждому баллу выше 1 прикладывает цитату из ответа. Курс не верит нейросети на слово: он ищет эту цитату в расшифровке вашего ответа и засчитывает балл, только если цитата нашлась с небольшим допуском на ошибки распознавания речи.',
    'After a practice interview the AI scores your answer by the rubric and backs every score above 1 with a quote from the answer. The course does not take the AI’s word for it: it looks for the quote in the transcript and counts the score only if it is found, with a small tolerance for recognition slips.',
  ),
  intro: bi(
    'Схема собирается по шагам, и сейчас на ней ваш ответ, рубрика и нейросеть-оценщик. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что этот блок делает, а карточка на линии показывает, что он передаёт дальше. Под схемой видны три числа: насколько цитата отличается от ответа, какой допуск разрешён и какой балл засчитан.\n\nПосле первого прохода выберите в «Параметрах» другую цитату, например пересказ или выдуманную похвалу, а потом подвигайте допуск.',
    'The diagram builds itself step by step, and now it shows your answer, the rubric and the AI grader. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what that block does, and the card on the line shows what it hands on. Under the diagram you see three numbers: how far the quote is from the answer, what tolerance is allowed and what score is counted.\n\nAfter the first pass choose another quote in “Parameters”, such as a paraphrase or invented praise, then move the tolerance.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('то, что передаётся дальше, то есть ответ, цитата или балл', 'what is handed on, that is, the answer, the quote or the score') },
    { mark: 'icon:user', text: bi('ваш ответ', 'your answer') },
    { mark: 'icon:cloud', text: bi('ваша нейросеть', 'your AI') },
    { mark: 'icon:file', text: bi('рубрика и цитата', 'the rubric and the quote') },
    { mark: 'icon:process', text: bi('проверка, которую делает курс', 'the check the course runs') },
    { mark: 'ok', text: bi('балл подтверждён цитатой', 'the score is confirmed') },
    { mark: 'warn', text: bi('балл опущен до 1 или проверка пропустила выдумку', 'the score dropped to 1, or the check protected nothing') },
  ],
  stopLabel: bi('Балл не подтверждён', 'The score is not confirmed'),
  concepts: ['career.rubric'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'tr', label: bi('Ваш ответ', 'Your answer'), icon: 'user', sub: { ru: '23 слова', en: '23 words' }, family: 'obj', x: 24, y: 40, w: 200, h: 64, card: card('Расшифровка того, что вы сказали или написали на учебном интервью. Расшифровка служит главным документом проверки, и всё, что говорит нейросеть, сверяется с ней.', 'The transcript of what you said or wrote. It is the main document of the check, and everything the AI says is checked against it.', 'Ответ даёте вы, а голос в текст превращает программа распознавания речи.', 'You; speech recognition turns voice into text.') },
      { id: 'rubric', label: bi('Рубрика', 'Rubric'), icon: 'file', sub: '6 × 0–3', family: 'obj', x: 312, y: 184, w: 208, h: 64, card: card('Шесть критериев оценки, и у каждого балла от 0 до 3 есть описание. Одна и та же рубрика служит для учебных интервью, вопросов «объясните» и разбора дежурства.', 'Six criteria, each score from 0 to 3 described. The same rubric serves interviews, “explain” questions and on-call reviews.', 'Рубрику составили авторы курса.', 'The course.') },
      { id: 'llm', label: bi('Нейросеть-оценщик', 'AI grader'), icon: 'cloud', work: 'dots', sub: 'temperature 0', family: 'process', x: 312, y: 40, w: 208, h: 64, card: card('Ваша нейросеть. Она читает ответ и рубрику и возвращает строгий JSON, в котором по каждому критерию стоят балл и цитата.', 'Your own AI. It reads the answer and the rubric and returns strict JSON with a score and a quote for each criterion.', 'Нейросеть вы подключаете сами в настройках курса.', 'You connect it in the settings.') },
      { id: 'quote', label: bi('Цитата-доказательство', 'Evidence quote'), icon: 'file', sub: '—', family: 'neutral', shape: 'pill', x: 640, y: 40, w: 296, h: 64, card: card('Фраза из ответа, которой нейросеть обосновывает балл. Нейросеть может ошибиться или польстить, поэтому курс ищет эту фразу в расшифровке.', 'The phrase the AI bases the score on. The AI can err or flatter, so the course looks for it in the transcript.', 'Цитату возвращает нейросеть.', 'The AI returns it.') },
      { id: 'norm', label: bi('Приведение к списку слов', 'Normalisation'), icon: 'process', work: 'spin', sub: 'lower, ё=е, no punctuation', family: 'process', x: 640, y: 184, w: 296, h: 64, card: card('Курс приводит оба текста к простому списку слов. Для этого он делает все буквы строчными, убирает знаки препинания и считает «ё» и «е» одной буквой.', 'The course turns both texts into plain word lists. To do so it makes every letter lower case, removes punctuation and treats “ё” and “е” as one letter.', 'Это делает курс у вас в браузере.', 'The course, in your browser.') },
      { id: 'match', label: bi('Поиск цитаты в ответе', 'Finding the quote'), icon: 'process', work: 'spin', sub: 'Levenshtein by words', family: 'process', x: 640, y: 312, w: 296, h: 64, card: card('Курс сравнивает цитату с каждым куском расшифровки примерно той же длины, от двух слов короче до двух слов длиннее. Расстояние между ними равно числу слов, которые нужно заменить, вставить или удалить, чтобы кусок совпал с цитатой, делённому на число слов в цитате.', 'The quote is compared with every stretch of the transcript of the same length ± 2 words. The distance is how many words must be replaced, inserted or deleted, divided by the quote length.', 'Это делает курс.', 'The course.') },
      { id: 'score', label: bi('Засчитанный балл', 'Counted score'), icon: 'terminal', sub: '3', family: 'gauge', x: 312, y: 312, w: 208, h: 64, card: card('Если расстояние не больше допуска, балл засчитывается. Если больше, балл опускается до 1 и помечается «не подтверждено».', 'Within the tolerance the score counts; otherwise it drops to 1, marked “not confirmed”.', 'Решение принимает курс.', 'The course.') },
    ],
    edges: [
      { id: 'e-tr', from: 'tr', to: 'llm', label: bi('ваш ответ', 'your answer'), card: card('Нейросеть читает ваш ответ целиком.', 'The AI reads your whole answer.', 'Курс отправляет ответ вашей нейросети.', 'The course sends it.') },
      { id: 'e-rub', from: 'rubric', to: 'llm', label: bi('критерии', 'criteria'), card: card('Вместе с ответом нейросеть получает рубрику с описанием каждого балла.', 'With the answer the AI gets the rubric.', 'Рубрику отправляет курс.', 'The course.') },
      { id: 'e-q', from: 'llm', to: 'quote', label: bi('балл и цитата', 'score and quote'), card: card('Каждый балл выше 1 нейросеть обязана подкрепить цитатой из ответа.', 'Every score above 1 must come with a quote.', 'Цитату выбирает нейросеть.', 'The AI.') },
      { id: 'e-n1', from: 'quote', to: 'norm', label: bi('слова цитаты', 'quote words'), card: card('Цитата превращается в список слов.', 'The quote is normalised.', 'Это делает курс.', 'The course.') },
      { id: 'e-n2', from: 'tr', to: 'norm', label: bi('слова ответа', 'answer words'), via: [[124, 288], [600, 288], [600, 216]], labelAt: 0.35, card: card('Расшифровка ответа тоже превращается в список слов, чтобы сравнивать одинаковое с одинаковым.', 'So is the transcript.', 'Это делает курс.', 'The course.') },
      { id: 'e-m', from: 'norm', to: 'match', label: bi('два списка слов', 'two word lists'), card: card('Оба списка слов передаются на сравнение.', 'Both lists go to the comparison.', 'Это делает курс.', 'The course.') },
      { id: 'e-s', from: 'match', to: 'score', label: bi('сравнение с допуском', 'comparison with the tolerance'), card: card('Здесь курс решает, засчитать балл или опустить его до 1.', 'Count the score or drop it to 1.', 'Решение принимает курс.', 'The course.') },
    ],
  },
  params: [
    {
      id: 'quote',
      label: bi('Какую цитату вернула нейросеть', 'Which quote the AI returned'),
      kind: 'choice',
      default: 'slip',
      near: 'quote',
      group: bi('Что вернула нейросеть', 'What the AI returned'),
      options: [
        { id: 'exact', label: bi('дословную фразу из ответа', 'a phrase word for word') },
        { id: 'slip', label: bi('фразу с одной ошибкой распознавания речи', 'a phrase with one recognition slip') },
        { id: 'paraphrase', label: bi('пересказ ответа своими словами', 'a paraphrase') },
        { id: 'invented', label: bi('похвалу, которой в ответе не было', 'praise that was never said') },
      ],
      predict: {
        prompt: bi('Вы выбираете другую цитату, а допуск остаётся прежним. Засчитает ли курс балл 3 с новой цитатой?', 'You pick another quote; the tolerance stays. Will the course count the 3 with the new quote?'),
        options: [
          { id: 'keep', text: bi('Да, цитата найдётся в ответе, и балл 3 засчитают', 'Yes, it is found and the 3 counts') },
          { id: 'drop', text: bi('Нет, цитата не найдётся, и балл опустится до 1', 'No, it is not found and the score drops to 1') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.score ?? 3) < 3 ? 'drop' : 'keep'),
      },
    },
    {
      id: 'tolerance',
      label: bi('Какая доля слов цитаты может не совпадать с ответом (допуск)', 'Share of the quote’s words allowed to differ (tolerance)'),
      kind: 'range',
      min: 0,
      max: 0.4,
      step: 0.01,
      default: 0.15,
      near: 'match',
      group: bi('Как строго проверяет курс', 'How strict the course is'),
      predict: {
        prompt: bi('Вы меняете допуск, а цитата, которую вернула нейросеть, остаётся прежней. Засчитает ли курс балл 3 при новом допуске?', 'You change the tolerance; the quote stays. Will the course count the 3 with the new tolerance?'),
        options: [
          { id: 'keep', text: bi('Да, балл 3 засчитают', 'Yes, the 3 counts') },
          { id: 'drop', text: bi('Нет, балл опустится до 1', 'No, the score drops to 1') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.score ?? 3) < 3 ? 'drop' : 'keep'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-transcript',
      label: bi('Нейросеть не получила ваш ответ и выдумала похвалу', 'The AI never got your answer and invented praise'),
      remove: ['e-tr'],
      boundary: 'io',
      predict: {
        prompt: bi('Ответ до нейросети не дошёл, и она поставила 3 с цитатой «контейнер изолирован сильнее виртуальной машины». Вы такого не говорили. Что сделает курс при допуске по умолчанию?', 'The answer never reached the AI, and it gave 3 quoting “a container is isolated more strongly than a virtual machine”, which you never said. What does the course do at the default tolerance?'),
        options: [
          { id: 'one', text: bi('Опустит балл до 1 и пометит «не подтверждено»', 'Drop the score to 1, “not confirmed”') },
          { id: 'three', text: bi('Засчитает 3, потому что нейросеть отвечает за свою оценку', 'Count the 3, because the AI answers for its grade') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.score ?? 3) < 3 ? 'one' : 'three'),
      },
    },
  ],
  metrics: [
    { id: 'dist', label: bi('цитата отличается от ответа', 'quote differs from the answer'), unit: '%' },
    { id: 'tol', label: bi('допуск', 'tolerance'), unit: '%' },
    { id: 'score', label: bi('засчитанный балл', 'counted score') },
  ],
  run(p, broken): Step[] {
    const blind = broken.has('no-transcript');
    const kind = blind ? 'invented' : p.quote;
    const c = quoteCheck(kind, p.tolerance);
    const ok = c.ru.ok && c.en.ok;
    const d = Math.max(c.ru.distance, c.en.distance);
    const tol = Math.round(p.tolerance * 100);
    const dist = Math.round(d * 100);
    const steps: Step[] = [
      {
        id: 'grade',
        label: bi('оценка', 'grade'),
        caption: blind
          ? bi('Ваш ответ до нейросети не дошёл, и она получила только рубрику. Но нейросеть всё равно должна вернуть баллы, и ей придётся их придумать.', 'Your answer never reached the AI, and it got only the rubric. But the AI still has to return scores, so it will have to make them up.')
          : bi('Курс отправляет вашей нейросети расшифровку ответа и рубрику. Нейросеть читает ответ и по каждому из шести критериев ставит балл от 0 до 3.', 'The course sends your AI the transcript and the rubric. The AI reads the answer and scores each of the six criteria from 0 to 3.'),
        focus: ['llm', blind ? 'e-rub' : 'e-tr'],
        reveal: ['e-tr', 'e-rub'],
        tokens: blind ? [{ edge: 'e-rub', label: bi('6 критериев', '6 criteria') }] : [{ edge: 'e-tr', label: bi('ответ, 23 слова', 'answer, 23 words') }, { edge: 'e-rub', label: bi('6 критериев', '6 criteria') }],
        say: { llm: blind ? bi('Нейросеть видит только рубрику, а ответа не видит.', 'The AI sees only the rubric, no answer.') : bi('Нейросеть читает ответ и ставит баллы по рубрике.', 'The AI reads the answer and scores it by the rubric.') },
        states: { ...startWith(ALL, 'tr', 'rubric', 'llm'), ...(blind ? { 'e-tr': 'off' as const } : {}) },
        values: { tr: tr('23 слова', '23 words'), llm: tr('температура 0', 'temperature 0'), norm: tr('строчные буквы, ё=е, без знаков', 'lower, ё=е, no punctuation'), match: tr('расстояние Левенштейна по словам', 'Levenshtein by words') },
        metrics: { dist: 0, tol, score: 0 },
      },
      {
        id: 'quote',
        label: bi('цитата', 'quote'),
        caption: fmtb(bi('По критерию «механизм, а не команды» нейросеть ставит 3 и в доказательство возвращает {k}: «{q}».', 'For “mechanism, not commands” the AI gives 3 and returns {k} as proof: “{q}”.'), { k: KIND[kind] ?? KIND.exact, q: c.q }),
        focus: ['quote', 'e-q'],
        reveal: ['quote', 'e-q'],
        tokens: [{ edge: 'e-q', label: bi('3 и цитата', '3 and a quote') }],
        say: { quote: bi('Нейросеть подкрепляет балл 3 цитатой.', 'The AI backs the 3 with a quote.') },
        values: { quote: tr(`${words(c.q.ru)} ${pluralRu(words(c.q.ru), ['слово', 'слова', 'слов'])}`, `${words(c.q.ru)} words`), score: '3?' },
        metrics: { dist: 0, tol, score: 3 },
      },
      {
        id: 'norm',
        label: bi('слова', 'words'),
        caption: bi('Курс приводит цитату и расшифровку ответа к простым спискам слов. Заглавные буквы, знаки препинания и разница между «ё» и «е» больше не мешают сравнению.', 'The course turns the quote and the transcript into plain word lists: capitals, punctuation and “ё” no longer get in the way.'),
        focus: ['norm', 'e-n1'],
        reveal: ['norm', 'e-n1', 'e-n2'],
        tokens: [{ edge: 'e-n1', label: bi('слова цитаты', 'quote words') }, { edge: 'e-n2', label: bi('слова ответа', 'answer words') }],
        say: { norm: bi('Курс переводит оба текста в строчные буквы и убирает знаки препинания.', 'Lower case, no punctuation, for both texts.') },
        metrics: { dist: 0, tol, score: 3 },
      },
      {
        id: 'match',
        label: bi('сравнение', 'compare'),
        caption: {
          ru: `Курс ищет в ответе кусок, который ближе всего к цитате. Лучший кусок отличается от неё на ${pct(d)} слов, а допуск разрешает ${pct(p.tolerance)}, поэтому цитата ${ok ? 'считается найденной' : 'не считается найденной'}.`,
          en: `The course looks for the stretch of the answer closest to the quote. The best one differs by ${pctEn(d)} of its words against a ${pctEn(p.tolerance)} tolerance, so the quote ${ok ? 'counts as found' : 'counts as not found'}.`,
        },
        focus: ['match', 'e-m'],
        reveal: ['match', 'e-m'],
        tokens: [{ edge: 'e-m', label: bi('два списка слов', 'two word lists') }],
        say: { match: { ru: `Ближайший кусок ответа отличается от цитаты на ${pct(d)} слов, а допуск разрешает ${pct(p.tolerance)}.`, en: `The closest stretch differs by ${pctEn(d)}; the tolerance is ${pctEn(p.tolerance)}.` } },
        states: { match: ok ? 'ok' : 'warn' },
        values: { match: tr(`отличие ${pct(d)} · допуск ${pct(p.tolerance)}`, `d = ${pctEn(d)} · tol ${pctEn(p.tolerance)}`) },
        metrics: { dist, tol, score: 3 },
      },
    ];
    if (ok) {
      steps.push({
        id: 'keep',
        label: '3 ✓',
        caption:
          kind === 'invented'
            ? bi('Допуск так широк, что прошла даже фраза, которой в ответе не было. Проверка больше ничего не защищает, потому что курс засчитал лесть нейросети.', 'The tolerance is so wide that even a phrase that was never in the answer passed. The check no longer protects anything, because the course has counted the AI’s flattery.')
            : bi('Цитата нашлась в ответе, и курс засчитывает балл 3.', 'The quote is in the answer, and the 3 counts.'),
        focus: ['score', 'e-s'],
        reveal: ['score', 'e-s'],
        tokens: [{ edge: 'e-s', label: '3 ✓' }],
        say: { score: kind === 'invented' ? bi('Балл 3 засчитан, хотя такой фразы в ответе не было.', 'The 3 counts, though the phrase was never said.') : bi('Цитата нашлась в ответе, и балл 3 засчитан.', 'The quote is confirmed: the 3 counts.') },
        states: { score: kind === 'invented' ? 'warn' : 'ok' },
        values: { score: '3' },
        metrics: { dist, tol, score: 3 },
      });
    } else {
      const step: Step = {
        id: 'drop',
        label: '3 → 1',
        caption:
          kind === 'invented'
            ? bi('Такой фразы в ответе нет, поэтому курс опускает балл до 1 и помечает его «не подтверждено». Лесть нейросети не засчитывается.', 'There is no such phrase in the answer: the score drops to 1, “not confirmed”. The AI’s flattery does not count.')
            : bi('Цитата не нашлась в пределах допуска, и курс опускает балл до 1, хотя ответ был честным. Слишком строгий допуск наказывает за ошибки распознавания речи, а не за содержание.', 'The quote was not found within the tolerance: the score drops to 1, although the answer was honest. Too strict a tolerance punishes recognition slips, not content.'),
        focus: ['score', 'e-s'],
        reveal: ['score', 'e-s'],
        tokens: [{ edge: 'e-s', label: '3 → 1' }],
        say: { score: bi('Цитата не нашлась, поэтому балл опущен до 1 с пометкой «не подтверждено».', 'Not found: dropped to 1, “not confirmed”.') },
        states: { score: 'warn' },
        values: { score: tr('1 · не подтверждён', '1 · not confirmed') },
        metrics: { dist, tol, score: 1 },
      };
      if (blind)
        step.broken = {
          at: 'score',
          message: `evidence "${c.q.en}" not found in transcript\nscore: 3 → 1 (not confirmed)`,
          caption: bi('на подтверждении балла. Нейросеть не видела ответа, и её цитата не нашлась в расшифровке. Так проверка и узнаёт выдуманную оценку, ведь балл без доказательства не засчитывается.', 'at confirming the score. The AI never saw the answer, and its quote was not found in the transcript. This is how the check recognises an invented grade, because a score without evidence does not count.'),
        };
      steps.push(step);
    }
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    const s = (x: Step[]) => x[x.length - 1]?.metrics?.score;
    const t = { ru: pct(b.tolerance), en: pctEn(b.tolerance) };
    if (change.kind === 'break')
      return change.on
        ? bi('Нейросеть не видела ответа, и её цитата не нашлась в расшифровке, поэтому балл опущен до 1.', 'The AI never saw the answer; its quote was not found, and the score dropped to 1.')
        : bi('Нейросеть снова получает ваш ответ и цитирует то, что вы сказали.', 'The AI gets your answer again.');
    if (s(prev) === s(next)) return fmtb(bi('При допуске {t} исход для этой цитаты не изменился, и засчитан по-прежнему балл {s}.', 'At a {t} tolerance the outcome for this quote has not changed, and the score counted is still {s}.'), { t, s: s(next) ?? 0 });
    return s(next) === 3
      ? fmtb(bi('При допуске {t} цитата находится в ответе, и балл 3 засчитан.', 'At a {t} tolerance the quote is found: the 3 counts.'), { t })
      : fmtb(bi('При допуске {t} цитата в ответе не находится, и балл опущен до 1.', 'At a {t} tolerance the quote is not found: the score drops to 1.'), { t });
  },
});
