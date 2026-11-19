// The real-stage check (05 §11.5): the learner downloads and reads the
// read-only trainer-check.sh, runs it against their own cluster with a
// one-time code, and pastes the printed block here. The trainer decodes it
// and evaluates the same Check predicates that judge the simulator.

import './kube.css';
import { evaluateCheck } from '../../../core/check';
import { clear, copyText, h, toast } from '../../../core/dom';
import { bi, t, type Bi } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { blobFacts, decodeBlob, realityProblems } from '../checkblob';

export interface RealCheckProps {
  track: 'r1' | 'r3';
  checks: { id: string; label: Bi; when: string; hint?: Bi }[];
}

const L = {
  steps: bi('Как проверить свой кластер', 'How to check your cluster'),
  s1: bi('Скачайте скрипт и прочитайте его целиком: он только читает (kubectl get), ничего не меняет и не отправляет.', 'Download the script and read all of it: it only reads (kubectl get), changes nothing and sends nothing anywhere.'),
  s2: bi('Положите в кластер одноразовый код — так тренажёр видит, что блок снят с кластера, к которому у вас есть доступ:', 'Put the one-time code into the cluster — this is how the trainer sees the block comes from a cluster you have access to:'),
  s3: bi('Запустите скрипт и скопируйте всё между строками BEGIN и END:', 'Run the script and copy everything between the BEGIN and END lines:'),
  paste: bi('Вставьте блок сюда', 'Paste the block here'),
  verify: bi('Проверить', 'Verify'),
  copy: bi('Копировать', 'Copy'),
  copied: bi('Скопировано', 'Copied'),
  bad: bi('Блок не читается: ', 'The block cannot be read: '),
  suspicious: bi('Блок не похож на снятый с вашего кластера: ', 'The block does not look like it came from your cluster: '),
  all: bi('Все цели выполнены на настоящем кластере.', 'Every goal holds on the real cluster.'),
  privacy: bi('Блок разбирается здесь, в браузере, и никуда не отправляется. Секреты скрипт не читает.', 'The block is decoded here, in the browser, and sent nowhere. The script does not read Secrets.'),
};

function nonceFor(key: string): string {
  try {
    const k = `dt.k8s.nonce.${key}`;
    const v = localStorage.getItem(k);
    if (v) return v;
    const n = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'bcdfghjkmnpqrstvwxz23456789'[b % 27]).join('');
    localStorage.setItem(k, n);
    return n;
  } catch {
    return 'trainer';
  }
}

function codeBox(text: string): HTMLElement {
  return h('div.kr-code', {}, h('pre.kx-pre', {}, text), h('button.btn.ghost.small', { type: 'button', onclick: async () => toast(t((await copyText(text)) ? L.copied : bi('Не получилось', 'Could not copy'))) }, t(L.copy)));
}

function mountRealCheck(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = props as RealCheckProps;
  const nonce = nonceFor(`${ctx.lessonId}/${ctx.sectionId}`);
  const scriptUrl = new URL('check/trainer-check.sh', typeof document !== 'undefined' ? document.baseURI : 'https://localhost/').href;
  const paste = h('textarea.kr-paste', { spellcheck: 'false', 'aria-label': t(L.paste), placeholder: '-----BEGIN TRAINER CHECK-----' }) as HTMLTextAreaElement;
  const results = h('ul.kr-results', { 'aria-live': 'polite' });
  const verify = async () => {
    clear(results);
    let facts;
    try {
      facts = blobFacts(await decodeBlob(paste.value));
    } catch (e) {
      results.append(h('li', {}, h('span.ic-err', {}, '⨯'), h('span', {}, t(L.bad) + (e as Error).message)));
      return;
    }
    const problems = realityProblems(facts, nonce);
    if (problems.length) {
      results.append(h('li', {}, h('span.ic-err', {}, '⨯'), h('span', {}, t(L.suspicious) + problems.join('; '))));
      return;
    }
    let ok = 0;
    for (const c of p.checks) {
      const r = evaluateCheck({ when: c.when }, facts);
      if (r.pass) ok++;
      results.append(h('li', {}, h(r.pass ? 'span.ic-ok' : 'span.ic-err', {}, r.pass ? '✓' : '⨯'), h('span', {}, t(c.label)), !r.pass && c.hint ? h('span.why', {}, t(c.hint)) : null));
    }
    ctx.record({ kind: 'x.k8s.realcheck', track: p.track, passed: ok, total: p.checks.length });
    if (ok === p.checks.length) {
      results.append(h('li', {}, h('span.ic-ok', {}, '✓'), h('strong', {}, t(L.all))));
      ctx.complete();
    }
  };
  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('h4.kx-h', {}, t(L.steps)),
      h(
        'ol.kr-steps',
        {},
        h('li', {}, t(L.s1), codeBox(`curl -fsSLo trainer-check.sh ${scriptUrl}\nless trainer-check.sh`)),
        h('li', {}, t(L.s2), codeBox(`kubectl create configmap trainer-proof -n default --from-literal=nonce=${nonce}`)),
        h('li', {}, t(L.s3), codeBox(`bash trainer-check.sh --track ${p.track} --nonce ${nonce}`)),
      ),
      paste,
      h('div.kx-row', {}, h('button.btn.primary.small', { type: 'button', onclick: () => void verify() }, t(L.verify)), h('span.kx-note', {}, t(L.privacy))),
      results,
    ),
  );
  return { dispose() {}, describe: () => `Real cluster check (${p.track}): ${results.textContent ?? ''}` };
}

export const realCheckWidget: WidgetReg = { id: 'k8s.real-check', mount: mountRealCheck };
