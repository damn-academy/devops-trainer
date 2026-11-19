// Wiring between v86 machines and dt-switch: each machine's network card is
// one switch port. Frames go page ↔ worker as transferable buffers.

import type { V86Machine } from './machine';
import type { L2Switch, PortConfig } from './switch';

/** Plug a machine into a switch port named after the machine. Returns the unplug function. */
export function connectMachine(sw: L2Switch, m: V86Machine, port: PortConfig, portId = m.id): () => void {
  sw.addPort(portId, port, (frame) => m.netIn(frame));
  m.netOut = (frame) => sw.receive(portId, frame);
  return () => {
    m.netOut = null;
    sw.removePort(portId);
  };
}

/** A locally administered MAC address for node n: 02:64:74 is "dt" in ASCII after the 02 prefix. */
export function nodeMac(n: number): string {
  return `02:64:74:00:00:${n.toString(16).padStart(2, '0')}`;
}
