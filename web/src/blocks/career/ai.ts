// The learner's own AI, as the career trainers use it (10 §9.3): the mock
// interviewer brings its own system prompt, the grader asks for strict JSON.
// The mentor registered by src/engine/ai may expose `chat()`; without it the
// conversation is packed into one ask() in "free" mode. Without any AI the
// trainers work in self-review mode and say how to connect one.

import { lang } from '../../core/i18n';
import { registry } from '../../core/registry';
import { store } from '../../core/store';
import type { ChatMessage, Level } from '../../core/types';

export function aiReady(): boolean {
  return !!registry.mentor?.ready();
}

export function packMessages(messages: ChatMessage[]): string {
  return messages.map((m) => `### ${m.role.toUpperCase()}\n${m.content}`).join('\n\n') + '\n\n### ASSISTANT\n';
}

export async function aiChat(messages: ChatMessage[], opts: { temperature?: number; json?: boolean; level?: Level } = {}): Promise<string> {
  const m = registry.mentor;
  if (!m || !m.ready()) throw new Error('no AI connected');
  if (m.chat) return m.chat(messages, { temperature: opts.temperature, json: opts.json });
  return m.ask({
    mode: 'free',
    question: packMessages(messages),
    lang: lang(),
    level: opts.level ?? 'beginner',
    introduced: Object.entries(store.state.concepts)
      .filter(([, c]) => c.state !== 'unseen')
      .map(([id]) => id),
    docTrail: [],
  });
}
