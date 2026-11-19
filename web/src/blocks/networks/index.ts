// The Networks block (route id `networks`, design 03-networks.md): fifteen
// lessons from the map of the internet to layer-by-layer troubleshooting, ten
// process explainers, the subnet calculator and drill, the protocol catalogue,
// the quiz bank and the placement check. The simulator and its commands live in
// src/engine/sim-net.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Block } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { concepts } from './concepts';
import { docs } from './docs';
import { arpModel } from './explainers/arp';
import { dhcpModel } from './explainers/dhcp';
import { dnsModel } from './explainers/dns';
import { envelopesExplainer } from './explainers/envelopes';
import { mapModel } from './explainers/map';
import { natModel } from './explainers/nat';
import { proxyModel } from './explainers/proxy';
import { routeModel } from './explainers/route';
import { switchModel } from './explainers/switch';
import { tcpModel, tlsModel } from './explainers/tcp';
import { urlModel } from './explainers/url';
import { arp, frames, internet, routing, subnets } from './lessons-a';
import { dhcp, dns, envelopes, transport } from './lessons-b';
import { http, nat, protocols, proxy, tls, troubleshooting } from './lessons-c';
import { placement } from './placement';
import { quiz } from './quiz';
import { EN, RU, src } from './sources';
import { catalogueWidget } from './widgets/catalogue';
import { drillWidget, subnetWidget } from './widgets/subnet';
import './networks.css';

const lessons = [internet, frames, subnets, arp, routing, transport, envelopes, dns, dhcp, nat, http, tls, proxy, troubleshooting, protocols];

const entry = ROUTE.find((r) => r.id === 'networks')!;

const block: Block = {
  id: 'networks',
  order: entry.order,
  title: entry.title,
  summary: bi(
    'От карты интернета к пакету и обратно: кадр и MAC, IP и подсети, ARP, маршрутизация, TCP и UDP, конверты OSI и TCP/IP, DNS, DHCP, NAT и netfilter, HTTP, TLS и SSH, прокси и 504 — и траблшутинг по уровням на сквозном пути URL.',
    'From the map of the internet down to the packet and back: frames and MAC, IP and subnets, ARP, routing, TCP and UDP, OSI and TCP/IP envelopes, DNS, DHCP, NAT and netfilter, HTTP, TLS and SSH, proxies and the 504 — and layer-by-layer troubleshooting along the whole path of a URL.',
  ),
  checklistStep: entry.checklistStep,
  levels: entry.levels,
  hours: entry.hours,
  placement,
  lessons: lessons.map((l) => l.id),
  sources: src([EN.howInternet, EN.rfc791, EN.rfc9293, EN.rfc1034, EN.mdnHttp, EN.rfc8446, EN.nginxProxy, EN.whatHappens], [RU.internet, RU.osi, RU.tcp, RU.dns, RU.http, RU.tls, RU.nat]),
  docSources: ['man', 'help', 'rfc', 'nginx.org', 'mdn'],
};

export default defineModule({
  blocks: [block],
  lessons,
  concepts,
  quiz,
  docs,
  explainers: [fromModel(mapModel), fromModel(switchModel), fromModel(arpModel), fromModel(routeModel), fromModel(tcpModel), envelopesExplainer, fromModel(dnsModel), fromModel(dhcpModel), fromModel(natModel), fromModel(tlsModel), fromModel(proxyModel), fromModel(urlModel)],
  widgets: [subnetWidget, drillWidget, catalogueWidget],
});
