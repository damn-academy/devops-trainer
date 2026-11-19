// One v86 emulator per dedicated worker (design 09 §1.4.7): the x86-to-wasm
// JIT never blocks scrolling or animations of the page. The protocol is in
// messages.ts, the emulator logic in host.ts.

/// <reference lib="webworker" />

import { createHost } from './host';
import type { WorkerIn, WorkerOut } from './messages';

declare const self: DedicatedWorkerGlobalScope;

const handle = createHost(
  (m: WorkerOut, transfer: Transferable[] = []) => self.postMessage(m, transfer),
  () => self.close(),
);
self.onmessage = (ev: MessageEvent<WorkerIn>) => void handle(ev.data);
