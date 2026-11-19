// One tutor turn, independent of the interface: build the prompt, stream the
// answer, keep anything that names the solution off the screen, and ask the
// model once to rephrase when it slipped (01 §16.4, 09 §4.5).

import { AiError, type ChatMessage } from './client';
import { buildPrompt, leakedTokens, rephraseRequest, type BuiltPrompt, type TutorContext } from './prompt';

export interface Streamer {
  stream(req: { messages: ChatMessage[]; maxTokens: number; temperature: number }, onDelta: (t: string) => void): { done: Promise<string>; abort(): void };
}

export interface TurnOptions {
  /** Earlier turns of this conversation (without the system prompt). */
  history?: ChatMessage[];
  /** Tokens the answer must not contain (never sent to the model). */
  solutionTokens?: string[];
  /** Text that is safe to show so far. */
  onVisible?(text: string): void;
  maxTokens?: number;
}

export interface TurnResult {
  text: string;
  prompt: BuiltPrompt;
  /** The first answer leaked and was replaced by a rephrased one. */
  rephrased: boolean;
  /** Even the rephrased answer leaked: the interface folds it. */
  folded: boolean;
  leaked: string[];
}

/**
 * The longest prefix of `text` that can be shown: it holds no solution token
 * and does not end in what could still grow into one.
 */
export function safePrefix(text: string, tokens: string[]): string {
  if (!tokens.length) return text;
  if (leakedTokens(text, tokens).length) {
    const first = Math.min(...tokens.map((tok) => (text.indexOf(tok) < 0 ? Infinity : text.indexOf(tok))));
    return text.slice(0, Number.isFinite(first) ? first : 0);
  }
  const hold = Math.max(...tokens.map((x) => x.length)) + 1;
  return text.slice(0, Math.max(0, text.length - hold));
}

export function turn(ai: Streamer, ctx: TutorContext, question: string, o: TurnOptions = {}): { done: Promise<TurnResult>; abort(): void } {
  if (ctx.mode === 'exam') return { done: Promise.reject(new AiError('locked')), abort() {} };
  const prompt = buildPrompt(ctx, question);
  const tokens = o.solutionTokens ?? [];
  const maxTokens = o.maxTokens ?? (ctx.mode === 'explain' || ctx.mode === 'free' ? 700 : 400);
  const temperature = 0.3;
  let current: { abort(): void } | null = null;
  let stopped = false;

  const run = async (messages: ChatMessage[]): Promise<string> => {
    let text = '';
    const s = ai.stream({ messages, maxTokens, temperature }, (d) => {
      text += d;
      o.onVisible?.(safePrefix(text, tokens));
    });
    current = s;
    return s.done;
  };

  const done = (async (): Promise<TurnResult> => {
    const messages: ChatMessage[] = [{ role: 'system', content: prompt.system }, ...(o.history ?? []), { role: 'user', content: prompt.user }];
    let text = await run(messages);
    let leaked = leakedTokens(text, tokens);
    let rephrased = false;
    if (leaked.length && !stopped) {
      rephrased = true;
      o.onVisible?.('');
      text = await run([...messages, { role: 'assistant', content: text }, { role: 'user', content: rephraseRequest(ctx.lang, leaked) }]);
      leaked = leakedTokens(text, tokens);
    }
    const folded = leaked.length > 0;
    if (!folded) o.onVisible?.(text);
    return { text, prompt, rephrased, folded, leaked };
  })();
  return {
    done,
    abort() {
      stopped = true;
      current?.abort();
    },
  };
}
