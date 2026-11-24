// @vitest-environment jsdom
// The «?» help panel of the top bar and the #/local-lab page: the route
// round-trips, the panel opens with every section, closes on Esc and on
// navigation and gives focus back, and the lab page carries the requirements
// table, the three systems, the three ways out and either the download links
// or the build-from-source steps.

import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { href, parseRoute } from '../src/core/router';
import { MemoryBackend, store } from '../src/core/store';
import { closeHelp, helpButton, HELP_SECTIONS } from '../src/app/help';
import { assetUrl, DTLAB_RELEASE, guessOS, localLabPage } from '../src/app/local-lab';

const text = (el: Element) => (el.textContent ?? '').replace(/\u00a0/g, ' ');

beforeAll(async () => {
  await store.init(new MemoryBackend());
});

describe('local lab route', () => {
  it('parses and round-trips', () => {
    expect(parseRoute('#/local-lab')).toEqual({ name: 'local-lab' });
    expect(href({ name: 'local-lab' })).toBe('#/local-lab');
    expect(parseRoute('#/local-lab/x').name).toBe('notfound');
  });
});

describe('help panel', () => {
  it('opens with every section, closes on Esc and returns focus', () => {
    setLang('ru');
    const btn = helpButton();
    document.body.append(btn);
    expect(btn.textContent).toBe('?');
    expect(btn.getAttribute('aria-label')).toMatch(/справк/i);
    btn.click();
    const dialog = document.querySelector<HTMLDialogElement>('dialog.help-dialog')!;
    expect(dialog).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.querySelectorAll('.help-sec')).toHaveLength(HELP_SECTIONS.length);
    const words = text(dialog);
    for (const w of ['без логина и пароля', 'приватном окне', 'Перенести на другое устройство', 'Выгрузить прогресс', 'пока не планируется', 'Определить уровень', 'Мои сообщения', 'Спросить нейросеть', 'ничего нейросетям не отправляет'])
      expect(words).toContain(w);
    expect(dialog.querySelector('details.help-more summary')!.textContent).toBe('Подробнее');
    expect(dialog.querySelector<HTMLAnchorElement>('a[href="#/local-lab"]')).toBeTruthy();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('dialog.help-dialog')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
  });

  it('closes when the page changes and toggles from the button', () => {
    const btn = helpButton();
    document.body.append(btn);
    btn.click();
    expect(document.querySelector('dialog.help-dialog')).toBeTruthy();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.querySelector('dialog.help-dialog')).toBeNull();
    btn.click();
    btn.click();
    expect(document.querySelector('dialog.help-dialog')).toBeNull();
    closeHelp();
  });

  it('speaks English too', () => {
    setLang('en');
    const btn = helpButton();
    document.body.append(btn);
    btn.click();
    const en = text(document.querySelector('dialog.help-dialog')!);
    expect(en).toContain('without a login and password');
    expect(en).toContain('sends nothing to any AI');
    closeHelp();
    setLang('ru');
  });
});

describe('local lab page', () => {
  it('shows the requirements, the three systems and the ways out', () => {
    setLang('ru');
    const { el } = localLabPage();
    expect(el.querySelector('h1')!.textContent).toBe('Лаборатория на своём компьютере');
    const rows = el.querySelectorAll('#ll-needs tbody tr');
    expect(rows).toHaveLength(6);
    expect(text(rows[1])).toContain('2,6 ГиБ');
    expect([...el.querySelectorAll('details.ll-os')].map((d) => (d as HTMLElement).dataset.os).sort()).toEqual(['linux', 'macos', 'windows']);
    expect(el.querySelectorAll('details.ll-os[open]')).toHaveLength(1);
    const page = text(el);
    for (const cmd of ['winget install SoftwareFreedomConservancy.QEMU', 'brew install qemu', 'sudo apt install qemu-system-x86 qemu-utils ovmf', 'dtlab check', 'dtlab up --profile light', 'dtlab up --profile standard', 'dtlab facts cp-1', 'dtlab down', 'dtlab destroy', 'dtlab uninstall'])
      expect(page).toContain(cmd);
    expect(el.querySelectorAll('#ll-remove tbody tr')).toHaveLength(3);
  });

  it('builds from source until the release is published, and links the assets after', () => {
    const { el } = localLabPage();
    if (DTLAB_RELEASE.published) {
      expect(el.querySelector(`a[href="${assetUrl('dtlab-linux-amd64')}"]`)).toBeTruthy();
    } else {
      expect(text(el)).toContain('go build -o dtlab ./cmd/dtlab');
      expect(text(el)).toContain('появятся на этой странице');
      expect(el.querySelector('.ll-files')).toBeNull();
    }
    expect(assetUrl('dtlab-darwin-arm64')).toBe('https://github.com/damn-academy/devops-trainer/releases/latest/download/dtlab-darwin-arm64');
  });

  it('opens the instructions of the learner’s system first', () => {
    expect(guessOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(guessOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)')).toBe('macos');
    expect(guessOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('linux');
    expect(guessOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });
});
