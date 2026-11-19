// Self-check by output (05 §11.3): on the real stage some things cannot be
// seen through the API — swap, kernel modules, the cgroup driver, certificate
// dates, an etcd snapshot on disk. The learner runs a read-only command on
// their own machine and pastes what it printed; the trainer matches the text
// against the signs of a correct result and explains every sign that is
// missing. Nothing leaves the browser.

import './kube.css';
import { clear, copyText, h, toast } from '../../../core/dom';
import { bi, t, type Bi } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';

export interface OutputSign {
  id: string;
  label: Bi;
  /** A regular expression (source) the pasted output must match — or must not, with `absent`. */
  re: string;
  flags?: string;
  absent?: boolean;
  /** Shown when the sign is missing: what it means and what to do. */
  hint?: Bi;
}

export interface OutputCheckProps {
  /** Where to run the command: 'on cp-1', 'on every node'. */
  where?: Bi;
  /** The read-only command(s) whose output is pasted. */
  command: string;
  signs: OutputSign[];
}

const L = {
  run: bi('Выполните и скопируйте весь вывод', 'Run it and copy the whole output'),
  paste: bi('Вставьте вывод сюда', 'Paste the output here'),
  verify: bi('Сверить', 'Compare'),
  copy: bi('Копировать', 'Copy'),
  copied: bi('Скопировано', 'Copied'),
  empty: bi('Вставьте вывод команды.', 'Paste the output of the command.'),
  all: bi('Все признаки на месте.', 'Every sign is in place.'),
  privacy: bi('Текст сверяется здесь, в браузере, и никуда не отправляется.', 'The text is compared here, in the browser, and sent nowhere.'),
};

/** The pure part: which signs hold for a pasted text. */
export function matchSigns(text: string, signs: OutputSign[]): { id: string; pass: boolean }[] {
  return signs.map((s) => {
    const hit = new RegExp(s.re, s.flags ?? 'm').test(text);
    return { id: s.id, pass: s.absent ? !hit : hit };
  });
}

function mount(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = props as OutputCheckProps;
  const paste = h('textarea.kr-paste', { spellcheck: 'false', 'aria-label': t(L.paste), placeholder: '$ ' + p.command.split('\n')[0] }) as HTMLTextAreaElement;
  const results = h('ul.kr-results', { 'aria-live': 'polite' });
  const verify = () => {
    clear(results);
    if (!paste.value.trim()) {
      results.append(h('li', {}, h('span.ic-err', {}, '⨯'), h('span', {}, t(L.empty))));
      return;
    }
    const r = matchSigns(paste.value, p.signs);
    r.forEach((x, i) => {
      const s = p.signs[i];
      results.append(h('li', {}, h(x.pass ? 'span.ic-ok' : 'span.ic-err', {}, x.pass ? '✓' : '⨯'), h('span', {}, t(s.label)), !x.pass && s.hint ? h('span.why', {}, t(s.hint)) : null));
    });
    const ok = r.filter((x) => x.pass).length;
    ctx.record({ kind: 'x.k8s.outputcheck', section: ctx.sectionId ?? '', passed: ok, total: r.length });
    if (ok === r.length) {
      results.append(h('li', {}, h('span.ic-ok', {}, '✓'), h('strong', {}, t(L.all))));
      ctx.complete();
    }
  };
  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('h4.kx-h', {}, t(L.run) + (p.where ? ` — ${t(p.where)}` : '')),
      h('div.kr-code', {}, h('pre.kx-pre', {}, p.command), h('button.btn.ghost.small', { type: 'button', onclick: async () => toast(t((await copyText(p.command)) ? L.copied : bi('Не получилось', 'Could not copy'))) }, t(L.copy))),
      paste,
      h('div.kx-row', {}, h('button.btn.primary.small', { type: 'button', onclick: verify }, t(L.verify)), h('span.kx-note', {}, t(L.privacy))),
      results,
    ),
  );
  return { dispose() {}, describe: () => `Output self-check of "${p.command.split('\n')[0]}": ${results.textContent ?? ''}` };
}

export const outputCheckWidget: WidgetReg = { id: 'k8s.output-check', mount };
