// Bundle with rolldown --platform node; execute only inside rv64-dev.
// One Ethernet frame per loopback UDP datagram. No privileged TAP or host routes.
import { createSocket } from 'node:dgram';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createRV64Network } from './network';

const root = resolve(process.env.RV64_MIRROR ?? '/work/guest/mirror');
const services = createRV64Network(async path => {
  const file = resolve(root, path);
  if (!file.startsWith(root + sep)) return null;
  try { return { body: new Uint8Array(await readFile(file)) }; }
  catch { return null; }
});
const socket = createSocket('udp4');
const port = Number(process.env.RV64_NET_PORT ?? 18080);
let peer: number | undefined;
services.network.addPort('native', { mode: 'access' }, frame => {
  if (peer !== undefined) socket.send(frame, peer, '127.0.0.1');
});
socket.on('message', (frame, remote) => {
  if (remote.address !== '127.0.0.1' || (peer !== undefined && peer !== remote.port)) return;
  peer = remote.port;
  services.network.receive('native', frame);
});
services.dhcp.on(event => console.log(JSON.stringify({ at: Date.now(), dhcp: event })));
services.dns.on(event => console.log(JSON.stringify({ at: Date.now(), dns: event })));
socket.bind(port, '127.0.0.1', () => console.log(`RV64_NET_READY ${port}`));
process.on('SIGTERM', () => { services.dispose(); socket.close(); process.exit(0); });
