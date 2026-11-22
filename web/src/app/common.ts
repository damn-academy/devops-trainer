// Shared pieces of the app pages: levels, glossary links, sources, prose.

import { clear, h, icon } from '../core/dom';
import { bi, t, UI, type Bi } from '../core/i18n';
import { renderMd } from '../core/markdown';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { BlockId, DocRef, Level, Sources } from '../core/types';
import { docChip, openDoc } from '../engine/docs/viewer';

export { chosenLevel, setTitle } from './status';

export interface Page {
  el: HTMLElement;
  title?: string;
  dispose?(): void;
}

/** The learner's level in a block: chosen, else Beginner. */
export function levelFor(block: BlockId | undefined): Level {
  return (block && store.state.levels[block]) || 'beginner';
}

/** Has the concept been introduced (or placed) for this learner? */
export function knows(conceptId: string): boolean {
  const s = store.state.concepts[conceptId]?.state;
  return !!s && s !== 'unseen';
}

let openCard: HTMLElement | null = null;
function closeCard() {
  openCard?.remove();
  openCard = null;
}
document.addEventListener?.('keydown', (e) => {
  if (e.key === 'Escape') closeCard();
});
document.addEventListener?.('click', (e) => {
  if (openCard && !(e.target as Element).closest?.('.gloss-card, .term, .tip-btn')) closeCard();
});

/** Place a floating card under its anchor, clamped to the viewport. */
function floatCard(anchor: HTMLElement, card: HTMLElement): void {
  document.body.append(card);
  const r = anchor.getBoundingClientRect();
  const w = Math.min(340, window.innerWidth - 32);
  card.style.width = `${w}px`;
  card.style.left = `${Math.max(16, Math.min(window.innerWidth - w - 16, r.left + window.scrollX))}px`;
  card.style.top = `${r.bottom + window.scrollY + 8}px`;
  openCard = card;
}

/** A "?" mark that shows the longer explanation on hover, focus or tap. */
export function infoTip(text: Bi): HTMLElement {
  const tip = h('span.tip-btn', { tabindex: '0', 'aria-label': t(bi('Подробнее об уровне', 'About this level')) }, '?');
  let mine: HTMLElement | null = null;
  const open = () => {
    closeCard();
    mine = h('div.gloss-card', { role: 'tooltip' }, h('p', { style: 'margin:0' }, t(text)));
    floatCard(tip, mine);
  };
  const close = () => {
    if (openCard && openCard === mine) closeCard();
    mine = null;
  };
  tip.addEventListener('pointerenter', open);
  tip.addEventListener('focusin', open);
  tip.addEventListener('pointerleave', close);
  tip.addEventListener('focusout', close);
  // A tap must not steal focus (the focusin above would open the card and
  // this click would immediately close it again), so keep focus where it was.
  tip.addEventListener('pointerdown', (e) => e.preventDefault());
  tip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openCard && openCard === mine) close();
    else open();
  });
  return tip;
}

/** A glossary link: opens a small card with the term, one sentence and where it was introduced. */
export function conceptLink(id: string, words?: string): HTMLElement {
  const c = registry.concepts.get(id);
  const label = words ?? (c ? t(c.term) : id);
  const btn = h('button.term', { type: 'button', 'data-concept': id, 'aria-haspopup': 'dialog' }, label);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCard();
    if (!c) return;
    const lesson = registry.lessons.get(c.introducedIn);
    floatCard(
      btn,
      h(
        'div.gloss-card',
        { role: 'dialog', 'aria-label': t(c.term) },
        h('strong', {}, t(c.term)),
        h('p', {}, t(c.short)),
        lesson ? h('a.small', { href: href({ name: 'lesson', id: lesson.id }) }, `${t(bi('Вводится в уроке', 'Introduced in'))}: ${t(lesson.title)}`) : null,
        c.docRef ? docChip(c.docRef, 'glossary') : null,
      ),
    );
  });
  return btn;
}

/** Prose with glossary links and code blocks, in the current language. */
export function prose(b: Bi | string, cls = 'prose'): HTMLElement {
  const text = typeof b === 'string' ? b : t(b);
  return h(`div.${cls}`, {}, renderMd(text, { concept: conceptLink, code: (code, lang) => codeBlock(code, lang) }));
}

export function codeBlock(code: string, lang = ''): HTMLElement {
  const pre = h('pre', { class: `code lang-${lang || 'text'}` }, h('code', {}, code));
  return h('div.codeblock', {}, lang ? h('span.code-lang', {}, lang) : null, pre);
}

export function sourcesBlock(s: Sources): HTMLElement {
  const list = (items: Sources['en']) =>
    h('ul.sources', {}, ...items.map((x) => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer' }, x.title), x.note ? h('span.muted', {}, ` — ${t(x.note)}`) : null)));
  return h(
    'section.sources-block',
    {},
    h('h3', {}, t(UI.sources)),
    h('div.sources-cols', {}, h('div', {}, h('h4', {}, t(UI.sourcesRu)), list(s.ru)), h('div', {}, h('h4', {}, t(UI.sourcesEn)), list(s.en))),
  );
}

export function levelBadge(l: Level): HTMLElement {
  return h('span.badge', { class: `lvl-${l}` }, t(UI.levels[l]));
}

export function openRef(ref: DocRef): void {
  if (!openDoc(ref)) {
    if (ref.url) window.open(ref.url, '_blank', 'noopener,noreferrer');
  }
}

export function emptyState(title: Bi, body?: Bi, action?: { label: Bi; href: string }): HTMLElement {
  return h(
    'div.empty',
    {},
    h('h2', {}, t(title)),
    body ? h('p', {}, t(body)) : null,
    action ? h('a.btn.primary', { href: action.href }, t(action.label), icon('next')) : null,
  );
}

export function replace(el: HTMLElement, ...children: Node[]): void {
  clear(el);
  el.append(...children);
}
