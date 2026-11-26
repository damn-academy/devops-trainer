import { h, copyText, downloadFile } from '../../core/dom';
import { bi, lang, t } from '../../core/i18n';
import { renderMd, renderInline } from '../../core/markdown';
import type { Mounted, WidgetCtx, WidgetReg } from '../../core/types';
import { ai, type AiService } from '../ai/service';
import type { ChatMessage } from '../ai/client';
import { eventVisitor } from './events';
import { trainers, datasets, systemPrompt, learnerData, copyPrompt, verdict, boundaryScore, breakEven, simulate, uniqueTargetAccounts, roiDefaults, type Verdict, type Choice, type RoiInput } from './model';
import { loadAttempts, saveAttempts, loadDraft, saveDraft, clearDraft } from './storage';
import { strings as s } from './strings';
/** How a template is used depends on the file: a model's formulas read the example cells, a sample only shows a filled-in row. */
function sharedGuide(file: string) {
  const open = bi('Скачайте шаблон и откройте его в Excel или Google Sheets на своём компьютере. ', 'Download the template and open it in Excel or Google Sheets on your computer. ');
  const field = bi(' Итог задания и выводы по таблице запишите в поле «Ваш текст» под заданием урока: оно одно на весь урок.', ' Write the task result and your conclusions in the “Your text” field under the lesson task: it is the only field of the lesson.');
  const work = file === 'infraseed-model'
    ? bi('Работа идёт в файле: замените учебный пример своими данными, формулы пересчитают отчёты. Исходные значения примера показывает лист «Сверка примера».', 'You work in the file: replace the worked example with your own data and the formulas recalculate the statements. The “Demo reconciliation” sheet shows the example’s original values.')
    : file === 'cash-13w'
      ? bi('Работа идёт в файле: сначала удалите учебные строки на листе «События» (в столбце «Документ» у них пометка example) и поставьте свой остаток на начало в ячейку B2 листа «Недели». Иначе ваши события сложатся с учебными в одном прогнозе.', 'You work in the file: first delete the example rows on the “Events” sheet (their “Document” column starts with example) and enter your opening balance in cell B2 of the “Weekly” sheet. Otherwise your events add up with the example ones in one forecast.')
      : file.startsWith('pr-')
        ? bi('Файл показывает пример заполнения; свою работу запишите в поле «Ваш текст» под заданием урока: оно одно на весь урок.', 'The file shows a filled-in example; write your own work in the “Your text” field under the lesson task: it is the only field of the lesson.')
        : bi('Работа идёт в файле: в нём уже заполнен учебный пример, ваши строки добавляйте ниже.', 'You work in the file: it already contains a worked example, add your rows below it.');
  const tail = file.startsWith('pr-') ? bi('', '') : field;
  return bi(open.ru + work.ru + tail.ru, open.en + work.en + tail.en);
}

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
    if (file === 'ru-intensifiers-lint') {
      title('ru-intensifiers-lint', false);
      root.append(h('p', {}, t(bi('Скачайте три файла в одну папку на своём компьютере. Установите Node.js по инструкции на nodejs.org и откройте терминал в этой папке. Выполните node ru-intensifiers-lint.mjs ru-intensifiers-sample.txt и сравните вывод с файлом ru-intensifiers-expected.txt. Каждое замечание проверьте вручную; в примере есть верное замечание и ложное срабатывание. Проверка завершается на вашем компьютере. После сверки нажмите «Завершить самопроверку» ниже.', 'Download all three files to one folder on your computer. Install Node.js using nodejs.org and open a terminal in that folder. Run node ru-intensifiers-lint.mjs ru-intensifiers-sample.txt and compare the output with ru-intensifiers-expected.txt. Review each candidate manually; the sample includes a true hit and a false alarm. This check finishes on your computer. After comparing the output, press “Finish self-review” below.'))));
      for (const name of ['ru-intensifiers-lint.mjs', 'ru-intensifiers-sample.txt', 'ru-intensifiers-expected.txt']) root.append(h('a', { class: 'btn', href: `${import.meta.env.BASE_URL}templates/${name}`, download: '' }, name));
      root.append(button('finishSelfReview', () => { ctx.complete(); status.textContent = text('selfReviewDone'); }), status);
      return mounted;
    }
    const titles = { 'metrics-cohorts': 'metricsCohorts', 'metrics-pipeline': 'metricsPipeline', 'metrics-forecast': 'metricsForecast', 'metrics-arr': 'metricsArr', 'metrics-arr-start': 'metricsArrStart', 'metrics-ab': 'metricsAb', 'infraseed-model': 'infraseedModel', 'cash-13w': 'cash13w', dream100: 'dream100', 'event-map': 'eventMap', 'llm-panel': 'llmPanel', 'signals-week': 'signalsWeek', 'pr-briefing': 'prBriefing', 'pr-news': 'prNews', 'pr-founder': 'prFounder' } as const;
    if (typeof file !== 'string' || !Object.hasOwn(titles, file)) { root.textContent = text('missing'); return mounted; }
    title(text(titles[file as keyof typeof titles]), false);
    const csv = file.startsWith('metrics-');
    // A spreadsheet template is worked on in the file; its result goes into the
    // lesson's single task document. CSV cards of the metrics course keep their
    // own calculation field, which the document export includes.
    const shared = !csv && !!ctx.sharedDocument;
    root.append(h('p.task-guide', {}, t(csv
      ? bi('Скачайте файл и импортируйте его в Excel или Google Sheets на своём компьютере, как описано под кнопкой. Выполните расчёт по заданию урока и запишите его в поле карточки. Сверьте результат с условиями задания сами и нажмите «Завершить самопроверку карточки»: раздел отметится выполненным, а расчёт останется в поле, в этом браузере и в файле, который скачивает кнопка «Скачать текст (.txt)» основного документа.', 'Download the file and import it into Excel or Google Sheets on your computer as described below the button. Do the lesson’s calculation and write it in the card field. Check the result against the task yourself and press “Finish the card self-review”: the section is marked done, and the calculation stays in the field, in this browser and in the file that the main document’s “Download text (.txt)” button saves.')
      : shared
        ? sharedGuide(file)
        : bi('Скачайте шаблон и откройте его в Excel или Google Sheets на своём компьютере. Работа идёт в файле; выводы запишите в поле ниже, сверьте их с условиями задания сами и нажмите «Завершить самопроверку»: раздел отметится выполненным, а выводы останутся в поле и в этом браузере.', 'Download the template and open it in Excel or Google Sheets on your computer. You work in the file; write your conclusions below, check them against the task yourself and press “Finish self-review”: the section is marked done and your conclusions stay in the field and in this browser.'))));
    if (csv) {
      root.append(h('p', {}, text('metricsFictional')), h('button', { type: 'button', class: 'btn', onclick: () => { void import('../ai/panel').then(({ openTutor }) => openTutor({ mode: 'practice', templateFile: file })); } }, t(bi('Спросить наставника о данных', 'Ask the tutor about the data'))));
    }
    root.append(h('a', { class: 'btn', href: `${import.meta.env.BASE_URL}templates/${file}${lang() === 'en' ? '-en' : ''}.${csv ? 'csv' : 'xlsx'}`, download: '' }, text(csv ? 'downloadCsv' : 'download')));
    if (csv) root.append(h('p', {}, text('csvImport')));
    const draftId = `template.${file}`;
    const saved = loadDraft(draftId, '');
    const fieldLabel = csv ? text('cardCalculation').replace('{name}', text(titles[file as keyof typeof titles])) : text('input');
    const input = h('textarea', { 'data-template-id': file, 'data-template-title': text(titles[file as keyof typeof titles]) }); input.value = saved;
    if (shared) {
      // Notes written here by earlier versions stay visible and in the export.
      if (saved.trim()) {
        input.oninput = () => saveDraft(draftId, input.value);
        root.append(h('label', {}, t(bi('Ваши прежние выводы по шаблону', 'Your earlier notes on the template')), input));
      }
      return mounted;
    }
    const finish = h('button', { type: 'button', class: 'btn', 'data-finish': '', disabled: !input.value.trim() }, text(csv ? 'finishCard' : 'finishSelfReview')) as HTMLButtonElement;
    input.oninput = () => { saveDraft(draftId, input.value); finish.disabled = !input.value.trim(); };
    finish.onclick = () => { if (!input.value.trim()) return; ctx.complete(); status.textContent = t(csv ? bi('Самопроверка карточки завершена. Расчёт сохранён в этом браузере.', 'Card self-review complete. The calculation is saved in this browser.') : bi('Самопроверка завершена. Выводы сохранены в этом браузере.', 'Self-review complete. Your conclusions are saved in this browser.')); };
    root.append(status);
    root.append(h('label', {}, fieldLabel, input), finish);

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
      result.hidden = false; remedies.hidden = false;
      if (!applicableChecks(governance, choices, fixes).length) { result.append(h('p', {}, text('governanceSuccess'))); ctx.complete(); }
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
    // Values stay in English for the prompt; the learner sees localized category names.
    const label: Record<string, [string, string]> = { 'Vendor user conference': ['Конференция пользователей поставщика', 'Vendor user conference'], Other: ['Другое', 'Other'], Security: ['Безопасность', 'Security'], Networking: ['Сети', 'Networking'], 'Vendor users': ['Пользователи поставщика', 'Vendor users'] };
    const option = (v: string) => h('option', { value: v }, label[v] ? t(bi(...label[v])) : v);
    const venue = h('select', {}, ...['KubeCon', 'PGConf', 'SREcon', 'RSAC', 'NANOG', 'Vendor user conference', 'Other'].map(option));
    const segment = h('select', {}, ...['Kubernetes', 'PostgreSQL', 'SRE', 'Security', 'Networking', 'Vendor users', 'Other'].map(option));
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
    root.append(h('p.task-guide', {}, t(kind === 'roleplay'
      ? bi('Напишите реплику в поле «Ваш текст» и нажмите «Отправить». Ответ собеседника появится в истории попыток; кнопка «Разбор» запрашивает оценку разговора по правилам выше.', 'Write a reply in “Your text” and press “Send”. The other person’s response appears in the attempt history; “Debrief” requests an assessment using the rules above.')
      : bi('Впишите работу в поле «Ваш текст» и нажмите «Проверить здесь». Нейросеть оценит работу по правилам выше; ответ появится в истории попыток.', 'Enter your work in “Your text” and press “Check here”. AI assesses it using the rules above; the response appears in the attempt history.')), ' ', t(bi('Для проверки на странице подключите нейросеть в ', 'To check on this page, connect AI in ')), h('a', { href: '#/settings' }, t(bi('настройках', 'settings'))), t(kind === 'roleplay'
      ? bi('. Можно также скопировать запрос в отдельный чат с нейросетью. Тогда сверяйте работу с разбором в том чате; страница его не получает. После сверки нажмите «Завершить самопроверку разговоров» внизу этого блока.', '. You can also copy the request to a separate AI chat. Review the feedback in that chat; this page does not receive it. After reviewing, press “Finish the conversation self-review” at the bottom of this block.')
      : bi('. Можно также скопировать запрос в отдельный чат с нейросетью. Тогда сверяйте работу с разбором в том чате; страница его не получает. После сверки нажмите «Завершить самопроверку текста» внизу этого блока.', '. You can also copy the request to a separate AI chat. Review the feedback in that chat; this page does not receive it. After reviewing, press “Finish the text self-review” at the bottom of this block.'))));
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
    // A rubric request without the learner's text would ask for a grade of nothing.
    const syncPrompt = () => { if (kind === 'rubric') (copy as HTMLButtonElement).disabled = (download as HTMLButtonElement).disabled = !input.value.trim(); };
    input.addEventListener('input', syncPrompt); syncPrompt();
    root.append(h('label', {}, text('input'), input), actions(send, ...(kind === 'roleplay' ? [debrief] : []), copy, download), status, manual, history);
    input.oninput = () => { saveDraft(trainer.id, input.value); manual.hidden = true; manual.value = ''; sync(); };
    const finish = h('button', { type: 'button', class: 'btn', 'data-finish': '' }, text(kind === 'roleplay' ? 'nextVisitor' : 'finishDraft'));
    finish.onclick = () => { if (busy) return; if (kind !== 'roleplay' && input.value.trim() && !window.confirm(t(bi('Очистить поле? Прошлые попытки останутся в истории ниже.', 'Clear the field? Earlier attempts stay in the history below.')))) return; input.value = ''; manual.value = ''; manual.hidden = true; clearDraft(trainer.id); if (kind === 'roleplay') { conversations.push([...attempts]); saveDraft(`${trainer.id}.conversations`, conversations); attempts.length = 0; saveAttempts(trainer.id, attempts); showHistory(); } sync(); };
    const selfReview = button(kind === 'roleplay' ? 'finishRoleplay' : 'finishRubric', () => { if (!input.value.trim() && !attempts.length && !conversations.length) return; ctx.complete(); status.textContent = text('selfReviewDone'); }) as HTMLButtonElement;
    const selfReviewHint = h('p', { class: 'small muted' }, t(bi('Кнопка станет доступна, когда в поле появится ваш текст.', 'The button becomes available once your text is in the field.')));
    const syncSelfReview = () => { const empty = !input.value.trim() && !attempts.length && !conversations.length; selfReview.disabled = empty; selfReviewHint.hidden = !empty; };
    input.addEventListener('input', syncSelfReview); finish.addEventListener('click', syncSelfReview); finish.addEventListener('click', syncPrompt); syncSelfReview();
    root.append(...(kind === 'roleplay' ? [round] : []), finish, selfReview, selfReviewHint); cleanup.push(svc.onChange(sync), () => request?.abort());
    void svc.ready.then(sync).catch(() => { if (!disposed) status.textContent = text('error'); }); sync();
  } else if (kind === 'events.roi') {
    title(text('roi'), false);
    root.append(h('p', {}, t(bi('Выберите начало воронки: сканы бейджей или приглашённые целевые компании. Затем меняйте переходы компаний к контакту, встрече, возможности сделки и покупке; сравните вероятность окупаемости.', 'Choose the funnel starting point: badge scans or invited target companies. Then vary company transitions to contact, meeting, opportunity and purchase; compare the probability of breaking even.'))));
    const fields = h('div', { class: 'tr-fields' }), result = h('div', { 'aria-live': 'polite' });
    const accountCount = h('p', { 'aria-live': 'polite' });
    const mode = h('select', { 'data-roi-mode': '' }, h('option', { value: 'scans' }, text('badgeMode')), h('option', { value: 'invited' }, text('invitedMode')));
    root.append(h('label', {}, text('eventMode'), mode), h('p', {}, text('shareFormat')));
    const assumptionText = h('p');
    const inputs = {} as Record<keyof typeof roiDefaults, HTMLInputElement>;
    for (const key of Object.keys(roiDefaults) as (keyof typeof roiDefaults)[]) {
      const share = !['cost', 'profit', 'scans', 'invited'].includes(key);
      const input = h('input', { type: 'number', 'data-roi-field': key, min: key === 'profit' ? .01 : 0, step: share ? .01 : 'any', value: roiDefaults[key], ...(share ? { max: 1 } : ['scans', 'invited'].includes(key) ? { max: 100000 } : {}) });
      inputs[key] = input; input.onchange = update; fields.append(h('label', {}, text(key), input));
      if (key === 'dedup') fields.append(accountCount);
    }
    function update() {
      const invitedMode = mode.value === 'invited';
      for (const [key, input] of Object.entries(inputs)) {
        input.disabled = invitedMode ? ['scans','target','dedup'].includes(key) : key === 'invited';
        input.parentElement!.hidden = input.disabled;
      }
      assumptionText.textContent = invitedMode ? `${text('invitedAssumptions')} ${text('simulationAssumptions')}` : text('assumptions');
      const p: RoiInput = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.valueAsNumber])) as typeof roiDefaults;
      p.mode = invitedMode ? 'invited' : 'scans';
      if (Object.values(inputs).some(v => !v.disabled && (!v.value || !Number.isFinite(v.valueAsNumber) || !v.checkValidity())) || !Number.isInteger(invitedMode ? p.invited : p.scans)) { accountCount.textContent = ''; result.textContent = text('invalid'); return; }
      accountCount.textContent = `${t(bi('Уникальные целевые компании', 'Unique target companies'))}: ${uniqueTargetAccounts(p)}`;
      const b = breakEven(p), m = simulate(p);
      const format = (n: number) => Number.isFinite(n) ? n.toLocaleString(lang(), { maximumFractionDigits: 2 }) : '∞';
      result.replaceChildren(h('p', {}, t(bi('Учебный сценарий', 'Teaching scenario'))), h('p', {}, `${t(bi('Уникальные целевые компании', 'Unique target accounts'))}: ${uniqueTargetAccounts(p)}`), ...([['wins', b.wins], ['winsWhole', Math.ceil(b.wins)], ['opportunities', b.opportunities], ['median', m.median], ['probability', m.probability * 100]] as const).map(([k, v]) => h('p', {}, `${text(k)}: ${format(v)}${k === 'probability' ? '%' : ''}`)), h('p', {}, text('payoff').replace('{n}', String(Math.round(m.probability * 100)))));
    }
    mode.onchange = update;
    root.append(fields, h('details', {}, h('summary', {}, t(bi('Допущения модели', 'Model assumptions'))), assumptionText), result); update();
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
