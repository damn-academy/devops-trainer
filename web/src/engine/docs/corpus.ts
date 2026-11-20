// The offline documentation corpus (09 §2.6): man pages and --help texts
// carried by shell commands, plus pages modules register directly
// (kubectl explain output, web snapshots). Pages are split into sections with
// anchors, so the ladder can point at a section and highlight one line.

import { lang } from '../../core/i18n';
import type { DocPage, DocRef, DocSource, ShellCommand } from '../../core/types';

export class Corpus {
  private pages = new Map<string, DocPage>();

  add(page: DocPage): void {
    if (this.pages.has(page.id)) throw new Error(`doc page "${page.id}" registered twice`);
    this.pages.set(page.id, page);
  }

  /** man/<name>.<section> from `cmd.man`, help/<name> from `cmd.help`. */
  addCommand(cmd: ShellCommand): void {
    for (const id of [`man/${cmd.name}.`, `help/${cmd.name}`]) {
      for (const k of [...this.pages.keys()]) if (k === id || (id.endsWith('.') && k.startsWith(id))) this.pages.delete(k);
    }
    if (cmd.man) {
      this.add({
        id: `man/${cmd.name}.${cmd.man.section}`,
        source: 'man',
        title: `${cmd.name}(${cmd.man.section})`,
        url: cmd.man.url,
        license: cmd.man.license,
        version: cmd.man.version,
        sections: cmd.man.sections,
      });
    }
    if (cmd.help) {
      this.add({
        id: `help/${cmd.name}`,
        source: 'help',
        title: `${cmd.name} --help`,
        sections: splitHelp(cmd.help),
      });
    }
  }

  get(id: string): DocPage | undefined {
    return this.pages.get(id) ?? this.pages.get(normalizeId(id));
  }

  all(): DocPage[] {
    return [...this.pages.values()];
  }

  bySource(sources: DocSource[]): DocPage[] {
    return this.all().filter((p) => sources.includes(p.source));
  }

  /** For `man NAME` and `man SECTION NAME`. */
  findMan(name: string, section?: string): DocPage | undefined {
    const pages = this.all().filter((p) => p.source === 'man' && p.id.startsWith(`man/${name}.`));
    if (section) return pages.find((p) => p.id === `man/${name}.${section}`) ?? pages.find((p) => p.id.startsWith(`man/${name}.${section}`));
    return pages.sort((a, b) => a.id.localeCompare(b.id))[0];
  }

  /** Full-text search across pages: hits with the section and the matching line. */
  search(query: string, within?: DocPage[]): { page: DocPage; section: string; line: string }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { page: DocPage; section: string; line: string }[] = [];
    for (const p of within ?? this.all()) {
      if (p.title.toLowerCase().includes(q)) out.push({ page: p, section: p.sections[0]?.id ?? '', line: p.title });
      for (const s of p.sections) {
        for (const line of s.body.split('\n')) {
          if (line.toLowerCase().includes(q)) {
            out.push({ page: p, section: s.id, line: line.trim() });
            break;
          }
        }
      }
    }
    return out.slice(0, 60);
  }
}

function normalizeId(id: string): string {
  // 'ls(1)' → 'man/ls.1'; 'man:ls(1)' → 'man/ls.1'
  const m = /^(?:man[:/])?([\w.+-]+)\((\w+)\)$/.exec(id);
  return m ? `man/${m[1]}.${m[2]}` : id;
}

/** Split --help text into sections at lines like "Options:" or "Exit status:". */
export function splitHelp(text: string): { id: string; title?: string; body: string }[] {
  const lines = text.replace(/\n$/, '').split('\n');
  const sections: { id: string; title?: string; body: string }[] = [];
  let cur = { id: 'USAGE', title: 'Usage', lines: [] as string[] };
  const push = () => {
    if (cur.lines.length) sections.push({ id: cur.id, title: cur.title, body: cur.lines.join('\n') });
  };
  for (const line of lines) {
    const m = /^([A-Z][A-Za-z ]+):\s*$/.exec(line);
    if (m) {
      push();
      cur = { id: m[1].toUpperCase(), title: m[1], lines: [] };
    } else cur.lines.push(line);
  }
  push();
  return sections;
}

/** Render a page as the text `man` prints in the terminal pager. */
export function renderManText(p: DocPage): string {
  const name = p.title.toUpperCase().replace(/\(.*\)$/, '');
  const sec = /\((\w+)\)$/.exec(p.title)?.[1] ?? '';
  const header = `${name}(${sec})`;
  const title = sec.startsWith('1') ? 'User Commands' : sec.startsWith('8') ? 'System Administration' : sec.startsWith('5') ? 'File Formats' : 'Manual';
  const pad = Math.max(1, 78 - header.length * 2 - title.length);
  let out = `${header}${' '.repeat(Math.floor(pad / 2))}${title}${' '.repeat(Math.ceil(pad / 2))}${header}\n\n`;
  for (const s of p.sections) {
    out += `\x1b[1m${s.title ?? s.id}\x1b[0m\n`;
    out += s.body
      .split('\n')
      .map((l) => (l ? `       ${l}` : ''))
      .join('\n');
    out += '\n\n';
  }
  return out;
}

/** The one-line description from the NAME section: "ls - list directory contents" → "list directory contents". */
export function shortOf(p: DocPage): string {
  const name = p.sections.find((s) => s.id === 'NAME')?.body ?? p.title;
  return name.replace(/^[^-—]*[-—]\s*/, '').split('\n')[0];
}

/** Label for a doc chip: 'ls(1) · OPTIONS · -l'. */
export function refLabel(ref: DocRef, c: Corpus = corpus): string {
  if (ref.label) return ref.label;
  if (ref.page) {
    const p = c.get(ref.page);
    if (lang() === 'ru') return `Справка по ${(p?.title ?? ref.page).replace(/\(\w+\)$/, '')}`;
    return [p?.title ?? ref.page, ref.anchor, ref.line].filter(Boolean).join(' · ');
  }
  if (ref.url) {
    try {
      const u = new URL(ref.url);
      return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? ' › ' + decodeURIComponent(u.pathname.split('/').filter(Boolean).slice(-1)[0] ?? '') : '');
    } catch {
      return ref.url;
    }
  }
  return '';
}

/** Which ladder source a ref belongs to. */
export function sourceOf(ref: DocRef, c: Corpus = corpus): DocSource {
  if (ref.page) {
    const p = c.get(ref.page);
    if (p) return p.source;
    return ref.page.split('/')[0] as DocSource;
  }
  if (ref.url) {
    try {
      return new URL(ref.url).hostname.replace(/^www\./, '') as DocSource;
    } catch {
      return 'web';
    }
  }
  return 'man';
}

/** The global corpus, filled by core/registry.ts. */
export const corpus = new Corpus();
