// The exam page's part for exams on the learner's own machines (00 §6.6):
// what to order, the addresses, the scripts to read and run, the collector
// command for each machine and a box for the printed block. Every pasted
// block re-judges all real tasks; a goal that once held stays counted, as a
// passed task in the simulator does.

import { clear, copyText, downloadFile, h, toast } from '../../core/dom';
import { bi, t, type Bi } from '../../core/i18n';
import { renderInline } from '../../core/markdown';
import type { Exam, RealLab, RealTask } from '../../core/types';
import collectorText from './trainer-check-host.sh?raw';
import { collectorCommand, decodeHostBlob, heredoc, hostFacts, hostProblems, judgePaste, judgeReal, type MachinesFacts } from './facts';
import { collectFacts, detectLab, vmForMachine, type LabStatus } from '../../engine/locallab/client';
import './real.css';

export const COLLECTOR_NAME = 'trainer-check-host.sh';
export const COLLECTOR_TEXT: string = collectorText;

const L = {
  machines: bi('Ваши машины', 'Your machines'),
  order: bi('Что заказать', 'What to order'),
  addresses: bi('Адреса машин — те, по которым они видят друг друга. Они подставятся в команды ниже.', 'The machines’ addresses — the ones they use to reach each other. They are filled into the commands below.'),
  prepare: bi('Подготовка: прочитайте и запустите', 'Preparation: read and run'),
  collector: bi('Проверка: скрипт только читает', 'The check: the script only reads'),
  collectorNote: bi('Положите скрипт на каждую машину, прочитайте его целиком и запускайте после каждого шага. Он ничего не меняет, а к сети обращается только по адресам из команды. Блок, который он напечатает, вставьте в поле этой машины.', 'Put the script on every machine, read all of it and run it after every step. It changes nothing and reaches the network only at the addresses in the command. Paste the block it prints into the box of that machine.'),
  read: bi('Прочитать', 'Read it'),
  copy: bi('Копировать как команду', 'Copy as a command'),
  download: bi('Скачать', 'Download'),
  copied: bi('Скопировано', 'Copied'),
  notCopied: bi('Не получилось скопировать', 'Could not copy'),
  paste: bi('Блок от машины', 'The block from the machine'),
  verify: bi('Проверить', 'Verify'),
  bad: bi('Блок не читается: ', 'The block cannot be read: '),
  foreign: bi('Блок не от этой машины: ', 'The block is not from this machine: '),
  taken: bi('Факты сняты', 'Facts taken'),
  none: bi('Фактов с машины пока нет.', 'No facts from the machine yet.'),
  waiting: bi('ждём факты с', 'waiting for facts from'),
  privacy: bi('Блок разбирается здесь, в браузере, и никуда не уходит.', 'The block is decoded here, in the browser, and goes nowhere.'),
  code: bi('Одноразовый код этой попытки', 'The one-time code of this attempt'),
  fromLab: bi('Забрать из dtlab', 'Take from dtlab'),
  fromLabBusy: bi('Снимаем факты с машины', 'Taking facts from the machine'),
  fromLabFail: bi('dtlab не смог снять факты: ', 'dtlab could not take the facts: '),
  fromLabFound: bi('Найдена лаборатория dtlab: факты с её машин можно забрать кнопкой у каждой машины, без копирования блока.', 'A dtlab lab is running: take the facts from its machines with the button by each machine, without copying the block.'),
  local: bi('Машины не обязательно заказывать в облаке: локальная лаборатория dtlab бесплатно запускает виртуальные машины курса на вашем компьютере, а команда `dtlab facts` снимает с них блок для поля экзамена. Как её поставить, рассказано на странице [«Лаборатория на своём компьютере»](#/local-lab).', 'The machines do not have to be ordered in a cloud: the local lab dtlab runs the course’s virtual machines on your computer for free, and the `dtlab facts` command takes the block for the exam’s box from them. How to install it is told on the page [“A lab on your own computer”](#/local-lab).'),
};

function store(key: string): { get(k: string): string; set(k: string, v: string): void } {
  return {
    get(k) {
      try {
        return localStorage.getItem(`dt.real.${key}.${k}`) ?? '';
      } catch {
        return '';
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(`dt.real.${key}.${k}`, v);
      } catch {
        /* private mode: the page still works, it just forgets on reload */
      }
    },
  };
}

function newNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'bcdfghjkmnpqrstvwxz23456789'[b % 27]).join('');
}

function codeBox(text: () => string): { el: HTMLElement; refresh(): void } {
  const pre = h('pre.rl-pre');
  const refresh = () => (pre.textContent = text());
  refresh();
  const el = h('div.rl-code', {}, pre, h('button.btn.ghost.small', { type: 'button', onclick: async () => toast(t((await copyText(text())) ? L.copied : L.notCopied)) }, t(bi('Копировать', 'Copy'))));
  return { el, refresh };
}

function scriptBlock(name: string, on: string, note: Bi | null, text: string): HTMLElement {
  return h(
    'div.rl-script',
    {},
    h('p', {}, h('code', {}, name), on ? h('span.muted', {}, ` — ${on}`) : null, note ? h('span', {}, '. ', ...renderInline(t(note))) : null),
    h(
      'div.row',
      {},
      h('button.btn.small', { type: 'button', onclick: async () => toast(t((await copyText(heredoc(name, text))) ? L.copied : L.notCopied)) }, t(L.copy)),
      h('button.btn.ghost.small', { type: 'button', onclick: () => downloadFile(name, text, 'text/x-shellscript') }, t(L.download)),
    ),
    h('details.rl-read', {}, h('summary', {}, t(L.read)), h('pre.rl-pre.rl-long', {}, text)),
  );
}

export interface RealLabView {
  el: HTMLElement;
  facts(): MachinesFacts;
  dispose(): void;
}

/** The machines panel of an exam. `onChange` runs after every accepted block. */
export function mountRealLab(exam: Exam & { real: RealLab }, key: string, onChange: (m: MachinesFacts) => void): RealLabView {
  const lab = exam.real;
  const st = store(`${exam.id}.${key}`);
  let nonce = st.get('nonce');
  if (!nonce) {
    nonce = newNonce();
    st.set('nonce', nonce);
  }
  const addresses: Record<string, string> = {};
  for (const m of lab.machines) addresses[m.id] = store(exam.id).get(`addr.${m.id}`);
  const machines: MachinesFacts = {};
  const boxes: { refresh(): void }[] = [];
  // A running dtlab answers on 127.0.0.1:7788; then every machine gets a
  // one-click button next to the paste box. Without a lab nothing changes.
  const labButtons: { vm(status: LabStatus): void }[] = [];
  const labNote = h('p.small.rl-local', { hidden: true }, t(L.fromLabFound));
  const addrInputs = h(
    'div.rl-addrs',
    {},
    ...lab.machines.map((m) => {
      const input = h('input.rl-addr', { type: 'text', value: addresses[m.id], placeholder: '10.0.0.11', spellcheck: 'false', 'aria-label': `${m.id}` }) as HTMLInputElement;
      input.addEventListener('input', () => {
        addresses[m.id] = input.value.trim();
        store(exam.id).set(`addr.${m.id}`, addresses[m.id]);
        boxes.forEach((b) => b.refresh());
      });
      return h('label.rl-addr-row', {}, h('strong', {}, m.id), h('span.muted.small', {}, t(m.role)), input);
    }),
  );
  const perMachine = lab.machines.map((m) => {
    const box = codeBox(() => collectorCommand(m, { nonce, track: lab.track, addresses, collector: lab.collector?.name }));
    boxes.push(box);
    const paste = h('textarea.rl-paste', { spellcheck: 'false', rows: 4, 'aria-label': `${t(L.paste)} ${m.id}`, placeholder: '-----BEGIN TRAINER FACTS-----' }) as HTMLTextAreaElement;
    const status = h('p.small.muted.rl-status', { 'aria-live': 'polite' }, t(L.none));
    const verify = async () => {
      let facts;
      try {
        facts = hostFacts(await decodeHostBlob(paste.value));
      } catch (e) {
        status.textContent = t(L.bad) + (e as Error).message;
        status.className = 'small rl-status err';
        return;
      }
      const problems = hostProblems(facts, { nonce, machine: m.id, track: lab.track });
      if (problems.length) {
        status.textContent = t(L.foreign) + problems.map((p) => t(p)).join('; ');
        status.className = 'small rl-status err';
        return;
      }
      machines[m.id] = facts;
      status.textContent = `${t(L.taken)}: ${facts.hostname}, ${new Date(facts.env.at).toLocaleTimeString()}`;
      status.className = 'small rl-status ok';
      paste.value = '';
      onChange(machines);
    };
    const fromLab = h('button.btn.small', { type: 'button', hidden: true }, t(L.fromLab)) as HTMLButtonElement;
    labButtons.push({
      vm(labStatus) {
        const vm = vmForMachine(m.id, labStatus);
        if (!vm) return;
        fromLab.hidden = false;
        fromLab.textContent = `${t(L.fromLab)}: ${vm}`;
        fromLab.onclick = async () => {
          fromLab.disabled = true;
          status.textContent = `${t(L.fromLabBusy)} ${vm}…`;
          status.className = 'small muted rl-status';
          const ips = Object.fromEntries(labStatus.vms.map((v) => [v.name, v.ip]));
          const fill = (a: string) => a.replace(/\{([a-z0-9-]+)\}/gi, (_, id: string) => addresses[id]?.trim() || ips[vmForMachine(id, labStatus) ?? ''] || `${id.toUpperCase()}_ADDR`);
          try {
            paste.value = await collectFacts({ vm, nonce, machine: m.id, track: lab.track, script: lab.collector?.name, args: m.collect.map(fill) });
            await verify();
          } catch (e) {
            status.textContent = t(L.fromLabFail) + (e as Error).message;
            status.className = 'small rl-status err';
          } finally {
            fromLab.disabled = false;
          }
        };
      },
    });
    return h('section.rl-machine', {}, h('h3', {}, m.id, ' ', h('span.muted.small', {}, t(m.role))), box.el, paste, h('div.row', {}, h('button.btn.primary.small', { type: 'button', onclick: () => void verify() }, t(L.verify)), fromLab, h('span.small.muted', {}, t(L.privacy))), status);
  });
  const el = h(
    'section.rl-lab',
    {},
    h('h2', {}, t(L.machines)),
    h('details.rl-order', { open: true }, h('summary', {}, t(L.order)), h('p', {}, ...renderInline(t(lab.order))), h('p.small.rl-local', {}, ...renderInline(t(L.local))), labNote),
    h('p.small', {}, t(L.addresses)),
    addrInputs,
    lab.prepare?.length ? h('div', {}, h('h3', {}, t(L.prepare)), ...lab.prepare.map((s) => scriptBlock(s.name, s.on, s.note, s.text))) : null,
    h('h3', {}, t(L.collector)),
    h('p.small', {}, t(L.collectorNote), ' ', t(L.code), ': ', h('code', {}, nonce), '.'),
    scriptBlock(lab.collector?.name ?? COLLECTOR_NAME, '', null, lab.collector?.text ?? COLLECTOR_TEXT),
    ...perMachine,
  );
  let alive = true;
  // Exams whose machines run in this tab have nothing to take from a lab.
  if (!exam.inTab) {
    void detectLab().then((labStatus) => {
      if (!alive || !labStatus) return;
      labNote.hidden = false;
      labButtons.forEach((b) => b.vm(labStatus));
    });
  }
  return { el, facts: () => machines, dispose() { alive = false; } };
}

export interface RealCardView {
  el: HTMLElement;
  update(m: MachinesFacts): void;
}

/** One real task: its goals with their state; `onScore` gets the best share of goals held so far. */
export function mountRealCard(task: RealTask, opts: { feedback: boolean; onScore: (s: number) => void }): RealCardView {
  const list = h('ul.rl-goals');
  const held = new Set<string>();
  let best = 0;
  const report = (score: number) => {
    if (score > best) {
      best = score;
      opts.onScore(best);
    }
  };
  const update = (m: MachinesFacts) => {
    if (!task.goals) return;
    const r = judgeReal(task, m);
    for (const g of r.goals) if (g.result?.pass) held.add(g.goal.id);
    clear(list);
    for (const g of r.goals) {
      const ok = held.has(g.goal.id);
      const say = !ok && opts.feedback && g.result?.say ? t(g.result.say) : '';
      list.append(h('li', { class: ok ? 'ok' : g.waiting ? 'wait' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : g.waiting ? '·' : '⨯'), h('span.rl-goal', {}, ...renderInline(t(g.goal.label)), g.waiting && g.goal.on ? h('span.muted.small', {}, ` (${t(L.waiting)} ${g.goal.on})`) : null, say ? h('span.why', {}, say) : null)));
    }
    report(r.goals.length ? held.size / r.goals.length : 0);
  };
  let pasteEl: HTMLElement | null = null;
  if (task.paste) {
    const area = h('textarea.rl-paste', { spellcheck: 'false', rows: 5, 'aria-label': t(task.paste.label) }) as HTMLTextAreaElement;
    const st = h('p.small.rl-status', { 'aria-live': 'polite' });
    const check = () => {
      const ok = judgePaste(task, area.value);
      st.textContent = ok ? '✓' : '⨯';
      st.className = `small rl-status ${ok ? 'ok' : 'err'}`;
      if (ok) report(1);
    };
    pasteEl = h('div.rl-paste-task', {}, h('label.small', {}, t(task.paste.label)), area, h('button.btn.small', { type: 'button', onclick: check }, t(L.verify)), st);
  }
  const el = h('div.rl-card', {}, list, pasteEl);
  if (task.goals) update({});
  return { el, update };
}
