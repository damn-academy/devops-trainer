// The emulator host: one v86 instance driven by WorkerIn messages and answering
// with WorkerOut messages. It runs inside v86.worker.ts in the browser, and
// in-process in the integration test (tests/v86-integration.test.ts), so both
// paths execute the same code.

import { V86, type V86Options } from 'v86';
import type { WorkerIn, WorkerOut } from './messages';
import { SparseDisk } from './sparse-disk';

export type Post = (m: WorkerOut, transfer?: Transferable[]) => void;

type Bus = { register(name: string, fn: (data: unknown) => void, ctx?: unknown): void; send(name: string, data: unknown): void };

export function createHost(post: Post, close: () => void = () => {}): (m: WorkerIn) => Promise<void> {
  let emu: V86 | null = null;
  let disks: Partial<Record<'hda' | 'hdb', SparseDisk>> = {};
  const pending: Record<number, number[]> = {};
  let flushQueued = false;


  // The serial port fires one event per byte; batch them per task so the page
  // gets one message per burst of output, not thousands.
  function queueByte(port: number, b: number) {
    (pending[port] ??= []).push(b);
    if (flushQueued) return;
    flushQueued = true;
    setTimeout(() => {
      flushQueued = false;
      for (const [p, bytes] of Object.entries(pending)) {
        if (!bytes.length) continue;
        const u8 = Uint8Array.from(bytes);
        bytes.length = 0;
        post({ op: 'serial', port: Number(p), bytes: u8 }, [u8.buffer]);
      }
    }, 4);
  }

  return async (m: WorkerIn) => {
    try {
      switch (m.op) {
        case 'boot': {
          const c = m.config;
          disks = {};
          for (const d of c.disks ?? []) disks[d.slot] = new SparseDisk(d.data.byteLength, d.data);
          const opts: V86Options = {
            wasm_path: c.wasm,
            bios: { url: c.bios },
            vga_bios: { url: c.vgaBios },
            bzimage: c.bzimage ? { url: c.bzimage } : undefined,
            initrd: c.initrd ? { url: c.initrd } : undefined,
            filesystem: c.filesystem,
            // v86 takes any object with get/set/load as a disk image as is.
            hda: disks.hda as never,
            hdb: disks.hdb as never,
            cmdline: c.cmdline,
            memory_size: c.memoryMB * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            autostart: !c.initialState,
            uart1: true,
            disable_keyboard: true,
            disable_mouse: true,
            disable_speaker: true,
            net_device: { type: c.nic },
            initial_state: c.initialState ? { buffer: c.initialState } : undefined,
          };
          const started = performance.now();
          emu = new V86(opts);
          emu.add_listener('download-progress', (p) => post({ op: 'progress', file: p.file_name, loaded: p.loaded, total: p.total }));
          emu.add_listener('download-error', (p) => post({ op: 'error', message: `download failed: ${p.file_name}` }));
          emu.add_listener('serial0-output-byte', (b) => queueByte(0, b));
          emu.add_listener('serial1-output-byte', (b) => queueByte(1, b));
          const bus = (emu as unknown as { bus: Bus }).bus;
          bus.register('net0-send', (frame) => {
            const f = (frame as Uint8Array).slice();
            post({ op: 'net', frame: f }, [f.buffer]);
          });
          emu.add_listener('emulator-ready', async () => {
            if (c.initialState) await emu!.run();
            post({ op: 'ready', ms: Math.round(performance.now() - started), restored: !!c.initialState });
          });
          break;
        }
        case 'serial':
          emu?.serial_send_bytes(m.port, m.bytes);
          break;
        case 'net':
          (emu as unknown as { bus: Bus } | null)?.bus.send('net0-receive', m.frame);
          break;
        case 'save': {
          if (!emu) throw new Error('no machine');
          const state = await emu.save_state();
          post({ op: 'saved', id: m.id, state }, [state]);
          break;
        }
        case 'restore': {
          if (!emu) throw new Error('no machine');
          await emu.stop();
          await emu.restore_state(m.state);
          await emu.run();
          post({ op: 'restored', id: m.id });
          break;
        }
        case 'pause':
          await emu?.stop();
          break;
        case 'resume':
          await emu?.run();
          break;
        case 'stats':
          post({ op: 'stats', id: m.id, instructions: emu?.get_instruction_counter() ?? 0, running: emu?.is_running() ?? false });
          break;
        case 'disk': {
          const d = disks[m.slot];
          const data = d ? d.export() : null;
          post({ op: 'disk', id: m.id, slot: m.slot, data }, data ? [data.index.buffer, data.data.buffer] : []);
          break;
        }
        case 'fsstats': {
          // Bytes of 9p content fetched so far (v86 keeps them in a MemoryFileStorage).
          const store = (emu as unknown as { fs9p?: { storage?: { storage?: { filedata?: Map<string, Uint8Array> } } } } | null)?.fs9p?.storage?.storage?.filedata;
          let bytes = 0;
          for (const v of store?.values() ?? []) bytes += v.byteLength;
          post({ op: 'fsstats', id: m.id, files: store?.size ?? 0, bytes });
          break;
        }
        case 'destroy':
          await emu?.destroy();
          emu = null;
          close();
          break;
      }
    } catch (e) {
      post({ op: 'error', message: (e as Error).message, id: 'id' in m ? (m as { id: number }).id : undefined });
    }
  };
}
