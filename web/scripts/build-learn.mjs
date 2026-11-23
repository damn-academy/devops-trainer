#!/usr/bin/env node
// Builds static search-landing pages from web/learn-src/*.json into
// web/public/learn/<slug>/index.html (ru) and /en/learn/<slug>/index.html.
// The SPA stays untouched; these pages give search engines crawlable text
// and hand learners over to the trainer for the interactive part.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'learn-src');
const outRoot = join(root, 'public');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(p) {
  const { slug, lang, title, description, h1, intro, sections, links, faq, alternate, ogImage, blocks } = p;
  const base = lang === 'en' ? `https://damn.academy/en/learn/${slug}/` : `https://damn.academy/learn/${slug}/`;
  const other = alternate ? `https://damn.academy${alternate}` : null;
  const langSwitch = other ? `<a href="${other}">${lang === 'en' ? 'Русская версия' : 'English version'}</a>` : '';
  const faqJson = faq?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;
  const crumbsJson = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'DevOps Trainer', item: 'https://damn.academy/' },
      { '@type': 'ListItem', position: 2, name: h1, item: base },
    ],
  };
  const articleJson = {
    '@context': 'https://schema.org', '@type': 'Article', inLanguage: lang, headline: h1, description,
    url: base, image: ogImage,
    author: { '@type': 'Organization', name: 'damn.academy', url: 'https://damn.academy/' },
    publisher: { '@type': 'Organization', name: 'damn.academy', url: 'https://damn.academy/' },
  };
  const jsonLd = [articleJson, faqJson, crumbsJson].filter(Boolean);
  const sectionHtml = (sections ?? []).map((s) => `<section><h2>${esc(s.h2)}</h2>${s.body.map((b) => `<p>${esc(b)}</p>`).join('\n')}</section>`).join('\n');
  const linksHtml = links?.length
    ? `<section class="cta"><h2>${lang === 'en' ? 'Practice it in the trainer' : 'Потренироваться в тренажёре'}</h2><p>${lang === 'en'
        ? 'Reading is one thing. The course gives you a real machine for each topic — type the commands yourself, break things and fix them.'
        : 'Читать — одно. В курсе по каждой теме есть настоящая машина: команды вы набираете сами, ломаете и чините.'}</p><ul>${links
        .map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></section>`
    : '';
  const faqHtml = faq?.length
    ? `<section class="faq"><h2>${lang === 'en' ? 'Frequently asked questions' : 'Частые вопросы'}</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}</section>`
    : '';
  const blocksHtml = blocks?.length
    ? `<section><h2>${lang === 'en' ? 'What this block covers' : 'Что входит в блок'}</h2><ol>${blocks.map((b) => `<li>${esc(b)}</li>`).join('')}</ol></section>`
    : '';
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#353a6e" />
    <link rel="canonical" href="${base}" />
    <link rel="alternate" hreflang="${lang === 'en' ? 'en' : 'ru'}" href="${base}" />
    ${other ? `<link rel="alternate" hreflang="${lang === 'en' ? 'ru' : 'en'}" href="${other}" />` : ''}
    ${other ? `<link rel="alternate" hreflang="x-default" href="${lang === 'en' ? other : base}" />` : ''}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="DevOps Trainer" />
    <meta property="og:url" content="${base}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <title>${esc(title)}</title>
    <style>
      :root { --bg: oklch(0.975 0.008 85); --surface: oklch(0.99 0.005 85); --ink: oklch(0.24 0.015 260); --ink-2: oklch(0.4 0.015 260); --muted: oklch(0.52 0.012 260); --line: oklch(0.88 0.01 85); --accent: #353a6e; }
      @media (prefers-color-scheme: dark) { :root { --bg: oklch(0.2 0.01 260); --surface: oklch(0.25 0.012 260); --ink: oklch(0.92 0.012 85); --ink-2: oklch(0.8 0.012 85); --muted: oklch(0.68 0.012 260); --line: oklch(0.33 0.012 260); } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.65 Georgia, 'Times New Roman', serif; }
      main { max-width: 42em; margin: 0 auto; padding: 32px 20px 64px; }
      nav.top { display: flex; gap: 16px; align-items: baseline; font: 15px/1.4 system-ui, sans-serif; padding: 16px 20px; max-width: 42em; margin: 0 auto; }
      nav.top a { color: var(--accent); text-decoration: none; }
      nav.top .lang { margin-left: auto; }
      h1 { font: 700 2rem/1.2 system-ui, sans-serif; letter-spacing: -0.01em; margin: 24px 0 8px; }
      .lede { font-size: 1.15em; color: var(--ink-2); margin: 0 0 28px; }
      h2 { font: 650 1.3rem/1.3 system-ui, sans-serif; margin: 36px 0 8px; }
      p { margin: 0 0 14px; }
      ol li, ul li { margin: 6px 0; }
      .cta { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px 24px; margin-top: 40px; }
      .cta h2 { margin-top: 0; }
      .cta a { color: var(--accent); font-weight: 600; }
      details { border: 1px solid var(--line); border-radius: 8px; padding: 10px 16px; margin: 10px 0; }
      summary { cursor: pointer; font-weight: 600; font-family: system-ui, sans-serif; }
      footer { border-top: 1px solid var(--line); margin-top: 48px; padding-top: 16px; font: 14px/1.5 system-ui, sans-serif; color: var(--muted); }
      footer a { color: var(--accent); }
    </style>
    ${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n    ')}
  </head>
  <body>
    <nav class="top"><a href="/">DevOps Trainer</a>${langSwitch ? `<a class="lang" href="${other}">${langSwitch}</a>` : ''}</nav>
    <main>
      <h1>${esc(h1)}</h1>
      <p class="lede">${esc(intro)}</p>
      ${sectionHtml}
      ${blocksHtml}
      ${linksHtml}
      ${faqHtml}
      <footer>${lang === 'en'
        ? 'Free interactive DevOps course: real Linux in the browser, a cloud in a tab, quizzes and exams. <a href="/">Open the trainer</a> · <a href="https://github.com/damn-academy/devops-trainer">Source on GitHub</a> (Apache-2.0).'
        : 'Бесплатный интерактивный курс по DevOps: настоящий Linux в браузере, облако во вкладке, квизы и экзамены. <a href="/">Открыть тренажёр</a> · <a href="https://github.com/damn-academy/devops-trainer">Исходники на GitHub</a> (Apache-2.0).'}</footer>
    </main>
  </body>
</html>
`;
}

const built = [];
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json'))) {
  const spec = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  for (const lang of ['ru', 'en']) {
    const c = spec[lang];
    if (!c) continue;
    const rel = lang === 'en' ? `en/learn/${spec.slug}` : `learn/${spec.slug}`;
    const out = join(outRoot, rel, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, page({
      slug: spec.slug, lang,
      title: c.title, description: c.description, h1: c.h1, intro: c.intro,
      sections: c.sections, links: spec.courseLinks?.map((l) => ({ href: l.href, label: l[lang] ?? l.ru })),
      faq: c.faq, blocks: c.blocks,
      alternate: lang === 'en' ? `/learn/${spec.slug}/` : `/en/learn/${spec.slug}/`,
      ogImage: 'https://damn.academy/og-image.png',
    }));
    built.push(`/${rel}/`);
  }
}
console.log(`built ${built.length} pages:\n${built.join('\n')}`);
