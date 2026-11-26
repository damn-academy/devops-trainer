import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A JSON-LD block left open once swallowed the viewport and every meta tag
// after it, so phones rendered the desktop layout at 40 % scale.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const scripts = [...head.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

describe('index.html head', () => {
  it('parses every JSON-LD block as JSON', () => {
    const ld = scripts.filter((m) => m[0].startsWith('<script type="application/ld+json"'));
    expect(ld.length).toBeGreaterThanOrEqual(3);
    for (const m of ld) expect(() => JSON.parse(m[1]!)).not.toThrow();
  });
  it('keeps the meta tags outside scripts', () => {
    const outside = head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    for (const tag of ['name="viewport"', 'name="description"', 'property="og:title"', '<title>']) expect(outside).toContain(tag);
    for (const m of scripts) expect(m[1]).not.toMatch(/<meta\b|<title>/);
  });
});
