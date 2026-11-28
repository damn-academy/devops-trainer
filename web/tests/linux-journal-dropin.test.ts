import { expect, it } from 'vitest';
import { journalMaxUse } from '../src/blocks/linux';

it('accepts the limit in journald.conf or in a drop-in, the last one winning', () => {
  expect(journalMaxUse({ '/etc/systemd/journald.conf': { text: '[Journal]\nSystemMaxUse=50M\n' } })).toBe('50M');
  expect(journalMaxUse({
    '/etc/systemd/journald.conf': { text: '[Journal]\n#SystemMaxUse=\n' },
    '/etc/systemd/journald.conf.d/size.conf': { text: '[Journal]\nSystemMaxUse = 50M\n' },
  })).toBe('50M');
  expect(journalMaxUse({
    '/etc/systemd/journald.conf.d/10-a.conf': { text: 'SystemMaxUse=50M\n' },
    '/etc/systemd/journald.conf.d/20-b.conf': { text: 'SystemMaxUse=1G\n' },
  })).toBe('1G');
  expect(journalMaxUse({ '/etc/systemd/journald.conf': { text: '#SystemMaxUse=50M\n' } })).toBeNull();
});
