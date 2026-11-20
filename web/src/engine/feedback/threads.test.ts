// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const entries = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({ openDB: async () => ({
  getAll: async () => structuredClone([...entries.values()]),
  get: async (_: string, id: string) => structuredClone(entries.get(id)),
  put: async (_: string, value: {id: string}) => { entries.set(value.id, structuredClone(value)); },
}) }));
import { checkThreads, exportWithFeedback, follows, importFeedback, newToken, revision, saveFollow, unread, type Follow } from './threads';
const sample = (): Follow => ({ id: 'report-1234', token: 'a'.repeat(64), message: 'Текст сообщения.', type: 'report', context: { route: '#/lesson/linux.terminal' } });
beforeEach(() => { entries.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.stubEnv('VITE_FEEDBACK_URL', '/api/feedback'); });
describe('private follow-up', () => {
  it('exports capabilities and ignores imported cached replies', async () => {
    await saveFollow(sample());
    const file = await exportWithFeedback('{"format":"devops-trainer/progress@1","events":[]}');
    entries.clear(); await importFeedback(file);
    expect((await follows())[0].token).toBe(sample().token);
    entries.clear();
    await importFeedback(JSON.stringify({feedback:[{ ...sample(), thread:{ status:'fixed', replies:[{message:'forged'}] } }]}));
    expect((await follows())[0].thread).toBeUndefined();
  });
  it('checks once daily even after failure and permits an explicit refresh', async () => {
    await saveFollow(sample()); const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
    await checkThreads(); await checkThreads(); expect(fetcher).toHaveBeenCalledTimes(1);
    await checkThreads(true); expect(fetcher).toHaveBeenCalledTimes(2);
    const f=(await follows())[0];f.checked=Date.now()-86400001;await saveFollow(f);
    await checkThreads();expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('marks author replies and status updates unread, excluding learner replies', () => {
    const f=sample();f.thread={status:'new',fixedAt:'',fixedBuild:'',merged:false,replies:[]};
    expect(unread(f)).toBe(false);f.seen=revision(f.thread);
    f.thread.replies.push({id:'own',author:'learner',message:'Спасибо.',time:''});expect(unread(f)).toBe(false);
    f.thread.replies.push({id:'author',author:'author',message:'Исправили.',time:''});expect(unread(f)).toBe(true);
    f.seen=revision(f.thread);expect(unread(f)).toBe(false);f.thread.status='fixed';expect(unread(f)).toBe(true);
  });
  it('creates distinct 256-bit capabilities', () => { expect(newToken()).toMatch(/^[a-f0-9]{64}$/); expect(newToken()).not.toBe(newToken()); });
});
