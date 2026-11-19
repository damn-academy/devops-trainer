// "Show what you already know" for the Networks block (03 §4.2): a bank for
// the Intermediate claim (tasks on the simulator are key) and one for the
// Experienced claim. No hints, no feedback during the check.

import { bi } from '../../core/i18n';
import type { PlacementTask, QuizItem } from '../../core/types';
import { lab } from './lessons-a';
import { quiz } from './quiz';

const bank = (id: string, newId: string): QuizItem => ({ ...(quiz.find((q) => q.id === id) as QuizItem), id: newId });

export const placement: PlacementTask[] = [
  // ── Intermediate ──
  { id: 'net.place.private', level: 'intermediate', key: false, concepts: ['net.private'], kind: 'quiz', item: bank('net.q.sub.private', 'net.place.q.private') },
  { id: 'net.place.hosts', level: 'intermediate', key: false, concepts: ['net.cidr', 'net.subnet'], kind: 'quiz', item: bank('net.q.sub.hosts', 'net.place.q.hosts') },
  { id: 'net.place.dora', level: 'intermediate', key: false, concepts: ['net.dhcp'], kind: 'quiz', item: bank('net.q.dhcp.order', 'net.place.q.dora') },
  { id: 'net.place.ports', level: 'intermediate', key: false, concepts: ['net.port'], kind: 'quiz', item: bank('net.q.tcp.ports', 'net.place.q.ports') },
  { id: 'net.place.redirect', level: 'intermediate', key: false, concepts: ['net.status'], kind: 'quiz', item: bank('net.q.http.redirect', 'net.place.q.redirect') },
  {
    id: 'net.place.gw',
    level: 'intermediate',
    key: true,
    concepts: ['net.gateway', 'net.route-table'],
    kind: 'task',
    setup: lab('h1', 'two-subnets', {}, [{ id: 'p', kind: 'icmp', to: '10.0.2.10', count: 3 }]),
    task: {
      id: 'gw',
      prompt: bi('У машины h1 адрес 10.0.1.10/24, а шлюза нет. Маршрутизатор подсети имеет адрес 10.0.1.1. Сделайте так, чтобы ping 10.0.2.10 проходил.', 'Host h1 has 10.0.1.10/24 and no gateway. The subnet’s router is 10.0.1.1. Make ping 10.0.2.10 work.'),
      check: { when: "(net.routes[dst=default].gateway='10.0.1.1' || net.routes[dst='10.0.2.0/24'].gateway='10.0.1.1') && reach.p.received>=2" },
    },
  },
  {
    id: 'net.place.resolv',
    level: 'intermediate',
    key: true,
    concepts: ['net.resolver'],
    kind: 'task',
    setup: lab('laptop', 'home', { resolv: 'nameserver 192.168.1.54\n' }, [{ id: 'd', kind: 'dns', to: 'shop.example' }]),
    task: {
      id: 'resolv',
      prompt: bi('Команда curl https://shop.example/ пишет «Could not resolve host». Сервер DNS этой сети имеет адрес 192.168.1.1. Найдите причину и исправьте её.', 'curl https://shop.example/ says “Could not resolve host”. The network’s DNS server is 192.168.1.1. Find the cause and fix it.'),
      check: { when: "reach.d.answer has '198.51.100.20'" },
    },
  },
  { id: 'net.place.trace', level: 'intermediate', key: true, concepts: ['net.icmp', 'net.ttl'], kind: 'quiz', item: bank('net.q.route.trace', 'net.place.q.trace') },

  // ── Experienced ──
  { id: 'net.place.lpm', level: 'experienced', key: true, concepts: ['net.lpm'], kind: 'quiz', item: bank('net.q.route.lpm', 'net.place.q.lpm') },
  { id: 'net.place.changes', level: 'experienced', key: true, concepts: ['net.router', 'net.ttl'], kind: 'quiz', item: bank('net.q.route.changes', 'net.place.q.changes') },
  { id: 'net.place.refused', level: 'experienced', key: true, concepts: ['net.tcp'], kind: 'quiz', item: bank('net.q.tcp.refused', 'net.place.q.refused') },
  { id: 'net.place.hooks', level: 'experienced', key: false, concepts: ['net.netfilter'], kind: 'quiz', item: bank('net.q.nat.hooks', 'net.place.q.hooks') },
  { id: 'net.place.est', level: 'experienced', key: false, concepts: ['net.conntrack'], kind: 'quiz', item: bank('net.q.nat.est', 'net.place.q.est') },
  { id: 'net.place.root', level: 'experienced', key: false, concepts: ['net.resolver'], kind: 'quiz', item: bank('net.q.dns.nx', 'net.place.q.root') },
  {
    id: 'net.place.dnat',
    level: 'experienced',
    key: false,
    concepts: ['net.nat', 'net.dnat'],
    kind: 'task',
    setup: lab('gw', 'nat', {}, [
      { id: 'out', kind: 'http', from: 'app', to: 'http://203.0.113.50/' },
      { id: 'in', kind: 'http', from: 'ext', to: 'http://203.0.113.10/' },
    ]),
    task: {
      id: 'dnat',
      prompt: bi('Вы работаете на шлюзе gw. Выпустите сеть 10.0.2.0/24 в интернет через eth1 и пробросьте порт 203.0.113.10:80 на 10.0.2.20:8080.', 'On gateway gw: let network 10.0.2.0/24 out to the internet through eth1 and forward 203.0.113.10:80 to 10.0.2.20:8080.'),
      check: { when: "reach.out.status=200 && reach.in.status=200 && net.sysctl['net.ipv4.ip_forward']=1" },
    },
  },
  { id: 'net.place.504', level: 'experienced', key: false, concepts: ['net.upstream'], kind: 'quiz', item: bank('net.q.proxy.lines', 'net.place.q.504') },
  {
    id: 'net.place.dig',
    level: 'experienced',
    key: false,
    concepts: ['net.dns'],
    kind: 'task',
    setup: lab('laptop', 'home'),
    task: {
      id: 'dig',
      prompt: bi('Покажите только секцию ANSWER ответа на запрос shop.example вместе с TTL, без строк, которые начинаются с «;;». Пригодится страница документации dig(1).', 'Show only the ANSWER section of the reply for shop.example, with the TTL — no lines starting with “;;”. Documentation: dig(1).'),
      check: { stdout: /^shop\.example\.\s+\d+\s+IN\s+A\s+198\.51\.100\.20\n?$/ },
      docRef: { page: 'man/dig.1', anchor: 'QUERY OPTIONS' },
    },
  },
];
