// E-ARP (03 §5.3 net.m03): the host knows the IP address of its neighbour but
// a frame needs a MAC address. ARP asks everyone, one answers, the answer is
// cached.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { t } from '../../../core/i18n';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { cache: boolean };

export const arpModel = defineModel<P>({
  id: 'net.arp',
  block: 'networks',
  title: b('ARP: по IP-адресу найти MAC', 'ARP: find the MAC for an IP address'),
  summary: b('Хост 192.168.1.10 хочет отправить пакет соседу 192.168.1.20. Адрес соседа он знает, а MAC — нет.', 'Host 192.168.1.10 wants to send a packet to its neighbour 192.168.1.20. It knows the neighbour’s address but not its MAC.'),
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      node('h1', 'host-a', 'user', [24, 136, 176, 64], card(['Отправитель. Его ARP-кэш — таблица «IP → MAC» в ядре, команда ip neigh показывает её.', 'The sender. Its ARP cache is an “IP → MAC” table in the kernel; ip neigh shows it.'], ['Ядро Linux заполняет его само.', 'The Linux kernel fills it by itself.'], 'ip neigh', DOC.ipNeigh), { sub: '192.168.1.10' }),
      node('sw', b('Коммутатор', 'Switch'), 'l2', [392, 144, 176, 48], card(['Пересылает кадры по MAC. Широковещательный кадр уходит во все порты.', 'Forwards frames by MAC. A broadcast frame goes out of every port.'], ['Сетевой инженер (или роутер дома).', 'A network engineer (or the home router).'])),
      node('h2', 'host-b', 'user', [760, 40, 176, 64], card(['Сосед, чей адрес спрашивают. Он отвечает и заодно запоминает MAC спросившего.', 'The neighbour whose address is asked for. It answers and at the same time remembers the asker’s MAC.'], ['—', '—'], 'ip neigh'), { sub: '192.168.1.20' }),
      node('h3', 'host-c', 'user', [760, 232, 176, 64], card(['Третий хост в той же сети. Он слышит вопрос, видит, что спрашивают не его адрес, и молчит.', 'A third host on the same network. It hears the question, sees it is not its address and stays silent.'], ['—', '—']), { sub: '192.168.1.30' }),
    ],
    edges: [
      edge('l1', 'h1', 'sw', 'eth0', card(['Кабель хоста A к коммутатору.', 'Host A’s cable to the switch.'], ['—', '—'], 'tcpdump -n -e arp', DOC.tcpdumpMan)),
      edge('l2', 'sw', 'h2', 'port 2', card(['Кабель к хосту B.', 'The cable to host B.'], ['—', '—']), { via: [[480, 72]], labelAt: 0.7 }),
      edge('l3', 'sw', 'h3', 'port 3', card(['Кабель к хосту C.', 'The cable to host C.'], ['—', '—']), { via: [[480, 264]], labelAt: 0.7 }),
    ],
  },
  params: [
    {
      id: 'cache',
      label: b('В ARP-кэше уже есть сосед', 'The neighbour is already in the ARP cache'),
      kind: 'toggle',
      default: false,
      near: 'h1',
      predict: {
        prompt: b('Запись о соседе уже в кэше. Сколько кадров ARP уйдёт перед эхо-запросом?', 'The neighbour is already cached. How many ARP frames go out before the echo request?'),
        options: [
          { id: '0', text: b('Ни одного', 'None') },
          { id: '2', text: b('Два: вопрос и ответ', 'Two: a question and an answer') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'arp') ?? 0),
      },
    },
  ],
  breaks: [
    {
      id: 'off',
      label: b('Хост B выключен', 'Host B is off'),
      remove: ['h2'],
      layer: 'L2',
      predict: {
        prompt: b('Хост B выключен. Что напечатает ping 192.168.1.20?', 'Host B is off. What will ping 192.168.1.20 print?'),
        options: [
          { id: 'unreach', text: b('From 192.168.1.10 … Destination Host Unreachable — сам отправитель', 'From 192.168.1.10 … Destination Host Unreachable — from the sender itself') },
          { id: 'timeout', text: b('Ничего, просто тишина', 'Nothing, just silence') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'unreach' : 'timeout'),
      },
    },
  ],
  metrics: [{ id: 'arp', label: b('кадров ARP', 'ARP frames') }],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    if (p.cache && !broken.has('off')) {
      steps.push(
        { id: 'lookup', label: b('кэш', 'cache'), caption: b('Ядро смотрит в ARP-кэш: 192.168.1.20 → 02:42:ac:11:00:14 уже записан. Спрашивать не нужно.', 'The kernel looks in the ARP cache: 192.168.1.20 → 02:42:ac:11:00:14 is already there. No need to ask.'), focus: ['h1'], states: { h1: 'on' }, values: { h1: t(b('кэш: .20 → …:14', 'cache: .20 → …:14')) }, metrics: { arp: 0 } },
        { id: 'frame', label: b('кадр', 'frame'), caption: b('Сразу уходит кадр с MAC соседа и эхо-запросом ping внутри (сам протокол назовём через урок).', 'A frame goes out at once with the neighbour’s MAC and a ping echo request inside (we name the protocol two lessons from now).'), focus: ['l1', 'l2'], tokens: [{ edge: 'l1', label: 'echo' }, { edge: 'l2', label: 'echo' }], metrics: { arp: 0 } },
        { id: 'reply', label: b('ответ', 'reply'), caption: b('Сосед отвечает. Запись в кэше живёт, пока ею пользуются; без трафика она устареет через несколько десятков секунд и при следующем пакете будет перепроверена.', 'The neighbour answers. The cache entry lives while it is used; without traffic it goes stale within tens of seconds and is re-checked on the next packet.'), focus: ['l2', 'l1'], tokens: [{ edge: 'l2', reverse: true, label: 'reply' }, { edge: 'l1', reverse: true }], states: { h2: 'ok', h1: 'ok' }, metrics: { arp: 0 } },
      );
      return steps;
    }
    steps.push({ id: 'lookup', label: b('кэш', 'cache'), caption: b('Ядро смотрит в ARP-кэш — записи для 192.168.1.20 нет. Кадр не собрать: неизвестен MAC получателя. Пакет ждёт.', 'The kernel looks in the ARP cache: no entry for 192.168.1.20. The frame cannot be built: the receiver’s MAC is unknown. The packet waits.'), focus: ['h1'], states: { h1: 'wait' }, values: { h1: t(b('кэш: пусто', 'cache: empty')) }, metrics: { arp: 0 } });
    steps.push({ id: 'who-has', label: 'who-has', caption: b('Хост спрашивает всех: «У кого 192.168.1.20? Ответьте 192.168.1.10». Кадр адресован ff:ff:ff:ff:ff:ff, коммутатор рассылает его во все порты.', 'The host asks everyone: “Who has 192.168.1.20? Tell 192.168.1.10.” The frame is addressed to ff:ff:ff:ff:ff:ff; the switch floods it to every port.'), focus: ['l1', 'l2', 'l3', 'sw'], tokens: [{ edge: 'l1', label: 'who-has .20' }, { edge: 'l2' }, { edge: 'l3' }], metrics: { arp: 1 } });
    if (broken.has('off')) {
      steps.push({
        id: 'retry',
        label: b('ещё раз', 'again'),
        caption: b('Ответа нет. Ядро повторяет вопрос ещё дважды, с паузой в секунду, и сдаётся: соседа с таким адресом в сети нет.', 'No answer. The kernel asks twice more, a second apart, and gives up: there is no neighbour with that address on the network.'),
        focus: ['h1'],
        states: { h1: 'err', h2: 'off' },
        metrics: { arp: 3 },
        broken: { at: 'h1', message: '$ ping -c 2 192.168.1.20\nPING 192.168.1.20 (192.168.1.20) 56(84) bytes of data.\nFrom 192.168.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 192.168.1.10 icmp_seq=2 Destination Host Unreachable', caption: b('ошибку пишет сам отправитель (From 192.168.1.10): пакет даже не ушёл — не нашлось, кому отдать кадр.', 'the sender itself reports the error (From 192.168.1.10): the packet never left — there was nobody to hand the frame to.') },
      });
      return steps;
    }
    steps.push({ id: 'ignore', label: b('не мне', 'not me'), caption: b('Хост C слышит вопрос, видит чужой адрес и молчит. Хост B узнаёт свой адрес и заодно запоминает: «192.168.1.10 — это 02:42:ac:11:00:0a».', 'Host C hears the question, sees someone else’s address and stays silent. Host B recognises its own address and at the same time notes: “192.168.1.10 is 02:42:ac:11:00:0a”.'), focus: ['h2', 'h3'], states: { h3: 'off', h2: 'on' }, values: { h2: t(b('кэш: .10 → …:0a', 'cache: .10 → …:0a')) }, metrics: { arp: 1 } });
    steps.push({ id: 'is-at', label: 'is-at', caption: b('B отвечает только спросившему, обычным кадром: «192.168.1.20 is-at 02:42:ac:11:00:14».', 'B answers the asker alone, with an ordinary frame: “192.168.1.20 is-at 02:42:ac:11:00:14”.'), focus: ['l2', 'l1'], tokens: [{ edge: 'l2', reverse: true, label: 'is-at …:14' }, { edge: 'l1', reverse: true }], metrics: { arp: 2 } });
    steps.push({ id: 'send', label: b('пакет', 'packet'), caption: b('Ядро записывает ответ в кэш и отправляет ждавший пакет — теперь уже кадром прямо на MAC соседа.', 'The kernel stores the answer in the cache and sends the waiting packet — now as a frame straight to the neighbour’s MAC.'), focus: ['l1', 'l2'], tokens: [{ edge: 'l1', label: 'echo' }, { edge: 'l2', label: 'echo' }], states: { h1: 'ok', h2: 'ok' }, values: { h1: t(b('кэш: .20 → …:14', 'cache: .20 → …:14')) }, metrics: { arp: 2 } });
    return steps;
  },
  explainDelta(prev, next, change) {
    if (change.kind === 'break') return change.on ? b('Без ответа на ARP пакет не уходит: три вопроса — и «Destination Host Unreachable» от самого отправителя.', 'Without an ARP answer the packet does not leave: three questions, then “Destination Host Unreachable” from the sender itself.') : b('B снова в сети и отвечает на вопрос.', 'B is back on the network and answers the question.');
    const a0 = lastMetric(prev, 'arp') ?? 0;
    const a1 = lastMetric(next, 'arp') ?? 0;
    return a1 < a0 ? b('Сосед уже в кэше: кадры ARP не нужны, пакет уходит сразу.', 'The neighbour is already cached: no ARP frames needed, the packet leaves at once.') : b('Кэш пуст: перед первым пакетом — вопрос всем и ответ одного.', 'The cache is empty: before the first packet, a question to all and an answer from one.');
  },
});
