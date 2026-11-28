// The key trainer on the page (lazy chunk: CodeMirror and the Vim layer load
// only when a trainer mounts). One trainer shows a set of drills of one
// engine, one at a time; it is always labelled as a key trainer, never as
// Vim or Emacs, and says that the real editor is in the lesson's terminal.
//
// Phones: the on-screen keyboard has no Esc, Ctrl or Meta, so a key bar sits
// under the editor. Ctrl and Meta are sticky: tap, then type a letter. Vim
// drills have no arrows on the bar on purpose.

import './editor-drill.css';
import { EditorView } from '@codemirror/view';
import { EditorState, Prec, type Extension } from '@codemirror/state';
import { getCM, Vim } from '@replit/codemirror-vim';
import { clear, h, put } from '../../core/dom';
import { bi, t, type Bi } from '../../core/i18n';
import type { Mounted, WidgetCtx } from '../../core/types';
import { budgetNote, checkDrill } from './check';
import { DRILLS, EMACS_DRILLS, VIM_DRILLS, drillById } from './drills';
import { chordFromEvent } from './emacs';
import { parseKeys } from './keys';
import { createSession, type Session } from './session';
import type { Drill, DrillEngine, DrillStart } from './types';

export interface DrillProps {
  /** One drill by id. */
  drill?: string;
  /** Several drills by id, of one engine. */
  drills?: string[];
  /** All sample drills of an engine (the dev page). */
  set?: 'vim' | 'emacs';
  intro?: Bi;
}

const L = {
  label: { 'cm-vim': bi('Тренажёр клавиш, не настоящий Vim', 'Key trainer, not real Vim'), 'cm-emacs': bi('Тренажёр клавиш, не настоящий Emacs', 'Key trainer, not real Emacs') } as Record<DrillEngine, Bi>,
  real: {
    'cm-vim': bi('Здесь только упражнения на клавиши. Настоящий Vim — в терминале урока: там работает всё, чего тут нет.', 'Only key drills here. The real Vim is in the lesson’s terminal: everything missing here works there.'),
    'cm-emacs': bi('Здесь только упражнения на сочетания. Настоящий Emacs — в терминале урока: там работает всё, чего тут нет.', 'Only key drills here. The real Emacs is in the lesson’s terminal: everything missing here works there.'),
  } as Record<DrillEngine, Bi>,
  how: bi('Проверяется результат — текст, курсор, регистры, — а не то, какими клавишами вы к нему пришли.', 'The result is checked — text, cursor, registers — not the keys that got you there.'),
  steal: bi('Если браузер забирает сочетание (Ctrl-W закрывает вкладку), нажмите Ctrl на панели, а потом букву.', 'If the browser takes a shortcut (Ctrl-W closes the tab), tap Ctrl on the bar, then the letter.'),
  goal: bi('Цель', 'Goal'),
  goalCursor: bi('подсвечено место, где должен оказаться курсор', 'the highlight marks where the cursor must end up'),
  reset: bi('Сначала', 'Start over'),
  check: bi('Что не так?', 'What is off?'),
  prev: bi('Назад', 'Back'),
  next: bi('Дальше', 'Next'),
  of: (i: number, n: number) => bi(`Упражнение ${i} из ${n}`, `Drill ${i} of ${n}`),
  done: bi('Готово: результат совпал с целью.', 'Done: the result matches the goal.'),
  notYet: bi('Пока не совпадает с целью.', 'Not the goal yet.'),
  noDrill: bi('Упражнение не найдено', 'Drill not found'),
  bar: bi('Клавиши, которых нет на экранной клавиатуре', 'Keys the on-screen keyboard lacks'),
  sticky: bi('залипает до следующей клавиши', 'sticks until the next key'),
  engineTag: bi('движок', 'engine'),
};

function pickDrills(p: DrillProps): Drill[] {
  if (p.drill) return [drillById(p.drill)].filter((d): d is Drill => !!d);
  if (p.drills) return p.drills.map(drillById).filter((d): d is Drill => !!d);
  if (p.set === 'vim') return VIM_DRILLS;
  if (p.set === 'emacs') return EMACS_DRILLS;
  return [];
}

/** The goal text with the target cursor marked. */
function goalView(d: Drill): HTMLElement {
  const pre = h('pre.ed-goal', { 'aria-label': t(L.goal) });
  const lines = d.target.text.split('\n');
  lines.forEach((line, i) => {
    const c = d.target.cursor;
    if (c && c.line === i) {
      const ch = Math.min(c.ch, line.length);
      pre.append(line.slice(0, ch), h('span.ed-cur', {}, line.slice(ch, ch + 1) || ' '), line.slice(ch + 1));
    } else pre.append(line);
    if (i < lines.length - 1) pre.append('\n');
  });
  return pre;
}

export function mountEditorDrill(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = (props ?? {}) as DrillProps;
  const drills = pickDrills(p);
  clear(root);
  if (!drills.length) {
    root.append(h('p.err', {}, `${t(L.noDrill)}: ${p.drill ?? p.drills?.join(', ') ?? p.set ?? ''}`));
    return { dispose() {} };
  }
  const engine = drills[0].engine;
  const passed = new Set<string>();
  let index = 0;
  let keys = 0;
  let usedArrows = false;
  const armed = { ctrl: false, meta: false };

  const counter = h('p.ed-count.muted.small', { 'aria-live': 'polite' });
  const title = h('h3.ed-title');
  const task = h('p.ed-task');
  const goalBox = h('div.ed-goalbox');
  const host = h('div.ed-host');
  const status = h('p.ed-status', { 'aria-live': 'polite' });
  const verdict = h('div.ed-verdict', { 'aria-live': 'polite' });
  const ctrlBtn = h('button.btn.small.ed-key', { type: 'button', 'aria-pressed': 'false', title: t(L.sticky) }, 'Ctrl') as HTMLButtonElement;
  const metaBtn = h('button.btn.small.ed-key', { type: 'button', 'aria-pressed': 'false', title: t(L.sticky) }, 'Meta') as HTMLButtonElement;
  const escBtn = h('button.btn.small.ed-key', { type: 'button' }, 'Esc') as HTMLButtonElement;

  let session: Session;

  const setArmed = (k: 'ctrl' | 'meta', on: boolean) => {
    armed[k] = on;
    (k === 'ctrl' ? ctrlBtn : metaBtn).setAttribute('aria-pressed', String(on));
  };

  /** Run one key in the engine's notation, as if it came from the keyboard. */
  const press = (key: string) => {
    keys++;
    if (/^<(Left|Right|Up|Down|left|right|up|down)>$/.test(key)) usedArrows = true;
    if (engine === 'cm-vim') {
      const cm = getCM(session.view);
      if (cm) Vim.handleKey(cm, key, 'user');
    } else session.press(key);
    after();
  };

  /** A letter typed while Ctrl or Meta is armed on the bar becomes the chord. */
  const chordFromArmed = (ch: string): string => {
    if (engine === 'cm-vim') return armed.ctrl ? `<C-${ch}>` : ch;
    return `${armed.ctrl ? 'C-' : ''}${armed.meta ? 'M-' : ''}${ch === ' ' ? 'SPC' : ch}`;
  };
  const anyArmed = () => armed.ctrl || armed.meta;
  const disarm = () => {
    setArmed('ctrl', false);
    setArmed('meta', false);
  };

  const hooks: Extension = Prec.highest([
    EditorView.domEventHandlers({
      keydown(e, view) {
        if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'].includes(e.key)) return false;
        if (anyArmed() && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          const k = chordFromArmed(e.key);
          disarm();
          press(k);
          return true;
        }
        if (engine === 'cm-emacs') {
          const chord = chordFromEvent(e);
          if (!chord) return false;
          e.preventDefault();
          press(chord);
          return true;
        }
        // Vim: the Vim layer handles the event itself; count it and watch the arrows.
        keys++;
        if (e.key.startsWith('Arrow')) usedArrows = true;
        queueMicrotask(after);
        void view;
        return false;
      },
    }),
    // Phones send text without a usable keydown: armed chords and Emacs typing come through here.
    EditorView.inputHandler.of((_view, _from, _to, text) => {
      if (anyArmed() && [...text].length === 1) {
        const k = chordFromArmed(text);
        disarm();
        press(k);
        return true;
      }
      if (engine === 'cm-emacs') {
        for (const ch of text) press(ch === ' ' ? 'SPC' : ch === '\n' ? 'RET' : ch);
        return true;
      }
      return false;
    }),
    // A tap or click that only focuses the editor must not move the cursor
    // off the drill's start: until the first key, pointer selections are undone.
    EditorState.transactionFilter.of((tr) => (keys === 0 && !tr.docChanged && tr.selection && (tr.isUserEvent('select.pointer') || tr.isUserEvent('select')) ? { selection: tr.startState.selection } : tr)),
    EditorView.updateListener.of((u) => {
      if (u.docChanged || u.selectionSet) queueMicrotask(after);
    }),
    EditorView.contentAttributes.of({ 'aria-label': t(L.label[engine]), autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
  ]);

  session = createSession(engine, drills[0].start, { parent: host, extensions: [hooks], vimStatus: true });

  let lastState = '';
  function after() {
    const d = drills[index];
    const st = session.state();
    if (engine === 'cm-emacs') {
      const em = session.emacs!;
      const pending = em.pending();
      status.textContent = [pending && `${pending} -`, em.message].filter(Boolean).join('  ');
    }
    const key = JSON.stringify(st) + usedArrows;
    if (key === lastState) return;
    lastState = key;
    const v = checkDrill(d, st, { usedArrows });
    clear(verdict);
    if (v.ok) {
      verdict.className = 'ed-verdict ok';
      put(verdict, h('p', {}, t(L.done)), h('p.small', {}, t(budgetNote(keys, parseKeys(engine, d.solution).length))), d.explain ? h('p.small.muted', {}, t(d.explain)) : null);
      if (!passed.has(d.id)) {
        passed.add(d.id);
        ctx.record({ kind: 'x.editor.drill', drill: d.id, engine, keys, best: parseKeys(engine, d.solution).length });
        if (passed.size === drills.length) ctx.complete();
      }
    } else verdict.className = 'ed-verdict';
  }

  const explainMismatch = () => {
    const d = drills[index];
    const v = checkDrill(d, session.state(), { usedArrows });
    clear(verdict);
    verdict.className = v.ok ? 'ed-verdict ok' : 'ed-verdict off';
    if (v.ok) verdict.append(h('p', {}, t(L.done)));
    else verdict.append(h('p', {}, t(L.notYet)), h('ul.small', {}, v.mismatches.map((m) => h('li', {}, t(m.message)))));
    session.view.focus();
  };

  const show = (i: number) => {
    index = i;
    const d = drills[i];
    keys = 0;
    usedArrows = false;
    lastState = '';
    disarm();
    counter.textContent = drills.length > 1 ? t(L.of(i + 1, drills.length)) : '';
    title.textContent = t(d.title);
    task.textContent = t(d.task);
    clear(goalBox);
    goalBox.append(h('p.ed-goal-h.small', {}, t(L.goal), d.target.cursor ? h('span.muted', {}, ` — ${t(L.goalCursor)}`) : null), goalView(d));
    session.reset(d.start as DrillStart);
    clear(verdict);
    verdict.className = 'ed-verdict';
    status.textContent = '';
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === drills.length - 1;
    after();
  };

  const keep = (e: Event) => e.preventDefault(); // keep the editor focused and the phone keyboard open
  const barBtn = (b: HTMLButtonElement, fn: () => void) => {
    b.addEventListener('pointerdown', keep);
    b.addEventListener('mousedown', keep);
    b.addEventListener('click', () => {
      fn();
      session.view.focus();
    });
    return b;
  };
  barBtn(ctrlBtn, () => setArmed('ctrl', !armed.ctrl));
  barBtn(metaBtn, () => setArmed('meta', !armed.meta));
  barBtn(escBtn, () => {
    disarm();
    press(engine === 'cm-vim' ? '<Esc>' : 'ESC');
  });
  const resetBtn = h('button.btn.small.ghost', { type: 'button', onclick: () => show(index) }, t(L.reset)) as HTMLButtonElement;
  const checkBtn = h('button.btn.small', { type: 'button', onclick: explainMismatch }, t(L.check)) as HTMLButtonElement;
  const prevBtn = h('button.btn.small.ghost', { type: 'button', onclick: () => show(Math.max(0, index - 1)) }, t(L.prev)) as HTMLButtonElement;
  const nextBtn = h('button.btn.small', { type: 'button', onclick: () => show(Math.min(drills.length - 1, index + 1)) }, t(L.next)) as HTMLButtonElement;

  const bar = h(
    'div.ed-bar',
    { role: 'toolbar', 'aria-label': t(L.bar) },
    escBtn,
    ctrlBtn,
    engine === 'cm-emacs' ? metaBtn : null,
  );

  root.append(
    h(
      'section.ed',
      { 'data-engine': engine },
      h('div.ed-head', {}, h('span.ed-label', {}, t(L.label[engine])), h('code.ed-engine', { title: t(L.engineTag) }, engine)),
      h('p.ed-note.small', {}, t(L.real[engine]), ' ', t(L.how)),
      p.intro ? h('p.small', {}, t(p.intro)) : null,
      counter,
      title,
      task,
      goalBox,
      host,
      status,
      bar,
      h('p.ed-note.small.muted', {}, t(L.steal)),
      h('div.ed-actions', {}, checkBtn, resetBtn, drills.length > 1 ? [prevBtn, nextBtn] : null),
      verdict,
    ),
  );
  show(0);

  return {
    dispose() {
      session.destroy();
    },
    describe() {
      const d = drills[index];
      return `${t(L.label[engine])}. ${t(d.title)}: ${t(d.task)}`;
    },
  };
}

/** The dev page `#/lab/editor-keys`: the sample drills of both engines. */
export function mountDrillsPage(root: HTMLElement, _props: unknown, ctx: WidgetCtx): Mounted {
  clear(root);
  const vimEl = h('div');
  const emacsEl = h('div');
  root.append(
    h('h1', {}, t(bi('Тренажёр клавиш: образцы упражнений', 'Key trainer: sample drills'))),
    h('p.muted', {}, t(bi(`Образцы для курсов Vim и Emacs: ${DRILLS.length} упражнений. Работает и на телефоне.`, `Samples for the Vim and Emacs courses: ${DRILLS.length} drills. Works on a phone too.`))),
    h('h2', {}, 'Vim'),
    vimEl,
    h('h2', {}, 'Emacs'),
    emacsEl,
  );
  const a = mountEditorDrill(vimEl, { set: 'vim' }, ctx);
  const b = mountEditorDrill(emacsEl, { set: 'emacs' }, ctx);
  return {
    dispose() {
      a.dispose();
      b.dispose();
    },
  };
}
