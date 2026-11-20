import { describe, expect, it, vi } from 'vitest';
import { chatLink, EXTERNAL_CHATS, packExternalPrompt, PACK_LIMIT, type ExternalContext } from './external-prompt';
import { chat, listModels } from './client';
import { clearTerminalTail, pushTerminal, terminalTail } from './context';
import { answeredQuiz } from './external-panel';
import { bi } from '../../core/i18n';
import { preset } from './providers';
const context: ExternalContext = { lang: 'ru', level: 'beginner', introduced: [], task: 'Как показать текущий каталог?', options: ['pwd', 'ls'], response: { answered: false, learner: 'ls', correct: 'REFERENCE', explanation: 'EXPLANATION' } };
describe('external context', () => {
  it('withholds grading until the learner answered', () => {
    const before = packExternalPrompt(context);
    expect(before).not.toContain('REFERENCE'); expect(before).not.toContain('EXPLANATION');
    const after = packExternalPrompt({ ...context, response: { ...context.response!, answered: true } });
    expect(after).toContain('REFERENCE'); expect(after).toContain('EXPLANATION'); expect(after).toContain('Мой ответ: ls');
  });
  it('masks every field before limiting length', () => {
    const secret = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    const out = packExternalPrompt({ ...context, task: secret, want: secret, block: secret, terminal: [secret], screen: secret, introduced: [{ id: 'x', term: { ru: secret, en: secret } }] });
    expect(out).not.toContain(secret);
  });
  it('limits oversized inputs and retains language and level', () => {
    const out = packExternalPrompt({ ...context, lang: 'en', level: 'experienced', task: 'x'.repeat(30000), terminal: ['x'.repeat(30000)], screen: 'x'.repeat(30000), options: ['x'.repeat(30000)] });
    expect(out.length).toBeLessThanOrEqual(PACK_LIMIT); expect(out).toContain('Explain in English'); expect(out).toContain('experienced');
    expect(packExternalPrompt(context)).toContain('Объясните по-русски');
  });
  it('masks multiline credentials before terminal history is shortened', () => {
    clearTerminalTail();
    pushTerminal('cat key', '-----BEGIN PRIVATE KEY-----\n' + 'private-part\n'.repeat(80) + '-----END PRIVATE KEY-----', 0);
    expect(terminalTail().join('\n')).not.toContain('private-part');
    clearTerminalTail();
  });
  it('packs graded option labels and course explanations without serializing the item', () => {
    const result = answeredQuiz({ id: 'q', kind: 'mcq', prompt: bi('Вопрос', 'Question'), options: [
      { id: 'right', text: bi('Верно', 'Right'), correct: true }, { id: 'wrong', text: bi('Ошибка', 'Wrong') },
    ], explain: bi('Объяснение', 'Explanation') }, 'wrong', { correct: false, score: 0, feedback: [bi('Причина', 'Reason')] });
    expect(result.quiz?.response?.answered).toBe(true);
    expect(result.quiz?.response?.correct).toContain('right:');
    expect(result.quiz?.response?.learner).toContain('wrong:');
    expect(result.quiz?.options?.join(' ')).not.toContain('correct');
  });
  it('masks answer and explanation as well as task context', () => {
    const out = packExternalPrompt({ ...context, response: { answered: true, learner: 'token=secret-value', correct: 'Bearer private-token', explanation: 'AIza' + 'x'.repeat(35) } });
    expect(out).not.toContain('secret-value'); expect(out).not.toContain('private-token'); expect(out).not.toContain('AIza');
  });
  it('checks encoded URL length and preserves the query', () => {
    const chat = EXTERNAL_CHATS[1];
    const short = chatLink(chat, 'Почему? & #');
    expect(short.prefilled).toBe(true); expect(new URL(short.url).searchParams.get('q')).toBe('Почему? & #');
    expect(chatLink(chat, 'я'.repeat(1000))).toEqual({ url: chat.url, prefilled: false });
    expect(chatLink(EXTERNAL_CHATS[0], 'short').prefilled).toBe(false);
  });
});
describe('direct providers', () => {
  it('sends Gemini OpenAI-compatible requests', async () => {
    const p = preset('gemini');
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })));
    expect(await chat({ ...p, model: p.defaultModel, key: 'secret' }, { messages: [{ role: 'user', content: 'Hi' }], maxTokens: 20, temperature: 0.3 }, undefined, f)).toBe('ok');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret' });
    expect(JSON.parse(init.body as string)).toMatchObject({ messages: [{ role: 'user', content: 'Hi' }], stream: true });
  });
  it('sends Anthropic headers, system and messages and reads text deltas', async () => {
    const p = preset('anthropic');
    const f = vi.fn(async () => new Response('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n', { headers: { 'content-type': 'text/event-stream' } }));
    expect(await chat({ ...p, model: p.defaultModel, key: 'secret' }, { messages: [{ role: 'system', content: 'Rules' }, { role: 'user', content: 'Hi' }], maxTokens: 20, temperature: 0.3 }, undefined, f)).toBe('Hello');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': 'secret', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body as string)).toEqual({ model: p.defaultModel, system: 'Rules', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 20, temperature: 0.3, stream: true });
    const models = vi.fn(async () => new Response('{"data":[{"id":"claude-test"}]}'));
    expect(await listModels({ ...p, model: '', key: 'secret' }, models)).toEqual(['claude-test']);
  });
});
