// Small builders for the diagrams of the Networks block: every node and edge
// carries a card (what it is / who creates it / how to look at it / where it is
// written), so the helpers take the card first-class.

import { bi, type Bi } from '../../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementCard, QText, Step } from '../../../core/types';

export const card = (what: [string, string], who: [string, string], see?: string, doc?: DocRef): ElementCard => ({ what: bi(what[0], what[1]), who: bi(who[0], who[1]), see, doc });

export function node(id: string, label: QText, family: ColorFamily, box: [number, number, number, number], c: ElementCard, more: Partial<DiagramNode> = {}): DiagramNode {
  const [x, y, w, h] = box;
  return { id, label, family, x, y, w, h, card: c, ...more };
}

export function edge(id: string, from: string, to: string, label: QText, c: ElementCard, more: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, label, card: c, ...more };
}

export const last = (s: Step[]) => s[s.length - 1];
export const lastMetric = (s: Step[], k: string) => {
  for (let i = s.length - 1; i >= 0; i--) if (s[i].metrics?.[k] !== undefined) return s[i].metrics![k];
  return undefined;
};
export const brokenAt = (s: Step[]) => s.find((x) => x.broken)?.broken?.at;
export const b = bi;
export type { Bi };

/** Documentation links used across the block's diagrams. */
export const DOC = {
  rfc791: { url: 'https://www.rfc-editor.org/rfc/rfc791', label: 'RFC 791 · Internet Protocol' },
  rfc826: { url: 'https://www.rfc-editor.org/rfc/rfc826', label: 'RFC 826 · ARP' },
  rfc792: { url: 'https://www.rfc-editor.org/rfc/rfc792', label: 'RFC 792 · ICMP' },
  rfc9293: { url: 'https://www.rfc-editor.org/rfc/rfc9293', label: 'RFC 9293 · TCP' },
  rfc768: { url: 'https://www.rfc-editor.org/rfc/rfc768', label: 'RFC 768 · UDP' },
  rfc1034: { url: 'https://www.rfc-editor.org/rfc/rfc1034', label: 'RFC 1034 · DNS concepts' },
  rfc1035: { url: 'https://www.rfc-editor.org/rfc/rfc1035', label: 'RFC 1035 · DNS' },
  rfc9156: { url: 'https://www.rfc-editor.org/rfc/rfc9156', label: 'RFC 9156 · QNAME minimisation' },
  rfc2131: { url: 'https://www.rfc-editor.org/rfc/rfc2131', label: 'RFC 2131 · DHCP' },
  rfc2132: { url: 'https://www.rfc-editor.org/rfc/rfc2132', label: 'RFC 2132 · DHCP options' },
  rfc1918: { url: 'https://www.rfc-editor.org/rfc/rfc1918', label: 'RFC 1918 · private addresses' },
  rfc4271: { url: 'https://www.rfc-editor.org/rfc/rfc4271', label: 'RFC 4271 · BGP-4' },
  rfc8446: { url: 'https://www.rfc-editor.org/rfc/rfc8446', label: 'RFC 8446 · TLS 1.3' },
  rfc9110: { url: 'https://www.rfc-editor.org/rfc/rfc9110', label: 'RFC 9110 · HTTP semantics' },
  rfc9112: { url: 'https://www.rfc-editor.org/rfc/rfc9112', label: 'RFC 9112 · HTTP/1.1' },
  rfc6598: { url: 'https://www.rfc-editor.org/rfc/rfc6598', label: 'RFC 6598 · shared address space (CGNAT)' },
  rfc4632: { url: 'https://www.rfc-editor.org/rfc/rfc4632', label: 'RFC 4632 · CIDR' },
  rfc1191: { url: 'https://www.rfc-editor.org/rfc/rfc1191', label: 'RFC 1191 · Path MTU discovery' },
  rootServers: { url: 'https://root-servers.org/', label: 'root-servers.org' },
  cableMap: { url: 'https://www.submarinecablemap.com/', label: 'Submarine Cable Map' },
  cfBgp: { url: 'https://www.cloudflare.com/learning/security/glossary/what-is-bgp/', label: 'Cloudflare Learning · What is BGP' },
  cfCdn: { url: 'https://www.cloudflare.com/learning/cdn/what-is-a-cdn/', label: 'Cloudflare Learning · What is a CDN' },
  cfIxp: { url: 'https://www.cloudflare.com/learning/cdn/glossary/internet-exchange-point-ixp/', label: 'Cloudflare Learning · What is an IXP' },
  nginxProxy: { url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout', label: 'nginx · proxy_read_timeout' },
  nginxNext: { url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream', label: 'nginx · proxy_next_upstream' },
  nginxUpstream: { url: 'https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server', label: 'nginx · upstream server (max_fails, fail_timeout)' },
  ipRoute: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
  ipNeigh: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip neigh' },
  digMan: { page: 'man/dig.1', anchor: 'QUERY OPTIONS', line: '+[no]trace' },
  curlMan: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-v, --verbose' },
  iptMan: { page: 'man/iptables.8', anchor: 'TABLES' },
  tcpdumpMan: { page: 'man/tcpdump.8', anchor: 'OPTIONS', line: '-e' },
  pingMan: { page: 'man/ping.8', anchor: 'DESCRIPTION' },
  trMan: { page: 'man/traceroute.8', anchor: 'DESCRIPTION', line: 'time to live' },
  ssMan: { page: 'man/ss.8', anchor: 'OPTIONS', line: '-l, --listening' },
  dhcpcdMan: { page: 'man/dhcpcd.8', anchor: 'DESCRIPTION' },
} satisfies Record<string, DocRef>;
