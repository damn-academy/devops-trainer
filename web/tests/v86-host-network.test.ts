import { beforeEach, expect, it, vi } from 'vitest';
import { createHost } from '../src/engine/v86/host';
import type { BootConfig } from '../src/engine/v86/messages';

const fake = vi.hoisted(() => ({
  send: vi.fn(),
  rx: { enabled: false, is_configured: vi.fn(() => false), has_request: vi.fn(() => true) },
  device: { device_status: 0, queues: [] as unknown[] },
}));
vi.mock('v86', () => ({
  V86: class {
    bus = { register: vi.fn(), send: fake.send };
    v86 = { cpu: { devices: { virtio_net: { virtio: fake.device } } } };
    add_listener() {}
    async restore_state() { fake.device.device_status = 15; fake.rx.enabled = true; fake.rx.is_configured.mockReturnValue(true); }
    async stop() {}
    async run() {}
  },
}));

const config: BootConfig = { wasm: '', bios: '', vgaBios: '', cmdline: '', memoryMB: 128, nic: 'virtio' };
// A broadcast ARP can arrive as soon as the new machine joins the switch.
const frame = Uint8Array.from([255, 255, 255, 255, 255, 255, 2, 100, 116, 0, 0, 1, 8, 6, ...new Array(28).fill(0)]);

beforeEach(() => {
  fake.send.mockClear();
  fake.rx.enabled = false;
  fake.rx.is_configured.mockReturnValue(false);
  fake.rx.has_request.mockReturnValue(true);
  fake.device.device_status = 0;
  fake.device.queues = [fake.rx];
});

it('drops incoming broadcasts until virtio DRIVER_OK and the RX ring are ready, including after reset', async () => {
  const host = createHost(() => {});
  await host({ op: 'boot', config });
  const receive = () => host({ op: 'net', frame });
  await receive();
  fake.device.device_status = 15;
  await receive();
  fake.rx.enabled = true;
  await receive();
  expect(fake.send).not.toHaveBeenCalled();

  fake.rx.is_configured.mockReturnValue(true);
  await receive();
  expect(fake.send).toHaveBeenCalledExactlyOnceWith('net0-receive', frame);

  fake.rx.has_request.mockReturnValue(false);
  await receive();
  expect(fake.send).toHaveBeenCalledTimes(1);
  fake.rx.has_request.mockReturnValue(true);

  fake.device.device_status = 0;
  await receive();
  expect(fake.send).toHaveBeenCalledTimes(1);
  await host({ op: 'restore', id: 1, state: new ArrayBuffer(0) });
  await receive();
  expect(fake.send).toHaveBeenCalledTimes(2);
});

it('leaves receive filtering to the NE2000 device', async () => {
  const host = createHost(() => {});
  await host({ op: 'boot', config: { ...config, nic: 'ne2k' } });
  await host({ op: 'net', frame });
  expect(fake.send).toHaveBeenCalledExactlyOnceWith('net0-receive', frame);
});
