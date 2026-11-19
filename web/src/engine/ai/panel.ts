// The tutor side panel: any lesson can open it (the launcher button on lesson
// and lab pages, or openTutor() from a widget). It streams answers from the
// learner's own AI, follows the hint ladder H1–H5 in practice, asks "where
// have you looked?" at DL4, and is switched off during exams and placement
// checks. "Show every request" displays exactly what goes to the provider,
// layer by layer (explainer П3 "What your AI sees", 09 §1.12).

import { clear, copyText, h, icon, toast } from '../../core/dom';
import { bi, t, type Bi } from '../../core/i18n';
import { renderMd } from '../../core/markdown';
import { href } from '../../core/router';
import { store } from '../../core/store';
import type { HintLevel } from '../../core/types';
import { AiError, type ChatMessage } from './client';
import { currentTask, gather, where } from './context';
import { nextHintStep, suggestedCommands, type BuiltPrompt, type TutorMode } from './prompt';
import { ai, ERRORS } from './service';
import { turn } from './tutor';
import './ai.css';

export interface TutorOptions {
  mode?: TutorMode;
  /** A question to send right away. */
  question?: string;
  /** What is on screen now (Mounted.describe of the widget that opened the panel). */
  screen?: () => string | undefined;
}

const T = {
  title: bi('Наставник', 'Tutor'),
  close: bi('Закрыть', 'Close'),
  modes: {
    explain: bi('Объяснить', 'Explain'),
    practice: bi('Задание', 'Task'),
    docs: bi('Документация', 'Docs'),
    free: bi('Свободно', 'Free'),
    review: bi('Разбор', 'Review'),
    exam: bi('Экзамен', 'Exam'),
  } as Record<TutorMode, Bi>,
  modeHelp: {
    explain: bi('Объясняет теорию урока другими словами, в рамках понятий, которые вы уже прошли.', 'Explains the lesson’s theory in other words, within the concepts you have already met.'),
    practice: bi('Подсказывает по лестнице: сначала вопрос, потом где смотреть, потом понятие. Готового решения не даёт.', 'Hints step by step: first a question, then where to look, then the concept. Never gives the ready solution.'),
    docs: bi('Не называет флаг: спрашивает, где вы смотрели, и направляет в man, --help или kubectl explain.', 'Never names the flag: asks where you looked and points you to man, --help or kubectl explain.'),
    free: bi('Разбирает любые команды и вывод вне заданий.', 'Takes apart any commands and output outside the tasks.'),
    review: bi('Объясняет ответ на вопрос повторения.', 'Explains the answer to a review question.'),
    exam: bi('На экзамене и во входной проверке наставник выключен: здесь вы проверяете себя сами.', 'During exams and placement checks the tutor is off: here you check yourself.'),
  } as Record<TutorMode, Bi>,
  notConnected: bi('Наставник работает на вашей нейросети: запросы идут прямо из браузера к вашему провайдеру. Подключите её в настройках.', 'The tutor runs on your own AI: requests go straight from the browser to your provider. Connect it in the settings.'),
  connect: bi('Подключить', 'Connect'),
  placeholder: bi('Что непонятно? Ctrl+Enter — отправить', 'What is unclear? Ctrl+Enter to send'),
  placeholderDocs: bi('Где вы уже смотрели? Что нашли?', 'Where have you looked? What did you find?'),
  send: bi('Спросить', 'Ask'),
  stop: bi('Остановить', 'Stop'),
  nextHint: bi('Следующая подсказка', 'Next hint'),
  hintAsk: bi('Дай следующую подсказку к заданию.', 'Give me the next hint for the task.'),
  noMoreHints: bi('Подсказки кончились: дальше — документация и ваши опыты в терминале.', 'No more hints: from here on, the documentation and your own experiments in the terminal.'),
  showReq: bi('Показывать каждый запрос', 'Show every request'),
  request: bi('Что ушло провайдеру', 'What went to the provider'),
  tokens: bi('≈ {n} токенов', '≈ {n} tokens'),
  rephrased: bi('Первый ответ называл решение — наставник пересказал его без него.', 'The first answer named the solution — the tutor said it again without it.'),
  folded: bi('Ответ всё равно называет решение. Показать?', 'The answer still names the solution. Show it?'),
  copy: bi('Копировать', 'Copy'),
  copied: bi('Скопировано — вставьте в терминал сами', 'Copied — paste it into the terminal yourself'),
  context: bi('Видит: урок, введённые понятия, последние строки терминала и открытую документацию. Не видит: эталонное решение.', 'Sees: the lesson, the concepts introduced so far, the last terminal lines and the documentation you opened. Does not see: the reference solution.'),
  you: bi('Вы', 'You'),
};

let panel: HTMLElement | null = null;
let state: { mode: TutorMode; history: ChatMessage[]; hints: Map<string, number>; showRequests: boolean; abort?: () => void } = {
  mode: 'explain',
  history: [],
  hints: new Map(),
  showRequests: false,
};
let lastLesson: string | undefined;

function autoMode(): TutorMode {
  const w = where();
  if (w.exam) return 'exam';
  const ct = currentTask(w.lesson);
  if (ct) return (ct.docStep ?? 0) >= 4 || ct.task.beyond ? 'docs' : 'practice';
  return w.lesson ? 'explain' : 'free';
}

function answerNode(text: string): HTMLElement {
  const box = h('div.tutor-answer.prose');
  box.append(renderMd(text, { code: (code, lang) => h('pre', { class: `code lang-${lang || 'text'}` }, h('code', {}, code)) }));
  const cmds = suggestedCommands(text);
  if (cmds.length)
    box.append(
      h(
        'div.chips',
        {},
        ...cmds.map((c) =>
          h('button.chip.cmd', { type: 'button', title: t(T.copy), onclick: async () => toast(t((await copyText(c)) ? T.copied : bi('Не удалось скопировать', 'Could not copy'))) }, icon('copy'), c),
        ),
      ),
    );
  return box;
}

function requestView(p: BuiltPrompt): HTMLElement {
  return h(
    'details.tutor-req',
    {},
    h('summary', {}, `${t(T.request)} · ${t({ ru: T.tokens.ru.replace('{n}', String(p.tokens)), en: T.tokens.en.replace('{n}', String(p.tokens)) })}`),
    ...p.layers.map((l, i) => h('details.tutor-layer', {}, h('summary', {}, `${i + 1}. ${t(l.title)}`), h('pre', {}, l.text))),
  );
}

export function closeTutor(): void {
  state.abort?.();
  panel?.remove();
  panel = null;
  document.documentElement.removeAttribute('data-tutor');
}

export function isTutorOpen(): boolean {
  return !!panel;
}

export function openTutor(o: TutorOptions = {}): void {
  const w = where();
  if (w.lesson?.id !== lastLesson) {
    state = { ...state, history: [], hints: new Map() };
    lastLesson = w.lesson?.id;
  }
  state.mode = w.exam ? 'exam' : (o.mode ?? autoMode());
  panel?.remove();
  panel = h('aside.tutor', { role: 'complementary', 'aria-label': t(T.title) });
  document.documentElement.setAttribute('data-tutor', '');
  document.body.append(panel);
  draw(o);
  if (o.question && state.mode !== 'exam') void send(o.question, o);
}

const thread = () => panel?.querySelector<HTMLElement>('.tutor-thread') ?? null;

function draw(o: TutorOptions) {
  if (!panel) return;
  clear(panel);
  const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(T.close), title: t(T.close) }, icon('close'));
  closeBtn.addEventListener('click', closeTutor);
  panel.append(h('header.tutor-head', {}, h('h2', {}, icon('ask'), t(T.title)), closeBtn));

  if (state.mode === 'exam') {
    panel.append(h('p.tutor-off', {}, t(T.modeHelp.exam)));
    return;
  }
  const modes: TutorMode[] = ['explain', 'practice', 'docs', 'free'];
  const seg = h('div.segmented.tutor-modes', { role: 'radiogroup', 'aria-label': t(bi('Режим', 'Mode')) });
  for (const m of modes) {
    const r = h('input', { type: 'radio', name: 'tutor-mode', value: m, checked: state.mode === m }) as HTMLInputElement;
    r.addEventListener('change', () => {
      state.mode = m;
      draw(o);
    });
    seg.append(h('label', {}, r, h('span', {}, t(T.modes[m]))));
  }
  const w = where();
  const ct = currentTask(w.lesson);
  const ctxLine = h(
    'p.tutor-ctx.small.muted',
    {},
    w.lesson ? `${t(w.lesson.title)}` : t(bi('Вне урока', 'Outside a lesson')),
    ct ? ` · ${t(ct.task.prompt).replace(/[`*[\]]/g, '').slice(0, 90)}${ct.docStep ? ` · DL${ct.docStep}` : ''}` : '',
  );
  panel.append(seg, h('p.small.tutor-help', {}, t(T.modeHelp[state.mode])), ctxLine);

  if (!ai().status.configured) {
    panel.append(h('div.tutor-connect', {}, h('p', {}, t(T.notConnected)), h('a.btn.primary.small', { href: href({ name: 'settings' }), onclick: closeTutor }, t(T.connect))));
    return;
  }

  const list = h('div.tutor-thread', { 'aria-live': 'polite' });
  for (let i = 0; i < state.history.length; i++) {
    const m = state.history[i];
    list.append(m.role === 'user' ? h('div.tutor-q', {}, h('span.tutor-who', {}, t(T.you)), h('p', {}, m.content)) : answerNode(m.content));
  }
  panel.append(list);

  if (state.mode === 'practice' && ct) {
    const used = state.hints.get(ct.task.id) ?? 0;
    const next = nextHintStep(used, ct.docStep);
    const hb = h('button.btn.ghost.small', { type: 'button', disabled: !next }, icon('eye'), next ? `${t(T.nextHint)}: ${next}` : t(T.noMoreHints));
    hb.addEventListener('click', () => next && void send(t(T.hintAsk), o, next));
    panel.append(h('div.tutor-ladder', {}, hb, h('span.small.muted', {}, used ? `H${used}/5` : 'H0/5')));
  }

  const ta = h('textarea.tutor-input', { rows: 3, placeholder: t(state.mode === 'docs' ? T.placeholderDocs : T.placeholder) }) as HTMLTextAreaElement;
  const sendBtn = h('button.btn.primary.small', { type: 'button' }, t(T.send));
  const go = () => {
    const q = ta.value.trim();
    if (!q) return;
    ta.value = '';
    void send(q, o);
  };
  sendBtn.addEventListener('click', go);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      go();
    }
  });
  const showReq = h('input', { type: 'checkbox', checked: state.showRequests }) as HTMLInputElement;
  showReq.addEventListener('change', () => (state.showRequests = showReq.checked));
  panel.append(
    h('div.tutor-compose', {}, ta, h('div.row', {}, sendBtn, h('label.small.tutor-show', {}, showReq, t(T.showReq)))),
    h('p.small.muted.tutor-sees', {}, t(T.context)),
  );
  list.scrollTop = list.scrollHeight;
  ta.focus();
}

async function send(question: string, o: TutorOptions, hintStep?: HintLevel) {
  const list = thread();
  if (!list || !panel) return;
  const w = where();
  const ct = currentTask(w.lesson);
  const taskId = ct?.task.id;
  const used = taskId ? (state.hints.get(taskId) ?? 0) : 0;
  const mode = state.mode;
  const ctx = gather({ mode, hintsUsed: used, screen: o.screen?.(), task: ct });
  if (ctx.task && mode === 'practice') {
    const step = hintStep ?? (used ? (`H${used}` as HintLevel) : 'H1');
    ctx.task.hintStep = step;
    if (step === 'H4' || step === 'H5') {
      const authored = ct?.task.hints?.[step];
      if (authored) ctx.task.authoredHint = t(authored);
    }
  }
  list.append(h('div.tutor-q', {}, h('span.tutor-who', {}, t(T.you)), h('p', {}, question)));
  const live = h('div.tutor-answer.prose.streaming', {}, h('p.muted', {}, '…'));
  list.append(live);
  list.scrollTop = list.scrollHeight;
  store.record({ kind: 'mentor.ask', mode: mode === 'exam' ? 'free' : mode, task: taskId });
  if (hintStep && taskId) {
    state.hints.set(taskId, Number(hintStep.slice(1)));
    store.record({ kind: 'hint.open', task: taskId, hint: hintStep });
  }
  const stopBtn = h('button.btn.ghost.small.tutor-stop', { type: 'button' }, t(T.stop));
  list.append(stopBtn);
  const tr = turn(ai(), ctx, question, {
    history: state.history.slice(-6),
    solutionTokens: ct?.task.solutionTokens,
    onVisible: (text) => {
      clear(live);
      live.append(text ? answerNode(text) : h('p.muted', {}, '…'));
      list.scrollTop = list.scrollHeight;
    },
  });
  state.abort = tr.abort;
  stopBtn.addEventListener('click', () => tr.abort());
  try {
    const r = await tr.done;
    live.classList.remove('streaming');
    clear(live);
    if (r.folded) {
      const reveal = h('button.btn.ghost.small', { type: 'button' }, t(T.folded));
      reveal.addEventListener('click', () => reveal.replaceWith(answerNode(r.text)));
      live.append(reveal);
    } else {
      live.append(answerNode(r.text));
      if (r.rephrased) live.append(h('p.small.muted', {}, t(T.rephrased)));
    }
    if (state.showRequests) live.append(requestView(r.prompt));
    state.history.push({ role: 'user', content: question }, { role: 'assistant', content: r.folded ? '(answer withheld: it named the solution)' : r.text });
    if (hintStep) draw(o);
  } catch (e) {
    live.classList.remove('streaming');
    clear(live);
    const code = e instanceof AiError ? e.code : 'other';
    live.append(h('p.err', {}, t(ERRORS[code]), e instanceof AiError && e.detail && code === 'other' ? ` (${e.detail})` : ''));
  } finally {
    stopBtn.remove();
    state.abort = undefined;
  }
}
