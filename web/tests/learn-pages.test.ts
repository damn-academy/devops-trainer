// Static search-landing pages: the generator builds RU and EN HTML per topic
// into public/learn/, with canonical/hreflang pairs and matching sitemap URLs.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const web = join(__dirname, '..');
execFileSync('node', ['scripts/build-learn.mjs'], { cwd: web, stdio: 'pipe' });

const slugs = readdirSync(join(web, 'learn-src')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const read = (p: string) => readFileSync(join(web, p), 'utf8');

describe('search landing pages', () => {
  it('builds RU and EN pages for every topic source', () => {
    for (const slug of slugs) {
      for (const rel of [`public/learn/${slug}/index.html`, `public/en/learn/${slug}/index.html`]) {
        expect(() => read(rel), rel).not.toThrow();
      }
    }
  });

  it('links the language pair with canonical and hreflang', () => {
    for (const slug of slugs) {
      const ru = read(`public/learn/${slug}/index.html`);
      const en = read(`public/en/learn/${slug}/index.html`);
      expect(ru).toContain(`<link rel="canonical" href="https://damn.academy/learn/${slug}/" />`);
      expect(en).toContain(`<link rel="canonical" href="https://damn.academy/en/learn/${slug}/" />`);
      expect(ru).toContain('hreflang="en"');
      expect(en).toContain('hreflang="ru"');
      expect(ru).toContain('<html lang="ru">');
      expect(en).toContain('<html lang="en">');
      expect(ru).not.toContain('TODO(ru)');
      expect(en).not.toContain('TODO(ru)');
    }
  });

  it('carries social previews and article markup', () => {
    const html = read('public/learn/devops-basics/index.html');
    expect(html).toContain('property="og:image" content="https://damn.academy/og-image.png"');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"FAQPage"');
  });

  it('lists every topic in the sitemap', () => {
    const sitemap = read('public/sitemap.xml');
    for (const slug of slugs) {
      expect(sitemap).toContain(`<loc>https://damn.academy/learn/${slug}/</loc>`);
      expect(sitemap).toContain(`<loc>https://damn.academy/en/learn/${slug}/</loc>`);
    }
  });
});
