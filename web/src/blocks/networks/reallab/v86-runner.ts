// The LabRunner over a V86Lab: root commands on the machines' service
// channel (never in the learner's terminal), facts with the lab scopes, and
// the switch tap's facts. Shared by the widget and the integration test.
//
// Network goals read lab scopes and a few files, not the process table, so
// the runner asks the guest for exactly those in one script; walking /proc
// for the full facts costs 1.5–4 s per machine in emulation (measured) and
// is done only for goals that read the learner's terminal (`stdout`).

import type { Facts } from '../../../core/types';
import type { V86Lab } from '../../../engine/v86/lab';
import { labFactsScript, parseLabFacts } from '../../../engine/v86/lab-facts';
import { parseFacts } from '../../../engine/v86/protocol';
import type { LabRunner, Scope } from './spec';
import type { SwitchTap } from './tap';

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** The file part of the engine's facts script (same output format, parsed by parseFacts). */
export function filesScript(paths: string[]): string {
  if (!paths.length) return '';
  return `for f in ${paths.map(q).join(' ')}; do
if [ -e "$f" ]; then echo "F $f"; ls -ldin "$f" 2>/dev/null
if [ -f "$f" ] && [ -r "$f" ] && [ "$(wc -c < "$f")" -le 65536 ]; then echo "C"; base64 "$f"; echo "."; fi
else echo "N $f"; fi; done`;
}

export function v86Runner(lab: V86Lab, tap?: SwitchTap): LabRunner {
  return {
    exec: (name, cmd) => lab.exec(name, cmd),
    facts: async (name, scopes: Scope[], files: string[], full?: boolean) => {
      const m = lab.machine(name);
      if (full) {
        m.watchPaths(files);
        return m.facts(scopes);
      }
      const script = [labFactsScript(scopes), files.length ? `printf '\\036Sfiles\\n'; ${filesScript(files)}` : ''].filter(Boolean).join('\n');
      const out = script ? (await lab.exec(name, script)).out : '';
      const at = out.indexOf('\x1eSfiles\n');
      const f = parseLabFacts(at >= 0 ? out.slice(0, at) : out);
      const fileFacts = at >= 0 ? parseFacts(out.slice(at + 8)).files : {};
      return { schema: 'dt.facts/v1', env: { kind: 'v86', machine: name, at: new Date().toISOString() }, files: fileFacts, procs: [], term: { main: [] }, ...f } as unknown as Facts;
    },
    switchFacts: tap ? () => tap.facts() : undefined,
  };
}
