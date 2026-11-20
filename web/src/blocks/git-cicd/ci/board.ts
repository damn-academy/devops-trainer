// The pipeline page next to a lab: stage columns with job cards (status by
// colour and icon), the time bar of the model run, and the log of the job you
// click. It listens to the page hub, so it shows whatever the terminal above
// it just pushed.

import type { WidgetReg } from '../../../core/types';
import { bi, t } from '../../../core/i18n';
import { clear, h } from '../../../core/dom';
import { lastEvent, subscribe } from '../shared/hub';
import type { JobRec, PipelineRec } from './run';
import './board.css';

const L = {
  title: bi('Страница пайплайна', 'Pipeline page'),
  empty: bi('Пайплайнов пока нет. Когда вы выполните git push, здесь появятся джобы.', 'No pipelines yet. Do a git push and the jobs appear here.'),
  noPipeline: bi('Сервер принял push, но пайплайн не создал, потому что правила не добавили в него ни одной джобы.', 'The push went through but no pipeline was created: the rules added no jobs.'),
  yaml: bi('В файле пайплайна есть ошибка, поэтому пайплайн не создан.', 'The pipeline file has an error, so no pipeline was created'),
  timeline: bi('Длительность пайплайна', 'Pipeline duration'),
  seconds: bi('с', 's'),
  log: bi('Журнал джобы', 'Job log'),
  pick: bi('Нажмите на джобу, чтобы открыть её журнал.', 'Click a job to open its log.'),
  excluded: bi('Не попали в пайплайн', 'Not in this pipeline'),
};

const ICON: Record<string, string> = { success: '✓', failed: '✗', running: '◐', pending: '◯', manual: '▶', skipped: '»', created: '○', canceled: '⊘' };
const STATUS: Record<string, ReturnType<typeof bi>> = {
  success: bi('успех', 'passed'),
  failed: bi('с ошибкой', 'failed'),
  running: bi('идёт', 'running'),
  pending: bi('ждёт раннер', 'pending'),
  manual: bi('ручной запуск', 'manual'),
  skipped: bi('пропущена', 'skipped'),
  created: bi('ждёт', 'created'),
  canceled: bi('отменена', 'canceled'),
  blocked: bi('ждёт ручного шага', 'blocked'),
};

function ansiToNodes(text: string): Node[] {
  const out: Node[] = [];
  const re = /\x1b\[([0-9;]*)m/g;
  let cls = '';
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (s: string) => {
    if (!s) return;
    out.push(cls ? h('span', { class: cls }, s) : document.createTextNode(s));
  };
  const clean = text.replace(/\x1b\[0K/g, '');
  while ((m = re.exec(clean))) {
    push(clean.slice(last, m.index));
    const codes = m[1].split(';');
    cls = codes.includes('31') ? 'lg-err' : codes.includes('32') ? 'lg-ok' : codes.includes('33') ? 'lg-warn' : codes.includes('36') ? 'lg-sec' : '';
    last = m.index + m[0].length;
  }
  push(clean.slice(last));
  return out;
}

export const boardWidget: WidgetReg = {
  id: 'cicd.board',
  mount(el, _props, ctx) {
    let current: PipelineRec | null = null;
    let picked: string | null = null;
    let none = false;
    const root = h('div.pb');
    clear(el);
    el.append(root);
    const draw = () => {
      clear(root);
      root.append(h('h3.pb-title', {}, t(L.title)));
      if (!current) {
        root.append(h('p.muted', {}, t(none ? L.noPipeline : L.empty)));
        return;
      }
      const p = current;
      root.append(
        h(
          'p.pb-meta',
          {},
          h('span.pb-badge', { 'data-st': p.status }, `${ICON[p.status] ?? '•'} ${t(STATUS[p.status] ?? bi(p.status, p.status))}`),
          h('code', {}, `#${p.id}`),
          h('code', {}, p.ref),
          h('code', {}, p.sha.slice(0, 8)),
          h('span.muted', {}, p.source),
        ),
      );
      if (p.errors?.length) {
        root.append(h('div.pb-yaml', {}, h('strong', {}, t(L.yaml)), ...p.errors.map((e) => h('p', {}, h('code', {}, `line ${e.line}`), ' ', e.message))));
        return;
      }
      const cols = h('div.pb-cols');
      for (const st of p.stages) {
        const jobs = p.jobs.filter((j) => j.stage === st);
        cols.append(
          h(
            'div.pb-col',
            {},
            h('div.pb-stage', {}, st),
            ...jobs.map((j) =>
              h(
                'button.pb-job',
                { type: 'button', 'data-st': j.status, 'aria-pressed': picked === j.name ? 'true' : 'false', onclick: () => ((picked = j.name), draw()) },
                h('span.pb-ic', { 'aria-hidden': 'true' }, ICON[j.status] ?? '•'),
                h('span.pb-name', {}, j.name),
                h('span.pb-st', {}, t(STATUS[j.status] ?? bi(j.status, j.status)) + (j.env ? ` → ${j.env}` : '')),
              ),
            ),
          ),
        );
      }
      root.append(cols);
      const total = Math.max(1, p.duration, ...p.jobs.map((j) => j.end ?? 0));
      const bars = h('div.pb-time', { 'aria-label': t(L.timeline) });
      for (const j of p.jobs) {
        if (j.start === undefined || j.end === undefined) continue;
        bars.append(
          h(
            'div.pb-row',
            {},
            h('span.pb-row-name', {}, j.name),
            h('span.pb-track', {}, h('span.pb-bar', { 'data-st': j.status, style: `left:${(j.start / total) * 100}%;width:${Math.max(1.5, ((j.end - j.start) / total) * 100)}%` })),
            h('span.pb-row-t', {}, `${Math.round(j.end - j.start)} s`),
          ),
        );
      }
      if (bars.childElementCount) root.append(h('h4', {}, `${t(L.timeline)}: ${Math.round(total)} ${t(L.seconds)}`), bars);
      if (p.excluded.length) root.append(h('details.pb-excl', {}, h('summary', {}, `${t(L.excluded)}: ${p.excluded.length}`), h('ul', {}, ...p.excluded.map((e) => h('li', {}, h('code', {}, e.name), ` — ${e.reason}`)))));
      const job: JobRec | undefined = p.jobs.find((j) => j.name === picked);
      root.append(h('h4', {}, t(L.log) + (job ? `: ${job.name}` : '')), job ? h('pre.pb-log', {}, ...ansiToNodes(job.log || `${job.reason ?? ''}\n`)) : h('p.muted.small', {}, t(L.pick)));
    };
    const take = (ev: { t: string; [k: string]: unknown }) => {
      if (ev.t !== 'ci.pipeline') return;
      if (ev.status === 'none') {
        none = true;
        draw();
        return;
      }
      none = false;
      current = ev.pipeline as PipelineRec;
      if (picked && !current.jobs.some((j) => j.name === picked)) picked = null;
      if (!picked) picked = current.jobs.find((j) => j.status === 'failed')?.name ?? null;
      draw();
      ctx.complete();
    };
    const prev = lastEvent('ci.pipeline');
    if (prev) take(prev);
    else draw();
    const off = subscribe(take);
    return {
      dispose: off,
      describe: () => (current ? `pipeline #${current.id} ${current.status}: ${current.jobs.map((j) => `${j.name}=${j.status}`).join(', ')}` : 'no pipeline'),
    };
  },
};
