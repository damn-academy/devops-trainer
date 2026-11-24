// E-ARP (03 §5.3 net.m03): the host knows the IP address of its neighbour but
// a frame needs a MAC address. ARP asks everyone, one answers, the answer is
// cached.
//
// Reading order: at the first step only the sender is working; the switch and
// the two neighbours are pale until the question reaches them. The block that
// acts says in a callout what it does, the ARP question and answer travel along
// the cables as cards, and the ARP cache is shown under each computer.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { t } from '../../../core/i18n';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { cache: boolean };

export const arpModel = defineModel<P>({
  id: 'net.arp',
  block: 'networks',
  title: b('Как компьютер узнаёт MAC-адрес соседа по его IP-адресу', 'How a computer finds a neighbour’s MAC from its IP address'),
  summary: b(
    'Компьютер A с адресом 192.168.1.10 хочет отправить пакет соседу B с адресом 192.168.1.20. IP-адрес соседа он знает, а MAC-адрес, без которого кадр не собрать, не знает. Схема показывает, как протокол ARP спрашивает об этом всю сеть и как ответ попадает в ARP-кэш. Под названием каждого компьютера показано, что записано в его кэше.',
    'Computer A (192.168.1.10) wants to send a packet to its neighbour B (192.168.1.20). It knows the neighbour’s IP address but not the MAC address a frame needs. The diagram shows how ARP asks the whole network and how the answer gets into the ARP cache, shown under each computer’s name.',
  ),
  intro: b(
    'А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на кабеле показывает вопрос ARP, ответ на него или сам пакет.\n\nПосле первого прохода включите параметр, при котором сосед уже записан в кэше, а потом выключите компьютер B в блоке «Сломать».',
    'Then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the cable shows the ARP question, its answer or the packet itself.\n\nAfter the first pass switch on the knob that puts the neighbour into the cache, then switch computer B off in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('вопрос ARP, ответ или пакет на кабеле', 'an ARP question, an answer or a packet on the cable') },
    { mark: 'icon:terminal', text: b('компьютер', 'computer') },
    { mark: 'icon:switch', text: b('коммутатор', 'switch') },
    { mark: 'wait', text: b('пакет ждёт, пока найдётся MAC-адрес', 'the packet waits for the MAC address') },
    { mark: 'pale', text: b('компьютер, который в обмене не участвует', 'a computer not taking part') },
    { mark: 'ok', text: b('пакет доставлен', 'the packet was delivered') },
    { mark: 'err', text: b('здесь отправка остановилась', 'sending stopped here') },
  ],
  stopLabel: b('Пакет не отправлен', 'The packet was not sent'),
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      node('h1', b('Компьютер A', 'Computer A'), 'user', [24, 136, 192, 64], card(['Компьютер, который отправляет пакет. Его ARP-кэш хранит пары «IP-адрес и MAC-адрес» для соседей по сети, и посмотреть этот кэш можно командой ip neigh.', 'The sender. Its ARP cache is an “IP → MAC” table in the kernel; ip neigh shows it.'], ['ARP-кэш заполняет само ядро Linux, без участия человека.', 'The Linux kernel fills it by itself.'], 'ip neigh', DOC.ipNeigh), { sub: '192.168.1.10', icon: 'terminal', work: 'spin' }),
      node('sw', b('Коммутатор', 'Switch'), 'l2', [432, 144, 176, 48], card(['Коммутатор передаёт кадры по MAC-адресам, а широковещательный кадр рассылает во все порты.', 'Forwards frames by MAC. A broadcast frame goes out of every port.'], ['Коммутатор ставит сетевой инженер, а дома его роль выполняет роутер.', 'A network engineer (or the home router).']), { icon: 'switch' }),
      node('h2', b('Компьютер B', 'Computer B'), 'user', [744, 40, 192, 64], card(['Сосед, чей адрес ищет компьютер A. Он отвечает на вопрос и заодно запоминает MAC-адрес того, кто спрашивал.', 'The neighbour whose address is asked for. It answers and at the same time remembers the asker’s MAC.'], ['Ответ ARP отправляет ядро этого компьютера.', 'Its kernel sends the ARP answer.'], 'ip neigh'), { sub: '192.168.1.20', icon: 'terminal' }),
      node('h3', b('Компьютер C', 'Computer C'), 'user', [744, 232, 192, 64], card(['Третий компьютер в той же сети. Он слышит вопрос, видит, что спрашивают не его адрес, и молчит.', 'A third host on the same network. It hears the question, sees it is not its address and stays silent.'], ['Вопрос отбрасывает ядро этого компьютера.', 'Its kernel drops the question.']), { sub: '192.168.1.30', icon: 'terminal' }),
    ],
    edges: [
      edge('l1', 'h1', 'sw', 'eth0', card(['Кабель от компьютера A к коммутатору. Вопросы и ответы ARP на нём видны командой tcpdump.', 'Computer A’s cable to the switch; tcpdump shows the ARP questions and answers on it.'], ['Кабель подключает тот, кто собирает сеть.', 'Whoever builds the network.'], 'tcpdump -n -e arp', DOC.tcpdumpMan), { labelAt: 0.3 }),
      edge('l2', 'sw', 'h2', b('порт 2', 'port 2'), card(['Этот кабель соединяет порт 2 коммутатора с компьютером B.', 'The cable to computer B.'], ['Кабель подключает тот, кто собирает сеть.', 'Whoever builds the network.']), { via: [[480, 72]], labelAt: 0.7 }),
      edge('l3', 'sw', 'h3', b('порт 3', 'port 3'), card(['Этот кабель соединяет порт 3 коммутатора с компьютером C.', 'The cable to computer C.'], ['Кабель подключает тот, кто собирает сеть.', 'Whoever builds the network.']), { via: [[480, 264]], labelAt: 0.7 }),
    ],
  },
  params: [
    {
      id: 'cache',
      group: b('Что знает компьютер A', 'What computer A knows'),
      label: b('MAC-адрес соседа B уже записан в ARP-кэше компьютера A', 'B’s MAC is already in A’s ARP cache'),
      kind: 'toggle',
      default: false,
      near: 'h1',
      predict: {
        prompt: b('MAC-адрес компьютера B уже записан в ARP-кэше компьютера A. Сколько кадров ARP уйдёт в сеть перед эхо-запросом?', 'B’s MAC is already in A’s cache. How many ARP frames go out before the echo request?'),
        options: [
          { id: '0', text: b('Ни одного, потому что адрес уже известен', 'None: the address is already known') },
          { id: '2', text: b('Два кадра, вопрос и ответ, как и с пустым кэшем', 'Two, a question and an answer, as with an empty cache') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'arp') ?? 0),
      },
    },
  ],
  breaks: [
    {
      id: 'off',
      label: b('Компьютер B выключен', 'Computer B is off'),
      remove: ['h2'],
      predict: {
        prompt: b('Компьютер B выключен, а в ARP-кэше компьютера A записи о нём нет. Что напечатает команда ping 192.168.1.20 на компьютере A?', 'B is off and A has no cache entry for it. What will ping 192.168.1.20 print on A?'),
        options: [
          { id: 'unreach', text: b('Строку «From 192.168.1.10 … Destination Host Unreachable», то есть ошибку от самого отправителя', '“From 192.168.1.10 … Destination Host Unreachable”, from the sender itself') },
          { id: 'timeout', text: b('Ничего не напечатает и будет молча ждать', 'Nothing, just silence') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'unreach' : 'timeout'),
      },
    },
  ],
  metrics: [{ id: 'arp', label: b('кадров ARP отправлено', 'ARP frames sent') }],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    if (p.cache && !broken.has('off')) {
      steps.push(
        {
          id: 'lookup',
          label: b('кэш', 'cache'),
          caption: b('Ядро компьютера A заглядывает в ARP-кэш и находит там запись: у адреса 192.168.1.20 MAC-адрес 02:42:ac:11:00:14. Спрашивать сеть не нужно.', 'The kernel looks in the ARP cache: 192.168.1.20 → 02:42:ac:11:00:14 is already there. No need to ask.'),
          focus: ['h1'],
          say: { h1: b('Компьютер A находит MAC-адрес соседа в своём ARP-кэше.', 'A finds the neighbour’s MAC in its ARP cache.') },
          states: { h1: 'on', sw: 'off', h2: 'off', h3: 'off', l2: 'off', l3: 'off' },
          values: { h1: t(b('кэш: .20 → …:14', 'cache: .20 → …:14')) },
          metrics: { arp: 0 },
        },
        {
          id: 'frame',
          label: b('кадр', 'frame'),
          caption: b('Компьютер A сразу отправляет кадр на MAC-адрес соседа, а внутри кадра лежит эхо-запрос ping. Протокол, которым пользуется ping, вы разберёте в следующем уроке.', 'A frame goes out at once with the neighbour’s MAC and a ping echo request inside (we name the protocol in the next lesson).'),
          focus: ['l1', 'sw', 'l2'],
          tokens: [{ edge: 'l1', label: 'echo' }, { edge: 'l2', label: 'echo' }],
          say: { sw: b('Коммутатор отдаёт кадр в порт 2, к компьютеру B.', 'The switch delivers the frame to port 2, to B.') },
          states: { sw: 'on', l2: 'on', h2: 'on' },
          metrics: { arp: 0 },
        },
        {
          id: 'reply',
          label: b('ответ', 'reply'),
          caption: b('Компьютер B отвечает на эхо-запрос. Запись в кэше хранится, пока ею пользуются, а если трафика нет, через несколько десятков секунд она устаревает, и при следующем пакете ядро проверит её заново.', 'The neighbour answers. The cache entry is kept while it is used; without traffic it goes stale within tens of seconds and is re-checked on the next packet.'),
          focus: ['h2', 'l2', 'l1'],
          tokens: [{ edge: 'l2', reverse: true, label: 'reply' }, { edge: 'l1', reverse: true, label: 'reply' }],
          say: { h2: b('Компьютер B отвечает на эхо-запрос компьютера A.', 'B answers A’s echo request.') },
          states: { h2: 'ok', h1: 'ok' },
          metrics: { arp: 0 },
        },
      );
      return steps;
    }
    steps.push({
      id: 'lookup',
      label: b('кэш', 'cache'),
      caption: b('Ядро компьютера A заглядывает в ARP-кэш, но записи для адреса 192.168.1.20 там нет. Без MAC-адреса получателя кадр собрать нельзя, поэтому пакет ждёт.', 'The kernel looks in the ARP cache: no entry for 192.168.1.20. The frame cannot be built without the receiver’s MAC, so the packet waits.'),
      focus: ['h1'],
      say: { h1: b('Компьютер A ищет в ARP-кэше MAC-адрес для 192.168.1.20 и не находит его.', 'A looks for the MAC of 192.168.1.20 in its cache and finds nothing.') },
      states: { h1: 'wait', sw: 'off', h2: 'off', h3: 'off', l2: 'off', l3: 'off' },
      values: { h1: t(b('кэш пуст', 'cache empty')) },
      metrics: { arp: 0 },
    });
    steps.push({
      id: 'who-has',
      label: 'who-has',
      caption: b('Компьютер A спрашивает всю сеть, у кого адрес 192.168.1.20, и просит ответить на адрес 192.168.1.10. Кадр с вопросом адресован ff:ff:ff:ff:ff:ff, поэтому коммутатор рассылает его во все порты.', 'Computer A asks the whole network who has the address 192.168.1.20 and asks for the answer to be sent to 192.168.1.10. The frame with the question is addressed to ff:ff:ff:ff:ff:ff, so the switch sends it out of every port.'),
      focus: ['sw', 'l1', 'l2', 'l3'],
      tokens: [{ edge: 'l1', label: 'who-has .20' }, { edge: 'l2', label: 'who-has .20' }, { edge: 'l3', label: 'who-has .20' }],
      say: { sw: b('Коммутатор рассылает широковещательный вопрос во все порты.', 'The switch floods the broadcast question to every port.') },
      states: { sw: 'on', l2: 'on', l3: 'on', h2: 'on', h3: 'on' },
      metrics: { arp: 1 },
    });
    if (broken.has('off')) {
      steps.push({
        id: 'retry',
        label: b('повтор вопроса', 'again'),
        caption: b('На вопрос никто не ответил. Ядро повторяет его ещё дважды с паузой в секунду, а потом прекращает попытки, потому что соседа с таким адресом в сети, судя по всему, нет.', 'Nobody answered the question. The kernel repeats it twice more, a second apart, and then stops trying, because there seems to be no neighbour with that address on the network.'),
        focus: ['h1'],
        say: { h1: b('Компьютер A трижды задал вопрос, не получил ответа и сообщает, что сосед недоступен.', 'A asked three times, got no answer and reports the neighbour unreachable.') },
        states: { h1: 'err', h2: 'off' },
        metrics: { arp: 3 },
        broken: {
          at: 'h1',
          message: '$ ping -c 2 192.168.1.20\nPING 192.168.1.20 (192.168.1.20) 56(84) bytes of data.\nFrom 192.168.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 192.168.1.10 icmp_seq=2 Destination Host Unreachable\n$ ip neigh show 192.168.1.20\n192.168.1.20 dev eth0 FAILED',
          caption: b('Ошибку пишет сам отправитель, и это видно по строке «From 192.168.1.10». В ARP-кэше запись о соседе помечена словом FAILED, то есть на вопрос никто не ответил. Пакет даже не ушёл в сеть, потому что не нашлось, кому отдать кадр.', 'The sender itself reports the error, as the “From 192.168.1.10” line shows. The ARP cache marks the neighbour FAILED, meaning nobody answered the question. The packet never left for the network because there was nobody to hand the frame to.'),
        },
      });
      return steps;
    }
    steps.push({
      id: 'ignore',
      label: b('чужой адрес', 'not me'),
      caption: b('Компьютер C слышит вопрос, видит в нём чужой адрес и молчит. Компьютер B узнаёт свой адрес и заодно записывает в свой кэш, что у 192.168.1.10 MAC-адрес 02:42:ac:11:00:0a.', 'Host C hears the question, sees someone else’s address and stays silent. Host B recognises its own address and at the same time notes: “192.168.1.10 is 02:42:ac:11:00:0a”.'),
      focus: ['h2', 'h3'],
      say: { h2: b('Компьютер B узнаёт в вопросе свой адрес и запоминает MAC-адрес компьютера A.', 'B recognises its own address and remembers A’s MAC.'), h3: b('Компьютер C видит чужой адрес и молчит.', 'C sees someone else’s address and stays silent.') },
      states: { h3: 'off', l3: 'off', h2: 'on' },
      values: { h2: t(b('кэш: .10 → …:0a', 'cache: .10 → …:0a')) },
      metrics: { arp: 1 },
    });
    steps.push({
      id: 'is-at',
      label: 'is-at',
      caption: b('Компьютер B отвечает только тому, кто спрашивал, обычным кадром на его MAC-адрес: «192.168.1.20 is-at 02:42:ac:11:00:14», то есть «адрес 192.168.1.20 находится у карты 02:42:ac:11:00:14».', 'B answers the asker alone, with an ordinary frame: “192.168.1.20 is-at 02:42:ac:11:00:14”.'),
      focus: ['h2', 'l2', 'l1'],
      tokens: [{ edge: 'l2', reverse: true, label: 'is-at …:14' }, { edge: 'l1', reverse: true, label: 'is-at …:14' }],
      say: { h2: b('Компьютер B отвечает компьютеру A своим MAC-адресом.', 'B answers A with its MAC address.') },
      metrics: { arp: 2 },
    });
    steps.push({
      id: 'send',
      label: b('пакет', 'packet'),
      caption: b('Ядро компьютера A записывает ответ в кэш и отправляет пакет, который всё это время ждал. Теперь кадр адресован прямо на MAC-адрес соседа.', 'The kernel stores the answer in the cache and sends the waiting packet — now as a frame straight to the neighbour’s MAC.'),
      focus: ['h1', 'l1', 'l2'],
      tokens: [{ edge: 'l1', label: 'echo' }, { edge: 'l2', label: 'echo' }],
      say: { h1: b('Компьютер A записывает MAC-адрес соседа в кэш и отправляет ждавший пакет.', 'A stores the neighbour’s MAC and sends the waiting packet.') },
      states: { h1: 'ok', h2: 'ok' },
      values: { h1: t(b('кэш: .20 → …:14', 'cache: .20 → …:14')) },
      metrics: { arp: 2 },
    });
    return steps;
  },
  explainDelta(prev, next, change) {
    if (change.kind === 'break')
      return change.on
        ? b('Без ответа на вопрос ARP пакет не уходит в сеть. Компьютер A задаёт вопрос трижды, а потом сам сообщает «Destination Host Unreachable».', 'Without an ARP answer the packet does not leave: three questions, then “Destination Host Unreachable” from the sender itself.')
        : b('Компьютер B снова в сети и отвечает на вопрос.', 'B is back on the network and answers the question.');
    const a0 = lastMetric(prev, 'arp') ?? 0;
    const a1 = lastMetric(next, 'arp') ?? 0;
    return a1 < a0
      ? b('MAC-адрес соседа уже записан в кэше, поэтому кадры ARP не нужны и пакет уходит сразу.', 'The neighbour is already cached: no ARP frames needed, the packet leaves at once.')
      : b('Кэш пуст, поэтому перед первым пакетом компьютер A спрашивает всю сеть и получает ответ от одного соседа.', 'The cache is empty: before the first packet, a question to all and an answer from one.');
  },
});
