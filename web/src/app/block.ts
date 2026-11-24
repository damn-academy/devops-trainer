// Block page (levels, lessons, explainers) and the placement check
// "show what you already know" (01 §4.1): practice is checked by state, a
// correct answer marked "guessing" does not count, the threshold is 80% and
// every key task; the level is never lowered silently — the learner chooses.

import { clear, h, icon, put } from '../core/dom';
import { bi, count, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href, navigate } from '../core/router';
import { store } from '../core/store';
import { LEVELS, type Block, type Level, type Mounted, type PlacementTask } from '../core/types';
import { renderInline } from '../core/markdown';
import { mountQuiz } from '../engine/quiz/render';
import { chosenLevel, conceptLink, emptyState, infoTip, setDescription, setTitle, sourcesBlock, type Page } from './common';
import { examsOfBlock } from './exam-page';
import { lessonStatus, placementDisposition, remainingShare } from './status';
import { mountLab } from './terminal-section';
import { crumbProfession } from './common';

function levelChooser(b: Block, onChange: () => void): HTMLElement {
  const current = chosenLevel(b.id);
  return h(
    'div.level-chooser',
    { role: 'radiogroup', 'aria-label': t(UI.chooseLevel) },
    ...LEVELS.map((l) =>
      h(
        'button.level-card',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': current === l ? 'true' : 'false',
          onclick: () => {
            store.record({ kind: 'level.set', block: b.id, level: l, via: 'choice' });
            onChange();
          },
        },
        h('span.level-name', {}, t(UI.levels[l]), infoTip(b.levels[l])),
      ),
    ),
  );
}

export function blockPage(id: string): Page {
  const b = registry.blocks.get(id);
  if (!b) {
    const entry = registry.routeMap().find((x) => x.kind === 'placeholder' && x.entry.id === id);
    if (entry && entry.kind === 'placeholder') return { el: emptyState(entry.entry.title, UI.comingSoon, { label: UI.backHome, href: href({ name: 'home' }) }) };
    return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  }
  setTitle(t(b.title));
  setDescription(t(b.summary));
  const root = h('div.block-page');
  const draw = () => {
    clear(root);
    const lessons = b.lessons.map((x) => registry.lessons.get(x)).filter(Boolean) as NonNullable<ReturnType<typeof registry.lessons.get>>[];
    const explainers = [...registry.explainers.values()].filter((e) => e.block === b.id);
    const last = store.state.placement[b.id]?.slice(-1)[0];
    const remaining = lessons.filter(l => lessonStatus(l) !== 'done');
    const nextBlock = registry.orderedBlocks(false).find(block => block.order > b.order);
    const continueTarget = remaining[0] ? href({ name: 'lesson', id: remaining[0].id }) : nextBlock ? href({ name: 'block', id: nextBlock.id }) : href({ name: 'home' });
    put(
      root,
      h(
        'header.block-head',
        {},
        h('nav.crumbs', {}, crumbProfession()),
        h('h1', {}, t(b.title)),
        h('p.lede', {}, t(b.summary)),
      ),
      h('section', {}, h('h2', {}, t(UI.chooseLevel)), levelChooser(b, draw)),
      last ? h('section.placement-progress', {}, h('p', {}, t(bi('Осталось пройти ', 'Remaining: ')), count(remaining.length, ['урок', 'урока', 'уроков'], ['lesson', 'lessons']), b.hours ? `, ≈ ${Math.ceil(b.hours[chosenLevel(b.id) ?? 'beginner'] * remainingShare(b.id))} ${t(UI.hours)}.` : '.'), h('a.btn.primary', { href: continueTarget }, remaining.length ? t(UI.continue) : t(bi('К следующему блоку', 'Next block')))) : null,
      b.placement.length
        ? h(
            'section.placement-entry',
            {},
            h('p', {}, t(bi('Выберите уровень проверки. На следующей странице указано число заданий для каждого уровня.', 'A short check confirms your choice: 5–10 tasks; practice is checked by the state of the machine.'))),
            // TODO(ru): the Russian wording below is an English placeholder until the owner supplies the final text.
            h('p.small.muted', {}, t(bi('TODO(ru): Not sure which level to choose? Take the check and we will recommend one.', 'Not sure which level to choose? Take the check and we will recommend one.'))),
            last ? h('p.muted.small', {}, `${t(bi('Последняя проверка', 'Last check'))}: ${t(UI.levels[last.claimed])} — ${last.passed ? t(bi('пройдена', 'passed')) : t(bi('не пройдена', 'not passed'))}, ${Math.round(last.score * 100)}%`) : null,
            h('a.btn.ghost', { href: href({ name: 'placement', id: b.id }) }, icon('check'), t(UI.checkLevel)),
          )
        : null,
      h(
        'section',
        {},
        h('h2', {}, t(UI.lessons)),
        h(
          'ol.lesson-list',
          {},
          ...lessons.map((l) => {
            const st = lessonStatus(l);
            return h(
              'li',
              { class: `st-${st}` },
              h('span.lesson-mark', { 'aria-hidden': 'true' }, st === 'done' ? '✓' : st === 'open' ? '◐' : ''),
              h(
                'div',
                {},
                h('a', { href: href({ name: 'lesson', id: l.id }) }, t(l.title)),
                ' ',
                placementDisposition(l) ? h('span.badge', {}, t(placementDisposition(l) === 'covered' ? bi('Зачтено проверкой. Можно пропустить.', 'Covered by placement. You may skip.') : placementDisposition(l) === 'required' ? bi('Обязательный урок по итогам проверки.', 'Required after placement.') : bi('Можно пройти по желанию.', 'Optional.'))) : null,
                l.tier !== 'core' ? h('span.badge.tier', {}, t(UI.tiers[l.tier])) : null,
                l.summary ? h('p.small.muted', {}, ...renderInline(t(l.summary))) : null,
                l.introduces.length ? h('p.small', {}, h('span.k', {}, t(UI.introduces)), ' ', ...l.introduces.flatMap((c, i) => [i ? ', ' : '', conceptLink(c)])) : null,
              ),
            );
          }),
        ),
      ),
      explainers.length
        ? h(
            'section',
            {},
            h('h2', {}, t(bi('Интерактивные схемы из уроков', 'Interactive diagrams from the lessons'))),
            h('ul.explainer-list', {}, ...explainers.map((e) => h('li', {}, h('a', { href: href({ name: 'explainer', id: e.id }) }, t(e.title)), e.summary ? h('span.muted', {}, ' — ', ...renderInline(t(e.summary))) : null))),
          )
        : null,
      examsOfBlock(b.id).length ? h('section.row', {}, ...examsOfBlock(b.id).map((ex) => h('a.btn', { href: href({ name: 'exam', id: ex.id }) }, icon('doc'), t(ex.title)))) : null,
      sourcesBlock(b.sources),
    );
  };
  draw();
  return { el: root };
}

interface Result {
  task: PlacementTask;
  pass: boolean;
}

export function placementPage(id: string): Page {
  const b = registry.blocks.get(id);
  if (!b || !b.placement.length) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(UI.checkLevel), t(b.title));
  const root = h('div.placement');
  const mounts: Mounted[] = [];
  const claimable = LEVELS.filter((l) => b.placement.some((p) => p.level === l));

  const chooseClaim = () => {
    clear(root);
    root.append(
      h('nav.crumbs', {}, h('a', { href: href({ name: 'block', id: b.id }) }, t(b.title))),
      h('h1', {}, t(UI.checkLevel)),
      h('p.lede', {}, t(bi('Выберите уровень, который хотите подтвердить. Подсказок и наставника на проверке нет.', 'Choose the level you want to confirm. There are no hints and no mentor during the check.'))),
      h('div.level-chooser', {}, ...claimable.map((l) => h('button.level-card', { type: 'button', onclick: () => run(l) }, h('span.level-name', {}, t(UI.levels[l]), infoTip(b.levels[l]))))),
    );
  };

  const run = (claimed: Level) => {
    clear(root);
    mounts.splice(0).forEach((m) => m.dispose());
    const tasks = b.placement.filter((p) => p.level === claimed);
    const results = new Map<string, Result>(tasks.map((p) => [p.id, { task: p, pass: false }]));
    const list = h('ol.placement-tasks');
    tasks.forEach((p, i) => {
      const host = h('div');
      list.append(h('li.placement-task', {}, h('p.small.muted', {}, `${i + 1} / ${tasks.length}${p.key ? ' · ' + t(bi('ключевое', 'key')) : ''}`), host));
      if (p.kind === 'quiz') {
        mounts.push(
          mountQuiz(host, p.item, {
            context: 'placement',
            feedback: false,
            onAnswered: (g) => {
              const conf = store.state.quiz[p.item.id]?.confidence.slice(-1)[0] ?? 1;
              results.get(p.id)!.pass = g.correct && conf > 1;
            },
          }),
        );
      } else {
        mounts.push(
          mountLab(host, {
            key: `placement/${b.id}/${p.id}`,
            setup: p.setup,
            tasks: [p.task],
            level: claimed,
            block: b.id,
            index: 0,
            count: 1,
            exam: true,
            onTaskPass: () => (results.get(p.id)!.pass = true),
          }),
        );
      }
    });
    const finish = h('button.btn.primary', { type: 'button' }, t(bi('Завершить проверку', 'Finish the check')));
    finish.addEventListener('click', () => done(claimed, [...results.values()]));
    root.append(h('h1', {}, `${t(UI.checkLevel)}: ${t(UI.levels[claimed])}`), list, finish);
  };

  const done = (claimed: Level, results: Result[]) => {
    mounts.splice(0).forEach((m) => m.dispose());
    const score = results.length ? results.filter((r) => r.pass).length / results.length : 0;
    const keysOk = results.every((r) => !r.task.key || r.pass);
    const passed = score >= 0.8 && keysOk;
    const failed = results.filter((r) => !r.pass);
    const concepts = [...new Set(results.flatMap((r) => r.task.concepts))];
    const gaps = [...new Set(failed.flatMap((r) => r.task.concepts))];
    store.record({ kind: 'placement.result', block: b.id, claimed, passed, score, failed: failed.map((r) => r.task.id), concepts, gaps });
    if (passed) store.record({ kind: 'level.set', block: b.id, level: claimed, via: 'placement' });
    clear(root);
    const lower = LEVELS[Math.max(0, LEVELS.indexOf(claimed) - 1)];
    root.append(
      h('h1', {}, passed ? t(bi('Уровень подтверждён', 'Level confirmed')) : t(bi('Пока не подтверждён', 'Not confirmed yet'))),
      h('p.lede', {}, `${Math.round(score * 100)}% · ${keysOk ? t(bi('все ключевые задания выполнены', 'all key tasks done')) : t(bi('не все ключевые задания выполнены', 'not all key tasks done'))}`),
      h(
        'ul.placement-results',
        {},
        ...results.map((r) => h('li', { class: r.pass ? 'ok' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, r.pass ? '✓' : '⨯'), r.task.kind === 'quiz' ? t(r.task.item.prompt) : t(r.task.task.prompt))),
      ),
      passed
        ? h('a.btn.primary', { href: href({ name: 'block', id: b.id }) }, t(UI.continue), icon('next'))
        : h(
            'div.placement-choice',
            {},
            h('p', {}, t(bi('Выберите сами, как идти дальше:', 'Choose how to go on:'))),
            lower !== claimed
              ? h(
                  'button.btn',
                  {
                    type: 'button',
                    onclick: () => {
                      store.record({ kind: 'level.set', block: b.id, level: lower, via: 'choice' });
                      navigate({ name: 'block', id: b.id });
                    },
                  },
                  `${t(bi('Блок на уровне', 'The block at'))} «${t(UI.levels[lower])}»`,
                )
              : null,
            h(
              'button.btn.ghost',
              {
                type: 'button',
                onclick: () => {
                  store.record({ kind: 'level.set', block: b.id, level: claimed, via: 'choice' });
                  navigate({ name: 'block', id: b.id });
                },
              },
              `${t(bi('Остаться на уровне', 'Stay at'))} «${t(UI.levels[claimed])}» ${t(bi('и пройти уроки по пробелам', 'and take the lessons on the gaps'))}`,
            ),
            gaps.length ? h('p.small', {}, h('span.k', {}, t(bi('Пробелы', 'Gaps'))), ' ', ...gaps.flatMap((c, i) => [i ? ', ' : '', conceptLink(c)])) : null,
            h('p.small.muted', {}, t(bi('Повторить проверку другим вариантом можно через 72 часа.', 'You can retake the check with another variant in 72 hours.'))),
          ),
    );
  };

  if (claimable.length === 1) run(claimable[0]);
  else chooseClaim();
  return { el: root, dispose: () => mounts.forEach((m) => m.dispose()) };
}
