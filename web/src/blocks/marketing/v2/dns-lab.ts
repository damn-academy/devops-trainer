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
  prompt: bi('Посмотрите записи учебного домена командой `dig TXT` для самого домена, для ключа DKIM и для политики DMARC и найдите, какой записи не хватает. Затем запишите в файл `dmarc.txt` исправленную запись политики DMARC, которая начинается с `v=DMARC1` и содержит политику `p=none`, `p=quarantine` или `p=reject`. Файл остаётся на учебной машине: так вы готовите запись, которую потом опубликовали бы в DNS своего домена.', 'Inspect SPF, DKIM and the missing DMARC with dig TXT (or dig +short TXT). Save a v=DMARC1 record with p=none, quarantine or reject in dmarc.txt. This is a local file, not a DNS publication.'),
  hints: {
    H1: bi('В ответе `dig` нужна секция ANSWER SECTION: в ней стоит сама запись в кавычках. Если этой секции нет, а в заголовке ответа стоит `status: NXDOMAIN` или `ANSWER: 0`, записи с таким именем не существует.', 'Look for the ANSWER SECTION in the dig output: it holds the record in quotes. If it is missing and the header says `status: NXDOMAIN` or `ANSWER: 0`, no such record exists.'),
    H2: bi('SPF и DKIM на месте, а на запрос к `_dmarc.mail.example-cloud.test` ответа нет. Значит, не хватает политики DMARC.', 'SPF and DKIM are present; the query for `_dmarc.mail.example-cloud.test` returns nothing. The DMARC policy is missing.'),
    H3: bi('Запишите строку в файл одной командой: `echo "v=DMARC1; p=none" > dmarc.txt`. Знак `>` создаёт файл и записывает в него текст из кавычек; проверить содержимое можно командой `cat dmarc.txt`.', 'Write the line to the file with one command: `echo "v=DMARC1; p=none" > dmarc.txt`. The `>` sign creates the file with the quoted text; check it with `cat dmarc.txt`.'),
  },
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
