// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bytes, MAX_BYTES, prepare, sanitize, selectionContext, separateTerminal, snapshots, registerFeedbackSnapshot, type Report } from './data';
import { collectContext } from './context';
import { FeedbackQueue, type Entry, type QueueStore } from './queue';
const sample = (): Report => ({ schema: 'dt.feedback/v1', id: 'test-123456', time: '2026-11-20T00:00:00Z', category: 'crash', message: 'Crash', contact: '', website: '', context: { lesson: 'linux.terminal' }, attachments: {}, omitted: [] });
function memory(): QueueStore { const entries = new Map<string,Entry>(); return { put: async e => { entries.set(e.id, structuredClone(e)); }, all: async () => [...entries.values()].map(e => structuredClone(e)), remove: async id => entries.delete(id) }; }
describe('feedback privacy and context', () => {
  it('masks nested secrets, JSON strings, shell assignments and ANSI sequences', () => {
    const v = sanitize({ apiKey: 'arbitrary-key', env: 'export API_KEY="hidden-value"', output: '\x1b[31mred\x1b[0m Bearer abc.def', nested: [{ password: 'pass' }], config: '{"token":"sensitive"}', cloud: 'export AWS_SECRET_ACCESS_KEY=opaquevalue LAB_TOKEN=opaquelab', url: 'https://user:privatepass@example.com' });
    const json = JSON.stringify(v); for (const secret of ['arbitrary-key','hidden-value','abc.def','sensitive','opaquevalue','opaquelab','privatepass','\\u001b']) expect(json).not.toContain(secret);
    expect(json).toContain('red'); expect(json).toContain('hidden');
  });
  it('separates all command logs from the environment attachment', () => {
    const result = separateTerminal({ machine: { facts: { term: { main: ['command'] }, schema: 'dt.facts/v1' }, history: ['secret command'], console: 'pending command' } });
    expect(JSON.stringify(result.state)).not.toContain('command');
    expect(JSON.stringify(result.records)).toContain('pending command');
    expect(JSON.stringify(result.state)).toContain('dt.facts/v1');
  });
  it('caps UTF-8 payloads without corrupting JSON or hiding omissions', () => {
    const r = sample(); r.attachments = { huge: 'я'.repeat(MAX_BYTES), small: 'facts' };
    const safe = prepare(r); expect(bytes(JSON.stringify(safe))).toBeLessThanOrEqual(MAX_BYTES); expect(safe.omitted).toContain('huge'); expect(safe.attachments.small).toBe('facts');
    expect(r.attachments.huge).toBeTruthy(); r.message = 'x'.repeat(MAX_BYTES); expect(() => prepare(r)).toThrow();
  });
  it('collects exact section, task, quiz and selected context without URL query strings', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false })); location.hash = '#/lesson/linux.terminal';
    document.body.innerHTML = '<section class="lsec" id="s-lab"><div class="quiz-item" data-id="q-1"><div data-task="task-1">Before. Selected text. After.</div></div></section>';
    const el = document.querySelector('[data-task]')!; const selection = window.getSelection()!; const range = document.createRange(); range.setStart(el.firstChild!,8);range.setEnd(el.firstChild!,21); selection.removeAllRanges();selection.addRange(range);
    const selected = selectionContext(selection); expect(selected?.text).toBe('Selected text'); expect(selected?.sentence).toContain('Before.');
    expect(collectContext(el,selected)).toMatchObject({ section:'lab',task:'task-1',quiz:'q-1', selection:selected }); vi.unstubAllGlobals();
  });
  it('collects registered live environments only and tolerates failures', async () => {
    const el = document.createElement('div'); document.body.append(el); const off = registerFeedbackSnapshot(el, () => ({ facts: { schema: 'dt.facts/v1' } }));
    expect(JSON.stringify(await snapshots())).toContain('dt.facts/v1'); off(); expect(await snapshots()).toEqual({});
  });
});
describe('offline queue', () => {
  it('persists before sending, retries after a failure, and removes only acknowledged reports', async () => {
    const store = memory(); let now = 0; const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:true});
    const q = new FeedbackQueue(store,'/api/feedback',send,()=>now); await q.enqueue(sample());expect(send).not.toHaveBeenCalled(); await q.flush();expect((await store.all())[0].attempts).toBe(1);
    await q.flush();expect(send).toHaveBeenCalledTimes(1);now=3000;expect(await q.flush()).toEqual(['test-123456']);expect(await store.all()).toEqual([]);
  });
  it('survives queue recreation and retains permanently rejected reports without retry storms', async () => {
    const store=memory();await new FeedbackQueue(store,'').enqueue(sample());const send=vi.fn().mockResolvedValue({ok:false,status:400});const q=new FeedbackQueue(store,'/api/feedback',send);await q.flush();await q.flush();expect(send).toHaveBeenCalledTimes(1);expect((await store.all())[0].blocked).toBe(true);
  });
  it('does not send when production endpoint is unconfigured', async () => {
    const send=vi.fn();const q=new FeedbackQueue(memory(),'',send);await q.enqueue(sample());await q.flush();expect(send).not.toHaveBeenCalled();
  });
});
