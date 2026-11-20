// Two people edit one text: each works on a copy, a machine joins the edits
// and keeps the history; edits on the same line wait for a person (F12).
//
// Reading order: at the start there is only the shared copy of the menu.
// Anna's and Boris's copies appear when they take them, the merge appears when
// both hand their edits over, and the history comes last. Without the merge
// (the break) the two files simply travel back and the later one wins.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, fmtb, startWith, tr } from './kit';

type P = { where: string; size: string };

const PROGIT = { url: 'https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control', label: 'Pro Git › About Version Control' };
const ALL = ['shared', 'anna', 'boris', 'merge', 'history', 'e-takeA', 'e-takeB', 'e-giveA', 'e-giveB', 'e-result', 'e-log', 'e-mailA', 'e-mailB'];

export const togetherModel = defineModel<P>({
  id: 'orient.together',
  frame: 'visible',
  block: 'orient',
  title: bi('Анна и Борис правят один файл', 'Two people edit one text'),
  summary: bi(
    'Анна и Борис меняют цены в меню чайного магазина. Каждый правит свою копию файла, программа совместной работы сравнивает обе копии с общей, соединяет правки и записывает в историю, кто что изменил. Если оба изменили одну и ту же строчку по-разному, программа не угадывает, а спрашивает человека.',
    'Anna and Boris change prices in the tea shop’s menu. Each edits a copy; a collaboration program compares both with the shared one, joins the edits and records who changed what. If two people changed the same line differently, it asks a person.',
  ),
  intro: bi(
    'Сейчас на схеме только общая копия меню. Нажмите «Начать с первого шага», и Анна с Борисом возьмут себе по копии.',
    'Now the diagram shows only the shared copy of the menu. Press “Start from the first step”, and Anna and Boris each take a copy.',
  ),
  legend: [
    { mark: 'active', text: bi('тот, кто работает сейчас', 'the one working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('копия меню, правка или новая версия', 'a copy, an edit or a new version') },
    { mark: 'icon:file', text: bi('общая копия меню', 'the shared menu') },
    { mark: 'icon:user', text: bi('копии Анны и Бориса', 'Anna’s and Boris’s copies') },
    { mark: 'icon:process', text: bi('программа слияния', 'the merge program') },
    { mark: 'icon:database', text: bi('история правок', 'the history') },
    { mark: 'warn', text: bi('нужно решение человека', 'a person must decide') },
    { mark: 'err', text: bi('чья-то правка пропала', 'someone’s edit was lost') },
  ],
  stopLabel: bi('Правка пропала', 'An edit was lost'),
  concepts: ['orient.collaboration'],
  diagram: {
    width: 960,
    height: 384,
    nodes: [
      { id: 'shared', label: bi('Общая копия', 'Shared copy'), icon: 'file', sub: 'menu.txt · v1', family: 'store', x: 376, y: 24, w: 208, h: 64, card: card(bi('Главная версия меню, с которой все начинают работу и в которую возвращаются все правки. Напрямую её никто не правит.', 'The main version everyone starts from and every edit returns to. Nobody edits it directly.'), bi('Команда договорилась, что главной будет эта копия.', 'The team agreed this one is the main one.'), { doc: PROGIT }) },
      { id: 'anna', label: bi('Копия Анны', 'Anna’s copy'), icon: 'user', work: 'dots', sub: 'Oolong — 450', family: 'user', x: 24, y: 160, w: 208, h: 64, card: card(bi('Анна взяла копию меню и правит её у себя, никому не мешая.', 'Anna edits her copy without getting in anyone’s way.'), bi('Копию ведёт Анна.', 'Anna.')) },
      { id: 'boris', label: bi('Копия Бориса', 'Boris’s copy'), icon: 'user', work: 'dots', sub: 'Black tea — 250', family: 'user', x: 728, y: 160, w: 208, h: 64, card: card(bi('Борис в то же время взял такую же копию и правит в ней своё.', 'Boris took the same copy at the same time.'), bi('Копию ведёт Борис.', 'Boris.')) },
      { id: 'merge', label: bi('Слияние', 'Merge'), icon: 'process', sub: '', family: 'flow', x: 376, y: 160, w: 208, h: 64, card: card(bi('Программа сравнивает обе копии с общей строчку за строчкой. Правки в разных строчках она соединяет сама, а строчку, которую оба изменили по-разному, оставляет решать человеку.', 'Compares both copies with the shared one line by line; joins edits on different lines, leaves a contested line to a person.'), bi('Слияние выполняет программа совместной работы, чаще всего Git.', 'A collaboration program, most often Git.'), { doc: PROGIT }) },
      { id: 'history', label: bi('История', 'History'), icon: 'database', sub: 'v1', family: 'store', x: 376, y: 296, w: 208, h: 64, card: card(bi('В истории хранится список всех правок, и по нему видно, кто, что и когда изменил. По этому списку находят, какая правка принесла ошибку, и возвращают любую прошлую версию.', 'Who changed what and when; any past version can be brought back.'), bi('Историю записывает программа совместной работы.', 'The collaboration program.')) },
    ],
    edges: [
      { id: 'e-takeA', from: 'shared', to: 'anna', via: [[128, 56]], label: bi('копия', 'copy'), card: card(bi('Анна берёт себе копию общей версии.', 'Anna takes a copy of the shared version.'), bi('Копию берёт Анна.', 'Anna.')) },
      { id: 'e-takeB', from: 'shared', to: 'boris', via: [[832, 56]], label: bi('копия', 'copy'), card: card(bi('Борис берёт такую же копию.', 'Boris takes the same copy.'), bi('Копию берёт Борис.', 'Boris.')) },
      { id: 'e-giveA', from: 'anna', to: 'merge', label: bi('правка Анны', 'Anna’s edit'), card: card(bi('Анна отдаёт свою правку на слияние.', 'Anna hands her edit to the merge.'), bi('Правку отдаёт Анна.', 'Anna.')) },
      { id: 'e-giveB', from: 'boris', to: 'merge', label: bi('правка Бориса', 'Boris’s edit'), card: card(bi('Борис тоже отдаёт свою правку на слияние.', 'Boris hands over his.'), bi('Правку отдаёт Борис.', 'Boris.')) },
      { id: 'e-result', from: 'merge', to: 'shared', label: bi('новая версия', 'new version'), card: card(bi('Соединённый текст становится новой общей версией меню.', 'The joined text becomes the new shared version.'), bi('Новую версию записывает программа совместной работы.', 'The collaboration program.')) },
      { id: 'e-mailA', from: 'anna', to: 'shared', dashed: true, via: [[200, 112]], labelAt: 0.6, label: bi('весь файл почтой', 'whole file by email'), card: card(bi('Без программы слияния Анна отправляет свой файл целиком, и он заменяет общую копию.', 'Without a merge Anna sends her whole file, and it replaces the shared copy.'), bi('Файл отправляет Анна.', 'Anna.')) },
      { id: 'e-mailB', from: 'boris', to: 'shared', dashed: true, via: [[760, 112]], labelAt: 0.6, label: bi('весь файл почтой', 'whole file by email'), card: card(bi('Борис тоже отправляет файл целиком, и последний отправленный файл побеждает.', 'Boris also sends his whole file; the last one wins.'), bi('Файл отправляет Борис.', 'Boris.')) },
      { id: 'e-log', from: 'merge', to: 'history', label: bi('кто, что, когда', 'who, what, when'), card: card(bi('Каждое слияние оставляет в истории запись.', 'Every merge leaves an entry in the history.'), bi('Запись делает программа совместной работы.', 'The collaboration program.')) },
    ],
  },
  params: [
    {
      id: 'where',
      label: bi('Какие строчки меню правят Анна и Борис', 'Which lines they edit'),
      group: bi('Правки Анны и Бориса', 'Anna’s and Boris’s edits'),
      kind: 'choice',
      default: 'different',
      near: 'merge',
      options: [
        { id: 'different', label: bi('Анна меняет цену улуна, а Борис — цену чёрного чая, то есть они правят разные строчки', 'Anna changes the oolong price and Boris the black tea price, so they edit different lines') },
        { id: 'same', label: bi('Оба меняют цену чёрного чая, то есть правят одну и ту же строчку', 'Both change the black tea price, so they edit the same line') },
      ],
      predict: {
        prompt: bi('Вы изменили, какие строчки правят Анна и Борис. Что сделает программа при слиянии?', 'You changed which lines they edit. What will the program do at the merge?'),
        options: [
          { id: 'join', text: bi('Соединит обе правки сама', 'Join both edits by itself') },
          { id: 'ask', text: bi('Остановится и покажет обе версии строчки человеку', 'Stop and show both versions to a person') },
          { id: 'last', text: bi('Оставит ту правку, которая пришла последней', 'Keep whichever came last') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.id === 'ask') ? 'ask' : 'join'),
      },
    },
    {
      id: 'size',
      label: bi('Насколько большие правки', 'How big the edits are'),
      group: bi('Правки Анны и Бориса', 'Anna’s and Boris’s edits'),
      kind: 'choice',
      default: 'small',
      near: 'history',
      options: [
        { id: 'small', label: bi('Каждый меняет одну строчку с ценой, и на работу уходит полчаса', 'Each changes one line with a price, and the work takes half an hour') },
        { id: 'big', label: bi('Каждый меняет по 300 строчек, и на работу уходит неделя', 'Each changes 300 lines, and the work takes a week') },
      ],
    },
  ],
  breaks: [
    {
      id: 'email',
      label: bi('Анна и Борис обходятся без программы слияния и пересылают файл почтой', 'Anna and Boris do without a merge program and send the file by email'),
      remove: ['merge', 'e-giveA', 'e-giveB', 'e-log', 'history'],
      predict: {
        prompt: bi('Анна и Борис правят каждый свою копию и рассылают файл целиком по почте. Борис отправил свой файл последним. Что станет с правкой Анны?', 'Each edits a copy and emails the whole file. Boris sent his last. What becomes of Anna’s edit?'),
        options: [
          { id: 'lost', text: bi('Правка пропадёт, потому что файл Бориса целиком заменит файл Анны', 'The edit is lost, because Boris’s file replaces Anna’s whole') },
          { id: 'kept', text: bi('Правка сохранится, потому что правки соединятся сами', 'The edit survives, because the edits join by themselves') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken) ? 'lost' : 'kept'),
      },
    },
  ],
  metrics: [
    { id: 'review', label: bi('сколько строчек проверить глазами', 'lines to check by eye') },
    { id: 'lost', label: bi('сколько правок пропало', 'edits lost') },
  ],
  run(p, broken): Step[] {
    const lines = p.size === 'big' ? 300 : 1;
    const changed = (n: number) => bi(`${n} ${pluralRu(n, ['изменённую строчку', 'изменённые строчки', 'изменённых строчек'])}`, `${n} changed ${n === 1 ? 'line' : 'lines'}`);
    const same = p.where === 'same';
    const annaLine = same ? 'Black tea — 260' : 'Oolong — 480';
    const steps: Step[] = [
      {
        id: 'shared',
        label: bi('общая копия', 'shared copy'),
        caption: bi('В общей копии меню улун стоит 450, а чёрный чай 250. Эта копия служит главной версией, с которой все начинают работу, и напрямую её никто не правит.', 'In the shared menu oolong costs 450 and black tea 250. Nobody edits it directly.'),
        focus: ['shared'],
        say: { shared: bi('В общей копии меню улун стоит 450, а чёрный чай 250.', 'In the shared menu oolong costs 450 and black tea 250.') },
        states: { ...startWith(ALL, 'shared'), shared: 'on' },
        values: { shared: 'menu.txt · v1', history: 'v1', anna: 'Oolong — 450', boris: 'Black tea — 250', merge: '' },
        metrics: { review: 0, lost: 0 },
      },
      {
        id: 'copyA',
        label: bi('копия Анны', 'Anna’s copy'),
        caption: bi('Анна берёт себе копию общего меню. Дальше она работает со своей копией и никому не мешает.', 'Anna takes a copy and works on it without disturbing anyone.'),
        focus: ['e-takeA', 'anna'],
        reveal: ['anna', 'e-takeA'],
        tokens: [{ edge: 'e-takeA', label: 'menu.txt v1' }],
        say: { anna: bi('Анна взяла себе копию меню.', 'Anna took a copy.') },
        states: { anna: 'on' },
        metrics: { review: 0, lost: 0 },
      },
      {
        id: 'copyB',
        label: bi('копия Бориса', 'Boris’s copy'),
        caption: bi('В то же утро Борис берёт такую же копию. Теперь у каждого своя копия, и правят они их независимо друг от друга.', 'The same morning Boris takes the same copy.'),
        focus: ['e-takeB', 'boris'],
        reveal: ['boris', 'e-takeB'],
        tokens: [{ edge: 'e-takeB', label: 'menu.txt v1' }],
        say: { boris: bi('Борис взял такую же копию меню.', 'Boris took the same copy.') },
        states: { boris: 'on' },
        metrics: { review: 0, lost: 0 },
      },
      {
        id: 'editA',
        label: bi('правка Анны', 'Anna edits'),
        caption: same ? bi('Анна решает, что чёрный чай должен стоить 260, и меняет эту строчку в своей копии.', 'Anna sets black tea to 260 in her copy.') : bi('Анна повышает цену улуна с 450 до 480 в своей копии.', 'Anna raises oolong from 450 to 480 in her copy.'),
        focus: ['anna'],
        say: { anna: same ? bi('Анна ставит чёрному чаю цену 260.', 'Anna sets black tea to 260.') : bi('Анна повышает цену улуна до 480.', 'Anna raises oolong to 480.') },
        values: { anna: annaLine },
        metrics: { review: 0, lost: 0 },
      },
      {
        id: 'editB',
        label: bi('правка Бориса', 'Boris edits'),
        caption: same ? bi('Борис тем временем решает, что чёрный чай должен стоить 280, и меняет ту же самую строчку в своей копии.', 'Boris meanwhile sets the same line to 280.') : bi('Борис тем временем повышает цену чёрного чая с 250 до 280. Анна и Борис правили разные строчки.', 'Boris raises black tea to 280: a different line.'),
        focus: ['boris'],
        say: { boris: bi('Борис ставит чёрному чаю цену 280.', 'Boris sets black tea to 280.') },
        values: { boris: 'Black tea — 280' },
        metrics: { review: 0, lost: 0 },
      },
    ];
    if (broken.has('email')) {
      steps.push(
        {
          id: 'sendA',
          label: bi('письмо Анны', 'Anna’s email'),
          caption: bi('Программы слияния нет, и Анна рассылает свой файл целиком по почте. Её файл становится общей копией.', 'There is no merge: Anna sends her whole file, and it becomes the shared copy.'),
          focus: ['e-mailA', 'shared'],
          reveal: ['e-mailA'],
          tokens: [{ edge: 'e-mailA', label: bi('файл Анны', 'Anna’s file') }],
          say: { shared: bi('Общей копией стал файл Анны с улуном за 480.', 'Anna’s file is now the shared copy.') },
          values: { shared: tr('menu.txt · файл Анны', 'menu.txt · Anna’s') },
          metrics: { review: 0, lost: 0 },
        },
        {
          id: 'sendB',
          label: bi('письмо Бориса', 'Boris’s email'),
          caption: bi('Через час Борис отправляет свой файл, тоже целиком. Его файл ложится поверх файла Анны, и в общем меню улун снова стоит 450. Правка Анны пропала молча, и никто об этом не узнал.', 'An hour later Boris sends his whole file; it replaces Anna’s, and her edit is silently gone, with nobody finding out.'),
          focus: ['e-mailB', 'shared'],
          reveal: ['e-mailB'],
          tokens: [{ edge: 'e-mailB', label: bi('файл Бориса', 'Boris’s file') }],
          say: { shared: bi('Файл Бориса лёг поверх файла Анны, и её правка пропала.', 'Boris’s file replaced Anna’s; her edit is gone.') },
          states: { shared: 'err', anna: 'warn' },
          values: { shared: tr('menu.txt · файл Бориса', 'menu.txt · Boris’s'), anna: tr(`${annaLine} (пропала)`, `${annaLine} (lost)`) },
          metrics: { review: 0, lost: 1 },
          broken: { at: 'shared', message: 'menu.txt (final).txt, menu.txt (final 2).txt, menu-boris-FINAL.txt', caption: bi('Правка Анны пропала из общей копии. Без программы, которая соединяет правки, побеждает тот, кто сохранил файл последним. Ниже перечислены файлы, которые в жизни скапливаются в такой папке: «окончательный», «окончательный 2», «Бориса, ОКОНЧАТЕЛЬНЫЙ».', 'Anna’s edit vanished from the shared copy. Without a program that joins edits, whoever saved the file last wins. Below are the files that pile up in such a folder in real life: “final”, “final 2”, “Boris’s, FINAL”.') },
        },
      );
      return steps;
    }
    steps.push({
      id: 'merge',
      label: bi('слияние', 'merge'),
      caption: fmtb(bi('Анна и Борис отдают свои правки на слияние. Программа сравнивает обе копии с общей строчку за строчкой и находит {n}, по {k} в каждой копии.', 'Anna and Boris hand their edits over to the merge. The program compares both copies with the shared one line by line and finds {n}, {k} in each copy.'), { n: changed(lines * 2), k: lines }),
      focus: ['e-giveA', 'e-giveB', 'merge'],
      reveal: ['merge', 'e-giveA', 'e-giveB'],
      tokens: [
        { edge: 'e-giveA', label: `+${lines}` },
        { edge: 'e-giveB', label: `+${lines}` },
      ],
      say: { merge: fmtb(bi('Программа слияния сравнила обе копии с общей и нашла {n}.', 'The merge program compared both copies with the shared one and found {n}.'), { n: changed(lines * 2) }) },
      states: { merge: 'on' },
      metrics: { review: 0, lost: 0 },
    });
    if (same)
      steps.push({
        id: 'ask',
        label: bi('решает человек', 'a person decides'),
        caption: bi('Строчку с чёрным чаем изменили оба, и каждый по-своему. Программа не знает, какая цена правильная, поэтому не пытается угадать, а показывает Анне и Борису обе версии и ждёт, что решат люди.', 'One line was changed differently by two people. The program does not guess: it shows both versions and waits for people.'),
        focus: ['merge'],
        say: { merge: bi('Одну и ту же строчку изменили по-разному, и выбрать между 260 и 280 должен человек.', 'The same line was changed differently, and a person must choose between 260 and 280.') },
        states: { merge: 'warn' },
        values: { merge: tr('260 или 280?', '260 or 280?') },
        metrics: { review: lines * 2, lost: 0 },
      });
    steps.push(
      {
        id: 'result',
        label: 'v2',
        caption: same
          ? bi('Анна и Борис договорились о цене 280, и общая версия меню обновилась. Ни одна правка не пропала молча.', 'They agreed on 280, and the shared menu was updated. No edit vanished silently.')
          : bi('Правки в разных строчках программа соединила сама, и в новой общей версии улун стоит 480, а чёрный чай 280.', 'Edits on different lines were joined: oolong 480 and black tea 280.'),
        focus: ['e-result', 'shared'],
        reveal: ['e-result'],
        tokens: [{ edge: 'e-result', label: 'v2' }],
        say: { shared: same ? bi('В общей копии чёрный чай теперь стоит 280.', 'The shared copy: black tea at 280.') : bi('В общей копии теперь обе новые цены.', 'The shared copy has both new prices.') },
        states: { shared: 'ok', merge: 'ok' },
        values: { shared: 'menu.txt · v2', merge: same ? tr('решили: 280', 'decided: 280') : tr('соединено', 'joined') },
        metrics: { review: same || p.size === 'big' ? lines * 2 : 0, lost: 0 },
      },
      {
        id: 'history',
        label: bi('история', 'history'),
        caption:
          p.size === 'big'
            ? bi('В истории две записи, но в каждой по 300 строчек. Проверить такую правку глазами трудно, и ошибка в ней легко проскочит. Маленькие правки проще и прочитать, и соединить.', 'Two entries of 300 lines each: hard to check by eye. Small edits are easier to read and join.')
            : same
              ? bi('В истории записано, что строчку с чёрным чаем меняли и Анна, и Борис и что в итоге они договорились о цене 280. Любую из этих правок можно найти и отменить.', 'The history records that both changed the black tea line and agreed on 280. Either edit can be undone.')
              : bi('В истории появились две записи, «Анна, цена улуна» и «Борис, цена чёрного чая». Любую из них можно найти и отменить.', 'Two entries: “Anna, oolong price” and “Boris, black tea price”. Either can be undone.'),
        focus: ['e-log', 'history'],
        reveal: ['history', 'e-log'],
        tokens: [{ edge: 'e-log', label: bi('Анна · Борис', 'Anna · Boris') }],
        say: { history: p.size === 'big' ? bi('В истории две правки по 300 строчек, и проверять их долго.', 'Two edits of 300 lines each.') : bi('История запомнила, кто, что и когда изменил.', 'The history records who changed what.') },
        states: { history: p.size === 'big' ? 'warn' : 'on' },
        values: { history: tr('v1 · Анна · Борис', 'v1 · Anna · Boris') },
        metrics: { review: same || p.size === 'big' ? lines * 2 : 0, lost: 0 },
      },
    );
    return steps;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') {
      return change.on
        ? bi('Без программы слияния файлы целиком заменяют друг друга, поэтому правка Анны пропала, и никто об этом не узнал.', 'Without the merge files replace each other: Anna’s edit is gone unnoticed.')
        : bi('Программа слияния снова работает, поэтому правки соединяются, а не затирают друг друга.', 'The merge program works again, so edits are joined instead of overwriting each other.');
    }
    if (change.id === 'where')
      return b.where === 'same'
        ? bi('Теперь Анна и Борис правят одну и ту же строчку, поэтому программа останавливается и отдаёт решение людям.', 'One line, two edits: the program hands the decision to people.')
        : bi('Теперь Анна и Борис правят разные строчки, и программа соединяет их правки без участия людей.', 'Different lines are joined without people.');
    return b.size === 'big'
      ? bi('Каждый теперь правит по 300 строчек. Столько строчек придётся прочитать, чтобы понять, что изменилось, и в стольких же местах правки могут столкнуться.', 'Edits of 300 lines each: that much to read.')
      : bi('Правки снова маленькие, по одной строчке у каждого, поэтому их быстро прочитать и легко соединить.', 'The edits are small again, one line each, so they are quick to read and easy to join.');
  },
});
