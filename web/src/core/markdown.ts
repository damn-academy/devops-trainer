// Markdown-lite for textbook prose: paragraphs, ### headings, lists, quotes,
// ``` fences, `code`, **bold**, *em*, [text](url) and glossary links
// [[concept.id]] / [[concept.id|shown words]]. No raw HTML: content is turned
// into DOM nodes, never into innerHTML.

import { h } from './dom';
import { markdownImage } from './markdown-image';
import { lang as currentLang, type Lang } from './i18n';

const mediaUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const LINK = /\[\[([a-z0-9][\w.-]*)(?:\|([^\]]+))?\]\]/g;

/** Concept ids linked in a text: [[linux.process]] or [[linux.process|процессы]]. */
export function conceptLinks(md: string): { id: string; words?: string }[] {
  return [...md.matchAll(LINK)].map((m) => ({ id: m[1], words: m[2] }));
}

/** Plain prose of a text for the glossary scan: no code, no URLs, no glossary links. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(LINK, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>]/g, ' ');
}

const NBSP = ' ';
const RU_SHORT = /(^|[\s(«„"—–-])(а|в|во|и|к|ко|о|об|с|со|у|я|не|ни|но|на|за|из|от|до|по|при|без|для|как|что|это)[ \t\n]+(?=\S)/giu;
const EN_SHORT = /(^|[\s(“"—–])(a|an|the|of|to|in|on|at|by|for|and|or|as|is|I)[ \t\n]+(?=\S)/gu;

/** Journal typography: «ёлочки» in Russian, “quotes” in English, no hanging short words, the dash stays with the word before. */
export function typeset(text: string, l: Lang = currentLang()): string {
  let s = text
    .replace(/(^|[\s(\[—–-])"/gu, `$1${l === 'ru' ? '«' : '“'}`)
    .replace(/"/g, l === 'ru' ? '»' : '”')
    .replace(/(\p{L})'(?=\p{L})/gu, '$1’')
    .replace(/ (—)/g, `${NBSP}$1`)
    .replace(/(\d) (?=[^\d\s])/g, `$1${NBSP}`);
  const re = l === 'ru' ? RU_SHORT : EN_SHORT;
  for (let i = 0; i < 3; i++) {
    const next = s.replace(re, (_m, pre, w) => `${pre}${w}${NBSP}`);
    if (next === s) break;
    s = next;
  }
  return s;
}

export interface MdOptions {
  lang?: Lang;
  /** Render a glossary link; default is a plain <span class="term">. */
  concept?: (id: string, words: string | undefined) => Node;
  /** Language label for fenced code (copy button etc. is up to the caller). */
  code?: (code: string, lang: string) => Node;
}

function inline(src: string, o: MdOptions): Node[] {
  const out: Node[] = [];
  const l = o.lang ?? currentLang();
  // tokens: `code`, [[concept]], [text](url), **bold**, *em*
  const re = /(`[^`]+`)|(\[\[[a-z0-9][\w.-]*(?:\|[^\]]+)?\]\])|(\[[^\]]+\]\((?:https?:\/\/|#|media\/|templates\/)[^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push(document.createTextNode(typeset(src.slice(last, m.index), l)));
    const tok = m[0];
    if (m[1]) out.push(h('code', {}, tok.slice(1, -1)));
    else if (m[2]) {
      const mm = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(tok)!;
      out.push(o.concept ? o.concept(mm[1], mm[2]) : h('span.term', { 'data-concept': mm[1] }, mm[2] ?? mm[1]));
    } else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const external = /^https?:/.test(mm[2]);
      // Lesson files (media/) and downloadable course templates (templates/) are served from the site root.
      const media = mm[2].startsWith('media/') || mm[2].startsWith('templates/');
      const download = media && !/\.html?(?:[?#]|$)/i.test(mm[2]);
      out.push(h('a', { href: media ? mediaUrl(mm[2]) : mm[2], download, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, ...inline(mm[1], o)));
    } else if (m[4]) out.push(h('strong', {}, ...inline(tok.slice(2, -2), o)));
    else if (m[5]) out.push(h('em', {}, ...inline(tok.slice(1, -1), o)));
    last = m.index! + tok.length;
  }
  if (last < src.length) out.push(document.createTextNode(typeset(src.slice(last), l)));
  return out;
}

/** Inline markdown-lite (code, bold, em, links) for one-line texts such as summaries. */
export function renderInline(md: string, o: MdOptions = {}): Node[] {
  return inline(md, o);
}

/** Split GFM cells without splitting escaped pipes or inline code. */
export function tableCells(line: string): string[] {
  const cells: string[] = []; let cell = '', ticks = 0;
  const text = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let j = 0; j < text.length; j++) {
    if (text[j] === '\\' && text[j + 1] === '|') { cell += '|'; j++; }
    else if (text[j] === '`') { const run = text.slice(j).match(/^`+/)![0]; ticks = ticks === run.length ? 0 : ticks || run.length; cell += run; j += run.length - 1; }
    else if (text[j] === '|' && !ticks) { cells.push(cell.trim()); cell = ''; }
    else cell += text[j];
  }
  cells.push(cell.trim()); return cells;
}

/** Render markdown-lite to a fragment. */
export function renderMd(md: string, o: MdOptions = {}): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) frag.append(h('p', {}, ...inline(para.join(' '), o)));
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join('\n');
      frag.append(o.code ? o.code(code, fence[1]) : h('pre', { class: `code lang-${fence[1] || 'text'}` }, h('code', {}, code)));
      continue;
    }
    const image = markdownImage(line);
    if (image) {
      flush();
      const src = mediaUrl(image.src);
      const video = /\.(mp4|webm)$/i.test(image.src);
      frag.append(h('figure.md-image', {},
        video ? h('video', { src, controls: true, preload: 'metadata', playsinline: true, 'aria-label': image.alt })
          : h('a', { href: src, target: '_blank', rel: 'noopener noreferrer' },
          h('img', { src, alt: image.alt, loading: 'lazy', decoding: 'async' })),
        image.caption !== undefined ? h('figcaption', {}, image.caption) : null));
      i++;
      continue;
    }
    const headers = tableCells(line);
    const separators = tableCells(lines[i + 1] ?? '');
    if (line.includes('|') && headers.length === separators.length && separators.every(c => /^:?-{3,}:?$/.test(c))) {
      flush();
      const align = separators.map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left');
      const row = (cells: string[], header = false) => h('tr', {}, ...headers.map((_, col) =>
        h(header ? 'th' : 'td', { ...(header ? { scope: 'col' } : {}), style: `text-align:${align[col]}` }, ...inline(cells[col] ?? '', o))));
      const body = h('tbody'); i += 2;
      const leads: string[] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { const cells = tableCells(lines[i++]); leads.push(cells[0] ?? ''); body.append(row(cells)); }
      // Short row labels (a weekly cash table) stay pinned even on a phone; long ones would cover the screen.
      const shortLead = headers.length > 3 && [headers[0] ?? '', ...leads].every(c => c.length <= 16);
      frag.append(h(shortLead ? 'div.md-table-scroll.short-lead' : 'div.md-table-scroll', { tabindex: 0, role: 'region', 'aria-label': (o.lang ?? currentLang()) === 'ru' ? 'Таблица: прокрутка по горизонтали' : 'Table: scroll horizontally' },
        h('table', {}, h('thead', {}, row(headers, true)), body)));
      continue;
    }
    const head = /^(#{2,4})\s+(.*)$/.exec(line);
    if (head) {
      flush();
      frag.append(h(`h${Math.min(4, head[1].length + 1)}`, {}, ...inline(head[2], o)));
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\./.test(line);
      // A numbered list that continues after a paragraph keeps its authored first number.
      const first = ordered ? Number(/^\s*(\d+)\./.exec(line)![1]) : 1;
      const list = h(ordered ? 'ol' : 'ul', ordered && first !== 1 ? { start: first } : {});
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        list.append(h('li', {}, ...inline(item, o)));
      }
      frag.append(list);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      frag.append(h('blockquote', {}, ...inline(body.join(' '), o)));
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return frag;
}
