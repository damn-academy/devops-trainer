// docview: the offline documentation reader (08 §4.1). A side panel (a
// bottom sheet on a phone) with the anatomy of the page in the margin.
//   peek  (DL2): the section of the ref, the needed line highlighted, the rest dimmed
//   page  (DL3–4): the whole page, no highlight, no anchor
//   exam  (DL5): only the allowed corpus, no links outside
// Every opening is logged as doc.open — the doc trail for the mentor and the review.

import { renderMd } from '../../core/markdown';
import { clear, h, icon } from '../../core/dom';
import { bi, lang, t, UI, type Bi } from '../../core/i18n';
import { store } from '../../core/store';
import type { DocPage, DocRef, DocSource } from '../../core/types';
import { corpus, refLabel, sourceOf } from './corpus';

/** What each conventional section is for, shown in the margin (DL2 anatomy). */
export const ANATOMY: Record<string, Bi> = {
  MEASURES: bi('Какие показатели измеряются', 'Measures'),
  ARTIFACTS: bi('Какие результаты работы сохраняются', 'Artifacts'),
  POLICY: bi('Какие правила действуют', 'Policy'),
  NAME: bi('как называется и что делает — одной строкой', 'what it is called and what it does, in one line'),
  SYNOPSIS: bi('как вызывать: [в скобках] — необязательное, ... — можно повторить', 'how to call it: [brackets] are optional, ... may repeat'),
  DESCRIPTION: bi('что делает подробно', 'what it does, in detail'),
  OPTIONS: bi('флаги: короткая и длинная форма через запятую', 'flags: short and long form, separated by a comma'),
  'EXIT STATUS': bi('коды завершения: что значит $?', 'exit codes: what $? means'),
  ENVIRONMENT: bi('переменные окружения, которые читает программа', 'environment variables the program reads'),
  FILES: bi('файлы, которые программа читает или пишет', 'files the program reads or writes'),
  EXAMPLES: bi('готовые примеры — часто быстрее всего начать отсюда', 'ready examples — often the fastest place to start'),
  'SEE ALSO': bi('соседние страницы: куда смотреть дальше', 'neighbouring pages: where to look next'),
  USAGE: bi('как вызывать и что делает', 'how to call it and what it does'),
  FIELDS: bi('поля объекта и их типы', 'fields of the object and their types'),
};

export type DocMode = 'peek' | 'page' | 'exam';

export interface OpenOptions {
  mode?: DocMode;
  /** Exam mode: sources open in the reader. */
  allowed?: DocSource[];
  via?: 'terminal' | 'docref' | 'search' | 'hint' | 'exam' | 'glossary';
  /** Keep keyboard focus where it is (the terminal opens the page beside its own pager). */
  keepFocus?: boolean;
}

let panel: HTMLElement | null = null;
let lastFocus: Element | null = null;

function record(page: DocPage, anchor: string | undefined, via: OpenOptions['via']): void {
  store.record({ kind: 'doc.open', page: page.id, source: page.source, anchor, via: via ?? 'docref' });
}

/** Render a page body; returns the element and a function to scroll to a section. */
export function renderPage(
  page: DocPage,
  o: { mode: DocMode; anchor?: string; line?: string; onSection?: (id: string) => void; query?: string } = { mode: 'page' },
): HTMLElement {
  const wrap = h('div.docpage', { 'data-mode': o.mode });
  const nav = h('nav.doc-map', { 'aria-label': t(bi('Разделы страницы', 'Page sections')) });
  const body = h('div.doc-body');
  for (const s of page.sections) {
    const isTarget = o.mode === 'peek' && s.id === o.anchor;
    const dim = o.mode === 'peek' && o.anchor && s.id !== o.anchor;
    const label = ANATOMY[s.id];
    const navItem = h(
      'button.doc-map-item',
      {
        type: 'button',
        'data-section': s.id,
        'aria-current': isTarget ? 'true' : undefined,
        onclick: () => {
          if (o.onSection) o.onSection(s.id);
          body.querySelector(`[data-section="${CSS.escape(s.id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        },
      },
      h('span.doc-map-name', {}, lang() === 'ru' && ANATOMY[s.id] ? t(ANATOMY[s.id]) : s.title ?? s.id),
      label && o.mode !== 'exam' ? h('span.doc-map-why', {}, t(label)) : null,
    );
    nav.append(navItem);
    const lines = s.body.split('\n').map((ln) => {
      const hl = isTarget && o.line && ln.includes(o.line);
      const span = h('span.doc-line', { class: hl ? 'hl' : undefined }, ...markQuery(ln, o.query));
      return [span, '\n'];
    });
    body.append(
      h(
        'section.doc-sec',
        { 'data-section': s.id, class: dim ? 'dim' : isTarget ? 'target' : undefined },
        h('h4', {}, lang() === 'ru' && ANATOMY[s.id] ? t(ANATOMY[s.id]) : s.title ?? s.id),
        h('pre', {}, ...lines.flat()),
      ),
    );
  }
  wrap.append(nav, body);
  return wrap;
}

function markQuery(line: string, q?: string): (string | Node)[] {
  if (!q || q.length < 2) return [line];
  const out: (string | Node)[] = [];
  const low = line.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  for (;;) {
    const j = low.indexOf(ql, i);
    if (j < 0) break;
    out.push(line.slice(i, j), h('mark', {}, line.slice(j, j + q.length)));
    i = j + q.length;
  }
  out.push(line.slice(i));
  return out;
}

export function closeDoc(): void {
  if (!panel) return;
  panel.classList.remove('open');
  const p = panel;
  setTimeout(() => p.remove(), 200);
  panel = null;
  (lastFocus as HTMLElement | null)?.focus?.();
}

/** Open the reader at a reference. Returns false if the page is not in the corpus (then a URL ref opens in a new tab). */
export function openDoc(ref: DocRef, o: OpenOptions = {}): boolean {
  const mode = o.mode ?? (ref.line ? 'peek' : 'page');
  const page = ref.page ? corpus.get(ref.page) : undefined;
  if (!page) {
    if (ref.url && mode !== 'exam') {
      window.open(ref.url, '_blank', 'noopener,noreferrer');
      store.record({ kind: 'doc.open', page: ref.url, source: sourceOf(ref), via: o.via ?? 'docref' });
      return true;
    }
    if (mode !== 'exam') return false;
  }
  lastFocus = document.activeElement;
  if (panel) panel.remove();
  panel = h('aside.docview', { role: 'dialog', 'aria-modal': 'false', 'aria-label': t(bi('Документация', 'Documentation')) });
  document.body.append(panel);
  requestAnimationFrame(() => panel?.classList.add('open'));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'q' && !(e.target instanceof HTMLInputElement))) closeDoc();
  });
  if (mode === 'exam') showExam(panel, o.allowed ?? [], page, ref);
  else if (page) showPage(panel, page, ref, mode, o.via, !o.keepFocus);
  return true;
}

function header(title: string, extra: Node[] = []): HTMLElement {
  return h(
    'header.doc-head',
    {},
    h('div.doc-title', {}, icon('doc'), h('span', {}, title)),
    ...extra,
    h('button.icon-btn', { type: 'button', 'aria-label': t(UI.close), onclick: closeDoc }, icon('close')),
  );
}

function showPage(root: HTMLElement, page: DocPage, ref: DocRef, mode: DocMode, via: OpenOptions['via'], focus = true): void {
  clear(root);
  record(page, mode === 'peek' ? ref.anchor : undefined, via);
  let query = '';
  const search = h('input.doc-search', { type: 'search', placeholder: t(bi('Поиск по странице', 'Search this page')), 'aria-label': t(bi('Поиск по странице', 'Search this page')) }) as HTMLInputElement;
  const holder = h('div.doc-holder');
  const draw = (m: DocMode) => {
    clear(holder);
    if (m === 'peek' && ref.gloss) holder.append(h('aside.doc-gloss', {}, renderMd(t(ref.gloss))));
    holder.append(renderPage(page, { mode: m, anchor: ref.anchor, line: ref.line, query }));
    if (m === 'peek') {
      holder.append(
        h(
          'div.doc-peek-bar',
          {},
          h('span', {}, t(bi('Это фрагмент страницы. Остальные разделы приглушены.', 'This is a fragment of the page. Other sections are dimmed.'))),
          h('button.btn.ghost', { type: 'button', onclick: () => draw('page') }, t(UI.wholePage)),
        ),
      );
      requestAnimationFrame(() => holder.querySelector('.doc-sec.target')?.scrollIntoView({ block: 'start' }));
    }
  };
  search.addEventListener('input', () => {
    query = search.value;
    draw('page');
    holder.querySelector('mark')?.scrollIntoView({ block: 'center' });
  });
  const extra: Node[] = [search];
  if (page.url) extra.push(h('a.doc-ext', { href: page.url, target: '_blank', rel: 'noopener noreferrer', title: page.url }, icon('link'), h('span', {}, t(bi('оригинал', 'original')))));
  root.append(header(page.title, extra), holder);
  if (page.license) root.append(h('footer.doc-foot', {}, page.license));
  draw(mode);
  if (focus) search.focus({ preventScroll: true });
}

function showExam(root: HTMLElement, allowed: DocSource[], start: DocPage | undefined, ref: DocRef): void {
  clear(root);
  const pages = corpus.bySource(allowed).sort((a, b) => a.title.localeCompare(b.title));
  const list = h('ul.doc-index');
  const holder = h('div.doc-holder');
  const search = h('input.doc-search', { type: 'search', placeholder: t(bi('Поиск по разрешённой документации', 'Search the allowed documentation')) }) as HTMLInputElement;
  const open = (p: DocPage) => {
    record(p, undefined, 'exam');
    clear(holder);
    holder.append(renderPage(p, { mode: 'exam', query: search.value }));
  };
  const fill = () => {
    clear(list);
    const q = search.value.trim();
    const hits = q ? corpus.search(q, pages).map((x) => x.page) : pages;
    for (const p of [...new Set(hits)]) list.append(h('li', {}, h('button.linklike', { type: 'button', onclick: () => open(p) }, p.title)));
    if (!hits.length) list.append(h('li.muted', {}, t(bi('Ничего не найдено', 'Nothing found'))));
  };
  search.addEventListener('input', fill);
  root.append(header(t(bi('Документация экзамена', 'Exam documentation')), [search]), h('div.doc-exam', {}, list, holder));
  fill();
  if (start && allowed.includes(start.source)) open(start);
  void ref;
}

/** DL1 flicker: a small "this is from" chip next to a command, flag or element. */
export function docChip(ref: DocRef, via: OpenOptions['via'] = 'docref'): HTMLElement {
  const label = refLabel(ref);
  return h(
    'button.docref',
    {
      type: 'button',
      title: `${t(UI.fromHere)}: ${label}`,
      onclick: (e: Event) => {
        e.stopPropagation();
        openDoc(ref, { mode: ref.line ? 'peek' : 'page', via });
      },
    },
    icon('doc'),
    h('span', {}, label),
  );
}

/** An inline page fragment (H3 at DL2): the section with the line highlighted, inside the lesson. */
export function docFragment(ref: DocRef): HTMLElement | null {
  const page = ref.page ? corpus.get(ref.page) : undefined;
  if (!page) return null;
  record(page, ref.anchor, 'hint');
  const sec = page.sections.find((s) => s.id === ref.anchor) ?? page.sections[0];
  const mini = h(
    'div.frag-map',
    {},
    ...page.sections.map((s) => h('span', { class: s.id === sec.id ? 'on' : undefined, title: ANATOMY[s.id] ? t(ANATOMY[s.id]) : undefined }, lang() === 'ru' && ANATOMY[s.id] ? t(ANATOMY[s.id]) : s.title ?? s.id)),
  );
  const lines = sec.body.split('\n').map((ln) => [h('span.doc-line', { class: ref.line && ln.includes(ref.line) ? 'hl' : undefined }, ln), '\n']);
  return h(
    'figure.doc-fragment',
    {},
    h('figcaption', {}, h('strong', {}, page.title), ' · ', sec.title ?? sec.id, ANATOMY[sec.id] ? h('span.muted', {}, ` — ${t(ANATOMY[sec.id])}`) : null),
    ref.gloss ? h('aside.doc-gloss', {}, renderMd(t(ref.gloss))) : null,
    mini,
    h('pre', {}, ...lines.flat()),
    h('button.btn.ghost.small', { type: 'button', onclick: () => openDoc({ page: page.id }, { mode: 'page', via: 'hint' }) }, t(UI.wholePage)),
  );
}
