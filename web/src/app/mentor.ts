// The "Ask" box: the hook the AI builder plugs a Mentor into (BlockModule.mentor).
// The engine folds any answer that leaks a solution token (09 §4.5) and never
// offers the mentor in exam mode.

import { externalButton } from '../engine/ai/external-panel';
import { clear, h, icon } from '../core/dom';
import { bi, lang, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { Level, MentorMode, MentorRequest } from '../core/types';

export interface AskOptions {
  mode: MentorMode;
  level: Level;
  lessonId?: string;
  task?: { id: string; prompt: string; solutionTokens?: string[] };
  screen?: () => string | undefined;
}

/** Fold an answer that names a solution token; returns [visible, folded?]. */
export function foldLeak(answer: string, tokens: string[] = []): { safe: boolean; text: string } {
  const leak = tokens.some((tok) => tok && answer.includes(tok));
  return { safe: !leak, text: answer };
}

export function askBox(o: AskOptions): HTMLElement {
  const docs = o.mode === 'docs';
  const wrap = h('div.ask');
  const btn = h('button.btn.ghost.small', { type: 'button' }, icon('ask'), t(docs ? UI.whereToLook : UI.ask));
  const panel = h('div.ask-panel', { hidden: true });
  wrap.append(btn, panel);
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    clear(panel);
    const mentor = registry.mentor;
    if (!mentor || !mentor.ready()) {
      panel.append(
        h(
          'p.muted',
          {},
          t(bi('Можно скопировать запрос в любой чат с нейросетью или подключить наставника в разделе ', 'You can copy a prompt into any AI chat or connect the tutor in ')),
          h('a', { href: href({ name: 'settings' }) }, t(UI.settings)),
          '.',
        ),
      );
      panel.append(externalButton({ lessonId: o.lessonId, level: o.level, task: o.task?.prompt, screen: o.screen?.() }));
      if (docs) panel.append(h('p', {}, t(UI.whereDidYouLook)));
      return;
    }
    const ta = h('textarea', { rows: 2, placeholder: docs ? t(UI.whereDidYouLook) : t(bi('Что непонятно?', 'What is unclear?')) }) as HTMLTextAreaElement;
    const answer = h('div.ask-answer', { 'aria-live': 'polite' });
    const send = h('button.btn.primary.small', { type: 'button' }, t(UI.ask));
    send.addEventListener('click', async () => {
      if (!ta.value.trim()) return;
      send.setAttribute('disabled', '');
      clear(answer);
      answer.append(h('p.muted', {}, '…'));
      const req: MentorRequest = {
        mode: o.mode,
        question: ta.value,
        lang: lang(),
        level: o.level,
        lessonId: o.lessonId,
        task: o.task ? { id: o.task.id, prompt: o.task.prompt } : undefined,
        introduced: Object.entries(store.state.concepts)
          .filter(([, c]) => c.state !== 'unseen')
          .map(([id]) => id),
        docTrail: store.state.docTrail.slice(-20).map((d) => ({ page: d.page, anchor: d.anchor })),
        screen: o.screen?.(),
      };
      store.record({ kind: 'mentor.ask', mode: o.mode, task: o.task?.id });
      try {
        const text = await mentor.ask(req);
        const f = foldLeak(text, o.task?.solutionTokens);
        clear(answer);
        if (f.safe) answer.append(h('p', {}, f.text));
        else {
          const reveal = h('button.btn.ghost.small', { type: 'button' }, t(bi('Ответ называет решение — показать всё равно', 'The answer names the solution — show anyway')));
          reveal.addEventListener('click', () => reveal.replaceWith(h('p', {}, f.text)));
          answer.append(reveal);
        }
      } catch (e) {
        clear(answer);
        answer.append(h('p.err', {}, (e as Error).message));
      } finally {
        send.removeAttribute('disabled');
      }
    });
    panel.append(ta, send, answer);
    ta.focus();
  });
  return wrap;
}
