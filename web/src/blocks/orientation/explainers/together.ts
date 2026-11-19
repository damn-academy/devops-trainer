// Two people edit one text: each works on a copy, a machine joins the edits
// and keeps the history; edits on the same line wait for a person (F12).

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { where: string; size: string };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const PROGIT = { url: 'https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control', label: 'Pro Git › About Version Control' };

export const togetherModel = defineModel<P>({
  id: 'orient.together',
  block: 'orient',
  title: bi('Двое правят один текст', 'Two people edit one text'),
  summary: bi(
    'Анна и Борис правят меню магазина: каждый свою копию, а машина соединяет правки и записывает историю. Сведите их на одну строчку, сделайте правки большими, перешлите файл почтой.',
    'Anna and Boris edit the shop’s menu, each a copy of their own, and a machine joins the edits and records the history. Bring them onto one line, make the edits big, send the file by email.',
  ),
  concepts: ['orient.collaboration'],
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      { id: 'shared', label: bi('Общая копия', 'Shared copy'), sub: 'menu.txt · v1', family: 'store', x: 376, y: 24, w: 208, h: 56, card: card(bi('Главная версия текста, с которой все начинают и в которую всё возвращается. Её никто не правит напрямую.', 'The main version of the text everyone starts from and everything returns to. Nobody edits it directly.'), bi('Команда договорилась, что главная — эта.', 'The team agreed that this one is the main one.'), { doc: PROGIT }) },
      { id: 'anna', label: bi('Копия Анны', 'Anna’s copy'), sub: 'Oolong — 450', family: 'user', x: 24, y: 152, w: 208, h: 56, card: card(bi('Анна взяла копию и правит её у себя, никому не мешая.', 'Anna took a copy and edits it on her own machine without getting in anyone’s way.'), bi('Анна.', 'Anna.')) },
      { id: 'boris', label: bi('Копия Бориса', 'Boris’s copy'), sub: 'Black tea — 250', family: 'user', x: 728, y: 152, w: 208, h: 56, card: card(bi('Борис взял такую же копию в то же время и правит своё.', 'Boris took the same copy at the same time and edits his part.'), bi('Борис.', 'Boris.')) },
      { id: 'merge', label: bi('Слияние', 'Merge'), sub: '', family: 'flow', x: 376, y: 152, w: 208, h: 56, card: card(bi('Машина сравнивает обе копии с исходной построчно. Правки в разных строчках она соединяет сама; одну строчку, изменённую двумя людьми по-разному, оставляет человеку.', 'A machine compares both copies with the original line by line. Edits on different lines it joins by itself; a line two people changed differently it leaves to a person.'), bi('Программа совместной работы, чаще всего Git.', 'A collaboration program, most often Git.'), { doc: PROGIT }) },
      { id: 'history', label: bi('История', 'History'), sub: 'v1', family: 'store', x: 376, y: 280, w: 208, h: 56, card: card(bi('Список всех правок: кто, что и когда изменил. По нему можно найти, откуда взялась ошибка, и вернуть любую прошлую версию.', 'A list of all edits: who changed what and when. With it you can find where an error came from and bring back any past version.'), bi('Программа совместной работы записывает её сама.', 'The collaboration program records it by itself.')) },
    ],
    edges: [
      { id: 'e-takeA', from: 'shared', to: 'anna', label: bi('копия', 'copy'), card: card(bi('Анна берёт себе копию общей версии.', 'Anna takes a copy of the shared version.'), bi('Анна.', 'Anna.')) },
      { id: 'e-takeB', from: 'shared', to: 'boris', label: bi('копия', 'copy'), card: card(bi('Борис берёт такую же копию.', 'Boris takes the same copy.'), bi('Борис.', 'Boris.')) },
      { id: 'e-giveA', from: 'anna', to: 'merge', label: bi('правка Анны', 'Anna’s edit'), card: card(bi('Анна отдаёт свою правку на слияние.', 'Anna hands her edit over to the merge.'), bi('Анна.', 'Anna.')) },
      { id: 'e-giveB', from: 'boris', to: 'merge', label: bi('правка Бориса', 'Boris’s edit'), card: card(bi('Борис отдаёт свою.', 'Boris hands over his.'), bi('Борис.', 'Boris.')) },
      { id: 'e-result', from: 'merge', to: 'shared', label: bi('новая версия', 'new version'), card: card(bi('Соединённый текст становится новой общей версией.', 'The joined text becomes the new shared version.'), bi('Программа совместной работы.', 'The collaboration program.')) },
      { id: 'e-log', from: 'merge', to: 'history', label: bi('кто, что, когда', 'who, what, when'), card: card(bi('Каждое слияние оставляет запись в истории.', 'Every merge leaves an entry in the history.'), bi('Программа совместной работы.', 'The collaboration program.')) },
    ],
  },
  params: [
    {
      id: 'where',
      label: bi('Что правили', 'What they edited'),
      kind: 'choice',
      default: 'different',
      near: 'merge',
      options: [
        { id: 'different', label: bi('разные строчки', 'different lines') },
        { id: 'same', label: bi('одну и ту же строчку', 'the same line') },
      ],
      predict: {
        prompt: bi('Анна и Борис по-разному исправили одну и ту же цену. Что сделает машина при слиянии?', 'Anna and Boris changed the same price differently. What does the machine do at the merge?'),
        options: [
          { id: 'ask', text: bi('Остановится и покажет обе строчки человеку', 'It stops and shows both lines to a person') },
          { id: 'last', text: bi('Возьмёт ту правку, что пришла последней', 'It takes whichever edit came last') },
          { id: 'average', text: bi('Посчитает среднее', 'It takes the average') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.id === 'ask') ? 'ask' : 'last'),
      },
    },
    {
      id: 'size',
      label: bi('Размер правок', 'Size of the edits'),
      kind: 'choice',
      default: 'small',
      near: 'history',
      options: [
        { id: 'small', label: bi('по 3 строчки', '3 lines each') },
        { id: 'big', label: bi('по 300 строчек', '300 lines each') },
      ],
    },
  ],
  breaks: [
    {
      id: 'email',
      label: bi('Без общей истории: пересылать файл почтой', 'No shared history: send the file by email'),
      remove: ['merge', 'e-log', 'history'],
      predict: {
        prompt: bi('Анна и Борис правят файл и рассылают его друг другу почтой. Борис сохранил свою копию последним. Что станет с правкой Анны?', 'Anna and Boris edit the file and email it to each other. Boris saved his copy last. What becomes of Anna’s edit?'),
        options: [
          { id: 'lost', text: bi('Пропадёт: его файл целиком заменил её', 'It is lost: his file replaced hers whole') },
          { id: 'kept', text: bi('Сохранится: почта соединит файлы', 'It survives: email joins the files') },
        ],
        resolve: () => 'lost',
      },
    },
  ],
  metrics: [
    { id: 'review', label: bi('строчек проверить глазами', 'lines to check by eye') },
    { id: 'lost', label: bi('потеряно правок', 'edits lost') },
  ],
  run(p, broken): Step[] {
    const lines = p.size === 'big' ? 300 : 3;
    const same = p.where === 'same';
    const annaLine = same ? 'Black tea — 260' : 'Oolong — 480';
    const steps: Step[] = [
      {
        id: 'copy',
        label: bi('копии', 'copies'),
        caption: bi('Анна и Борис берут по копии общего меню. Дальше каждый работает у себя.', 'Anna and Boris each take a copy of the shared menu. From here each works on their own.'),
        focus: ['shared', 'e-takeA', 'e-takeB'],
        tokens: [{ edge: 'e-takeA', label: 'v1' }, { edge: 'e-takeB', label: 'v1' }],
        states: { shared: 'on', anna: 'on', boris: 'on' },
        values: { shared: 'menu.txt · v1', history: 'v1', anna: 'Oolong — 450', boris: 'Black tea — 250' },
        metrics: { review: 0, lost: 0 },
      },
      {
        id: 'edit',
        label: bi('правки', 'edits'),
        caption: same
          ? bi('Анна ставит чёрному чаю цену 260, Борис — 280. Одна строчка, две разные правки.', 'Anna sets the black tea price to 260, Boris to 280. One line, two different edits.')
          : bi('Анна поднимает цену улуна до 480, Борис — цену чёрного чая до 280. Строчки разные.', 'Anna raises the oolong price to 480, Boris the black tea price to 280. Different lines.'),
        focus: ['anna', 'boris'],
        values: { anna: annaLine, boris: 'Black tea — 280' },
        metrics: { review: 0, lost: 0 },
      },
    ];
    if (broken.has('email')) {
      steps.push({
        id: 'overwrite',
        label: bi('затёрто', 'overwritten'),
        caption: bi('Общей истории нет, есть файлы в письмах. Анна отправила свой, через час Борис — свой, и его файл целиком лёг поверх её.', 'There is no shared history, only files in emails. Anna sent hers, an hour later Boris sent his, and his file replaced hers whole.'),
        focus: ['anna', 'boris', 'shared'],
        tokens: [{ edge: 'e-takeB', label: 'menu.txt', reverse: true }],
        states: { shared: 'err', anna: 'warn' },
        values: { shared: 'menu.txt · Boris’s', anna: `${annaLine} (lost)` },
        metrics: { review: 0, lost: 1 },
        broken: { at: 'shared', message: 'menu.txt (final).txt, menu.txt (final 2).txt, menu-boris-FINAL.txt', caption: bi('без машины, которая соединяет правки, побеждает тот, кто сохранил последним.', 'without a machine that joins edits, whoever saved last wins.') },
      });
      return steps;
    }
    steps.push({
      id: 'merge',
      label: bi('слияние', 'merge'),
      caption: fmt(bi('Обе правки пришли на слияние. Машина сравнивает их с исходным меню строчка за строчкой — {n} изменённых строчек.', 'Both edits came to the merge. The machine compares them with the original menu line by line: {n} changed lines.'), { n: lines * 2 }),
      focus: ['e-giveA', 'e-giveB', 'merge'],
      tokens: [{ edge: 'e-giveA', label: `+${lines}` }, { edge: 'e-giveB', label: `+${lines}` }],
      states: { merge: 'on' },
      metrics: { review: 0, lost: 0 },
    });
    if (same) {
      steps.push({
        id: 'ask',
        label: bi('решает человек', 'a person decides'),
        caption: bi('Одна строчка изменена двумя людьми по-разному. Машина не угадывает, кто прав: она показывает обе версии и ждёт, что решит человек.', 'One line was changed by two people differently. The machine does not guess who is right: it shows both versions and waits for a person to decide.'),
        focus: ['merge'],
        states: { merge: 'warn' },
        values: { merge: '260 or 280?' },
        metrics: { review: lines * 2, lost: 0 },
      });
    }
    steps.push(
      {
        id: 'result',
        label: 'v2',
        caption: same
          ? bi('Анна и Борис договорились о 280, и общая версия меню обновилась. Ни одна правка не пропала молча.', 'Anna and Boris agreed on 280, and the shared menu was updated. No edit disappeared silently.')
          : bi('Правки в разных строчках машина соединила сама: в новой общей версии и улун за 480, и чёрный чай за 280.', 'The machine joined the edits on different lines by itself: the new shared version has both the oolong at 480 and the black tea at 280.'),
        focus: ['e-result', 'shared'],
        tokens: [{ edge: 'e-result', label: 'v2' }],
        states: { shared: 'ok', merge: 'ok' },
        values: { shared: 'menu.txt · v2', merge: same ? 'decided: 280' : 'joined' },
        metrics: { review: same ? lines * 2 : p.size === 'big' ? lines * 2 : 0, lost: 0 },
      },
      {
        id: 'history',
        label: bi('история', 'history'),
        caption: p.size === 'big'
          ? bi('В истории две записи, но в каждой по 300 строчек: проверить такую правку глазами трудно, и ошибка в ней легко проскочит. Маленькие правки читать и соединять легче.', 'The history has two entries, but each has 300 lines: such an edit is hard to check by eye, and an error slips through easily. Small edits are easier to read and to join.')
          : bi('В истории две записи: «Анна, цена улуна» и «Борис, цена чёрного чая». Любую можно найти и отменить.', 'The history has two entries: “Anna, oolong price” and “Boris, black tea price”. Either can be found and undone.'),
        focus: ['e-log', 'history'],
        tokens: [{ edge: 'e-log' }],
        states: { history: 'on' },
        values: { history: 'v1 · Anna · Boris' },
        metrics: { review: same || p.size === 'big' ? lines * 2 : 0, lost: 0 },
      },
    );
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      return change.on
        ? bi('Без общей истории файлы просто заменяют друг друга: правка Анны пропала, и никто об этом не узнал.', 'Without a shared history files simply replace each other: Anna’s edit is gone, and nobody found out.')
        : bi('Общая история вернулась: правки снова соединяются, а не затирают друг друга.', 'The shared history is back: edits are joined again instead of overwriting each other.');
    }
    if (change.id === 'where')
      return b.where === 'same'
        ? bi('Одна строчка, две правки: машина останавливается и отдаёт решение людям.', 'One line, two edits: the machine stops and hands the decision to people.')
        : bi('Разные строчки машина соединяет без людей.', 'Different lines are joined by the machine without people.');
    return fmt(bi('Правки по {n} строчек: столько придётся прочитать, чтобы понять, что изменилось.', 'Edits of {n} lines each: that much has to be read to understand what changed.'), { n: (next[next.length - 1]?.metrics?.review ?? 0) / 2 || (b.size === 'big' ? 300 : 3) });
  },
});
