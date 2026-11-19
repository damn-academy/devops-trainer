// A tiny page-level event hub. Simulator commands (git push, terraform plan,
// ansible-playbook…) publish what happened; panels placed next to a lab
// (pipeline board, plan view) subscribe and draw it. Commands also emit the
// same events on the machine bus (08 §3.0), so explainers can replay them.

type Fn = (ev: { t: string; [k: string]: unknown }) => void;
const subs = new Set<Fn>();
let last = new Map<string, { t: string; [k: string]: unknown }>();

export function publish(ev: { t: string; [k: string]: unknown }): void {
  last.set(ev.t, ev);
  for (const f of subs) {
    try {
      f(ev);
    } catch {
      /* a broken panel must not break the command */
    }
  }
}

export function subscribe(fn: Fn): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** The latest event of a type, for a panel mounted after the command ran. */
export function lastEvent(t: string): { t: string; [k: string]: unknown } | undefined {
  return last.get(t);
}

export function resetHub(): void {
  last = new Map();
}
