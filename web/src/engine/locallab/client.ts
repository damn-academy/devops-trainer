// The course's side of the local lab (lab/DESIGN.md §7): `dtlab serve`
// serves the built course on http://127.0.0.1:7788/ and a small API beside
// it. When the page runs there, an exam can take facts from a lab VM in one
// click instead of the learner copying the check script's block by hand.
// The block is the same one the learner would paste (dt.host-check/v1 or the
// cluster check), so the exam page judges it with the code it already has.
//
// The API answers only the page served by dtlab itself (same origin) or an
// origin the learner named with `dtlab serve --allow-origin`, and every call
// carries the X-DTLab header, which forms and images cannot send.

import { bi, type Bi } from '../../core/i18n';

export interface LabVM {
  name: string;
  kind: 'learner' | 'kubeadm' | 'kuberoot';
  ip: string;
  running: boolean;
  cpus: number;
  memMiB: number;
}

export interface LabStatus {
  profile: string;
  backend: string;
  agent: boolean;
  course?: string;
  kubeconfig?: string;
  vms: LabVM[];
}

export interface FactsRequest {
  /** The lab VM to run in: learner, cp-1, worker-1, kr-1. */
  vm: string;
  /** trainer-check-host.sh or trainer-check.sh; by the VM's kind when left out. */
  script?: string;
  nonce: string;
  /** The exam's machine id (app-01, cp-1); the VM's name when left out. */
  machine?: string;
  track?: string;
  /** The exam's collector arguments, one per element: '--scope net'. */
  args?: string[];
}

const LOCAL = 'http://127.0.0.1:7788';

/** Where the lab API is: this origin when dtlab serves the page, else the default port. */
export function labBase(loc: { origin: string; port: string } = globalThis.location): string {
  if (loc && (loc.origin === LOCAL || loc.origin === 'http://localhost:7788')) return '';
  return LOCAL;
}

async function call<T>(path: string, init: RequestInit = {}, base = labBase()): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-DTLab', '1');
  const r = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}

/** The lab's state, or null when no lab answers (the course then works as before). */
export async function detectLab(base = labBase(), timeoutMs = 1500): Promise<LabStatus | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const s = await call<LabStatus>('/api/v1/status', { signal: ctl.signal }, base);
    clearTimeout(timer);
    return s && Array.isArray(s.vms) ? s : null;
  } catch {
    return null;
  }
}

/** Runs the check in a lab VM and returns the printed block, ready for the exam's decoder. */
export async function collectFacts(req: FactsRequest, base = labBase()): Promise<string> {
  const r = await call<{ block: string }>('/api/v1/facts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }, base);
  if (!r.block?.includes('-----BEGIN TRAINER')) throw new Error('the lab returned no facts block');
  return r.block;
}

/** The fixed addresses of the lab's VMs (lab/internal/profile, Plan). */
export const LAB_VM_ADDR: Record<string, string> = {
  learner: '10.10.1.10',
  'cp-1': '10.10.1.11',
  'worker-1': '10.10.1.21',
  'worker-2': '10.10.1.22',
  'kr-1': '10.10.1.30',
};

/**
 * Maps an exam machine to a lab VM. The exam names the VM (`wanted`, from
 * RealMachine.dtlab): then only that VM will do, and a lab started without it
 * gives no VM rather than another machine's facts. Without a name, a VM of
 * the same name (cp-1 of the kubeadm exam), else the learner VM.
 */
export function vmForMachine(machine: string, status: LabStatus, wanted?: string): string | null {
  if (wanted) return status.vms.some((v) => v.name === wanted) ? wanted : null;
  if (status.vms.some((v) => v.name === machine)) return machine;
  return status.vms.find((v) => v.kind === 'learner')?.name ?? null;
}

/** The three ways out of the lab, in plain words, for the course's lab page and help. */
export const LAB_REMOVAL: { cmd: string; what: Bi }[] = [
  {
    cmd: 'dtlab down',
    what: bi(
      'Останавливает машины лаборатории и освобождает память. Диски и всё, что вы сделали на машинах, остаются: `dtlab up` продолжит с того же места.',
      'Stops the lab’s machines and frees the memory. Their disks and everything you did on them stay: `dtlab up` carries on where you left off.',
    ),
  },
  {
    cmd: 'dtlab destroy',
    what: bi(
      'Удаляет машины и их диски, а скачанные образы оставляет, чтобы следующий `dtlab up` создал чистые машины без повторной загрузки.',
      'Deletes the machines and their disks, and keeps the downloaded images, so that the next `dtlab up` makes clean machines without downloading again.',
    ),
  },
  {
    cmd: 'dtlab uninstall',
    what: bi(
      'Удаляет всё, что лаборатория добавила на компьютер: машины, диски, образы, кэш, сеть, копию курса, настройки, строки в PATH и саму программу dtlab. Сначала показывает список с размерами и спрашивает, а после удаления проверяет, что ничего не осталось.',
      'Removes everything the lab added to the computer: machines, disks, images, caches, the network, the course copy, settings, PATH lines and the dtlab program itself. It first shows the list with sizes and asks, and afterwards checks that nothing is left.',
    ),
  },
];

/**
 * Whether the page may look for the lab without asking: always on the copy
 * dtlab serves; on a hosted copy only after the learner granted Chrome's
 * local network access, because the probe itself makes Chrome ask.
 */
export async function mayProbeLab(base = labBase()): Promise<boolean> {
  if (base === '') return true;
  try {
    const p = await navigator.permissions.query({ name: 'local-network-access' as PermissionName });
    return p.state === 'granted';
  } catch {
    return false;
  }
}
