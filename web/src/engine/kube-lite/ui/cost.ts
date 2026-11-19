// The cost screen of a paid-resource lesson (01 §7.4, 05 §11.2): how many
// VMs the track needs, the price per VM-hour the learner reads on the
// provider's page today, and what it costs if the cleanup is forgotten for
// a month. Prices are not built in: they change, and the course table
// (providers.yaml, 09 §5.2) is not delivered yet — this is its placeholder.

import './kube.css';
import { clear, h } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';

export interface CostProps {
  vms: number;
  hours: number;
}

export const PROVIDERS = [
  { id: 'hetzner', name: 'Hetzner Cloud', url: 'https://www.hetzner.com/cloud/', unit: '€', note: bi('2 vCPU / 4 ГБ; IPv4 оплачивается отдельно', '2 vCPU / 4 GB; IPv4 is billed separately') },
  { id: 'yandex', name: 'Yandex Cloud', url: 'https://yandex.cloud/ru/prices', unit: '₽', note: bi('прерываемые ВМ дешевле, но могут остановиться', 'preemptible VMs are cheaper but may be stopped') },
  { id: 'selectel', name: 'Selectel', url: 'https://selectel.ru/prices/', unit: '₽', note: bi('облачные серверы, почасовая оплата', 'cloud servers, hourly billing') },
  { id: 'aws', name: 'AWS EC2', url: 'https://aws.amazon.com/ec2/pricing/on-demand/', unit: '$', note: bi('t3.medium по требованию; трафик наружу платный', 't3.medium on demand; outbound traffic is paid') },
  { id: 'local', name: bi('Своя машина (Multipass, UTM, Vagrant)', 'Your own machine (Multipass, UTM, Vagrant)'), url: 'https://canonical.com/multipass', unit: '', note: bi('бесплатно; для трёх ВМ нужно 12+ ГБ ОЗУ', 'free; three VMs need 12+ GB of RAM') },
];

const L = {
  provider: bi('Где', 'Where'),
  price: bi('Цена ВМ-часа (с сайта сегодня)', 'Price per VM-hour (from the site today)'),
  total: bi('За прохождение', 'For the track'),
  month: bi('Если забыть на месяц', 'If forgotten for a month'),
  vms: bi('ВМ', 'VMs'),
  hours: bi('часов работы', 'hours of work'),
  note: bi('Цены меняются, поэтому тренажёр их не подставляет: откройте страницу провайдера и впишите цену ВМ-часа. Месяц — это 730 часов: так выглядит счёт за неубранный стенд.', 'Prices change, so the trainer does not fill them in: open the provider’s page and type the price of a VM-hour. A month is 730 hours: this is the bill for a lab nobody cleaned up.'),
};

function mountCost(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = { vms: 3, hours: 8, ...((props ?? {}) as Partial<CostProps>) };
  const vms = h('input', { type: 'number', min: 1, max: 10, value: String(p.vms), 'aria-label': t(L.vms) }) as HTMLInputElement;
  const hours = h('input', { type: 'number', min: 1, max: 100, value: String(p.hours), 'aria-label': t(L.hours) }) as HTMLInputElement;
  const body = h('tbody');
  const rows: { price: HTMLInputElement; total: HTMLElement; month: HTMLElement; unit: string; free: boolean }[] = [];
  for (const pr of PROVIDERS) {
    const free = pr.id === 'local';
    const price = h('input', { type: 'number', min: 0, step: '0.001', placeholder: free ? '0' : '?', 'aria-label': `${t(L.price)}: ${t(pr.name)}`, ...(free ? { value: '0', disabled: true } : {}) }) as HTMLInputElement;
    const total = h('td.num');
    const month = h('td.num.kt-month');
    rows.push({ price, total, month, unit: pr.unit, free });
    body.append(h('tr', {}, h('td', {}, h('a', { href: pr.url, target: '_blank', rel: 'noopener' }, t(pr.name)), h('br'), h('span.kx-note', {}, t(pr.note))), h('td', {}, price), total, month));
  }
  const recalc = () => {
    const n = Number(vms.value) || 0;
    const hrs = Number(hours.value) || 0;
    for (const r of rows) {
      const v = Number(r.price.value);
      if (!r.price.value && !r.free) {
        r.total.textContent = '—';
        r.month.textContent = '—';
        continue;
      }
      r.total.textContent = `${(n * hrs * v).toFixed(2)} ${r.unit}`.trim();
      r.month.textContent = `${(n * 730 * v).toFixed(2)} ${r.unit}`.trim();
    }
  };
  for (const el of [vms, hours, ...rows.map((r) => r.price)]) el.addEventListener('input', recalc);
  recalc();
  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('div.kx-row', {}, vms, h('span', {}, t(L.vms)), '×', hours, h('span', {}, t(L.hours))),
      h('div.kt-scroll', {}, h('table.kt-table', {}, h('thead', {}, h('tr', {}, h('th', {}, t(L.provider)), h('th', {}, t(L.price)), h('th', {}, t(L.total)), h('th', {}, t(L.month)))), body)),
      h('p.kx-note', {}, t(L.note)),
    ),
  );
  ctx.complete();
  return { dispose() {} };
}

export const costWidget: WidgetReg = { id: 'k8s.cost', mount: mountCost };
