// The command → logic translator (10 §9.2): a "bad" answer made of a
// command; the learner rewrites it in four parts. Local checks: every part is
// written, commands take under a third, which key points are mentioned (the
// learner confirms the rest honestly). Then the model answer and its source.
// With the learner's own AI connected, a rubric review with verified quotes.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, fmt, lang, t } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { ANSWER_PARTS, commandShare, coveredPoints, INTERVIEW_RUBRIC, parseGrader, PART_TITLES, verifyScores, type CriterionScore } from '../../../engine/quiz/rubric';
import { prose } from './ui';
import { aiChat, aiReady } from '../ai';
import { cardById, type InterviewCard } from '../data/questions';
import { eventsOf, scoreDots } from './ui';

const T = {
  bad: bi('Ответ, который звучит уверенно и ничего не говорит', 'An answer that sounds confident and says nothing'),
  rewrite: bi('Перепишите его как механизм', 'Rewrite it as a mechanism'),
  check: bi('Сверить с эталоном', 'Compare with the model'),
  share: bi('Команды занимают {p}% ответа', 'Commands take {p}% of the answer'),
  shareOk: bi('меньше трети — хорошо', 'under a third — good'),
  shareBad: bi('больше трети: объясните механизм словами', 'over a third: explain the mechanism in words'),
  parts: bi('Частей заполнено: {n} из 4', 'Parts written: {n} of 4'),
  points: bi('Ключевые пункты', 'Key points'),
  found: bi('нашлось в вашем ответе', 'found in your answer'),
  confirm: bi('отметьте, если назвали другими словами', 'tick if you said it in other words'),
  model: bi('Эталон', 'The model answer'),
  from: bi('это отсюда', 'this is from'),
  followups: bi('Чем продолжит интервьюер', 'How the interviewer will follow up'),
  done: bi('Засчитать карточку', 'Count this card'),
  doneMark: bi('засчитано', 'counted'),
  ai: bi('Разбор моей нейросетью по рубрике', 'Review by my AI on the rubric'),
  aiNo: bi('Подключите свою нейросеть в настройках — и получите разбор по рубрике с цитатами из ответа.', 'Connect your own AI in the settings to get a rubric review quoting your answer.'),
  aiFail: bi('Нейросеть ответила не по схеме. Попробуйте ещё раз.', 'The AI did not answer in the expected format. Try again.'),
  unconfirmed: bi('не подтверждено цитатой', 'not confirmed by a quote'),
  progress: bi('Засчитано карточек: {n}', 'Cards counted: {n}'),
};

function graderPrompt(card: InterviewCard, answer: string): string {
  const crit = INTERVIEW_RUBRIC.criteria.map((c) => `- ${c.id}: ${c.anchors.map((a, i) => `${i}=${a.en}`).join('; ')}`).join('\n');
  return [
    'You grade one answer of a junior DevOps candidate. Reply with JSON only, no prose.',
    `Question: ${card.question.en}`,
    `Key points: ${card.points.map((p) => p.text.en).join('; ')}`,
    `Model answer: ${ANSWER_PARTS.map((p) => card.model[p].en).join(' ')}`,
    `Rubric (score 0-3 each):\n${crit}`,
    'For every score above 1 give "evidence": an exact quote from the candidate answer. Schema: {"answers":[{"q":"<id>","criteria":[{"id":"correctness","score":2,"evidence":"…","note":"…"}]}],"summary":{"strong":["…"],"work_on":["…"]}}',
    `Candidate answer (${lang()}):\n"""${answer}"""`,
  ].join('\n\n');
}

export const translatorWidget: WidgetReg = {
  id: 'career.translator',
  mount(el, props, ctx): Mounted {
    const p = (props ?? {}) as { cards?: string[]; need?: number };
    const cards = (p.cards ?? ['q.dns']).map(cardById).filter(Boolean) as InterviewCard[];
    const need = Math.min(p.need ?? 2, cards.length);
    const counted = () => new Set(eventsOf<{ card: string }>('x.career.translator').map((e) => e.card).filter((id) => cards.some((c) => c.id === id)));
    if (counted().size >= need) ctx.complete();
    let current = cards.find((c) => !counted().has(c.id)) ?? cards[0];
    const root = h('div.cw-translator');
    const tabs = h('div.cw-tabs', { role: 'tablist' });
    const body = h('div.cw-tbody');
    const status = h('p.small.muted');

    const drawTabs = () => {
      clear(tabs);
      const got = counted();
      for (const c of cards)
        tabs.append(h('button.cw-tab', { type: 'button', role: 'tab', 'aria-selected': c === current ? 'true' : 'false', onclick: () => ((current = c), drawTabs(), drawCard()) }, got.has(c.id) ? '✓ ' : '', t(c.question)));
      status.textContent = t(fmt(T.progress, { n: `${got.size} / ${need}` }));
    };

    const drawCard = () => {
      clear(body);
      const card = current;
      const fields = Object.fromEntries(ANSWER_PARTS.map((part) => [part, h('textarea.cw-part', { rows: 2, 'aria-label': t(PART_TITLES[part]) }) as HTMLTextAreaElement]));
      const meter = h('p.cw-meter.small', { 'aria-live': 'polite' });
      const text = () => ANSWER_PARTS.map((x) => fields[x].value.trim()).filter(Boolean).join(' ');
      const update = () => {
        const n = ANSWER_PARTS.filter((x) => fields[x].value.trim().length > 8).length;
        const share = Math.round(commandShare(text()) * 100);
        meter.textContent = `${t(fmt(T.parts, { n }))} · ${t(fmt(T.share, { p: share }))} — ${share <= 33 ? t(T.shareOk) : t(T.shareBad)}`;
        meter.classList.toggle('warn', share > 33);
        checkBtn.disabled = n < 4;
      };
      const review = h('div.cw-review');
      const checkBtn = h('button.btn.primary', { type: 'button', disabled: true }, t(T.check)) as HTMLButtonElement;
      for (const f of Object.values(fields)) f.addEventListener('input', update);
      checkBtn.addEventListener('click', () => {
        const answer = text();
        const found = new Set(coveredPoints(answer, card.points));
        const confirmed = new Set(found);
        clear(review);
        const doneBtn = h('button.btn', { type: 'button' }, icon('check'), t(T.done));
        doneBtn.addEventListener('click', () => {
          store.record({ kind: 'x.career.translator', card: card.id, points: confirmed.size, of: card.points.length, share: commandShare(answer) });
          doneBtn.replaceWith(h('span.cw-mark.ok', {}, `✓ ${t(T.doneMark)}`));
          drawTabs();
          if (counted().size >= need) ctx.complete();
        });
        const aiBox = h('div.cw-ai');
        if (aiReady()) {
          const aiBtn = h('button.btn.ghost', { type: 'button' }, icon('ask'), t(T.ai));
          aiBtn.addEventListener('click', async () => {
            aiBtn.setAttribute('disabled', '');
            clear(aiBox);
            aiBox.append(h('p.muted', {}, '…'));
            try {
              const raw = await aiChat([{ role: 'user', content: graderPrompt(card, answer) }], { temperature: 0, json: true });
              const g = parseGrader(raw);
              clear(aiBox);
              if (!g?.answers[0]) {
                aiBox.append(h('p.err', {}, t(T.aiFail)));
                return;
              }
              const scores: CriterionScore[] = verifyScores(g.answers[0].criteria, answer);
              aiBox.append(
                h(
                  'table.cw-rubric',
                  {},
                  h('tbody', {}, ...INTERVIEW_RUBRIC.criteria.map((c) => {
                    const s = scores.find((x) => x.id === c.id);
                    return h('tr', {}, h('th', { scope: 'row' }, t(c.title)), h('td', {}, s ? scoreDots(s.score) : '—'), h('td.small', {}, s?.lowered ? h('span.cw-mark.warn', {}, t(T.unconfirmed)) : s?.evidence ? `«${s.evidence}»` : '', s?.note ? h('span.muted', {}, ` — ${s.note}`) : null));
                  })),
                ),
              );
            } catch (e) {
              clear(aiBox);
              aiBox.append(h('p.err', {}, (e as Error).message));
            } finally {
              aiBtn.removeAttribute('disabled');
            }
          });
          aiBox.append(aiBtn);
        } else aiBox.append(h('p.small.muted', {}, t(T.aiNo)));
        put(
          review,
          h('h4', {}, t(T.points)),
          h(
            'ul.cw-points',
            {},
            ...card.points.map((kp) => {
              const box = h('input', { type: 'checkbox', checked: found.has(kp.id) }) as HTMLInputElement;
              box.addEventListener('change', () => (box.checked ? confirmed.add(kp.id) : confirmed.delete(kp.id)));
              return h('li', {}, h('label', {}, box, ' ', t(kp.text), h('span.small.muted', {}, found.has(kp.id) ? ` — ${t(T.found)}` : ` — ${t(T.confirm)}`)));
            }),
          ),
          h('h4', {}, t(T.model)),
          h('dl.cw-model', {}, ...ANSWER_PARTS.flatMap((part) => [h('dt', {}, t(PART_TITLES[part])), h('dd', {}, prose(card.model[part]))])),
          h('p.small', {}, `${t(T.from)}: `, h('a', { href: card.source.url, target: '_blank', rel: 'noopener noreferrer' }, card.source.title)),
          h('details.cw-follow', {}, h('summary', {}, t(T.followups)), h('ul', {}, ...card.followups.map((f) => h('li', {}, t(f))))),
          aiBox,
          h('div.row', {}, doneBtn),
        );
      });
      put(
        body,
        h('p.cw-q', {}, t(card.question)),
        h('div.cw-bad', {}, h('span.small.muted', {}, t(T.bad)), prose(card.bad)),
        h('p.small', {}, h('strong', {}, t(T.rewrite))),
        h('div.cw-parts', {}, ...ANSWER_PARTS.map((part) => h('label.cw-part-row', {}, h('span.cw-part-name', {}, t(PART_TITLES[part])), fields[part]))),
        meter,
        h('div.row', {}, checkBtn),
        review,
      );
      update();
    };

    root.append(tabs, body, status);
    clear(el);
    el.append(root);
    drawTabs();
    drawCard();
    return { dispose: () => clear(el), describe: () => `${t(bi('Переводчик «команда → логика»', 'Command → logic translator'))}: ${t(current.question)}` };
  },
};
