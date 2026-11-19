// Messages between the page and v86.worker.ts. Byte buffers are transferred,
// not copied.

import type { SparseDiskData } from './sparse-disk';

export interface DiskConfig {
  slot: 'hda' | 'hdb';
  /** A blank disk of this size, or the saved contents of one. */
  data: SparseDiskData;
}

export interface BootConfig {
  /** Absolute URLs (the worker resolves nothing on its own). */
  wasm: string;
  bios: string;
  vgaBios: string;
  /** Kernel to boot directly; left out when restoring a state or booting from a disk. */
  bzimage?: string;
  initrd?: string;
  cmdline: string;
  /** A 9p root file system: the v86 index (fs.json) and the base URL of its content files. */
  filesystem?: { basefs: string; baseurl: string };
  /** IDE disks (sparse: only written blocks take memory and go into snapshots). */
  disks?: DiskConfig[];
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
  | { op: 'disk'; id: number; slot: 'hda' | 'hdb' }
  | { op: 'fsstats'; id: number }
  | { op: 'destroy' };

export type WorkerOut =
  | { op: 'progress'; file: string; loaded: number; total: number }
  | { op: 'ready'; ms: number; restored: boolean }
  | { op: 'serial'; port: number; bytes: Uint8Array }
  | { op: 'net'; frame: Uint8Array }
  | { op: 'saved'; id: number; state: ArrayBuffer }
  | { op: 'restored'; id: number }
  | { op: 'stats'; id: number; instructions: number; running: boolean }
  | { op: 'disk'; id: number; slot: 'hda' | 'hdb'; data: SparseDiskData | null }
  | { op: 'fsstats'; id: number; files: number; bytes: number }
  | { op: 'error'; message: string; id?: number };
