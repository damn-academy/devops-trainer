import { h, copyText } from '../../core/dom';
import { lang, t } from '../../core/i18n';
import { renderMd } from '../../core/markdown';
import type { Mounted, WidgetCtx, WidgetReg } from '../../core/types';
import { ai, type AiService } from '../ai/service';
import type { ChatMessage } from '../ai/client';
import { trainers, datasets, systemPrompt, learnerData, copyPrompt, verdict, boundaryScore, breakEven, simulate, roiDefaults, type Verdict, type Choice, type RoiInput } from './model';
import { loadAttempts, saveAttempts } from './storage';
import { strings as s } from './strings';
export type TrainerAi = Pick<AiService, 'status' | 'ready' | 'onChange' | 'stream'>;
type Kind = 'rubric' | 'roleplay' | 'signal-feed' | 'boundary' | 'events.roi';
const css = `.course-trainer{width:100%;max-width:760px;margin-inline:auto;display:grid;gap:16px;overflow-wrap:anywhere}.course-trainer *{box-sizing:border-box;min-width:0}.course-trainer label{display:grid;gap:6px}.course-trainer textarea{width:100%;min-height:120px;resize:vertical;font:inherit}.course-trainer input,.course-trainer select,.course-trainer textarea{color:inherit;background:var(--bg);border:1px solid var(--line,#888);border-radius:6px;padding:8px}.course-trainer .tr-actions{display:flex;flex-wrap:wrap;gap:8px}.course-trainer article{border:1px solid var(--line,#888);border-radius:8px;padding:14px}.course-trainer pre{white-space:pre-wrap}.course-trainer [hidden]{display:none!important}.course-trainer button[aria-pressed=true]{outline:2px solid currentColor}.course-trainer .tr-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.course-trainer [role=status]:empty{display:none}`;
export function mountTrainer(kind: Kind, el: HTMLElement, props: unknown, ctx: WidgetCtx, service?: TrainerAi): Mounted {
  const root = h('section', { class: 'course-trainer' }), style = h('style', {}, css);
  el.append(style, root);
  let disposed = false;
  const cleanup: (() => void)[] = [];
  const mounted = { dispose() { disposed = true; cleanup.forEach(fn => fn()); root.remove(); style.remove(); } };
  const text = (key: keyof typeof s) => t(s[key]);
  const button = (key: keyof typeof s, action: () => void) => h('button', { type: 'button', class: 'btn', onclick: action }, text(key));
  const actions = (...nodes: HTMLElement[]) => h('div', { class: 'tr-actions' }, ...nodes);
  const status = h('p', { role: 'status', 'aria-live': 'polite' });
  const title = (value: string, russian = true) => {
    root.append(h('h3', {}, value));
    if (russian && lang() === 'en') root.append(h('p', {}, text('notice')));
    root.append(h('p', {}, text('caveat')));
  };
  const id = props && typeof props === 'object' ? ('trainer' in props ? props.trainer : 'data' in props ? props.data : undefined) : undefined;
  if (kind === 'rubric' || kind === 'roleplay') {
    const trainer = trainers.find(v => v.id === id && (kind === 'roleplay' ? v.id === 'events.booth-visitor' : v.id !== 'events.booth-visitor'));
    if (!trainer) { root.textContent = text('missing'); return mounted; }
    const svc = service ?? ai(); title(trainer.title); root.append(renderMd(trainer.rubric));
    const attempts = loadAttempts(trainer.id), history = h('div');
    function showHistory() {
      history.replaceChildren(h('h4', {}, text('history')));
      attempts.forEach((a, i) => history.append(h('article', {}, h('h4', {}, `${i + 1} · ${text('user')}`), h('p', { style: 'white-space:pre-wrap' }, a.input), h('h4', {}, text('assistant')), renderMd(a.answer))));
    }
    showHistory();
    const input = h('textarea'), manual = h('textarea', { readonly: true, 'aria-label': text('copy'), hidden: true });
    let busy = false, request: ReturnType<TrainerAi['stream']> | undefined;
    const sync = () => { if (disposed) return; send.disabled = busy || !svc.status.configured || svc.status.locked || !input.value.trim(); debrief.disabled = busy || !svc.status.configured || svc.status.locked; status.textContent = busy ? text('busy') : !svc.status.configured || svc.status.locked ? text('settings') : ''; };
    async function submit(value: string) {
      if (busy || !svc.status.configured || svc.status.locked || !value.trim()) return;
      busy = true; sync();
      const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(trainer!) }];
      if (kind === 'roleplay') for (const a of attempts) messages.push({ role: 'user', content: a.input === 'Разбор' ? a.input : learnerData(a.input) }, { role: 'assistant', content: a.answer });
      messages.push({ role: 'user', content: kind === 'roleplay' && value === 'Разбор' ? value : learnerData(value) });
      let failed = false;
      try {
        request = svc.stream({ messages, maxTokens: 2400, temperature: kind === 'roleplay' ? .7 : .3 }, () => {});
        const answer = await request.done;
        if (disposed) return;
        attempts.push({ input: value, answer }); saveAttempts(trainer!.id, attempts); showHistory(); input.value = ''; ctx.complete();
      } catch { failed = true; }
      finally { busy = false; request = undefined; if (!disposed) { sync(); if (failed) status.textContent = text('error'); } }
    }
    const send = button(kind === 'rubric' ? 'check' : 'send', () => { void submit(input.value); });
    const debrief = button('debrief', () => { void submit('Разбор'); });
    const copy = button('copy', () => { void (async () => {
      const transcript = kind === 'roleplay' ? attempts.map(a => `${text('user')}: ${a.input}\n${text('assistant')}: ${a.answer}`).join('\n\n') + '\n\n' + input.value : input.value;
      const prompt = copyPrompt(trainer, transcript);
      if (await copyText(prompt)) { if (!disposed) status.textContent = text('copied'); }
      else if (!disposed) { manual.hidden = false; manual.value = prompt; manual.focus(); manual.select(); status.textContent = text('fallback'); }
    })(); });
    root.append(h('label', {}, text('input'), input), actions(send, ...(kind === 'roleplay' ? [debrief] : []), copy), status, manual, history);
    input.oninput = sync; cleanup.push(svc.onChange(sync), () => request?.abort());
    void svc.ready.then(sync).catch(() => { if (!disposed) status.textContent = text('error'); }); sync();
  } else if (kind === 'events.roi') {
    title(text('roi'), false);
    const fields = h('div', { class: 'tr-fields' }), result = h('div', { 'aria-live': 'polite' });
    const inputs = {} as Record<keyof RoiInput, HTMLInputElement>;
    for (const key of Object.keys(roiDefaults) as (keyof RoiInput)[]) {
      const share = !['cost', 'profit', 'scans'].includes(key);
      const input = h('input', { type: 'number', min: key === 'profit' ? .01 : 0, step: share ? .01 : 'any', value: roiDefaults[key], ...(share ? { max: 1 } : key === 'scans' ? { max: 100000 } : {}) });
      inputs[key] = input; input.onchange = update; fields.append(h('label', {}, text(key), input));
    }
    function update() {
      const p = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.valueAsNumber])) as RoiInput;
      if (Object.values(inputs).some(v => !v.value || !Number.isFinite(v.valueAsNumber) || !v.checkValidity()) || !Number.isInteger(p.scans)) { result.textContent = text('invalid'); return; }
      const b = breakEven(p), m = simulate(p);
      const format = (n: number) => Number.isFinite(n) ? n.toLocaleString(lang(), { maximumFractionDigits: 2 }) : '∞';
      result.replaceChildren(...([['wins', b.wins], ['opportunities', b.opportunities], ['median', m.median], ['probability', m.probability * 100]] as const).map(([k, v]) => h('p', {}, `${text(k)}: ${format(v)}${k === 'probability' ? '%' : ''}`)), h('p', {}, text('payoff').replace('{n}', String(Math.round(m.probability * 100))))); 
    }
    root.append(fields, h('p', {}, text('assumptions')), result); update();
  } else {
    const data = datasets.find(d => d.id === id && d.id === (kind === 'boundary' ? 'product.boundary' : 'sales.signal-feed'));
    if (!data) { root.textContent = text('missing'); return mounted; }
    title(data.title);
    if (kind === 'boundary') {
      const choices: Choice[] = data.rows.map(() => 'open'), reveals: HTMLElement[] = [];
      data.rows.forEach((row, i) => {
        const select = h('select', {}, ...(['open', 'paid'] as const).map(v => h('option', { value: v }, text(v))));
        select.onchange = () => { choices[i] = select.value as Choice; reveals.forEach(r => { r.hidden = true; }); status.textContent = ''; };
        const reveal = h('div', { hidden: true }, h('p', {}, `${text('expected')}: ${row[1]}`), h('p', {}, row[2]), h('p', {}, row[3])); reveals.push(reveal);
        root.append(h('article', {}, h('label', {}, row[0], select), reveal));
      });
      root.append(button('reaction', () => { reveals.forEach(r => { r.hidden = false; }); const score = boundaryScore(data.rows, choices); status.textContent = (Object.keys(score) as (keyof typeof score)[]).map(k => `${text(k)}: ${score[k]}`).join(' · '); ctx.complete(); }), status);
    } else {
      let index = 0; const answers: { choice: Verdict; action: string }[] = [], card = h('article'); root.append(card);
      function draw() {
        card.replaceChildren();
        if (index === data!.rows.length) {
          const misses = data!.rows.map((r, i) => ({ r, i })).filter(({ r, i }) => answers[i].choice !== verdict(r[1]));
          card.append(h('h4', {}, `${text('score')}: ${index - misses.length}/${index}`), h('h4', {}, text('misses')));
          misses.forEach(({ r, i }) => card.append(h('article', {}, h('p', {}, r[0]), h('p', {}, `${text('chosen')}: ${text(answers[i].choice)}`), h('p', {}, answers[i].action), h('p', {}, `${r[1]} · ${r[2]} · ${r[3]}`)))); ctx.complete(); return;
        }
        const row = data!.rows[index]; let choice: Verdict | undefined;
        const action = h('textarea'), reveal = button('reveal', () => {
          if (!choice) return; answers.push({ choice, action: action.value });
          buttons.forEach(b => { b.disabled = true; }); action.disabled = true; reveal.disabled = true;
          card.append(h('p', {}, row[1]), h('p', {}, row[2]), h('p', {}, row[3]), button('next', () => { index++; draw(); }));
        }); reveal.disabled = true;
        const buttons = (['signal', 'noise', 'verify'] as const).map(v => { const b = button(v, () => { choice = v; buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b))); reveal.disabled = false; }); b.setAttribute('aria-pressed', 'false'); return b; });
        card.append(h('p', {}, `${index + 1}/${data!.rows.length}`), h('p', {}, row[0]), actions(...buttons), h('label', {}, text('action'), action), reveal);
      }
      draw();
    }
  }
  return mounted;
}
export const widgets: WidgetReg[] = (['rubric', 'roleplay', 'signal-feed', 'boundary', 'events.roi'] as const).map(id => ({ id, mount: (el, props, ctx) => mountTrainer(id, el, props, ctx) }));
