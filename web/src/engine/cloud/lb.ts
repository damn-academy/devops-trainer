// Load balancers: the lab host owns each VIP and proxies HTTP to the target
// VMs over real TCP connections into their kernels, checks their health on
// a timer, and respects the targets' security groups. The decision for each
// request is logged, so the panel can show which backend answered.

import type { LabHost } from '../labhost/host';
import { httpRequest, type HttpRequest, type HttpResponse } from '../labhost/http';
import type { Cloud, LoadBalancer } from './api';

export interface TargetHealth {
  vm_id: string;
  ip: string;
  health: 'unknown' | 'healthy' | 'unhealthy';
  reason: string;
}

export type LbEvent =
  | { t: 'lb.request'; lb: string; target: string | null; status: number; ms: number }
  | { t: 'lb.health'; lb: string; vm: string; health: TargetHealth['health']; reason: string };

interface State {
  rr: number;
  active: Map<string, number>;
  health: Map<string, { h: TargetHealth; ok: number; bad: number }>;
  timer: ReturnType<typeof setInterval> | null;
  interval: number;
}

const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];

export class LoadBalancers {
  private st = new Map<string, State>();
  private fns = new Set<(e: LbEvent) => void>();

  constructor(
    private cloud: Cloud,
    private host: LabHost,
  ) {}

  on(fn: (e: LbEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  private emit(e: LbEvent) {
    for (const f of this.fns) f(e);
  }

  /** Health of every target, for the API view and the panel. */
  targets(lb: LoadBalancer): TargetHealth[] {
    const s = this.st.get(lb.id);
    return lb.target_vm_ids.map((id) => {
      const vm = this.cloud.state.vms.find((v) => v.id === id);
      return s?.health.get(id)?.h ?? { vm_id: id, ip: vm?.ip ?? '', health: 'unknown', reason: 'not checked yet' };
    });
  }

  /** Start or stop health checks to match the cloud state. */
  sync(): void {
    const live = new Set(this.cloud.state.loadBalancers.filter((l) => l.status === 'ACTIVE').map((l) => l.id));
    for (const [id, s] of this.st)
      if (!live.has(id)) {
        if (s.timer) clearInterval(s.timer);
        this.st.delete(id);
      }
    for (const lb of this.cloud.state.loadBalancers) {
      if (lb.status !== 'ACTIVE') continue;
      let s = this.st.get(lb.id);
      if (!s) {
        s = { rr: 0, active: new Map(), health: new Map(), timer: null, interval: 0 };
        this.st.set(lb.id, s);
      }
      if (s.interval !== lb.health_check.interval_s) {
        if (s.timer) clearInterval(s.timer);
        s.interval = lb.health_check.interval_s;
        s.timer = setInterval(() => void this.check(lb.id), s.interval * 1000);
        void this.check(lb.id);
      }
      for (const k of s.health.keys()) if (!lb.target_vm_ids.includes(k)) s.health.delete(k);
    }
  }

  dispose(): void {
    for (const s of this.st.values()) if (s.timer) clearInterval(s.timer);
    this.st.clear();
  }

  /** Run one round of health checks now. */
  async check(lbId: string): Promise<void> {
    const lb = this.cloud.state.loadBalancers.find((l) => l.id === lbId);
    const s = this.st.get(lbId);
    if (!lb || !s) return;
    const port = lb.health_check.port ?? lb.listeners[0].target_port;
    await Promise.all(
      lb.target_vm_ids.map(async (id) => {
        const vm = this.cloud.state.vms.find((v) => v.id === id);
        let rec = s.health.get(id);
        if (!rec) s.health.set(id, (rec = { h: { vm_id: id, ip: vm?.ip ?? '', health: 'unknown', reason: 'not checked yet' }, ok: 0, bad: 0 }));
        let ok = false;
        let reason = '';
        if (!vm || vm.status !== 'RUNNING') reason = vm ? `VM is ${vm.status}` : 'VM is gone';
        else if (!this.cloud.allows(vm, 'tcp', port, lb.vip)) reason = `security groups of ${vm.name} do not allow tcp/${port} from ${lb.vip}`;
        else {
          try {
            const r = await httpRequest(this.host, { ip: vm.ip, port, target: lb.health_check.path, headers: { host: vm.ip, 'user-agent': 'lab-lb-health/1.0' }, timeoutMs: 2000 });
            ok = r.status >= 200 && r.status < 400;
            reason = `HTTP ${r.status}`;
          } catch (e) {
            reason = (e as Error).message;
          }
        }
        if (ok) {
          rec.ok++;
          rec.bad = 0;
        } else {
          rec.bad++;
          rec.ok = 0;
        }
        const was = rec.h.health;
        const now = ok ? (rec.ok >= lb.health_check.healthy_threshold || was === 'healthy' ? 'healthy' : was) : rec.bad >= lb.health_check.unhealthy_threshold || was === 'unknown' ? 'unhealthy' : was;
        rec.h = { vm_id: id, ip: vm?.ip ?? '', health: now, reason };
        if (now !== was) this.emit({ t: 'lb.health', lb: lb.name, vm: vm?.name ?? id, health: now, reason });
      }),
    );
  }

  /** Proxy one request that arrived at a VIP. */
  async proxy(req: HttpRequest): Promise<HttpResponse> {
    const t0 = Date.now();
    const lb = this.cloud.state.loadBalancers.find((l) => l.vip === req.local.ip && l.status === 'ACTIVE');
    const listener = lb?.listeners.find((l) => l.port === req.local.port);
    const fail = (status: number, msg: string): HttpResponse => {
      if (lb) this.emit({ t: 'lb.request', lb: lb.name, target: null, status, ms: Date.now() - t0 });
      return { status, headers: { 'content-type': 'text/html' }, body: `<html><body><h1>${status}</h1><p>${msg}</p><hr>lab-lb</body></html>\n` };
    };
    if (!lb || !listener) return fail(503, 'no load balancer listens here');
    const s = this.st.get(lb.id);
    const healthy = this.targets(lb).filter((t) => t.health === 'healthy');
    if (!healthy.length) return fail(503, `no healthy targets (${lb.target_vm_ids.length} registered)`);
    let pick: TargetHealth;
    if (lb.algorithm === 'least_connections' && s) pick = healthy.reduce((a, b) => ((s.active.get(a.vm_id) ?? 0) <= (s.active.get(b.vm_id) ?? 0) ? a : b));
    else pick = healthy[(s ? s.rr++ : 0) % healthy.length];
    const vm = this.cloud.state.vms.find((v) => v.id === pick.vm_id);
    if (vm && !this.cloud.allows(vm, 'tcp', listener.target_port, lb.vip)) return fail(502, 'blocked by the security groups of the target');
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.includes(k)) headers[k] = v;
    headers['x-forwarded-for'] = req.headers['x-forwarded-for'] ? `${req.headers['x-forwarded-for']}, ${req.remote.ip}` : req.remote.ip;
    headers['x-forwarded-proto'] = 'http';
    headers['x-forwarded-host'] = req.headers['host'] ?? req.local.ip;
    s?.active.set(pick.vm_id, (s.active.get(pick.vm_id) ?? 0) + 1);
    try {
      const r = await httpRequest(this.host, { ip: pick.ip, port: listener.target_port, method: req.method, target: req.target, headers, body: req.body.length ? req.body : undefined, timeoutMs: 10000 });
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.headers)) if (!HOP.includes(k) && k !== 'content-length') out[k] = v;
      out['x-lab-backend'] = vm?.name ?? pick.ip;
      this.emit({ t: 'lb.request', lb: lb.name, target: vm?.name ?? pick.ip, status: r.status, ms: Date.now() - t0 });
      return { status: r.status, headers: out, body: r.body };
    } catch (e) {
      return fail(502, `bad gateway: ${(e as Error).message}`);
    } finally {
      s?.active.set(pick.vm_id, Math.max(0, (s.active.get(pick.vm_id) ?? 1) - 1));
    }
  }
}
