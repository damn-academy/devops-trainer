// «An SSH login, step by step» (design 00 §6.13). The order follows RFC 4253
// (version strings, key exchange, the server's signature with its host key)
// and RFC 4252 (public key authentication: the client offers a key, the
// server answers PK_OK only if the key is in authorized_keys, the client then
// signs); StrictModes and the known_hosts checks are those of OpenSSH's
// sshd(8) and ssh(1). The knobs choose what the client knows about the
// server, how the user proves who they are, and whether the way goes through
// a bastion.
//
// Reading order: at the start there are only the client and sshd; the files
// and the bastion appear when the login reaches them, and every acting block
// says in a callout what it is doing.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { fmtb } from './util';

type P = { known: string; auth: string; jump: boolean };

const obsd = (name: string, sec: number) => ({ url: `https://man.openbsd.org/${name}.${sec}`, label: `${name}(${sec})` });
const rfc = (n: number) => ({ url: `https://www.rfc-editor.org/rfc/rfc${n}`, label: `RFC ${n}` });

const ALL = ['client', 'known', 'priv', 'bastion', 'sshd', 'hostkey', 'auth', 'shell', 'e-conn', 'e-jump', 'e-fwd', 'e-sign', 'e-check', 'e-offer', 'e-proof', 'e-shell'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const sshModel = defineModel<P>({
  id: 'linux.ssh-session',
  block: 'linux',
  title: bi('Как проходит вход по SSH', 'How an SSH login goes'),
  summary: bi(
    'Вы набираете `ssh app`, и клиент на вашем ноутбуке подключается к службе sshd на сервере. Сначала стороны договариваются о шифровании, потом сервер доказывает подписью ключа хоста, что он тот самый сервер, а клиент сверяет его ключ с файлом known_hosts. Затем вы доказываете, кто вы, ключом или паролем, и sshd запускает вашу оболочку. Счётчик под схемой показывает, уходил ли по сети ваш секрет.',
    'You type `ssh app`, and the client on your laptop connects to the sshd service on the server. First the sides agree on encryption, then the server proves with its host key signature that it is the same server, and the client checks its key against known_hosts. Then you prove who you are with a key or a password, and sshd starts your shell. The counter under the diagram shows whether your secret crossed the network.',
  ),
  intro: bi(
    'Сейчас на схеме только клиент ssh на вашем ноутбуке и служба sshd на сервере, а файлы с ключами и бастион появятся тогда, когда до них дойдёт вход. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным блоком говорит, что он делает, а карточка на линии показывает, что уходит по сети.\n\nКогда дойдёте до оболочки, выберите в «Параметрах» первое подключение или сменившийся ключ сервера и пройдите вход ещё раз.',
    'Now the diagram shows only the ssh client on your laptop and the sshd service on the server; the key files and the bastion appear when the login reaches them. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted block says what it does, and the card on the line shows what goes over the network.\n\nOnce you reach the shell, choose the first connection or a changed server key in “Parameters” and walk the login again.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что уходит по сети: версия, ключ, подпись, пароль', 'what goes over the network: a version, a key, a signature, a password') },
    { mark: 'icon:lock', text: bi('закрытый ключ, который никогда не покидает свою машину', 'a private key that never leaves its machine') },
    { mark: 'icon:file', text: bi('файл со списком ключей', 'a file with a list of keys') },
    { mark: 'warn', text: bi('клиент спрашивает вас, доверять ли серверу', 'the client asks you whether to trust the server') },
    { mark: 'err', text: bi('здесь вход остановился', 'the login stopped here') },
  ],
  stopLabel: bi('Вход остановился', 'The login stopped'),
  concepts: ['linux.ssh-key', 'linux.host-key'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'client', label: bi('Клиент ssh', 'The ssh client'), sub: 'laptop', icon: 'terminal', work: 'dots', family: 'process', x: 24, y: 40, w: 170, h: 64, card: { what: bi('Клиент OpenSSH работает на вашей машине. Он открывает подключение, проверяет сервер и доказывает серверу, кто вы.', 'The OpenSSH client runs on your machine. It opens the connection, checks the server and proves to the server who you are.'), who: bi('Клиент запускаете вы командой `ssh`.', 'You start the client with `ssh`.'), see: 'ssh -v app', doc: obsd('ssh', 1) } },
      { id: 'known', label: 'known_hosts', sub: '~/.ssh/known_hosts', icon: 'file', work: 'spin', family: 'store', x: 24, y: 200, w: 170, h: 64, card: { what: bi('В файле known_hosts хранятся ключи серверов, которые клиент уже видел. В каждой строке записаны имя сервера и его открытый ключ, и по этому списку клиент узнаёт, тот ли перед ним сервер.', 'The known_hosts file keeps the keys of servers the client has already seen. Each line holds a server’s name and its public key, and by this list the client tells whether it faces the same server.'), who: bi('Клиент дописывает строку, когда вы отвечаете «yes» при первом подключении.', 'The client appends a line when you answer “yes” on the first connection.'), see: 'ssh-keygen -F app', doc: obsd('sshd', 8) } },
      { id: 'priv', label: bi('Закрытый ключ', 'The private key'), sub: '~/.ssh/id_ed25519', icon: 'lock', family: 'store', x: 24, y: 330, w: 170, h: 64, card: { what: bi('Закрытый ключ составляет половину вашей пары ключей и никогда не покидает ноутбук. Этим ключом клиент подписывает данные текущего сеанса.', 'The private key is the half of your key pair that never leaves the laptop. The client signs the current session’s data with it.'), who: bi('Ключ создала команда `ssh-keygen` и сразу выставила ему режим 600.', '`ssh-keygen` created the key and gave it mode 600 at once.'), see: 'ls -l ~/.ssh/id_ed25519', doc: obsd('ssh-keygen', 1) } },
      { id: 'bastion', label: bi('Бастион', 'The bastion'), sub: 'sshd · AllowTcpForwarding', icon: 'router', work: 'pulse', family: 'node', x: 330, y: 40, w: 190, h: 64, card: { what: bi('Бастион служит промежуточной машиной на пути к серверу. С флагом `-J` или строкой `ProxyJump` клиент сначала входит на бастион, а потом просит sshd бастиона открыть канал к `app`. Шифрование до `app` при этом остаётся сквозным.', 'The bastion is the machine in between on the way to the server. With `-J` or `ProxyJump` the client first logs in to the bastion, then asks the bastion’s sshd to open a channel to `app`. The encryption to `app` stays end to end.'), who: bi('Администраторы держат бастион единственной дверью внутрь сети.', 'The admins keep the bastion as the only door into the network.'), see: 'ssh -G app | grep proxyjump', doc: obsd('ssh_config', 5) } },
      { id: 'sshd', label: bi('Служба sshd', 'The sshd service'), sub: 'app', icon: 'server', work: 'pulse', family: 'process', x: 640, y: 40, w: 170, h: 64, card: { what: bi('Служба sshd принимает подключения SSH на сервере. Она доказывает клиенту, что перед ним тот самый сервер, и решает, пускать ли пользователя.', 'The sshd service takes SSH connections on the server. It proves to the client that it faces the same server and decides whether to let the user in.'), who: bi('Службу запускает система инициализации при загрузке машины.', 'The init system starts the service when the machine boots.'), see: 'sshd -T | head', doc: obsd('sshd', 8) } },
      { id: 'hostkey', label: bi('Ключ хоста', 'The host key'), sub: '/etc/ssh/ssh_host_ed25519_key', icon: 'lock', family: 'store', x: 640, y: 170, w: 300, h: 64, card: { what: bi('Ключом хоста называют собственную пару ключей сервера. Закрытой половиной sshd подписывает каждый новый сеанс, а открытую половину клиент хранит в known_hosts.', 'The host key is the server’s own key pair. sshd signs every new session with the private half, and the client keeps the public half in known_hosts.'), who: bi('Пару создают при установке sshd командой `ssh-keygen -A`.', 'The pair is created when sshd is installed, with `ssh-keygen -A`.'), see: 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub' } },
      { id: 'auth', label: 'authorized_keys', sub: '~deploy/.ssh/authorized_keys', icon: 'file', work: 'spin', family: 'store', x: 640, y: 270, w: 300, h: 64, card: { what: bi('В файле authorized_keys перечислены открытые ключи, с которыми можно войти пользователем `deploy`. Служба sshd читает этот файл, только если писать в него и в каталог `~/.ssh` может один владелец, и за это отвечает настройка StrictModes.', 'authorized_keys lists the public keys that may log in as `deploy`. sshd reads the file only if nobody but the owner can write to it and to `~/.ssh`, which the StrictModes setting is in charge of.'), who: bi('Ключи туда кладёте вы сами или команда `ssh-copy-id`.', 'You put the keys there yourself, or `ssh-copy-id` does.'), see: 'ls -ld ~/.ssh ~/.ssh/authorized_keys', doc: obsd('sshd', 8) } },
      { id: 'shell', label: bi('Оболочка на сервере', 'The shell on the server'), sub: 'deploy@app', icon: 'process', family: 'process', x: 640, y: 380, w: 300, h: 64, card: { what: bi('Ваша оболочка работает на сервере обычным процессом пользователя `deploy`, а её ввод и вывод идут по зашифрованному каналу.', 'Your shell runs on the server as an ordinary process of `deploy`, and its input and output go through the encrypted channel.'), who: bi('Оболочку запускает sshd после успешного входа.', 'sshd starts it after a successful login.'), see: 'ps -o pid,user,args -u deploy' } },
    ],
    edges: [
      { id: 'e-conn', from: 'client', to: 'sshd', via: [[580, 72]], label: bi('подключение к номеру 22', 'connection to number 22'), labelAt: 0.35, card: { what: bi('Клиент подключается к sshd на номере 22, и стороны обмениваются строками версий вида `SSH-2.0-OpenSSH_…`.', 'The client connects to sshd on number 22, and the sides exchange version strings like `SSH-2.0-OpenSSH_…`.'), who: bi('Строками версий обмениваются клиент ssh и служба sshd.', 'The ssh client and the sshd service exchange the version strings.'), doc: rfc(4253) } },
      { id: 'e-jump', from: 'client', to: 'bastion', label: bi('вход на бастион', 'login to the bastion'), card: { what: bi('Когда вход идёт через бастион, клиент сначала входит на бастион обычным сеансом и просит у него канал до `app`, а такой канал называется `direct-tcpip`.', 'When the login goes through the bastion, the client first logs in to the bastion with an ordinary session and asks it for a channel to `app`, and such a channel is called `direct-tcpip`.'), who: bi('Переход через бастион клиент выполняет по флагу `-J`.', 'The client goes through the bastion on the `-J` flag.'), doc: obsd('ssh', 1) } },
      { id: 'e-fwd', from: 'bastion', to: 'sshd', label: bi('канал до app', 'channel to app'), card: { what: bi('Бастион соединяется с `app` от своего имени и передаёт байты, но расшифровать их не может, потому что ключи сеанса знают только клиент и `app`.', 'The bastion connects to `app` on its own behalf and passes the bytes, but cannot decrypt them, because only the client and `app` know the session keys.'), who: bi('Канал открывает sshd бастиона, если ему это разрешено настройкой `AllowTcpForwarding`.', 'The bastion’s sshd opens the channel if `AllowTcpForwarding` allows it.') } },
      { id: 'e-sign', from: 'hostkey', to: 'sshd', label: bi('подпись сеанса', 'session signature'), card: { what: bi('sshd подписывает итог обмена ключами закрытым ключом хоста, и подделать эту подпись без самого ключа нельзя.', 'sshd signs the result of the key exchange with the host’s private key, and the signature cannot be forged without that key.'), who: bi('Подпись ставит sshd.', 'sshd makes the signature.'), doc: rfc(4253) } },
      { id: 'e-check', from: 'client', to: 'known', label: bi('сверка ключа хоста', 'host key check'), card: { what: bi('Клиент ищет имя сервера в known_hosts и сравнивает ключ. Если записи нет, клиент спрашивает вас, а если запись другая, отказывается подключаться.', 'The client looks up the server’s name in known_hosts and compares the key. If there is no entry, it asks you, and if the entry differs, it refuses to connect.'), who: bi('Сверку выполняет клиент, а её строгость задаёт настройка StrictHostKeyChecking.', 'The client does the check, and StrictHostKeyChecking sets how strict it is.'), doc: obsd('ssh_config', 5) } },
      { id: 'e-offer', from: 'sshd', to: 'auth', via: [[952, 72], [952, 302]], labelAt: 0.75, label: bi('поиск ключа', 'key lookup'), card: { what: bi('Клиент предлагает открытый ключ, а sshd ищет его в authorized_keys и отвечает PK_OK, только если нашёл.', 'The client offers a public key, and sshd looks for it in authorized_keys and answers PK_OK only if it is there.'), who: bi('Ключ в файле ищет служба sshd.', 'sshd looks for the key in the file.'), doc: rfc(4252) } },
      { id: 'e-proof', from: 'priv', to: 'client', via: [[212, 362], [212, 88]], label: bi('подпись ключом', 'signing with the key'), card: { what: bi('Клиент подписывает данные сеанса закрытым ключом. По сети уходит подпись, а не сам ключ, и для другого сеанса эта подпись бесполезна.', 'The client signs the session’s data with the private key. The signature goes over the network, not the key, and it is useless for another session.'), who: bi('Подпись ставит клиент ssh.', 'The ssh client makes the signature.') } },
      { id: 'e-shell', from: 'sshd', to: 'shell', via: [[620, 72], [620, 412]], label: bi('запуск оболочки', 'starting the shell'), labelAt: 0.6, card: { what: bi('sshd запускает оболочку пользователя, и сеанс превращается в канал: ваши нажатия клавиш идут на сервер, а вывод оболочки возвращается к вам.', 'sshd starts the user’s shell, and the session becomes a channel: your keystrokes go to the server, and the shell’s output comes back to you.'), who: bi('Оболочку запускает sshd.', 'sshd starts the shell.') } },
    ],
  },
  params: [
    {
      id: 'known',
      label: bi('Что клиент знает о сервере', 'What the client knows about the server'),
      kind: 'choice',
      default: 'known',
      options: [
        { id: 'known', label: bi('ключ сервера уже записан в known_hosts', 'the server’s key is already in known_hosts') },
        { id: 'new', label: bi('вы подключаетесь к серверу впервые', 'you connect to the server for the first time') },
        { id: 'changed', label: bi('ключ сервера сменился', 'the server’s key has changed') },
      ],
      near: 'known',
      group: bi('Как проверяют сервер', 'How the server is checked'),
      predict: {
        prompt: bi('Сервер переустановили, и ключ хоста у него теперь новый, а в known_hosts записан старый. Что сделает клиент?', 'The server was reinstalled and now has a new host key, while known_hosts holds the old one. What does the client do?'),
        options: [
          { id: 'refuse', text: bi('Откажется подключаться и выведет громкое предупреждение', 'It refuses to connect and prints a loud warning') },
          { id: 'ask', text: bi('Спросит вас, доверять ли новому ключу', 'It asks you whether to trust the new key') },
          { id: 'go', text: bi('Подключится, если пароль или ключ пользователя верный', 'It connects if the user’s password or key is right') },
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
        { id: 'key', label: bi('ключом ed25519', 'with an ed25519 key') },
        { id: 'password', label: bi('паролем', 'with a password') },
      ],
      near: 'priv',
      group: bi('Как проверяют вас', 'How you are checked'),
    },
    { id: 'jump', label: bi('Вход идёт через бастион (-J)', 'The login goes through a bastion (-J)'), kind: 'toggle', default: false, near: 'bastion', group: bi('Как проверяют вас', 'How you are checked') },
  ],
  breaks: [
    {
      id: 'modes',
      label: bi('Файл authorized_keys доступен на запись группе (режим 664)', 'authorized_keys is writable by the group (mode 664)'),
      remove: ['e-offer'],
      boundary: 'identity',
      predict: {
        prompt: bi('Ваш ключ записан в authorized_keys правильно, но у файла режим 664, то есть писать в него может и группа. Пустит ли sshd по этому ключу?', 'Your key is written into authorized_keys correctly, but the file has mode 664, so the group can write to it too. Will sshd let you in with this key?'),
        options: [
          { id: 'no', text: bi('Нет, потому что файлу, который мог изменить кто-то другой, sshd не доверяет', 'No, because sshd does not trust a file someone else could have changed') },
          { id: 'yes', text: bi('Да, потому что ключ в файле совпадает', 'Yes, because the key in the file matches') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'auth') ? 'no' : 'yes'),
      },
    },
    {
      id: 'direct',
      label: bi('Межсетевой экран молча отбрасывает прямые подключения к app', 'A firewall silently drops direct connections to app'),
      remove: ['e-conn'],
      boundary: 'network',
      predict: {
        prompt: bi('Служба sshd на `app` принимает подключения только с бастиона, а пакеты с других машин молча отбрасываются. Что увидит `ssh app`, если запустить его напрямую, без перехода через бастион?', 'sshd on `app` takes connections only from the bastion, and packets from other machines are silently dropped. What does `ssh app` see when run directly, without going through the bastion?'),
        options: [
          { id: 'timeout', text: bi('Долгое ожидание, а потом сообщение «Operation timed out»', 'A long wait, then “Operation timed out”') },
          { id: 'denied', text: bi('Сразу сообщение «Permission denied»', '“Permission denied” at once') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.message.includes('timed out')) ? 'timeout' : 'denied'),
      },
    },
  ],
  metrics: [
    { id: 'trips', label: bi('обменов по сети', 'network exchanges') },
    { id: 'secret', label: bi('ваш секрет прошёл по сети (1 значит «да»)', 'your secret crossed the network (1 means “yes”)') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    let trips = 0;
    const m = (secret = 0) => ({ trips, secret });
    const first = (): Record<string, ElementState> | undefined => (steps.length === 0 ? startWith('client', 'sshd', 'e-conn') : undefined);
    if (p.jump) {
      trips += 4;
      steps.push({
        id: 'jump',
        label: '-J',
        caption: bi('Клиент сначала входит на бастион, причём полностью и по тем же правилам, которые показаны в следующих шагах, а потом просит бастион открыть канал до `app`.', 'The client first logs in to the bastion, completely and by the same rules the next steps show, then asks the bastion to open a channel to `app`.'),
        focus: ['e-jump', 'bastion'],
        reveal: ['bastion', 'e-jump', 'e-fwd'],
        tokens: [{ edge: 'e-jump', label: 'direct-tcpip app:22' }, { edge: 'e-fwd', label: bi('канал', 'channel') }],
        say: { bastion: bi('Бастион впустил вас и открывает канал до сервера app, не видя, что по нему пойдёт.', 'The bastion let you in and opens a channel to app without seeing what goes through it.') },
        states: { ...first(), bastion: 'on', client: 'on' },
        metrics: m(),
      });
    } else if (broken.has('direct')) {
      steps.push({
        id: 'blocked',
        label: bi('ожидание', 'waiting'),
        caption: bi('Пакеты к `app` молча отбрасываются, ответа нет, и клиент ждёт, пока не кончится время. Сообщения «Permission denied» здесь не будет, потому что до проверки ключей дело так и не дошло.', 'The packets to `app` are silently dropped, no answer comes, and the client waits until time runs out. There will be no “Permission denied” here, because the keys were never checked.'),
        focus: ['client', 'e-conn'],
        tokens: [{ edge: 'e-conn', label: 'SYN' }],
        say: { client: bi('Клиент отправил запрос на подключение и ждёт ответа, который не придёт.', 'The client sent a connection request and waits for an answer that will not come.') },
        states: { ...first(), client: 'wait', sshd: 'off' },
        metrics: m(),
        broken: { at: 'client', message: 'ssh: connect to host app port 22: Operation timed out', caption: bi('Дальше этого шага сеанс не идёт, и попасть на сервер можно только через бастион с флагом `-J`. Узнают такую поломку по долгому ожиданию перед сообщением об ошибке.', 'The session goes no further than this step, and the server can be reached only through the bastion with `-J`. You recognise this break by the long wait before the error message.') },
      });
      return steps;
    }
    trips += 1;
    steps.push({
      id: 'hello',
      label: bi('версии', 'versions'),
      caption: bi('Подключение установлено. Стороны называют друг другу версии протокола и программы, и пока это происходит открытым текстом.', 'The connection is up. The sides tell each other the protocol and program versions, and so far this happens in plain text.'),
      focus: ['e-conn', 'sshd'],
      tokens: [{ edge: 'e-conn', label: 'SSH-2.0-OpenSSH_10' }],
      say: { sshd: bi('Служба sshd отвечает строкой со своей версией протокола и программы.', 'sshd answers with a line naming its protocol and program versions.') },
      states: { ...first(), client: 'on', sshd: 'on' },
      metrics: m(),
    });
    trips += 1;
    steps.push({
      id: 'kex',
      label: bi('обмен ключами', 'key exchange'),
      caption: bi('Начинается обмен ключами. Каждая сторона присылает свою половину, и обе вычисляют общий секрет, который сам по сети не проходил. С этого момента всё, что идёт по сети, зашифровано.', 'The key exchange begins. Each side sends its half, and both compute a shared secret that itself never crossed the network. From this moment everything on the network is encrypted.'),
      focus: ['e-conn', 'client'],
      tokens: [{ edge: 'e-conn', label: 'mlkem768x25519' }, { edge: 'e-conn', label: 'mlkem768x25519', reverse: true }],
      say: { client: bi('Клиент и сервер вычисляют общий секрет, из которого получаются ключи шифрования.', 'The client and the server compute a shared secret from which the encryption keys come.') },
      metrics: m(),
    });
    steps.push({
      id: 'sign',
      label: bi('подпись хоста', 'host signature'),
      caption: bi('Служба sshd подписывает итог обмена закрытым ключом хоста и присылает клиенту эту подпись вместе с открытым ключом хоста.', 'sshd signs the result of the exchange with the host’s private key and sends the client this signature together with the host’s public key.'),
      focus: ['e-sign', 'sshd'],
      reveal: ['hostkey', 'e-sign'],
      tokens: [{ edge: 'e-sign', label: 'ssh-ed25519' }],
      say: { hostkey: bi('Закрытым ключом хоста служба sshd подписывает сеанс, чтобы клиент мог убедиться, что перед ним тот самый сервер.', 'sshd signs the session with the host’s private key so that the client can make sure it faces the same server.') },
      states: { hostkey: 'on' },
      metrics: m(),
    });
    if (p.known === 'changed') {
      steps.push({
        id: 'changed',
        label: bi('чужой ключ', 'wrong key'),
        caption: bi('В known_hosts записан другой ключ. Точно так же выглядят и переустановка сервера, и подмена посередине, а отличить их клиент не может, поэтому останавливается. Сначала выясняют причину и только потом убирают старую запись командой `ssh-keygen -R app`.', 'known_hosts holds a different key. A reinstalled server and someone in the middle look exactly the same, and the client cannot tell them apart, so it stops. First find out why, and only then remove the old entry with `ssh-keygen -R app`.'),
        focus: ['e-check', 'known'],
        reveal: ['known', 'e-check'],
        tokens: [{ edge: 'e-check', label: 'SHA256:…' }],
        say: { known: bi('Ключ сервера не совпадает с записью в known_hosts, и клиент прекращает подключение.', 'The server’s key does not match the entry in known_hosts, and the client stops the connection.') },
        states: { known: 'err', client: 'err' },
        metrics: m(),
        broken: { at: 'known', message: '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\nHost key verification failed.', caption: bi('Пока запись не исправлена, клиент не отправит серверу ни пароля, ни подписи. Узнают эту поломку по рамке из знаков @ и словам «REMOTE HOST IDENTIFICATION HAS CHANGED».', 'Until the entry is fixed, the client sends the server neither a password nor a signature. You recognise this break by the frame of @ signs and the words “REMOTE HOST IDENTIFICATION HAS CHANGED”.') },
      });
      return steps;
    }
    steps.push(
      p.known === 'new'
        ? {
            id: 'ask',
            label: bi('новый сервер', 'new server'),
            caption: bi('Записи об этом сервере нет. Клиент показывает отпечаток ключа и спрашивает: «Are you sure you want to continue connecting?» Отпечаток стоит сверить с тем, который дал администратор, потому что после ответа «yes» он попадёт в known_hosts.', 'There is no entry for this server. The client shows the key’s fingerprint and asks: “Are you sure you want to continue connecting?” Compare the fingerprint with the one the admin gave you, because after “yes” it goes into known_hosts.'),
            focus: ['e-check', 'known'],
            reveal: ['known', 'e-check'],
            tokens: [{ edge: 'e-check', label: 'yes' }],
            say: { known: bi('Клиент не нашёл этот сервер в known_hosts и спрашивает вас, доверять ли его ключу.', 'The client did not find this server in known_hosts and asks you whether to trust its key.') },
            states: { known: 'warn' },
            metrics: m(),
          }
        : {
            id: 'known',
            label: bi('тот же сервер', 'same server'),
            caption: bi('Ключ сервера совпал с записью в known_hosts, а подпись верна, значит, перед клиентом тот самый сервер.', 'The server’s key matches the entry in known_hosts, and the signature is valid, so the client faces the same server.'),
            focus: ['e-check', 'known'],
            reveal: ['known', 'e-check'],
            tokens: [{ edge: 'e-check', label: 'ssh-ed25519' }],
            say: { known: bi('Ключ сервера совпадает с записью в known_hosts, и клиент ему доверяет.', 'The server’s key matches the entry in known_hosts, and the client trusts it.') },
            states: { known: 'ok' },
            metrics: m(),
          },
    );
    if (p.auth === 'password') {
      trips += 1;
      steps.push({
        id: 'password',
        label: bi('пароль', 'password'),
        caption: bi('Пароль уходит на сервер целиком, хотя и внутри шифрования. Если бы сервер был подменён, пароль достался бы чужому серверу, поэтому сверка ключа хоста перед этим шагом так важна.', 'The password goes to the server whole, although inside the encryption. If the server were an impostor, the password would go to it, which is why the host key check before this step matters so much.'),
        focus: ['e-conn', 'sshd'],
        tokens: [{ edge: 'e-conn', label: 'password ••••' }],
        say: { sshd: bi('Служба sshd получила ваш пароль целиком и сверяет его с записью на сервере.', 'sshd received your whole password and checks it against the record on the server.') },
        metrics: m(1),
      });
    } else {
      trips += 1;
      steps.push({
        id: 'offer',
        label: bi('предложение ключа', 'key offer'),
        caption: bi('Клиент предлагает серверу открытый ключ, а служба sshd ищет его в файле authorized_keys пользователя `deploy`.', 'The client offers the server the public key, and sshd looks for it in the authorized_keys of `deploy`.'),
        focus: ['e-offer', 'auth'],
        reveal: ['auth', 'e-offer'],
        tokens: [{ edge: 'e-offer', label: 'ssh-ed25519 AAAA…' }],
        say: { auth: broken.has('modes') ? bi('Служба sshd видит, что в файл может писать группа, и отказывается его читать.', 'sshd sees the group can write to the file and refuses to read it.') : bi('Служба sshd ищет предложенный ключ в файле authorized_keys и находит его.', 'sshd looks for the offered key in authorized_keys and finds it.') },
        states: { auth: broken.has('modes') ? 'err' : 'on' },
        metrics: m(),
        broken: broken.has('modes')
          ? { at: 'auth', message: 'sshd: Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys\nssh: deploy@app: Permission denied (publickey).', caption: bi('Служба sshd отказалась читать файл, который мог изменить кто-то, кроме владельца. Клиент видит только «Permission denied (publickey)», а настоящая причина записана в журнале сервера, и искать её нужно там.', 'sshd refused to read a file someone other than the owner could have changed. The client sees only “Permission denied (publickey)”, and the real reason is in the server’s log, which is where you find it.') }
          : undefined,
      });
      if (broken.has('modes')) return steps;
      trips += 1;
      steps.push({
        id: 'proof',
        label: 'PK_OK',
        caption: bi('Ключ найден, и sshd отвечает PK_OK. Клиент подписывает данные этого сеанса закрытым ключом, а sshd проверяет подпись открытым. Сам закрытый ключ при этом никуда не уходит.', 'The key is there, and sshd answers PK_OK. The client signs this session’s data with the private key, and sshd checks the signature with the public one. The private key itself goes nowhere.'),
        focus: ['priv', 'e-proof'],
        reveal: ['priv', 'e-proof'],
        tokens: [{ edge: 'e-proof', label: bi('подпись', 'signature') }, { edge: 'e-conn', label: bi('подпись', 'signature') }],
        say: { priv: bi('Клиент подписывает данные сеанса закрытым ключом, который остаётся на ноутбуке.', 'The client signs the session’s data with the private key, which stays on the laptop.') },
        states: { priv: 'on', auth: 'ok' },
        metrics: m(),
      });
    }
    steps.push({
      id: 'shell',
      label: bi('оболочка', 'shell'),
      caption: fmtb(bi('Вход принят, и sshd запускает оболочку пользователя `deploy`. {via}', 'The login is accepted, and sshd starts `deploy`’s shell. {via}'), {
        via: p.jump ? bi('Байты идут через бастион, но прочитать их там нельзя.', 'The bytes go through the bastion, but they cannot be read there.') : bi('С этого момента каждое нажатие клавиши уходит на сервер коротким зашифрованным сообщением.', 'From now on every keystroke goes to the server as a short encrypted message.'),
      }),
      focus: ['e-shell', 'shell'],
      reveal: ['shell', 'e-shell'],
      tokens: [{ edge: 'e-shell', label: 'deploy@app:~$' }],
      say: { shell: bi('Оболочка пользователя deploy запущена и ждёт команды.', 'deploy’s shell has started and waits for commands.') },
      states: { shell: 'ok' },
      metrics: m(p.auth === 'password' ? 1 : 0),
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const last = next[next.length - 1];
    const lbl = (l: Step['label'], lang: 'ru' | 'en') => (typeof l === 'string' ? l : l[lang]);
    const end: Bi = last.broken ? bi('вход останавливается на шаге «' + lbl(last.label, 'ru') + '»', 'the login stops at the step “' + lbl(last.label, 'en') + '”') : bi('вход проходит до оболочки', 'the login goes through to the shell');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена, и теперь {e}.', 'The break is on, and now {e}.'), { e: end }) : bi('Поломку убрали, и вход снова проходит так, как задают параметры.', 'The break is removed, and the login again goes as the parameters say.');
    if (change.id === 'auth') return b.auth === 'password' ? bi('При входе по паролю секрет целиком уходит на сервер, поэтому вся защита держится на сверке ключа хоста.', 'With a password the secret goes to the server whole, so all protection rests on the host key check.') : bi('При входе по ключу по сети уходит только подпись этого сеанса.', 'With a key only this session’s signature goes over the network.');
    if (change.id === 'jump') return b.jump ? bi('Теперь вход идёт через бастион. Клиент входит два раза подряд, и шифрование до `app` остаётся сквозным.', 'Now the login goes through the bastion. The client logs in twice in a row, and the encryption to `app` stays end to end.') : bi('Теперь клиент подключается к серверу напрямую, одним подключением.', 'Now the client connects to the server directly, with one connection.');
    return fmtb(bi('Параметр изменился, и теперь {e}.', 'The parameter changed, and now {e}.'), { e: end });
  },
});
