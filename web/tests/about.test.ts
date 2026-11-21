// @vitest-environment jsdom
// The «Справка» section (#/about): the route round-trips, every page renders
// in both languages with the shared navigation, every in-course link points
// to a route that exists, the diagram of «How it is built» opens a card for
// each element, the «?» panel, the footer and Settings link here, and the
// Russian text passes the heuristic style linter of STYLE-RU.md.

import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { href, parseRoute } from '../src/core/router';
import { MemoryBackend, store } from '../src/core/store';
import { ABOUT_PAGES, aboutHref, aboutPage, tiersDiagram } from '../src/app/about';
import { REPO } from '../src/app/about-content';
import { closeHelp, helpButton } from '../src/app/help';
import { lintRuStyle } from '../scripts/lint-ru-style.mjs';

const text = (el: Element) => (el.textContent ?? '').replace(/ /g, ' ');

beforeAll(async () => {
  await store.init(new MemoryBackend());
});

describe('about route', () => {
  it('parses and round-trips', () => {
    expect(parseRoute('#/about')).toEqual({ name: 'about' });
    expect(parseRoute('#/about/deploy')).toEqual({ name: 'about', page: 'deploy' });
    expect(href({ name: 'about' })).toBe('#/about');
    expect(href({ name: 'about', page: 'how' })).toBe('#/about/how');
    expect(aboutHref('what')).toBe('#/about');
    expect(aboutHref('contribute')).toBe('#/about/contribute');
    expect(parseRoute('#/about/a/b').name).toBe('notfound');
  });
});

describe('about pages', () => {
  for (const lang of ['ru', 'en'] as const) {
    it(`render every page in ${lang}`, () => {
      setLang(lang);
      for (const pg of ABOUT_PAGES) {
        const { el } = aboutPage(pg.id === 'what' ? undefined : pg.id);
        document.body.replaceChildren(el);
        expect(el.querySelector('h1')!.textContent).toBe(pg.title[lang]);
        const tabs = [...el.querySelectorAll<HTMLAnchorElement>('.ab-nav a')];
        expect(tabs).toHaveLength(ABOUT_PAGES.length);
        expect(el.querySelector('.ab-nav a[aria-current="page"]')!.getAttribute('data-page')).toBe(pg.id);
        expect(el.querySelectorAll('.ab-sec')).toHaveLength(pg.sections.length);
        for (const s of pg.sections) expect(el.querySelector(`#ab-${s.id} h2`)!.textContent).toBe(s.title[lang]);
        // Every in-course link leads to a route that exists.
        for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
          const r = parseRoute(a.getAttribute('href')!);
          expect(r.name, a.getAttribute('href')!).not.toBe('notfound');
          if (r.name === 'about' && r.page) expect(ABOUT_PAGES.map((x) => x.id)).toContain(r.page);
        }
        for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) expect(a.href).toMatch(/^https:\/\/github\.com\/tym83\//);
        // Cyrillic stays on the Russian side.
        if (lang === 'en') expect(text(el).replace(/«[^»]*»|“[^”]*”|`[^`]*`/g, '')).not.toMatch(/[а-яё]{4,}/i);
      }
    });
  }

  it('says what was asked for', () => {
    setLang('ru');
    const all = ABOUT_PAGES.map((pg) => {
      const { el } = aboutPage(pg.id);
      return text(el);
    }).join('\n');
    for (const w of ['Apache-2.0', 'tym83/devops-trainer', 'Новичок', 'Лестница документации', 'Мои сообщения', 'Перенести на другое устройство', 'dt.facts/v1', 'v86', 'kube-lite', 'api.cloud.lab', 'git.lab', 'kuberoot', 'RV64', 'экспериментальный', 'Cross-Origin-Embedder-Policy', 'ADMIN_TOKEN', 'ALLOWED_ORIGINS', 'npm ci', 'STYLE-RU.md', 'lint:explainers', 'lint-ru-style', '--signoff', 'kind: Deployment'])
      expect(all).toContain(w);
    expect(REPO).toBe('https://github.com/tym83/devops-trainer');
  });

  it('shows an empty state for an unknown page', () => {
    setLang('ru');
    const { el } = aboutPage('nope');
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector<HTMLAnchorElement>('a[href="#/about"]')).toBeTruthy();
  });

  it('puts the diagram on «How it is built» and opens a card for every element', () => {
    setLang('ru');
    const { el } = aboutPage('how');
    document.body.replaceChildren(el);
    const dg = el.querySelector('.ab-diagram')!;
    expect(dg).toBeTruthy();
    expect(el.querySelectorAll('.ab-diagram')).toHaveLength(1);
    const nodes = [...dg.querySelectorAll<HTMLButtonElement>('button.ab-node')];
    expect(nodes.length).toBeGreaterThanOrEqual(15);
    for (const b of nodes) {
      b.click();
      expect(b.getAttribute('aria-pressed')).toBe('true');
      expect(dg.querySelectorAll('button.ab-node[aria-pressed="true"]')).toHaveLength(1);
      const card = dg.querySelector('.ab-card')!;
      expect(card.querySelector('h3')!.textContent).toBe(b.textContent);
      expect(text(card.querySelector('p')!).length).toBeGreaterThan(60);
    }
    expect(dg.querySelector('[data-node="rv64"]')!.classList.contains('ab-exp')).toBe(true);
    for (const l of dg.querySelectorAll('.ab-link')) expect(text(l).trim().length).toBeGreaterThan(5);
  });

  it('builds the diagram in English too', () => {
    setLang('en');
    expect(text(tiersDiagram())).toContain('The browser tab');
  });
});

describe('links to the section', () => {
  it('the «?» panel ends with a link to the full help', () => {
    setLang('ru');
    const btn = helpButton();
    document.body.replaceChildren(btn);
    btn.click();
    const dialog = document.querySelector('dialog.help-dialog')!;
    expect(dialog.querySelector('[data-help="about"] a.btn[href="#/about"]')).toBeTruthy();
    expect(dialog.querySelector('a[href="#/about/deploy"]')).toBeTruthy();
    closeHelp();
  });
});

describe('Russian style', () => {
  it('passes the heuristic linter of STYLE-RU.md', () => {
    const strings: string[] = [];
    for (const pg of ABOUT_PAGES) {
      strings.push(pg.nav.ru, pg.title.ru, pg.lede.ru);
      for (const s of pg.sections) strings.push(s.title.ru, ...s.body.ru.split('\n\n').filter((x) => !x.startsWith('```')));
    }
    const findings = strings.flatMap((s) => (lintRuStyle(s) as { sentence: string; rules: string[] }[]).map((f) => `${f.rules.join(',')}: ${f.sentence}`));
    expect(findings).toEqual([]);
  });
});
