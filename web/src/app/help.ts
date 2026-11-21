// The «?» help in the top bar: a small panel that answers the questions a
// newcomer asks before trusting the course — where progress is kept without
// an account, how levels and the level check work, how to read a diagram,
// how to report a problem, what the AI button sends, and where the local lab
// page is. It is a dialog over the current page, not a page of its own.

import { h } from '../core/dom';
import { bi, t, type Bi } from '../core/i18n';
import { renderMd } from '../core/markdown';
import { href } from '../core/router';

export interface HelpSection {
  id: string;
  title: Bi;
  body: Bi;
  /** Shown folded under «Подробнее» / “More”. */
  more?: Bi;
}

export const HELP_TITLE = bi('Справка', 'Help');

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'progress',
    title: bi('Как сохраняется прогресс без логина и пароля', 'How progress is saved without a login and password'),
    body: bi(
      'Курс не просит регистрироваться. Пройденные уроки, ответы, выбранные уровни и ваши сообщения автору записываются в хранилище этого браузера на этом компьютере после каждого действия. На сервер курса прогресс не уходит, поэтому в другом браузере или на другом устройстве курс начнётся с чистого листа.\n\nПрогресс пропадёт, если проходить курс в приватном окне, которое забывает всё при закрытии, или очистить данные сайта в настройках браузера. Safari к тому же сам стирает данные сайта, который вы не открывали семь дней.\n\nЧтобы продолжить на другом устройстве, откройте «Настройки» и нажмите «Перенести на другое устройство»: курс покажет ссылку, которую нужно открыть на втором устройстве в течение 15 минут. Кнопка «Выгрузить прогресс» сохраняет прогресс в файл, который служит и запасной копией, а на другом устройстве этот файл загружают кнопкой «Загрузить прогресс».\n\nВход по ссылке на почту, через GitHub или Google появится позже. Аккаунт понадобится для сертификатов, и тогда прогресс будет сам переноситься между устройствами.',
      'The course does not ask you to sign up. Finished lessons, answers, chosen levels and your messages to the author are written to this browser’s storage on this computer after every action. Progress is not sent to the course’s server, so in another browser or on another device the course starts from a clean slate.\n\nProgress is lost if you take the course in a private window, which forgets everything when it closes, or if you clear the site’s data in the browser settings. Safari also erases the data of a site you have not opened for seven days.\n\nTo continue on another device, open “Settings” and press “Transfer to another device”: the course shows a link to open on the second device within 15 minutes. The “Export progress” button saves progress to a file that also serves as a backup, and on the other device the file is loaded with “Import progress”.\n\nSign-in by an e-mail link, GitHub or Google comes later. An account will be needed for certificates, and then progress will move between devices by itself.',
    ),
  },
  {
    id: 'levels',
    title: bi('Как устроены уровни и проверка уровня', 'How levels and the level check work'),
    body: bi(
      'У каждого блока курса три уровня: «Новичок», «Средний» и «Опытный». Уровень выбирают на странице блока, и от него зависят разделы уроков, которые вы увидите: новичку курс объясняет больше и подробнее, а опытному пропускает вводные разделы.\n\nЕсли тема вам уже знакома, нажмите на странице блока «Покажите, что уже умеете». Короткая проверка без подсказок и без наставника подтвердит выбранный уровень, а уроки, которые она зачла, можно пропустить. Если проверка не пройдена, курс предложит пройти уроки только по найденным пробелам или выбрать уровень ниже, а повторить проверку с другими заданиями можно через 72 часа.',
      'Every block of the course has three levels: “Beginner”, “Intermediate” and “Experienced”. You choose the level on the block’s page, and it decides which parts of the lessons you see: a beginner gets more and fuller explanations, an experienced learner skips the introductory parts.\n\nIf you already know the topic, press “Show what you already know” on the block’s page. A short check without hints or the mentor confirms the chosen level, and the lessons it covers can be skipped. If the check is not passed, the course offers to take only the lessons on the gaps it found or to choose a lower level, and the check can be retaken with other tasks in 72 hours.',
    ),
  },
  {
    id: 'diagrams',
    title: bi('Как работают схемы', 'How the diagrams work'),
    body: bi(
      'Схема показывает процесс по шагам: нажимайте «Шаг вперёд» или «Проиграть», а щелчок по любому элементу схемы открывает карточку с его объяснением.',
      'A diagram shows a process step by step: press “Step forward” or “Play”, and a click on any element of the diagram opens a card that explains it.',
    ),
    more: bi(
      'В «Параметрах» схемы меняются условия, при которых идёт процесс, а переключатели «Сломать» включают настоящие неисправности, и схема останавливается на том шаге, где остановилась бы настоящая система. Перед изменением схема иногда спрашивает «Что будет?» и после него показывает, совпало ли ваше предположение. Инструкция к каждой схеме открывается строкой «Как пользоваться схемой».',
      'Under “Parameters” you change the conditions the process runs in, and the “Break it” switches turn on real faults, so the diagram stops at the step where a real system would stop. Before a change the diagram sometimes asks “What will happen?” and afterwards shows whether your guess was right. Each diagram’s instructions open from the line “How to use the diagram”.',
    ),
  },
  {
    id: 'report',
    title: bi('Как сообщить о проблеме и прочитать ответ', 'How to report a problem and read the reply'),
    body: bi(
      'Если в курсе ошибка, что-то непонятно или не работает, нажмите кнопку «Сообщить о проблеме» в правом нижнем углу экрана или выделите текст и нажмите появившуюся кнопку «Комментировать». Перед отправкой можно раскрыть строку под полем сообщения и увидеть всё, что уйдёт вместе с ним: место в курсе и вывод терминала.\n\nОтветы автора появляются на странице «Мои сообщения» в верхнем меню. Аккаунт для этого тоже не нужен: переписка хранится в этом браузере и переносится на другое устройство вместе с файлом прогресса.',
      'If something in the course is wrong, unclear or broken, press “Report a problem” in the bottom right corner of the screen, or select some text and press the “Comment” button that appears. Before sending you can open the line under the message box and see everything that goes with it: the place in the course and the terminal output.\n\nThe author’s replies appear on the “My messages” page in the top menu. No account is needed for that either: the conversation is kept in this browser and moves to another device together with the progress file.',
    ),
  },
  {
    id: 'ai',
    title: bi('Что делает кнопка «Разобраться с нейросетью»', 'What the “Understand with AI” button does'),
    body: bi(
      'Когда подсказки к заданию закончились, попытка не удалась или вы ответили на вопрос, рядом появляется кнопка «Разобраться с нейросетью». Кнопка составляет запрос о том, что вы сейчас проходите, и показывает его целиком, а вы можете поправить текст, скопировать его или открыть выбранный чат в новой вкладке. Сам курс ничего нейросетям не отправляет: запрос уходит, только когда вы вставляете его в чат или нажимаете кнопку чата. На экзаменах и на проверке уровня этой кнопки нет.',
      'When the hints of a task run out, an attempt fails or you have answered a question, an “Understand with AI” button appears next to it. The button writes a prompt about what you are working on and shows the whole prompt, which you can edit, copy, or open in a chat of your choice in a new tab. The course itself sends nothing to any AI: the prompt leaves only when you paste it into a chat or press a chat’s button. Exams and level checks do not have this button.',
    ),
  },
  {
    id: 'lab',
    title: bi('Где взять настоящие машины', 'Where to get real machines'),
    body: bi(
      'Для уроков и экзаменов на настоящих машинах не обязательно арендовать серверы в облаке. Программа dtlab бесплатно запускает виртуальные машины курса на вашем компьютере, то есть отдельные компьютеры со своей системой, которые работают внутри вашего. Как её поставить, рассказано на странице «Лаборатория на своём компьютере».',
      'Lessons and exams on real machines do not require renting servers in a cloud. The dtlab program runs the course’s virtual machines on your own computer for free, that is, separate computers with their own system that run inside yours. How to install it is told on the page “A lab on your own computer”.',
    ),
  },
];

const MORE = bi('Подробнее', 'More');
const CLOSE = bi('Закрыть справку', 'Close help');
const OPEN = bi('Открыть справку о том, как устроен курс', 'Open help on how the course works');
export const LOCAL_LAB_LINK = bi('Лаборатория на своём компьютере', 'A lab on your own computer');

let active: { close: () => void } | null = null;

/** Opens the help panel; a second call while it is open closes it. */
export function openHelp(opener?: HTMLElement): HTMLDialogElement | null {
  if (active) {
    active.close();
    return null;
  }
  const previous = opener ?? (document.activeElement as HTMLElement | null);
  const dialog = h('dialog.help-dialog', { 'aria-labelledby': 'help-title' }) as HTMLDialogElement;
  const close = () => {
    if (!active) return;
    active = null;
    window.removeEventListener('hashchange', close);
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    opener?.setAttribute('aria-expanded', 'false');
    previous?.focus();
  };
  active = { close };
  const closeBtn = h('button.icon-btn.help-close', { type: 'button', 'aria-label': t(CLOSE), title: t(CLOSE), onclick: close }, '×');
  const sections = HELP_SECTIONS.map((s) =>
    h(
      'section.help-sec',
      { 'data-help': s.id },
      h('h3', {}, t(s.title)),
      h('div.prose', {}, renderMd(t(s.body))),
      s.more ? h('details.help-more', {}, h('summary', {}, t(MORE)), h('div.prose', {}, renderMd(t(s.more)))) : null,
      s.id === 'lab' ? h('p', {}, h('a.btn.small', { href: href({ name: 'local-lab' }) }, t(LOCAL_LAB_LINK))) : null,
    ),
  );
  dialog.append(
    h('header.help-head', {}, h('h2', { id: 'help-title' }, t(HELP_TITLE)), closeBtn),
    h('div.help-body', {}, ...sections, h('p.small.muted', {}, h('a', { href: href({ name: 'settings' }) }, t(bi('Открыть настройки', 'Open settings'))))),
  );
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  window.addEventListener('hashchange', close);
  document.body.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  opener?.setAttribute('aria-expanded', 'true');
  closeBtn.focus();
  return dialog;
}

/** The «?» button of the top bar. */
export function helpButton(): HTMLButtonElement {
  const b = h('button.icon-btn.help-btn', { type: 'button', 'aria-label': t(OPEN), title: t(OPEN), 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, '?') as HTMLButtonElement;
  b.addEventListener('click', () => openHelp(b));
  return b;
}

/** Closes the panel if it is open (the shell calls it on a language change). */
export function closeHelp(): void {
  active?.close();
}
