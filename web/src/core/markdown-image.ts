/** Standalone local image; optional Markdown title is a plain-text caption. */
export function markdownImage(line: string) {
  const match = /^\s*!\[([^\]]*)\]\((media\/[\w./-]+)(?:\s+"([^"\n]*)")?\)\s*$/.exec(line);
  if (!match) return undefined;
  const [, alt, src, caption] = match;
  if (src.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Invalid image path: ${src}`);
  return { alt, src, caption };
}
