// The resume builder (10 §9.6): a form whose every skill carries evidence,
// a live linter of ten rules, honest bridges from earlier experience, two
// language versions, export to JSON Resume and to plain text.

import { clear, downloadFile, h, icon, put, toast } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import { registry } from '../../../core/registry';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { PETS } from '../data/pets';
import { BRIDGES, emptyResume, lintResume, resumeReady, toJsonResume, toText, type Resume } from '../resume';
import { debounce, load, save } from './ui';

const R = {
  version: bi('Версия', 'Version'),
  name: bi('Имя', 'Name'),
  label: bi('Заголовок (целевая роль)', 'Headline (target role)'),
  summary: bi('О себе — два-три предложения', 'Summary — two or three sentences'),
  email: bi('Почта', 'E-mail'),
  github: bi('Профиль GitHub или GitLab', 'GitHub or GitLab profile'),
  skills: bi('Навыки', 'Skills'),
  skill: bi('Навык', 'Skill'),
  evidence: bi('Подтверждение', 'Evidence'),
  evidenceUrl: bi('или ссылка', 'or a link'),
  projects: bi('Проекты', 'Projects'),
  project: bi('Название проекта', 'Project name'),
  url: bi('Репозиторий', 'Repository'),
  highlights: bi('Что сделал — по пункту на строку: действие и результат', 'What you did — one bullet per line: action and result'),
  work: bi('Опыт работы', 'Experience'),
  company: bi('Компания', 'Company'),
  position: bi('Должность', 'Position'),
  years: bi('Годы', 'Years'),
  bridge: bi('Перевести в мост к DevOps', 'Rewrite as a bridge to DevOps'),
  bridgePick: bi('— подсказка: что вы делали на самом деле —', '— a prompt: what you really did —'),
  education: bi('Образование', 'Education'),
  personal: bi('В резюме есть', 'The CV includes'),
  photo: bi('фото', 'a photo'),
  age: bi('возраст', 'age'),
  family: bi('семейное положение', 'marital status'),
  devops: bi('Должность DevOps в опыте работы — моя настоящая работа', 'The DevOps position under work was a real job of mine'),
  add: bi('Добавить', 'Add'),
  remove: bi('Убрать', 'Remove'),
  lint: bi('Проверка', 'Check'),
  ready: bi('Ошибок нет: резюме можно отправлять', 'No errors: the CV can be sent'),
  notReady: bi('Есть ошибки: исправьте их перед отправкой', 'There are errors: fix them before sending'),
  json: bi('Скачать JSON Resume', 'Download JSON Resume'),
  copy: bi('Скопировать текстом', 'Copy as text'),
  copied: bi('Текст резюме скопирован', 'The CV text is copied'),
  none: bi('— выберите —', '— choose —'),
};

function evidenceOptions(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const [id, list] of Object.entries(store.state.exams)) {
    if (!list.some((x) => x.passed && x.mode === 'exam')) continue;
    const ex = registry.exams.get(id);
    out.push({ id: `exam:${id}`, label: `${t(bi('Экзамен', 'Exam'))}: ${ex ? t(ex.title) : id}` });
  }
  for (const p of PETS) out.push({ id: `pet:${p.id}`, label: `${t(bi('Пет-проект', 'Pet project'))} ${p.n}: ${t(p.title)}` });
  return out;
}

export const resumeWidget: WidgetReg = {
  id: 'career.resume',
  mount(el, _props, ctx): Mounted {
    const root = h('div.cw-resume');
    const lintBox = h('div.cw-lint', { 'aria-live': 'polite' });
    let lang: 'ru' | 'en' = 'ru';
    let r: Resume = emptyResume('ru');
    let keywords: string[] = [];
    void load<string[]>('vacancy.keywords').then((k) => (keywords = k ?? []));
    const persist = debounce(() => save(`resume.${lang}`, r), 300);
    const changed = () => {
      persist();
      drawLint();
    };

    const field = (labelB: typeof R.name, value: string, set: (v: string) => void, opts: { area?: boolean; placeholder?: string } = {}) => {
      const input = (opts.area ? h('textarea', { rows: 3, placeholder: opts.placeholder ?? '' }) : h('input', { type: 'text', placeholder: opts.placeholder ?? '' })) as HTMLInputElement | HTMLTextAreaElement;
      input.value = value;
      input.addEventListener('input', () => {
        set(input.value);
        changed();
      });
      return h('label.cw-field', {}, h('span', {}, t(labelB)), input);
    };
    const check = (labelB: typeof R.name, value: boolean, set: (v: boolean) => void) => {
      const box = h('input', { type: 'checkbox', checked: value }) as HTMLInputElement;
      box.addEventListener('change', () => {
        set(box.checked);
        changed();
      });
      return h('label.cw-check', {}, box, ' ', t(labelB));
    };
    const lines = (xs: string[]) => xs.join('\n');
    const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

    const draw = () => {
      clear(root);
      const evOpts = evidenceOptions();
      const skills = h('div.cw-list');
      r.skills.forEach((s, i) => {
        const sel = h('select', { 'aria-label': t(R.evidence) }, h('option', { value: '' }, t(R.none)), ...evOpts.map((o) => h('option', { value: o.id, selected: s.evidence[0] === o.id }, o.label))) as HTMLSelectElement;
        sel.addEventListener('change', () => {
          s.evidence = [sel.value, ...s.evidence.slice(1)].filter((x, k) => k > 0 || x);
          changed();
        });
        const url = h('input', { type: 'url', placeholder: 'https://github.com/…', 'aria-label': t(R.evidenceUrl) }) as HTMLInputElement;
        url.value = s.evidence.find((e) => /^https?:/.test(e)) ?? '';
        url.addEventListener('input', () => {
          s.evidence = [...s.evidence.filter((e) => !/^https?:/.test(e)), url.value].filter(Boolean);
          changed();
        });
        skills.append(h('div.cw-item', {}, field(R.skill, s.name, (v) => (s.name = v)), h('label.cw-field', {}, h('span', {}, t(R.evidence)), sel), h('label.cw-field', {}, h('span', {}, t(R.evidenceUrl)), url), h('button.btn.ghost.small', { type: 'button', onclick: () => (r.skills.splice(i, 1), changed(), draw()) }, t(R.remove))));
      });
      const projects = h('div.cw-list');
      r.projects.forEach((p, i) =>
        projects.append(h('div.cw-item', {}, field(R.project, p.name, (v) => (p.name = v)), field(R.url, p.url, (v) => (p.url = v), { placeholder: 'https://github.com/…' }), field(R.highlights, lines(p.highlights), (v) => (p.highlights = split(v)), { area: true }), h('button.btn.ghost.small', { type: 'button', onclick: () => (r.projects.splice(i, 1), changed(), draw()) }, t(R.remove)))),
      );
      const work = h('div.cw-list');
      r.work.forEach((w, i) => {
        const hl = field(R.highlights, lines(w.highlights), (v) => (w.highlights = split(v)), { area: true });
        const pick = h('select', { 'aria-label': t(R.bridgePick) }, h('option', { value: '' }, t(R.bridgePick)), ...BRIDGES.map((b, k) => h('option', { value: String(k) }, `${t(b.from)} → ${t(b.to)}`))) as HTMLSelectElement;
        pick.addEventListener('change', () => {
          const b = BRIDGES[Number(pick.value)];
          if (!b) return;
          w.highlights = [...w.highlights, t(b.to)];
          w.bridge = true;
          changed();
          draw();
          toast(t(b.why));
        });
        work.append(h('div.cw-item', {}, field(R.company, w.company, (v) => (w.company = v)), field(R.position, w.position, (v) => (w.position = v)), field(R.years, w.years, (v) => (w.years = v)), check(R.bridge, w.bridge, (v) => (w.bridge = v)), pick, hl, h('button.btn.ghost.small', { type: 'button', onclick: () => (r.work.splice(i, 1), changed(), draw()) }, t(R.remove))));
      });
      const langSwitch = h('div.cw-tabs', { role: 'tablist', 'aria-label': t(R.version) }, ...(['ru', 'en'] as const).map((l) => h('button.cw-tab', { type: 'button', role: 'tab', 'aria-selected': l === lang ? 'true' : 'false', onclick: () => void switchLang(l) }, l.toUpperCase())));
      put(
        root,
        langSwitch,
        h('div.cw-grid', {}, field(R.name, r.name, (v) => (r.name = v)), field(R.label, r.label, (v) => (r.label = v), { placeholder: 'Junior DevOps Engineer' }), field(R.email, r.email, (v) => (r.email = v)), field(R.github, r.github, (v) => (r.github = v), { placeholder: 'https://github.com/…' })),
        field(R.summary, r.summary, (v) => (r.summary = v), { area: true }),
        h('h4', {}, t(R.skills)),
        skills,
        h('button.btn.ghost.small', { type: 'button', onclick: () => (r.skills.push({ name: '', evidence: [] }), changed(), draw()) }, icon('next'), t(R.add)),
        h('h4', {}, t(R.projects)),
        projects,
        h('button.btn.ghost.small', { type: 'button', onclick: () => (r.projects.push({ name: '', url: '', highlights: [] }), changed(), draw()) }, icon('next'), t(R.add)),
        h('h4', {}, t(R.work)),
        work,
        h('button.btn.ghost.small', { type: 'button', onclick: () => (r.work.push({ company: '', position: '', years: '', bridge: false, highlights: [] }), changed(), draw()) }, icon('next'), t(R.add)),
        field(R.education, r.education, (v) => (r.education = v)),
        h('fieldset.cw-personal', {}, h('legend', {}, t(R.personal)), check(R.photo, r.photo, (v) => (r.photo = v)), check(R.age, r.age, (v) => (r.age = v)), check(R.family, r.family, (v) => (r.family = v))),
        check(R.devops, r.devopsJobConfirmed, (v) => (r.devopsJobConfirmed = v)),
        lintBox,
        h(
          'div.row',
          {},
          h('button.btn', { type: 'button', onclick: () => downloadFile(`resume-${lang}.json`, JSON.stringify(toJsonResume(r), null, 2)) }, icon('download'), t(R.json)),
          h('button.btn.ghost', {
            type: 'button',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(toText(r));
                toast(t(R.copied));
              } catch {
                downloadFile(`resume-${lang}.txt`, toText(r), 'text/plain');
              }
            },
          }, icon('copy'), t(R.copy)),
        ),
      );
      drawLint();
    };

    let readySeen = false;
    const drawLint = () => {
      const issues = lintResume(r, keywords);
      const ready = resumeReady(issues);
      if (ready && !readySeen) {
        readySeen = true;
        store.record({ kind: 'x.career.resume', lang, ready: true });
        ctx.complete();
      }
      clear(lintBox);
      put(
        lintBox,
        h('h4', {}, t(R.lint), ' ', h('span', { class: ready ? 'cw-mark ok' : 'cw-mark warn' }, ready ? `✓ ${t(R.ready)}` : t(R.notReady))),
        h(
          'ul.cw-issues',
          {},
          ...issues.map((i) => h('li', { class: i.ok ? 'ok' : i.level }, h('span.st-icon', { 'aria-hidden': 'true' }, i.ok ? '✓' : i.level === 'error' ? '⨯' : '!'), h('span.cw-rule', {}, `${i.id}. ${t(i.rule)}`), i.say ? h('span.small.muted', {}, ` — ${t(i.say)}`) : null)),
        ),
      );
    };

    const switchLang = async (l: 'ru' | 'en') => {
      lang = l;
      r = (await load<Resume>(`resume.${l}`)) ?? emptyResume(l);
      r.lang = l;
      draw();
    };

    clear(el);
    el.append(root);
    draw();
    void switchLang('ru');
    return { dispose: () => clear(el), describe: () => t(bi('Конструктор резюме', 'Resume builder')) };
  },
};
