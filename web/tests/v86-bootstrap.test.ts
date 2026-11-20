import { expect, it, vi } from 'vitest';
import { V86Machine, type TransportFactory } from '../src/engine/v86/machine';
import type { WorkerIn, WorkerOut } from '../src/engine/v86/messages';

it.each([true, false])('saves only after READY and the complete interactive prompt (split=%s)', async (split) => {
  const sent: WorkerIn[] = [];
  const encoder = new TextEncoder();
  let reply: (m: WorkerOut) => void = () => {};
  let bootstrapped = false;
  const serial = (port: number, text: string) => reply({ op: 'serial', port, bytes: encoder.encode(text) });
  const transport: TransportFactory = (onMessage) => {
    reply = onMessage;
    return {
      post(message) {
        sent.push(message);
        queueMicrotask(() => {
          if (message.op === 'boot') {
            reply({ op: 'ready', ms: 0, restored: false });
            serial(0, 'root@image:~# ');
          } else if (message.op === 'serial') {
            const command = new TextDecoder().decode(message.bytes);
            if (message.port === 0 && command.includes('READY')) {
              bootstrapped = true;
              // Bash prints READY, then may block on 9p while expanding PS1.
              serial(0, '\x1eREADY\n' + (split ? '' : 'root@image:~# '));
            } else if (message.port === 1) {
              const id = command.match(/B(\d+)/)![1];
              serial(1, `\x1eB${id}\nok\n\x1eE${id} 0\n`);
            }
          } else if (message.op === 'save') {
            reply({ op: 'saved', id: message.id, state: new ArrayBuffer(0) });
          }
        });
      },
      terminate() {},
    };
  };
  const machine = new V86Machine({
    transport,
    assets: { wasm: '', bios: '', vgaBios: '', bzimage: '', kernelSha: `bootstrap-${split}` },
  });
  try {
    const starting = machine.start();
    await vi.waitFor(() => expect(bootstrapped).toBe(true));
    const savedBeforePrompt = sent.some(m => m.op === 'save');
    if (split) serial(0, 'root@image:~# ');
    await starting;
    if (split) expect(savedBeforePrompt).toBe(false);
    expect(sent.filter(m => m.op === 'save')).toHaveLength(1);
    await machine.bootSaved;
  } finally {
    machine.dispose();
  }
});
