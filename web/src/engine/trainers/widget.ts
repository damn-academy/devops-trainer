import { h, copyText, downloadFile } from '../../core/dom';
import { bi, lang, t } from '../../core/i18n';
import { renderMd, renderInline } from '../../core/markdown';
import type { Mounted, WidgetCtx, WidgetReg } from '../../core/types';
import { ai, type AiService } from '../ai/service';
import type { ChatMessage } from '../ai/client';
import { eventVisitor } from './events';
import { trainers, datasets, systemPrompt, learnerData, copyPrompt, verdict, boundaryScore, breakEven, simulate, roiDefaults, type Verdict, type Choice, type RoiInput } from './model';
import { loadAttempts, saveAttempts, loadDraft, saveDraft, clearDraft } from './storage';
import { strings as s } from './strings';
export type TrainerAi = Pick<AiService, 'status' | 'ready' | 'onChange' | 'stream'>;
import { governance, health, governanceRemedies, applicableChecks, governanceMarkdown, type Option } from './oss';
let instance = 0;
type Kind = 'governance' | 'health' | 'template' | 'rubric' | 'roleplay' | 'signal-feed' | 'boundary' | 'events.roi';
const css = `
.course-trainer{width:100%;max-width:760px;margin-inline:auto;display:grid;gap:16px;overflow-wrap:anywhere}
.course-trainer *{box-sizing:border-box;min-width:0}
.course-trainer label:not(.q-option){display:grid;gap:6px}
.course-trainer textarea{width:100%;min-height:120px;resize:vertical;font:inherit}
.course-trainer input:not([type=radio]),.course-trainer select,.course-trainer textarea{color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:8px}
.course-trainer .q-option input{flex:none}
.course-trainer .tr-actions{display:flex;flex-wrap:wrap;gap:8px}
.course-trainer .quiz-item{display:grid;gap:12px}
.course-trainer .tr-heading{font:600 .95rem/1.4 var(--font-ui)}
.course-trainer :is(p,h3,h4,ul){margin-block:0}
.course-trainer li+li{margin-top:6px}
.course-trainer .tr-feedback{display:grid;gap:12px}
.course-trainer .btn{justify-self:start;max-width:100%}
.course-trainer button.q-option{color:inherit;font:inherit;text-align:left}
.course-trainer button.q-option[aria-pressed=true]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.course-trainer pre{white-space:pre-wrap}
.course-trainer [hidden]{display:none!important}
.course-trainer .tr-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.course-trainer [role=status]:empty{display:none}`;
// Capitalize prose at display time, preserving authored data and inline code identifiers.
const explanation = (value: string) => renderInline(value.replace(/^(\s*(?:\*\*|\*)?)(\p{L})/u, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase(lang())));

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
    root.append(h('h3', {}, ...renderInline(value)));
    if (russian && lang() === 'en') root.append(h('p', {}, text('notice')));
    if (kind !== 'template') root.append(h('p', { class: 'tr-caveat' }, text('caveat')));
  };
  const id = props && typeof props === 'object' ? ('trainer' in props ? props.trainer : 'data' in props ? props.data : undefined) : undefined;
  if (kind === 'template') {
    const file = props && typeof props === 'object' && 'file' in props ? props.file : undefined;
    const titles = { 'infraseed-model': 'infraseedModel', 'cash-13w': 'cash13w', dream100: 'dream100', 'event-map': 'eventMap', 'llm-panel': 'llmPanel', 'signals-week': 'signalsWeek', 'pr-briefing': 'prBriefing', 'pr-news': 'prNews', 'pr-founder': 'prFounder' } as const;
    if (typeof file !== 'string' || !Object.hasOwn(titles, file)) { root.textContent = text('missing'); return mounted; }
    title(text(titles[file as keyof typeof titles]), false);
    root.append(h('a', { class: 'btn', href: `/templates/${file}${lang() === 'en' ? '-en' : ''}.xlsx`, download: '' }, text('download')));
    const draftId = `template.${file}`;
    const input = h('textarea'); input.value = loadDraft(draftId, '');
    input.oninput = () => saveDraft(draftId, input.value);
    const finish = h('button', { type: 'button', class: 'btn', 'data-finish': '' }, text('finishDraft'));
    finish.onclick = () => { clearDraft(draftId); input.value = ''; ctx.complete(); };
    root.append(h('label', {}, text('input'), input), finish);

  } else if (kind === 'governance') {
    if (id !== 'oss.governance') { root.textContent = text('missing'); return mounted; }
    title(governance.title); root.append(h('p', {}, ...renderInline(governance.description)));
    const choices = loadDraft<Record<string, Option>>(id, Object.fromEntries(governance.groups.map(g => [g.name, 'A'])));
    const fixes = loadDraft<Record<string, boolean>>(`${id}.fixes`, {});
    const result = h('div', { class: 'tr-feedback', hidden: true, 'aria-live': 'polite' });
    const output = h('textarea', { readonly: true, 'aria-label': 'GOVERNANCE.md', rows: 16 });
    const prefix = `governance-${++instance}`;
    governance.groups.forEach((group, i) => {
      const headingId = `${prefix}-${i}-heading`;
      const options = h('div', { class: 'q-options' });
      const field = h('div', { class: 'quiz-item', role: 'radiogroup', 'aria-labelledby': headingId }, h('h4', { id: headingId, class: 'tr-heading' }, ...renderInline(group.name)), options);
      (['A', 'B'] as const).forEach(option => {
        const radio = h('input', { type: 'radio', name: `${prefix}-${i}`, value: option, checked: option === choices[group.name] });
        radio.onchange = () => { choices[group.name] = option; saveDraft(id, choices); output.value = governanceMarkdown(governance, choices); result.hidden = true; };
        options.append(h('label', { class: 'q-option' }, radio, h('span', {}, ...renderInline(`${option}: ${group.options[option]}`))));
      }); root.append(field);
    });
    const remedies = h('div', { hidden: true });
    governanceRemedies.forEach((remedy, i) => {
      const toggle = h('input', { type: 'checkbox', checked: !!fixes[i] });
      toggle.onchange = () => { fixes[i] = toggle.checked; saveDraft(`${id}.fixes`, fixes); result.hidden = true; };
      remedies.append(h('label', { class: 'q-option' }, toggle, remedy));
    });
    output.value = governanceMarkdown(governance, choices);
    root.append(button('compareRepository', () => {
      result.replaceChildren(h('h4', {}, text('repositoryFacts')), h('ul', {}, ...governance.facts.map((f, i) => h('li', {}, ...renderInline(i > 0 && fixes[i - 1] ? governanceRemedies[i - 1] + ' ✓' : f)))), h('h4', {}, text('checks')), h('ul', {}, ...applicableChecks(governance, choices, fixes).map(c => h('li', {}, ...explanation(c)))));
      result.hidden = false; remedies.hidden = false; if (!applicableChecks(governance, choices, fixes).length) ctx.complete();
    }), remedies, result, h('h4', {}, 'GOVERNANCE.md'), output, button('copyGovernance', () => { void (async () => {
      const copied = await copyText(output.value);
      if (disposed) return;
      status.textContent = text(copied ? 'documentCopied' : 'documentFallback');
      if (!copied) { output.focus(); output.select(); }
    })(); }), status);
  } else if (kind === 'health') {
    if (id !== 'oss.health') { root.textContent = text('missing'); return mounted; }
    title(health.title); root.append(h('p', {}, ...renderInline(health.description)), h('ul', {}, ...health.metrics.map(m => h('li', {}, ...renderInline(m)))));
    let index = Math.max(0, Math.min(health.questions.length - 1, loadDraft(`${id}.index`, 0))); const card = h('article', { class: 'quiz-item' }); root.append(card);
    function draw() {
      const question = health.questions[index], input = h('textarea');
      input.value = loadDraft(`${id}.${index}`, ''); input.oninput = () => saveDraft(`${id}.${index}`, input.value);
      const answer = h('div', { class: 'tr-feedback', hidden: true, 'aria-live': 'polite' }, h('p', {}, ...explanation(question.answer)));
      const reveal = button('showDebrief', () => { answer.hidden = false; reveal.disabled = true; if (index === health.questions.length - 1) ctx.complete(); });
      if (index < health.questions.length - 1) answer.append(button('next', () => { index++; saveDraft(`${id}.index`, index); draw(); }));
      card.replaceChildren(h('p', {}, `${index + 1}/${health.questions.length}`), h('h4', {}, ...renderInline(question.question)), h('label', {}, text('input'), input), reveal, answer);
    }
    draw();
  } else if (kind === 'rubric' || kind === 'roleplay') {
    const trainer = trainers.find(v => v.id === id && (kind === 'roleplay' ? v.id === 'events.booth-visitor' : v.id !== 'events.booth-visitor'));
    if (!trainer) { root.textContent = text('missing'); return mounted; }
    const venue = h('select', {}, ...['KubeCon', 'PGConf', 'SREcon', 'RSAC', 'NANOG', 'Vendor user conference', 'Other'].map(v => h('option', { value: v }, v)));
    const segment = h('select', {}, ...['Kubernetes', 'PostgreSQL', 'SRE', 'Security', 'Networking', 'Vendor users', 'Other'].map(v => h('option', { value: v }, v)));
    venue.value = loadDraft(`${trainer.id}.venue`, 'KubeCon');
    segment.value = loadDraft(`${trainer.id}.segment`, 'Kubernetes');
    venue.onchange = () => {
      segment.value = ({ KubeCon: 'Kubernetes', PGConf: 'PostgreSQL', SREcon: 'SRE', RSAC: 'Security', NANOG: 'Networking', 'Vendor user conference': 'Vendor users', Other: 'Other' } as Record<string, string>)[venue.value];
      saveDraft(`${trainer.id}.venue`, venue.value); saveDraft(`${trainer.id}.segment`, segment.value); manual.hidden = true; manual.value = '';
    };
    segment.onchange = () => { saveDraft(`${trainer.id}.segment`, segment.value); manual.hidden = true; manual.value = ''; };
    const activeTrainer = () => kind === 'roleplay' ? eventVisitor(trainer!, venue.value, segment.value) : trainer!;
    if (kind === 'roleplay') root.append(h('label', {}, t(bi('Конференция', 'Conference')), venue), h('label', {}, t(bi('Сегмент', 'Segment')), segment));
    const svc = service ?? ai(); title(trainer.title); root.append(renderMd(trainer.rubric));
    const conversations = loadDraft<import('./storage').Attempt[][]>(`${trainer.id}.conversations`, []);
    const round = h('p');
    const attempts = loadAttempts(trainer.id), history = h('div');
    function showHistory() {
      round.textContent = `${t(bi("Посетитель", "Visitor"))} ${conversations.length + 1} / 5`;
      history.replaceChildren(h('h4', {}, text('history')));
      attempts.forEach((a, i) => history.append(h('article', { class: 'quiz-item' }, h('h4', {}, `${i + 1} · ${text('user')}`), h('p', { style: 'white-space:pre-wrap' }, ...renderInline(a.input)), h('h4', {}, text('assistant')), renderMd(a.answer))));
    }
    showHistory();
    const input = h('textarea'), manual = h('textarea', { 'aria-label': text('copy'), hidden: true });
    input.value = loadDraft(trainer.id, '');
    let busy = false, request: ReturnType<TrainerAi['stream']> | undefined;
    const sync = () => { if (disposed) return; venue.disabled = segment.disabled = busy || attempts.length > 0; send.disabled = busy || !svc.status.configured || svc.status.locked || !input.value.trim(); debrief.disabled = busy || !svc.status.configured || svc.status.locked; status.textContent = busy ? text('busy') : !svc.status.configured || svc.status.locked ? text('settings') : ''; };
    async function submit(value: string) {
      if (busy || !svc.status.configured || svc.status.locked || !value.trim()) return;
      busy = true; sync();
      const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(activeTrainer()) }];
      if (kind === 'roleplay') for (const a of attempts) messages.push({ role: 'user', content: a.input === 'Разбор' ? a.input : learnerData(a.input) }, { role: 'assistant', content: a.answer });
      messages.push({ role: 'user', content: kind === 'roleplay' && value === 'Разбор' ? value : learnerData(value) });
      let failed = false;
      try {
        request = svc.stream({ messages, maxTokens: 2400, temperature: kind === 'roleplay' ? .7 : .3 }, () => {});
        const answer = await request.done;
        if (disposed) return;
        attempts.push({ input: value, answer }); saveAttempts(trainer!.id, attempts); showHistory(); ctx.complete();
      } catch { failed = true; }
      finally { busy = false; request = undefined; if (!disposed) { sync(); if (failed) status.textContent = text('error'); } }
    }
    const send = button(kind === 'rubric' ? 'check' : 'send', () => { void submit(input.value); });
    const debrief = button('debrief', () => { void submit('Разбор'); });
    const currentPrompt = () => copyPrompt(activeTrainer(), kind === 'roleplay' ? attempts.map(a => `${text('user')}: ${a.input}\n${text('assistant')}: ${a.answer}`).join('\n\n') + '\n\n' + input.value : input.value);
    const copy = button('copy', () => { void (async () => {
      const prompt = !manual.hidden ? manual.value : currentPrompt();
      if (await copyText(prompt)) { if (!disposed) status.textContent = text('copied'); }
      else if (!disposed) { manual.hidden = false; manual.value = prompt; manual.focus(); manual.select(); status.textContent = text('fallback'); }
    })(); });
    const download = button('downloadPrompt', () => downloadFile('prompt.txt', !manual.hidden ? manual.value : currentPrompt(), 'text/plain;charset=utf-8'));
    root.append(h('label', {}, text('input'), input), actions(send, ...(kind === 'roleplay' ? [debrief] : []), copy, download), status, manual, history);
    input.oninput = () => { saveDraft(trainer.id, input.value); manual.hidden = true; manual.value = ''; sync(); };
    const finish = h('button', { type: 'button', class: 'btn', 'data-finish': '' }, text(kind === 'roleplay' ? 'nextVisitor' : 'finishDraft'));
    finish.onclick = () => { if (busy) return; input.value = ''; manual.value = ''; manual.hidden = true; clearDraft(trainer.id); if (kind === 'roleplay') { conversations.push([...attempts]); saveDraft(`${trainer.id}.conversations`, conversations); attempts.length = 0; saveAttempts(trainer.id, attempts); showHistory(); } sync(); };
    root.append(...(kind === 'roleplay' ? [round] : []), finish); cleanup.push(svc.onChange(sync), () => request?.abort());
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
      result.replaceChildren(h('p', {}, t(bi('Учебный сценарий', 'Teaching scenario'))), h('p', {}, `${t(bi('Уникальные целевые компании', 'Unique target accounts'))}: ${Math.round(p.scans * p.target * p.dedup)}`), ...([['wins', b.wins], ['opportunities', b.opportunities], ['median', m.median], ['probability', m.probability * 100]] as const).map(([k, v]) => h('p', {}, `${text(k)}: ${format(v)}${k === 'probability' ? '%' : ''}`)), h('p', {}, text('payoff').replace('{n}', String(Math.round(m.probability * 100)))));
    }
    root.append(fields, h('details', {}, h('summary', {}, t(bi('Допущения модели', 'Model assumptions'))), h('p', {}, text('assumptions'))), result); update();
  } else {
    const data = datasets.find(d => d.id === id && d.id === (kind === 'boundary' ? 'product.boundary' : 'sales.signal-feed'));
    if (!data) { root.textContent = text('missing'); return mounted; }
    title(data.title);
    if (kind === 'boundary') {
      const choices: Choice[] = loadDraft(data.id, data.rows.map(() => 'open' as Choice)), reveals: HTMLElement[] = [];
      data.rows.forEach((row, i) => {
        const name = `boundary-${++instance}`, headingId = `${name}-heading`;
        const options = h('div', { class: 'q-options', role: 'radiogroup', 'aria-labelledby': headingId });
        for (const value of ['open', 'paid'] as const) {
          const radio = h('input', { type: 'radio', name, value, checked: value === choices[i] });
          radio.onchange = () => { choices[i] = value; saveDraft(data!.id, choices); reveals.forEach(r => { r.hidden = true; }); status.textContent = ''; };
          options.append(h('label', { class: 'q-option' }, radio, h('span', {}, text(value))));
        }
        const reveal = h('div', { class: 'tr-feedback', hidden: true }, h('p', {}, ...explanation(`${text('expected')}: ${row[1]}`)), h('p', {}, ...explanation(row[2])), h('p', {}, ...explanation(row[3]))); reveals.push(reveal);
        root.append(h('article', { class: 'quiz-item' }, h('h4', { id: headingId }, ...renderInline(row[0])), options, reveal));
      });
      root.append(button('reaction', () => { reveals.forEach(r => { r.hidden = false; }); const score = boundaryScore(data.rows, choices); status.textContent = (Object.keys(score) as (keyof typeof score)[]).map(k => `${text(k)}: ${score[k]}`).join(' · '); ctx.complete(); }), status);
    } else {
      root.append(h('p', { class: 'tr-caveat' }, t(bi('Оценивается только то, как вы классифицировали сигнал. Ваше действие сохраняется, чтобы вы сами сравнили его с разбором; на оценку оно не влияет.', 'Only the signal classification is scored. Your action is saved for self-review against the worked explanation; it does not affect the score.'))));
      const saved = loadDraft<{ index: number; answers: { choice: Verdict; action: string }[]; choice?: Verdict; action: string; revealed: boolean }>(data.id, { index: 0, answers: [], action: '', revealed: false });
      let index = saved.index; const answers = saved.answers, card = h('article', { class: 'quiz-item' }); root.append(card);
      function draw() {
        card.replaceChildren();
        if (index === data!.rows.length) {
          const misses = data!.rows.map((r, i) => ({ r, i })).filter(({ r, i }) => answers[i].choice !== verdict(r[1]));
          card.append(h('h4', {}, `${text('score')}: ${index - misses.length}/${index}`), h('h4', {}, text('misses')));
          misses.forEach(({ r, i }) => card.append(h('article', { class: 'quiz-item' }, h('p', {}, ...renderInline(r[0])), h('p', {}, `${text('chosen')}: ${text(answers[i].choice)}`), h('p', {}, ...renderInline(answers[i].action)), ...r.slice(1).map(line => h('p', {}, ...explanation(line)))))); ctx.complete(); return;
        }
        const row = data!.rows[index]; let choice: Verdict | undefined = saved.choice;
        const persist = () => saveDraft(data!.id, { index, answers, choice, action: action.value, revealed: action.disabled });
        const action = h('textarea'), reveal = button('reveal', () => {
          if (!choice) return; answers.push({ choice, action: action.value });
          buttons.forEach(b => { b.disabled = true; }); action.disabled = true; reveal.disabled = true;
          card.append(h('p', {}, ...explanation(row[1])), h('p', {}, ...explanation(row[2])), h('p', {}, ...explanation(row[3])), button('next', () => { index++; saved.choice = undefined; saved.action = ''; saved.revealed = false; saveDraft(data!.id, { index, answers, action: '', revealed: false }); draw(); }));
          persist();
        }); reveal.disabled = !choice;
        const buttons = (['signal', 'noise', 'verify'] as const).map(v => { const b = button(v, () => { choice = v; persist(); buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b))); reveal.disabled = false; }); b.className = 'q-option'; b.setAttribute('aria-pressed', String(choice === v)); return b; });
        action.value = saved.action; action.oninput = persist;
        if (saved.revealed) { answers.pop(); reveal.click(); }
        card.prepend(h('p', {}, `${index + 1}/${data!.rows.length}`), h('p', {}, ...renderInline(row[0])), h('div', { class: 'q-options', role: 'group', 'aria-label': text('chosen') }, ...buttons), h('label', {}, text('action'), action), reveal);
      }
      draw();
    }
  }
  return mounted;
}
export const widgets: WidgetReg[] = (['rubric', 'roleplay', 'signal-feed', 'boundary', 'events.roi', 'governance', 'health', 'template'] as const).map(id => ({ id, mount: (el, props, ctx) => mountTrainer(id, el, props, ctx) }));
