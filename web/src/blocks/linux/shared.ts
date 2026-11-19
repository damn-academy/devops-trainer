// Small helpers for the Linux lessons: sources, links to man7.org and the
// offline corpus, and the shape of a lesson section.

import { bi } from '../../core/i18n';
import type { Bi, DocRef, SourceLink, Sources } from '../../core/types';

export const man7 = (name: string, sec: number | string): SourceLink => ({ title: `${name}(${sec}) — Linux manual page`, url: `https://man7.org/linux/man-pages/man${String(sec)[0]}/${name}.${sec}.html` });
export const opennet = (name: string, sec: number): SourceLink => ({ title: `${name}(${sec}) — русская страница руководства (OpenNet)`, url: `https://www.opennet.ru/man.shtml?topic=${name}&category=${sec}&russian=0` });
export const wiki = (title: string, path: string): SourceLink => ({ title: `${title} — Википедия`, url: `https://ru.wikipedia.org/wiki/${path}` });
export const arch = (title: string, path: string): SourceLink => ({ title: `${title} — ArchWiki`, url: `https://wiki.archlinux.org/title/${path}` });

export const BASH_MANUAL: SourceLink = { title: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/bash.html' };
export const TLCL: SourceLink = { title: 'William Shotts — The Linux Command Line', url: 'https://linuxcommand.org/tlcl.php' };
export const DEBIAN_HANDBOOK_RU: SourceLink = { title: 'Настольная книга администратора Debian', url: 'https://debian-handbook.info/browse/ru-RU/stable/' };
export const DEBIAN_HANDBOOK: SourceLink = { title: 'The Debian Administrator’s Handbook', url: 'https://debian-handbook.info/browse/stable/' };
export const SYSTEMD_MAN = (page: string): SourceLink => ({ title: `${page} — systemd manual`, url: `https://www.freedesktop.org/software/systemd/man/latest/${page}.html` });

export function sources(en: SourceLink[], ru: SourceLink[]): Sources {
  return { en, ru };
}

/** A pointer into the offline corpus: page, section, highlighted line. */
export const ref = (page: string, anchor?: string, line?: string): DocRef => ({ page, anchor, line });

export const t = bi;
export type { Bi };
