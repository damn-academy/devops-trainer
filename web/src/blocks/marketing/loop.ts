// Interactive scheme of the growth loop for the hidden marketing pilot: how
// one insight from practice turns into a big material, ten pieces, a new
// audience and the next insights, so every pass feeds the next (lessons 12
// and 34 of the marketing school). Built on the shared explainer engine like
// the sales pilot's buying center; Russian and English carry the same text.

import { defineModel } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Step } from '../../core/types';

type P = Record<string, never>;

const card = (whatRu: string, whoRu: string, whatEn: string, whoEn: string) => ({
  what: bi(whatRu, whatEn),
  who: bi(whoRu, whoEn),
});

export const loopModel = defineModel<P>({
  id: 'marketing.loop',
  block: 'marketing',
  title: bi('Петля роста против воронки', 'The growth loop versus the funnel'),
  summary: bi(
    'Один инсайт превращается в материал, десять кусков, новую аудиторию и следующие инсайты. Пройдите круг по шагам и откройте карточки блоков кликом.',
    'One insight turns into a material, ten pieces, a new audience and the next insights. Walk the circle step by step and open the block cards by clicking.',
  ),
  intro: bi(
    'Нажимайте «Шаг вперёд», и подсветится этап машины, который работает сейчас. Клик по блоку открывает карточку с тем, что блок делает и кто им владеет.',
    'Press "Step forward" and the stage of the machine that works right now is highlighted. Click a block to open a card with what it does and who owns it.',
  ),
  concepts: ['marketing.growth-loop'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      {
        id: 'insight', label: bi('Инсайт', 'Insight'), family: 'flow', shape: 'hex', x: 40, y: 220, w: 180, h: 84,
        sub: bi('из практики', 'from practice'),
        card: card(
          'Наблюдение из настоящей работы, которое больше никто не записал. Каждый круг петли начинается здесь; календарь контента его не запускает.',
          'Появляется у инженеров и основателей в работе. Проверяется цифрами до того, как становится материалом.',
          'An observation from real work that nobody else has written down. Every pass of the loop starts here, not in the content calendar.',
          'Appears with engineers and founders at work. It is checked with numbers before it becomes a material.',
        ),
      },
      {
        id: 'deep', label: bi('Большой материал', 'The big material'), family: 'store', shape: 'doc', x: 290, y: 50, w: 190, h: 80,
        sub: bi('статья · доклад · гайд', 'article · talk · guide'),
        card: card(
          'Инсайт, собранный целиком: руководство, доклад или длинная статья. Несёт мысль так, что её можно пересказать без автора.',
          'Пишет тот, кто видел инсайт своими глазами. Это сырьё для всех остальных кусков.',
          'The insight assembled whole: a guide, a talk or a long article. Carries the thought so it can be retold without the author.',
          'Written by the person who saw the insight first-hand. It is the raw material for every other piece.',
        ),
      },
      {
        id: 'pieces', label: bi('Десять кусков', 'Ten pieces'), family: 'process', shape: 'box', x: 560, y: 50, w: 180, h: 80,
        sub: bi('пост · ролик · слайды', 'post · clip · slides'),
        card: card(
          'Большой материал, нарезанный по форматам площадок. Десять кусков из одного инсайта — это десять каналов без десяти тем.',
          'Нарезку делает тот же автор или редактор по форматам каждой площадки.',
          'The big material cut into the formats of the platforms. Ten pieces from one insight is ten channels without ten topics.',
          'The cutting is done by the same author or an editor, per the format of each platform.',
        ),
      },
      {
        id: 'channels', label: bi('Платформы', 'Platforms'), family: 'l7', shape: 'box', x: 750, y: 210, w: 170, h: 84,
        sub: bi('LinkedIn · YouTube · сообщества', 'LinkedIn · YouTube · communities'),
        card: card(
          'Места, где профессия читает: LinkedIn, X, YouTube, Reddit, профессиональные каталоги. У каждой площадки свои законы формата.',
          'Их ведут люди через личные профили инженеров, которые строят продукт; страница компании здесь вторична.',
          'The places where the profession reads: LinkedIn, X, YouTube, Reddit, professional catalogues. Each platform has its own format laws.',
          'Run by people, not the company page: the personal profiles of the engineers who build the product.',
        ),
      },
      {
        id: 'audience', label: bi('Новая аудитория', 'New audience'), family: 'user', shape: 'pill', x: 560, y: 390, w: 180, h: 70,
        sub: bi('находит через поиск и ленты', 'finds you via search and feeds'),
        card: card(
          'Люди, которые впервые встретили материалы через поиск, ленты и пересылки коллег. Часть из них станет следующими покупателями.',
          'Приходит сама, если куски отвечают на настоящие вопросы; реклама ускоряет этот поток, но заменить его не может.',
          'People who met the materials for the first time via search, feeds and forwards from colleagues. Some of them will become the next buyers.',
          'Arrives by itself if the pieces answer real questions; advertising accelerates this flow but does not replace it.',
        ),
      },
      {
        id: 'questions', label: bi('Вопросы аудитории', 'Audience questions'), family: 'gauge', shape: 'box', x: 290, y: 390, w: 190, h: 70,
        sub: bi('вопросы · возражения · задачи', 'questions · objections · tasks'),
        card: card(
          'Ответы, возражения и задачи, которые приносит аудитория. Это сырьё следующего круга: лучшие инсайты приходят из чужих вопросов.',
          'Собираются в комментариях, issues, письмах и после выступлений; разбираются регулярно, по расписанию.',
          'The answers, objections and tasks the audience brings. This is the raw material of the next pass: the best insights come from other people\'s questions.',
          'Collected in comments, issues, emails and after talks; worked through regularly, not "when there is time".',
        ),
      },
    ],
    edges: [
      {
        id: 'i1', from: 'insight', to: 'deep', label: bi('проверен цифрами', 'checked with numbers'),
        card: card(
          'Инсайт не идёт в публикацию, пока его не подтвердили цифрами из практики.',
          'Фильтр качества: без цифр это мнение, с цифрами — материал.',
          'An insight does not go to publication until practice confirms it with numbers.',
          'The quality filter: without numbers it is an opinion, with numbers it is material.',
        ),
      },
      {
        id: 'i2', from: 'deep', to: 'pieces', label: bi('нарезка по форматам', 'cut into formats'),
        card: card(
          'Большой материал разбирается на куски под площадки: пост, короткий ролик, слайды, ответ в сообществе.',
          'Одна работа автора даёт десять каналов.',
          'The big material is cut into pieces for the platforms: a post, a short clip, slides, an answer in a community.',
          'One piece of the author\'s work gives ten channels.',
        ),
      },
      {
        id: 'i3', from: 'pieces', to: 'channels', label: bi('публикация по каналам', 'published by channel'),
        card: card(
          'Куски выходят на площадках с разными датами и форматами. Распространение важнее производства: материал без публикации никого не достиг.',
          'Каждый канал ведёт свой человек, даты стоят в календаре.',
          'The pieces go out on the platforms with different dates and formats. Distribution beats production: an unpublished material reaches nobody.',
          'Each channel has its own owner, and the dates sit in the calendar.',
        ),
      },
      {
        id: 'i4', from: 'channels', to: 'audience', label: bi('новые люди', 'new people'),
        card: card(
          'Публикации находят новых людей через поиск и ленты. Это охват, а охват по данным Ehrenberg-Bass растёт быстрее лояльности.',
          'Работает годами: старые материалы продолжают приводить читателей.',
          'The publications find new people through search and feeds. This is reach, and by Ehrenberg-Bass data reach grows faster than loyalty.',
          'Works for years: old materials keep bringing readers.',
        ),
      },
      {
        id: 'i5', from: 'audience', to: 'questions', label: bi('вопросы и возражения', 'questions and objections'),
        card: card(
          'Новая аудитория приносит вопросы, возражения и свои задачи. Воронка закрылась бы здесь; петля только начинается.',
          'Вопросы приходят в комментарии, issues и почту.',
          'The new audience brings questions, objections and their own tasks. A funnel would close here; the loop is only beginning.',
          'Questions arrive in comments, issues and email.',
        ),
      },
      {
        id: 'i6', from: 'questions', to: 'insight', label: bi('сырьё следующего круга', 'raw material of the next pass'),
        card: card(
          'Разобранные вопросы становятся инсайтами следующего круга. Петля подпитывает себя, поэтому каждый оборот дешевле предыдущего.',
          'Замыкает круг; без этого перехода машина превращается в линейную воронку.',
          'The worked-through questions become the insights of the next pass. The loop feeds itself, so every turn is cheaper than the previous one.',
          'Closes the circle; without this transition the machine turns into a linear funnel.',
        ),
      },
    ],
  },
  params: [],
  breaks: [],
  frame: 'visible',
  run(_p: P, _broken: ReadonlySet<string>): Step[] {
    return [
      {
        id: 'insight', label: bi('Инсайт', 'Insight'),
        caption: bi(
          'Круг начинается с наблюдения из практики: то, что вы увидели в работе и ещё никто не записал. Пока инсайт не проверен цифрами, он остаётся мнением.',
          'The pass starts with an observation from practice: something you saw at work that nobody has written down yet. Until the insight is checked with numbers it stays an opinion.',
        ),
        focus: ['insight'],
        say: { insight: bi('«Мы неделю чинили то, о чём потом рассказали бы все — запишем сами».', '"We spent a week fixing what everyone would later talk about — let\'s write it down ourselves."') },
      },
      {
        id: 'deep', label: bi('Большой материал', 'The big material'),
        caption: bi(
          'Проверенный инсайт собирается в большой материал — статью, доклад или руководство. Он несёт мысль целиком и служит сырьём для всего остального.',
          'The checked insight is assembled into a big material — an article, a talk or a guide. It carries the thought whole and serves as raw material for everything else.',
        ),
        focus: ['i1', 'deep'],
        say: { deep: bi('«Один материал несёт всю мысль — остальное будет нарезкой из него».', '"One material carries the whole thought — everything else will be cut from it."') },
      },
      {
        id: 'pieces', label: bi('Десять кусков', 'Ten pieces'),
        caption: bi(
          'Большой материал нарезается по форматам площадок: пост, короткий ролик, слайды, ответ в сообществе и абзац в рассылку. Десять кусков дают десять каналов без десяти тем.',
          'The big material is cut into the formats of the platforms: a post, a short clip, slides, an answer in a community and a newsletter paragraph. Ten pieces give ten channels without ten topics.',
        ),
        focus: ['i2', 'pieces'],
        say: { pieces: bi('«Из одного инсайта — десять кусков, из десяти кусков — десять каналов».', '"From one insight, ten pieces; from ten pieces, ten channels."') },
      },
      {
        id: 'channels', label: bi('Публикация', 'Publishing'),
        caption: bi(
          'Куски выходят на площадки LinkedIn, X, YouTube и в профессиональные сообщества. Распространение решается до написания: у каждого канала свой формат, свой человек и своя дата.',
          'The pieces go out on LinkedIn, X, YouTube and in professional communities. Distribution is decided before writing: every channel has its format, its owner and its date.',
        ),
        focus: ['i3', 'channels'],
        say: { channels: bi('«Материал без публикации никого не достиг — распространение важнее производства».', '"An unpublished material reaches nobody — distribution beats production."') },
      },
      {
        id: 'audience', label: bi('Новая аудитория', 'New audience'),
        caption: bi(
          'Публикации находят новых людей через поиск и ленты. Это охват: по данным Ehrenberg-Bass рынки растут за счёт него больше, чем за счёт лояльности.',
          'The publications find new people through search and feeds. This is reach: by Ehrenberg-Bass data markets grow through it, not through loyalty.',
        ),
        focus: ['i4', 'audience'],
        say: { audience: bi('«Люди приходят сами, когда куски отвечают на настоящие вопросы».', '"People come by themselves when the pieces answer real questions."') },
      },
      {
        id: 'questions', label: bi('Вопросы', 'Questions'),
        caption: bi(
          'Новая аудитория приносит вопросы, возражения и задачи. Воронка закрылась бы на этом шаге; петля на этом только начинается.',
          'The new audience brings questions, objections and tasks. A funnel would close at this step; the loop is only beginning here.',
        ),
        focus: ['i5', 'questions'],
        say: { questions: bi('«Лучшие инсайты приходят из чужих вопросов — собирайте их регулярно».', '"The best insights come from other people\'s questions — collect them regularly."') },
      },
      {
        id: 'loop', label: bi('Новый круг', 'The next pass'),
        caption: bi(
          'Разобранные вопросы становятся инсайтами следующего круга. Петля замкнулась: в отличие от воронки, которая выдыхается без бюджета, она подпитывает себя, и каждый оборот дешевле предыдущего.',
          'The worked-through questions become the insights of the next pass. The loop is closed: unlike a funnel it feeds itself, and every turn is cheaper than the one before.',
        ),
        focus: ['i6', 'insight'],
        say: { insight: bi('«Следующий круг начинается с вопросов прошлого — машина крутится сама».', '"The next pass starts with the questions of the previous one — the machine turns by itself."') },
      },
    ];
  },
  explainDelta() {
    return bi('Шаг показывает, какой этап машины работает и что он передаёт следующему.', 'The step shows which stage of the machine works and what it hands to the next one.');
  },
});

loopModel.diagram.narrow = {
  width: 340, height: 910,
  nodes: loopModel.diagram.nodes.map((n, i) => ({ ...n, x: 95, y: 20 + i * 150, w: 220 })),
  edgeVia: { i1: [], i2: [], i3: [], i4: [], i5: [], i6: [[25, 805], [25, 60]] },
};
