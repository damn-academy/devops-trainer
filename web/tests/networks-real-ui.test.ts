// @vitest-environment jsdom
// The exam page for exams on real machines: the machines panel renders with
// the scripts and the collector commands, a pasted block from a machine turns
// its goals green, a block from another machine is refused, and the result
// screen counts the real tasks.

import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryBackend, store } from '../src/core/store';
import { blob, printed } from './real-blob';

beforeAll(async () => {
  await store.init(new MemoryBackend());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= function () {};
});

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('real-machine exam page', () => {
  it('renders the machines, judges pasted blocks and scores the attempt', async () => {
    const { examPage } = await import('../src/app/exam-page');
    const page = examPage('linux.exam.disk');
    const root = page.el;
    document.body.append(root);
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Training|Тренировка/.test(b.textContent ?? ''))!.click();
    expect(root.querySelector('.rl-lab')).toBeTruthy();
    expect(root.textContent).toContain('disk-plant.sh');
    expect(root.textContent).toContain('trainer-check-host.sh');
    const cmd = root.querySelector('.rl-machine .rl-pre')!.textContent!;
    expect(cmd).toMatch(/--machine app-01/);
    const nonce = /--nonce (\S+)/.exec(cmd)![1];

    const paste = root.querySelector<HTMLTextAreaElement>('.rl-machine textarea')!;
    const verify = root.querySelector<HTMLButtonElement>('.rl-machine .btn.primary')!;
    // A block from another machine is refused.
    paste.value = printed({ ...blob('vm9', 'linux-disk', {}), nonce });
    verify.click();
    await tick();
    expect(root.querySelector('.rl-machine .rl-status')!.className).toContain('err');

    const df = 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/loop0 159564 87564 72000 55% /srv/shop';
    paste.value = printed({ ...blob('app-01', 'linux-disk', { raw: { findmnt: '/dev/loop0 /srv/shop ext4 rw', df }, trees: { '/srv/shop/lib/orders': 'a'.repeat(64) }, files: { '/var/lib/dt-trainer/disk.start': { exists: true, type: 'f', mode: '600', text: 'a'.repeat(64) + '\n' } }, units: { 'orders.service': { show: 'ActiveState=active\nUnitFileState=enabled' } } }), nonce });
    verify.click();
    await tick();
    expect(root.querySelector('.rl-machine .rl-status')!.className).toContain('ok');
    const firstCard = root.querySelector('.ex2-card .rl-goals')!;
    expect(firstCard.querySelectorAll('li.ok').length).toBe(3);

    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Submit the practice|Сдать практику/.test(b.textContent ?? ''))!.click();
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Finish|Завершить/.test(b.textContent ?? ''))!.click();
    // Card 1 holds (35) and card 2 too: the cron file is absent in this block (15).
    expect(root.textContent).toMatch(/50%/);
    page.dispose?.();
    root.remove();
  });
});
