// The metadata service at 169.254.169.254, EC2-style paths plus the
// OpenStack JSON document. A VM is recognised by its source address (and
// VLAN), like on a real cloud: nothing to authenticate, nothing to configure.

import type { HttpRequest, HttpResponse } from '../labhost/http';
import { json, text } from '../labhost/http';
import { REGION, ZONE, type Cloud, type Vm } from './api';

export const METADATA_IP = '169.254.169.254';

/** The #cloud-config the lab generates for a VM (keys, hostname, the user's own part). */
export function cloudConfig(cloud: Cloud, vm: Vm): string {
  const spec = cloud.spec(vm);
  const lines = ['#cloud-config', `hostname: ${vm.hostname}`, `fqdn: ${vm.fqdn}`, 'manage_etc_hosts: true'];
  if (spec.sshAuthorizedKeys.length) lines.push('ssh_authorized_keys:', ...spec.sshAuthorizedKeys.map((k) => `  - ${k}`));
  if (spec.firewall) lines.push('write_files:', '  - path: /etc/iptables/rules-save', '    permissions: "0600"', '    content: |', ...spec.firewall.trimEnd().split('\n').map((l) => `      ${l}`));
  return lines.join('\n') + '\n';
}

export function metadataHandler(cloud: Cloud): (req: HttpRequest) => HttpResponse {
  return (req) => {
    const vm = cloud.vmByIp(req.remote.ip, req.vlan);
    if (!vm) return text(404, `no instance with address ${req.remote.ip}: the metadata service answers only VMs created through the cloud API\n`);
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'GET only\n');
    const spec = cloud.spec(vm);
    const sgs = vm.security_group_ids.map((id) => cloud.state.securityGroups.find((g) => g.id === id)).filter(Boolean);
    const keyNames = vm.ssh_key_ids.map((id) => cloud.state.sshKeys.find((k) => k.id === id)?.name ?? id);
    const keys = spec.sshAuthorizedKeys;
    const md: Record<string, string> = {
      'ami-id': vm.image,
      'instance-id': vm.id,
      'instance-type': vm.flavor,
      hostname: vm.fqdn,
      'local-hostname': vm.fqdn,
      'local-ipv4': vm.ip,
      mac: vm.mac,
      'placement/availability-zone': ZONE,
      'placement/region': REGION,
      'security-groups': sgs.map((g) => g!.name).join('\n'),
      'security-groups.json': JSON.stringify(sgs.map((g) => ({ id: g!.id, name: g!.name, rules: g!.rules })), null, 2),
      'network/subnet-id': vm.subnet_id,
      'network/gateway': spec.gateway,
      'network/dns': spec.dns.join('\n'),
      'network/vlan': String(spec.vlan),
      'firewall/iptables-restore': spec.firewall,
    };
    keys.forEach((k, i) => {
      md[`public-keys/${i}/openssh-key`] = k;
    });
    const p = req.path.replace(/\/+$/, '');
    if (p === '' || p === '/latest') return text(200, 'meta-data/\nuser-data\ncloud-config\n');
    if (p === '/latest/user-data') return vm.user_data ? text(200, vm.user_data) : text(404, 'no user data\n');
    if (p === '/latest/cloud-config') return { status: 200, headers: { 'content-type': 'text/cloud-config' }, body: cloudConfig(cloud, vm) };
    if (p === '/openstack/latest/meta_data.json')
      return json(200, { uuid: vm.id, name: vm.name, hostname: vm.hostname, availability_zone: ZONE, project_id: vm.project, public_keys: Object.fromEntries(keys.map((k, i) => [keyNames[i] ?? `key-${i}`, k])), meta: vm.labels });
    if (p === '/openstack/latest/user_data') return vm.user_data ? text(200, vm.user_data) : text(404, 'no user data\n');
    const mp = /^\/latest\/meta-data(?:\/(.*))?$/.exec(p);
    if (!mp) return text(404, 'not found\n');
    const rel = mp[1] ?? '';
    if (rel === 'public-keys') return text(200, keys.map((_, i) => `${i}=${keyNames[i] ?? `key-${i}`}`).join('\n') + (keys.length ? '\n' : ''));
    if (md[rel] !== undefined) return text(200, md[rel].endsWith('\n') || !md[rel] ? md[rel] : `${md[rel]}\n`);
    // A directory: list what is under it, as EC2 does.
    const prefix = rel ? `${rel}/` : '';
    const children = new Set<string>();
    for (const k of Object.keys(md)) if (k.startsWith(prefix)) {
      const rest = k.slice(prefix.length);
      const i = rest.indexOf('/');
      children.add(i < 0 ? rest : rest.slice(0, i + 1));
    }
    if (rel === '') children.add('public-keys/');
    if (!children.size) return text(404, 'not found\n');
    return text(200, [...children].sort().join('\n') + '\n');
  };
}
