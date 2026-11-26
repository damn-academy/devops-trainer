import { h, copyText, downloadFile } from '../../core/dom';
import { bi, lang, t } from '../../core/i18n';
import type { ChatMessage, WidgetReg, WidgetCtx, Mounted } from '../../core/types';
import { renderMd } from '../../core/markdown';
import { ai, type AiService } from '../ai/service';
import { buildPrompt, compatibleCompany, companyText, hasFence, promptSize, randomCompany, randomSeed, trimHistory } from './model';
import { getScenario } from './registry';
import { companyGroups, defaultCompanyConfig, normalizeCompanyConfig } from '../../sims/companies';
import { legends } from './legends';
import { loadGame, saveGame } from './storage';
import { strings as s } from './strings';
import type { Difficulty, SimGame, SimScenario } from './types';

export type SimAi = Pick<AiService, 'status' | 'ready' | 'onChange' | 'stream'>;
const css = `
.deptsim { width:100%; max-width:760px; margin-inline:auto; display:grid; gap:14px; overflow-wrap:anywhere; }
.deptsim *, .deptsim *::before { box-sizing:border-box; min-width:0; }
.deptsim > p { margin:0; }
.deptsim [role=status]:empty { display:none; }
.deptsim [hidden] { display:none!important; }
.deptsim fieldset { border:0; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:12px; }
.deptsim label { display:grid; gap:5px; }
.deptsim .ds-difficulty { display:flex; flex-wrap:wrap; gap:10px; }
.deptsim .ds-difficulty label { display:flex; align-items:center; }
.deptsim .ds-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.deptsim textarea { width:100%; min-height:100px; resize:vertical; font:inherit; }
.deptsim pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:360px; overflow:auto; font-size:13px; }
.deptsim .ds-transcript { display:grid; gap:12px; max-height:65vh; overflow:auto; }
.deptsim article { border-bottom:1px solid var(--line,#d8dee9); padding:8px 0; }
.deptsim .ds-user { white-space:pre-wrap; }
.deptsim details { border:1px solid var(--line,#d8dee9); border-radius:6px; padding:8px; }
.deptsim summary { cursor:pointer; }
.deptsim .ds-pane { display:grid; gap:12px; }
`;
let mountId = 0;

export function exportGame(scenario: SimScenario, game: SimGame): string {
  const l = game.lang;
  const o = game.options;
  return [`# ${scenario.title[l]}`, `${s.seed[l]}: ${o.seed}`, `${s.company[l]}: ${o.companyMode === 'custom' ? companyText(o, l) : `${legends.find(c => c.id === o.company)!.title[l]} (${o.company})`}`, `${s.difficulty[l]}: ${s[o.difficulty][l]}`, `${s.turns[l]}: ${o.turns} × ${scenario.turnUnit[l]}`,
    ...game.messages.map(m => `## ${m.role === 'assistant' ? s.assistant[l] : s.user[l]}\n\n${m.content}`)].join('\n\n') + '\n';
}

export function mountDeptSim(el: HTMLElement, props: unknown, ctx: WidgetCtx, service: SimAi = ai()): Mounted {
  const id = props && typeof props === 'object' && 'scenario' in props ? props.scenario : undefined;
  const scenario = typeof id === 'string' ? getScenario(id) : undefined;
  const root = h('div', { class: 'deptsim' });
  const style = h('style', {}, css);
  el.append(style, root);
  if (!scenario) {
    root.textContent = t(s.missing);
    return { dispose() { root.remove(); style.remove(); } };
  }
  const fresh = (): SimGame => ({ version: 1, options: { eventFormat: 'no-booth', seed: randomSeed(), company: scenario.id === 'oss.incubation' ? 'lumenmesh' : legends[0].id, companyMode: 'preset', companyConfig: defaultCompanyConfig(), difficulty: 'like-life', turns: scenario.turns.default }, lang: lang(), prompt: '', messages: [], started: false });
  let game = loadGame(scenario) ?? fresh();
  if (!compatibleCompany(scenario, game.options)) game = fresh();
  let disposed = false, busy = false, completed = false, generation = 0;
  let request: ReturnType<SimAi['stream']> | undefined;
  let paneOpen = game.started;
  const text = (key: keyof typeof s) => t(s[key]);
  const button = (key: keyof typeof s, action: () => void) => h('button', { class: 'btn', type: 'button', onclick: action }, text(key));
  const status = h('p', { role: 'status', 'aria-live': 'polite' });
  const settings = h('fieldset');
  const company = h('select', {}, ...legends.filter(l => scenario.id !== 'oss.incubation' || l.id === 'lumenmesh').map(l => h('option', { value: l.id }, t(l.title))));
  company.value = game.options.company;
  const companyMode = h('div', { class: 'ds-difficulty', role: 'radiogroup', 'aria-label': text('company') });
  const companyName = `deptsim-company-${++mountId}`;
  for (const value of ['preset', 'custom'] as const) {
    if (scenario.id === 'oss.incubation' && value === 'custom') continue;
    const radio = h('input', { type: 'radio', name: companyName, value });
    radio.onchange = () => { game.options.companyMode = value; syncCompany(); updatePrompt(); };
    companyMode.append(h('label', {}, radio, text(value)));
  }
  const presetCompany = h('label', {}, text('preset'), company);
  const customCompany = h('div', { class: 'ds-company-config' });
  const configSelects = companyGroups.map(group => {
    const select = h('select', {}, ...group.options.map(o => h('option', { value: o.value }, o.label)));
    select.onchange = () => { game.options.companyConfig![group.key] = select.value; syncCompany(); updatePrompt(); };
    customCompany.append(h('label', {}, group.label, select));
    return select;
  });
  const randomize = button('randomCompany', () => {
    game.options.companyMode = 'custom'; game.options.companyConfig = randomCompany(game.options.seed);
    syncCompany(); updatePrompt();
  });
  randomize.hidden = scenario.id === 'oss.incubation';
  function syncCompany() {
    game.options.companyConfig = normalizeCompanyConfig(game.options.companyConfig ?? defaultCompanyConfig());
    const mode = game.options.companyMode ?? 'preset';
    companyMode.querySelectorAll<HTMLInputElement>('input').forEach(r => { r.checked = r.value === mode; });
    presetCompany.hidden = mode !== 'preset'; customCompany.hidden = mode !== 'custom';
    configSelects.forEach((select, i) => { select.value = game.options.companyConfig![companyGroups[i].key]; Array.from(select.options).forEach(o => { o.disabled = companyGroups[i].key === 'business' && o.value === 'open-core' && game.options.companyConfig!.code === 'proprietary'; }); });
  }
  syncCompany();
  const difficulty = h('div', { class: 'ds-difficulty', role: 'radiogroup', 'aria-label': text('difficulty') });
  const radioName = `deptsim-difficulty-${++mountId}`;
  for (const value of ['soft', 'like-life', 'hard'] as Difficulty[]) {
    const radio = h('input', { type: 'radio', name: radioName, value });
    radio.checked = game.options.difficulty === value;
    radio.onchange = () => { game.options.difficulty = value; updatePrompt(); };
    difficulty.append(h('label', {}, radio, text(value)));
  }
  const turns = h('input', { type: 'range', min: scenario.turns.min, max: scenario.turns.max, step: 1, value: game.options.turns });
  const length = h('output');
  const seed = h('input', { type: 'number', min: 0, max: 0xffffffff, step: 1, value: game.options.seed });
  settings.append(companyMode, presetCompany, customCompany, randomize, h('div', {}, text('difficulty'), difficulty), h('label', {}, text('turns'), turns, length), h('label', {}, text('seed'), seed));
  const eventFormat = h('select', {}, h('option', { value: 'no-booth' }, t(bi('Без стенда', 'No booth'))), h('option', { value: 'booth' }, t(bi('Со стендом', 'Booth'))));
  eventFormat.value = game.options.eventFormat ?? 'no-booth';
  eventFormat.onchange = () => { game.options.eventFormat = eventFormat.value as 'no-booth' | 'booth'; updatePrompt(); };
  if (scenario.id === 'events.kubecon') settings.append(h('label', {}, t(bi('Формат участия', 'Participation format')), eventFormat));
  const cncfStart = h('select', {}, h('option', { value: 'sandbox' }, 'Sandbox → Incubating'), h('option', { value: 'incubating' }, 'Incubating → Graduated'));
  cncfStart.value = game.options.cncfStart ?? 'incubating';
  cncfStart.onchange = () => { game.options.cncfStart = cncfStart.value as 'sandbox' | 'incubating'; updatePrompt(); };
  if (scenario.id === 'oss.incubation') settings.append(h('label', {}, t(bi('Переход проекта', 'Project transition')), cncfStart));
  company.onchange = () => { game.options.company = company.value; updatePrompt(); };
  turns.oninput = () => { game.options.turns = Number(turns.value); updatePrompt(); };
  seed.onchange = () => {
    const n = Number(seed.value);
    if (seed.value && Number.isInteger(n) && n >= 0 && n <= 0xffffffff) game.options.seed = n;
    seed.value = String(game.options.seed); updatePrompt();
  };
  const promptText = h('pre', { class: 'ds-prompt' });
  const size = h('span', { class: 'ds-prompt-size', 'aria-live': 'polite' });
  const longHint = h('p', { hidden: true }, text('longPrompt'));
  const languageNotice = h('p', { hidden: !(scenario.russianPrompt && lang() === 'en') }, text('russianPrompt'));
  const promptDetails = h('details', {}, h('summary', {}, text('show')), promptText);
  const fallback = h('textarea', { readonly: true, hidden: true, 'aria-label': text('fallback') });
  const copy = button('copy', () => { void (async () => {
    const prompt = game.prompt;
    const copied = await copyText(prompt);
    if (disposed) return;
    fallback.hidden = copied;
    status.textContent = text(copied ? 'copied' : 'fallback');
    if (!copied) { fallback.value = prompt; fallback.focus(); fallback.select(); }
  })(); });
  const transcript = h('div', { class: 'ds-transcript', role: 'log', 'aria-label': text('play') });
  const input = h('textarea', { 'aria-label': text('input') });
  const send = button('send', () => { void submit(input.value); });
  const stop = button('stop', () => stopStream());
  const pane = h('div', { class: 'ds-pane' }, transcript, h('label', {}, text('input'), input), h('div', { class: 'ds-actions' }, send, stop));
  const play = button('play', () => { paneOpen = true; updateControls(); input.focus(); if (!game.started) void submit(t(s.start, game.lang)); });
  const link = h('a', { href: '#/settings' }, text('settings'));
  const confirmation = h('div', { hidden: true }, text('confirm'), h('div', { class: 'ds-actions' }, button('reset', reset), button('cancel', () => { confirmation.hidden = true; })));
  const newGame = button('newGame', () => { confirmation.hidden = false; });
  const exportButton = button('export', () => downloadFile(`${scenario.id}-${game.options.seed}.md`, exportGame(scenario, game), 'text/markdown;charset=utf-8'));
  root.append(h('h3', {}, t(scenario.title)), ...scenario.premise[lang()].split(/\n\s*\n/).slice(0, 2).map(p => h('p', {}, p)), h('p', { class: 'deptsim-note' }, text('note')), settings,
    h('div', { class: 'ds-actions' }, copy, h('button.btn', { type: 'button', onclick: () => downloadFile('prompt.txt', game.prompt, 'text/plain;charset=utf-8') }, t(bi('Скачать запрос (.txt)', 'Download prompt (.txt)'))), status, size, play, newGame, exportButton), longHint, languageNotice, link, promptDetails, fallback, confirmation, pane);
  input.oninput = updateControls;
  input.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(input.value); } };

  function persist() { saveGame(scenario!.id, game); }
  function checkComplete() {
    if (!completed && game.messages.some(m => m.role === 'assistant' && hasFence(m.content, 'debrief'))) { completed = true; ctx.complete(); }
  }
  function renderMessage(message: ChatMessage, body: HTMLElement) {
    // Preserve the learner's expanded ledger while deltas arrive.
    const open = [...body.querySelectorAll('details')].map(d => d.open);
    if (message.role === 'user') { body.className = 'ds-user'; body.textContent = message.content; }
    else body.replaceChildren(renderMd(message.content, { lang: game.lang, code: (code, info) => info === 'state'
      ? h('details', {}, h('summary', {}, text('state')), h('pre', {}, code)) : h('pre', {}, code) }));
    body.querySelectorAll('details').forEach((d, i) => { d.open = open[i] ?? false; });
  }
  function appendMessage(message: ChatMessage): HTMLElement {
    const body = h('div'); renderMessage(message, body);
    transcript.append(h('article', {}, h('strong', {}, text(message.role === 'assistant' ? 'assistant' : 'user')), body));
    return body;
  }
  function updatePrompt() {
    if (!game.started) { game.lang = lang(); game.prompt = buildPrompt(scenario!, game.options, game.lang); }
    promptText.textContent = game.prompt;
    const measure = promptSize(game.prompt);
    size.textContent = `${measure.characters} ${text('characters')} · ${measure.tokens} ${text('tokens')}`;
    longHint.hidden = measure.characters <= 60000;
    length.textContent = `${game.options.turns} × ${scenario!.turnUnit[game.lang]}`;
    fallback.hidden = true;
    persist();
  }
  function updateControls() {
    if (disposed) return;
    settings.disabled = game.started || busy;
    play.disabled = !service.status.configured || busy;
    link.hidden = service.status.configured;
    pane.hidden = !paneOpen;
    send.disabled = busy || !service.status.configured || !input.value.trim();
    input.disabled = busy;
    stop.hidden = !busy;
    exportButton.disabled = !game.messages.length;
  }
  function stopStream() {
    generation++; const active = request; request = undefined; busy = false;
    active?.abort(); status.textContent = text('stopped'); persist(); checkComplete(); updateControls();
  }
  function reset() {
    stopStream();
    game = fresh(); completed = false; paneOpen = false;
    syncCompany();
    eventFormat.value = game.options.eventFormat ?? 'no-booth';
    cncfStart.value = game.options.cncfStart ?? 'incubating';
    company.value = game.options.company; turns.value = String(game.options.turns); seed.value = String(game.options.seed);
    difficulty.querySelectorAll<HTMLInputElement>('input').forEach(r => { r.checked = r.value === game.options.difficulty; });
    transcript.replaceChildren(); input.value = ''; status.textContent = ''; confirmation.hidden = true;
    updatePrompt(); updateControls();
  }
  async function submit(value: string) {
    if (disposed || busy || !service.status.configured || !value.trim()) return;
    game.started = true; busy = true; status.textContent = ''; input.value = '';
    const token = ++generation;
    const user: ChatMessage = { role: 'user', content: value.trim() };
    game.messages.push(user); appendMessage(user);
    const messages = trimHistory([{ role: 'system', content: game.prompt }, ...game.messages.filter(m => m.content.trim())]);
    const reply: ChatMessage = { role: 'assistant', content: '' };
    game.messages.push(reply); const body = appendMessage(reply);
    persist(); updateControls();
    try {
      request = service.stream({ messages, maxTokens: 4096, temperature: 0.7 }, delta => {
        if (disposed || token !== generation) return;
        reply.content += delta; renderMessage(reply, body); persist(); checkComplete();
      });
      const answer = await request.done;
      if (disposed || token !== generation) return;
      reply.content = answer; renderMessage(reply, body); checkComplete();
    } catch {
      if (!disposed && token === generation) status.textContent = text('error');
    } finally {
      if (!disposed && token === generation) { busy = false; request = undefined; persist(); updateControls(); input.focus(); }
    }
  }
  game.messages.forEach(appendMessage);
  updatePrompt(); updateControls(); checkComplete();
  const unsubscribe = service.onChange(updateControls);
  void service.ready.then(updateControls).catch(() => { if (!disposed) status.textContent = text('error'); });
  return { dispose() { disposed = true; generation++; request?.abort(); unsubscribe(); root.remove(); style.remove(); }, describe: () => t(scenario.title) };
}
export const deptsimWidget: WidgetReg = { id: 'deptsim', mount: mountDeptSim };
