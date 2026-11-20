import type { Facts } from '../../core/types';

export interface GoalSource {
  facts(): Promise<Facts>;
  initial: Facts;
}

/** Mounted sources are isolated by lesson. Subscribers never fall back to their own machine. */
export class GoalSources {
  private sources = new Map<string, GoalSource>();
  private listeners = new Map<string, Set<() => void>>();
  private key(lesson: string, key: string) { return JSON.stringify([lesson, key]); }
  get(lesson: string, key: string) { return this.sources.get(this.key(lesson, key)); }
  register(lesson: string, key: string, source: GoalSource): () => void {
    const id = this.key(lesson, key);
    this.sources.set(id, source);
    this.changed(lesson, key);
    return () => { if (this.sources.get(id) === source) this.sources.delete(id); };
  }
  changed(lesson: string, key: string): void {
    for (const listener of this.listeners.get(this.key(lesson, key)) ?? []) listener();
  }
  subscribe(lesson: string, key: string, listener: () => void): () => void {
    const id = this.key(lesson, key);
    const set = this.listeners.get(id) ?? new Set();
    this.listeners.set(id, set);
    set.add(listener);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(id); };
  }
}
export const lessonGoalSources = new GoalSources();
