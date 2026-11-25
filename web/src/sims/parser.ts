export interface CompanyOption { value: string; label: string; text: string }
export interface CompanyGroup { key: string; label: string; options: CompanyOption[] }

function blocks(source: string) {
  const markers = [...source.matchAll(/<!--\s*(legend|group|opt):\s*([\w-]+)(?:\s*\|\s*([^>]+?))?\s*-->/g)];
  if (!markers.length || source.slice(0, markers[0].index).trim()) throw new Error('Missing content marker');
  return markers.map((m, i) => ({ kind: m[1], key: m[2], label: m[3]?.trim(),
    text: source.slice(m.index! + m[0].length, markers[i + 1]?.index ?? source.length).trim() }));
}
export function parseLegends(source: string) {
  const seen = new Set<string>();
  return blocks(source).map(b => {
    if (b.kind !== 'legend' || !b.text || seen.has(b.key)) throw new Error('Invalid legend');
    seen.add(b.key);
    const label = b.label ?? /^Компания\s+(\S+)/.exec(b.text)?.[1] ?? b.key;
    return { id: b.key, label, text: b.text };
  });
}
export function parseCompanyConfig(source: string): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const b of blocks(source)) {
    if (!b.label) throw new Error('Missing label');
    if (b.kind === 'group') {
      if (b.text || groups.some(g => g.key === b.key)) throw new Error('Invalid group');
      groups.push({ key: b.key, label: b.label, options: [] });
    } else {
      const group = groups.at(-1);
      if (b.kind !== 'opt' || !group || !b.text || group.options.some(o => o.value === b.key)) throw new Error('Invalid option');
      group.options.push({ value: b.key, label: b.label, text: b.text });
    }
  }
  if (groups.some(g => !g.options.length)) throw new Error('Empty group');
  return groups;
}
