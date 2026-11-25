import { bi } from '../../../core/i18n';
import type { Mounted, SetupHook, Task, TerminalSetup, WidgetReg } from '../../../core/types';
import { netSetup } from '../../../engine/sim-net/module';
import { netOf } from '../../../engine/sim-net/state';

export const dnsSetup: SetupHook = {
  key: 'marketingDns',
  async apply(machine) {
    await netSetup.apply(machine, { preset: 'tcp' });
    const server = netOf(machine).world.hosts.srv!;
    const dns = server.services.find(s => s.kind === 'dns')!.dns!;
    dns.zones = [{ origin: 'mail.example-cloud.test.', negTtl: 300, records: [
      { name: 'mail.example-cloud.test.', type: 'SOA', ttl: 300, data: 'ns.mail.example-cloud.test. hostmaster.mail.example-cloud.test. 1 3600 600 86400 300' },
      { name: 'mail.example-cloud.test.', type: 'TXT', ttl: 300, data: '"v=spf1 include:_spf.mailer.test ~all"' },
      { name: 'selector1._domainkey.mail.example-cloud.test.', type: 'TXT', ttl: 300, data: '"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A"' },
    ] }];
  },
};
export function validDmarc(text: string): boolean {
  const tags = text.trim().split(';').map(s => s.trim()).filter(Boolean);
  if (tags[0] !== 'v=DMARC1') return false;
  const seen = new Set<string>();
  for (const tag of tags) {
    const match = /^([a-z]+)\s*=\s*(\S.*)$/.exec(tag);
    if (!match || seen.has(match[1]!)) return false;
    seen.add(match[1]!);
  }
  return tags.some(tag => /^p\s*=\s*(none|quarantine|reject)$/.test(tag));
}
export const dnsLabSetup: TerminalSetup = { cwd: '/home/learner', ext: { marketingDns: true } };
export const dnsTask: Task = {
  id: 'dmarc',
  // TODO(prose): Russian exercise draft.
  prompt: bi('Проверьте SPF, DKIM и отсутствующий DMARC командой dig TXT (или dig +short TXT). Сохраните запись v=DMARC1 с p=none, quarantine или reject в dmarc.txt. Это локальный файл, не публикация в DNS.', 'Inspect SPF, DKIM and the missing DMARC with dig TXT (or dig +short TXT). Save a v=DMARC1 record with p=none, quarantine or reject in dmarc.txt. This is a local file, not a DNS publication.'),
  chips: 'dig TXT mail.example-cloud.test; dig TXT selector1._domainkey.mail.example-cloud.test; dig TXT _dmarc.mail.example-cloud.test',
  check: { when: facts => validDmarc(facts.files['/home/learner/dmarc.txt']?.text ?? '') },
};
export const dnsLabWidget: WidgetReg = {
  id: 'marketing.dns-lab',
  mount(el, _props, ctx) {
    let disposed = false;
    let mounted: Mounted | undefined;
    void import('../../../app/terminal-section').then(({ mountLab }) => {
      if (disposed) return;
      mounted = mountLab(el, { key: `${ctx.lessonId}/${ctx.sectionId}`, setup: dnsLabSetup, tasks: [dnsTask], level: ctx.level, block: 'marketing', lessonId: ctx.lessonId, index: 0, count: 1, onAllDone: () => ctx.complete() });
    });
    return { dispose() { disposed = true; mounted?.dispose(); } };
  },
};
