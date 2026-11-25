// Quiz widgets (08 §3.10). Confidence comes first (01 §14.1), then the
// answer; the feedback explains the chosen distractor, not just "wrong".
// Quizzes teach rather than measure: retry is free, the first attempt is
// what goes into progress.

import { answeredQuiz, externalButton } from '../ai/external-panel';
import { clear, h, icon } from '../../core/dom';
import { bi, t, UI, type Bi } from '../../core/i18n';
import { renderInline, renderMd } from '../../core/markdown';
import { store } from '../../core/store';
import type { Confidence, Mounted, QText, QuizGrade, QuizItem } from '../../core/types';
import { fullLine, gradeBugfind, gradeFill, gradeLabel, gradeMatch, gradeMcq, gradeMulti, gradeOrder, gradePredict } from './grade';

export interface QuizCtx {
  context: 'lesson' | 'review' | 'placement' | 'exam';
  /** Show feedback after the answer (off in exams and placement). */
  feedback?: boolean;
  /** Render Bi prose (the lesson passes one with glossary links). */
  md?: (b: Bi) => Node;
  onAnswered?(g: QuizGrade, first: boolean): void;
}

const Q = {
  order: bi('Расставьте по порядку: кнопками ↑ ↓ или клавишами', 'Put in order: with the ↑ ↓ buttons or the keys'),
  match: bi('Сопоставьте', 'Match'),
  pick: bi('— выберите —', '— choose —'),
  output: bi('Вывод на самом деле', 'The actual output'),
  yourAnswer: bi('Ваш ответ', 'Your answer'),
  bugline: bi('Нажмите на строку с ошибкой', 'Click the line with the bug'),
  saved: bi('Ответ записан', 'Answer saved'),
  up: bi('Выше', 'Up'),
  down: bi('Ниже', 'Down'),
  typeOutput: bi('Что напечатает команда? Впишите вывод', 'What will the command print? Type the output'),
  slot: bi('Место', 'Slot'),
};

const qtext = (q: QText, cls = ''): HTMLElement => (typeof q === 'string' ? h(`code.qcode${cls}`, {}, q) : h(`span${cls}`, {}, ...renderInline(t(q))));

/** Deterministic shuffle by a string seed, never returning the original order for n ≥ 2. */
export function shuffle<T>(arr: T[], seed: string): T[] {
  let x = 0;
  for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length >= 2 && out.every((v, i) => v === arr[i])) [out[0], out[1]] = [out[1], out[0]];
  return out;
}

export function mountQuiz(root: HTMLElement, item: QuizItem, ctx: QuizCtx): Mounted {
  const md = ctx.md ?? ((b: Bi) => renderMd(t(b)));
  const showFeedback = ctx.feedback ?? (ctx.context === 'lesson' || ctx.context === 'review');
  // Confidence marks were removed from the interface; answers are recorded as "I think so".
  const confidence: Confidence = 2;
  let attempts = store.state.quiz[item.id]?.attempts ?? 0;
  const feedback = h('div.q-feedback', { 'aria-live': 'polite' });
  const checkBtn = h('button.btn.primary', { type: 'button', disabled: true }, t(UI.check)) as HTMLButtonElement;
  let answer: () => unknown = () => null;
  let hasAnswer: () => boolean = () => false;
  const body = h('div.q-body');
  const update = () => {
    checkBtn.disabled = !hasAnswer();
  };

  switch (item.kind) {
    case 'mcq':
    case 'multi': {
      const multi = item.kind === 'multi';
      const name = `q-${item.id}-${Math.random().toString(36).slice(2, 6)}`;
      const picked = new Set<string>();
      const list = h('div.q-options', { role: multi ? 'group' : 'radiogroup' });
      for (const o of shuffle(item.options, item.id)) {
        const input = h('input', { type: multi ? 'checkbox' : 'radio', name, value: o.id }) as HTMLInputElement;
        input.addEventListener('change', () => {
          if (!multi) picked.clear();
          if (input.checked) picked.add(o.id);
          else picked.delete(o.id);
          update();
        });
        list.append(h('label.q-option', { 'data-id': o.id }, input, qtext(o.text)));
      }
      body.append(h('p.q-answer-type', {}, t(multi ? bi('Выберите все верные ответы.', 'Select all correct answers.') : bi('Выберите один ответ.', 'Select one answer.'))), list);
      answer = () => (multi ? [...picked] : [...picked][0]);
      hasAnswer = () => picked.size > 0;
      break;
    }
    case 'order': {
      let order = shuffle(item.steps.map((s) => s.id), item.id);
      const list = h('ol.q-order', { 'aria-label': t(Q.order) });
      const draw = (focusId?: string) => {
        clear(list);
        order.forEach((id, i) => {
          const st = item.steps.find((s) => s.id === id)!;
          const move = (d: number) => {
            const j = i + d;
            if (j < 0 || j >= order.length) return;
            const next = [...order];
            [next[i], next[j]] = [next[j], next[i]];
            order = next;
            draw(id);
          };
          const li = h(
            'li.q-order-item',
            {
              tabindex: 0,
              'data-id': id,
              onkeydown: (e: KeyboardEvent) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(-1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(1);
                }
              },
            },
            h('span.q-order-n', {}, String(i + 1)),
            qtext(st.text),
            h('span.q-order-btns', {}, h('button.icon-btn', { type: 'button', 'aria-label': t(Q.up), disabled: i === 0, onclick: () => move(-1) }, icon('prev', 'ic rot90')), h('button.icon-btn', { type: 'button', 'aria-label': t(Q.down), disabled: i === order.length - 1, onclick: () => move(1) }, icon('next', 'ic rot90'))),
          );
          list.append(li);
          if (id === focusId) requestAnimationFrame(() => li.focus());
        });
      };
      draw();
      body.append(h('p.q-hint', {}, t(Q.order)), list);
      answer = () => order;
      hasAnswer = () => true;
      break;
    }
    case 'match': {
      const chosen: Record<string, string> = {};
      const rights = shuffle(item.pairs, item.id);
      const table = h('div.q-match');
      for (const p of item.pairs) {
        const sel = h('select', { 'aria-label': typeof p.left === 'string' ? p.left : t(p.left) }, h('option', { value: '' }, t(Q.pick)), ...rights.map((r) => h('option', { value: r.id }, typeof r.right === 'string' ? r.right : t(r.right)))) as HTMLSelectElement;
        const selectedText = h('p.q-selected', { 'aria-live': 'polite' });
        sel.addEventListener('change', () => {
          selectedText.textContent = sel.value ? sel.selectedOptions[0].textContent : '';
          if (sel.value) chosen[p.id] = sel.value;
          else delete chosen[p.id];
          update();
        });
        table.append(h('div.q-match-row', {}, qtext(p.left, '.q-left'), h('span.q-arrow', { 'aria-hidden': 'true' }, '→'), h('div', {}, sel, selectedText)));
      }
      body.append(table);
      answer = () => ({ ...chosen });
      hasAnswer = () => Object.keys(chosen).length === item.pairs.length;
      break;
    }
    case 'fill-command': {
      const input = h('input.q-fill', { type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': t(bi('Команда', 'Command')) }) as HTMLInputElement;
      input.addEventListener('input', update);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !checkBtn.disabled) checkBtn.click();
      });
      const line = h('div.q-cmdline', {}, h('span.prompt', {}, '$ '));
      if (item.template) {
        const [a, b] = item.template.split(/_{3,}/);
        line.append(h('span', {}, a), input, h('span', {}, b ?? ''));
      } else line.append(input);
      body.append(line);
      answer = () => input.value;
      hasAnswer = () => input.value.trim().length > 0;
      break;
    }
    case 'predict-output': {
      body.append(h('pre.q-term', {}, h('span.prompt', {}, '$ '), item.command));
      if (item.options) {
        const name = `q-${item.id}-${Math.random().toString(36).slice(2, 6)}`;
        let picked = '';
        const list = h('div.q-options', { role: 'radiogroup' });
        for (const o of shuffle(item.options, item.id)) {
          const input = h('input', { type: 'radio', name, value: o.id }) as HTMLInputElement;
          input.addEventListener('change', () => {
            picked = o.id;
            update();
          });
          list.append(h('label.q-option', { 'data-id': o.id }, input, qtext(o.text)));
        }
        body.append(list);
        answer = () => picked;
        hasAnswer = () => !!picked;
      } else {
        const ta = h('textarea.q-predict', { rows: 3, spellcheck: 'false', placeholder: t(Q.typeOutput), 'aria-label': t(Q.typeOutput) }) as HTMLTextAreaElement;
        ta.addEventListener('input', update);
        body.append(ta);
        answer = () => ta.value;
        hasAnswer = () => ta.value.trim().length > 0;
      }
      break;
    }
    case 'bugfind': {
      let line = 0;
      const code = h('ol.q-code', { 'aria-label': t(Q.bugline) });
      item.code.split('\n').forEach((text, i) => {
        const b = h('button.q-codeline', { type: 'button', 'aria-pressed': 'false' }, h('span.ln', {}, String(i + 1)), h('code', {}, text || ' '));
        b.addEventListener('click', () => {
          line = i + 1;
          for (const x of code.querySelectorAll('.q-codeline')) x.setAttribute('aria-pressed', 'false');
          b.setAttribute('aria-pressed', 'true');
          update();
        });
        code.append(h('li', {}, b));
      });
      body.append(h('p.q-hint', {}, t(Q.bugline)), code);
      answer = () => line;
      hasAnswer = () => line > 0;
      break;
    }
    case 'label': {
      const placed: Record<string, string> = {};
      const { diagram } = item;
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('viewBox', `0 0 ${diagram.width} ${diagram.height}`);
      svg.setAttribute('class', 'q-label-svg');
      const center = (id: string) => {
        const sl = diagram.slots.find((x) => x.id === id)!;
        return [sl.x + sl.w / 2, sl.y + sl.h / 2];
      };
      for (const e of diagram.edges ?? []) {
        const [x1, y1] = center(e.from);
        const [x2, y2] = center(e.to);
        const ln = document.createElementNS(svgNs, 'line');
        for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) ln.setAttribute(k, String(v));
        ln.setAttribute('class', 'q-label-edge');
        svg.append(ln);
      }
      diagram.slots.forEach((sl, i) => {
        const g = document.createElementNS(svgNs, 'g');
        g.setAttribute('class', `q-slot fam-${sl.family ?? 'neutral'}`);
        const r = document.createElementNS(svgNs, 'rect');
        for (const [k, v] of Object.entries({ x: sl.x, y: sl.y, width: sl.w, height: sl.h, rx: 6 })) r.setAttribute(k, String(v));
        const tx = document.createElementNS(svgNs, 'text');
        tx.setAttribute('x', String(sl.x + sl.w / 2));
        tx.setAttribute('y', String(sl.y + sl.h / 2 + 5));
        tx.setAttribute('text-anchor', 'middle');
        tx.textContent = String(i + 1);
        g.append(r, tx);
        svg.append(g);
      });
      const selects = h('div.q-label-selects');
      diagram.slots.forEach((sl, i) => {
        const sel = h('select', { 'aria-label': `${t(Q.slot)} ${i + 1}` }, h('option', { value: '' }, t(Q.pick)), ...shuffle(item.labels, item.id).map((l) => h('option', { value: l.id }, typeof l.text === 'string' ? l.text : t(l.text)))) as HTMLSelectElement;
        sel.addEventListener('change', () => {
          if (sel.value) placed[sl.id] = sel.value;
          else delete placed[sl.id];
          const txt = svg.querySelectorAll('.q-slot text')[i];
          const lab = item.labels.find((l) => l.id === sel.value);
          if (txt) txt.textContent = lab ? (typeof lab.text === 'string' ? lab.text : t(lab.text)) : String(i + 1);
          update();
        });
        selects.append(h('label.q-label-row', {}, h('span.q-order-n', {}, String(i + 1)), sel));
      });
      body.append(h('div.q-label', {}, svg as unknown as HTMLElement, selects));
      answer = () => ({ ...placed });
      hasAnswer = () => Object.keys(placed).length === diagram.slots.length;
      break;
    }
  }

  update();

  const show = (g: QuizGrade, extra?: Node) => {
    clear(feedback);
    if (!showFeedback) {
      feedback.append(h('p.q-result.neutral', {}, icon('check'), t(Q.saved)));
      return;
    }
    feedback.append(
      h('p.q-result', { class: g.correct ? 'ok' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, g.correct ? '✓' : '⨯'), t(g.correct ? UI.correct : UI.wrong), !g.correct && g.score > 0 ? h('span.muted', {}, t(bi(' · Часть ответа верна.', ' · Part of the answer is correct.'))) : null),
      ...g.feedback.map((b) => h('div.q-why', {}, md(b))),
    );
    if (extra) feedback.append(extra);
    if (!g.correct || item.kind === 'predict-output') {
      const again = h('button.btn.ghost', { type: 'button' }, icon('repeat'), t(UI.retry));
      again.addEventListener('click', () => {
        mountQuiz(root, item, ctx);
      });
      feedback.append(again);
    }
  };

  checkBtn.addEventListener('click', async () => {
    if (!confidence || !hasAnswer()) return;
    checkBtn.disabled = true;
    let g: QuizGrade;
    let extra: Node | undefined;
    let actual: string | undefined;
    const a = answer();
    switch (item.kind) {
      case 'mcq':
        g = gradeMcq(item, a as string);
        break;
      case 'multi':
        g = gradeMulti(item, a as string[]);
        break;
      case 'order':
        g = gradeOrder(item, a as string[]);
        break;
      case 'match':
        g = gradeMatch(item, a as Record<string, string>);
        break;
      case 'fill-command':
        g = await gradeFill(item, a as string);
        if (showFeedback) extra = h('pre.q-term', {}, h('span.prompt', {}, '$ '), fullLine(item, a as string));
        break;
      case 'predict-output': {
        const r = await gradePredict(item, a as string);
        g = r;
        actual = r.actual;
        if (showFeedback) extra = h('figure.q-actual', {}, h('figcaption', {}, t(Q.output)), h('pre.q-term', {}, h('span.prompt', {}, '$ '), item.command, '\n', r.actual));
        break;
      }
      case 'bugfind':
        g = gradeBugfind(item, a as number);
        break;
      case 'label':
        g = gradeLabel(item, a as Record<string, string>);
        break;
    }
    const first = attempts === 0;
    attempts++;
    store.record({ kind: 'quiz.answer', item: item.id, correct: g.correct, score: g.score, confidence, first, concepts: item.concepts ?? [], context: ctx.context });
    if (showFeedback) {
      for (const lab of root.querySelectorAll<HTMLElement>('.q-option')) {
        const o = 'options' in item ? item.options?.find((x) => x.id === lab.dataset.id) : undefined;
        lab.classList.toggle('is-right', !!o?.correct && g.correct);
      }
      if (item.kind === 'match') {
        root.querySelectorAll<HTMLElement>('.q-match-row').forEach((row, i) => {
          const pair = item.pairs[i];
          row.classList.add((a as Record<string, string>)[pair.id] === pair.id ? 'is-right' : 'is-wrong');
          row.append(h('span.q-correction', {}, qtext(pair.right)));
        });
      }
      root.querySelectorAll<HTMLInputElement>('.q-body input, .q-body select, .q-body textarea, .q-body button').forEach((x) => (x.disabled = true));
    }
    show(g, extra);
    if (showFeedback && ctx.context !== 'exam' && ctx.context !== 'placement') feedback.append(externalButton(answeredQuiz(item, a, g, actual)));
    ctx.onAnswered?.(g, first);
  });

  const prompt = h('div.q-prompt', {}, md(item.prompt));
  clear(root);
  root.append(h('div.quiz-item', { 'data-kind': item.kind, 'data-id': item.id }, prompt, body, h('div.q-actions', {}, checkBtn), feedback));
  return {
    dispose: () => clear(root),
    describe: () => `${t(item.prompt)} (${item.kind})`,
  };
}
