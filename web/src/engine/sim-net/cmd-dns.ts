// dig, nslookup and host. dig talks to a DNS server directly (it ignores
// /etc/hosts), prints every section of the answer, and with +trace walks the
// hierarchy itself from the root, the way a recursive resolver does.

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand } from '../../core/types';
import { abs, ask, parseResolvConf, serverLabel, type DnsAnswer } from './dns';
import { isIp } from './ip';
import { ROOT_IP } from './presets';
import { readHostFile, type DnsRR, type World } from './world';
import { net, notSimulated, page } from './cmd-util';

const DIG_VERSION = '9.20.15-1~deb13u1-Debian';
const TYPES = new Set(['A', 'AAAA', 'NS', 'MX', 'CNAME', 'TXT', 'SOA', 'PTR', 'CAA', 'SRV', 'ANY']);

function rrLine(r: DnsRR): string {
  const name = r.name.length < 24 ? r.name + '\t'.repeat(Math.max(1, Math.ceil((24 - r.name.length) / 8))) : `${r.name}\t`;
  return `${name}${r.ttl}\tIN\t${r.type}\t${r.data}`;
}

function whenLine(w: World): string {
  const d = new Date(w.clock);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day} ${mon} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`;
}

function defaultServer(ctx: CmdContext): string | undefined {
  const st = net(ctx);
  return parseResolvConf(readHostFile(st.world, st.io, st.world.local, '/etc/resolv.conf')).nameservers[0];
}

interface DigOpts {
  server?: string;
  name?: string;
  type: string;
  short: boolean;
  trace: boolean;
  rd: boolean;
  sections: { cmd: boolean; question: boolean; answer: boolean; authority: boolean; additional: boolean; stats: boolean; comments: boolean };
}

function parseDig(args: string[]): { o: DigOpts; error?: string; unsupported?: string } {
  const o: DigOpts = { type: 'A', short: false, trace: false, rd: true, sections: { cmd: true, question: true, answer: true, authority: true, additional: true, stats: true, comments: true } };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('@')) o.server = a.slice(1);
    else if (a.startsWith('+')) {
      const [name0] = a.slice(1).split('=');
      const neg = name0.startsWith('no');
      const name = neg ? name0.slice(2) : name0;
      const all = ['cmd', 'question', 'answer', 'authority', 'additional', 'stats', 'comments'] as const;
      if (name === 'short') o.short = !neg;
      else if (name === 'trace') o.trace = !neg;
      else if (name === 'recurse' || name === 'rec') o.rd = !neg;
      else if (name === 'all') for (const k of all) o.sections[k] = !neg;
      else if ((all as readonly string[]).includes(name)) o.sections[name as (typeof all)[number]] = !neg;
      else if (['tcp', 'vc', 'dnssec', 'cd', 'nssearch', 'identify', 'multiline', 'ttlid'].includes(name)) {
        if (name === 'tcp' || name === 'vc') continue;
        return { o, unsupported: `+${name0}` };
      } else return { o, error: `Invalid option: ${a}` };
    } else if (a === '-t') o.type = (args[++i] ?? 'A').toUpperCase();
    else if (a === '-x') return { o, unsupported: '-x' };
    else if (a.startsWith('-')) return { o, unsupported: a };
    else if (TYPES.has(a.toUpperCase()) && o.name) o.type = a.toUpperCase();
    else if (!o.name) o.name = a;
    else if (TYPES.has(a.toUpperCase())) o.type = a.toUpperCase();
  }
  return { o };
}

function printAnswer(ctx: CmdContext, o: DigOpts, a: DnsAnswer, name: string, server: string, ms: number, w: World, argv: string[]): void {
  if (o.short) {
    for (const r of a.answer) ctx.out(`${r.data}\n`);
    return;
  }
  const s = o.sections;
  if (s.cmd) ctx.out(`\n; <<>> DiG ${DIG_VERSION} <<>> ${argv.join(' ')}\n;; global options: +cmd\n`);
  if (s.comments) {
    const id = 1000 + (w.counter % 60000);
    const flags = ['qr', o.rd ? 'rd' : '', a.ra ? 'ra' : '', a.aa ? 'aa' : ''].filter(Boolean).join(' ');
    ctx.out(`;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${a.rcode}, id: ${id}\n;; flags: ${flags}; QUERY: 1, ANSWER: ${a.answer.length}, AUTHORITY: ${a.authority.length}, ADDITIONAL: ${a.additional.length + 1}\n`);
    if (!a.ra && o.rd) ctx.out(';; WARNING: recursion requested but not available\n');
    ctx.out('\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 1232\n');
  }
  if (s.question) ctx.out(`${s.comments ? ';; QUESTION SECTION:\n' : ''};${abs(name)}\t\t\tIN\t${o.type}\n`);
  const sec = (title: string, on: boolean, rrs: DnsRR[]) => {
    if (!on || !rrs.length) return;
    ctx.out(`${s.comments ? `\n;; ${title} SECTION:\n` : ''}${rrs.map(rrLine).join('\n')}\n`);
  };
  sec('ANSWER', s.answer, a.answer);
  sec('AUTHORITY', s.authority, a.authority);
  sec('ADDITIONAL', s.additional, a.additional);
  if (s.stats) ctx.out(`${s.comments || s.answer ? '\n' : ''};; Query time: ${Math.max(0, Math.round(ms))} msec\n;; SERVER: ${server}#53(${server}) (UDP)\n;; WHEN: ${whenLine(w)}\n;; MSG SIZE  rcvd: ${40 + abs(name).length + a.answer.length * 16 + a.authority.length * 24}\n\n`);
}

export const digCommand: ShellCommand = {
  name: 'dig',
  summary: bi('спросить DNS-сервер напрямую и показать весь ответ', 'ask a DNS server directly and show the whole answer'),
  help: `Usage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}
            {global-d-opt} host [@local-server] {local-d-opt}
            [ host [@local-server] {local-d-opt} [...]]
Where:  domain     is in the Domain Name System
        q-type     is one of (a,any,mx,ns,soa,hinfo,axfr,txt,...) [default:a]
        q-opt      is one of:
                 -t type             (specify query type)
                 -x dot-notation     (shortcut for reverse lookups)
        d-opt      is of the form +keyword[=value], where keyword is:
                 +[no]all            (Set or clear all display flags)
                 +[no]answer         (Control display of answer section)
                 +[no]authority      (Control display of authority section)
                 +[no]additional     (Control display of additional section)
                 +[no]cmd            (Control display of command line -
                                      global option)
                 +[no]comments       (Control display of packet header
                                      and section name comments)
                 +[no]question       (Control display of question section)
                 +[no]recurse        (Recursive mode (+[no]rec))
                 +[no]short          (Display nothing except short
                                      form of answers - global option)
                 +[no]stats          (Control display of statistics)
                 +[no]trace          (Trace delegation down from root
                                      [implies +dnssec])`,
  man: page('dig', 1, [
    { id: 'NAME', body: 'dig - DNS lookup utility' },
    { id: 'SYNOPSIS', body: 'dig [@server] [-b address] [-c class] [-f filename] [-k filename] [-m] [-p port#] [-q name] [-t type] [-v] [-x addr] [-y [hmac:]name:key] [-4] [-6] [name] [type] [class] [queryopt...]' },
    { id: 'DESCRIPTION', body: 'dig is a flexible tool for interrogating DNS name servers. It performs DNS lookups and displays the answers that are returned from the name server(s) that were queried. Most DNS administrators use dig to troubleshoot DNS problems because of its flexibility, ease of use, and clarity of output.\n\nUnless it is told to query a specific name server, dig tries each of the servers listed in /etc/resolv.conf. If no usable server addresses are found, dig sends the query to the local host.\n\ndig does not read /etc/hosts: it always asks a DNS server.' },
    { id: 'SIMPLE USAGE', body: 'A typical invocation of dig looks like:\n\n    dig @server name type\n\nwhere:\n\nserver is the name or IP address of the name server to query.\nname   is the name of the resource record that is to be looked up.\ntype   indicates what type of query is required - ANY, A, MX, SIG, etc. type can be any valid query type. If no type argument is supplied, dig performs a lookup for an A record.' },
    {
      id: 'QUERY OPTIONS',
      body: 'Each query option is identified by a keyword preceded by a plus sign (+). Some keywords set or reset an option. These may be preceded by the string no to negate the meaning of that keyword.\n\n+[no]all\n       This option sets or clears all display flags.\n+[no]answer\n       This option displays [or does not display] the answer section of a reply. The default is to display it.\n+[no]authority\n       This option displays [or does not display] the authority section of a reply. The default is to display it.\n+[no]additional\n       This option displays [or does not display] the additional section of a reply. The default is to display it.\n+[no]cmd\n       This option toggles the printing of the initial comment in the output, identifying the version of dig and the query options that have been applied.\n+[no]comments\n       This option toggles the display of some comment lines in the output, with information about the packet header and OPT pseudosection, and the names of the response section. The default is to print these comments.\n+[no]question\n       This option toggles the display of the question section of a query when an answer is returned. The default is to print the question section as a comment.\n+[no]recurse\n       This option toggles the setting of the RD (recursion desired) bit in the query. This bit is set by default, which means dig normally sends recursive queries.\n+[no]short\n       This option toggles whether a terse answer is provided. The default is to print the answer in a verbose form.\n+[no]stats\n       This option toggles the printing of statistics: when the query was made, the size of the reply, etc.\n+[no]trace\n       This option toggles tracing of the delegation path from the root name servers for the name being looked up. When tracing is enabled, dig makes iterative queries to resolve the name being looked up. It follows referrals from the root servers, showing the answer from each server that was used to resolve the lookup.',
    },
    { id: 'EXIT STATUS', body: 'dig return codes are:\n0      DNS response received, including NXDOMAIN status\n1      Usage error\n8      Couldn\'t open batch file\n9      No reply from server\n10     Internal error' },
    { id: 'EXAMPLES', body: 'dig shop.example\n    The A record, from the server in /etc/resolv.conf.\ndig @1.1.1.1 shop.example MX\n    The MX records, from a chosen server.\ndig +short shop.example\n    Only the addresses.' },
    { id: 'SEE ALSO', body: 'host(1), named(8), dnssec-keygen(8), RFC 1035.' },
  ], 'https://bind9.readthedocs.io/en/latest/manpages.html#dig-dns-lookup-utility', 'condensed from the BIND 9 manual (MPL 2.0)'),
  run(ctx) {
    const { o, error, unsupported } = parseDig(ctx.argv.slice(1));
    if (unsupported) return notSimulated(ctx, `dig ${unsupported}`);
    if (error) {
      ctx.err(`${error}\n`);
      return 1;
    }
    const st = net(ctx);
    const w = st.world;
    const name = o.name ?? '.';
    if (o.name === undefined) o.type = 'NS';
    const server = o.server ?? defaultServer(ctx) ?? '127.0.0.1';
    if (!isIp(server)) return notSimulated(ctx, '@server by name');
    if (o.trace) return digTrace(ctx, o, name, server);
    const t0 = w.clock;
    const r = ask(w, st.io, w.local, server, name, o.type, o.rd);
    if (!r.answer) {
      if (!o.short) ctx.out(`\n; <<>> DiG ${DIG_VERSION} <<>> ${ctx.argv.slice(1).join(' ')}\n;; global options: +cmd\n`);
      ctx.out(`;; communications error to ${server}#53: timed out\n;; communications error to ${server}#53: timed out\n;; communications error to ${server}#53: timed out\n\n; <<>> DiG ${DIG_VERSION} <<>> ${ctx.argv.slice(1).join(' ')}\n;; global options: +cmd\n;; no servers could be reached\n`);
      w.clock = t0 + 15000;
      return 9;
    }
    printAnswer(ctx, o, r.answer, name, server, r.ms, w, ctx.argv.slice(1));
    return 0;
  },
  complete: () => ['+short', '+trace', '+noall', '+answer', '+norecurse', 'A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'],
};

function digTrace(ctx: CmdContext, o: DigOpts, name: string, server: string): number {
  const st = net(ctx);
  const w = st.world;
  ctx.out(`\n; <<>> DiG ${DIG_VERSION} <<>> ${ctx.argv.slice(1).join(' ')}\n;; global options: +cmd\n`);
  const first = ask(w, st.io, w.local, server, '.', 'NS', true);
  if (!first.answer) {
    ctx.out(';; no servers could be reached\n');
    return 9;
  }
  const show = (rrs: DnsRR[]) => rrs.filter((r) => r.type !== 'SOA' || o.sections.authority).map(rrLine).join('\n');
  ctx.out(`${show(first.answer.answer)}\n;; Received ${60 + first.answer.answer.length * 20} bytes from ${server}#53(${server}) in ${Math.round(first.ms)} ms\n\n`);
  let servers = [ROOT_IP];
  const qname = abs(name);
  for (let i = 0; i < 10; i++) {
    let got: ReturnType<typeof ask> | undefined;
    let used = '';
    for (const s of servers) {
      got = ask(w, st.io, w.local, s, qname, o.type, false);
      used = s;
      if (got.answer) break;
      ctx.out(`;; communications error to ${s}#53: timed out\n`);
    }
    if (!got?.answer) {
      ctx.out(`;; no servers could be reached\n`);
      return 9;
    }
    const a = got.answer;
    const label = serverLabel(w, used);
    const shown = [...a.answer, ...a.authority];
    ctx.out(`${show(shown)}\n;; Received ${60 + shown.length * 24} bytes from ${used}#53(${label}) in ${Math.round(got.ms)} ms\n\n`);
    if (a.answer.length || a.rcode !== 'NOERROR' || !a.authority.some((r) => r.type === 'NS')) return 0;
    const glue = a.additional.filter((r) => r.type === 'A').map((r) => r.data);
    if (!glue.length) return 0;
    servers = glue;
  }
  return 0;
}

export const nslookupCommand: ShellCommand = {
  name: 'nslookup',
  summary: bi('спросить DNS о имени (старая утилита)', 'ask DNS about a name (the old utility)'),
  help: 'Usage: nslookup [-option] [name | -] [server]\n  -type=X     query type (A, MX, NS, TXT, ...)',
  man: page('nslookup', 1, [
    { id: 'NAME', body: 'nslookup - query Internet name servers interactively' },
    { id: 'SYNOPSIS', body: 'nslookup [-option] [name | -] [server]' },
    { id: 'DESCRIPTION', body: 'nslookup is a program to query Internet domain name servers. nslookup has two modes: interactive and non-interactive. Non-interactive mode prints just the name and requested information for a host or domain.' },
    { id: 'ARGUMENTS', body: 'name\n       The name to look up.\nserver\n       The name server to use instead of the one from /etc/resolv.conf.\n-type=value\n       Change the type of the information query. The default is A.' },
    { id: 'SEE ALSO', body: 'dig(1), host(1), named(8).' },
  ], 'https://bind9.readthedocs.io/en/latest/manpages.html#nslookup-query-internet-name-servers-interactively', 'condensed from the BIND 9 manual (MPL 2.0)'),
  run(ctx) {
    const args = ctx.argv.slice(1);
    let type = 'A';
    const rest: string[] = [];
    for (const a of args) {
      if (/^-(type|query|q)=/i.test(a)) type = a.split('=')[1].toUpperCase();
      else if (a.startsWith('-')) return notSimulated(ctx, `nslookup ${a}`);
      else rest.push(a);
    }
    const [name, srv] = rest;
    if (!name) return notSimulated(ctx, 'interactive nslookup');
    const st = net(ctx);
    const w = st.world;
    const server = srv ?? defaultServer(ctx) ?? '127.0.0.1';
    const r = ask(w, st.io, w.local, server, name, type, true);
    if (!r.answer) {
      ctx.out(';; connection timed out; no servers could be reached\n\n');
      return 1;
    }
    ctx.out(`Server:\t\t${server}\nAddress:\t${server}#53\n\n`);
    const a = r.answer;
    if (a.rcode === 'NXDOMAIN') {
      ctx.out(`** server can't find ${name}: NXDOMAIN\n\n`);
      return 1;
    }
    if (a.rcode === 'SERVFAIL') {
      ctx.out(`** server can't find ${name}: SERVFAIL\n\n`);
      return 1;
    }
    if (!a.aa) ctx.out('Non-authoritative answer:\n');
    for (const rr of a.answer) {
      if (rr.type === 'A') ctx.out(`Name:\t${rr.name.replace(/\.$/, '')}\nAddress: ${rr.data}\n`);
      else if (rr.type === 'CNAME') ctx.out(`${rr.name.replace(/\.$/, '')}\tcanonical name = ${rr.data}\n`);
      else if (rr.type === 'MX') ctx.out(`${rr.name.replace(/\.$/, '')}\tmail exchanger = ${rr.data}\n`);
      else ctx.out(`${rr.name.replace(/\.$/, '')}\t${rr.type.toLowerCase()} = ${rr.data}\n`);
    }
    if (!a.answer.length) ctx.out(`*** Can't find ${name}: No answer\n`);
    ctx.out('\n');
    return 0;
  },
};

export const hostCommand: ShellCommand = {
  name: 'host',
  summary: bi('коротко: какие адреса и записи у имени', 'in short: which addresses and records a name has'),
  help: 'Usage: host [-t type] hostname [server]\n       -t specifies the query type (A, MX, NS, TXT, ...)',
  man: page('host', 1, [
    { id: 'NAME', body: 'host - DNS lookup utility' },
    { id: 'SYNOPSIS', body: 'host [-aCdlnrsTUwv46] [-c class] [-N ndots] [-p port] [-R number] [-t type] [-W wait] [-m flag] name [server]' },
    { id: 'DESCRIPTION', body: 'host is a simple utility for performing DNS lookups. It is normally used to convert names to IP addresses and vice versa. When no arguments or options are given, host prints a short summary of its command-line arguments and options.' },
    { id: 'OPTIONS', body: '-t type\n       This option specifies the query type. The type argument can be any recognized query type: CNAME, NS, SOA, TXT, DNSKEY, AXFR, etc.' },
    { id: 'SEE ALSO', body: 'dig(1), named(8).' },
  ], 'https://bind9.readthedocs.io/en/latest/manpages.html#host-dns-lookup-utility', 'condensed from the BIND 9 manual (MPL 2.0)'),
  run(ctx) {
    const args = ctx.argv.slice(1);
    let type: string | undefined;
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-t') type = (args[++i] ?? 'A').toUpperCase();
      else if (args[i].startsWith('-')) return notSimulated(ctx, `host ${args[i]}`);
      else rest.push(args[i]);
    }
    const [name, srv] = rest;
    if (!name) {
      ctx.out(hostCommand.help + '\n');
      return 1;
    }
    const st = net(ctx);
    const w = st.world;
    const server = srv ?? defaultServer(ctx) ?? '127.0.0.1';
    const types = type ? [type] : ['A', 'MX'];
    for (const t of types) {
      const r = ask(w, st.io, w.local, server, name, t, true);
      if (!r.answer) {
        ctx.out(`;; communications error to ${server}#53: timed out\n;; no servers could be reached\n`);
        return 1;
      }
      const a = r.answer;
      if (a.rcode === 'NXDOMAIN') {
        ctx.out(`Host ${name} not found: 3(NXDOMAIN)\n`);
        return 1;
      }
      if (a.rcode === 'SERVFAIL') {
        ctx.out(`Host ${name} not found: 2(SERVFAIL)\n`);
        return 1;
      }
      for (const rr of a.answer) {
        const n = rr.name.replace(/\.$/, '');
        if (rr.type === 'A') ctx.out(`${n} has address ${rr.data}\n`);
        else if (rr.type === 'CNAME') ctx.out(`${n} is an alias for ${rr.data}\n`);
        else if (rr.type === 'MX') ctx.out(`${n} mail is handled by ${rr.data}\n`);
        else ctx.out(`${n} ${rr.type === 'NS' ? 'name server' : rr.type === 'TXT' ? 'descriptive text' : rr.type} ${rr.data}\n`);
      }
      if (type && !a.answer.length) ctx.out(`${name} has no ${type} record\n`);
    }
    return 0;
  },
};
