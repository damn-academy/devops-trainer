// Lessons of the hidden pilot «Научное мышление»: a universal non-IT skill
// course for adults who are not specialists. Everyday situation first, then
// the tool, then practice; every lesson carries the honest note (one way, not
// a law) and the self-check note (this course can be wrong too — check it
// like anything else). Russian is the source text; the English slot of every
// bi() is a faithful translation (the platform lints for missing halves).
// Source books are cited in each lesson's sources field.

import { bi } from '../../core/i18n';
import type { Concept, Lesson, QuizItem, Sources } from '../../core/types';

/** The honest note every lesson of the pilot carries: one way, not a law. */
export const HONEST_NOTE = bi(
  'Это один из способов проверять утверждения; законом и единственным верным путём он не служит. Жизнь сложнее любой схемы: многое зависит от темы, данных и времени, которое вы готовы потратить. Берите то, что работает в вашей ситуации, и проверяйте на практике.',
  'This is one way of checking claims, not a law and not the one right path. Life is more complex than any framework: much depends on the topic, the data and the time you are willing to spend. Take what works in your situation and test it in practice.',
);

/** The second honest note: this very course can be wrong, and every claim in it can be checked. */
export const SELFCHECK_NOTE = bi(
  'Этот курс тоже может ошибаться. Каждое его утверждение можно проверить, и проверять его стоит так же, как любое другое: спросите, что наблюдали, как сравнивали и каким результатам вывод противоречил бы. Найденная здесь ошибка — это не провал курса, а работающая привычка проверять.',
  'This course can be wrong too. Every claim in it can be checked, and it deserves the same check as anything else: ask what was observed, how it was compared, and which results the conclusion would rule out. An error you find here is not a failure of the course — it is the checking habit working.',
);

const KAHNEMAN_EN = { title: 'Daniel Kahneman — Thinking, Fast and Slow', url: 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow' };
const KAHNEMAN_RU = { title: 'Даниэль Канеман — «Думай медленно… решай быстро»', url: 'https://ru.wikipedia.org/wiki/Думай_медленно…_решай_быстро' };
const SPIEGELHALTER_EN = { title: 'David Spiegelhalter — The Art of Statistics', url: 'https://en.wikipedia.org/wiki/David_Spiegelhalter' };
const SPIEGELHALTER_RU = { title: 'Дэвид Шпигельхалтер — «Искусство статистики»', url: 'https://www.mann-ivanov-ferber.ru/books/iskusstvo-statistiki/' };
const BULLSHIT_EN = { title: 'Carl Bergström, Jevin West — Calling Bullshit', url: 'https://www.callingbullshit.org/' };
const BULLSHIT_RU = { title: 'Карл Бергстрём, Джевин Вест — «Calling Bullshit»', url: 'https://www.callingbullshit.org/' };
const TETLOCK_EN = { title: 'Philip Tetlock, Dan Gardner — Superforecasting', url: 'https://en.wikipedia.org/wiki/Superforecasting' };
const TETLOCK_RU = { title: 'Филип Тетлок, Дэн Гарднер — «Суперпрогнозы»', url: 'https://en.wikipedia.org/wiki/Superforecasting' };
const BASE_RATE_EN = { title: 'Base rate fallacy — Wikipedia', url: 'https://en.wikipedia.org/wiki/Base_rate_fallacy' };
const BASE_RATE_RU = { title: 'Пренебрежение базовой частотой — Wikipedia', url: 'https://en.wikipedia.org/wiki/Base_rate_fallacy' };
const REGRESSION_EN = { title: 'Regression toward the mean — Wikipedia', url: 'https://en.wikipedia.org/wiki/Regression_toward_the_mean' };
const REGRESSION_RU = { title: 'Регрессия к среднему — Wikipedia', url: 'https://en.wikipedia.org/wiki/Regression_toward_the_mean' };
const CORRELATION_EN = { title: 'Correlation does not imply causation — Wikipedia', url: 'https://en.wikipedia.org/wiki/Correlation_does_not_imply_causation' };
const CORRELATION_RU = { title: 'Корреляция не означает причинность — Wikipedia', url: 'https://en.wikipedia.org/wiki/Correlation_does_not_imply_causation' };
const RCT_EN = { title: 'Randomized controlled trial — Wikipedia', url: 'https://en.wikipedia.org/wiki/Randomized_controlled_trial' };
const RCT_RU = { title: 'Рандомизированное исследование — Wikipedia', url: 'https://en.wikipedia.org/wiki/Randomized_controlled_trial' };
const PUB_BIAS_EN = { title: 'Publication bias — Wikipedia', url: 'https://en.wikipedia.org/wiki/Publication_bias' };
const PUB_BIAS_RU = { title: 'Публикационное смещение — Wikipedia', url: 'https://en.wikipedia.org/wiki/Publication_bias' };
const OVERCONF_EN = { title: 'Overconfidence effect — Wikipedia', url: 'https://en.wikipedia.org/wiki/Overconfidence_effect' };
const OVERCONF_RU = { title: 'Эффект чрезмерной уверенности — Wikipedia', url: 'https://en.wikipedia.org/wiki/Overconfidence_effect' };
const BAYES_EN = { title: 'Bayes’ theorem — Wikipedia', url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem' };
const BAYES_RU = { title: 'Теорема Байеса — Wikipedia', url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem' };

const sources = (en: Sources['en'], ru: Sources['ru']): Sources => ({ en, ru });

const CHECK_YOURSELF = bi('Проверьте себя', 'Check yourself');

function lesson(partial: Omit<Lesson, 'block' | 'tier'> & { tier?: Lesson['tier'] }): Lesson {
  return { block: 'scithink', tier: 'core', ...partial };
}

export const SCITHINK_LESSONS: Lesson[] = [
  lesson({
    id: 'scithink.story',
    title: bi('Почему уверенность ничего не проверяет', 'Confidence is not a check'),
    summary: bi(
      'Убедительная история и проверенное утверждение — разные вещи; уверенность говорит о чувстве, и о точности по ней судить нельзя.',
      'A convincing story and a checked claim are different things; confidence reports a feeling, not accuracy.',
    ),
    introduces: ['scithink.confidence'],
    uses: [],
    minutes: 12,
    sources: sources([KAHNEMAN_EN], [KAHNEMAN_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Вам пересылают статью с громким заголовком: «Учёные доказали, что привычный продукт на самом деле вреден». Внутри — связный рассказ, цитата человека в белом халате и уверенный тон. Хочется либо переслать дальше с подписью «я же говорил», либо возмутиться и забыть. В обоих случаях решение приняла не проверка, а впечатление.\n\nЭтот курс учит третьему варианту: спокойно спросить, на чём утверждение стоит. Это умение пригождается везде — в новостях, рекламе, спорах о здоровье и в любом «все знают, что…».',
          'Someone forwards you an article with a loud headline: "Scientists have proven that a familiar product is actually harmful." Inside there is a coherent story, a quote from a person in a white coat, and a confident tone. You feel like forwarding it on with "told you so", or getting annoyed and forgetting it. In both cases the decision was made by an impression, not a check.\n\nThis course teaches a third option: calmly ask what the claim stands on. The skill serves everywhere — in news, advertising, arguments about health, and any "everyone knows that…".',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Умная история — не то же, что проверенная', 'A clever story is not a checked one'),
        body: bi(
          '### Почему убедительная история ничего не доказывает\n\nХороший рассказ держится на связности: одно звено вытекает из другого, примеры подобраны под вывод, и весь текст звучит как объяснение. Мозг принимает такую связность за правдоподобие — это известная особенность нашего мышления, о которой подробно пишет Даниэль Канеман в книге «Думай медленно… решай быстро». Связный рассказ приятно слушать, но он не заменяет наблюдение и сравнение.\n\n### Почему уверенность ничего не измеряет\n\nУверенность говорит о том, насколько гладко сложилась история в голове; о том, насколько история совпадает с миром, она ничего не сообщает. Канеман приводит пример с инвестиционными аналитиками: их прогнозы рынка на год вперёд почти не совпадают с тем, что происходит на самом деле, хотя уверены они в каждом прогнозе полностью. Ошибались они не потому, что глупы, а потому что уверенность не измеряет точность.\n\n### Три вопроса к любому утверждению\n\nВместо того чтобы оценивать впечатление, задайте три вопроса, на которые можно ответить проверкой. Что наблюдали: сами факты, похожие на факты, или чужую оценку? Как сравнивали: с чем ставили рядом, чтобы понять, что причина сработала? Каким результатам вывод противоречил бы: что должно было бы случиться, чтобы утверждение оказалось неверным? Если на третий вопрос нет ответа, утверждение ничему не противоречит — а значит, ничего и не объясняет.\n\nЭти три вопроса будут возвращаться в каждом уроке курса, каждый раз применённые к новой ситуации.',
          '### Why a convincing story proves nothing\n\nA good story is held together by coherence: one link flows from another, the examples are picked to fit the conclusion, and the whole text sounds like an explanation. The brain takes such coherence for plausibility — a well-known feature of our thinking, described in detail by Daniel Kahneman in "Thinking, Fast and Slow". A coherent story is pleasant to hear, but it does not replace observation and comparison.\n\n### Confidence is a feeling, not a measurement\n\nConfidence reports how smoothly the story came together in your head, not how well it matches the world. Kahneman gives the example of investment analysts: their market forecasts for the year ahead barely match what actually happens, yet they are fully confident in every forecast. They were wrong not because they were stupid, but because confidence does not measure accuracy.\n\n### Three questions for any claim\n\nInstead of rating the impression, ask three boring questions. What was observed: the facts themselves, fact-like things, or someone else’s opinion? How was it compared: what was the claim set against to show that the cause worked? Which results would the conclusion rule out: what would have to happen for the claim to be wrong? If there is no answer to the third question, the claim rules nothing out — which means it explains nothing.\n\nThese three questions return in every lesson of the course, applied to different situations.',
        ),
      },
      {
        id: 'practice', kind: 'text', step: 'practice',
        title: bi('Разберите одно «очевидное» утверждение', 'Practice: take one "obvious" claim'),
        body: bi(
          'Возьмите последнее утверждение, которое вы недавно приняли или отвергли, не проверяя: из новости, рекламы, разговора или собственной привычки. Запишите его одним предложением и задайте ему три вопроса из этого урока.\n\nЧто наблюдали: есть ли наблюдение, или только чужая уверенность? Как сравнивали: с чем сопоставляли? Чему вывод противоречил бы: какой результат опроверг бы утверждение? Если на какой-то вопрос не нашлось ответа, это не повод расстраиваться — это и есть находка: вы нашли место, где убеждение держится на впечатлении.',
          'Take the last claim you recently accepted or rejected without checking: from news, advertising, a conversation, or your own habit. Write it down in one sentence and ask it the three questions from this lesson.\n\nWhat was observed: is there any observation at all, or only someone else’s confidence? How was it compared: compared with what? Which results would the conclusion rule out: what result would disprove the claim? If you cannot answer one of the questions, that is no reason to be upset — it is a finding: you have located the spot where the belief rests on an impression.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.base-rate',
    title: bi('Базовая ставка, или как часто это обычно бывает', 'The base rate: what usually happens'),
    summary: bi(
      'Прежде чем верить тесту или истории, спросите, как часто это бывает вообще; разбор примера с редкой болезнью.',
      'Before trusting a test or a story, ask how often it happens at all; a worked example with a rare disease.',
    ),
    introduces: ['scithink.base-rate'],
    uses: ['scithink.confidence'],
    minutes: 15,
    sources: sources([KAHNEMAN_EN, BASE_RATE_EN], [KAHNEMAN_RU, BASE_RATE_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Скрининг обнаружил болезнь, которая встречается у одного человека из тысячи. Тест хороший: он ошибается примерно в пяти случаях из ста, когда человек здоров. Вам звонят и сообщают положительный результат. Первое желание — паниковать, ведь тест «на 95% верный».\n\nСтрах понятен, но перед решениями стоит задать вопрос, который интуиция пропускает: как это бывает обычно? Этот вопрос и есть главный инструмент урока.',
          'A screening test found a disease that occurs in one person per thousand. The test is good: when a person is healthy, it is wrong in about five cases per hundred. You get a call with a positive result. The first urge is to panic, because the test is "95% accurate".\n\nThe fear is understandable, but before making decisions it is worth asking the question intuition skips: how does this usually go? That question is the main tool of this lesson.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Сначала — что обычно бывает', 'First — what usually happens'),
        body: bi(
          '### Базовая ставка\n\n[[scithink.base-rate]] — это то, как часто явление встречается в целом, без всяких тестов и историй. Болезнь из примера есть у одного человека из тысячи, значит базовая ставка болезни — одна десятая процента. Интуиция смотрит на конкретный случай — ваш результат, ваш знакомый, вашу ситуацию — и игнорирует распределение. Поэтому положительный тест на редкую болезнь ощущается как приговор, хотя чаще всего это ложная тревога.\n\n### Считаем на тысяче людей\n\nСкладывать проценты в голове трудно, поэтому разложим ситуацию на тысячу человек. Болезнь есть у одного из тысячи, и тест его, скорее всего, обнаружит. Остальные 999 здоровы, но у пяти процентов из них тест ошибётся и покажет болезнь, которой нет: это примерно пятьдесят человек. Итого положительный результат получили один больной и примерно пятьдесят здоровых.\n\nВопрос «что вероятнее, я больной или здоровый с ложной тревогой» теперь отвечает себе сам: среди положительных результатов настоящих больных примерно один из пятидесяти, то есть около двух процентов. Тест не стал плохим — он и был хорошим. Просто болезнь встречается так редко, что даже редкие ошибки теста дают больше ложных тревог, чем настоящих находок.\n\n### Как этим пользоваться\n\nПеред тем как верить результату, спросите три вещи: какова базовая ставка явления; насколько хорош инструмент, которым его искали; что получится, если перемножить одно на другое на понятной группе людей. Этот приём называется подсчётом в натуральных частотах, и он спасает от большинства паник по тестам.',
          '### The base rate\n\nThe [[scithink.base-rate]] is how often a phenomenon occurs overall, with no tests or stories involved. The disease in the example affects one person per thousand, so its base rate is one tenth of a percent. Intuition looks at the particular case — your result, your acquaintance, your situation — and ignores the distribution. That is why a positive test for a rare disease feels like a verdict, when most often it is a false alarm.\n\n### Counting on a thousand people\n\nMentally adding percentages is hard, so let us lay the situation out over a thousand people. One of the thousand has the disease, and the test will most likely catch it. The remaining 999 are healthy, but for five percent of them the test errs and shows a disease they do not have: that is about fifty people. In total, one sick person and about fifty healthy people received a positive result.\n\nThe question "what is more likely — that I am sick or that I am healthy with a false alarm" now answers itself: among positive results, about one in fifty is a genuine case, that is around two percent. The test did not get worse — it was always good. The disease is just so rare that even the test’s rare errors produce more false alarms than real findings.\n\n### How to use this\n\nBefore trusting a result, ask three things: what is the base rate of the phenomenon; how good is the instrument used to look for it; what comes out when you multiply the two on a group of people you can picture. This technique is called counting with natural frequencies, and it saves you from most test-related panics.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.base-rate-result', 'scithink.q.base-rate-rare'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.anecdote',
    title: bi('Один случай против распределения', 'One case against the distribution'),
    summary: bi(
      'Что рассказывает история «мой дед курил и дожил до 90» и чего не рассказывает; выборка, размер группы и регрессия к среднему.',
      'What the story "my grandfather smoked and lived to 90" tells and what it does not; samples, group size and regression to the mean.',
    ),
    introduces: ['scithink.regression'],
    uses: ['scithink.base-rate'],
    minutes: 12,
    sources: sources([KAHNEMAN_EN, REGRESSION_EN], [KAHNEMAN_RU, REGRESSION_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Разговор о вреде курения знаком каждому: «А мой дед курил всю жизнь и дожил до девяноста». Аргумент звучит победно, потому что противопоставляет сухой вывод и живого человека. Но что доказал этот пример?\n\nДед, который дожил до девяноста, — настоящий. Его жизнь, вполне возможно, была интересной. Но один прожитый случай не говорит, что обычно бывает с курящими. Для этого нужно другое устройство наблюдения.',
          'Everyone knows the conversation about the harm of smoking: "My grandfather smoked all his life and lived to ninety." The argument sounds triumphant because it sets a living person against a dry conclusion. But what exactly has this example proven?\n\nThe grandfather who lived to ninety is real. His life may well have been interesting. But one lived case does not say what usually happens to smokers. For that, observation needs a different arrangement.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Что видит один случай и что видит группа', 'What one case shows and what a group shows'),
        body: bi(
          '### Выборка из одного\n\nКогда вы слышите один рассказ, вы смотрите на выборку из одного человека. Такая выборка хорошо передаёт одно: что случилось с конкретным дедом. Она ничего не говорит о распределении — о том, как делятся исходы между тысячами курящих и некурящих. Распределение — это и есть ответ на вопрос «что обычно бывает», и один случай его не показывает по определению: чтобы увидеть, что бывает чаще, нужно посмотреть на много случаев сразу.\n\nЧисла, которые собирают по большим группам, не спорят с дедом и не обесценивают его жизнь. Они отвечают на другой вопрос: каковы шансы в среднем. Доживший до девяноста курильщик вполне укладывается в картину, где курение в среднем сокращает жизнь, потому что «в среднем» никогда не означало «со всеми».\n\n### Регрессия к среднему\n\nЕсть вторая ловушка, которая подстерегает даже тех, кто уже смотрит на группы. [[scithink.regression]] — это тенденция повторных измерений возвращаться к обычному уровню. Канеман описывает её на примере лётных инструкторов: курсант, которого похвалили за чистое выполнение фигуры, на следующем заходе чаще летал хуже, а тот, кого отругали, лучше. Инструкторы делали вывод «ругать работает, хвалить вредит». На самом деле выдающийся заход почти всегда включал и удачу, а удача редко повторяется дважды подряд: после лучшего результата следующий чаще ближе к среднему, после худшего — тоже ближе к среднему. Хвала тут ни при чём.\n\nЭто наблюдение отбирает у нас иллюзию, что мы управляем случайностью, поэтому его стоит запомнить особенно тщательно: если результат необычно хороший или необычно плохой, следующий замер скорее будет обычнее, без всякой причины, которую нужно искать.',
          '### A sample of one\n\nWhen you hear one story, you are looking at a sample of one person. Such a sample conveys one thing well: what happened to a particular grandfather. It says nothing about the distribution — how outcomes split between thousands of smokers and non-smokers. The distribution is the answer to "what usually happens", and one case does not show it by definition: to see what happens more often, you have to look at many cases at once.\n\nNumbers collected over large groups do not argue with the grandfather and do not belittle his life. They answer a different question: what the odds are on average. A smoker who lived to ninety fits perfectly into a picture where smoking shortens life on average, because "on average" never meant "with everyone".\n\n### Regression to the mean\n\nThere is a second trap waiting even for those who already look at groups. [[scithink.regression]] is the tendency of repeated measurements to return to the usual level. Kahneman describes it with flight instructors: a cadet praised for a clean manoeuvre usually flew worse on the next attempt, and the one who was scolded flew better. The instructors concluded that scolding works and praise backfires. In fact, an outstanding attempt almost always included some luck, and luck rarely repeats twice in a row: after the best result the next one is usually closer to average, and after the worst one also closer to average. Praise had nothing to do with it.\n\nThis observation takes away our illusion that we control randomness, so it deserves to be remembered especially carefully: if a result is unusually good or unusually bad, the next measurement will more likely be more ordinary, with no cause to hunt for.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.anecdote-grandpa', 'scithink.q.regression-praise'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.correlation',
    title: bi('Почему совместный рост не доказывает причину', 'Growing together is not a cause'),
    summary: bi(
      'Корреляция и причинность: лёд и утопления, третий фактор и обратная причинность; интерактивная схема с двумя ручками и проверкой внутри групп.',
      'Correlation and causation: ice cream and drowning, the third factor and reverse causation; an interactive scheme with two dials and the within-groups check.',
    ),
    introduces: ['scithink.correlation', 'scithink.confounder'],
    uses: ['scithink.base-rate'],
    minutes: 18,
    sources: sources([SPIEGELHALTER_EN, CORRELATION_EN], [SPIEGELHALTER_RU, CORRELATION_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Статистика курортного города за лето: когда растут продажи мороженого, растёт и число утоплений. Коэффициент корреляции высокий, зависимость красивая, и кто-то обязательно предложит запретить мороженое ради безопасности на воде.\n\nЗдравый смысл протестует, но почему именно? Не потому, что «всё равно всё это статистика», а потому, что есть конкретная структура, в которой мороженое ни при чём. Урок покажет эту структуру на схеме, которую вы будете двигать сами.',
          'A resort town’s summer statistics: when ice cream sales go up, so does the number of drownings. The correlation coefficient is high, the dependence is pretty, and someone will surely suggest banning ice cream for water safety.\n\nCommon sense objects, but why exactly? Not because "it is all just statistics anyway", but because there is a concrete structure in which ice cream is not involved. This lesson shows that structure on a diagram you will drive yourself.',
        ),
      },
      {
        id: 'look-intro', kind: 'text', step: 'look',
        title: bi('Что показывает схема', 'What the diagram shows'),
        body: bi(
          'Схема моделирует одно лето в курортном городе. Слева — продажи мороженого, справа — число утоплений, внизу — третий участник, которого в заголовках обычно не упоминают: жара. Показатель под схемой, r, — это сила совместного роста мороженого и утоплений по баллам из ста; сто баллов означают, что графики двигаются вместе всегда, ноль — что совместный рост не наблюдается.\n\nНачните с ползунка «Сила связи на виду»: он задаёт, насколько вместе растут продажи и число утоплений. Потом двигайте ползунок «Доля связи, которую объясняет жара» — он задаёт, какую долю совместного роста в этой модели создаёт жара. Оставшаяся часть связи в модели ничем не объяснена: она может означать другую общую причину, случайность или прямое влияние, и сама модель между ними не выбирает. Карточки узлов и линий открываются щелчком и объясняют, кто есть кто.\n\nПосле первого прохода включите в разделе «Поломки» сравнение дней с одинаковой жарой и посмотрите, что станет с показателем r под схемой. Такое сравнение показывает, сколько связи остаётся, когда жара одинакова: если связь пропала, её создавала жара; если уменьшилась, жара объясняла часть; если осталась прежней, жара её не объясняет, но и причину это ещё не доказывает.',
          'The diagram models one summer in a resort town. On the left — ice cream sales, on the right — the number of drownings, and at the bottom a participant the headlines usually skip: hot weather. The metric under the diagram, r, is the strength of the joint rise of ice cream and drownings in points out of a hundred; a hundred means the graphs always move together, zero means no joint rise is observed.\n\nStart with the "Strength of the visible link" dial: it sets how closely sales and drownings rise together. Then move the "Share of the link explained by heat" dial: it sets how much of the joint rise is actually driven by heat rather than ice cream. Cards on nodes and lines open on click and explain who is who.\n\nAfter the first pass, switch on the within-groups comparison under "Breakages" and watch what happens to the r metric under the diagram. That check is what separates an accidental link from a real one.',
        ),
      },
      {
        id: 'scheme', kind: 'explainer', step: 'look', explainer: 'scithink.correlation',
        howto: bi(
          'Листайте шаги стрелками под схемой. Двигайте два ползунка в «Параметрах»: сначала «Сила связи на виду», потом «Доля связи, которую объясняет жара». На третьем шаге включите в «Поломках» сравнение дней с одинаковой жарой и посмотрите, что стало с r под схемой. Карточки узлов и линий открываются щелчком.',
          'Step through with the arrows under the diagram. Move the two dials under "Parameters": first the strength of the visible link, then the share explained by heat. On the third step, switch on the same-heat comparison under "Breakages" and watch what happens to the r metric under the diagram. Cards on nodes and lines open on click.',
        ),
        caption: bi(
          'Совместный рост мороженого и утоплений остаётся наблюдением, и механизма он не показывает. Как только жару фиксируют, ложная связь исчезает; если бы связь осталась, причину стоило бы искать всерьёз.',
          'The joint rise of ice cream and drownings is an observation, not a mechanism. Once heat is held fixed, the spurious link disappears; if the link survived, the cause would be worth a serious look.',
        ),
      },
      {
        id: 'practice', kind: 'text', step: 'practice',
        title: bi('Три пары совпадений из жизни', 'Practice: three pairs from life'),
        body: bi(
          'Разберите три пары явлений и для каждой назовите наиболее вероятную структуру: настоящая причина, третий фактор или обратная причинность.\n\nПервая пара: у людей с зонтами одежда мокрее, чем у людей без зонтов. Здесь нет тайны: дождь мокнет сам и заставляет брать зонты, это общая причина. Вторая пара: дети, которые много смотрят телевизор, чаще показывают агрессивное поведение. Здесь возможны все варианты: телевизор влияет на ребёнка, возбудимые дети тянутся к яркому экрану, а может, обстановка дома двигает и экран, и поведение; без сравнения не выбрать. Третья пара: в городах, где много полиции, больше преступлений. Полиция не вызывает преступления: туда, где преступлений и так много, направляют больше патрулей, и причинность идёт в обратную сторону.\n\nПолезное упражнение на будущее: всякий раз, когда видите красивый график «одно растёт вместе с другим», спросите, какой третий фактор мог бы двигать обеими линиями, и как выглядело бы сравнение внутри групп, где этот фактор одинаков.',
          'Take three pairs of phenomena and name the most likely structure for each: a real cause, a third factor, or reverse causation.\n\nFirst pair: people with umbrellas have wetter clothes than people without umbrellas. There is no mystery here: rain makes people wet and makes them carry umbrellas — a common cause. Second pair: children who watch a lot of television show aggressive behaviour more often. Every option is possible here: television affects the child, excitable children reach for the bright screen, or the atmosphere at home drives both the screen and the behaviour; without a comparison you cannot choose. Third pair: cities with more police have more crime. The police do not cause crime: more patrols are sent where crime is already high, so causation runs the other way.\n\nA useful exercise for the future: whenever you see a pretty graph of "one thing rising together with another", ask which third factor could drive both lines, and what a comparison within groups where that factor is equal would look like.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.control',
    title: bi('Почему «попробовал — и помогло» недоказуемо', 'Why "I tried it and it helped" proves nothing'),
    summary: bi(
      'Без сравнения эффект оценить нельзя: естественное течение болезни, ожидание и случайность; как устроена убедительная проверка.',
      'Without a comparison an effect cannot be rated: the natural course of illness, expectation and chance; how a convincing check is arranged.',
    ),
    introduces: ['scithink.control', 'scithink.placebo'],
    uses: ['scithink.regression'],
    minutes: 12,
    sources: sources([SPIEGELHALTER_EN, RCT_EN], [SPIEGELHALTER_RU, RCT_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Простуда мучила неделю, друг посоветовал тёплое молоко с чем-то ароматным, вы выпили, и наутро стало лучше. «Видишь, помогло!» — говорит друг, и вам хочется согласиться. Такое случается постоянно: обезболивающее, обертывание, новая подушка, приложенная на удачу монетка.\n\nУлучшение настоящее — выздороветь и вправду помогло. Вопрос в другом: чем помогло. Без устройства сравнения честный ответ — неизвестно, и урок объясняет, как это сравнение устроить.',
          'A cold bothered you for a week, a friend advised warm milk with something fragrant, you drank it, and by morning you felt better. "See, it worked!" says the friend, and you want to agree. It happens all the time: a painkiller, a wrap, a new pillow, a coin kept for luck.\n\nThe improvement is real — you truly did get better. The question is different: what made you better. Without an arrangement for comparison the honest answer is "unknown", and this lesson explains how that comparison is built.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Чем «мне помогло» отличается от «это работает»', 'How "it helped me" differs from "it works"'),
        body: bi(
          '### Три объяснения одного улучшения\n\nКогда после приёма средства стало лучше, в игре минимум три силы. Первая — естественное течение: простуда проходит сама примерно за неделю, и улучшение случилось бы без всякого молока. Вторая — ожидание: если человек верит в средство, его самочувствие часто улучшается уже от одного ритуала приёма, даже когда средство физиологически нейтрально; этот эффект настолько надёжен, что исследователи специально сравнивают средство с пустышкой, которую называют [[scithink.placebo]] и которая сама по себе даёт измеримое улучшение. Третья — случайность: день к дню самочувствие скачет, и хороший день легко принять за заслугу средства. Мы уже знаем про [[scithink.regression]]: после плохого дня следующий скорее будет лучше сам по себе.\n\nОдиночный случай не разделяет эти три силы, поэтому и не доказывает ничего про средство.\n\n### Сравнение, которое что-то решает\n\nЧтобы понять, работает ли средство, нужна [[scithink.control]]: такая же по составу группа, которая не получает средства, и дальше сравниваются ход дел в обеих. Заранее, до начала сравнения, решают, что именно и когда измерят: например, долю выздоровевших к седьмому дню и среднее число дней с температурой. Если к седьмому дню выздоровели все в обеих группах, это не значит, что средство бесполезно: оно могло сократить болезнь на день или облегчить симптомы, и об этом скажет только второй измеренный показатель. Если в группе со средством выздоровевших больше, это ещё не доказательство: разница бывает и случайной, особенно в маленьких группах, поэтому смотрят, насколько она велика по сравнению с обычным разбросом от группы к группе. Участников распределяют по группам случайно, например жребием, чтобы в одну группу не попали более лёгкие больные. Лучше всего, когда участники не знают, в какой они группе: тогда ожидание действует одинаково в обеих группах и не искажает сравнение.\n\nВ быту такое почти никогда не устроить честно — и это нормально. Польза урока в другом: когда вы слышите «мне помогло», вы теперь понимаете, что это утверждение доказало (что один человек почувствовал себя лучше) и что не доказало (что в следующий раз поможет другому). А иногда жизнь сама устраивает сравнение: естественный эксперимент, когда группы складываются без вмешательства исследователя. Пример: города, которые случайно в разное время перешли на новые лампы освещения улиц; разница в числе аварий до и после в таких городах говорит о лампах гораздо больше, чем история одного перекрёстка, где «сразу стало светлее».',
          '### Three explanations for one improvement\n\nWhen you feel better after taking a remedy, at least three forces are in play. The first is the natural course: a cold passes by itself in about a week, and the improvement would have happened with no milk at all. The second is expectation: if a person believes in the remedy, their condition often improves from the very ritual of taking it, even when the remedy is physiologically neutral; this effect is so reliable that researchers specifically compare a remedy with a dummy called a [[scithink.placebo]], which by itself produces a measurable improvement. The third is chance: well-being swings from day to day, and a good day is easily credited to the remedy. We already know about [[scithink.regression]]: after a bad day the next one is more likely to be better on its own.\n\nA single case cannot separate these three forces, which is why it proves nothing about the remedy.\n\n### A comparison that decides something\n\nTo find out whether a remedy works you need a [[scithink.control]]: a group similar in composition that does not receive the remedy, and then the course of events is compared between the two. If after a week everyone in both groups has recovered, the illness drove the improvement, not the remedy. If noticeably more of those who took the remedy recovered, there is an effect. Ideally the participants do not know which group they are in: then expectation is spread evenly and does not spoil the comparison.\n\nIn everyday life this is almost never arranged honestly — and that is fine. The lesson’s use is elsewhere: when you hear "it helped me", you now understand what that claim proved (that one person felt better) and what it did not (that it will help someone else next time). And sometimes life arranges the comparison itself: a natural experiment, where groups form without the researcher’s intervention. Example: cities that happened to switch to new street lighting at different times; the difference in the number of accidents before and after in such cities says far more about the lamps than the story of one intersection where "it immediately became brighter".',
        ),
      },
      {
        id: 'practice', kind: 'text', step: 'practice',
        title: bi('Чек-лист убедительной проверки', 'Practice: the convincing-check checklist'),
        body: bi(
          'Вот короткий чек-лист, который можно применять к любому «это работает».\n\n- Есть ли группа сравнения, похожая на ту, что получала средство.\n- Совпали ли группы по важным признакам: возраст, тяжесть состояния, обстановка.\n- Знали ли участники, что они получают.\n- Замеряли результат одинаково в обеих группах.\n- Сколько случаев вошло в проверку: один рассказ, десять человек или тысяча.\n\nПримените этот чек-лист к последнему совету, который вам помог «наверняка»: чем из списка этот совет располагает, чего не хватает, и какой пункт вы бы проверили первым.',
          'Here is a short checklist you can apply to any "it works".\n\n- Is there a comparison group similar to the one that received the remedy.\n- Do the groups match on the things that matter: age, severity, circumstances.\n- Did participants know what exactly they were receiving.\n- Was the outcome measured the same way in both groups.\n- How many cases entered the check: one story, ten people, or a thousand.\n\nApply this checklist to the last piece of advice that helped you "for sure": which items does the advice have, which are missing, and which one would you check first.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.studies',
    title: bi('Как читать «исследования показали»', 'How to read "studies show"'),
    summary: bi(
      'Выборка, группа сравнения, плацебо и публикационное смещение — что спросить у любой научной новости.',
      'Sample, comparison group, placebo and publication bias — what to ask of any piece of science news.',
    ),
    introduces: [],
    uses: ['scithink.control', 'scithink.placebo'],
    minutes: 15,
    sources: sources([SPIEGELHALTER_EN, PUB_BIAS_EN], [SPIEGELHALTER_RU, PUB_BIAS_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          '«Исследование: шоколад способствует похудению» — заголовок встречается в ленте регулярно, вместе с «учёные нашли» и «доказано». Под заголовком обычно один абзац, и почти никогда — ответа на вопросы, которые делают исследование исследованием.\n\nХорошая новость в том, что задавать эти вопросы может любой человек, без научной степени. Достаточно четырёх: кого изучали, с чем сравнивали, как измеряли и где ещё об этом писали.',
          '"Study: chocolate aids weight loss" — such a headline appears in the feed regularly, along with "scientists have found" and "proven". Under the headline there is usually one paragraph, and almost never answers to the questions that make a study a study.\n\nThe good news is that anyone can ask these questions, no degree required. Four are enough: who was studied, what was it compared with, how was it measured, and where else it was written about.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Четыре вопроса к научной новости', 'Four questions for a science headline'),
        body: bi(
          '### Кого изучали\n\nПервая строчка, которую стоит искать: сколько человек участвовало и как их отбирали. Двадцать студентов колледжа, записавшихся за деньги, — это не «люди», а очень специфическая группа. Маленькая и однородная выборка не делает результат ложным, но сужает его: вывод может быть верен для этих двадцати человек в эти две недели, и это ещё надо показать.\n\n### С чем сравнивали\n\nВторой вопрос — про [[scithink.control]]. Если группы не было, новость описывает наблюдение: люди ели шоколад и худели, скажем, потому, что во время эксперимента весной все больше двигаются. Без группы сравнения отделить эффект продукта от обстановки невозможно. Если группа была, следующий вопрос — знали ли участники, что получают; без этого ожидание, как вы помните, остаётся главным подозреваемым.\n\n### Как измеряли\n\nТретий вопрос — про сам результат: что замеряли и насколько точно. «Почувствовали себя лучше» и «снизился вес на два килограмма за месяц» — разного качества утверждения. Точность замера решает, имеет ли смысл спорить о причине.\n\n### Где ещё об этом писали\n\nЧетвёртый вопрос самый неочевидный. Журналы и журналисты охотнее пишут о найденном эффекте, чем о том, что эффекта не вышло: у «нашли!» выше шансы попасть в печать. В результате лента новостей перекошена в сторону сенсаций — это называется публикационным смещением. Одинокое «исследование показало» в новостях стоит перепроверить, прежде чем менять из-за него привычки. Дэвид Шпигельхалтер в книге «Искусство статистики» разбирает такие случаи подробно и спокойно: одиночное исследование начинает разговор и не заканчивает его.',
          '### Who was studied\n\nThe first line worth looking for: how many people took part and how they were recruited. Twenty college students who signed up for money are not "people" but a very specific group. A small, homogeneous sample does not make a result false, but narrows it: the conclusion may hold for these twenty people over these two weeks, and that still has to be shown.\n\n### What was it compared with\n\nThe second question is about the [[scithink.control]]. If there was no group, the news describes an observation: people ate chocolate and lost weight, perhaps because in spring, during the experiment, everyone moves more. Without a comparison group, the product’s effect cannot be separated from the circumstances. If there was a group, the next question is whether the participants knew what they were getting; without that, expectation remains the main suspect, as you remember.\n\n### How was it measured\n\nThe third question is about the result itself: what exactly was measured and how precisely. "Felt better" and "lost two kilograms in a month" are claims of different quality. The precision of the measurement decides whether arguing about the cause makes sense at all.\n\n### Where else it was written about\n\nThe fourth question is the least obvious. Journals and journalists prefer writing about a found effect rather than about a missing one: "we found it!" has a better chance of getting into print. As a result, the news feed tilts toward sensations — this is called publication bias. A lonely "a study shows" in the news is a candidate for re-checking, not for changing habits. David Spiegelhalter’s "The Art of Statistics" dissects such cases in detail and calmly: a single study is the beginning of a conversation, not its end.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.studies-sample', 'scithink.q.studies-publication'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.calibration',
    title: bi('Как научиться говорить «не знаю» в процентах', 'Calibration: learning to say "I don’t know" in percent'),
    summary: bi(
      'Уверенность и доля правоты — разные вещи; тренажёр: десять утверждений, уверенность в процентах, кривая калибровки.',
      'Confidence and the share of being right are different things; a trainer: ten claims, percent confidence, a calibration curve.',
    ),
    introduces: ['scithink.calibration'],
    uses: ['scithink.confidence'],
    minutes: 15,
    sources: sources([TETLOCK_EN, OVERCONF_EN], [TETLOCK_RU, OVERCONF_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          '«Я сто процентов уверен» — фраза из каждого спора. Филип Тетлок, изучавший прогнозы десятки лет, приводит результаты скромнее: когда людям в лаборатории давали вопросы общих знаний и просили назвать уверенность, те, кто называл стопроцентную уверенность, ошибались примерно в каждом четвёртом случае. Ощущение уверенности и частота правоты расходятся почти у всех и почти всегда в одну сторону: уверенность выше реальной точности.\n\nЭто не порок характера, а устройство мышления, и с ним можно работать. Первый шаг — научиться выражать неуверенность числом, а второй — увидеть свою картину наглядно.',
          '"I am a hundred percent sure" — a phrase from every argument. Philip Tetlock, who studied forecasts for decades, cites more modest results: when people in a lab were given general-knowledge questions and asked for their confidence, those who named a hundred percent certainty were wrong in about every fourth case. The feeling of confidence and the rate of being right diverge for almost everyone and almost always in one direction: confidence runs above real accuracy.\n\nThis is not a character flaw but a feature of thinking, and it can be worked with. The first step is learning to express uncertainty as a number, and the second is to see your own picture clearly.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Что такое калибровка', 'What calibration is'),
        body: bi(
          '[[scithink.calibration]] — это соответствие между названной уверенностью и долей правоты. Хорошо откалиброванный человек, который сотню раз сказал «уверен на восемьдесят процентов», оказывается прав примерно в восьмидесяти случаях из ста. Если он прав только в шестидесяти — уверенность была украшением, и оценкой её назвать нельзя. Если прав в девяноста пяти — он, наоборот, слишком скромен, и это тоже ошибка, только обратную сторону.\n\nПольза от числа вместо громкости слов огромная. «Я уверен на 70%» — это приглашение к разговору и к проверке, а «я абсолютно уверен» — конец разговора. Кроме того, числа можно накапливать и смотреть на свою статистику: так тренируются прогнозисты, о которых пишет Тетлок.\n\nВ тренажёре ниже десять утверждений о вещах вокруг нас. Для каждого двигайте ползунок: насколько вы уверены, что утверждение правдиво, от нуля до ста процентов. Пятьдесят процентов означают «понятия не имею». После всех десяти нажмите «Показать, что правда», и тренажёр нарисует вашу кривую калибровки.',
          '[[scithink.calibration]] is the match between stated confidence and the share of being right. A well-calibrated person who said "eighty percent sure" a hundred times turns out to be right in about eighty of them. If they are right only sixty times, the confidence was decoration, not an estimate. If right in ninety-five, they are too modest, which is also an error, only facing the other way.\n\nThe benefit of a number instead of the loudness of words is huge. "I am 70% sure" is an invitation to talk and to check, while "I am absolutely sure" ends the conversation. Besides, numbers can be collected and your own statistics viewed: that is exactly how the forecasters Tetlock writes about train.\n\nIn the trainer below there are ten claims about the world around us. For each, move the slider: how sure you are that the claim is true, from zero to a hundred percent. Fifty percent means "no idea". After all ten, press "Show what is true" and the trainer will draw your calibration curve.',
        ),
      },
      {
        id: 'howto', kind: 'text', role: 'howto',
        title: bi('Как пользоваться тренажёром', 'How to use the trainer'),
        body: bi(
          'Для каждого утверждения двигайте ползунок «Насколько это правда» и выбирайте уверенность от 0 до 100%. Пятидесять процентов означают «понятия не имею, либо правда, либо ложь». Отвечайте по первому впечатлению, не подглядывая в интернет: тренируется ваша оценка, и поиск ей только помешает. Когда ответите на все десять, нажмите «Показать, что правда» — появятся вердикты и кривая калибровки. Ответы сохраняются в этом браузере: можно вернуться позже и пройти ещё раз.',
          'For each claim, move the "How true is this" slider and pick your confidence from 0 to 100%. Fifty percent means "no idea, could go either way". Answer from the first impression, without looking things up: the trainer exercises your estimate, not your search. When you have answered all ten, press "Show what is true" — verdicts and the calibration curve will appear. Answers are saved in this browser: you can come back later and run it again.',
        ),
      },
      { id: 'trainer', kind: 'widget', step: 'practice', widget: 'scithink.calibration' },
      {
        id: 'read', kind: 'text', step: 'review',
        title: bi('Как читать свою кривую', 'How to read your curve'),
        body: bi(
          'На графике горизонталь — вероятность, которую вы назвали для того, что утверждение правдиво, вертикаль — доля правдивых среди утверждений, которым вы дали эту вероятность. Серый отрезок — идеальная калибровка: из утверждений, которым вы дали 70 %, правдивыми оказались семь из десяти. Точка выше серого отрезка значит, что утверждения с этой вероятностью оказывались правдивыми чаще, чем вы ожидали, и вы были осторожнее, чем стоило. Точка ниже значит, что они оказывались правдивыми реже: вы им слишком доверяли.\n\nДесять утверждений — маленькая выборка, поэтому выводы из одного прогона держите осторожно, как из любого маленького наблюдения из урока про выборки. Повторный проход на тех же десяти утверждениях покажет, что вы запомнили ответы, а не как изменилась калибровка. Чтобы тренировать её, нужны новые вопросы: записывайте вероятности для своих рабочих ожиданий, например выйдет ли выпуск в срок или ответит ли клиент на этой неделе, и раз в месяц сверяйте их с исходом. Так тренируются прогнозисты: регулярные оценки в процентах, разбор промахов и никаких «я же говорил» задним числом.',
          'On the chart, the horizontal axis is your stated confidence and the vertical one is the share of claims that turned out true. The grey segment is perfect calibration: points lie on it when confidence matches being right. Points above the grey segment mean you undersold yourself (you were right more often than you promised); points below mean overconfidence: you named high confidence where you erred more often.\n\nTen claims are a small sample, so treat the conclusions of one run with the same caution as any small observation from the lesson about samples. The trainer’s value accumulates with repetition: run it again in a couple of days, honestly trying to recall rather than remember the answers, and see whether the picture moved. That is how forecasters train: regular bets in percent, reviews of misses, and no "I told you so" after the fact.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.bayes',
    title: bi('Байес за двадцать минут', 'Bayes in twenty minutes'),
    summary: bi(
      'Данные сдвигают уверенность и не заменяют её целиком; пошаговый разбор частотного подсчёта.',
      'Confidence updates with data instead of being replaced by it; a step-by-step frequency count.',
    ),
    introduces: ['scithink.bayes'],
    uses: ['scithink.base-rate'],
    minutes: 20,
    sources: sources([BAYES_EN, SPIEGELHALTER_EN], [BAYES_RU, SPIEGELHALTER_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Возвращаемся к положительному тесту из урока про [[scithink.base-rate]]. Там мы получили два процента и, надеюсь, усомнились в панике. Сейчас посмотрим на ту же ситуацию с другой стороны — как на обновление уверенности по новым данным, — и получим инструмент, который работает для тестов, новостей, споров и любых других свидетельств.\n\nИнструмент этот зовётся именем Томаса Байеса, английского священника XVIII века, и всё, что нам от него нужно, — одна мысль и один приём счёта.',
          'Let us return to the positive test from the lesson on the [[scithink.base-rate]]. There we got two percent and, I hope, doubted the panic. Now we look at the same situation from another side — as an update of confidence with new data — and get a tool that works for tests, news, arguments and any other evidence.\n\nThe tool carries the name of Thomas Bayes, an 18th-century English minister, and everything we need from him is one idea and one counting technique.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Одна мысль и один приём счёта', 'One idea and one counting technique'),
        body: bi(
          '### Как данные сдвигают уверенность\n\n[[scithink.bayes]] начинается с простого: у вас уже есть какое-то представление о мире — пусть скромное. Болезнь из примера встречается у одного из тысячи, и это ваше стартовое мнение до всяких тестов. Тест — это новые данные, и они должны сдвинуть мнение; стирать его и писать заново не нужно. Хороший тест сдвигает сильно, плохой — слабо, ложная новость — в никуда или назад. Направление и размер сдвига считаются, и это снимает главную проблему интуиции: её склонность заменять «как обычно бывает» яркой новой деталью.\n\n### Как считать в людях вместо процентов\n\nПроценты в голове складываются плохо, поэтому байесовский пересчёт удобно делать в людях — так же, как в уроке про базовую ставку. Разложим ситуацию на десять тысяч человек.\n\nБолезнь есть у одного из тысячи, значит среди десяти тысяч будет около десяти больных. Тест обнаруживает болезнь у девяти из десяти больных — это девять настоящих срабатываний. Здоровых около девяти тысяч девятисот девяноста, и у пяти процентов из них, то есть примерно у пятисот, тест ошибётся.\n\nИтого положительный результат получили девять больных и примерно пятьсот здоровых. Вероятность болезни при положительном результате — девять делить на пятьсот девять, примерно два процента. Совпало с прошлым уроком, потому что считали одно и то же.\n\n### Что тут важно запомнить\n\nСтартовая частота, одна из тысячи, и качество теста работали вместе: первое задало масштаб, второе — перекос. Если бы болезнь встречалась у каждого пятого, те же самые девять из десяти обнаруженных случаев легли бы на две тысячи заболевших, и картина после положительного теста была бы совсем другой. Поэтому формула Байеса — это не про тесты, а про порядок: сначала сколько бывает, потом что показали данные, потом пересмотренная оценка. Каждая новая порция данных проделывает тот же шаг снова, и уверенность приближается к миру по ступенькам, без прыжков.',
          '### The idea: data moves confidence, it does not replace it\n\n[[scithink.bayes]] starts with something simple: you already hold some picture of the world — let it be a modest one. The disease from the example occurs in one person per thousand, and that is your starting view before any test. A test is new data, and it should shift the view, not erase it and write anew. A good test shifts far, a poor one slightly, a fake piece of news nowhere or backwards. The direction and size of the shift are computed, and this removes intuition’s main problem: its habit of replacing "what usually happens" with a bright new detail.\n\n### The technique: count people, not percentages\n\nPercentages add poorly in the head, so the Bayesian recount is convenient to do in people — exactly as in the base-rate lesson. Let us lay the situation out over ten thousand people.\n\nThe disease affects one in a thousand, so among ten thousand there will be about ten sick people. The test detects the disease in nine of ten sick people — nine true positives. The healthy number about nine thousand nine hundred ninety, and for five percent of them, that is about five hundred, the test will err.\n\nIn total, nine sick people and about five hundred healthy people received a positive result. The probability of disease given a positive result is nine divided by five hundred nine, about two percent. It matches the last lesson because we computed the same thing.\n\n### What is worth remembering here\n\nThe starting frequency, one per thousand, and the quality of the test worked together: the first set the scale, the second the tilt. If the disease occurred in every fifth person, the same nine detected cases would lie on two thousand sick people, and the picture after a positive test would be quite different. That is why Bayes’ rule is not about tests but about order: first how often it happens, then what the data showed, then the revised estimate. Each new portion of data makes the same step again, and confidence approaches the world by stairs, not by a jump.',
        ),
      },
      {
        id: 'practice', kind: 'text', step: 'practice',
        title: bi('Разбор новости о находке', 'Practice: a news item about a find'),
        body: bi(
          'Устройте пересчёт для новостной ситуации. Скрининговая программа нашла у одного жителя из ста заболевание, которое до скрининга встречалось у одного из тысячи. Можно ли по этой новости сказать, что скрининг «в десять раз увеличил число больных»?\n\nПройдите те же три шага. Сначала базовая ставка: возьмите десять тысяч жителей, из них больны десять. Потом данные: скрининг показывает заболевание у девяти из десяти настоящих больных и ошибается примерно в одном случае из ста у здоровых — посчитайте, сколько настоящих находок и сколько ложных тревог даст проверка десяти тысяч и совпадает ли общее число находок с «одним из ста» из новости. Потом пересмотренная оценка: чему равна доля настоящих находок среди всех, кого скрининг показал больными, и что из этого следует для заголовка про «десять раз».\n\nЕсли счёт сошёлся, вы только что применили [[scithink.bayes]] к живой публикации: стартовая частота задала масштаб, данные — перекос, и заголовок «в десять раз» рассыпался, потому что сравнивал находки программы с базовой ставкой, хотя сравнивать нужно было с долей настоящих больных среди найденных.',
          'Run the recount for a news situation. A screening programme found a disease in one resident per hundred, while before the screening the disease occurred in one per thousand. Can this news item say that the screening "made the number of sick people ten times larger"?\n\nMake the same three steps. First the base rate: a thousand people, one sick person. Then the data: the screening shows the disease in nine of ten real cases and errs in about five cases per hundred among the healthy — compute how many true finds and how many false alarms a check of a thousand will produce. Then the revised estimate: what is the share of true finds among everyone the screening flagged, and what follows for the "ten times" headline.\n\nIf the numbers work out, you have just applied [[scithink.bayes]] to a live publication: the starting frequency set the scale, the data set the tilt, and the "ten times" headline fell apart because it compared the programme’s finds with the base rate instead of with the share of truly sick among those found.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.fakes',
    title: bi('Три приёма фейков и манипуляций', 'Fakes and manipulations: three moves'),
    summary: bi(
      'Эмоциональная нагрузка, подмена тезиса и поддельная экспертиза — как их узнавать и что делать вместо возмущения.',
      'Emotional load, replacing the thesis and fake expertise — how to spot them and what to do instead of getting angry.',
    ),
    introduces: ['scithink.strawman'],
    uses: ['scithink.bayes'],
    minutes: 12,
    sources: sources([BULLSHIT_EN, KAHNEMAN_EN], [BULLSHIT_RU, KAHNEMAN_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          '«Врачи скрывают: ВОТ в чём правда про ваш завтрак!» — такие посты собирают тысячи репостов, и хочется либо переслать с возмущением, либо бросить телефон. Возмущение и есть цель поста: оно делает текст запоминающимся и проверкоустойчивым.\n\nКарл Бергстрём и Джевин Вест из Университета Вашингтона собрали целый курс о таких текстах и назвали его коротко и по-студенчески — Calling Bullshit. Из их разбора и этого урока полезно унести не возмущение, а узнавание: большинство манипуляций собираются из трёх приёмов.',
          '"Doctors are hiding it: HERE is the truth about your breakfast!" — such posts gather thousands of reposts, and you feel like forwarding them in outrage or throwing the phone away. The outrage, by the way, is the post’s goal: it makes the text memorable and resistant to checking.\n\nCarl Bergström and Jevin West of the University of Washington built a whole course about such texts and gave it a short, student-grade name — Calling Bullshit. From their analysis and from this lesson it is worth carrying away not the outrage but the recognition: most manipulations are assembled from three moves.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Три приёма и противодействие им', 'Three moves and the counters'),
        body: bi(
          '### Эмоциональная нагрузка\n\nПервый приём работает на громкости: заглавные буквы, восклицательные знаки, слова про катастрофу, тайну и «все молчат». Задача — вызвать страх или гнев раньше, чем включится проверка, потому что подогретая эмоция сама подскажет аргументы. Признак узнаётся легко: если текст громит и пугает, но не называет ни источника, ни данных, ни способа проверки, — перед вами эмоциональная нагрузка вместо аргумента. Противодействие начинается с паузы: отложите реакцию на десять минут, чтобы эмоция улеглась, и задайте три вопроса из первого урока — что наблюдали, как сравнивали, чему вывод противоречил бы. Пауза не опровергает текст, она возвращает возможность его проверить.\n\n### Подмена тезиса\n\nВторой приём — [[scithink.strawman]]: оппоненту приписывают удобную глупость, которую тот не говорил, а потом блистательно её опровергают. «Специалисты хотят запретить вам есть любимое блюдо» — обычно никто запрещать ничего не собирался, речь шла о дозе или о конкретной группе людей. Признак: самый убедительный аргумент текста разбивает утверждение, которого никто не делал. Противодействие: восстановить настоящий тезис, обычно он скучнее и осторожнее, — и спорить уже с ним.\n\n### Поддельная экспертиза\n\nТретий приём — намёк на науку без науки: «исследования доказали» без ссылки, «доктор наук» без имени, «в Европе давно знают» без страны. Настоящее исследование выдерживает вопросы из урока про «исследования показали»: кого изучали, с чем сравнивали, как измеряли. Противодействие: попросить источник. Но ссылка ещё не конец проверки: откройте её и посмотрите, говорит ли исследование то, что ему приписывают, на ком его проводили, с чем сравнивали и опубликовано ли оно там, где работу проверяют другие учёные. Часто ссылка ведёт на исследование мышей, на одну небольшую группу или на текст, где вывод был осторожнее. Для оставшихся случаев работает [[scithink.bayes]]: необычное утверждение требует необычно сильных данных.\n\nЗаметьте, что возмущённый репост — это распространение текста бесплатно. Лучшая реакция на манипуляцию — короткая пометка в три вопроса без гнева и насмешки, которую увидят те, кому переслали тот же текст.',
          '### Emotional load\n\nThe first move works on loudness: capital letters, exclamation marks, words about catastrophe, secrets and "everyone is silent". The task is to trigger fear or anger before checking starts, because a heated emotion will supply the arguments by itself. The sign is easy to spot: if a text blasts and frightens but names no source, no data and no way to verify, you are looking at emotional load instead of an argument. The counter is boring and therefore reliable: postpone the reaction for ten minutes and ask the usual three questions — what was observed, how was it compared, which results would the conclusion rule out.\n\n### Replacing the thesis\n\nThe second move is the [[scithink.strawman]]: the opponent is credited with a convenient stupidity they never said, which is then brilliantly refuted. "Experts want to ban your favourite dish" — usually nobody was going to ban anything; the talk was about a dose or a specific group of people. The sign: the text’s most convincing argument demolishes a claim nobody made. The counter: restore the real thesis — it is usually more boring and careful — and argue with that.\n\n### Fake expertise\n\nThe third move is a hint of science without science: "studies have proven" with no reference, "a doctor of sciences" with no name, "Europe has long known" with no country. A real study survives the questions from the "studies show" lesson: who was studied, what was it compared with, how was it measured. A fake falls apart on the very first question. The counter: one request — "name the source" — filters out most such texts, and for the rest [[scithink.bayes]] works: an unusual claim requires unusually strong data.\n\nNotice that an angry repost is spreading the text for free. The best reaction to a manipulation is not anger and not mockery, but a short note in three questions, which will be seen by those the same text was forwarded to.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.fakes-emotion', 'scithink.q.fakes-strawman'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.numbers',
    title: bi('Три трюка с цифрами в рекламе', 'Numbers in advertising: three tricks'),
    summary: bi(
      '«До 90%», среднее вместо медианы и ось без нуля — как читать живые примеры из рекламных текстов.',
      '"Up to 90%", the average instead of the median, and an axis without zero — how to read real examples from advertising.',
    ),
    introduces: ['scithink.averages'],
    uses: ['scithink.control'],
    minutes: 12,
    sources: sources([BULLSHIT_EN, SPIEGELHALTER_EN], [BULLSHIT_RU, SPIEGELHALTER_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          '«До 90% заметили результат уже после первой недели» — фраза из рекламы крема. Рядом — график, где столбик новой зубной пасты вдвое выше старой, а внизу мелким шрифтом стоит звёздочка. Оба приёма работают на одну и ту же особенность зрителя: цифра воспринимается как факт, даже когда она подобрана так, чтобы ничего не значить.\n\nРазберём три самых ходовых трюка. Все они законны почти везде, поэтому полезна не жалоба, а чтение.',
          '"Up to 90% noticed a result after just the first week" — a line from a cream advert. Next to it, a chart where the bar of the new toothpaste is twice the old one, and a small asterisk below. Both moves exploit the same feature of the viewer: a number is perceived as a fact even when it is chosen to mean nothing.\n\nLet us take apart the three most common tricks. All of them are legal almost everywhere, so reading serves better than complaining.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('«До», среднее и обрезанная ось', '"Up to", the average, and the cropped axis'),
        body: bi(
          '### «До 90%»\n\nПервая формулировка говорит о самом лучшем случае, который случился когда-то с кем-то: девяносто процентов — это потолок, и о среднем результате эта цифра ничего не говорит, и даже этот потолок не подкреплён ничем, что мы умели бы проверять из урока про исследования. «До» превращает выброс в обещание. Встретив такое, спросите: девяносто процентов из какой группы, при каком замере, и что стало с остальными.\n\n### Среднее вместо медианы\n\nВторой трюк тоньше. [[scithink.averages]] описывают одну и ту же группу по-разному. Среднее — это сумма, делённая на число людей, а медиана — такое значение, что половина людей ниже него, а половина выше. В группе с парой очень больших значений среднее заметно выше медианы: если в кафе зашёл миллиардер, средний доход посетителей вырос в разы, хотя типичный посетитель ничего не заработал сверх обычного. Когда реклама или новость называет средний доход, среднюю оценку или средний срок службы, спросите, какова медиана: если среднее намного больше медианы, в группе есть немногие очень большие значения, которые тянут среднее вверх; сколько их и насколько они велики, по одной этой разнице не узнать, для этого нужно распределение.\n\n### Ось без нуля\n\nТретий трюк — графический. Если на диаграмме ось начинается не с нуля, а с числа побольше, разница между столбиками раздувается в разы: если ось начинается с 79, столбик со значением 80 поднимается над ней на одно деление, а столбик со значением 82 — на три, и рост на два с половиной процента выглядит трёхкратным. Приём узнаётся взглядом: проверьте, где начинается вертикальная ось. Если не с нуля — оценивайте разницу по подписям на оси; высота столбиков здесь обманывает.\n\nТри трюка часто сидят в одном тексте: «до 90%» из «среднего улучшения» на графике с осью от 60. Увидев любой из них, вы уже знаете, что спросить.',
          '### "Up to 90%"\n\nThe first wording speaks about the best case that ever happened to somebody: ninety percent is the ceiling, not the average result, and even this ceiling is backed by nothing we would know how to check from the lesson about studies. "Up to" turns an outlier into a promise. On meeting one, ask: ninety percent of which group, measured how, and what happened to the rest.\n\n### The average instead of the median\n\nThe second trick is subtler. [[scithink.averages]] describe the same group in different ways. The mean is the sum divided by the number of people, while the median is the value that half the people fall below and half above. In a group with a couple of very large values, the mean sits noticeably above the median: if a billionaire walks into a café, the average income of the visitors grows several-fold, while the typical visitor earned nothing extra. When an advert or a news item names the average income, the average grade or the average service life, ask what the median is: the gap between them is the size of the tail the mean hides.\n\n### An axis without zero\n\nThe third trick is graphical. If a diagram’s axis does not start at zero but at a larger number, the gap between bars inflates several-fold: a segment from 80 to 82 looks like a doubling. The move is recognised at a glance: check where the vertical axis starts. If not at zero, rate the difference by the labels, not by the height.\n\nThe three tricks often sit in one text: "up to 90%" of "average improvement" on a chart with an axis from 60. On seeing any of them, you already know what to ask.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.numbers-upto', 'scithink.q.numbers-median'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.forecasts',
    title: bi('Почему эксперты промахиваются', 'Why experts miss'),
    summary: bi(
      'Опыт Тетлока: длинный горизонт и большие теории проигрывают коротким шагам и честным вероятностям.',
      'Tetlock’s experience: long horizons and grand theories lose to small steps and honest probabilities.',
    ),
    introduces: [],
    uses: ['scithink.calibration'],
    minutes: 12,
    sources: sources([TETLOCK_EN], [TETLOCK_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          '«Ведущие аналитики обещают, что к концу года цены вернутся к прежнему уровню». Год проходит, цены другие, а обещание забыто — до следующего прогноза. Кажется, что эксперты не умеют предсказывать, и в этом есть доля правды, но дело не в их глупости.\n\nФилип Тетлок десятилетиями собирал прогнозы политологов и экономистов о реальных событиях и сравнивал их с тем, что случилось. Результат нарушил ожидания: в среднем эксперты предсказывали хуже, чем простая экстраполяция «пока продолжается то, что было». Но интереснее среднего оказывается разброс.',
          '"Leading analysts promise that prices will return to their old level by the end of the year." A year passes, the prices are different, and the promise is forgotten — until the next forecast. It feels like experts cannot predict, and there is some truth in that, but the reason is not their stupidity.\n\nPhilip Tetlock spent decades collecting forecasts by political scientists and economists about real events and comparing them with what happened. The result defied expectations: on average the experts predicted worse than a simple extrapolation of "for now, what was keeps going". But the most interesting part is not the average — it is the spread.',
        ),
      },
      {
        id: 'tool', kind: 'text', step: 'explain',
        title: bi('Лисы, ежи и правила хорошего прогноза', 'Foxes, hedgehogs and the rules of a good forecast'),
        body: bi(
          '### Одна большая идея против мелких поправок\n\nТетлок, ссылаясь на сказку об Isaiah Berlin, делил прогнозистов на ежей и лис. Еж знает одну большую вещь и натягивает всё на неё: каждое событие подтверждает его теорию, промах объясняется помехой. Лиса держит в голове много мелких соображений и перебирает их: её прогнозы скучнее, зато она чаще пересматривает их по новым данным. В турнирах Вашингтонского проекта «Доброе суждение» лисы уверенно обыгрывали ежей — и обе группы уступали немногим любителям, которые ставили вероятности мелкими шагами и разбирали промахи.\n\n### Правила, которые отсюда следуют\n\nПервое правило — дробить. Прогноз «всё изменится» непроверяем и потому бесполезен, а прогноз «к концу квартала цена будет между этими двумя значениями с вероятностью 70%» можно сравнить с реальностью. Второе правило — ставить вероятности и записывать их до события: без записи память рисует «я же говорил» задним числом. Третье правило — разбирать промахи как наблюдение, без обиды: хороший прогнозист тоже ошибается, но ошибается по-разному и реже повторяет одну и ту же ошибку. Четвёртое — помнить про [[scithink.calibration]] из седьмого урока: уверенность и точность и здесь расходятся, и честные проценты лечат это лучше самоуверенности.\n\n### Чему это учит вне биржи\n\nБольшинство прогнозов, которые встречаются в жизни, — это не цены, а «у нас получится», «он не изменится», «этого не случится». К ним работают те же правила: дробите, записывайте вероятность до события, разбирайте промахи. И один осторожный вывод об экспертах: когда слышите уверенный прогноз на длинный срок, полезно спросить, какие его прошлые прогнозы были записаны и сверены, — а не какие он помнит удачными.\n\n### Свой первый проверяемый прогноз\n\nЗапишите сейчас три прогноза о событиях, которые решатся в ближайший месяц: например, выйдет ли выпуск в обещанную дату, ответит ли клиент до пятницы, пройдёт ли заявка на конференцию. Для каждого запишите пять вещей: событие одним предложением; дату, к которой оно решится; признак, по которому любой человек поймёт, случилось оно или нет; вероятность в процентах; причину, по которой вы пересмотрите оценку, если узнаете что-то новое. Когда дата наступит, отметьте исход рядом с вероятностью. Через несколько месяцев таких записей наберётся достаточно, чтобы построить собственную кривую калибровки, как в тренажёре из урока о калибровке.',
          '### One grand idea against small corrections\n\nTetlock, borrowing Isaiah Berlin’s parable, divided forecasters into hedgehogs and foxes. The hedgehog knows one big thing and stretches everything onto it: every event confirms the theory, a miss is explained by interference. The fox keeps many small considerations in mind and weighs them: her forecasts are more boring, but she revises them more often as new data arrives. In the Good Judgment Project tournaments in Washington, foxes confidently beat hedgehogs — and both groups lost to a few amateurs who set probabilities in small steps and reviewed their misses.\n\n### The rules that follow\n\nThe first rule is to break things down. A forecast that "everything will change" cannot be checked and is therefore useless, while a forecast that "by the end of the quarter the price will be between these two values with a probability of 70%" can be compared with reality. The second rule is to assign probabilities and write them down before the event: without a record, memory paints an "I told you so" after the fact. The third is to review a miss as an observation, not an insult: a good forecaster differs from a bad one not by never being wrong, but by being wrong in different ways and rarely repeating the same mistake. The fourth is to remember the [[scithink.calibration]] from lesson seven: confidence and accuracy diverge here too, and honest percentages cure it better than self-assurance.\n\n### What this teaches outside the stock exchange\n\nMost forecasts met in life are not prices but "we will make it", "they will not change", "it will not happen". The same rules work for them: break them down, record the probability before the event, review the misses. And one careful conclusion about experts: when you hear a confident long-term forecast, it is useful to ask which of their past forecasts were written down and checked — rather than which ones they remember as successful.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),

  lesson({
    id: 'scithink.final',
    title: bi('Итоговая проверка по реестру сомнений', 'The final check: the doubt register'),
    summary: bi(
      'Три текста — новость, реклама и пост — и реестр «что проверил, каким способом, какой вывод».',
      'Three texts — news, advertising and a post — and the register of "what I checked, how, and what I concluded".',
    ),
    introduces: [],
    uses: ['scithink.correlation', 'scithink.control', 'scithink.bayes', 'scithink.strawman', 'scithink.averages'],
    minutes: 20,
    sources: sources([KAHNEMAN_EN, BULLSHIT_EN, TETLOCK_EN, SPIEGELHALTER_EN], [KAHNEMAN_RU, BULLSHIT_RU, TETLOCK_RU, SPIEGELHALTER_RU]),
    sections: [
      {
        id: 'hook', kind: 'text', step: 'hook',
        body: bi(
          'Весь курс собирается в один рабочий инструмент — реестр сомнений. Это обычный список, который вы ведёте, встречая любой убедительный текст: что утверждают, что вы проверили, каким способом и к какому выводу пришли.\n\nНиже три текста — новость, реклама и пост. Пройдите их по очереди, не торопясь, и для каждого заполните строки реестра. В конце — вопросы для самопроверки.',
          'The whole course assembles into one working tool — the doubt register. It is an ordinary list you keep when meeting any convincing text: what exactly is claimed, what you checked, by which method, and what conclusion you reached.\n\nBelow are three texts — news, advertising and a post. Go through them in order, without rushing, and fill in the register lines for each. At the end there are questions for self-checking.',
        ),
      },
      {
        id: 'texts', kind: 'text', step: 'practice',
        title: bi('Три текста', 'Three texts'),
        body: bi(
          '### Текст первый, новость\n\n«Город перешёл на новые светодиодные фонари: аварийность на освещённых улицах упала вдвое за первый квартал. Руководитель проекта считает, что яркий свет буквально спасает жизни, и другим городам стоит брать пример».\n\n### Текст второй, реклама\n\n«Крем от морщин с пептидами: до 92% женщин заметили результат уже через неделю. Доказано исследованием*». Сноска мелким шрифтом: «самооценка 20 добровольцев, недельный срок».\n\n### Текст третий, пост\n\n«ВОТ что официальная наука не хочет вам объяснять! Очередное «исследование» снова «не нашло» вреда привычной добавки. Совпадение? Удобно, да? Пока вы ждёте «доказательств», кто-то уже давно зарабатывает на вашем доверии».',
          '### Text one, news\n\n"The city switched to new LED street lights: accidents on lit streets halved in the first quarter. The project lead believes that bright light literally saves lives, and other cities should follow suit".\n\n### Text two, advertising\n\n"Anti-wrinkle cream with peptides: up to 92% of women noticed a result in just a week. Proven by research*". Footnote in small print: "self-assessment by 20 volunteers, one-week term".\n\n### Text three, post\n\n"HERE is what official science does not want to explain to you! Yet another ‘study’ has again ‘found no’ harm from a familiar additive. A coincidence? Convenient, right? While you wait for ‘proof’, someone has long been making money on your trust".',
        ),
      },
      {
        id: 'register', kind: 'text', step: 'practice',
        title: bi('Шаблон реестра сомнений', 'The doubt register: template'),
        body: bi(
          'Ведите реестр по этому шаблону в таблице или в заметках, чтобы через неделю было видно, что вы проверяли и чем кончилась проверка. Одна строка на одно проверяемое утверждение.\n\n- Утверждение записывается одним предложением и своими словами, без слов автора текста.\n- Что проверил — какой вопрос курса вы применили, будь то базовая ставка, сравнение, выборка, источник или калибровка.\n- Способ — где и как вы смотрели, будь то сам текст, сноска, память или независимый источник.\n- Вывод — что осталось от утверждения после проверки, то есть подтвердилось оно, рассыпалось или осталось открытым.\n\nДля первого текста начните с главного утверждения — «яркий свет сократил аварийность вдвое». Что из пройденного здесь работает и с чем сравнивать? Что было бы без фонарей? Почему «первый квартал» — это срок и для эффекта, и для случайного спада? Ответы на эти вопросы пишутся в реестр обычным языком.',
          'Keep the register by this template — on paper, in notes, or in your head. One line per checkable claim.\n\n- The claim is written in one sentence and in your own words, without the author’s wording.\n- What I checked — which question of the course you applied: the base rate, comparison, sample, source, or calibration.\n- Method — where and how you looked: the text itself, a footnote, memory, or an independent source.\n- Conclusion — what remains of the claim after the check: confirmed, fell apart, or still open.\n\nFor the first text, start with the main claim — "bright light halved accidents". Which of the course’s tools works here, and what would you compare it with at all? What would it have been without the lights? Why is "the first quarter" a period long enough both for an effect and for a random drop? The answers to these questions go into the register in plain language.',
        ),
      },
      {
        id: 'quiz', kind: 'quiz', step: 'exit', title: CHECK_YOURSELF,
        items: ['scithink.q.final-news', 'scithink.q.final-ad'],
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
      { id: 'selfcheck', kind: 'callout', tone: 'why', step: 'review', body: SELFCHECK_NOTE },
    ],
  }),
];

export const SCITHINK_CONCEPTS: Concept[] = [
  {
    id: 'scithink.confidence',
    term: bi('уверенность', 'confidence'),
    short: bi('Чувство гладкости истории в голове; говорит о впечатлении, и о точности утверждения по нему судить нельзя.', 'The feeling of how smoothly a story fits together; it reports an impression, not the accuracy of a claim.'),
    introducedIn: 'scithink.story',
    scan: false,
  },
  {
    id: 'scithink.base-rate',
    term: bi('базовая ставка', 'the base rate'),
    short: bi('Как часто явление встречается в целом; начальная точка, с которой новые данные сдвигают оценку.', 'How often a phenomenon occurs overall; the starting point that new data shifts.'),
    introducedIn: 'scithink.base-rate',
    scan: false,
  },
  {
    id: 'scithink.regression',
    term: bi('регрессия к среднему', 'regression to the mean'),
    short: bi('Повторный замер после необычно сильного или слабого результата чаще ближе к обычному уровню.', 'A repeat measurement after an unusually strong or weak result is more often closer to the usual level.'),
    introducedIn: 'scithink.anecdote',
    scan: false,
  },
  {
    id: 'scithink.correlation',
    term: bi('корреляция', 'correlation'),
    short: bi('Совместное изменение двух величин; наблюдение, которое само по себе ничего не говорит о причине.', 'Two quantities changing together; an observation that by itself says nothing about the cause.'),
    introducedIn: 'scithink.correlation',
    scan: false,
  },
  {
    id: 'scithink.confounder',
    term: bi('третий фактор', 'the third factor'),
    short: bi('Скрытый участник, который двигает обеими наблюдаемыми величинами и создаёт мнимую связь между ними.', 'A hidden player that drives both observed quantities and creates a spurious link between them.'),
    introducedIn: 'scithink.correlation',
    scan: false,
  },
  {
    id: 'scithink.control',
    term: bi('контрольная группа', 'the control group'),
    short: bi('Такая же по составу группа без воздействия; без неё эффект не отличить от естественного течения дел.', 'A matching group without the intervention; without it an effect cannot be told from the natural course.'),
    introducedIn: 'scithink.control',
    scan: false,
  },
  {
    id: 'scithink.placebo',
    term: bi('плацебо', 'placebo'),
    short: bi('Нейтральная пустышка, которую сравнивают с настоящим средством, чтобы отделить эффект от ожидания.', 'A neutral dummy compared with a real remedy to separate the effect from expectation.'),
    introducedIn: 'scithink.control',
    scan: false,
  },
  {
    id: 'scithink.calibration',
    term: bi('калибровка', 'calibration'),
    short: bi('Соответствие между названной уверенностью и долей правоты: уверен на 80% — прав примерно в 80 случаях из 100.', 'The match between stated confidence and the share of being right: 80% sure — right about 80 times out of 100.'),
    introducedIn: 'scithink.calibration',
    scan: false,
  },
  {
    id: 'scithink.bayes',
    term: bi('байесовское обновление', 'Bayesian updating'),
    short: bi('Пересчёт уверенности по новым данным, где стартовая частота задаёт масштаб, а данные — перекос.', 'Recounting confidence with new data, where the starting frequency sets the scale and the data set the tilt.'),
    introducedIn: 'scithink.bayes',
    scan: false,
  },
  {
    id: 'scithink.strawman',
    term: bi('подмена тезиса', 'replacing the thesis'),
    short: bi('Приём, при котором оппоненту приписывают удобную глупость, которую тот не говорил, и её опровергают.', 'A move where the opponent is credited with a convenient stupidity they never said, which is then refuted.'),
    introducedIn: 'scithink.fakes',
    scan: false,
  },
  {
    id: 'scithink.averages',
    term: bi('среднее и медиана', 'the mean and the median'),
    short: bi('Два способа описать типичное значение: среднее складывает всё и делит поровну, медиана делит группу пополам.', 'Two ways to describe a typical value: the mean adds everything and splits evenly, the median splits the group in half.'),
    introducedIn: 'scithink.numbers',
    scan: false,
  },
];

export const SCITHINK_QUIZ: QuizItem[] = [
  {
    id: 'scithink.q.base-rate-result',
    kind: 'mcq',
    concepts: ['scithink.base-rate'],
    prompt: bi(
      'Болезнь встречается у 1 человека из 1000. Тест обнаруживает её у 9 из 10 больных и ошибается примерно в 5 случаях из 100 у здоровых. Вы получили положительный результат. Что вероятнее всего вы стоите перед?',
      'A disease occurs in 1 person per 1000. A test detects it in 9 of 10 sick people and errs in about 5 cases per 100 among the healthy. You received a positive result. What most likely faces you?',
    ),
    options: [
      {
        id: 'false-alarm',
        text: bi('Скорее всего это ложная тревога, ведь среди положительных результатов настоящих больных около 2%', 'Most likely a false alarm, because among positive results about 2% are genuine cases'),
        correct: true,
        why: bi('На тысяче человек тест находит 1 больного и ошибается примерно у 50 здоровых; 1 из 51 — это около 2%.', 'Per thousand people the test finds 1 sick person and errs for about 50 healthy ones; 1 of 51 is about 2%.'),
      },
      {
        id: 'disease',
        text: bi('Это болезнь, ведь тест хороший, и положительный результат почти наверняка верный', 'It is the disease, because the test is good and a positive result is almost certainly correct'),
        why: bi('Качество теста говорит, как он работает у больных и здоровых по отдельности, но при редкой болезни здоровых в десятки раз больше, и их ложные тревоги перевешивают.', 'The test’s quality tells how it works among the sick and the healthy separately, but with a rare disease the healthy vastly outnumber the sick, and their false alarms outweigh.'),
      },
      {
        id: 'fifty',
        text: bi('Ситуацией пятьдесят на пятьдесят', 'A fifty-fifty situation'),
        why: bi('Шансы складываются из базовой ставки и качества теста вместе; никакой «пятьдесят на пятьдесят» в условиях нет.', 'The odds combine the base rate and the test’s quality together; there is no "fifty-fifty" in the conditions.'),
      },
    ],
    refs: { lesson: 'scithink.base-rate' },
  },
  {
    id: 'scithink.q.base-rate-rare',
    kind: 'mcq',
    concepts: ['scithink.base-rate'],
    prompt: bi(
      'Один и тот же точный тест ищет одну и ту же болезнь в двух городах: в первом болезнь встречается у каждого сотого, во втором — у каждого тысячного. В каком городе доля настоящих больных среди положительных результатов будет выше?',
      'The same accurate test looks for the same disease in two cities: in the first the disease occurs in every hundredth person, in the second in every thousandth. In which city will the share of genuine cases among positive results be higher?',
    ),
    options: [
      {
        id: 'first',
        text: bi('В первом, где болезнь встречается чаще', 'In the first, where the disease is more common'),
        correct: true,
        why: bi('Чем выше базовая ставка, тем меньше ложных тревог среди положительных результатов: здоровых «носителей ошибки» относительно больных становится меньше.', 'The higher the base rate, the fewer false alarms among positive results: the healthy "carriers of error" become fewer relative to the sick.'),
      },
      {
        id: 'same',
        text: bi('Она одинаковая, ведь качество теста одно и картина одна', 'It is the same, because the test’s quality is one and the picture is one'),
        why: bi('Одно и то же качество теста работает на разные по размеру группы здоровых; базовая ставка решает, чьих ошибок будет больше.', 'The same test quality works on healthy groups of different sizes; the base rate decides whose errors will dominate.'),
      },
      {
        id: 'second',
        text: bi('Во втором, ведь там здоровых больше и тесту есть кого проверять', 'In the second, because there are more healthy people there and the test has more to check'),
        why: bi('Большое число здоровых при редкой болезни увеличивает в первую очередь ложные тревоги и снижает долю настоящих находок.', 'With a rare disease, a large number of healthy people increases false alarms first of all and lowers the share of genuine finds.'),
      },
    ],
    refs: { lesson: 'scithink.base-rate' },
  },
  {
    id: 'scithink.q.anecdote-grandpa',
    kind: 'mcq',
    concepts: ['scithink.regression'],
    prompt: bi(
      'В споре о вреде курения звучит: «А мой дед курил и дожил до 90». Что это утверждение доказывает?',
      'In an argument about the harm of smoking you hear: "My grandfather smoked and lived to 90". What does this claim prove?',
    ),
    options: [
      {
        id: 'nothing-distribution',
        text: bi('Что конкретный человек дожил до 90; о том, что обычно бывает с курящими, один случай не говорит', 'That a particular person lived to 90; one case says nothing about what usually happens to smokers'),
        correct: true,
        why: bi('История правдива, но выборка из одного не показывает распределение исходов; на него смотрят по большим группам.', 'The story is true, but a sample of one does not show the distribution of outcomes; that is looked at over large groups.'),
      },
      {
        id: 'safe',
        text: bi('Что курение безвредно, раз есть такой пример', 'That smoking is harmless, since such an example exists'),
        why: bi('«В среднем» никогда не означало «со всеми»; доживший до 90 курильщик укладывается в картину, где курение сокращает жизнь в среднем.', '"On average" never meant "with everyone"; a smoker who lived to ninety fits a picture where smoking shortens life on average.'),
      },
      {
        id: 'lie',
        text: bi('Ничего не доказывает, ведь такой дед наверняка выдуман', 'It proves nothing, because such a grandfather is surely invented'),
        why: bi('Сомневаться в рассказе без причин не нужно; сомнение относится к выводу, который из рассказа делают; самого рассказчика оно не касается.', 'There is no need to doubt the story without cause; the doubt concerns the conclusion drawn from it, not the storyteller.'),
      },
    ],
    refs: { lesson: 'scithink.anecdote' },
  },
  {
    id: 'scithink.q.regression-praise',
    kind: 'mcq',
    concepts: ['scithink.regression'],
    prompt: bi(
      'Лётные инструкторы заметили: курсанта, которого похвалили за чистую фигуру, на следующем заходе чаще ждала неудача, а отруганного — улучшение. Какое объяснение предлагает регрессия к среднему?',
      'Flight instructors noticed: a cadet praised for a clean manoeuvre was more often met by failure on the next attempt, and a scolded one by improvement. What explanation does regression to the mean offer?',
    ),
    options: [
      {
        id: 'luck',
        text: bi('Выдающийся заход включал удачу, которая редко повторяется дважды, поэтому следующий результат ближе к обычному уровню', 'An outstanding attempt included luck, which rarely repeats twice, so the next result is closer to the usual level'),
        correct: true,
        why: bi('После необычно хорошего или необычно плохого замера следующий чаще ближе к среднему сам по себе, без всяких причин искать в хвале или ругани.', 'After an unusually good or unusually bad measurement the next one is usually closer to the mean on its own, with no cause to seek in praise or scolding.'),
      },
      {
        id: 'praise-harmful',
        text: bi('Хвала действительно вредит, а ругань учит, то есть вывод инструкторов верен', 'Praise really is harmful and scolding teaches, so the instructors’ conclusion is correct'),
        why: bi('Это и есть ошибка, которую объясняет регрессия, ведь совпадение по времени приняли за причину.', 'This is the very mistake regression explains: a coincidence in timing was taken for a cause.'),
      },
      {
        id: 'talent',
        text: bi('Курсанты зазнаются от похвалы и перестают стараться', 'Cadets get conceited from praise and stop trying'),
        why: bi('Такой механизм нужно было бы показать отдельно; наблюдение само по себе объясняется возвратом к среднему.', 'Such a mechanism would have to be shown separately; the observation itself is explained by the return to the mean.'),
      },
    ],
    refs: { lesson: 'scithink.anecdote' },
  },
  {
    id: 'scithink.q.studies-sample',
    kind: 'mcq',
    concepts: ['scithink.control'],
    prompt: bi(
      'Новость сообщает: исследование показало, что люди, которые едят тёмный шоколад, реже жалуются на усталость. В тексте нет ни слова о группе сравнения. Что это новость может утверждать честно?',
      'A news item reports: a study showed that people who eat dark chocolate complain of tiredness less often. Not a word about a comparison group. What can this news item honestly claim?',
    ),
    options: [
      {
        id: 'observation',
        text: bi('Лишь наблюдение, что любители шоколада жалуются реже, а причина этого по таким данным неизвестна', 'Only an observation that chocolate lovers complain less often, while the cause is unknown from such data'),
        correct: true,
        why: bi('Без группы сравнения возможны и другие объяснения: те, кто двигается больше, и шоколад едят, и устают иначе; новость описывает совместность, и действия шоколада она не доказывает.', 'Without a comparison group other explanations are possible: people who move more both eat chocolate and tire differently; the news describes co-occurrence, not chocolate’s effect.'),
      },
      {
        id: 'effect',
        text: bi('Эффект шоколада, ведь исследование показало, что шоколад снижает усталость', 'A chocolate effect, because the study showed that chocolate reduces tiredness'),
        why: bi('Действие — это как раз то, что без сравнения установить нельзя; наблюдение не отделяет причину от обстановки.', 'An effect is exactly what cannot be established without comparison; observation does not separate cause from circumstances.'),
      },
      {
        id: 'nothing',
        text: bi('Ничего, ведь без группы сравнения этим данным верить нельзя', 'Nothing, because without a comparison group these data cannot be trusted'),
        why: bi('Наблюдение само по себе может быть аккуратным и точным, ему только нельзя приписывать причину.', 'The observation itself can be careful and precise; it just cannot be credited with a cause.'),
      },
    ],
    refs: { lesson: 'scithink.studies' },
  },
  {
    id: 'scithink.q.studies-publication',
    kind: 'mcq',
    concepts: ['scithink.placebo'],
    prompt: bi(
      'Почему фраза «исследования показали» в одиночку — слабое основание менять привычки?',
      'Why is the phrase "studies show" on its own a weak reason to change habits?',
    ),
    options: [
      {
        id: 'drawer',
        text: bi('Публикационное смещение: о найденном эффекте пишут чаще, чем о том, что эффекта не вышло, и лента перекошена в сторону сенсаций', 'Publication bias: a found effect gets written about more often than a missing one, and the feed tilts toward sensations'),
        correct: true,
        why: bi('Журналы охотнее печатают «нашли», журналисты охотнее перепечатывают сенсацию, поэтому одинокое «исследование показало» — кандидат на перепроверку.', 'Journals prefer printing "we found", journalists prefer reprinting a sensation, so a lonely "a study shows" is a candidate for re-checking.'),
      },
      {
        id: 'money',
        text: bi('Все исследования покупаются за деньги и потому недостоверны', 'All research is bought with money and therefore unreliable'),
        why: bi('Существование спонсорских искажений не делает ложным каждое исследование; слабость одинокого заголовка объясняется смещением публикаций, и подкуп всех подряд для этого не нужен.', 'Sponsorship distortions exist, but they do not make every study false; the weakness of a lonely headline is explained by publication bias, not by everyone being bribed.'),
      },
      {
        id: 'lazy',
        text: bi('Учёные редко проверяют чужие результаты, поэтому считать их неприятно', 'Scientists rarely check each other’s results, so counting on them is unpleasant'),
        why: bi('Перепроверки бывают, и о них тоже пишут; вопрос здесь в том, что одиночный результат начинает разговор и не заканчивает его.', 'Replication happens and gets written about too; the point here is that a single result is the beginning of a conversation, not its end.'),
      },
    ],
    refs: { lesson: 'scithink.studies' },
  },
  {
    id: 'scithink.q.fakes-emotion',
    kind: 'mcq',
    concepts: ['scithink.strawman'],
    prompt: bi(
      'Текст пугает заглавными буквами и кричит «ВАС обманывают! Узнайте, что скрывают!», но не называет ни источника, ни данных. Какой приём работает в первую очередь?',
      'A text frightens with capital letters: "YOU are being deceived! Learn what they are hiding!" — and names neither source nor data. Which move is doing the first work here?',
    ),
    options: [
      {
        id: 'emotion',
        text: bi('Эмоциональная нагрузка, при которой страх и возмущение должны сработать раньше, чем включится проверка', 'Emotional load, in which fear and outrage are meant to trigger before checking starts'),
        correct: true,
        why: bi('Громкость и запугивание подменяют аргумент; против них работает пауза и три обычных вопроса про наблюдение, сравнение и опровержение.', 'Loudness and scare tactics substitute for an argument; a pause and the usual three questions about observation, comparison and refutation work against them.'),
      },
      {
        id: 'strawman',
        text: bi('Подмена тезиса: оппоненту приписали глупость, которую тот не говорил', 'Replacing the thesis: the opponent is credited with a stupidity they never said'),
        why: bi('Здесь некого опровергать — нет названного оппонента и его слов; работает громкость, и спора с выдуманным тезисом здесь нет.', 'There is no one to refute here — no named opponent and no words of theirs; the loudness works, not an argument with an invented thesis.'),
      },
      {
        id: 'fake-expert',
        text: bi('Поддельная экспертиза: «исследования доказали» без ссылки', 'Fake expertise: "studies have proven" without a reference'),
        why: bi('Ссылок на исследования здесь нет ни одной, поэтому приём о поддельной науке не применяется; применён более грубый — эмоция.', 'There are no references to studies here at all, so the fake-science move does not apply; a cruder one is used — emotion.'),
      },
    ],
    refs: { lesson: 'scithink.fakes' },
  },
  {
    id: 'scithink.q.fakes-strawman',
    kind: 'mcq',
    concepts: ['scithink.strawman'],
    prompt: bi(
      'Статья начинается словами: «Диетологи хотят забрать у вас сахар совсем!» Вы открываете документ, на который она ссылается, и видите рекомендацию сократить добавленный сахар в рационе детей. Какой приём использует статья?',
      '"Nutritionists want to take your sugar away completely! — an article fumes. — In fact nobody was going to ban sugar: the talk was about a recommendation to cut added sugar for children". Which move does the article use?',
    ),
    options: [
      {
        id: 'strawman',
        text: bi('Подмену тезиса: рекомендации сократить сахар приписали намерение всё запретить, и это намерение опровергли', 'Replacing the thesis: a recommendation to cut sugar was credited as an intent to ban it all, and that intent was refuted'),
        correct: true,
        why: bi('Самый убедительный аргумент статьи разбивает утверждение, которого никто не делал; настоящий тезис скучнее и осторожнее.', 'The article’s most convincing argument demolishes a claim nobody made; the real thesis is more boring and careful.'),
      },
      {
        id: 'emotion',
        text: bi('Эмоциональную нагрузку: слово «забрать» будит страх потери', 'Emotional load: the word "take away" awakens the fear of loss'),
        why: bi('Эмоция здесь есть, но она обслуживает главный ход — смену самого утверждения, которое обещают опровергнуть.', 'Emotion is present, but it serves the main move — changing the very claim that the article promises to refute.'),
      },
      {
        id: 'numbers',
        text: bi('Игру с цифрами: доли заменены процентами', 'A numbers trick: shares replaced with percents'),
        why: bi('Цифр в примере нет вовсе; приём чисто словесный.', 'There are no numbers in the example at all; the move is purely verbal.'),
      },
    ],
    refs: { lesson: 'scithink.fakes' },
  },
  {
    id: 'scithink.q.numbers-upto',
    kind: 'mcq',
    concepts: ['scithink.averages'],
    prompt: bi(
      'Реклама обещает: «до 90% заметили результат». Что обещает эта фраза?',
      'An advert promises: "up to 90% noticed a result". What exactly does this phrase promise?',
    ),
    options: [
      {
        id: 'ceiling',
        text: bi('Потолок в лучшем случае: когда-то, с кем-то и при каком-то замере случалось и 90%; типичного результата фраза не называет', 'A ceiling in the best case: 90% once happened with someone under some measurement; the phrase names no typical result'),
        correct: true,
        why: bi('«До» превращает выброс в обещание; стоит спросить, 90% какой группы, при каком замере и что стало с остальными.', '"Up to" turns an outlier into a promise; one should ask: 90% of which group, measured how, and what happened to the rest.'),
      },
      {
        id: 'typical',
        text: bi('Типичный результат: в среднем девяносто из ста видят эффект', 'A typical result: on average ninety out of a hundred see an effect'),
        why: bi('«До» как раз отказывается говорить про среднее или типичное; оно говорит о самом высоком наблюденном значении.', '"Up to" precisely refuses to speak about the mean or the typical; it speaks about the highest observed value.'),
      },
      {
        id: 'nothing',
        text: bi('Ничего: цифры в рекламе никогда не бывают правдой', 'Nothing: numbers in advertising are never true'),
        why: bi('Проблема не в том, что цифра выдумана, а в том, что она подобрана так, чтобы ничего не значить; цифре нельзя приписывать и полную ложь.', 'The problem is not that the number is invented, but that it is chosen to mean nothing; the number cannot be credited with being a complete lie either.'),
      },
    ],
    refs: { lesson: 'scithink.numbers' },
  },
  {
    id: 'scithink.q.numbers-median',
    kind: 'mcq',
    concepts: ['scithink.averages'],
    prompt: bi(
      'Новость сообщает: средний доход жителей района вырос на треть. Какой вопрос лучше всего прояснит, поднялись ли доходы у большинства?',
      'A news item reports: the average income of a district’s residents grew by a third. Which question best clarifies whether most incomes rose?',
    ),
    options: [
      {
        id: 'median',
        text: bi('Как изменилась медиана — значение, ниже которого осталась половина жителей', 'How the median changed — the value below which half the residents remain'),
        correct: true,
        why: bi('Медиана показывает типичного жителя; среднее могло вырасти из-за нескольких очень больших доходов, не изменив жизни большинства.', 'The median shows the typical resident; the mean can grow because of a few very large incomes without changing life for most.'),
      },
      {
        id: 'sum',
        text: bi('Какова теперь суммарная выручка всех жителей вместе', 'What the residents’ total revenue is now'),
        why: bi('Сумма и среднее связаны напрямую и растут вместе; вопрос про сумму повторяет исходное утверждение другими словами.', 'The sum and the mean are directly linked and grow together; asking about the sum repeats the original claim in other words.'),
      },
      {
        id: 'richest',
        text: bi('Кто самый богатый житель района в этом году', 'Who the richest resident of the district is this year'),
        why: bi('Судьба одного человека — это снова выборка из одного, она не показывает, что стало с большинством.', 'The fate of one person is again a sample of one; it does not show what happened to most.'),
      },
    ],
    refs: { lesson: 'scithink.numbers' },
  },
  {
    id: 'scithink.q.final-news',
    kind: 'mcq',
    concepts: ['scithink.correlation', 'scithink.regression'],
    prompt: bi(
      'Новость: «аварийность на улицах с новыми фонарями упала вдвое за первый квартал, значит яркий свет спасает жизни». Какая проверка сильнее всего проверит этот вывод?',
      'News: "accidents halved in the first quarter on streets with new lights, so bright light saves lives". Which check tests this conclusion most strongly?',
    ),
    options: [
      {
        id: 'compare',
        text: bi('Сравнить эти улицы с похожими улицами без новых фонарей за тот же период', 'Compare these streets with similar streets without the new lights over the same period'),
        correct: true,
        why: bi('Без сравнения падение можно списать на случайный спад, сезонность и регрессию к среднему после неудачного периода; сравнение отделяет эффект фонарей от всего остального.', 'Without a comparison, the drop can be written off to a random decline, seasonality and regression to the mean after a bad period; the comparison separates the lights’ effect from everything else.'),
      },
      {
        id: 'interview',
        text: bi('Спросить водителей, стало ли им светлее и безопаснее', 'Ask drivers whether it became brighter and safer for them'),
        why: bi('Самооценка участников — впечатление, замером её считать нельзя; урок про «попробовал и помогло» показывал, что такое наблюдение не решает вопрос о причине.', 'Participants’ self-assessment is an impression, not a measurement; the "tried it and it helped" lesson showed that such observation does not settle the question of cause.'),
      },
      {
        id: 'brighter',
        text: bi('Померить освещённость улиц люксометром', 'Measure the streets’ brightness with a lux meter'),
        why: bi('Яркость фонарей и влияние яркости на аварийность — разные вопросы; люксометр ответит на первый, а вывод новости — про второй.', 'The brightness of the lights and the effect of brightness on accidents are different questions; the lux meter answers the first, while the news item’s conclusion is about the second.'),
      },
    ],
    refs: { lesson: 'scithink.final' },
  },
  {
    id: 'scithink.q.final-ad',
    kind: 'mcq',
    concepts: ['scithink.averages'],
    prompt: bi(
      'Реклама крема: «до 92% заметили результат через неделю; доказано исследованием», сноска: «самооценка 20 добровольцев, недельный срок». Какой вопрос к этому тексту самый важный?',
      'A cream advert: "up to 92% noticed a result in a week; proven by research", footnote: "self-assessment by 20 volunteers, one-week term". Which question is the most important one for this text?',
    ),
    options: [
      {
        id: 'share',
        text: bi('Сколько из 20 добровольцев «заметили результат» и что замеряли самооценкой', 'How many exactly of the 20 volunteers "noticed a result" and what exactly was measured by self-assessment'),
        correct: true,
        why: bi('«До 92%» от 20 человек — это 18 человек в лучшем случае, а самооценка без сравнения с плацебо не отличает эффект крема от ожидания; цифры и способ замера решают здесь всё.', '"Up to 92%" of 20 people is 18 people at best, and self-assessment without comparison to a placebo does not separate the cream’s effect from expectation; the numbers and the measurement method decide everything here.'),
      },
      {
        id: 'cream',
        text: bi('Есть ли в креме пептиды', 'Whether the cream contains peptides'),
        why: bi('Состав крема не спорит с заявленным «исследованием»; даже при честном составе вывод про 92% остаётся необоснованным.', 'The cream’s composition does not argue with the claimed "research"; even with an honest composition the 92% claim stays unsupported.'),
      },
      {
        id: 'design',
        text: bi('Красиво ли оформлена упаковка', 'How nicely the packaging is designed'),
        why: bi('Оформление не относится к проверке утверждения; вопросы реестра сомнений касаются наблюдения, сравнения и замера.', 'Design is irrelevant to checking the claim; the register’s questions concern observation, comparison and measurement.'),
      },
    ],
    refs: { lesson: 'scithink.final' },
  },
];
