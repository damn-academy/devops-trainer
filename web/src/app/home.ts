// Home is the platform catalog: a short "what is this site" and tiles of
// professions and courses — the two structural units. A profession page
// carries the program of blocks (it used to be the home page).

import { clear, h, icon, put } from '../core/dom';
import { bi, count, t, UI } from '../core/i18n';
import { productById, visibleProducts, productRoute, type Product } from '../core/products';
import { registry } from '../core/registry';
import { ROUTE, type RouteEntry } from '../core/route';
import { href, navigate } from '../core/router';
import { store } from '../core/store';
import { LEVELS, type Block, type Level } from '../core/types';
import type { Page } from './common';
import { infoTip } from './common';
import { chosenLevel, lessonStatus, remainingShare, setDescription, setTitle } from './status';

// Level tiles double as the level picker: choosing here is the same record as
// the chooser on the block page, and it opens the block right away — there is
// no separate "continue" button to hunt for.
function levelsTable(b: Block, chosen: Level | undefined): HTMLElement {
  return h(
    'dl.levels',
    { role: 'radiogroup', 'aria-label': t(UI.chooseLevel) },
    ...LEVELS.map((l) =>
      h(
        'div.level',
        { class: chosen === l ? 'chosen' : undefined },
        h('dt', {},
          h('button.level-pick', {
            type: 'button',
            role: 'radio',
            'aria-checked': chosen === l ? 'true' : 'false',
            onclick: () => {
              store.record({ kind: 'level.set', block: b.id, level: l, via: 'choice' });
              navigate({ name: 'block', id: b.id });
            },
          }, t(UI.levels[l])),
          infoTip(b.levels[l])),
      ),
    ),
  );
}

function staticLevelsTable(levels: Record<Level, import('../core/i18n').Bi>): HTMLElement {
  return h(
    'dl.levels',
    {},
    ...LEVELS.map((l) => h('div.level', {}, h('dt', {}, t(UI.levels[l]), infoTip(levels[l])))),
  );
}

function blockItem(b: Block, entry: RouteEntry | undefined): HTMLElement {
  const lessons = b.lessons.map((id) => registry.lessons.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof registry.lessons.get>>[];
  const doneN = lessons.filter((l) => lessonStatus(l) === 'done').length;
  const started = !!store.state.placement[b.id]?.length || lessons.some((l) => lessonStatus(l) !== 'new');
  const chosen = chosenLevel(b.id);
  const hasPlacement = !!registry.placementCount(b.id);
  return h(
    'li.route-item',
    { 'data-block': b.id, class: doneN === lessons.length && lessons.length ? 'complete' : started ? 'started' : undefined },
    h('div.route-mark', { 'aria-hidden': 'true' }, h('span', {}, entry?.segment === 'F' ? '0' : entry?.segment ?? String(b.order))),
    h(
      'div.route-body',
      {},
      h('h2', {}, h('a', { href: href({ name: 'block', id: b.id }) }, t(b.title))),
      h(
        'p.route-meta',
        {},
        lessons.length ? h('span', {}, `${doneN} / ${count(lessons.length, ['урок', 'урока', 'уроков'], ['lesson', 'lessons'])}`) : null,
        b.beginnerOnly ? h('span.badge', {}, t(bi('Для первого знакомства', 'beginners only'))) : null,
      ),
      h('p.route-summary', {}, t(b.summary)),
      levelsTable(b, chosen),
      lessons.length && doneN === lessons.length ? h('p.route-done', {}, h('span.badge.ok', {}, '✓ ', t(UI.done))) : null,
      hasPlacement
        ? h(
            'div.route-actions',
            {},
            h('p.small.muted', {}, t(UI.checkLevelHint)),
            h('a.btn.ghost', { href: href({ name: 'placement', id: b.id }) }, icon('check'), t(UI.checkLevel)),
          )
        : null,
    ),
  );
}

function placeholderItem(e: RouteEntry): HTMLElement {
  return h(
    'li.route-item.placeholder',
    { 'data-block': e.id },
    h('div.route-mark', { 'aria-hidden': 'true' }, h('span', {}, e.segment === 'F' ? '0' : e.segment)),
    h(
      'div.route-body',
      {},
      h('h2', {}, t(e.title)),
      h('p.route-meta', {}, h('span.badge', {}, t(UI.comingSoon)), e.beginnerOnly ? h('span.badge', {}, t(bi('Для первого знакомства', 'beginners only'))) : null),
      h('p.route-summary', {}, t(e.summary)),
      staticLevelsTable(e.levels),
    ),
  );
}

export function professionPage(id: string): Page {
  const product = productById(id);
  if (!product || product.kind !== 'profession') {
    return { el: h('div.profession', {}, h('p.muted', {}, t(bi('Такой профессии пока нет.', 'There is no such profession yet.')))) };
  }
  setTitle(t(product.title));
  setDescription(t(product.summary));
  const root = h('div.home');
  const draw = () => {
    clear(root);
    const items = registry.routeMap();
    const anyProgress = Object.keys(store.state.lessons).length > 0;
    put(
      root,
      h(
        'section.hero',
        {},
        h('p.kicker', {}, t(bi('Профессия', 'A profession'))),
        h('h1', {}, t(product.title)),
        h(
          'p.lede',
          {},
          t(bi('Здравствуйте! Это damn.academy — платформа, где профессии и курсы проходятся с практикой на настоящих машинах, прямо в браузере. Цель этой профессии — научить вас выпускать изменения в работающие сервисы быстро и без сбоев: от первой команды в терминале до Kubernetes в облаке. За время обучения вы научитесь работать в командной строке Linux, собирать и выкладывать приложения, настраивать сети и контейнеры, запускать Kubernetes и замечать аварии раньше пользователей.', 'Welcome! This is damn.academy, a platform where professions and courses are taken with practice on real machines, right in the browser. The goal of this profession is to teach you to ship changes to running services quickly and without failures: from your first command in the terminal to Kubernetes in the cloud. Along the way you will learn the Linux command line, building and shipping applications, networks and containers, running Kubernetes, and noticing incidents before your users do.')),
        ),
        h(
          'ul.pillars',
          {},
          h('li', {}, h('strong', {}, t(bi('Учебник.', 'Textbook.'))), ' ', t(bi('Связная теория: термин появляется только после того, как его ввели.', 'Coherent theory: a term appears only after it has been introduced.'))),
          h('li', {}, h('strong', {}, t(bi('Процессы.', 'Processes.'))), ' ', t(bi('Схемы, которые вы ведёте сами: шаги, ручки, «сломайте».', 'Diagrams you drive yourself: steps, knobs, “break it”.'))),
          h('li', {}, h('strong', {}, t(bi('Документация.', 'Documentation.'))), ' ', t(bi('От «это отсюда» до экзамена, где открыта только она.', 'From “this is from” to an exam where it is all you have.'))),
        ),
        h(
          'p.how',
          {},
          t(bi('Обучение идёт на трёх уровнях — «Новичок», «Средний» и «Опытный»: выберите свой в каждом блоке. Сначала вы работаете в собранных окружениях по готовым рецептам, со временем — всё чаще самостоятельно, по документации. Виртуальный наставник отвечает прямо на страницах курса, на вашем собственном ключе. Для экспериментов поднимите локальное окружение у себя на машине или, что предпочтительнее, арендуйте виртуальные машины в облаке. Структура профессии собрана по чек-листу начинающего DevOps-инженера с сайта [devops413.io](https://devops413.io).', 'The course runs at three levels — Beginner, Intermediate and Experienced: pick yours in each block. At first you work in prepared environments following ready recipes; over time, more and more on your own, reading the documentation. A virtual mentor answers right on the course pages, using your own API key. For experiments, set up a local environment on your machine or, preferably, rent virtual machines in the cloud. The profession’s structure follows the beginner DevOps engineer checklist from devops413.io.')),
        ),
        paceControl(),
        anyProgress ? null : h('p.small.muted', {}, t(bi('Регистрация не нужна: прогресс сохраняется в этом браузере после каждого действия.', 'No sign-up: progress is saved in this browser after every action.'))),
      ),
      h('h2.route-title', {}, t(UI.map)),
      h('ol.route', {}, ...items.map((it) => (it.kind === 'block' ? blockItem(it.block, it.entry) : placeholderItem(it.entry)))),
    );
  };
  draw();
  return { el: root };
}

export function durationWeeks(hours: number, weekly: number): number {
  return Math.ceil(hours / Math.max(1, Math.min(168, weekly || 10)));
}

function paceControl(): HTMLElement {
  let weekly = 10;
  try { weekly = Number(localStorage.getItem('dt.weeklyHours')) || 10; } catch { /* Storage is optional. */ }
  const input = h('input', { type: 'number', min: 1, max: 168, value: weekly }) as HTMLInputElement;
  const output = h('p.time', { 'aria-live': 'polite' });
  const draw = () => {
    const hours = ROUTE.reduce((sum, entry) => sum + Math.ceil((registry.blocks.get(entry.id)?.hours ?? entry.hours)[chosenLevel(entry.id) ?? 'beginner'] * remainingShare(entry.id)), 0);
    output.textContent = t(bi('При выбранных уровнях курс займёт примерно ', 'At your chosen levels the course takes about ')) + count(hours, ['час', 'часа', 'часов'], ['hour', 'hours']) + ', ' + count(durationWeeks(hours, weekly), ['неделю', 'недели', 'недель'], ['week', 'weeks']) + '.';
  };
  input.addEventListener('input', () => {
    if (!input.validity.valid || !input.value) return;
    weekly = Number(input.value);
    try { localStorage.setItem('dt.weeklyHours', String(weekly)); } catch { /* Storage is optional. */ }
    draw();
  });
  draw();
  return h('div.pace', {}, h('label', {}, t(bi('Сколько часов в неделю вы готовы заниматься? ', 'How many hours a week can you study? ')), input), output);
}

function productTile(p: Product): HTMLElement {
  return h(
    'li.catalog-item',
    { 'data-kind': p.kind },
    h(
      'a.catalog-tile',
      { href: href(productRoute(p)) },
      h('span.catalog-kind', {}, t(p.kind === 'profession' ? bi('Профессия', 'Profession') : bi('Курс', 'Course'))),
      h('span.catalog-title', {}, t(p.title)),
      h('span.catalog-summary', {}, t(p.summary)),
    ),
  );
}

// Home: the platform catalog. A short explanation of what the site is, then
// professions and courses as tiles — each opens its own page.
export function homePage(): Page {
  setTitle();
  const professions = visibleProducts('profession');
  const courses = visibleProducts('course');
  return {
    el: h(
      'div.home.catalog',
      {},
      h(
        'section.hero',
        {},
        h('p.kicker', {}, t(bi('Учебная платформа', 'A learning platform'))),
        h('h1', {}, 'damn.academy'),
        h(
          'p.lede',
          {},
          t(bi('Интерактивные профессии и курсы с практикой на настоящих машинах: Linux прямо в браузере, облачные стенды, виртуальный наставник. Регистрация не нужна — прогресс хранится в вашем браузере.', 'Interactive professions and courses with practice on real machines: Linux right in the browser, cloud stands, a virtual mentor. No sign-up — progress stays in your browser.')),
        ),
      ),
      h(
        'section.catalog-section',
        {},
        h('h2', {}, t(bi('Профессии', 'Professions'))),
        h('p.small.muted', {}, t(bi('Большой путь к новой профессии: теория, практика на машинах, проверки уровня и экзамены.', 'A long road to a new profession: theory, practice on real machines, level checks and exams.'))),
        h('ul.catalog-grid', {}, ...professions.map(productTile)),
      ),
      h(
        'section.catalog-section',
        {},
        h('h2', {}, t(bi('Курсы', 'Courses'))),
        h('p.small.muted', {}, t(bi('Короткая прокачка одного отдельного навыка — без смены профессии.', 'A short way to train one specific skill — no career change involved.'))),
        courses.length ? h('ul.catalog-grid', {}, ...courses.map(productTile)) : h('p.small.muted', {}, t(bi('Курсы появятся чуть позже.', 'Courses are coming soon.'))),
      ),
    ),
  };
}
