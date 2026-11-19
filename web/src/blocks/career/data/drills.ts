// Situational drills (10 §9.2): "504 — what do you do?", "the disk is
// full", "a pod in CrashLoopBackOff". Each has hidden causes (variants);
// outputs are what a real server would print for that cause.

import { bi } from '../../../core/i18n';
import type { Drill, DrillOption } from '../drill-engine';

const restartAll = (why = bi('Если перезапустить службы до того, как собраны улики, улики пропадут, а причина останется, и с первой же волной запросов симптом вернётся.', 'Restarting before collecting evidence destroys it and does not remove the cause: the symptom returns with the next wave of requests.')): DrillOption => ({
  id: 'restart',
  text: bi('Перезапустить всё: nginx, приложение и базу', 'Restart everything: nginx, the app, the database'),
  tags: ['destructive'],
  why,
  cmd: ['restart', 'reboot'],
});

export const DRILL_504: Drill = {
  id: 'drill.504',
  title: bi('«Сайт отвечает ошибкой 504»', '“The site returns 504”'),
  symptom: bi(
    'В чат дежурных пишут: «Магазин отвечает ошибкой 504, покупатели жалуются». Вы работаете на сервере `web-1`, где запущен nginx, а приложение работает по адресу `10.0.0.12:8000`.',
    'A message in the on-call chat: “The shop returns 504, customers complain.” You are on `web-1` (nginx runs there); the application runs on `10.0.0.12:8000`.',
  ),
  concepts: ['career.situational', 'career.mitigate-first'],
  variants: [
    { id: 'slow-sql', cause: bi('после релиза новый запрос к базе идёт без индекса', 'after the release a new database query runs without an index') },
    { id: 'pool', cause: bi('новый код не возвращает соединения в пул базы', 'the new code does not return connections to the database pool') },
    { id: 'drop-rule', cause: bi('новое правило межсетевого экрана отбрасывает пакеты к приложению', 'a new firewall rule drops packets to the application') },
  ],
  steps: [
    {
      id: 'clarify',
      prompt: bi('С чего начнёте?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить, у всех ли ошибка или у одного пользователя, на каких страницах, с какого момента и что перед этим менялось', 'Ask: everyone or one user, which pages, since when, what changed'),
          tags: ['clarify'],
          good: true,
          out: {
            'slow-sql': bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, а в 14:08 сетевые инженеры ввели новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
            pool: bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, а в 14:08 сетевые инженеры ввели новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
            'drop-rule': bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, а в 14:08 сетевые инженеры ввели новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
          },
          why: bi('Два вопроса экономят полчаса: масштаб сбоя говорит о влиянии на пользователей, а ответ на вопрос «что менялось» называет первых подозреваемых. Изменений было два, и пока неясно, какое из них виновато.', 'Two questions save half an hour: the scope tells the impact, and “what changed” gives the first suspects. There are two changes, and it is not yet clear which one is to blame.'),
        },
        restartAll(),
        {
          id: 'timeout',
          text: bi('Увеличить proxy_read_timeout в nginx до 300 секунд', 'Raise proxy_read_timeout in nginx to 300 seconds'),
          tags: ['hide'],
          why: bi('Это прячет симптом: вместо ошибки через 60 секунд пользователи будут ждать пять минут, а причина останется.', 'This hides the symptom: instead of an error after 60 seconds users wait five minutes, and the cause stays.'),
        },
        {
          id: 'dns',
          text: bi('Проверить DNS имени shop.example', 'Check DNS for shop.example'),
          tags: ['detour'],
          why: bi('Эта гипотеза ничем не подкреплена. Ошибку 504 возвращает сервер, а значит, клиент уже нашёл по имени, к кому обратиться.', 'A hypothesis without an observation. A 504 is a server’s answer: the client already reached someone by that name.'),
          cmd: ['^dig\\b', '^nslookup\\b', '^host\\b'],
        },
      ],
    },
    {
      id: 'confirm',
      prompt: bi('Подтвердите симптом снаружи и выясните, кто отвечает ошибкой 504.', 'Confirm the symptom from outside and find out who exactly answers 504.'),
      options: [
        {
          id: 'curl',
          text: bi('Отправить запрос с подробным выводом: `curl -sv https://shop.example/checkout`', 'A verbose request: `curl -sv https://shop.example/checkout`'),
          tags: ['evidence', 'level'],
          good: true,
          cmd: ['^curl\\b.*shop'],
          out: '* Connected to shop.example (203.0.113.10) port 443\n* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n> POST /checkout HTTP/2\n< HTTP/2 504\n< server: nginx\n< content-type: text/html',
          why: bi('Соединение установлено, шифрование согласовано, и пришёл ответ с ошибкой 504 Gateway Timeout и заголовком `server: nginx`. Значит, DNS, TCP и TLS до nginx работают, а сам nginx не дождался ответа от того, кто стоит за ним. Проблема на уровне приложений (L7), между nginx и приложением.', 'The connection, TLS and the response all went through, and the 504 Gateway Timeout is signed `server: nginx`. So DNS, TCP and TLS up to nginx work: nginx did not get an answer from whoever stands behind it. The layer is L7, the place is between nginx and the application.'),
        },
        {
          id: 'ping',
          text: bi('`ping shop.example`', '`ping shop.example`'),
          tags: ['detour'],
          cmd: ['^ping\\b'],
          out: '64 bytes from 203.0.113.10: icmp_seq=1 ttl=55 time=12.1 ms\n64 bytes from 203.0.113.10: icmp_seq=2 ttl=55 time=11.8 ms',
          why: bi('Ответ на ping доказывает лишь, что машина отвечает на пакеты ICMP. О HTTP, nginx и приложении он ничего не говорит.', 'A ping only proves that the host answers ICMP. It says nothing about HTTP, nginx or the application.'),
        },
        {
          id: 'dig',
          text: bi('`dig shop.example`', '`dig shop.example`'),
          tags: ['contradicts'],
          cmd: ['^dig\\b', '^nslookup\\b'],
          out: 'shop.example.\t\t300\tIN\tA\t203.0.113.10',
          why: bi('Имя превращается в адрес, как и ожидалось: если бы клиент не нашёл сервер, ответ 504 не мог бы прийти.', 'The name resolves, as expected: a 504 could not have arrived at all if the client had not found the server.'),
        },
      ],
    },
    {
      id: 'log',
      prompt: bi('Где nginx пишет, почему он не дождался ответа?', 'Where does nginx write why it did not get an answer?'),
      options: [
        {
          id: 'errlog',
          text: bi('Журнал ошибок: `tail /var/log/nginx/error.log`', 'The error log: `tail /var/log/nginx/error.log`'),
          tags: ['evidence'],
          good: true,
          cmd: ['error\\.log', 'journalctl.*nginx'],
          out: {
            'slow-sql': '2026/11/18 14:12:03 [error] 812#812: *4471 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 198.51.100.7, server: shop.example, request: "POST /checkout HTTP/2.0", upstream: "http://10.0.0.12:8000/checkout"',
            pool: '2026/11/18 14:12:03 [error] 812#812: *4471 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 198.51.100.7, server: shop.example, request: "POST /checkout HTTP/2.0", upstream: "http://10.0.0.12:8000/checkout"',
            'drop-rule': '2026/11/18 14:12:03 [error] 812#812: *4471 upstream timed out (110: Connection timed out) while connecting to upstream, client: 198.51.100.7, server: shop.example, request: "POST /checkout HTTP/2.0", upstream: "http://10.0.0.12:8000/checkout"',
          },
          why: bi('Причину неудачи nginx записывает в журнал ошибок, и важнее всего последние слова строки.', 'nginx writes the reason into the error log, and the last words of the line matter most.'),
        },
        {
          id: 'access',
          text: bi('Журнал доступа: `tail /var/log/nginx/access.log`', 'The access log: `tail /var/log/nginx/access.log`'),
          tags: ['detour'],
          cmd: ['access\\.log'],
          out: '198.51.100.7 - - [18/Nov/2026:14:12:03 +0300] "POST /checkout HTTP/2.0" 504 160 "-" "Mozilla/5.0"',
          why: bi('Журнал доступа ещё раз подтверждает ошибку 504, но причины в нём нет: она записана в журнале ошибок.', 'The access log confirms the 504 once more, but the reason is not there: it is in the error log.'),
        },
        restartAll(),
      ],
    },
    {
      id: 'read',
      prompt: bi('Что значит эта строка журнала?', 'What does that log line mean?'),
      options: [
        {
          id: 'reading',
          text: bi('nginx соединился с приложением, но не дождался ответа, потому что приложение отвечает медленно', 'nginx connected to the application but got no answer in time: the application is slow'),
          tags: ['level'],
          rightFor: ['slow-sql', 'pool'],
          why: {
            'slow-sql': bi('Слова «while reading response header» означают, что соединение установлено и запрос отправлен, но ответа нет. Значит, проблема на уровне приложений: в самом приложении или в том, чего оно ждёт.', '“while reading response header”: the connection is up and the request sent, no answer: this is L7, the application itself or what it waits for.'),
            pool: bi('Слова «while reading response header» означают, что соединение установлено и запрос отправлен, но ответа нет. Значит, проблема на уровне приложений: в самом приложении или в том, чего оно ждёт.', '“while reading response header”: the connection is up and the request sent, no answer: this is L7, the application itself or what it waits for.'),
            'drop-rule': bi('В строке написано «while connecting»: до чтения ответа дело не дошло, потому что соединение даже не установилось.', 'The line says “while connecting”: it never got to reading a response — the connection was not even established.'),
          },
        },
        {
          id: 'connecting',
          text: bi('nginx не установил даже соединения, значит, что-то мешает на пути до приложения', 'nginx could not even establish a connection: something on the path to the application'),
          tags: ['level'],
          rightFor: ['drop-rule'],
          why: {
            'drop-rule': bi('Слова «while connecting to upstream» означают, что TCP-соединение не установилось за отведённое время. Значит, проблема на сетевом или транспортном уровне: в сети или в межсетевом экране между nginx и приложением.', '“while connecting to upstream”: the TCP connection was not established in time: this is L4/L3, the network or a firewall between nginx and the application.'),
            default: bi('В строке написано «while reading response header»: соединение было, и nginx ждал ответа.', 'The line says “while reading response header”: there was a connection, and nginx waited for an answer.'),
          },
        },
        {
          id: 'name',
          text: bi('nginx не может превратить имя приложения (upstream) в адрес', 'nginx cannot resolve the upstream name'),
          tags: ['contradicts'],
          why: bi('В строке уже стоит адрес 10.0.0.12, значит, имя давно превращено в адрес.', 'The line already contains the address 10.0.0.12: the name was resolved long ago.'),
        },
      ],
    },
    {
      id: 'narrow',
      prompt: bi('Сузьте круг гипотез: проверьте приложение напрямую, мимо nginx.', 'Narrow it down: check the upstream bypassing nginx.'),
      options: [
        {
          id: 'direct',
          text: bi('Обратиться к приложению напрямую и замерить время ответа', 'A direct request to the application, timed'),
          tags: ['evidence'],
          good: true,
          cmd: ['curl.*10\\.0\\.0\\.12', 'curl.*:8000'],
          out: {
            'slow-sql': "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/checkout\n200 35.214\n$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\n200 0.009",
            pool: "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/checkout\n500 30.412\n$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\n200 0.011",
            'drop-rule': "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\ncurl: (28) Failed to connect to 10.0.0.12 port 8000 after 30001 ms: Timeout was reached",
          },
          why: {
            'slow-sql': bi('Страница /health отвечает мгновенно, а оформление заказа — за 35 секунд. Медленно работает один обработчик, а не всё приложение.', 'Health answers instantly, checkout takes 35 seconds: one handler is slow, not the whole application.'),
            pool: bi('Страница /health отвечает мгновенно, а оформление заказа через 30 секунд заканчивается ошибкой 500: обработчик чего-то ждёт и прекращает ждать по таймауту.', 'Health answers instantly, checkout fails with 500 after 30 seconds: the handler waits for something and gives up on a timeout.'),
            'drop-rule': bi('Даже к /health не удаётся подключиться: само приложение может работать, но пакеты до него не доходят.', 'Even /health does not connect: the application may be alive, but packets do not reach it.'),
          },
        },
        {
          id: 'ss',
          text: bi('Посмотреть состояние соединений с приложением: `ss -tn dst 10.0.0.12`', 'Connection states to the application: `ss -tn dst 10.0.0.12`'),
          tags: ['evidence'],
          rightFor: ['drop-rule'],
          cmd: ['^ss\\b'],
          out: {
            'drop-rule': 'State     Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nSYN-SENT  0      1           10.0.0.11:51234     10.0.0.12:8000\nSYN-SENT  0      1           10.0.0.11:51240     10.0.0.12:8000',
            default: 'State  Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nESTAB  0      0           10.0.0.11:51234     10.0.0.12:8000\nESTAB  0      0           10.0.0.11:51240     10.0.0.12:8000',
          },
          why: {
            'drop-rule': bi('Состояние SYN-SENT означает, что первый пакет соединения (SYN) ушёл, а ответа нет. Кто-то по пути молча отбрасывает пакеты.', 'SYN-SENT: our SYN went out and nothing came back. Something on the way silently drops the packets.'),
            default: bi('Соединения установлены (ESTAB), так что сеть ни при чём, а ждать приходится самого приложения. Этот ход ничему не вредит, но ответа на вопрос «почему медленно» он не даёт.', 'The connections are established (ESTAB): the network is fine, we wait for the application itself. Not harmful, but the answer to “why slow” is not here.'),
          },
        },
        {
          id: 'scale',
          text: bi('Добавить реплики приложения', 'Add more replicas of the application'),
          tags: ['hide'],
          why: bi('Это гадание вместо улики. Если новые реплики будут ждать того же, что и старые, реплик станет больше, а ожидание останется.', 'Guessing instead of evidence. If the new replicas wait for the same thing as the old ones, there will be more of them and the waiting stays.'),
        },
      ],
    },
    {
      id: 'cause',
      prompt: bi('Найдите причину по уликам.', 'Find the cause from the evidence.'),
      options: [
        {
          id: 'applog',
          text: bi('Посмотреть журнал приложения за последние минуты', 'The application log for the last minutes'),
          tags: ['evidence'],
          rightFor: ['slow-sql', 'pool'],
          cmd: ['journalctl', 'app\\.log', 'kubectl logs', 'docker logs'],
          out: {
            'slow-sql': "14:10:41 WARN  db: slow query 34.8 s: SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC\n14:10:41 INFO  db: plan: Seq Scan on orders  (rows=4120334)",
            pool: '14:10:52 ERROR sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 0 reached, connection timed out, timeout 30.00\n14:10:52 INFO  checkout: holding db session while calling payments API (avg 4.1 s)',
            'drop-rule': '-- No entries since 14:08 --',
          },
          why: {
            'slow-sql': bi('Новый запрос из релиза читает таблицу целиком, все четыре миллиона строк (Seq Scan), потому что индекса по полю customer_email нет.', 'The new query from the release reads the whole table (a Seq Scan over four million rows): there is no index on customer_email.'),
            pool: bi('Все пять соединений пула заняты: новый код держит соединение с базой, пока ждёт ответа внешнего платёжного сервиса.', 'The pool of five connections is exhausted: the new code holds a database session while it waits for the external payments service.'),
            'drop-rule': bi('С 14:08 до приложения не дошёл ни один запрос, так что дело не в нём.', 'Since 14:08 not a single request has reached the application: it is not the culprit.'),
          },
        },
        {
          id: 'nft',
          text: bi('Посмотреть правила межсетевого экрана: `nft list ruleset`', 'Firewall rules: `nft list ruleset`'),
          tags: ['evidence'],
          rightFor: ['drop-rule'],
          cmd: ['^nft\\b', 'iptables'],
          out: {
            'drop-rule': 'table inet filter {\n  chain output {\n    type filter hook output priority filter; policy accept;\n    ip daddr 10.0.0.0/24 tcp dport 8000 drop comment "netops 14:08"\n  }\n}',
            default: 'table inet filter {\n  chain output {\n    type filter hook output priority filter; policy accept;\n  }\n}',
          },
          why: {
            'drop-rule': bi('Вот и причина: правило, которое сетевые инженеры ввели утром, отбрасывает все пакеты, идущие на порт 8000 в подсети приложения.', 'Here is the cause: a rule from the network team’s rollout drops everything going to port 8000 in the application subnet.'),
            default: bi('Правил о порте 8000 нет, и сеть пакеты не трогает. Изменения сетевых инженеров ни при чём.', 'There are no rules about port 8000: the network leaves the packets alone. The network team’s change is not to blame.'),
          },
        },
      ],
    },
    {
      id: 'mitigate',
      prompt: bi('Верните сервис пользователям.', 'Give the service back to the users.'),
      options: [
        {
          id: 'rollback-release',
          text: bi('Откатить релиз 14:05', 'Roll back the 14:05 release'),
          tags: ['mitigate'],
          rightFor: ['slow-sql', 'pool'],
          out: { 'drop-rule': 'release 2026.11.18-2 → 2026.11.18-1\n5xx share: 31% → 31%', default: 'release 2026.11.18-2 → 2026.11.18-1\n5xx share: 31% → 0.4% in 3 min' },
          why: {
            'drop-rule': bi('Откатили не то изменение: релиз ни при чём, и пакеты к приложению по-прежнему отбрасывает правило межсетевого экрана.', 'You rolled back the wrong change: the release is innocent, the rule still drops packets to the application.'),
            default: bi('Откатывают то изменение, которое вызвало поломку. После отката доля ошибок вернулась к норме, и теперь причину можно чинить без спешки.', 'You roll back the change that caused the failure: after the rollback the error share is back to normal, and the fix can be done calmly.'),
          },
        },
        {
          id: 'rollback-rule',
          text: bi('Вместе с сетевыми инженерами откатить новое правило межсетевого экрана', 'Roll back the new firewall rule together with the network team'),
          tags: ['mitigate'],
          rightFor: ['drop-rule'],
          out: { 'drop-rule': 'rule "netops 14:08" removed\n5xx share: 31% → 0.3% in 1 min', default: 'rule "netops 14:08" removed\n5xx share: 31% → 31%' },
          why: {
            'drop-rule': bi('Откатили то изменение, которое вызвало поломку, и сразу проверили долю ошибок.', 'You rolled back exactly the change that caused the failure and checked the error share right away.'),
            default: bi('Правило не касалось порта приложения, поэтому ошибки остались. Улики указывали на релиз.', 'The rule never touched the application port: the errors stay. The evidence pointed at the release.'),
          },
        },
        {
          id: 'hotfix',
          text: bi('Сразу чинить всё руками на рабочем сервере: создать индекс, увеличить пул, править код', 'Fix it in production by hand right away: create the index, raise the pool, edit code on the server'),
          tags: ['fix-first'],
          why: bi('Это починка, а не возвращение сервиса. Пока вы чините руками, пользователи ждут, а ручная правка на рабочем сервере добавляет ещё один риск. Сначала нужно вернуть сервис, а потом исправлять причину через конвейер.', 'This is a fix, not a mitigation. While you fix by hand users wait, and a manual change in production is one more risk. First restore the service, then fix through the pipeline.'),
        },
        restartAll(bi('Перезапуск не убирает ни медленный запрос, ни правило межсетевого экрана. Через минуту всё повторится, а журналов прошлых запусков уже не будет.', 'A restart removes neither the slow query nor the rule: in a minute it repeats, and the logs of the previous runs are gone.')),
      ],
    },
    {
      id: 'fix',
      prompt: bi('Устраните причину так, чтобы это не повторилось, и проверьте результат.', 'Remove the cause so it does not happen again, and verify the result.'),
      options: [
        {
          id: 'fix-index',
          text: bi('Добавить индекс по customer_email миграцией через конвейер, снова выложить релиз и проверить время ответа и долю ошибок 5xx', 'An index on customer_email as a migration through the pipeline; release again and check the response time and the 5xx share'),
          tags: ['fix', 'verify'],
          rightFor: ['slow-sql'],
          why: { 'slow-sql': bi('Причина была в запросе без индекса. Индекс, добавленный миграцией, проверен на тестовом стенде и попадёт в историю изменений.', 'The cause is a query without an index; an index as a migration is tested on staging and stays in the change history.'), default: bi('Индекс не поможет: улики говорят о другой причине.', 'An index will not help: the evidence points to another cause.') },
        },
        {
          id: 'fix-pool',
          text: bi('Исправить код, чтобы он не держал соединение с базой во время внешнего запроса, добавить тест и выложить новую версию, а размер пула менять только по данным о нагрузке', 'Do not hold the database session during the external call: fix the code, add a test and release; change the pool size from load data'),
          tags: ['fix', 'verify'],
          rightFor: ['pool'],
          why: { pool: bi('Соединения в пуле кончались не потому, что пул мал, а потому, что соединения не возвращались. Если только увеличить пул, та же поломка случится позже.', 'The pool ran out not because it was small but because connections were not returned. A “bigger pool” would only postpone the same failure.'), default: bi('Пул тут ни при чём: улики говорят о другой причине.', 'The pool is not involved: the evidence points to another cause.') },
        },
        {
          id: 'fix-rule',
          text: bi('Вместе с сетевыми инженерами исправить правило, разрешив соединения от web-1 к 10.0.0.12:8000, добавить проверку правил перед их вводом и убедиться, что ошибок 5xx меньше 1 %', 'Fix the rule with the network team: allow web-1 → 10.0.0.12:8000, add a rule check before rollouts; make sure 5xx < 1%'),
          tags: ['fix', 'verify'],
          rightFor: ['drop-rule'],
          why: { 'drop-rule': bi('Правило исправлено точечно, а проверка перед вводом правил поймает следующую такую ошибку раньше, чем она дойдёт до рабочих серверов.', 'The rule is fixed precisely, and a check before rollouts catches the next such mistake before production.'), default: bi('Сеть тут ни при чём: улики говорят о другой причине.', 'The network is not involved: the evidence points to another cause.') },
        },
        {
          id: 'timeout2',
          text: bi('Оставить всё как есть, но увеличить таймауты в nginx и в приложении', 'Leave it as it is but raise the timeouts in nginx and the app'),
          tags: ['hide'],
          why: bi('Большие таймауты прячут проблему: пользователи будут ждать дольше, а следующая волна нагрузки снова выведет сервис из строя.', 'Timeouts hide the problem: users wait longer, and the next load wave brings the service down again.'),
        },
      ],
    },
  ],
};

export const DRILL_DISK: Drill = {
  id: 'drill.disk',
  title: bi('«Диск скоро заполнится»', '“The disk will fill up soon”'),
  symptom: bi('На сервере `shop` сработал алерт `DiskWillFillIn4Hours`: диск заполнится примерно через четыре часа.', 'An alert came in: `DiskWillFillIn4Hours` on the `shop` server.'),
  concepts: ['career.situational', 'career.mitigate-first'],
  variants: [
    { id: 'deleted-open', cause: bi('служба держит открытым удалённый журнал', 'a service holds a deleted log open') },
    { id: 'no-rotate', cause: bi('журнал приложения растёт без ротации', 'the application log grows without rotation') },
    { id: 'tmp', cause: bi('разрослись временные файлы службы', 'a service’s temporary files have piled up') },
  ],
  steps: [
    {
      id: 'clarify',
      prompt: bi('С чего начнёте?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить, какой раздел заполняется, как быстро растёт занятое место и что работает на сервере', 'Ask: which partition, how fast it grows, what runs on the server'),
          tags: ['clarify'],
          good: true,
          out: bi('«Заполняется корневой раздел, примерно на гигабайт в час. На сервере работают nginx, приложение и служба отчётов report».', '“The / partition, growing about a gigabyte an hour. The server runs nginx, the application and the report service.”'),
          why: bi('Скорость роста подсказывает, сколько у вас времени, а список служб подсказывает, где искать.', 'The growth rate tells you how much time you have, and the list of services where to look.'),
        },
        {
          id: 'rmlogs',
          text: bi('Сразу освободить место: `rm -rf /var/log/*`', 'Free space right away: `rm -rf /var/log/*`'),
          tags: ['destructive'],
          cmd: ['rm\\s+-rf'],
          why: bi('Вы удалили улики и журналы всех служб. А если место занимает открытый файл, оно даже не освободится.', 'You deleted the evidence and the logs of every service. And if an open file holds the space, it will not even be freed.'),
        },
        {
          id: 'reboot',
          text: bi('Перезагрузить сервер', 'Reboot the server'),
          tags: ['destructive'],
          cmd: ['reboot'],
          why: bi('Если начать с перезагрузки, сервис простаивает, а причина остаётся непонятной. Через несколько часов алерт вернётся.', 'A reboot as the first action is downtime without understanding the cause. In a few hours the alert is back.'),
        },
      ],
    },
    {
      id: 'df',
      prompt: bi('Подтвердите симптом: сколько места занято и на каком разделе.', 'Confirm the symptom: how much space, and where.'),
      options: [
        {
          id: 'df',
          text: bi('`df -h`', '`df -h`'),
          tags: ['evidence', 'level'],
          good: true,
          cmd: ['^df\\b'],
          out: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        20G   19G  1.0G  95% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm',
          why: bi('Корневой раздел заполнен: занято 19 ГБ из 20. Теперь нужно выяснить, что его занимает.', 'The root partition is full: 19 GB of 20. Now: what exactly fills it.'),
        },
        {
          id: 'free',
          text: bi('`free -h`', '`free -h`'),
          tags: ['detour'],
          cmd: ['^free\\b'],
          out: '               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       1.2Gi       1.1Gi        12Mi       1.5Gi       2.4Gi',
          why: bi('Команда показывает оперативную память, а алерт сообщает о диске.', 'This is memory, not disk. The alert is about the disk.'),
        },
      ],
    },
    {
      id: 'du',
      prompt: bi('Найдите, что занимает место, двигаясь от общего к частному.', 'Find where the space goes: from the general to the specific.'),
      options: [
        {
          id: 'du',
          text: bi('`du -xh / --max-depth=2 | sort -h | tail`', '`du -xh / --max-depth=2 | sort -h | tail`'),
          tags: ['evidence'],
          good: true,
          cmd: ['^du\\b', 'ncdu'],
          out: {
            'deleted-open': '820M\t/var/lib\n1.1G\t/home\n1.3G\t/var/log\n4.1G\t/usr\n7.6G\t/',
            'no-rotate': '820M\t/var/lib\n1.1G\t/home\n4.1G\t/usr\n11G\t/var/log/app\n18G\t/',
            tmp: '1.1G\t/home\n1.3G\t/var/log\n4.1G\t/usr\n9.8G\t/var/lib/report/tmp\n17G\t/',
          },
          why: bi('Флаг `-x` не даёт команде уходить в другие файловые системы, а сортировка ставит самые большие каталоги в конец списка.', '`-x` stays on one file system, and the sort puts the biggest last.'),
        },
        {
          id: 'find-all',
          text: bi('Удалить все файлы старше недели: `find / -mtime +7 -delete`', 'Delete everything older than a week: `find / -mtime +7 -delete`'),
          tags: ['destructive'],
          cmd: ['find.*-delete'],
          why: bi('Эта команда удалит системные файлы и данные приложения. Сначала соберите улики, а потом действуйте точечно.', 'This deletes system files and application data. Evidence first, then a precise action.'),
        },
      ],
    },
    {
      id: 'read',
      prompt: bi('Что показывает вывод `du` рядом с `df`?', 'What do the `du` and `df` outputs tell you together?'),
      options: [
        {
          id: 'mismatch',
          text: bi('`du` насчитал намного меньше, чем `df`, значит, место занимает удалённый, но ещё открытый файл', '`du` counts far less than `df`: a deleted but open file holds the space'),
          tags: ['level'],
          rightFor: ['deleted-open'],
          why: { 'deleted-open': bi('`df` спрашивает у файловой системы, сколько места занято, а `du` складывает размеры видимых файлов. Занято 19 ГБ, а видно только 7,6 ГБ, и разницу занимает файл без имени, который ещё держит открытым какой-то процесс.', '`df` asks the file system how much is used, `du` adds up the visible files. 19 GB against 7.6 GB: the difference is held by a file with no name that a process still keeps open.'), default: bi('Здесь `du` и `df` сходятся, и виден конкретный большой каталог.', 'Here `du` and `df` agree: a specific big directory is visible.') },
        },
        {
          id: 'biglog',
          text: bi('Растёт журнал приложения в /var/log/app', 'The application log in /var/log/app is growing'),
          tags: ['level'],
          rightFor: ['no-rotate'],
          why: { 'no-rotate': bi('В /var/log/app лежит 11 ГБ, то есть почти всё занятое место.', '11 GB in /var/log/app is nearly all the used space.'), default: bi('В выводе команды /var/log/app — не самый большой каталог.', 'In the output /var/log/app is not the biggest directory.') },
        },
        {
          id: 'tmpdir',
          text: bi('Разрослись временные файлы службы report', 'The report service’s temporary files have piled up'),
          tags: ['level'],
          rightFor: ['tmp'],
          why: { tmp: bi('В /var/lib/report/tmp лежит 9,8 ГБ, и это временные файлы, а не данные.', '9.8 GB in /var/lib/report/tmp are temporary files, not data.'), default: bi('В выводе команды каталог report/tmp ничем не выделяется.', 'In the output the report/tmp directory does not stand out.') },
        },
        {
          id: 'inodes',
          text: bi('Кончились inode', 'The inodes ran out'),
          tags: ['contradicts'],
          why: bi('Если бы кончились inode, `df -h` показывал бы свободное место, а здесь кончилось само место на диске. Проверить число свободных inode можно командой `df -i`.', 'With no inodes left `df -h` would still show free space, but here the bytes ran out. `df -i` would check it.'),
        },
      ],
    },
    {
      id: 'confirm',
      prompt: bi('Подтвердите причину одной командой.', 'Confirm the cause with one command.'),
      options: [
        {
          id: 'lsof',
          text: bi('Найти удалённые, но открытые файлы: `lsof +L1`', 'Deleted files still open: `lsof +L1`'),
          tags: ['evidence'],
          rightFor: ['deleted-open'],
          cmd: ['lsof', '/proc/.*/fd'],
          out: { 'deleted-open': 'COMMAND  PID USER FD   TYPE DEVICE    SIZE/OFF NLINK  NODE NAME\nreport  1290 app   3w   REG  253,1 12884901888     0 26312 /var/log/report/report.log (deleted)', default: '(no output)' },
          why: { 'deleted-open': bi('Служба report держит открытым удалённый журнал размером 12 ГБ. У файла нет имени (NLINK 0), но место остаётся занятым, пока файл открыт.', 'The report service keeps a deleted 12 GB log open: NLINK 0, no name, and the space stays used while the file is open.'), default: bi('Удалённых открытых файлов нет, и место занимают обычные файлы.', 'No deleted open files: ordinary files hold the space.') },
        },
        {
          id: 'lslog',
          text: bi('`ls -lh /var/log/app` и `ls /etc/logrotate.d`', '`ls -lh /var/log/app` and `ls /etc/logrotate.d`'),
          tags: ['evidence'],
          rightFor: ['no-rotate'],
          cmd: ['ls.*(/var/log/app|logrotate)'],
          out: { 'no-rotate': '-rw-r--r-- 1 app app 11G Nov 18 14:20 app.log\n$ ls /etc/logrotate.d\nnginx  rsyslog', default: '-rw-r--r-- 1 app app 40M Nov 18 14:20 app.log' },
          why: { 'no-rotate': bi('В каталоге один файл размером 11 ГБ, а правил ротации журналов для приложения нет.', 'One 11 GB file and no rotation rule for the application.'), default: bi('Журнал приложения маленький, и дело не в нём.', 'The application log is small: it is not the culprit.') },
        },
        {
          id: 'lstmp',
          text: bi('`ls /var/lib/report/tmp | wc -l` и самые старые файлы', '`ls /var/lib/report/tmp | wc -l` and the oldest files'),
          tags: ['evidence'],
          rightFor: ['tmp'],
          cmd: ['report/tmp'],
          out: { tmp: '48211\n$ ls -ltr /var/lib/report/tmp | head -2\n-rw-r--r-- 1 app app 210K Sep  2 03:00 render-0001.tmp', default: '12' },
          why: { tmp: bi('С сентября накопилось почти 50 тысяч временных файлов: служба не убирает за собой.', 'Almost 50 thousand temporary files since September: the service does not clean up after itself.'), default: bi('Временных файлов немного, и дело не в них.', 'There are few temporary files: they are not the culprit.') },
        },
      ],
    },
    {
      id: 'free',
      prompt: bi('Освободите место безопасно.', 'Free the space safely.'),
      options: [
        {
          id: 'reopen',
          text: bi('Заставить службу report заново открыть журнал: перезапустить её в спокойный момент или послать ей сигнал, по которому она переоткрывает журналы', 'Make report reopen its log: restart the service at a quiet moment or send it its log-reopen signal'),
          tags: ['mitigate'],
          rightFor: ['deleted-open'],
          why: { 'deleted-open': bi('Место освободится, только когда процесс закроет файл. Теперь перезапуск — осознанное действие, основанное на улике, а не гадание.', 'The space comes back only when the process closes the file. Now a restart is a deliberate action based on evidence, not a guess.'), default: bi('Перезапуск ничего не освободит, потому что место занимают обычные файлы.', 'A restart frees nothing: ordinary files take the space.') },
        },
        {
          id: 'truncate',
          text: bi('Сохранить конец журнала как улику и опустошить файл: `truncate -s 0 /var/log/app/app.log`', 'Keep the tail of the log as evidence and truncate the file: `truncate -s 0 /var/log/app/app.log`'),
          tags: ['mitigate'],
          rightFor: ['no-rotate'],
          cmd: ['truncate'],
          why: { 'no-rotate': bi('В отличие от `rm`, команда `truncate` освобождает место сразу, даже если приложение держит файл открытым.', '`truncate` frees the space at once even while the application keeps the file open — unlike `rm`.'), default: bi('Журнал приложения не виноват, и это действие место не вернёт.', 'The application log is not the culprit: this does not bring the space back.') },
        },
        {
          id: 'cleantmp',
          text: bi('Удалить временные файлы службы старше суток: `find /var/lib/report/tmp -mtime +1 -delete`', 'Delete the service’s temporary files older than a day: `find /var/lib/report/tmp -mtime +1 -delete`'),
          tags: ['mitigate'],
          rightFor: ['tmp'],
          why: { tmp: bi('Удаляются только старые временные файлы одной службы, а данные остаются нетронутыми.', 'Only one service’s temporary files, and only old ones, are removed — the data is untouched.'), default: bi('Временные файлы не виноваты, и это действие место не вернёт.', 'The temporary files are not the culprit: this does not bring the space back.') },
        },
        {
          id: 'rmdata',
          text: bi('Удалить /var/lib/report/data, потому что там много места', 'Delete /var/lib/report/data — there is a lot of space there'),
          tags: ['destructive'],
          why: bi('Это данные приложения. Освободить место ценой потери данных — авария похуже исходной.', 'This is the application’s data. Free space at the price of data is a worse incident than the original one.'),
        },
      ],
    },
    {
      id: 'prevent',
      prompt: bi('Сделайте так, чтобы это не повторилось.', 'Make sure it does not happen again.'),
      options: [
        {
          id: 'logrotate',
          text: bi('Добавить для журнала правило logrotate (с переоткрытием журнала в postrotate или с copytruncate) и проверить, что алерт по-прежнему настроен', 'A logrotate rule for the log (with a reopen in postrotate or copytruncate), and keep the alert'),
          tags: ['fix', 'verify'],
          rightFor: ['deleted-open', 'no-rotate'],
          why: { default: bi('Ротация с переоткрытием не даёт журналу ни расти без конца, ни занимать место после удаления.', 'Rotation with a reopen keeps the log from growing forever or getting stuck as a deleted file.'), tmp: bi('Журналы тут ни при чём: копятся временные файлы.', 'Logs are not the problem here: temporary files pile up.') },
        },
        {
          id: 'tmpfiles',
          text: bi('Добавить для каталога правило systemd-tmpfiles (или уборку в самой службе) и алерт на рост занятого места', 'A systemd-tmpfiles rule for the directory (or cleanup in the service itself) and an alert on growth'),
          tags: ['fix', 'verify'],
          rightFor: ['tmp'],
          why: { tmp: bi('Старые временные файлы будут удаляться автоматически.', 'Temporary files will be removed by age automatically.'), default: bi('Временные файлы тут ни при чём.', 'Temporary files are not the problem here.') },
        },
        {
          id: 'bigger',
          text: bi('Увеличить диск вдвое', 'Double the disk size'),
          tags: ['hide'],
          why: bi('Это отложит алерт, но не остановит рост, и через пару суток всё повторится на большем диске.', 'This postpones the alert but does not stop the growth: in a couple of days it repeats on a bigger disk.'),
        },
      ],
    },
  ],
};

export const DRILL_CRASHLOOP: Drill = {
  id: 'drill.crashloop',
  title: bi('«Под в состоянии CrashLoopBackOff»', '“A pod in CrashLoopBackOff”'),
  symptom: bi('После выкладки новая версия сервиса `api` не принимает запросы. В кластере у вас есть `kubectl` с правами на пространство имён `shop`.', 'After a release the new version of the `api` service does not take traffic. You have `kubectl` with rights to the `shop` namespace.'),
  concepts: ['career.situational', 'career.mitigate-first'],
  variants: [
    { id: 'env', cause: bi('в новой версии нужна переменная окружения, которой нет в манифесте', 'the new version needs an environment variable that is missing from the manifest') },
    { id: 'oom', cause: bi('новой версии на старте нужно больше памяти, чем разрешает лимит', 'the new version needs more memory at start than the limit allows') },
  ],
  steps: [
    {
      id: 'clarify',
      prompt: bi('С чего начнёте?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить, что и когда выкладывали и все ли реплики новой версии завершаются с ошибкой', 'Ask: what was released and when, whether every replica of the new version fails'),
          tags: ['clarify'],
          good: true,
          out: bi('«В 14:05 выложили новую версию api через Argo CD. С ошибкой завершаются все новые поды».', '“A new version of api was released through Argo CD at 14:05. Every new pod fails.”'),
          why: bi('Если сбоят все новые поды, значит, дело в версии или в её настройках, а не в одном узле.', 'All new pods fail: the cause is the version or its settings, not a single node.'),
        },
        {
          id: 'delete',
          text: bi('Удалить сбойные поды, чтобы они создались заново', 'Delete the failing pods so they are recreated'),
          tags: ['destructive'],
          cmd: ['kubectl delete'],
          why: bi('Новые поды завершатся так же, а журналы прошлого запуска (`--previous`) пропадут вместе со старыми подами.', 'The new pods crash the same way, and the logs of the previous run (`--previous`) disappear with the old ones.'),
        },
        {
          id: 'scale',
          text: bi('Увеличить число реплик', 'Increase the number of replicas'),
          tags: ['hide'],
          cmd: ['kubectl scale'],
          why: bi('Если реплик той же версии станет больше, станет больше и подов, которые одинаково завершаются с ошибкой.', 'More replicas of the same version means more pods crashing the same way.'),
        },
      ],
    },
    {
      id: 'get',
      prompt: bi('Посмотрите состояние подов.', 'Look at the state of the pods.'),
      options: [
        {
          id: 'get',
          text: bi('`kubectl get pods -n shop`', '`kubectl get pods -n shop`'),
          tags: ['evidence'],
          good: true,
          cmd: ['kubectl get po'],
          out: 'NAME                   READY   STATUS             RESTARTS      AGE\napi-7c9d8f6b5-2xkqp    0/1     CrashLoopBackOff   6 (40s ago)   7m\napi-7c9d8f6b5-9jv4n    0/1     CrashLoopBackOff   6 (35s ago)   7m',
          why: bi('Контейнер запускается, завершается с ошибкой, и kubelet перезапускает его со всё большей паузой. Это и называется CrashLoopBackOff.', 'The container starts, crashes, and the kubelet restarts it with a growing pause: that is CrashLoopBackOff.'),
        },
      ],
    },
    {
      id: 'describe',
      prompt: bi('Узнайте, как завершился прошлый запуск.', 'Find out how the last run ended.'),
      options: [
        {
          id: 'describe',
          text: bi('`kubectl describe pod api-7c9d8f6b5-2xkqp -n shop`', '`kubectl describe pod api-7c9d8f6b5-2xkqp -n shop`'),
          tags: ['evidence'],
          good: true,
          cmd: ['kubectl describe'],
          out: {
            env: '    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Restart Count:  6\nEvents:\n  Warning  BackOff  kubelet  Back-off restarting failed container api in pod api-7c9d8f6b5-2xkqp',
            oom: '    Last State:     Terminated\n      Reason:       OOMKilled\n      Exit Code:    137\n    Limits:\n      memory:  64Mi\nEvents:\n  Warning  BackOff  kubelet  Back-off restarting failed container api in pod api-7c9d8f6b5-2xkqp',
          },
          why: bi('Поле Last State говорит, почему контейнер завершился в прошлый раз: сам ли он вышел или его завершили внешним сигналом.', 'The Last State field tells why the container ended last time: on its own, or killed.'),
        },
      ],
    },
    {
      id: 'read',
      prompt: bi('Что значит причина завершения?', 'What does the termination reason mean?'),
      options: [
        {
          id: 'app',
          text: bi('Приложение завершилось с ошибкой само', 'The application exited with an error on its own'),
          tags: ['level'],
          rightFor: ['env'],
          why: { env: bi('Reason: Error и Exit Code 1 означают, что процесс вышел сам. Почему он вышел, написано в его журнале.', 'Reason: Error, Exit Code 1: the process exited by itself. Why is in its log.'), oom: bi('OOMKilled и код 137 = 128 + 9 означают, что процесс не вышел сам, а был завершён сигналом KILL.', 'OOMKilled and code 137 = 128 + 9: the process did not exit, it was killed with signal KILL.') },
        },
        {
          id: 'oomkill',
          text: bi('Ядро завершило контейнер за превышение лимита памяти', 'The kernel killed the container for exceeding its memory limit'),
          tags: ['level'],
          rightFor: ['oom'],
          why: { oom: bi('OOMKilled, код 137 = 128 + 9 (SIGKILL) и лимит 64Mi означают, что память кончилась раньше, чем приложение запустилось.', 'OOMKilled, code 137 = 128 + 9 (SIGKILL), a 64Mi limit: memory ran out before the application finished starting.'), env: bi('Reason: Error и код 1 означают, что процесс вышел сам, а при нехватке памяти было бы написано OOMKilled.', 'Reason: Error and code 1: the process exited by itself; out of memory would say OOMKilled.') },
        },
        {
          id: 'image',
          text: bi('Не скачался образ', 'The image could not be pulled'),
          tags: ['contradicts'],
          why: bi('Тогда под был бы в состоянии ImagePullBackOff, а контейнер не запустился бы ни разу.', 'Then the status would be ImagePullBackOff, and the container would have no runs at all.'),
        },
      ],
    },
    {
      id: 'evidence',
      prompt: bi('Соберите улику, которая назовёт причину.', 'Collect the evidence that names the cause.'),
      options: [
        {
          id: 'previous',
          text: bi('Журнал прошлого запуска: `kubectl logs api-7c9d8f6b5-2xkqp -n shop --previous`', 'The log of the previous run: `kubectl logs api-7c9d8f6b5-2xkqp -n shop --previous`'),
          tags: ['evidence'],
          rightFor: ['env'],
          cmd: ['logs.*(-p\\b|--previous)'],
          out: { env: 'Traceback (most recent call last):\n  File "/app/main.py", line 12, in <module>\n    DB = os.environ["DATABASE_URL"]\nKeyError: \'DATABASE_URL\'', oom: 'starting api 2.4.0\nloading catalog cache (90 MiB)…' },
          why: { env: bi('Новой версии нужна переменная DATABASE_URL, а в манифесте её нет.', 'The new version needs a DATABASE_URL variable that the manifest does not have.'), oom: bi('Журнал обрывается на загрузке кэша размером 90 МиБ при лимите 64Mi: ядро завершило процесс посреди загрузки.', 'The log stops while loading a 90 MiB cache under a 64Mi limit: the kernel killed the process mid-load.') },
        },
        {
          id: 'limits',
          text: bi('Сравнить лимит памяти с тем, сколько нужно на старте (журнал прошлого запуска, `kubectl top`)', 'Compare the memory limit with what the start needs (the previous log, `kubectl top`)'),
          tags: ['evidence'],
          rightFor: ['oom'],
          cmd: ['kubectl top'],
          out: { oom: 'NAME                  CPU(cores)   MEMORY(bytes)\napi-7c9d8f6b5-2xkqp   120m         63Mi', default: 'NAME                  CPU(cores)   MEMORY(bytes)\napi-7c9d8f6b5-2xkqp   2m           18Mi' },
          why: { oom: bi('Под упирается в лимит 64Mi, и ядро его завершает: лимит меньше, чем приложению нужно при запуске.', 'The pod hits the 64Mi limit and the kernel ends it: the limit is lower than the application needs to start.'), env: bi('Памяти хватает с запасом, и дело не в лимите.', 'There is plenty of memory: the limit is not the cause.') },
        },
        {
          id: 'logsnow',
          text: bi('`kubectl logs api-7c9d8f6b5-2xkqp -n shop` без флагов', '`kubectl logs api-7c9d8f6b5-2xkqp -n shop` without flags'),
          tags: ['detour'],
          cmd: ['^kubectl logs(?!.*(-p\\b|--previous))'],
          out: 'Error from server (BadRequest): container "api" in pod "api-7c9d8f6b5-2xkqp" is waiting to start: CrashLoopBackOff',
          why: bi('Текущий запуск ещё не начался, а журнал завершившегося запуска показывает команда с флагом `--previous`.', 'The current run has not started yet; the crashed one’s log needs `--previous`.'),
        },
      ],
    },
    {
      id: 'mitigate',
      prompt: bi('Верните сервис.', 'Restore the service.'),
      options: [
        {
          id: 'undo',
          text: bi('Откатить выкладку: вернуть прошлую ревизию в Git (или `kubectl rollout undo`, если GitOps нет)', 'Roll back the release: revert to the previous revision in Git (or `kubectl rollout undo` without GitOps)'),
          tags: ['mitigate'],
          good: true,
          cmd: ['rollout undo', 'git revert'],
          out: 'deployment.apps/api rolled back\napi-5b8f7d9c4-k2m1x   1/1   Running   0   20s',
          why: bi('Прошлая версия работала, поэтому откат вернёт сервис за минуту, а причину можно будет чинить без спешки.', 'The previous version worked: a rollback restores the service in a minute, and the cause can be fixed without a rush.'),
        },
        {
          id: 'nolimit',
          text: bi('Снять лимит памяти совсем', 'Remove the memory limit entirely'),
          tags: ['hide'],
          why: bi('Под без лимита может занять всю память узла и вывести из строя соседние поды. Лимит не убирают, а выбирают по измерениям.', 'A pod without a limit can eat the node’s memory and take its neighbours down. A limit is set from data, not removed.'),
        },
        {
          id: 'edit',
          text: bi('Поправить Deployment руками: `kubectl edit`', 'Edit the Deployment by hand: `kubectl edit`'),
          tags: ['fix-first'],
          cmd: ['kubectl edit'],
          why: bi('Выкладка идёт через Argo CD из Git, поэтому ручная правка откатится при следующей синхронизации или разойдётся с Git. Сначала нужен откат, а потом исправление в Git.', 'Releases go through Argo CD from Git: a manual edit is reverted on the next sync or drifts from Git. Roll back first, then fix it in Git.'),
        },
      ],
    },
    {
      id: 'fix',
      prompt: bi('Исправьте причину и выложите новую версию заново.', 'Fix the cause and release again.'),
      options: [
        {
          id: 'env-fix',
          text: bi('Добавить переменную DATABASE_URL из Secret в манифест в Git, выложить через конвейер и проверить, что поды перешли в состояние Ready', 'Add DATABASE_URL from a Secret to the manifest in Git and release through the pipeline; check the pods are Ready'),
          tags: ['fix', 'verify'],
          rightFor: ['env'],
          why: { env: bi('Причину устранили там, где хранится желаемое состояние, то есть в Git, а секрет не попал в репозиторий открытым текстом.', 'The cause is fixed where the desired state lives — in Git; the secret did not land in the repository as plain text.'), oom: bi('Переменные на месте, а процесс завершает ядро из-за нехватки памяти.', 'The variables are there: the kernel kills it for memory.') },
        },
        {
          id: 'mem-fix',
          text: bi('Увеличить лимит по измерениям: на старте нужно до 90Mi, поэтому с запасом поставить, например, 128Mi в манифесте в Git, выложить и проверить', 'Raise the limit from data: the 90Mi start peak plus headroom, say 128Mi, in the manifest in Git; release and verify'),
          tags: ['fix', 'verify'],
          rightFor: ['oom'],
          why: { oom: bi('Лимит выбран по измерению, а не наугад, и изменение прошло через Git.', 'The limit comes from a measurement, not “more”, and the change went through Git.'), env: bi('Память ни при чём, не хватает переменной окружения.', 'Memory is not the issue: a variable is missing.') },
        },
      ],
    },
  ],
};

export const DRILLS: Drill[] = [DRILL_504, DRILL_DISK, DRILL_CRASHLOOP];

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
