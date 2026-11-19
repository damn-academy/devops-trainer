// Machine profiles: which image a real machine boots and how (design 00 §6.13).
//
//   buildroot      the v86 demo kernel with BusyBox (the first wave; 32 MB)
//   lab-node       the trainer's Alpine Linux x86 image on a 9p root: bash,
//                  OpenRC, sshd, nginx, iproute2, nftables/iptables, dnsmasq,
//                  LVM, parted, git, OpenTofu, man pages (scripts/build-lab-image.mjs)
//   lab-installer  the same distribution as installer media: a small live
//                  system, the package repository at /media/cdrom/apks and a
//                  blank disk to install onto; after `reboot` the machine
//                  starts from that disk through its own boot loader
//
// Lessons pick a profile by id; the files come from public/v86/lab/manifest.json.

import { bi, type Bi } from '../../core/i18n';

export type ProfileId = 'buildroot' | 'lab-node' | 'lab-installer';

export interface DiskSpec {
  /** IDE slot: hda is /dev/sda in the guest, hdb is /dev/sdb. */
  slot?: 'hda' | 'hdb';
  sizeMB: number;
}

export interface MachineProfile {
  id: ProfileId;
  title: Bi;
  /** Which image family: the Buildroot bzImage or the lab Alpine image. */
  image: 'buildroot' | 'alpine';
  memoryMB: number;
  nic: 'ne2k' | 'virtio';
  /** Disks attached when the lesson does not say otherwise. */
  disks: DiskSpec[];
  hostname: string;
  /** sshd runs on boot (host keys are regenerated for every clone). */
  sshd: boolean;
  /** Part of the boot-snapshot key: bump when the bootstrap or identity of this profile changes. */
  version: number;
}

export const PROFILES: Record<ProfileId, MachineProfile> = {
  buildroot: {
    id: 'buildroot',
    title: bi('Linux 5.6 и BusyBox', 'Linux 5.6 and BusyBox'),
    image: 'buildroot',
    memoryMB: 32,
    nic: 'ne2k',
    disks: [],
    hostname: 'linux',
    sshd: false,
    version: 3,
  },
  'lab-node': {
    id: 'lab-node',
    title: bi('Alpine Linux: машина лаборатории', 'Alpine Linux: a lab machine'),
    image: 'alpine',
    memoryMB: 128,
    nic: 'virtio',
    disks: [],
    hostname: 'lab',
    sshd: true,
    version: 1,
  },
  'lab-installer': {
    id: 'lab-installer',
    title: bi('Alpine Linux: установочный носитель и чистый диск', 'Alpine Linux: installer media and a blank disk'),
    image: 'alpine',
    memoryMB: 160,
    nic: 'virtio',
    disks: [{ slot: 'hda', sizeMB: 2048 }],
    hostname: 'localhost',
    sshd: false,
    version: 1,
  },
};

export function profile(id: ProfileId | undefined): MachineProfile {
  return PROFILES[id ?? 'buildroot'] ?? PROFILES.buildroot;
}
