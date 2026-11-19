// «An SSH login, step by step» (design 00 §6.13). The order follows RFC 4253
// (version strings, key exchange, the server's signature with its host key)
// and RFC 4252 (public key authentication: the client offers a key, the
// server answers PK_OK only if the key is in authorized_keys, the client then
// signs); StrictModes and the known_hosts checks are those of OpenSSH's
// sshd(8) and ssh(1). The knobs choose what the client knows about the
// server, how the user proves who they are, and whether the way goes through
// a bastion.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb } from './util';

type P = { known: string; auth: string; jump: boolean };

const obsd = (name: string, sec: number) => ({ url: `https://man.openbsd.org/${name}.${sec}`, label: `${name}(${sec})` });
const rfc = (n: number) => ({ url: `https://www.rfc-editor.org/rfc/rfc${n}`, label: `RFC ${n}` });

export const sshModel = defineModel<P>({
  id: 'linux.ssh-session',
  block: 'linux',
  title: bi('Как проходит вход по SSH', 'How an SSH login goes'),
  summary: bi(
    'От подключения до оболочки на сервере: обмен ключами шифрования, подпись ключом хоста и сверка с known_hosts, вход по ключу пользователя или по паролю, прыжок через бастион. Пароль и закрытый ключ ведут себя по-разному — это видно по счётчикам.',
    'From the connection to a shell on the server: the encryption key exchange, the host key signature checked against known_hosts, a login with the user’s key or a password, a jump through a bastion. A password and a private key behave differently — the counters show it.',
  ),
  intro: bi('Нажмите «Дальше» и следите, что уходит по сети. Потом поменяйте «Что клиент знает о сервере» и включите поломки.', 'Press “Next” and watch what goes over the network. Then change “What the client knows about the server” and switch on the breaks.'),
  concepts: ['linux.ssh-key', 'linux.host-key'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'client', label: 'ssh', sub: 'laptop', icon: 'terminal', family: 'process', x: 24, y: 40, w: 170, h: 64, card: { what: bi('Клиент OpenSSH на вашей машине. Он открывает подключение, проверяет сервер и доказывает, кто вы.', 'The OpenSSH client on your machine. It opens the connection, checks the server and proves who you are.'), who: bi('Вы запускаете его командой `ssh`.', 'You start it with `ssh`.'), see: 'ssh -v app', doc: obsd('ssh', 1) } },
      { id: 'known', label: 'known_hosts', sub: '~/.ssh/known_hosts', icon: 'file', family: 'store', shape: 'doc', x: 24, y: 200, w: 170, h: 64, card: { what: bi('Список ключей хостов, которые клиент уже видел: имя — ключ. По нему клиент узнаёт, тот ли это сервер.', 'The list of host keys the client has already seen: name — key. The client uses it to tell whether this is the same server.'), who: bi('Клиент дописывает строку, когда вы ответили «yes» при первом подключении.', 'The client appends a line when you answer “yes” on the first connection.'), see: 'ssh-keygen -F app', doc: obsd('sshd', 8) } },
      { id: 'priv', label: bi('закрытый ключ', 'private key'), sub: '~/.ssh/id_ed25519', icon: 'lock', family: 'store', shape: 'doc', x: 24, y: 330, w: 170, h: 64, card: { what: bi('Половина пары, которая никогда не покидает ваш ноутбук. Клиент подписывает ею данные этого сеанса.', 'The half of the pair that never leaves your laptop. The client signs this session’s data with it.'), who: bi('`ssh-keygen` создал его с правами 600.', '`ssh-keygen` created it with mode 600.'), see: 'ls -l ~/.ssh/id_ed25519', doc: obsd('ssh-keygen', 1) } },
      { id: 'bastion', label: 'bastion', sub: 'sshd · AllowTcpForwarding', icon: 'router', family: 'node', x: 330, y: 40, w: 190, h: 64, card: { what: bi('Промежуточная машина. С `-J` или `ProxyJump` клиент сначала входит сюда, а потом просит sshd бастиона открыть канал к `app`; шифрование до `app` при этом сквозное.', 'The machine in between. With `-J` or `ProxyJump` the client first logs in here and then asks the bastion’s sshd to open a channel to `app`; the encryption to `app` is end to end.'), who: bi('Администраторы держат его единственной дверью внутрь.', 'The admins keep it as the only door inside.'), see: 'ssh -G app | grep proxyjump', doc: obsd('ssh_config', 5) } },
      { id: 'sshd', label: 'sshd', sub: 'app', icon: 'server', family: 'process', x: 640, y: 40, w: 170, h: 64, card: { what: bi('Служба SSH на сервере. Она доказывает клиенту, что это она, и решает, пускать ли пользователя.', 'The SSH service on the server. It proves to the client that it is itself and decides whether to let the user in.'), who: bi('Система инициализации запускает её при загрузке.', 'The init system starts it at boot.'), see: 'sshd -T | head', doc: obsd('sshd', 8) } },
      { id: 'hostkey', label: bi('ключ хоста', 'host key'), sub: '/etc/ssh/ssh_host_ed25519_key', icon: 'lock', family: 'store', shape: 'doc', x: 640, y: 170, w: 300, h: 64, card: { what: bi('Собственная пара ключей сервера. Закрытой половиной sshd подписывает каждый новый сеанс, открытую клиент хранит в known_hosts.', 'The server’s own key pair. sshd signs every new session with the private half; the client keeps the public half in known_hosts.'), who: bi('Создаётся при установке sshd (`ssh-keygen -A`).', 'Created when sshd is installed (`ssh-keygen -A`).'), see: 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub' } },
      { id: 'auth', label: 'authorized_keys', sub: '~deploy/.ssh/authorized_keys', icon: 'file', family: 'store', shape: 'doc', x: 640, y: 270, w: 300, h: 64, card: { what: bi('Открытые ключи, с которыми можно войти пользователем `deploy`. sshd читает файл, только если писать в него и в `~/.ssh` может лишь владелец (StrictModes).', 'The public keys that may log in as the user `deploy`. sshd reads the file only if nobody but the owner can write to it and to `~/.ssh` (StrictModes).'), who: bi('Вы или `ssh-copy-id`.', 'You, or `ssh-copy-id`.'), see: 'ls -ld ~/.ssh ~/.ssh/authorized_keys', doc: obsd('sshd', 8) } },
      { id: 'shell', label: 'bash', sub: 'deploy@app', icon: 'process', family: 'process', x: 640, y: 380, w: 300, h: 64, card: { what: bi('Ваша оболочка на сервере: обычный процесс пользователя `deploy`, чьи ввод и вывод идут по зашифрованному каналу.', 'Your shell on the server: an ordinary process of the user `deploy`, whose input and output go through the encrypted channel.'), who: bi('sshd запускает её после успешного входа.', 'sshd starts it after a successful login.'), see: 'ps -o pid,user,args -u deploy' } },
    ],
    edges: [
      { id: 'e-conn', from: 'client', to: 'sshd', via: [[580, 72]], label: bi('подключение и версии', 'connection and versions'), labelAt: 0.35, card: { what: bi('Клиент подключается к sshd (номер 22), и стороны обмениваются строками версий: `SSH-2.0-OpenSSH_…`.', 'The client connects to sshd (number 22), and the sides exchange version strings: `SSH-2.0-OpenSSH_…`.'), who: bi('ssh и sshd', 'ssh and sshd'), doc: rfc(4253) } },
      { id: 'e-jump', from: 'client', to: 'bastion', label: bi('сначала сюда', 'here first'), card: { what: bi('С прыжком клиент входит на бастион обычным сеансом и просит у него канал до `app` — `direct-tcpip`.', 'With a jump the client logs in to the bastion with an ordinary session and asks it for a channel to `app` — `direct-tcpip`.'), who: bi('ssh -J', 'ssh -J'), doc: obsd('ssh', 1) } },
      { id: 'e-fwd', from: 'bastion', to: 'sshd', label: bi('канал дальше', 'channel onward'), card: { what: bi('Бастион соединяется с `app` от своего имени и передаёт байты. Расшифровать их он не может: ключи сеанса знают только клиент и `app`.', 'The bastion connects to `app` on its own behalf and passes the bytes. It cannot decrypt them: only the client and `app` know the session keys.'), who: bi('sshd бастиона, если ему разрешено (`AllowTcpForwarding`).', 'The bastion’s sshd, if it is allowed to (`AllowTcpForwarding`).') } },
      { id: 'e-sign', from: 'hostkey', to: 'sshd', label: bi('подпись сеанса', 'session signature'), card: { what: bi('sshd подписывает хеш обмена ключами закрытым ключом хоста: подделать подпись без этого ключа нельзя.', 'sshd signs the key exchange hash with the host’s private key: the signature cannot be forged without that key.'), who: bi('sshd', 'sshd'), doc: rfc(4253) } },
      { id: 'e-check', from: 'client', to: 'known', label: bi('сверка ключа хоста', 'host key check'), card: { what: bi('Клиент ищет имя сервера в known_hosts и сравнивает ключ. Нет записи — спрашивает вас; запись другая — отказывается подключаться.', 'The client looks up the server’s name in known_hosts and compares the key. No entry — it asks you; a different entry — it refuses to connect.'), who: bi('ssh (StrictHostKeyChecking)', 'ssh (StrictHostKeyChecking)'), doc: obsd('ssh_config', 5) } },
      { id: 'e-offer', from: 'sshd', to: 'auth', label: bi('есть ли такой ключ?', 'is this key there?'), card: { what: bi('Клиент предлагает открытый ключ; sshd ищет его в authorized_keys и отвечает PK_OK, только если нашёл.', 'The client offers a public key; sshd looks for it in authorized_keys and answers PK_OK only if it is there.'), who: bi('sshd', 'sshd'), doc: rfc(4252) } },
      { id: 'e-proof', from: 'priv', to: 'client', label: bi('подпись', 'signature'), card: { what: bi('Клиент подписывает данные сеанса закрытым ключом. По сети уходит подпись, а не ключ: для другого сеанса она бесполезна.', 'The client signs the session’s data with the private key. The signature goes over the network, not the key: it is useless for another session.'), who: bi('ssh', 'ssh') } },
      { id: 'e-shell', from: 'sshd', to: 'shell', via: [[560, 412]], label: bi('запуск оболочки', 'start the shell'), labelAt: 0.75, card: { what: bi('sshd запускает оболочку пользователя, и сеанс становится каналом: ваши нажатия туда, её вывод обратно.', 'sshd starts the user’s shell, and the session becomes a channel: your keystrokes there, its output back.'), who: bi('sshd', 'sshd') } },
    ],
  },
  params: [
    {
      id: 'known',
      label: bi('Что клиент знает о сервере', 'What the client knows about the server'),
      kind: 'choice',
      default: 'known',
      options: [
        { id: 'known', label: bi('ключ уже в known_hosts', 'the key is already in known_hosts') },
        { id: 'new', label: bi('первое подключение', 'the first connection') },
        { id: 'changed', label: bi('ключ сервера сменился', 'the server’s key changed') },
      ],
      near: 'known',
      predict: {
        prompt: bi('Сервер переустановили, ключ хоста новый. Что сделает клиент?', 'The server was reinstalled and has a new host key. What does the client do?'),
        options: [
          { id: 'refuse', text: bi('Откажется подключаться с громким предупреждением', 'Refuse to connect with a loud warning') },
          { id: 'ask', text: bi('Спросит, доверять ли новому ключу', 'Ask whether to trust the new key') },
          { id: 'go', text: bi('Подключится: пароль-то верный', 'Connect: the password is right') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'changed') ? 'refuse' : next.some((s) => s.id === 'ask') ? 'ask' : 'go'),
      },
    },
    {
      id: 'auth',
      label: bi('Как вы доказываете, кто вы', 'How you prove who you are'),
      kind: 'choice',
      default: 'key',
      options: [
        { id: 'key', label: bi('ключ ed25519', 'an ed25519 key') },
        { id: 'password', label: bi('пароль', 'a password') },
      ],
      near: 'priv',
    },
    { id: 'jump', label: bi('Через бастион (-J)', 'Through a bastion (-J)'), kind: 'toggle', default: false, near: 'bastion' },
  ],
  breaks: [
    {
      id: 'modes',
      label: bi('authorized_keys доступен на запись группе', 'authorized_keys is writable by the group'),
      remove: ['e-offer'],
      boundary: 'identity',
      predict: {
        prompt: bi('Ключ в файле правильный, но у файла права 664. Пустит ли sshd по ключу?', 'The key in the file is right, but the file has mode 664. Will sshd let the key in?'),
        options: [
          { id: 'no', text: bi('Нет: файлу, который могли подменить, sshd не верит', 'No: sshd does not trust a file someone else could have changed') },
          { id: 'yes', text: bi('Да: ключ-то совпадает', 'Yes: the key matches') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'auth') ? 'no' : 'yes'),
      },
    },
    {
      id: 'direct',
      label: bi('Прямой путь к app закрыт', 'The direct way to app is closed'),
      remove: ['e-conn'],
      boundary: 'network',
      predict: {
        prompt: bi('sshd на `app` принимает подключения только с бастиона. Что увидит `ssh app` без прыжка?', 'sshd on `app` takes connections only from the bastion. What does `ssh app` see without a jump?'),
        options: [
          { id: 'timeout', text: bi('Долгое ожидание и «Operation timed out»', 'A long wait and “Operation timed out”') },
          { id: 'denied', text: bi('Сразу «Permission denied»', '“Permission denied” at once') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.message.includes('timed out')) ? 'timeout' : 'denied'),
      },
    },
  ],
  metrics: [
    { id: 'trips', label: bi('обменов по сети', 'network exchanges') },
    { id: 'secret', label: bi('секрет прошёл по сети (1 — да)', 'a secret crossed the network (1 — yes)') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    let trips = 0;
    const m = (secret = 0) => ({ trips, secret });
    if (p.jump) {
      trips += 4;
      steps.push({
        id: 'jump',
        label: '-J',
        caption: bi('Клиент сначала входит на бастион — целиком, по тем же правилам, что ниже, — и просит его открыть канал до `app`.', 'The client first logs in to the bastion — completely, by the same rules as below — and asks it to open a channel to `app`.'),
        focus: ['client', 'e-jump', 'bastion', 'e-fwd'],
        tokens: [{ edge: 'e-jump', label: 'direct-tcpip app:22' }, { edge: 'e-fwd' }],
        states: { bastion: 'on', client: 'on' },
        metrics: m(),
      });
    } else if (broken.has('direct')) {
      steps.push({
        id: 'blocked',
        label: bi('ожидание', 'waiting'),
        caption: bi('Пакеты к `app` молча отбрасываются: ответа нет, клиент ждёт, пока не кончится время. Отказ «Permission denied» выглядел бы иначе — до проверки ключей дело не дошло.', 'The packets to `app` are silently dropped: no answer comes, and the client waits until time runs out. A “Permission denied” refusal would look different — the keys were never checked.'),
        focus: ['client', 'e-conn'],
        tokens: [{ edge: 'e-conn' }],
        states: { client: 'wait', sshd: 'off' },
        metrics: m(),
        broken: { at: 'client', message: 'ssh: connect to host app port 22: Operation timed out', caption: bi('дальше этого шага сеанс не идёт: нужен путь через бастион (`-J`).', 'the session goes no further than this step: it needs the way through the bastion (`-J`).') },
      });
      return steps;
    }
    trips += 1;
    steps.push({
      id: 'hello',
      label: bi('версии', 'versions'),
      caption: bi('Подключение есть. Стороны называют версии протокола и программы — пока открытым текстом.', 'The connection is up. The sides name the protocol and program versions — still in plain text.'),
      focus: ['client', 'e-conn', 'sshd'],
      tokens: [{ edge: 'e-conn', label: 'SSH-2.0-OpenSSH_10' }],
      states: { client: 'on', sshd: 'on' },
      metrics: m(),
    });
    trips += 1;
    steps.push({
      id: 'kex',
      label: bi('обмен ключами', 'key exchange'),
      caption: bi('Обмен ключами: каждая сторона присылает свою половину, и обе вычисляют общий секрет, который по сети не проходил. С этого места всё зашифровано.', 'The key exchange: each side sends its half, and both compute a shared secret that never crossed the network. From here on everything is encrypted.'),
      focus: ['e-conn', 'client', 'sshd'],
      tokens: [{ edge: 'e-conn', label: 'mlkem768x25519' }, { edge: 'e-conn', label: 'mlkem768x25519', reverse: true }],
      metrics: m(),
    });
    steps.push({
      id: 'sign',
      label: bi('подпись хоста', 'host signature'),
      caption: bi('sshd подписывает итог обмена закрытым ключом хоста и присылает подпись вместе с открытым ключом хоста.', 'sshd signs the result of the exchange with the host’s private key and sends the signature along with the host’s public key.'),
      focus: ['hostkey', 'e-sign', 'sshd'],
      tokens: [{ edge: 'e-sign', label: 'ssh-ed25519' }],
      states: { hostkey: 'on' },
      metrics: m(),
    });
    if (p.known === 'changed') {
      steps.push({
        id: 'changed',
        label: bi('чужой ключ', 'wrong key'),
        caption: bi('Ключ в known_hosts другой. Так выглядит и переустановка сервера, и подмена посередине; отличить их клиент не может и останавливается. Сначала выясняют причину, потом убирают старую запись: `ssh-keygen -R app`.', 'The key in known_hosts is different. A reinstalled server and someone in the middle look the same; the client cannot tell them apart and stops. First find out why, then remove the old entry: `ssh-keygen -R app`.'),
        focus: ['e-check', 'known', 'client'],
        tokens: [{ edge: 'e-check', label: 'SHA256:…' }],
        states: { known: 'err', client: 'err' },
        metrics: m(),
        broken: { at: 'known', message: '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\nHost key verification failed.', caption: bi('клиент не отправит серверу ни пароля, ни подписи, пока запись не исправлена.', 'the client sends the server neither a password nor a signature until the entry is fixed.') },
      });
      return steps;
    }
    steps.push(
      p.known === 'new'
        ? {
            id: 'ask',
            label: bi('новый хост', 'new host'),
            caption: bi('Записи нет. Клиент показывает отпечаток и спрашивает: «Are you sure you want to continue connecting?» Отпечаток стоит сверить с тем, что дал администратор, — после «yes» он ляжет в known_hosts.', 'There is no entry. The client shows the fingerprint and asks: “Are you sure you want to continue connecting?” Compare the fingerprint with the one the admin gave you — after “yes” it goes into known_hosts.'),
            focus: ['e-check', 'known'],
            tokens: [{ edge: 'e-check', label: 'yes' }],
            states: { known: 'warn' },
            metrics: m(),
          }
        : {
            id: 'known',
            label: bi('тот же хост', 'same host'),
            caption: bi('Ключ совпал с записью в known_hosts, подпись верна: это тот самый сервер.', 'The key matches the entry in known_hosts, and the signature is valid: this is the same server.'),
            focus: ['e-check', 'known'],
            tokens: [{ edge: 'e-check', label: 'ok' }],
            states: { known: 'ok' },
            metrics: m(),
          },
    );
    if (p.auth === 'password') {
      trips += 1;
      steps.push({
        id: 'password',
        label: bi('пароль', 'password'),
        caption: bi('Пароль уходит на сервер — внутри шифрования, но целиком. Если бы сервер был подменён, пароль достался бы ему; поэтому сверка ключа хоста перед этим так важна.', 'The password goes to the server — inside the encryption, but whole. If the server were an impostor, it would get the password; that is why the host key check before this matters so much.'),
        focus: ['client', 'e-conn', 'sshd'],
        tokens: [{ edge: 'e-conn', label: 'password ••••' }],
        metrics: m(1),
      });
    } else {
      trips += 1;
      steps.push({
        id: 'offer',
        label: bi('предложение ключа', 'key offer'),
        caption: bi('Клиент предлагает открытый ключ, sshd ищет его в authorized_keys пользователя `deploy`.', 'The client offers the public key, and sshd looks for it in the authorized_keys of the user `deploy`.'),
        focus: ['e-offer', 'auth', 'sshd'],
        tokens: [{ edge: 'e-offer', label: 'ssh-ed25519 AAAA…' }],
        states: { auth: broken.has('modes') ? 'err' : 'on' },
        metrics: m(),
        broken: broken.has('modes')
          ? { at: 'auth', message: 'sshd: Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys\nssh: deploy@app: Permission denied (publickey).', caption: bi('sshd отказался читать файл, который мог изменить кто-то кроме владельца. Причина видна только в журнале сервера.', 'sshd refused to read a file someone other than the owner could have changed. The reason shows only in the server’s log.') }
          : undefined,
      });
      if (broken.has('modes')) return steps;
      trips += 1;
      steps.push({
        id: 'proof',
        label: 'PK_OK',
        caption: bi('Ключ найден (PK_OK). Клиент подписывает данные этого сеанса закрытым ключом, sshd проверяет подпись открытым. Сам закрытый ключ никуда не уходит.', 'The key is there (PK_OK). The client signs this session’s data with the private key, and sshd checks the signature with the public one. The private key itself goes nowhere.'),
        focus: ['priv', 'e-proof', 'client', 'e-conn'],
        tokens: [{ edge: 'e-proof', label: 'signature' }, { edge: 'e-conn' }],
        states: { priv: 'on', auth: 'ok' },
        metrics: m(),
      });
    }
    steps.push({
      id: 'shell',
      label: 'bash',
      caption: fmtb(bi('Вход принят: sshd запускает оболочку `deploy`. {via}', 'Login accepted: sshd starts `deploy`’s shell. {via}'), {
        via: p.jump ? bi('Байты идут через бастион, но прочитать их там нельзя.', 'The bytes go through the bastion, but they cannot be read there.') : bi('Дальше каждое нажатие — короткое зашифрованное сообщение.', 'From now on every keystroke is a short encrypted message.'),
      }),
      focus: ['e-shell', 'shell'],
      tokens: [{ edge: 'e-shell' }],
      states: { shell: 'ok' },
      metrics: m(p.auth === 'password' ? 1 : 0),
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const last = next[next.length - 1];
    const end: Bi = last.broken ? bi('сеанс остановился на шаге «' + (typeof last.label === 'string' ? last.label : last.label.ru) + '»', 'the session stopped at the step “' + (typeof last.label === 'string' ? last.label : last.label.en) + '”') : bi('вход проходит до оболочки', 'the login goes through to the shell');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена: {e}.', 'The break is on: {e}.'), { e: end }) : bi('Поломка убрана.', 'The break is removed.');
    if (change.id === 'auth') return b.auth === 'password' ? bi('С паролем секрет целиком уходит на сервер, поэтому всё держится на сверке ключа хоста.', 'With a password the secret goes to the server whole, so everything rests on the host key check.') : bi('С ключом по сети уходит только подпись этого сеанса.', 'With a key only this session’s signature goes over the network.');
    if (change.id === 'jump') return b.jump ? bi('Через бастион: два входа подряд, шифрование до `app` сквозное.', 'Through a bastion: two logins in a row, the encryption to `app` end to end.') : bi('Напрямую: одно подключение.', 'Directly: one connection.');
    return fmtb(bi('Теперь {e}.', 'Now {e}.'), { e: end });
  },
});
