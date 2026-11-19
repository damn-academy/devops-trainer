// A tiny hyperscript helper instead of a UI framework, as in Sankofa.
// h('a.xref', { href: '#' }, 'text') builds <a class="xref" href="#">text</a>.

export type Attrs = Record<string, string | number | boolean | undefined | null | EventListener | ((e: never) => void)>;
export type Child = Node | string | number | null | undefined | false;

function applyAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.setAttribute('class', [el.getAttribute('class'), v].filter(Boolean).join(' '));
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el: Element, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** Build an HTML element. The tag may carry classes: 'div.card.wide'. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs, ...children: (Child | Child[])[]): HTMLElement;
export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build an SVG element: s('rect', { x: 0, y: 0, width: 10, height: 10 }). */
export function s(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): SVGElement {
  const [name, ...classes] = tag.split('.');
  const el = document.createElementNS(SVG_NS, name) as SVGElement;
  if (classes.length) el.setAttribute('class', classes.join(' '));
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

/** Append children, skipping null/undefined/false (like h() does). */
export function put(el: Element, ...children: (Child | Child[])[]): void {
  append(el, children);
}

/** Remove all children. */
export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove();
}

/** True when the learner asked for no motion: the OS setting or the course's calm mode. */
export function calm(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-calm')) return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export const ICONS = {
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  auto: 'M12 3a9 9 0 1 0 0 18V3Z M12 3a9 9 0 0 1 0 18',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h13v2',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h11v11H9V9Zm-4 6H4V4h11v1',
  term: 'm5 8 4 4-4 4m6 0h8',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  play: 'M8 5v14l11-7L8 5Z',
  pause: 'M8 5v14M16 5v14',
  first: 'M7 5v14M18 6l-7 6 7 6',
  last: 'M17 5v14M6 6l7 6-7 6',
  check: 'm5 12 5 5L20 7',
  cross: 'M6 6l12 12M18 6 6 18',
  warn: 'M12 4 2 20h20L12 4Zm0 6v4m0 3v.01',
  doc: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h7',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3-2-.6-.5-1.3 1-1.8-1.4-1.4-1.8 1-1.3-.5L13.4 4h-2.8l-.6 2-1.3.5-1.8-1L5.5 6.9l1 1.8-.5 1.3L4 10.6v2.8l2 .6.5 1.3-1 1.8 1.4 1.4 1.8-1 1.3.5.6 2h2.8l.6-2 1.3-.5 1.8 1 1.4-1.4-1-1.8.5-1.3 2-.6V12Z',
  repeat: 'M4 12a8 8 0 0 1 14-5.3L20 9m0-5v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5',
  download: 'M12 3v12m0 0-5-5m5 5 5-5M5 21h14',
  upload: 'M12 21V9m0 0-5 5m5-5 5 5M5 3h14',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ask: 'M4 5h16v11H9l-5 4V5Zm6 4a2 2 0 1 1 2.5 2c-.3.1-.5.4-.5.7V12m0 2v.01',
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'ic'): SVGElement {
  return s(
    'svg',
    { class: cls, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    s('path', { d: ICONS[name] }),
  );
}

let toastTimer = 0;
/** One-line status message at the bottom of the screen, read by screen readers. */
export function toast(msg: string): void {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = h('div.toast', { role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('on'), 2600);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Offer a file to save, without a server. */
export function downloadFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask the learner for a file and read it as text. */
export function pickFile(accept = 'application/json,.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: 'display:none' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.remove();
      resolve(f ? await f.text() : null);
    });
    document.body.append(input);
    input.click();
  });
}

/** Called once when the element enters the viewport (or immediately without IntersectionObserver). */
export function onVisible(el: Element, fn: () => void, threshold = 0.4): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    fn();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { threshold },
  );
  io.observe(el);
  return () => io.disconnect();
}
