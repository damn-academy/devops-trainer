// .gitignore patterns (gitignore(5)): blank lines and # comments are skipped,
// a leading ! re-includes, a trailing / matches only directories, a / at the
// start or in the middle anchors the pattern to the .gitignore's directory,
// * and ? do not cross /, ** crosses directories.

export interface IgnoreRule {
  negate: boolean;
  dirOnly: boolean;
  anchored: boolean;
  re: RegExp;
  source: string;
}

function globBody(p: string): string {
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        // "**/" matches zero or more directories; a trailing "**" matches everything inside.
        if (p[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const close = p.indexOf(']', i + 1);
      if (close > i) {
        re += '[' + p.slice(i + 1, close).replace(/^!/, '^') + ']';
        i = close;
      } else re += '\\[';
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return re;
}

export function parseIgnore(text: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    const body = globBody(line);
    const re = new RegExp(anchored ? `^${body}$` : `(?:^|/)${body}$`);
    rules.push({ negate, dirOnly, anchored, re, source: raw.trim() });
  }
  return rules;
}

/**
 * Is `path` (relative to the repository root, no leading slash) ignored? A file
 * inside an ignored directory is ignored too, and Git cannot re-include it.
 */
export function isIgnored(rules: IgnoreRule[], path: string, isDir = false): boolean {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) {
    if (matchOne(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matchOne(rules, path, isDir);
}

function matchOne(rules: IgnoreRule[], path: string, isDir: boolean): boolean {
  let ignored = false;
  for (const r of rules) {
    if (r.dirOnly && !isDir) continue;
    if (r.re.test(path)) ignored = !r.negate;
  }
  return ignored;
}
