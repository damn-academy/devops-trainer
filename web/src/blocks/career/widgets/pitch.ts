// The self-presentation trainer (10 §9.4). The learner writes the text and
// reads it aloud with the timer running (or the duration is estimated from
// the words). Measured: duration 60–90 s, the five parts (ticked by the
// learner), filler words per 15 seconds, apologies, something concrete. The
// text stays in this browser; "compare with last time" shows the progress.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, lang, t } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { apologyCount, fillerCount, hasConcrete, speakingSeconds } from '../../../engine/quiz/rubric';
import { debounce, eventsOf, load, save } from './ui';

const P = {
  write: bi('Напишите свою самопрезентацию своими словами, как сказали бы вслух', 'Write your self-presentation in your own words, as you would say it aloud'),
  timer: bi('Читайте вслух с таймером', 'Read it aloud with the timer'),
  startT: bi('Старт', 'Start'),
  stopT: bi('Стоп', 'Stop'),
  parts: bi('Что есть в тексте', 'What the text has'),
  measure: bi('Замерить', 'Measure'),
  dur: bi('Длительность', 'Duration'),
  durEst: bi('оценка по числу слов', 'estimated from the word count'),
  durTimer: bi('по таймеру', 'by the timer'),
  fillers: bi('Слова-паразиты', 'Filler words'),
  per15: bi('на 15 секунд', 'per 15 seconds'),
  apologies: bi('Извинения', 'Apologies'),
  concrete: bi('Конкретика: число, проект или ссылка', 'Something concrete: a number, a project or a link'),
  norm: bi('норма', 'target'),
  yes: bi('есть', 'yes'),
  no: bi('нет', 'no'),
  last: bi('В прошлый раз', 'Last time'),
  privacy: bi('Текст хранится только в этом браузере.', 'The text stays in this browser only.'),
};

const PARTS = [
  bi('Кто я и откуда: одна фраза, без извинений', 'Who I am and where from — one sentence, no apologies'),
  bi('Что я умею и чем это подтверждается (экзамены, проекты со ссылками)', 'What I can do — with proof (exams, projects with links)'),
  bi('Одна история: какая была проблема, что я сделал и что изменилось', 'One story: problem → what I did → what changed'),
  bi('Почему DevOps: мост от прежнего опыта', 'Why DevOps — the bridge from earlier experience'),
  bi('Что ищу: роль и формат', 'What I am looking for: role and format'),
];

interface PitchMetrics {
  seconds: number;
  timer: boolean;
  fillersPer15: number;
  apologies: number;
  concrete: boolean;
  parts: number;
}

export function measurePitch(text: string, l: 'ru' | 'en', timerSeconds: number | null, parts: number): PitchMetrics {
  const seconds = timerSeconds ?? speakingSeconds(text);
  const fillers = fillerCount(text, l);
  return { seconds, timer: timerSeconds !== null, fillersPer15: seconds ? (fillers * 15) / seconds : 0, apologies: apologyCount(text, l), concrete: hasConcrete(text), parts };
}

export const pitchWidget: WidgetReg = {
  id: 'career.pitch',
  mount(el, _props, ctx): Mounted {
    if (eventsOf('x.career.pitch').length) ctx.complete();
    const ta = h('textarea.cw-pitch', { rows: 8, 'aria-label': t(P.write) }) as HTMLTextAreaElement;
    void load<string>('pitch.text').then((v) => {
      if (v && !ta.value) ta.value = v;
    });
    ta.addEventListener('input', debounce(() => save('pitch.text', ta.value)));
    let started: number | null = null;
    let timed: number | null = null;
    const clock = h('span.cw-clock', { 'aria-live': 'off' }, '0:00');
    let iv: number | undefined;
    const tBtn = h('button.btn.ghost.small', { type: 'button' }, icon('play'), t(P.startT));
    tBtn.addEventListener('click', () => {
      if (started === null) {
        started = Date.now();
        timed = null;
        tBtn.replaceChildren(icon('pause'), t(P.stopT));
        iv = window.setInterval(() => {
          const s = Math.floor((Date.now() - started!) / 1000);
          clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }, 250);
      } else {
        timed = Math.round((Date.now() - started) / 1000);
        started = null;
        clearInterval(iv);
        tBtn.replaceChildren(icon('play'), t(P.startT));
      }
    });
    const boxes = PARTS.map((p) => {
      const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
      return { box, row: h('label.cw-check', {}, box, ' ', t(p)) };
    });
    const out = h('div.cw-metrics', { 'aria-live': 'polite' });
    const mBtn = h('button.btn.primary', { type: 'button' }, t(P.measure));
    mBtn.addEventListener('click', () => {
      const prev = eventsOf<{ metrics: PitchMetrics }>('x.career.pitch').slice(-1)[0]?.metrics;
      const m = measurePitch(ta.value, lang(), timed, boxes.filter((b) => b.box.checked).length);
      store.record({ kind: 'x.career.pitch', metrics: m });
      ctx.complete();
      const row = (name: string, value: string, ok: boolean, norm: string, before?: string) =>
        h('tr', { class: ok ? 'ok' : 'warn' }, h('th', { scope: 'row' }, name), h('td', {}, h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : '!'), ' ', value), h('td.small.muted', {}, `${t(P.norm)}: ${norm}`), h('td.small.muted', {}, before ?? ''));
      clear(out);
      put(
        out,
        h(
          'table.cw-table',
          {},
          h('tbody', {},
            row(t(P.dur), `${m.seconds} ${lang() === 'ru' ? 'с' : 's'} (${t(m.timer ? P.durTimer : P.durEst)})`, m.seconds >= 60 && m.seconds <= 90, '60–90', prev ? `${t(P.last)}: ${prev.seconds}` : undefined),
            row(t(bi('Части структуры', 'Parts of the structure')), `${m.parts} / 5`, m.parts === 5, '5', prev ? `${t(P.last)}: ${prev.parts}` : undefined),
            row(`${t(P.fillers)} ${t(P.per15)}`, m.fillersPer15.toFixed(1), m.fillersPer15 < 1, '< 1', prev ? `${t(P.last)}: ${prev.fillersPer15.toFixed(1)}` : undefined),
            row(t(P.apologies), String(m.apologies), m.apologies === 0, '0', prev ? `${t(P.last)}: ${prev.apologies}` : undefined),
            row(t(P.concrete), t(m.concrete ? P.yes : P.no), m.concrete, t(P.yes)),
          ),
        ),
      );
    });
    clear(el);
    el.append(
      h(
        'div.cw-pitch-w',
        {},
        h('label.cw-label', {}, t(P.write)),
        ta,
        h('p.small.muted', {}, t(P.privacy)),
        h('div.cw-timer', {}, h('span', {}, t(P.timer)), clock, tBtn),
        h('fieldset.cw-parts-check', {}, h('legend', {}, t(P.parts)), ...boxes.map((b) => b.row)),
        h('div.row', {}, mBtn),
        out,
      ),
    );
    return { dispose: () => (clearInterval(iv), clear(el)), describe: () => t(bi('Тренажёр самопрезентации', 'Self-presentation trainer')) };
  },
};
