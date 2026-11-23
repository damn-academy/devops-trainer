// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import type { SimMachine } from '../src/engine/terminal/shell';
const terminals = vi.hoisted(() => [] as { machine: SimMachine; onCommand(): void }[]);
vi.mock('../src/engine/terminal/widget', () => ({ mountTerminal: async (_root: HTMLElement, options: typeof terminals[number]) => {
  terminals.push(options);
  return { dispose() {}, type() {}, reset() {}, focus() {} };
} }));
vi.mock('../src/core/store', () => ({ store: {
  state: { tasks: {}, docLadder: {}, docTrail: [] },
  record: vi.fn(), loadSnapshot: async () => null, saveSnapshot: vi.fn(),
} }));
import { mountLab } from '../src/app/terminal-section';
import type { LabOptions } from '../src/app/terminal-section';

it('checks declared source goals on source commands while default terminals remain independent', async () => {
  const options: LabOptions = { key: 'goals/consumer', lessonId: 'goals', level: 'beginner', index: 0, count: 1, exam: true,
    setup: { ext: { goalSource: 'goals/source' } }, tasks: [{ id: 'proof', prompt: { ru: 'Proof', en: 'Proof' }, check: { when: f => f.files['/tmp/proof']?.text === 'ready\n' } }] };
  const consumer = document.createElement('div');
  const source = document.createElement('div');
  const independent = document.createElement('div');
  const mounts = [mountLab(consumer, options), mountLab(independent, { ...options, key: 'goals/independent', setup: {} })];
  try {
    await vi.waitFor(() => expect(terminals).toHaveLength(2));
    await terminals[0].machine.exec('echo ready > /tmp/proof');
    terminals[0].onCommand();
    expect(consumer.querySelector('.goal.done')).toBeNull();
    mounts.push(mountLab(source, { ...options, key: 'goals/source', setup: {}, tasks: [] }));
    await vi.waitFor(() => expect(terminals).toHaveLength(3));
    await terminals[2].machine.exec('echo ready > /tmp/proof');
    terminals[2].onCommand();
    await vi.waitFor(() => expect(consumer.querySelector('.goal.done')).not.toBeNull());
    expect(independent.querySelector('.goal.done')).toBeNull();
  } finally { mounts.forEach(m => m.dispose()); }
});


it('shows the authored H3 after the documentation fragment at DL2', async () => {
  const root = document.createElement('div');
  const mounted = mountLab(root, { key: 'hints/fragment', block: 'methodology', level: 'intermediate', index: 0, count: 1,
    setup: {}, tasks: [{ id: 'hint', prompt: { ru: 'Задание', en: 'Task' }, check: { when: 'flow.finished=1' },
      docRef: { page: 'man/flow.1', anchor: 'OPTIONS', line: 'station ROLE COLUMN' },
      hints: { H3: { ru: 'Наберите flow station DEV-2 test.', en: 'Type flow station DEV-2 test.' } } }] });
  try {
    await vi.waitFor(() => expect(root.querySelector('.hints button')).not.toBeNull());
    (root.querySelector('.hints button') as HTMLButtonElement).click();
    const hint = root.querySelector('.hint')!;
    expect(hint.querySelector('.doc-fragment')).not.toBeNull();
    expect(hint.textContent?.replace(/\s/g, ' ')).toContain('flow station DEV-2 test');
    expect(hint.lastElementChild?.lastElementChild?.textContent?.replace(/\s/g, ' ')).toContain('flow station DEV-2 test');
  } finally { mounted.dispose(); }
});
