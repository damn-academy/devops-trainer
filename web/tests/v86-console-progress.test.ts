// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
const ui = vi.hoisted(() => ({ write: vi.fn(), input: (_text: string) => {} }));
vi.mock('../src/engine/terminal/widget', () => ({
  readTheme: () => ({}),
  termFontSize: () => 14,
  fitTerminal: (_term: unknown, fit: { fit(): void }) => fit.fit(),
  loadXterm: async () => ({
    Terminal: class {
      cols = 80; rows = 16; options = {};
      loadAddon() {} open() {} clear() {} focus() {} dispose() {}
      write = ui.write;
      onData(fn: (text: string) => void) { ui.input = fn; return { dispose() {} }; }
    },
    FitAddon: class { fit() {} },
  }),
}));
import { bootProgress, mountConsole } from '../src/engine/v86/console';
import type { V86Machine } from '../src/engine/v86/machine';

it('estimates from an observed start and reports when the estimate is exceeded', () => {
  expect(bootProgress(2100, 3000)).toEqual({ elapsed: 2, remaining: 1, overdue: false });
  expect(bootProgress(5000, 3000)).toEqual({ elapsed: 5, remaining: 0, overdue: true });
  expect(bootProgress(5000)).toEqual({ elapsed: 5, remaining: undefined, overdue: false });
});

it('hides boot logs by default, exposes them on demand and blocks input until ready', async () => {
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 1; });
  let phase = (_phase: string) => {};
  let output = (_text: string) => {};
  const machine = {
    id: 'progress-test', profile: { id: 'lab-node' }, memoryMB: 128, phase: 'restore',
    write: vi.fn(), resize: vi.fn(), on: () => () => {},
    onPhase: (fn: typeof phase) => { phase = fn; return () => {}; },
    onOutput: (fn: typeof output) => { output = fn; return () => {}; },
  };
  const root = document.createElement('div');
  const handle = await mountConsole(root, machine as unknown as V86Machine);
  try {
    output('kernel boot log\n');
    expect(ui.write).not.toHaveBeenCalled();
    ui.input('x'); handle.type('hostname');
    expect(machine.write).not.toHaveBeenCalled();
    root.querySelector('button')!.click();
    expect(ui.write).toHaveBeenCalledWith('kernel boot log\n');
    machine.phase = 'ready'; phase('ready'); output('root@node:~# ');
    expect(ui.write).toHaveBeenCalledWith('root@node:~# ');
    expect(root.querySelector<HTMLElement>('.v86-boot-progress')!.hidden).toBe(true);
    handle.type('hostname');
    expect(machine.write).toHaveBeenCalledWith('\x15hostname');
  } finally { handle.dispose(); vi.unstubAllGlobals(); }
});
