import { registerFeedbackSnapshot } from '../engine/feedback/data';
// The practical exam runner (10 §6, §7; 01 §13.3). A timed scenario in the
// sandbox, auto-graded by state predicates; only the built-in documentation
// of the allowed sources is open (DL5); the mentor is off. The variant comes
// from a seed (pools of alternative tasks). Two modes: "exam" (word of
// honour: documentation only; closes the block) and "training" (any helpers,
// a full review, does not close the block). At the end: two "explain"
// questions (weight 0, the interview-readiness mark), the result, the path
// through the documentation, and a protocol to download.

import { referenceAnswer } from '../engine/quiz/review';
import { ActiveTimer } from '../core/active-timer';
import { readDraft, writeDraft, clearDraft } from '../core/draft';
import { renderInline } from '../core/markdown';
import { clear, put, downloadFile, h, icon } from '../core/dom';
import { bi, count, fmt, lang, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { Exam, ExamTask, Facts, Mounted } from '../core/types';
import { openDoc } from '../engine/docs/viewer';
import { examGate, newSeed, pickTasks, protocol, scoreExam, type ExamProtocol } from '../engine/quiz/exam';
import { mountQuiz } from '../engine/quiz/render';
import { conceptLink, emptyState, levelFor, prose, setTitle, type Page } from './common';
import { mountRealCard, mountRealLab, realHowTo, type RealCardView } from './real/panel';
import { mountLab } from './terminal-section';
import './exam.css';
import { crumbProfession } from './common';

/** Exams of a block: the one named in Block.exam first, then any other exam whose `block` is this block. */
export function examsOfBlock(blockId: string): Exam[] {
  const b = registry.blocks.get(blockId);
  const all = [...registry.exams.values()].filter((e) => e.block === blockId || e.id === b?.exam);
  return all.sort((a, c) => Number(c.id === b?.exam) - Number(a.id === b?.exam) || a.id.localeCompare(c.id));
}

export const HONESTY = bi(
  'Мы не следим за вами и не проверяем, открыта ли у вас другая вкладка. Экзамен проверяет состояние системы, а не текст: сервис либо отвечает, либо нет. Встроенный наставник здесь выключен, открыта только официальная документация — как на настоящей работе и на CKA. Выберите режим честно. «Экзамен» — вы работаете только с документацией; так вы узнаете, где вы на самом деле, и закроете блок. «Тренировка» — с любыми помощниками; вы получите полный разбор, но блок не закроется. Если нейросеть сделает задание за вас, вы получите зелёную галочку и не получите умения, а на собеседовании вас попросят сделать то же самое при всех. Оба режима нормальные: тренировка ничем не наказывается.',
  'We do not watch you and do not check whether another tab is open. The exam checks the state of the system, not text: the service either answers or it does not. The built-in mentor is off here and only the official documentation is open — as at a real job and at the CKA. Choose the mode honestly. “Exam”: you work with the documentation only; this shows where you really are and closes the block. “Training”: any helpers you like; you get a full review, but the block does not close. If an AI does the task for you, you get a green tick and no skill, and at the interview you will be asked to do the same thing in front of people. Both modes are normal: training is never penalised.',
);

const E = {
  exam: bi('Экзамен', 'Exam'),
  training: bi('Тренировка', 'Training'),
  docs: bi('Документация', 'Documentation'),
  allowed: bi('Открыта документация', 'Documentation open'),
  minutes: bi('мин', 'min'),
  soft: bi('Мягкий таймер: время пишется в протокол, но не обрывает экзамен.', 'Soft timer: the time goes into the protocol but never cuts the exam short.'),
  hard: bi('Жёсткий таймер: когда время выйдет, работа сдаётся сама.', 'Hard timer: when time is up the work is submitted automatically.'),
  pass: bi('Зачёт: {p}% и все критические задания.', 'Pass: {p}% and every critical task.'),
  critical: bi('критическое: без него экзамен не сдан', 'critical: the exam fails without it'),
  beyond: bi('вне курса', 'beyond the course'),
  pts: bi('балл.', 'pts'),
  gate: bi('Пересдача новым вариантом откроется {d}. Тренировка открыта всегда.', 'The retake with a new variant opens {d}. Training is always open.'),
  passedBefore: bi('Экзамен уже сдан. Можно пройти его ещё раз новым вариантом.', 'The exam is already passed. You can take it again with a new variant.'),
  submit: bi('Сдать практику', 'Submit the practice'),
  explainH: bi('Два вопроса, как на собеседовании', 'Two questions, as at an interview'),
  explainLede: bi('Ответьте своими словами, затем отметьте, какие пункты вы действительно назвали. В балл экзамена это не входит: это отметка «готовность к собеседованию».', 'Answer in your own words, then tick the points you really covered. This does not count towards the exam score: it is the interview-readiness mark.'),
  points: bi('Ключевые пункты', 'Key points'),
  finish: bi('Завершить', 'Finish'),
  passed: bi('Экзамен сдан', 'Exam passed'),
  failed: bi('Экзамен пока не сдан', 'Exam not passed yet'),
  trainingDone: bi('Тренировка завершена', 'Training finished'),
  threshold: bi('порог', 'threshold'),
  notCritical: bi('не все критические задания', 'not every critical task'),
  ready: bi('Готовность к собеседованию по блоку: отмечена.', 'Interview readiness for the block: marked.'),
  notReady: bi('Готовность к собеседованию: пока нет — назовите больше ключевых пунктов.', 'Interview readiness: not yet — cover more of the key points.'),
  trail: bi('Где вы искали', 'Where you looked'),
  noTrail: bi('Документацию во время экзамена вы не открывали.', 'No documentation was opened during the exam.'),
  gaps: bi('Перед пересдачей повторите', 'Before the retake, review'),
  toReview: bi('Серия повторения на 15 минут', 'A 15-minute review series'),
  protocol: bi('Скачать протокол', 'Download the protocol'),
  print: bi('Печать', 'Print'),
  notCert: bi('Протокол — не сертификат: работодателю нужен репозиторий, который можно открыть, и человек, который его объяснит.', 'The protocol is not a certificate: an employer needs a repository to open and a person who can explain it.'),
  time: bi('Время', 'Time'),
  over: bi('сверх нормы', 'over the norm'),
  task: bi('Задача', 'Task'),
  story: bi('Ситуация', 'The situation'),
  back: bi('К блоку', 'Back to the block'),
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function taskTitle(x: ExamTask): string {
  return t(x.kind === 'quiz' ? x.item.prompt : x.kind === 'task' ? x.task.prompt : x.real.prompt);
}

function taskConcepts(x: ExamTask): string[] {
  return (x.kind === 'quiz' ? x.item.concepts : x.kind === 'task' ? x.task.concepts : x.real.concepts) ?? [];
}

/** The in-tab lab of an exam (Exam.inTab): the widget reports facts of its machines, the real cards judge them. */
function mountTabLab(exam: Exam, onFacts: (m: Record<string, Facts>) => void): { el: HTMLElement; mounted: Mounted } | null {
  const inTab = exam.inTab;
  const w = inTab ? registry.widgets.get(inTab.widget) : undefined;
  if (!inTab || !w) return null;
  const el = h('div.widget-host.ex2-tablab');
  let feedbackFacts: unknown = null;
  const unregisterFeedback = registerFeedbackSnapshot(el, () => ({ facts: feedbackFacts }));
  const mounted = w.mount(el, inTab.props ?? {}, { exam: true, level: 'experienced', complete() {}, record: (e) => store.record(e), openDoc: (r) => openDoc(r, { mode: 'exam', allowed: exam.allowedDocs, via: 'exam' }), reportFacts: facts => { feedbackFacts = facts; onFacts(facts); } });
  return { el, mounted: { ...mounted, dispose() { unregisterFeedback(); mounted.dispose(); } } };
}

export function examPage(id: string): Page {
  const exam = registry.exams.get(id);
  if (!exam) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(exam.title));
  const block = registry.blocks.get(exam.block);
  const root = h('div.exam.ex2');
  const mounts: Mounted[] = [];
  const disposeAll = () => mounts.splice(0).forEach((m) => m.dispose());
  const crumbs = () => h('nav.crumbs', {}, crumbProfession(), block ? [' › ', h('a', { href: href({ name: 'block', id: block.id }) }, t(block.title))] : null);

  const intro = () => {
    disposeAll();
    clear(root);
    const gate = examGate(store.state.exams[exam.id] ?? [], new Date(), exam.retakeHours);
    const sample = pickTasks(exam, 'preview');
    const critical = sample.filter((x) => x.critical).length;
    put(root, 
      crumbs(),
      h('h1', {}, t(exam.title)),
      prose(exam.intro),
      exam.story ? h('aside.ex2-story', {}, h('h2', {}, t(E.story)), prose(exam.story)) : null,
      h(
        'ul.ex2-facts',
        {},
        exam.minutes ? h('li', {}, icon('bolt'), ' ', `${exam.minutes} ${t(E.minutes)}. `, t(exam.hardTimer ? E.hard : E.soft)) : null,
        h('li', {}, icon('check'), ' ', t(fmt(E.pass, { p: Math.round(exam.pass * 100) })), critical ? ` ${count(critical, ['критическое задание', 'критических задания', 'критических заданий'], ['critical task', 'critical tasks'])}.` : ''),
        h('li', {}, icon('doc'), ' ', `${t(E.allowed)}: `, exam.allowedDocs.join(', ')),
      ),
      h('blockquote.ex2-honesty', {}, t(HONESTY)),
      gate.passed ? h('p.small', {}, t(E.passedBefore)) : null,
      !gate.allowed && gate.opensAt ? h('p.small.muted', {}, t(fmt(E.gate, { d: fmtDate(gate.opensAt) }))) : null,
      h(
        'div.row',
        {},
        h('button.btn.primary', { type: 'button', disabled: !gate.allowed, onclick: () => run('exam') }, t(E.exam)),
        h('button.btn.ghost', { type: 'button', onclick: () => run('training') }, t(E.training)),
      ),
    );
  };

  const run = (mode: 'exam' | 'training') => {
    disposeAll();
    clear(root);
    const key = `exam/${exam.id}/${mode}`;
    const draft = readDraft<{ seed: string; started: string; results: [string, number][]; elapsedMs?: number }>(key);
    const seed = draft?.seed ?? newSeed();
    const tasks = pickTasks(exam, seed);
    const started = draft ? new Date(draft.started) : new Date();
    const results = new Map<string, number>(draft?.results ?? tasks.map((x) => [x.id, 0]));
    const canPause = exam.id === 'final.exam.oncall';
    const activeTimer = new ActiveTimer(draft?.elapsedMs ?? (draft ? Date.now() - started.getTime() : 0));
    const save = () => writeDraft(key, { seed, started: started.toISOString(), results: [...results], ...(canPause ? { elapsedMs: activeTimer.elapsed() } : {}) });
    const setResult = (id: string, score: number) => { results.set(id, score); save(); };
    save();
    let submitted = false;
    const timer = h('span.exam-timer', { 'aria-live': 'off' });
    const tick = () => {
      const elapsed = (canPause ? activeTimer.elapsed() : Date.now() - started.getTime()) / 60000;
      if (canPause) save();
      if (!exam.minutes) {
        timer.textContent = `${Math.floor(elapsed)} ${t(E.minutes)}`;
        return;
      }
      if (exam.hardTimer) {
        const left = Math.max(0, exam.minutes - elapsed);
        timer.textContent = `${Math.floor(left)}:${String(Math.floor((left % 1) * 60)).padStart(2, '0')}`;
        timer.classList.toggle('over', left <= 10);
        if (left <= 0 && !submitted) submit();
      } else {
        timer.textContent = `${Math.floor(elapsed)} / ${exam.minutes} ${t(E.minutes)}`;
        // The timer keeps its colour until the last ten minutes (10 §6.6).
        timer.classList.toggle('over', exam.minutes - elapsed <= 10);
      }
    };
    const iv = window.setInterval(tick, 1000);
    mounts.push({ dispose: () => clearInterval(iv) });
    const docsBtn = h('button.btn.ghost.small', { type: 'button', onclick: () => openDoc({}, { mode: 'exam', allowed: exam.allowedDocs, via: 'exam' }) }, icon('doc'), t(E.docs));
    const list = h('ol.exam-tasks.ex2-tasks');
    const realCards: RealCardView[] = [];
    // With an in-tab lab the machines report their facts themselves: no paste panel.
    const lab = exam.real && !exam.inTab ? mountRealLab({ ...exam, real: exam.real }, seed, (m) => realCards.forEach((c) => c.update(m))) : null;
    if (lab) mounts.push(lab);
    const tabLab = mountTabLab(exam, (m) => realCards.forEach((c) => c.update(m)));
    if (tabLab) mounts.push(tabLab.mounted);
    tasks.forEach((task, i) => {
      const host = h('div');
      const tags = [count(task.weight, ['балл', 'балла', 'баллов'], ['point', 'points']), task.critical ? t(E.critical) : '', task.beyond ? t(E.beyond) : ''].filter(Boolean).join(' · ');
      list.append(h('li.ex2-card', { 'data-feedback-id': task.id, 'data-critical': task.critical ? 'true' : undefined }, h('p.ex2-card-head', {}, h('span', {}, `${t(E.task)} ${i + 1}`), h('span.muted', {}, tags)), host));
      if (task.kind === 'quiz') mounts.push(mountQuiz(host, task.item, { context: 'exam', feedback: mode === 'training', md: (b) => prose(b), onAnswered: (g) => setResult(task.id, g.correct ? 1 : g.score) }));
      else if (task.kind === 'real') {
        const card = mountRealCard(task.real, { feedback: mode === 'training', onScore: (sc) => setResult(task.id, sc), where: exam.inTab ? 'tab' : 'own', machines: () => lab?.el ?? tabLab?.el ?? null });
        realCards.push(card);
        put(host, prose(task.real.prompt), card.el);
      } else
        mounts.push(
          mountLab(host, {
            key: `exam/${exam.id}/${seed}/${task.id}`,
            setup: task.setup,
            tasks: [task.task],
            level: levelFor(exam.block),
            block: exam.block,
            index: 0,
            count: 1,
            exam: mode === 'exam',
            onTaskPass: () => setResult(task.id, 1),
          }),
        );
    });
    const submitBtn = h('button.btn.primary', { type: 'button', onclick: () => submit() }, t(E.submit));
    const submit = () => {
      if (submitted) return;
      submitted = true;
      disposeAll();
      explainStep(mode, seed, tasks, results, started);
    };
    const pauseBtn = canPause ? h('button.btn', { type: 'button', onclick: () => {
      activeTimer.toggle();
      save();
      for (const child of [...root.children]) if (!child.classList.contains('exam-head') && !child.classList.contains('exam-pause-note')) (child as HTMLElement).inert = activeTimer.paused;
      pauseBtn!.textContent = t(activeTimer.paused ? bi('Продолжить попытку', 'Resume attempt') : bi('Приостановить попытку', 'Pause attempt'));
    } }, t(bi('Приостановить попытку', 'Pause attempt'))) : null;
    put(root, h('header.exam-head', {}, h('h1', {}, t(exam.title)), h('span.badge', {}, t(mode === 'exam' ? E.exam : E.training)), timer, docsBtn, pauseBtn), canPause ? h('p.exam-pause-note', {}, t(bi('На выполнение отведено 60 минут активной работы: попытку можно приостановить и продолжить позже, а задания во время паузы недоступны.', 'You have 60 minutes of active work: pause and resume later; tasks are unavailable while paused.'))) : null, draft ? h('p.exam-resumed', { role: 'status' }, t(bi('Вы продолжаете сохранённую попытку: выполненные задания восстановлены.', 'You are continuing a saved attempt: completed tasks have been restored.'))) : null, exam.story ? h('details.ex2-story-mini', {}, h('summary', {}, t(E.story)), prose(exam.story)) : null, lab?.el ?? null, tabLab?.el ?? null, tasks.some((x) => x.kind === 'real') ? realHowTo(exam.inTab ? 'tab' : 'own') : null, list, submitBtn);
  };

  const explainStep = (mode: 'exam' | 'training', seed: string, tasks: ExamTask[], results: Map<string, number>, started: Date) => {
    const finished = new Date();
    const qs = exam.explain ?? [];
    if (!qs.length) return result(mode, seed, tasks, results, started, finished, []);
    clear(root);
    const covered = new Map<string, Set<number>>(qs.map((q) => [q.id, new Set()]));
    put(root, 
      h('h1', {}, t(E.explainH)),
      h('p.lede', {}, t(E.explainLede)),
      ...qs.map((q) =>
        h(
          'section.ex2-explain',
          {},
          prose(q.prompt),
          h('textarea.ex2-answer', { rows: 5, 'aria-label': t(q.prompt) }),
          h('button.btn.ghost', { type: 'button', onclick: (e: Event) => { const button = e.currentTarget as HTMLElement; (button.nextElementSibling as HTMLElement).hidden = false; button.remove(); } }, t(bi('Сравнить с эталоном', 'Compare with the reference'))),
          h(
            'fieldset.ex2-points',
            { hidden: true },
            h('legend', {}, t(E.points)),
            ...q.keyPoints.map((kp, i) => {
              const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
              box.addEventListener('change', () => (box.checked ? covered.get(q.id)!.add(i) : covered.get(q.id)!.delete(i)));
              return h('label.ex2-point', {}, box, h('span', {}, t(kp)));
            }),
          ),
        ),
      ),
      h('button.btn.primary', { type: 'button', onclick: () => result(mode, seed, tasks, results, started, finished, qs.map((q) => ({ id: q.id, covered: covered.get(q.id)!.size, of: q.keyPoints.length }))) }, t(E.finish)),
    );
  };

  const result = (mode: 'exam' | 'training', seed: string, tasks: ExamTask[], results: Map<string, number>, started: Date, finished: Date, explain: ExamProtocol['explain']) => {
    clearDraft(`exam/${exam.id}/${mode}`);
    const s = scoreExam(exam, tasks, results);
    store.record({ kind: 'exam.result', exam: exam.id, mode, score: s.score, passed: mode === 'exam' && s.passed });
    const minutes = Math.max(1, Math.round((finished.getTime() - started.getTime()) / 60000));
    const docOpens = store.state.docTrail.filter((d) => d.at >= started.toISOString() && d.at <= finished.toISOString());
    const proto = protocol({
      exam: exam.id,
      title: t(exam.title),
      seed,
      mode,
      started: started.toISOString(),
      finished: finished.toISOString(),
      minutes,
      overTime: !!exam.minutes && minutes > exam.minutes,
      score: s.score,
      passed: mode === 'exam' && s.passed,
      checks: tasks.map((x) => ({ id: x.id, title: taskTitle(x), weight: x.weight, critical: !!x.critical, beyond: !!x.beyond, result: results.get(x.id) ?? 0 })),
      docOpens,
      explain,
      env: exam.inTab ? 'tab' : exam.real ? 'vm' : 'sim',
    });
    const gaps = [...new Set(tasks.filter((x) => (results.get(x.id) ?? 0) < 1).flatMap(taskConcepts))];
    clear(root);
    put(root, 
      crumbs(),
      h('h1', {}, t(mode === 'training' ? E.trainingDone : s.passed ? E.passed : E.failed)),
      h(
        'p.lede.ex2-score',
        {},
        `${Math.round(s.score * 100)}% · ${t(E.threshold)} ${Math.round(exam.pass * 100)}%`,
        s.criticalOk ? '' : ` · ${t(E.notCritical)}`,
        ` · ${t(E.time)} ${minutes} ${t(E.minutes)}`,
        proto.overTime ? ` (${t(E.over)})` : '',
      ),
      h(
        'ul.placement-results.ex2-results',
        {},
        ...tasks.map((x) => {
          const ok = (results.get(x.id) ?? 0) >= 1;
          return h('li', { class: ok ? 'ok' : x.critical ? 'err' : 'skip' }, h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : x.critical ? '⨯' : '·'), h('div', {}, ...renderInline(taskTitle(x)), x.kind === 'quiz' ? referenceAnswer(x.item) : null), h('span.muted.small', {}, ` — ${count(x.weight, ['балл', 'балла', 'баллов'], ['point', 'points'])}${x.critical ? ', ' + t(E.critical) : ''}${x.beyond ? ', ' + t(E.beyond) : ''}`));
        }),
      ),
      explain.length ? h('p', {}, t(proto.readinessMark ? E.ready : E.notReady)) : null,
      h(
        'section.ex2-trail',
        {},
        h('h2', {}, t(E.trail)),
        docOpens.length ? h('ol.small', {}, ...docOpens.map((d) => h('li', {}, h('code', {}, d.page), d.anchor ? ` › ${d.anchor}` : '', h('span.muted', {}, ` · ${new Date(d.at).toLocaleTimeString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`)))) : h('p.small.muted', {}, t(E.noTrail)),
      ),
      gaps.length
        ? h('section.ex2-gaps', {}, h('h2', {}, t(E.gaps)), h('p', {}, ...gaps.flatMap((c, i) => [i ? ', ' : '', registry.concepts.has(c) ? conceptLink(c) : c])), h('a.btn.ghost', { href: href({ name: 'review' }) }, icon('repeat'), t(E.toReview)))
        : null,
      h(
        'div.row.ex2-proto',
        {},
        h('button.btn', { type: 'button', onclick: () => downloadFile(`protocol-${exam.id}-${proto.finished.slice(0, 10)}.json`, JSON.stringify(proto, null, 2)) }, icon('download'), t(E.protocol)),
        h('button.btn.ghost', { type: 'button', onclick: () => window.print() }, t(E.print)),
        block ? h('a.btn.ghost', { href: href({ name: 'block', id: block.id }) }, t(E.back)) : null,
      ),
      h('p.small.muted', {}, t(E.notCert)),
    );
  };

  intro();
  return { el: root, dispose: disposeAll };
}
