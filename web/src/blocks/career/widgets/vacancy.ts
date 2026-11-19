// The vacancy analyzer widget (10 §9.7): paste a vacancy, see each
// requirement credited from your progress, the totals and the verdict by
// the 60% rule, and which blocks to work on before the interview.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, fmt, t } from '../../../core/i18n';
import { registry } from '../../../core/registry';
import { ROUTE } from '../../../core/route';
import { href } from '../../../core/router';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { analyze, extractRequirements, type Analysis } from '../vacancy';
import { load, save } from './ui';

const V = {
  paste: bi('Вставьте текст вакансии целиком, с заголовками разделов', 'Paste the whole vacancy text, with its section headings'),
  run: bi('Разобрать', 'Analyze'),
  req: bi('Требование', 'Requirement'),
  kind: bi('Вес', 'Weight'),
  state: bi('Ваше состояние', 'Your state'),
  credit: bi('Засчитано', 'Credited'),
  must: bi('обяз.', 'must'),
  nice: bi('жел.', 'nice'),
  total: bi('Итого {t}% (обязательные {r}%)', 'Total {t}% (required {r}%)'),
  apply: bi('Откликайтесь: совпадение выше 60 %, а требования в вакансиях завышают намеренно.', 'Apply: the match is above 60%, and requirements are inflated on purpose.'),
  almost: bi('Почти готово: пройдите ещё два-три блока, и можно откликаться. Можно откликнуться и сейчас, ведь отказ тоже учит.', 'Almost: two or three blocks and you can apply. You may apply now too: a rejection also teaches.'),
  notYet: bi('Откликаться пока рано, но никто не запрещает. Больше всего вам дадут вот эти блоки:', 'Early for now, but nothing forbids it. This gives the most:'),
  empty: bi('В тексте не нашлось знакомых требований. Вставьте вакансию целиком.', 'No familiar requirements found in the text. Paste the whole vacancy.'),
  toLearn: bi('Что подтянуть к собеседованию', 'What to catch up on before the interview'),
  outside: bi('Этого нет в курсе: прочитайте обзор в официальной документации', 'Outside the course — read an overview in the official docs'),
  st: {
    exam: bi('экзамен сдан', 'exam passed'),
    lessons: bi('уроки пройдены', 'lessons done'),
    started: bi('начато', 'started'),
    none: bi('не начато', 'not started'),
    outside: bi('вне курса', 'outside the course'),
  },
  yes: bi('да', 'yes'),
  half: bi('половина', 'half'),
  no: bi('нет', 'no'),
};

/** What the learner has done in a block, from progress. */
export function blockState(blockId: string): 'exam' | 'lessons' | 'started' | 'none' {
  const b = registry.blocks.get(blockId);
  const examIds = [...registry.exams.values()].filter((e) => e.block === blockId || e.id === b?.exam).map((e) => e.id);
  if (examIds.some((id) => store.state.exams[id]?.some((x) => x.passed && x.mode === 'exam'))) return 'exam';
  if (store.state.placement[blockId]?.some((p) => p.passed && p.claimed !== 'beginner')) return 'lessons';
  if (!b || !b.lessons.length) return 'none';
  const done = b.lessons.filter((l) => store.state.lessons[l]?.status === 'done').length;
  if (done === b.lessons.length) return 'lessons';
  return done > 0 || b.lessons.some((l) => store.state.lessons[l]) ? 'started' : 'none';
}

export const vacancyWidget: WidgetReg = {
  id: 'career.vacancy',
  mount(el, _props, ctx): Mounted {
    const ta = h('textarea.cw-vacancy', { rows: 10, 'aria-label': t(V.paste), placeholder: t(V.paste) }) as HTMLTextAreaElement;
    void load<string>('vacancy.text').then((v) => {
      if (v && !ta.value) ta.value = v;
    });
    const out = h('div.cw-vresult', { 'aria-live': 'polite' });
    const runBtn = h('button.btn.primary', { type: 'button' }, t(V.run));
    const pct = (x: number) => Math.round(x * 100);
    const render = (a: Analysis) => {
      clear(out);
      if (a.verdict === 'empty') {
        out.append(h('p.muted', {}, t(V.empty)));
        return;
      }
      const blockName = (id: string) => {
        const b = registry.blocks.get(id);
        const title = b?.title ?? ROUTE.find((e) => e.id === id)?.title;
        return h('a', { href: href({ name: 'block', id }) }, title ? t(title) : id);
      };
      put(
        out,
        h(
          'table.cw-table',
          {},
          h('thead', {}, h('tr', {}, h('th', {}, t(V.req)), h('th', {}, t(V.kind)), h('th', {}, t(V.state)), h('th', {}, t(V.credit)))),
          h('tbody', {}, ...a.rows.map((r) => h('tr', { class: r.credit === 1 ? 'ok' : r.credit === 0.5 ? '' : 'warn' }, h('td', {}, r.req.term.label), h('td.small', {}, t(r.req.required ? V.must : V.nice)), h('td.small', {}, t(V.st[r.status])), h('td', {}, t(r.credit === 1 ? V.yes : r.credit === 0.5 ? V.half : V.no))))),
        ),
        h('p.cw-total', {}, h('strong', {}, t(fmt(V.total, { t: pct(a.total), r: pct(a.required) })))),
        h('p', { class: a.verdict === 'apply' ? 'cw-mark ok' : '' }, t(a.verdict === 'apply' ? V.apply : a.verdict === 'almost' ? V.almost : V.notYet)),
        a.toLearn.length ? h('div', {}, h('h4', {}, t(V.toLearn)), h('ul', {}, ...a.toLearn.slice(0, 4).map((b) => h('li', {}, blockName(b))))) : null,
        a.outside.length ? h('p.small.muted', {}, `${t(V.outside)}: ${a.outside.join(', ')}`) : null,
      );
    };
    runBtn.addEventListener('click', () => {
      const reqs = extractRequirements(ta.value);
      const a = analyze(reqs, blockState);
      save('vacancy.text', ta.value);
      save('vacancy.keywords', reqs.map((r) => r.term.label));
      store.record({ kind: 'x.career.vacancy', total: a.total, required: a.required, verdict: a.verdict, n: a.rows.length });
      render(a);
      if (a.verdict !== 'empty') ctx.complete();
    });
    clear(el);
    el.append(h('div.cw-vac', {}, ta, h('div.row', {}, runBtn, h('span.small.muted', {}, icon('eye'), ' ', t(bi('Текст остаётся в этом браузере.', 'The text stays in this browser.')))), out));
    return { dispose: () => clear(el), describe: () => t(bi('Анализатор вакансии', 'Vacancy analyzer')) };
  },
};
