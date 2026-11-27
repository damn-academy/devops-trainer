import { L2Switch } from '../v86/switch';
import { LabHost } from '../labhost/host';
import { DhcpServer } from '../labhost/dhcp';
import { DnsServer } from '../labhost/dns';
import { serveHttp } from '../labhost/http';
import { mirrorHandler, type StaticSource } from '../labhost/mirror';
import { ipToNum } from '../labhost/wire';

/** The same isolated Ethernet services in Chromium and the native runner.
 * Sources must be local assets: this network has no upstream or Internet NAT. */
export function createRV64Network(source: StaticSource, network = new L2Switch()) {
  const host = new LabHost();
  const gateway = ipToNum('10.0.0.1');
  host.addInterface(1, gateway, 24);
  const dhcp = new DhcpServer(host);
  dhcp.setPool({ vlan: 1, from: ipToNum('10.0.0.10'), to: ipToNum('10.0.0.99'),
    prefix: 24, gateway, dns: [gateway], domain: 'lab' });
  const dns = new DnsServer(host, name => ['mirror.lab', 'registry.lab', 'gateway.lab'].includes(name)
    ? [{ name, type: 'A', ttl: 60, value: '10.0.0.1' }] : []);
  const stopHttp = serveHttp(host, 80, mirrorHandler(source));
  const detach = host.attach(network, 'rv64-labhost');
  return { network, host, dhcp, dns, dispose() { stopHttp(); detach(); } };
}
