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
  state: bi('Ваше состояние', 'Your state'),
  credit: bi('Засчитано', 'Credited'),
  groupMust: bi('Требования', 'Requirements'),
  groupNice: bi('Будет плюсом', 'Nice to have'),
  total: bi('Итого {t}\u00a0%, по обязательным требованиям {r}\u00a0%', 'Total {t}%, required items {r}%'),
  totalOnly: bi('Итого {t}\u00a0%', 'Total {t}%'),
  noSplit: bi('В тексте вакансии не нашлось заголовков «Требования» и «Будет плюсом», поэтому все требования считаются одинаково важными.', 'The vacancy text has no “Requirements” and “Nice to have” headings, so every requirement counts as equally important.'),
  knowIt: bi('умею', 'I know it'),
  knowHint: bi('Флажок «умею» стоит рядом с требованиями, которых нет в курсе. Ставьте его, только если вы делали это на прежней работе или в своих проектах и можете подтвердить на собеседовании.', 'The “I know it” box sits next to requirements the course does not cover. Tick it only if you did this at an earlier job or in your own projects and can back it up at an interview.'),
  apply: bi('Откликайтесь, потому что совпадение выше 60 %, а требования в вакансиях завышают намеренно.', 'Apply, because the match is above 60%, and vacancy requirements are inflated on purpose.'),
  almost: bi('Вы почти готовы. Пройдите ещё два-три блока, и можно откликаться, хотя откликнуться можно и сейчас, ведь отказ тоже учит.', 'You are almost ready. Do two or three more blocks and you can apply, although you may apply now too, because a rejection also teaches.'),
  notYet: bi('Откликаться пока рано, но никто не запрещает. Больше всего вам дадут вот эти блоки:', 'Early for now, but nothing forbids it. This gives the most:'),
  empty: bi('В тексте не нашлось знакомых требований. Вставьте вакансию целиком.', 'No familiar requirements found in the text. Paste the whole vacancy.'),
  toLearn: bi('Что подтянуть к собеседованию', 'What to catch up on before the interview'),
  outside: bi('Этого нет в курсе, поэтому прочитайте обзор в официальной документации', 'This is not in the course, so read an overview in the official documentation'),
  st: {
    exam: bi('экзамен сдан', 'exam passed'),
    lessons: bi('уроки пройдены', 'lessons done'),
    started: bi('начато', 'started'),
    none: bi('не начато', 'not started'),
    outside: bi('вне курса', 'outside the course'),
    known: bi('вне курса, отмечено вами', 'outside the course, marked by you'),
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
    let known = new Set<string>();
    void load<string[]>('vacancy.known').then((v) => {
      if (v?.length) known = new Set(v);
    });
    let lastReqs: ReturnType<typeof extractRequirements> = [];
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
          h('thead', {}, h('tr', {}, h('th', {}, t(V.req)), h('th', {}, t(V.state)), h('th', {}, t(V.credit)))),
          ...groups(a).map(([title, rows]) =>
            h(
              'tbody',
              {},
              a.hasRequired ? h('tr', {}, h('th', { colspan: 3, scope: 'rowgroup' }, t(title))) : null,
              ...rows.map((r) =>
                h(
                  'tr',
                  { class: r.credit === 1 ? 'ok' : r.credit === 0.5 ? '' : 'warn' },
                  h('td', {}, r.req.term.label),
                  h('td.small', {}, t(V.st[r.status]), r.status === 'outside' || r.status === 'known' ? h('label.small', {}, ' · ', knowBox(r.req.term.id), ' ', t(V.knowIt)) : null),
                  h('td', {}, t(r.credit === 1 ? V.yes : r.credit === 0.5 ? V.half : V.no)),
                ),
              ),
            ),
          ),
        ),
        h('p.cw-total', {}, h('strong', {}, t(a.hasRequired ? fmt(V.total, { t: pct(a.total), r: pct(a.required) }) : fmt(V.totalOnly, { t: pct(a.total) })))),
        a.hasRequired ? null : h('p.small.muted', {}, t(V.noSplit)),
        a.rows.some((r) => r.status === 'outside' || r.status === 'known') ? h('p.small.muted', {}, t(V.knowHint)) : null,
        h('p', { class: a.verdict === 'apply' ? 'cw-mark ok' : '' }, t(a.verdict === 'apply' ? V.apply : a.verdict === 'almost' ? V.almost : V.notYet)),
        a.toLearn.length ? h('div', {}, h('h4', {}, t(V.toLearn)), h('ul', {}, ...a.toLearn.slice(0, 4).map((b) => h('li', {}, blockName(b))))) : null,
        a.outside.length ? h('p.small.muted', {}, `${t(V.outside)}: ${a.outside.join(', ')}`) : null,
      );
    };
    const groups = (a: Analysis): [typeof V.groupMust, Analysis['rows']][] => {
      const must = a.rows.filter((r) => r.req.required);
      const nice = a.rows.filter((r) => !r.req.required);
      return a.hasRequired ? [[V.groupMust, must], [V.groupNice, nice]] : [[V.groupMust, a.rows]];
    };
    const knowBox = (id: string) => {
      const b = h('input', { type: 'checkbox', checked: known.has(id) }) as HTMLInputElement;
      b.addEventListener('change', () => {
        if (b.checked) known.add(id);
        else known.delete(id);
        save('vacancy.known', [...known]);
        render(analyze(lastReqs, blockState, known));
      });
      return b;
    };
    runBtn.addEventListener('click', () => {
      const reqs = extractRequirements(ta.value);
      lastReqs = reqs;
      const a = analyze(reqs, blockState, known);
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
