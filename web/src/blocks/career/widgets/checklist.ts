// Checklists the learner keeps: the pet projects with their acceptance
// criteria (10 §10) and the capstone plan (10 §6.5). Ticks are saved in this
// browser and logged as events; the learner's level highlights what is
// required.

import { clear, h, icon, put, toast } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import { registry } from '../../../core/registry';
import { ROUTE } from '../../../core/route';
import { href } from '../../../core/router';
import { store } from '../../../core/store';
import type { Level, Mounted, WidgetReg } from '../../../core/types';
import { UI } from '../../../core/i18n';
import { CAPSTONE } from '../data/capstone';
import { PET_PATHS, PETS, README_TEMPLATE } from '../data/pets';
import { blockState } from './vacancy';
import { load, save } from './ui';

const C = {
  opens: bi('Открывается после', 'Opens after'),
  required: bi('обязателен на твоём уровне', 'required at your level'),
  optional: bi('по выбору', 'optional'),
  defense: bi('Вопросы защиты', 'Defence questions'),
  readme: bi('Скопировать шаблон README', 'Copy the README template'),
  copied: bi('Шаблон README скопирован', 'The README template is copied'),
  done: bi('принят', 'accepted'),
  path: bi('Твой путь', 'Your path'),
  understood: bi('План понятен', 'The plan is clear'),
  check: bi('Как проверяется', 'How it is checked'),
  ready: bi('готов', 'ready'),
};

function careerLevel(): Level {
  return store.state.levels.career ?? store.state.levels.final ?? 'beginner';
}

export const checklistWidget: WidgetReg = {
  id: 'career.checklist',
  mount(el, props, ctx): Mounted {
    const kind = (props as { kind?: string })?.kind === 'capstone' ? 'capstone' : 'pets';
    const key = `check.${kind}`;
    let ticks = new Set<string>();
    const root = h('div.cw-checklist');
    const level = careerLevel();
    const toggle = (id: string, on: boolean) => {
      if (on) ticks.add(id);
      else ticks.delete(id);
      save(key, [...ticks]);
      store.record({ kind: 'x.career.check', list: kind, item: id, on });
      ctx.complete();
    };
    const box = (id: string) => {
      const b = h('input', { type: 'checkbox', checked: ticks.has(id) }) as HTMLInputElement;
      b.addEventListener('change', () => {
        toggle(id, b.checked);
        draw();
      });
      return b;
    };

    const drawPets = () => {
      const path = PET_PATHS[level];
      put(root, h('p.small', {}, h('strong', {}, `${t(C.path)} (${t(UI.levels[level])}): `), path.map((id) => PETS.find((p) => p.id === id)!.n).join(' → ')));
      for (const p of PETS) {
        const required = p.required.includes(level);
        const accepted = p.acceptance.every((a) => ticks.has(`${p.id}.${a.id}`));
        const blocks = p.opensAfter.map((b) => {
          const st = blockState(b);
          const title = registry.blocks.get(b)?.title ?? ROUTE.find((e) => e.id === b)?.title;
          return h('a', { href: href({ name: 'block', id: b }), class: `cw-blk st-${st}` }, title ? t(title) : b, st === 'exam' || st === 'lessons' ? ' ✓' : '');
        });
        root.append(
          h(
            'article.cw-pet',
            { 'data-required': required ? 'true' : undefined, 'data-done': accepted ? 'true' : undefined },
            h('header', {}, h('span.cw-pet-n', {}, p.n), h('h4', {}, t(p.title)), h('span.badge', {}, accepted ? `✓ ${t(C.done)}` : required ? t(C.required) : t(C.optional))),
            h('p.small', {}, t(p.what)),
            h('p.small.cw-opens', {}, `${t(C.opens)}: `, ...blocks.flatMap((b, k) => [k ? ', ' : '', b])),
            h('ul.cw-acc', {}, ...p.acceptance.map((a) => h('li', {}, h('label', {}, box(`${p.id}.${a.id}`), ' ', t(a.text))))),
            h('details', {}, h('summary', {}, t(C.defense)), h('ul.small', {}, ...p.defense.map((d) => h('li', {}, t(d))))),
          ),
        );
      }
      root.append(
        h(
          'div.row',
          {},
          h('button.btn.ghost', {
            type: 'button',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(README_TEMPLATE);
                toast(t(C.copied));
              } catch {
                /* the template is shown below anyway */
              }
              ctx.complete();
            },
          }, icon('copy'), t(C.readme)),
          h('button.btn.ghost', { type: 'button', onclick: () => ctx.complete() }, icon('check'), t(C.understood)),
        ),
        h('details', {}, h('summary', {}, 'README.md'), h('pre.cw-out', {}, README_TEMPLATE)),
      );
    };

    const drawCapstone = () => {
      for (const part of CAPSTONE) {
        const items = part.items.filter((x) => !x.levels || x.levels.includes(level));
        const all = items.every((x) => ticks.has(x.id));
        root.append(
          h(
            'section.cw-part',
            {},
            h('h4', {}, t(part.title), all ? h('span.cw-mark.ok', {}, ` ✓ ${t(C.ready)}`) : null),
            h('ul.cw-acc', {}, ...items.map((x) => h('li', {}, h('label', {}, box(x.id), ' ', h('strong', {}, `${x.id}. `), t(x.text)), h('span.small.muted', {}, ` — ${t(C.check)}: ${t(x.check)}`)))),
          ),
        );
      }
      root.append(h('div.row', {}, h('button.btn.ghost', { type: 'button', onclick: () => ctx.complete() }, icon('check'), t(C.understood))));
    };

    const draw = () => {
      clear(root);
      if (kind === 'pets') drawPets();
      else drawCapstone();
    };
    clear(el);
    el.append(root);
    draw();
    void load<string[]>(key).then((v) => {
      if (v?.length) {
        ticks = new Set(v);
        draw();
      }
    });
    return { dispose: () => clear(el), describe: () => t(kind === 'pets' ? bi('Пет-проекты', 'Pet projects') : bi('План итогового экзамена', 'Capstone plan')) };
  },
};
