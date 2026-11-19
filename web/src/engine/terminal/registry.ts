// The set of commands, fact providers and setup hooks a simulated machine
// knows. core/registry.ts fills the global one from every module; tests may
// build their own.

import type { FactsProvider, SetupHook, ShellCommand } from '../../core/types';

/**
 * Commands the terminal engine provides only as a fallback: another engine
 * that registers the same name (sim-net's ip, ss, curl…) wins without an
 * error, and the fallback stays available through `fallback(name)`.
 */
export const FALLBACK = new WeakSet<ShellCommand>();

export class CommandSet {
  private byName = new Map<string, ShellCommand>();
  private primary = new Map<string, ShellCommand>();
  private spare = new Map<string, ShellCommand>();

  /** Add a command. A second command with the same name is an error unless it says `override: true` or one of them is a fallback. */
  add(cmd: ShellCommand): void {
    const names = [cmd.name, ...(cmd.aliases ?? [])];
    if (FALLBACK.has(cmd) && names.some((n) => this.byName.has(n))) {
      for (const n of names) this.spare.set(n, cmd);
      return;
    }
    for (const n of names) {
      const prev = this.byName.get(n);
      if (prev && !cmd.override && !FALLBACK.has(prev)) throw new Error(`shell command "${n}" registered twice (set override: true to replace a core command)`);
    }
    for (const n of names) {
      const prev = this.byName.get(n);
      if (prev && FALLBACK.has(prev)) this.spare.set(n, prev);
      this.byName.set(n, cmd);
    }
    this.primary.set(cmd.name, cmd);
  }

  /** The terminal engine's own version of a command another engine replaced. */
  fallback(name: string): ShellCommand | undefined {
    return this.spare.get(name);
  }

  get(name: string): ShellCommand | undefined {
    return this.byName.get(name);
  }

  /** Primary entries, sorted by name (aliases are not repeated). */
  list(): ShellCommand[] {
    return [...this.primary.values()].filter((c) => this.byName.get(c.name) === c).sort((a, b) => a.name.localeCompare(b.name));
  }

  names(): string[] {
    return [...this.byName.keys()].sort();
  }
}

export interface TerminalRegistry {
  commands: CommandSet;
  facts: FactsProvider[];
  setup: SetupHook[];
}

export function createTerminalRegistry(): TerminalRegistry {
  return { commands: new CommandSet(), facts: [], setup: [] };
}

/** The registry every machine uses by default; filled by core/registry.ts. */
export const terminalRegistry: TerminalRegistry = createTerminalRegistry();
