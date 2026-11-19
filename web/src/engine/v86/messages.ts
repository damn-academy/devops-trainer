// Messages between the page and v86.worker.ts. Byte buffers are transferred,
// not copied.

export interface BootConfig {
  /** Absolute URLs (the worker resolves nothing on its own). */
  wasm: string;
  bios: string;
  vgaBios: string;
  bzimage: string;
  cmdline: string;
  memoryMB: number;
  nic: 'ne2k' | 'virtio';
  /** A saved state to start from instead of booting (boot-from-snapshot). */
  initialState?: ArrayBuffer;
}

export type WorkerIn =
  | { op: 'boot'; config: BootConfig }
  | { op: 'serial'; port: number; bytes: Uint8Array }
  | { op: 'net'; frame: Uint8Array }
  | { op: 'save'; id: number }
  | { op: 'restore'; id: number; state: ArrayBuffer }
  | { op: 'pause' }
  | { op: 'resume' }
  | { op: 'stats'; id: number }
  | { op: 'destroy' };

export type WorkerOut =
  | { op: 'progress'; file: string; loaded: number; total: number }
  | { op: 'ready'; ms: number; restored: boolean }
  | { op: 'serial'; port: number; bytes: Uint8Array }
  | { op: 'net'; frame: Uint8Array }
  | { op: 'saved'; id: number; state: ArrayBuffer }
  | { op: 'restored'; id: number }
  | { op: 'stats'; id: number; instructions: number; running: boolean }
  | { op: 'error'; message: string; id?: number };
