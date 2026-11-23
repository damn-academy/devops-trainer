// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import type { SimMachine } from '../engine/terminal/shell';
const terminals = vi.hoisted(() => [] as { machine: SimMachine; onCommand(): void }[]);
vi.mock('../engine/terminal/widget', () => ({ mountTerminal: async (_: HTMLElement, options: typeof terminals[number]) => {
  terminals.push(options); return { dispose() {}, type() {}, reset() {}, focus() {} };
} }));
import { mountLab } from './terminal-section';
import { MemoryBackend, store } from '../core/store';
import { bi, setLang } from '../core/i18n';
it('shows an explanation for a later task while the first task remains unfinished', async () => {
  await store.init(new MemoryBackend()); setLang('ru');
  const root = document.createElement('div');
  const mounted = mountLab(root, { key: 'fail-later', setup: {}, level: 'beginner', index: 0, count: 1, tasks: [
    { id: 'first', prompt: bi('Первая задача.', 'First task.'), check: { when: () => false } },
    { id: 'later', prompt: bi('Вторая задача.', 'Second task.'), check: { when: () => false, fail: [{ if: f => f.term.main.at(-1)?.line === 'false', say: bi('Команда второй задачи завершилась с ошибкой.', 'The second task command failed.') }] } },
  ] });
  try {
    await vi.waitFor(() => expect(terminals.length).toBe(1));
    await terminals[0].machine.exec('false'); terminals[0].onCommand();
    await vi.waitFor(() => expect(root.querySelector('.lab-fail[data-task="later"]')?.textContent).toContain('Команда второй задачи'));
    expect(root.querySelector('.lab-fail[data-task="first"]')).toBeNull();
  } finally { mounted.dispose(); }
});
