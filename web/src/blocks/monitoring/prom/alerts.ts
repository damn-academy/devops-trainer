// Alerting rules (Prometheus rule files) and Alertmanager routing (06 §7.4
// C11): rule evaluation over time with `for` (inactive → pending → firing),
// the routing tree with matchers, `continue`, group_by and inhibit_rules,
// and the checks promtool and amtool make.

import { parse as parseYaml, LineCounter, parseDocument } from 'yaml';
import type { Labels, Tsdb } from './data';
import { parse, PromQLError, query, parseDuration } from './promql';

export interface AlertRule {
  alert?: string;
  record?: string;
  expr: string;
  for: number;
  labels: Labels;
  annotations: Record<string, string>;
  line: number;
}

export interface RuleGroup {
  name: string;
  interval: number;
  rules: AlertRule[];
}

export function parseRules(text: string, file: string): { groups: RuleGroup[]; errors: string[] } {
  const errors: string[] = [];
  const lc = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lc });
  if (doc.errors.length) return { groups: [], errors: doc.errors.map((e) => `${file}: yaml: line ${e.linePos?.[0].line ?? 1}: ${e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')}`) };
  const y = (doc.toJS() ?? {}) as { groups?: { name?: string; interval?: string; rules?: Record<string, unknown>[] }[] };
  const groups: RuleGroup[] = [];
  if (!Array.isArray(y.groups)) return { groups, errors: [`${file}: field groups not found in type rulefmt.RuleGroups`] };
  const names = new Set<string>();
  y.groups.forEach((g, gi) => {
    if (!g.name) errors.push(`${file}: Groupname must not be empty`);
    else if (names.has(g.name)) errors.push(`${file}: ${g.name}: groupname: "${g.name}" is repeated in the same file`);
    names.add(g.name ?? '');
    const rules: AlertRule[] = [];
    (g.rules ?? []).forEach((r, ri) => {
      const where = `${file}: group "${g.name}", rule ${ri + 1}, "${r.alert ?? r.record ?? ''}"`;
      const line = 1;
      if (!r.alert && !r.record) errors.push(`${where}: one of 'record' or 'alert' must be set`);
      if (r.alert && r.record) errors.push(`${where}: only one of 'record' and 'alert' must be set`);
      if (!r.expr) errors.push(`${where}: field 'expr' must be set in rule`);
      else
        try {
          parse(String(r.expr));
        } catch (e) {
          errors.push(`${where}: could not parse expression: ${(e as Error).message}`);
        }
      let forMs = 0;
      if (r.for !== undefined) {
        try {
          forMs = parseDuration(String(r.for));
        } catch {
          errors.push(`${where}: not a valid duration string: "${r.for}"`);
        }
      }
      if (r.record && r.for !== undefined) errors.push(`${where}: invalid field 'for' in recording rule`);
      for (const k of Object.keys(r)) if (!['alert', 'record', 'expr', 'for', 'keep_firing_for', 'labels', 'annotations'].includes(k)) errors.push(`${file}: ${gi + 1}:${ri + 1}: field ${k} not found in type rulefmt.RuleNode`);
      rules.push({ alert: r.alert as string | undefined, record: r.record as string | undefined, expr: String(r.expr ?? ''), for: forMs, labels: (r.labels as Labels) ?? {}, annotations: (r.annotations as Record<string, string>) ?? {}, line });
    });
    groups.push({ name: g.name ?? '', interval: g.interval ? parseDuration(g.interval) : 60_000, rules });
  });
  return { groups, errors };
}

export type AlertState = 'inactive' | 'pending' | 'firing';

export interface AlertTimeline {
  rule: string;
  points: { t: number; state: AlertState; active: number; value?: number }[];
  /** Alerts currently active at the end, with their labels. */
  active: { labels: Labels; state: AlertState; since: number; value: number }[];
}

/** Evaluate an alerting rule every `interval` over [from, to]; `for` turns pending into firing. */
export function evalRule(db: Tsdb, rule: AlertRule, from: number, to: number, interval = 60_000): AlertTimeline {
  const since = new Map<string, number>();
  const points: AlertTimeline['points'] = [];
  let last: AlertTimeline['active'] = [];
  for (let t = from; t <= to; t += interval) {
    let res;
    try {
      res = query(db, rule.expr, t);
    } catch (e) {
      throw e instanceof PromQLError ? e : new PromQLError(String(e));
    }
    const vecs = res.type === 'vector' ? res.data : res.type === 'scalar' && res.value ? [{ labels: {}, value: res.value }] : [];
    const now = new Map<string, { labels: Labels; value: number }>();
    for (const s of vecs) {
      const { __name__: _n, ...rest } = s.labels;
      void _n;
      const labels = { alertname: rule.alert ?? '', ...rest, ...rule.labels };
      now.set(JSON.stringify(labels), { labels, value: s.value });
    }
    for (const k of [...since.keys()]) if (!now.has(k)) since.delete(k);
    for (const k of now.keys()) if (!since.has(k)) since.set(k, t);
    last = [...now.entries()].map(([k, v]) => ({ labels: v.labels, value: v.value, since: since.get(k)!, state: t - since.get(k)! >= rule.for ? 'firing' : 'pending' }));
    const state: AlertState = last.some((a) => a.state === 'firing') ? 'firing' : last.length ? 'pending' : 'inactive';
    points.push({ t, state, active: last.length, value: vecs[0]?.value });
  }
  return { rule: rule.alert ?? rule.record ?? '', points, active: last };
}

// ── Alertmanager ──

export interface Route {
  receiver?: string;
  group_by?: string[];
  matchers?: string[];
  match?: Labels;
  continue?: boolean;
  routes?: Route[];
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
}

export interface AmConfig {
  route: Route;
  receivers: { name: string }[];
  inhibit_rules: { source_matchers?: string[]; target_matchers?: string[]; equal?: string[] }[];
}

export function parseAm(text: string): { config: AmConfig | null; errors: string[] } {
  let y: AmConfig;
  try {
    y = (parseYaml(text) ?? {}) as AmConfig;
  } catch (e) {
    return { config: null, errors: [`yaml: ${(e as Error).message.split('\n')[0]}`] };
  }
  const errors: string[] = [];
  if (!y.route) errors.push('no routes provided');
  if (y.route && !y.route.receiver) errors.push('root route must specify a default receiver');
  const names = new Set((y.receivers ?? []).map((r) => r.name));
  const walk = (r: Route) => {
    if (r.receiver && !names.has(r.receiver)) errors.push(`undefined receiver "${r.receiver}" used in route`);
    for (const m of r.matchers ?? []) if (!/^\s*[A-Za-z_][\w]*\s*(=~|!~|!=|=)\s*("[^"]*"|[^"]\S*)\s*$/.test(m)) errors.push(`bad matcher format: ${m}`);
    (r.routes ?? []).forEach(walk);
  };
  if (y.route) walk(y.route);
  return { config: errors.length ? null : { route: y.route, receivers: y.receivers ?? [], inhibit_rules: y.inhibit_rules ?? [] }, errors };
}

function matcherOk(m: string, l: Labels): boolean {
  const r = /^\s*([A-Za-z_]\w*)\s*(=~|!~|!=|=)\s*"?([^"]*)"?\s*$/.exec(m);
  if (!r) return false;
  const v = l[r[1]] ?? '';
  if (r[2] === '=') return v === r[3];
  if (r[2] === '!=') return v !== r[3];
  const re = new RegExp(`^(?:${r[3]})$`);
  return r[2] === '=~' ? re.test(v) : !re.test(v);
}

function routeMatches(r: Route, l: Labels): boolean {
  return (r.matchers ?? []).every((m) => matcherOk(m, l)) && Object.entries(r.match ?? {}).every(([k, v]) => l[k] === v);
}

/** The receivers an alert with these labels goes to, and the path through the tree. */
export function routeAlert(cfg: AmConfig, l: Labels): { receivers: string[]; path: string[][] } {
  const receivers: string[] = [];
  const path: string[][] = [];
  const walk = (r: Route, inherited: string, trail: string[]): boolean => {
    const recv = r.receiver ?? inherited;
    let matchedChild = false;
    for (const [i, c] of (r.routes ?? []).entries()) {
      if (!routeMatches(c, l)) continue;
      matchedChild = true;
      walk(c, recv, [...trail, `routes[${i}]`]);
      if (!c.continue) break;
    }
    if (!matchedChild) {
      receivers.push(recv);
      path.push(trail);
    }
    return matchedChild;
  };
  walk(cfg.route, cfg.route.receiver ?? '', ['route']);
  return { receivers, path };
}

/** Alerts silenced by inhibition: a source alert mutes targets with the same `equal` labels. */
export function inhibited(cfg: AmConfig, alerts: Labels[]): Set<number> {
  const out = new Set<number>();
  for (const rule of cfg.inhibit_rules) {
    const sources = alerts.filter((a) => (rule.source_matchers ?? []).every((m) => matcherOk(m, a)));
    alerts.forEach((a, i) => {
      if (!(rule.target_matchers ?? []).every((m) => matcherOk(m, a))) return;
      if (sources.some((s) => s !== a && (rule.equal ?? []).every((k) => (s[k] ?? '') === (a[k] ?? '')))) out.add(i);
    });
  }
  return out;
}
