// The cloud's VM backend over the lab (design 00 §6.13): every VM the API
// creates is a real Alpine machine of the lab image, booted (or cloned from
// the boot snapshot) by V86Lab and plugged into the same dt-switch port VLAN
// as its cloud network. Stop keeps nothing (a stopped lab machine is
// disposed to give its memory back); start and reboot boot it again with the
// same identity, so it looks like a fresh boot from the same image. Security
// groups are applied inside the guest as iptables rules, the way a cloud
// agent would.

import type { BackendImage, VmBackend, VmHandle, VmSpec } from '../../../engine/cloud/vm-backend';
import type { V86Lab } from '../../../engine/v86/lab';
import type { V86Machine } from '../../../engine/v86/machine';

export const LAB_IMAGE: BackendImage = {
  name: 'lab-node',
  description: 'Alpine Linux x86, the lab image: OpenSSH, nginx, iproute2, nftables, git, curl, jq',
  minMemoryMB: 128,
  ssh: true,
  cloudInit: true,
};

export interface V86BackendOptions {
  /** Memory the tab may give to cloud VMs, MiB. */
  totalMB: number;
  /** Called when a VM machine appears or goes away (the panel redraws). */
  onChange?: () => void;
}

export function v86Backend(lab: V86Lab, o: V86BackendOptions): VmBackend & { machine(id: string): V86Machine | undefined; names(): Map<string, string> } {
  const vms = new Map<string, { name: string; mb: number; console: string; spec: VmSpec }>();
  const handle = (id: string, m: V86Machine): VmHandle => ({
    id,
    console: () => vms.get(id)?.console.slice(-8000) ?? '',
    machine: m,
  });
  const boot = async (spec: VmSpec, progress: (message: string, pct: number) => void) => {
    progress('booting a real machine (v86)', 10);
    const m = await lab.add({
      name: spec.hostname,
      ip: spec.ip,
      mac: spec.mac,
      gateway: spec.gateway,
      dns: spec.dns[0],
      memoryMB: spec.memoryMB,
      port: { mode: 'access', vlan: spec.vlan },
      authorizedKeys: spec.sshAuthorizedKeys,
      userData: spec.userData,
    });
    vms.set(spec.id, { name: spec.hostname, mb: spec.memoryMB, console: '', spec });
    if (spec.firewall.trim()) await m.exec(`command -v iptables-restore >/dev/null && iptables-restore <<'DT_FW'\n${spec.firewall}\nDT_FW`).catch(() => undefined);
    progress('the guest is up', 100);
    o.onChange?.();
    const b = m.boot!;
    return { handle: handle(spec.id, m), boot: { kind: b.kind === 'cold' ? ('cold' as const) : ('restored' as const), ms: b.ms } };
  };
  const remove = (id: string) => {
    const v = vms.get(id);
    if (v) lab.remove(v.name);
    vms.delete(id);
    o.onChange?.();
  };
  return {
    kind: 'v86',
    images: () => [LAB_IMAGE],
    capacityMB: () => o.totalMB - [...vms.values()].reduce((n, x) => n + x.mb, 0),
    create: boot,
    start: boot,
    async stop(id) {
      remove(id);
    },
    async reboot(id) {
      // A lab machine runs from a shared 9p image: a reboot is a fresh boot of the same identity.
      const v = vms.get(id);
      if (!v) return;
      remove(id);
      await boot(v.spec, () => undefined);
    },
    async destroy(id) {
      remove(id);
    },
    async updateFirewall(id, firewall) {
      const v = vms.get(id);
      const m = v ? lab.nodes.get(v.name)?.machine : undefined;
      if (m) await m.exec(`command -v iptables-restore >/dev/null && iptables-restore <<'DT_FW'\n${firewall}\nDT_FW`).catch(() => undefined);
    },
    machine(id) {
      const v = vms.get(id);
      return v ? lab.nodes.get(v.name)?.machine : undefined;
    },
    names: () => new Map([...vms].map(([id, v]) => [id, v.name])),
  };
}
