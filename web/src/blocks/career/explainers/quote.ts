// О-5 "How the AI puts a score on an answer" (10 §5.2, §9.3). A score above
// 1 counts only if its quote is found in the transcript with a word-level
// Levenshtein distance within the tolerance. The model runs the real matcher
// of engine/quiz/rubric.ts on a sample answer.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { matchQuote } from '../../../engine/quiz/rubric';

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
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const quoteModel = defineModel<P>({
  id: 'career.quote',
  block: 'career',
  title: bi('Как нейросеть ставит балл за ответ', 'How the AI puts a score on an answer'),
  summary: bi('Балл выше 1 засчитывается только с цитатой, которая нашлась в расшифровке. Двигайте допуск и смотрите, что проходит.', 'A score above 1 counts only with a quote found in the transcript. Move the tolerance and see what passes.'),
  concepts: ['career.rubric'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'tr', label: bi('Расшифровка ответа', 'Answer transcript'), sub: '23 words', family: 'obj', shape: 'doc', x: 24, y: 40, w: 224, h: 64, card: card('То, что вы сказали или написали. Источник правды: всё остальное с ним сверяется.', 'What you said or wrote. The source of truth: everything else is checked against it.', 'Вы; голос превращает в текст распознавание речи.', 'You; speech recognition turns voice into text.') },
      { id: 'rubric', label: bi('Рубрика', 'Rubric'), sub: '6 × 0–3', family: 'obj', shape: 'doc', x: 352, y: 184, w: 208, h: 64, card: card('Шесть критериев, у каждого балла — описание. Одна и та же для интервью, вопросов «объясните» и разбора дежурства.', 'Six criteria, each score described. The same for interviews, “explain” questions and on-call reviews.', 'Курс.', 'The course.') },
      { id: 'llm', label: bi('Нейросеть-оценщик', 'AI grader'), sub: 'temperature 0', family: 'process', x: 352, y: 40, w: 208, h: 64, card: card('Ваша нейросеть: читает ответ и рубрику и возвращает строгий JSON — балл и цитату на каждый критерий.', 'Your own AI: reads the answer and the rubric and returns strict JSON — a score and a quote for every criterion.', 'Вы подключаете её в настройках.', 'You connect it in the settings.') },
      { id: 'quote', label: bi('Цитата-доказательство', 'Evidence quote'), sub: '—', family: 'neutral', shape: 'pill', x: 640, y: 40, w: 296, h: 64, card: card('Фраза из ответа, на которую модель опирает балл. Модель может ошибиться или польстить — поэтому цитату проверяют.', 'The phrase from the answer the model bases the score on. The model can err or flatter — that is why the quote is checked.', 'Нейросеть.', 'The AI.') },
      { id: 'norm', label: bi('Нормализация', 'Normalisation'), sub: 'lower, ё=е, no punctuation', family: 'process', x: 640, y: 184, w: 296, h: 64, card: card('Оба текста приводятся к словам: строчные буквы, без знаков, «ё» = «е».', 'Both texts become plain words: lower case, no punctuation, “ё” = “е”.', 'Курс, у вас в браузере.', 'The course, in your browser.') },
      { id: 'match', label: bi('Сравнение окон', 'Window comparison'), sub: 'Levenshtein by words', family: 'process', x: 640, y: 312, w: 296, h: 64, card: card('Цитату сравнивают с каждым куском расшифровки той же длины ± 2 слова. Расстояние — сколько слов надо заменить, вставить или удалить, делённое на длину цитаты.', 'The quote is compared with every stretch of the transcript of the same length ± 2 words. The distance is how many words must be replaced, inserted or deleted, divided by the quote length.', 'Курс.', 'The course.') },
      { id: 'score', label: bi('Балл критерия', 'Criterion score'), sub: '3', family: 'gauge', x: 352, y: 312, w: 208, h: 64, card: card('Балл засчитывается, если расстояние не больше допуска; иначе он опускается до 1 и помечается «не подтверждено».', 'The score counts if the distance is within the tolerance; otherwise it drops to 1 and is marked “not confirmed”.', 'Курс.', 'The course.') },
    ],
    edges: [
      { id: 'e-tr', from: 'tr', to: 'llm', label: bi('ответ', 'answer'), card: card('Модель читает ваш ответ целиком.', 'The model reads your whole answer.', 'Курс отправляет его вашей нейросети.', 'The course sends it to your AI.') },
      { id: 'e-rub', from: 'rubric', to: 'llm', label: bi('критерии', 'criteria'), card: card('И рубрику с описанием каждого балла.', 'And the rubric with every score described.', 'Курс.', 'The course.') },
      { id: 'e-q', from: 'llm', to: 'quote', label: bi('цитата', 'quote'), card: card('Модель обязана подкрепить каждый балл выше 1 цитатой.', 'The model must back every score above 1 with a quote.', 'Нейросеть.', 'The AI.') },
      { id: 'e-n1', from: 'quote', to: 'norm', label: bi('слова', 'words'), card: card('Цитата идёт на нормализацию.', 'The quote is normalised.', 'Курс.', 'The course.') },
      { id: 'e-n2', from: 'tr', to: 'norm', label: bi('слова ответа', 'answer words'), via: [[136, 288], [600, 288], [600, 216]], labelAt: 0.35, card: card('И расшифровка тоже.', 'So is the transcript.', 'Курс.', 'The course.') },
      { id: 'e-m', from: 'norm', to: 'match', label: bi('окна', 'windows'), card: card('Два списка слов идут на сравнение.', 'Two word lists go to the comparison.', 'Курс.', 'The course.') },
      { id: 'e-s', from: 'match', to: 'score', label: bi('≤ допуска?', '≤ tolerance?'), card: card('Решение: засчитать балл или опустить до 1.', 'The decision: count the score or drop it to 1.', 'Курс.', 'The course.') },
    ],
  },
  params: [
    {
      id: 'tolerance',
      label: bi('Допуск (доля слов)', 'Tolerance (share of words)'),
      kind: 'range',
      min: 0,
      max: 0.4,
      step: 0.01,
      default: 0.15,
      near: 'match',
      predict: {
        prompt: bi('Допуск стал нулевым. Что будет с честной цитатой, где распознавание речи ошиблось в одном слове?', 'The tolerance is now zero. What happens to an honest quote where speech recognition got one word wrong?'),
        options: [
          { id: 'drop', text: bi('Балл сбросится до 1', 'The score drops to 1') },
          { id: 'keep', text: bi('Балл останется', 'The score stays') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.score ?? 3) < 3 ? 'drop' : 'keep'),
      },
    },
    {
      id: 'quote',
      label: bi('Какую цитату вернула модель', 'Which quote the model returned'),
      kind: 'choice',
      default: 'slip',
      near: 'quote',
      options: [
        { id: 'exact', label: bi('дословная', 'word for word') },
        { id: 'slip', label: bi('с одной ошибкой распознавания', 'with one recognition slip') },
        { id: 'paraphrase', label: bi('пересказ своими словами', 'a paraphrase') },
        { id: 'invented', label: bi('выдуманная похвала', 'invented praise') },
      ],
    },
  ],
  breaks: [
    {
      id: 'no-transcript',
      label: bi('Модель не видит ответ и выдумывает похвалу', 'The model does not see the answer and invents praise'),
      remove: ['e-tr'],
      boundary: 'io',
      predict: {
        prompt: bi('Модель поставила 3 с цитатой, которой нет в ответе. Что сделает курс?', 'The model gave 3 with a quote that is not in the answer. What does the course do?'),
        options: [
          { id: 'one', text: bi('Опустит балл до 1: «не подтверждено»', 'Drop the score to 1: “not confirmed”') },
          { id: 'three', text: bi('Засчитает 3', 'Count the 3') },
        ],
        resolve: () => 'one',
      },
    },
  ],
  metrics: [
    { id: 'dist', label: bi('расстояние', 'distance'), unit: '%' },
    { id: 'tol', label: bi('допуск', 'tolerance'), unit: '%' },
    { id: 'score', label: bi('балл', 'score') },
  ],
  run(p, broken): Step[] {
    const kind = broken.has('no-transcript') ? 'invented' : p.quote;
    const c = quoteCheck(kind, p.tolerance);
    const ok = c.ru.ok && c.en.ok;
    const d = Math.max(c.ru.distance, c.en.distance);
    const steps: Step[] = [
      { id: 'ask', label: bi('оценка', 'grade'), caption: bi('Модель получает ответ и рубрику и ставит балл каждому критерию.', 'The model gets the answer and the rubric and scores each criterion.'), focus: broken.has('no-transcript') ? ['rubric', 'e-rub', 'llm'] : ['tr', 'e-tr', 'rubric', 'e-rub', 'llm'], tokens: broken.has('no-transcript') ? [{ edge: 'e-rub' }] : [{ edge: 'e-tr' }, { edge: 'e-rub' }], states: broken.has('no-transcript') ? { 'e-tr': 'off' } : {} },
      { id: 'quote', label: bi('цитата', 'quote'), caption: bi(`Модель ставит 3 за механизм и приводит цитату: «${c.q.ru}».`, `The model gives 3 for mechanism and quotes: “${c.q.en}”.`), focus: ['e-q', 'quote'], tokens: [{ edge: 'e-q', label: '3' }], values: { quote: kind, score: '3?' }, metrics: { score: 3, tol: Math.round(p.tolerance * 100), dist: 0 } },
      { id: 'norm', label: bi('слова', 'words'), caption: bi('Обе строки приводятся к словам: регистр, знаки и «ё» больше не мешают.', 'Both strings become words: case, punctuation and “ё” no longer get in the way.'), focus: ['e-n1', 'e-n2', 'norm'], tokens: [{ edge: 'e-n1' }, { edge: 'e-n2' }] },
      { id: 'match', label: bi('сравнение', 'compare'), caption: fmt(bi('Лучшее окно расшифровки отличается от цитаты на {d} слов; допуск — {t}.', 'The best window of the transcript differs from the quote by {d} of its words; the tolerance is {t}.'), { d: pct(d), t: pct(p.tolerance) }), focus: ['e-m', 'match'], tokens: [{ edge: 'e-m' }], values: { match: `d = ${pct(d)} · tol ${pct(p.tolerance)}` }, states: { match: ok ? 'ok' : 'warn' }, metrics: { dist: Math.round(d * 100), tol: Math.round(p.tolerance * 100), score: 3 } },
    ];
    if (ok) {
      steps.push({ id: 'keep', label: '3 ✓', caption: kind === 'invented' ? bi('Допуск так широк, что прошла и выдуманная цитата: проверка перестала защищать.', 'The tolerance is so wide that even an invented quote passed: the check no longer protects.') : bi('Цитата найдена — балл 3 засчитан.', 'The quote is found — the 3 counts.'), focus: ['e-s', 'score'], tokens: [{ edge: 'e-s' }], states: { score: kind === 'invented' ? 'warn' : 'ok' }, values: { score: '3' }, metrics: { dist: Math.round(d * 100), tol: Math.round(p.tolerance * 100), score: 3 } });
    } else {
      const step: Step = { id: 'drop', label: '3 → 1', caption: kind === 'invented' ? bi('Такой фразы в ответе нет: балл опущен до 1 и помечен «не подтверждено». Лесть модели не засчитывается.', 'There is no such phrase in the answer: the score drops to 1, marked “not confirmed”. The model’s flattery does not count.') : bi('Цитата не нашлась в пределах допуска: балл опущен до 1, хотя ответ был честным. Слишком строгий допуск наказывает за ошибки распознавания.', 'The quote was not found within the tolerance: the score drops to 1 although the answer was honest. Too strict a tolerance punishes recognition slips.'), focus: ['e-s', 'score'], tokens: [{ edge: 'e-s' }], states: { score: 'warn' }, values: { score: '1 · not confirmed' }, metrics: { dist: Math.round(d * 100), tol: Math.round(p.tolerance * 100), score: 1 } };
      if (broken.has('no-transcript')) step.broken = { at: 'match', message: `evidence "${c.q.en}" not found in transcript\nscore: 3 → 1 (not confirmed)`, caption: bi('модель не видела ответа, и её цитата не прошла проверку: балл без доказательства не считается.', 'the model never saw the answer, and its quote failed the check: a score without evidence does not count.') };
      steps.push(step);
    }
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    const s = (x: Step[]) => x[x.length - 1]?.metrics?.score;
    if (change.kind === 'break') return change.on ? bi('Модель не видела ответа: её цитата не нашлась, балл опущен до 1.', 'The model never saw the answer: its quote was not found, the score dropped to 1.') : bi('Модель снова видит ответ.', 'The model sees the answer again.');
    if (s(prev) === s(next)) return fmt(bi('Допуск {t}: исход для этой цитаты тот же — балл {s}.', 'Tolerance {t}: the same outcome for this quote — score {s}.'), { t: pct(b.tolerance), s: s(next) ?? 0 });
    return s(next) === 3 ? fmt(bi('При допуске {t} цитата проходит: балл 3 засчитан.', 'At a {t} tolerance the quote passes: the 3 counts.'), { t: pct(b.tolerance) }) : fmt(bi('При допуске {t} цитата не проходит: балл опущен до 1.', 'At a {t} tolerance the quote fails: the score drops to 1.'), { t: pct(b.tolerance) });
  },
});
