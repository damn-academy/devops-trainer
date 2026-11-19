// Situational drills (10 §9.2): "504 — what do you do?", "the disk is
// full", "a pod in CrashLoopBackOff". Each has hidden causes (variants);
// outputs are what a real server would print for that cause.

import { bi } from '../../../core/i18n';
import type { Drill, DrillOption } from '../drill-engine';

const restartAll = (why = bi('Перезапуск до сбора улик стирает их, а причину не убирает: с первой волной запросов симптом вернётся.', 'Restarting before collecting evidence destroys it and does not remove the cause: the symptom returns with the next wave of requests.')): DrillOption => ({
  id: 'restart',
  text: bi('Перезапустить всё: nginx, приложение, базу', 'Restart everything: nginx, the app, the database'),
  tags: ['destructive'],
  why,
  cmd: ['restart', 'reboot'],
});

export const DRILL_504: Drill = {
  id: 'drill.504',
  title: bi('«Сайт отдаёт 504»', '“The site returns 504”'),
  symptom: bi(
    'Тебе пишут в чат дежурных: «Магазин отдаёт 504, клиенты жалуются». Ты на сервере `web-1` (на нём nginx), приложение работает на `10.0.0.12:8000`.',
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
      prompt: bi('С чего начнёшь?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить: у всех или у одного, на каких страницах, с какого момента, что менялось', 'Ask: everyone or one user, which pages, since when, what changed'),
          tags: ['clarify'],
          good: true,
          out: {
            'slow-sql': bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, в 14:08 сетевики выкатили новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
            pool: bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, в 14:08 сетевики выкатили новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
            'drop-rule': bi('«У всех, на оформлении заказа, с 14:10. В 14:05 вышел релиз приложения, в 14:08 сетевики выкатили новые правила межсетевого экрана».', '“Everyone, on checkout, since 14:10. A release of the application went out at 14:05; at 14:08 the network team rolled out new firewall rules.”'),
          },
          why: bi('Два вопроса экономят полчаса: масштаб говорит о влиянии, а «что менялось» — о первых подозреваемых. Изменений два, и пока неясно, какое из них виновато.', 'Two questions save half an hour: the scope tells the impact, and “what changed” gives the first suspects. There are two changes, and it is not yet clear which one is to blame.'),
        },
        restartAll(),
        {
          id: 'timeout',
          text: bi('Поднять proxy_read_timeout в nginx до 300 секунд', 'Raise proxy_read_timeout in nginx to 300 seconds'),
          tags: ['hide'],
          why: bi('Это прячет симптом: вместо ошибки через 60 секунд пользователи будут ждать пять минут, а причина останется.', 'This hides the symptom: instead of an error after 60 seconds users wait five minutes, and the cause stays.'),
        },
        {
          id: 'dns',
          text: bi('Проверить DNS имени shop.example', 'Check DNS for shop.example'),
          tags: ['detour'],
          why: bi('Гипотеза без наблюдения. 504 — это ответ сервера: значит, клиент до кого-то уже дошёл по имени.', 'A hypothesis without an observation. A 504 is a server’s answer: the client already reached someone by that name.'),
          cmd: ['^dig\\b', '^nslookup\\b', '^host\\b'],
        },
      ],
    },
    {
      id: 'confirm',
      prompt: bi('Подтверди симптом снаружи и пойми, кто именно отвечает 504.', 'Confirm the symptom from outside and find out who exactly answers 504.'),
      options: [
        {
          id: 'curl',
          text: bi('Запрос с подробным выводом: `curl -sv https://shop.example/checkout`', 'A verbose request: `curl -sv https://shop.example/checkout`'),
          tags: ['evidence', 'level'],
          good: true,
          cmd: ['^curl\\b.*shop'],
          out: '* Connected to shop.example (203.0.113.10) port 443\n* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n> POST /checkout HTTP/2\n< HTTP/2 504\n< server: nginx\n< content-type: text/html',
          why: bi('Соединение, TLS и ответ прошли, а 504 Gateway Timeout подписан `server: nginx`. Значит, DNS, TCP и TLS до nginx работают: nginx не дождался того, кто стоит за ним. Уровень — L7, место — между nginx и приложением.', 'The connection, TLS and the response all went through, and the 504 Gateway Timeout is signed `server: nginx`. So DNS, TCP and TLS up to nginx work: nginx did not get an answer from whoever stands behind it. The layer is L7, the place is between nginx and the application.'),
        },
        {
          id: 'ping',
          text: bi('`ping shop.example`', '`ping shop.example`'),
          tags: ['detour'],
          cmd: ['^ping\\b'],
          out: '64 bytes from 203.0.113.10: icmp_seq=1 ttl=55 time=12.1 ms\n64 bytes from 203.0.113.10: icmp_seq=2 ttl=55 time=11.8 ms',
          why: bi('Пинг доказывает лишь, что хост отвечает на ICMP. Про HTTP, nginx и приложение он не говорит ничего.', 'A ping only proves that the host answers ICMP. It says nothing about HTTP, nginx or the application.'),
        },
        {
          id: 'dig',
          text: bi('`dig shop.example`', '`dig shop.example`'),
          tags: ['contradicts'],
          cmd: ['^dig\\b', '^nslookup\\b'],
          out: 'shop.example.\t\t300\tIN\tA\t203.0.113.10',
          why: bi('Имя разрешается, как и ожидалось: ответ 504 вообще не мог прийти, если бы клиент не нашёл сервер.', 'The name resolves, as expected: a 504 could not have arrived at all if the client had not found the server.'),
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
          why: bi('Причину nginx пишет в журнал ошибок, и последние слова строки — самые важные.', 'nginx writes the reason into the error log, and the last words of the line matter most.'),
        },
        {
          id: 'access',
          text: bi('Журнал доступа: `tail /var/log/nginx/access.log`', 'The access log: `tail /var/log/nginx/access.log`'),
          tags: ['detour'],
          cmd: ['access\\.log'],
          out: '198.51.100.7 - - [18/Nov/2026:14:12:03 +0300] "POST /checkout HTTP/2.0" 504 160 "-" "Mozilla/5.0"',
          why: bi('Журнал доступа ещё раз подтверждает 504, но причины в нём нет: она в журнале ошибок.', 'The access log confirms the 504 once more, but the reason is not there: it is in the error log.'),
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
          text: bi('nginx соединился с приложением, но не дождался ответа: приложение медленно отвечает', 'nginx connected to the application but got no answer in time: the application is slow'),
          tags: ['level'],
          rightFor: ['slow-sql', 'pool'],
          why: {
            'slow-sql': bi('«while reading response header» — соединение установлено, запрос отправлен, ответа нет: это L7, само приложение или то, чего оно ждёт.', '“while reading response header”: the connection is up and the request sent, no answer: this is L7, the application itself or what it waits for.'),
            pool: bi('«while reading response header» — соединение установлено, запрос отправлен, ответа нет: это L7, само приложение или то, чего оно ждёт.', '“while reading response header”: the connection is up and the request sent, no answer: this is L7, the application itself or what it waits for.'),
            'drop-rule': bi('В строке написано «while connecting»: до чтения ответа дело не дошло — соединение даже не установилось.', 'The line says “while connecting”: it never got to reading a response — the connection was not even established.'),
          },
        },
        {
          id: 'connecting',
          text: bi('nginx не смог даже установить соединение: что-то на пути до приложения', 'nginx could not even establish a connection: something on the path to the application'),
          tags: ['level'],
          rightFor: ['drop-rule'],
          why: {
            'drop-rule': bi('«while connecting to upstream» — TCP-соединение не установилось за время ожидания: это L4/L3, сеть или межсетевой экран между nginx и приложением.', '“while connecting to upstream”: the TCP connection was not established in time: this is L4/L3, the network or a firewall between nginx and the application.'),
            default: bi('В строке написано «while reading response header»: соединение было, nginx ждал ответа.', 'The line says “while reading response header”: there was a connection, and nginx waited for an answer.'),
          },
        },
        {
          id: 'name',
          text: bi('nginx не может разрешить имя upstream', 'nginx cannot resolve the upstream name'),
          tags: ['contradicts'],
          why: bi('В строке уже стоит адрес 10.0.0.12: имя давно разрешено.', 'The line already contains the address 10.0.0.12: the name was resolved long ago.'),
        },
      ],
    },
    {
      id: 'narrow',
      prompt: bi('Сузь гипотезу: проверь upstream мимо nginx.', 'Narrow it down: check the upstream bypassing nginx.'),
      options: [
        {
          id: 'direct',
          text: bi('Запрос к приложению напрямую с замером времени', 'A direct request to the application, timed'),
          tags: ['evidence'],
          good: true,
          cmd: ['curl.*10\\.0\\.0\\.12', 'curl.*:8000'],
          out: {
            'slow-sql': "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/checkout\n200 35.214\n$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\n200 0.009",
            pool: "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/checkout\n500 30.412\n$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\n200 0.011",
            'drop-rule': "$ curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.0.12:8000/health\ncurl: (28) Failed to connect to 10.0.0.12 port 8000 after 30001 ms: Timeout was reached",
          },
          why: {
            'slow-sql': bi('Здоровье отвечает мгновенно, оформление — 35 секунд: тормозит один обработчик, а не всё приложение.', 'Health answers instantly, checkout takes 35 seconds: one handler is slow, not the whole application.'),
            pool: bi('Здоровье отвечает мгновенно, оформление падает с 500 через 30 секунд: обработчик чего-то ждёт и сдаётся по таймауту.', 'Health answers instantly, checkout fails with 500 after 30 seconds: the handler waits for something and gives up on a timeout.'),
            'drop-rule': bi('Даже /health не соединяется: само приложение может быть живо, но пакеты до него не доходят.', 'Even /health does not connect: the application may be alive, but packets do not reach it.'),
          },
        },
        {
          id: 'ss',
          text: bi('Состояние соединений к приложению: `ss -tn dst 10.0.0.12`', 'Connection states to the application: `ss -tn dst 10.0.0.12`'),
          tags: ['evidence'],
          rightFor: ['drop-rule'],
          cmd: ['^ss\\b'],
          out: {
            'drop-rule': 'State     Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nSYN-SENT  0      1           10.0.0.11:51234     10.0.0.12:8000\nSYN-SENT  0      1           10.0.0.11:51240     10.0.0.12:8000',
            default: 'State  Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nESTAB  0      0           10.0.0.11:51234     10.0.0.12:8000\nESTAB  0      0           10.0.0.11:51240     10.0.0.12:8000',
          },
          why: {
            'drop-rule': bi('SYN-SENT: наш SYN ушёл, ответа нет. Кто-то по пути молча отбрасывает пакеты.', 'SYN-SENT: our SYN went out and nothing came back. Something on the way silently drops the packets.'),
            default: bi('Соединения установлены (ESTAB): сеть ни при чём, ждём само приложение. Ход не вредный, но ответ на вопрос «почему медленно» не здесь.', 'The connections are established (ESTAB): the network is fine, we wait for the application itself. Not harmful, but the answer to “why slow” is not here.'),
          },
        },
        {
          id: 'scale',
          text: bi('Добавить реплик приложения', 'Add more replicas of the application'),
          tags: ['hide'],
          why: bi('Гадание вместо улики. Если новые реплики ждут то же, что старые, их станет больше, а ожидание останется.', 'Guessing instead of evidence. If the new replicas wait for the same thing as the old ones, there will be more of them and the waiting stays.'),
        },
      ],
    },
    {
      id: 'cause',
      prompt: bi('Найди причину по уликам.', 'Find the cause from the evidence.'),
      options: [
        {
          id: 'applog',
          text: bi('Журнал приложения за последние минуты', 'The application log for the last minutes'),
          tags: ['evidence'],
          rightFor: ['slow-sql', 'pool'],
          cmd: ['journalctl', 'app\\.log', 'kubectl logs', 'docker logs'],
          out: {
            'slow-sql': "14:10:41 WARN  db: slow query 34.8 s: SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC\n14:10:41 INFO  db: plan: Seq Scan on orders  (rows=4120334)",
            pool: '14:10:52 ERROR sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 0 reached, connection timed out, timeout 30.00\n14:10:52 INFO  checkout: holding db session while calling payments API (avg 4.1 s)',
            'drop-rule': '-- No entries since 14:08 --',
          },
          why: {
            'slow-sql': bi('Новый запрос из релиза читает таблицу целиком (Seq Scan по четырём миллионам строк): индекса по customer_email нет.', 'The new query from the release reads the whole table (a Seq Scan over four million rows): there is no index on customer_email.'),
            pool: bi('Пул из пяти соединений исчерпан: новый код держит сессию базы, пока ждёт внешний платёжный сервис.', 'The pool of five connections is exhausted: the new code holds a database session while it waits for the external payments service.'),
            'drop-rule': bi('С 14:08 до приложения не дошёл ни один запрос: дело не в нём.', 'Since 14:08 not a single request has reached the application: it is not the culprit.'),
          },
        },
        {
          id: 'nft',
          text: bi('Правила межсетевого экрана: `nft list ruleset`', 'Firewall rules: `nft list ruleset`'),
          tags: ['evidence'],
          rightFor: ['drop-rule'],
          cmd: ['^nft\\b', 'iptables'],
          out: {
            'drop-rule': 'table inet filter {\n  chain output {\n    type filter hook output priority filter; policy accept;\n    ip daddr 10.0.0.0/24 tcp dport 8000 drop comment "netops 14:08"\n  }\n}',
            default: 'table inet filter {\n  chain output {\n    type filter hook output priority filter; policy accept;\n  }\n}',
          },
          why: {
            'drop-rule': bi('Вот причина: правило из утренней выкатки сетевиков отбрасывает всё, что идёт на порт 8000 подсети приложения.', 'Here is the cause: a rule from the network team’s rollout drops everything going to port 8000 in the application subnet.'),
            default: bi('Правил про порт 8000 нет: сеть пакеты не трогает. Изменения сетевиков ни при чём.', 'There are no rules about port 8000: the network leaves the packets alone. The network team’s change is not to blame.'),
          },
        },
      ],
    },
    {
      id: 'mitigate',
      prompt: bi('Верни сервис пользователям.', 'Give the service back to the users.'),
      options: [
        {
          id: 'rollback-release',
          text: bi('Откатить релиз 14:05', 'Roll back the 14:05 release'),
          tags: ['mitigate'],
          rightFor: ['slow-sql', 'pool'],
          out: { 'drop-rule': 'release 2026.11.18-2 → 2026.11.18-1\n5xx share: 31% → 31%', default: 'release 2026.11.18-2 → 2026.11.18-1\n5xx share: 31% → 0.4% in 3 min' },
          why: {
            'drop-rule': bi('Откатили не то, что изменилось: релиз ни при чём, пакеты к приложению всё так же отбрасывает правило.', 'You rolled back the wrong change: the release is innocent, the rule still drops packets to the application.'),
            default: bi('Откатывают то, что вызвало поломку: после отката доля ошибок вернулась к норме, теперь можно спокойно чинить.', 'You roll back the change that caused the failure: after the rollback the error share is back to normal, and the fix can be done calmly.'),
          },
        },
        {
          id: 'rollback-rule',
          text: bi('Вместе с сетевиками откатить новое правило межсетевого экрана', 'Roll back the new firewall rule together with the network team'),
          tags: ['mitigate'],
          rightFor: ['drop-rule'],
          out: { 'drop-rule': 'rule "netops 14:08" removed\n5xx share: 31% → 0.3% in 1 min', default: 'rule "netops 14:08" removed\n5xx share: 31% → 31%' },
          why: {
            'drop-rule': bi('Откатили именно то изменение, которое вызвало поломку, и сразу проверили долю ошибок.', 'You rolled back exactly the change that caused the failure and checked the error share right away.'),
            default: bi('Правило не трогало порт приложения: ошибки остались. Улики указывали на релиз.', 'The rule never touched the application port: the errors stay. The evidence pointed at the release.'),
          },
        },
        {
          id: 'hotfix',
          text: bi('Сразу чинить в проде руками: создать индекс, поднять пул, править код на сервере', 'Fix it in production by hand right away: create the index, raise the pool, edit code on the server'),
          tags: ['fix-first'],
          why: bi('Это починка, а не смягчение. Пока ты чинишь руками, пользователи ждут, а ручная правка в проде — ещё один риск. Сначала вернуть сервис, потом исправлять через конвейер.', 'This is a fix, not a mitigation. While you fix by hand users wait, and a manual change in production is one more risk. First restore the service, then fix through the pipeline.'),
        },
        restartAll(bi('Перезапуск не убирает ни медленный запрос, ни правило: через минуту всё повторится, а журналы прошлых запусков уже потеряны.', 'A restart removes neither the slow query nor the rule: in a minute it repeats, and the logs of the previous runs are gone.')),
      ],
    },
    {
      id: 'fix',
      prompt: bi('Устрани причину так, чтобы это не повторилось, и проверь результат.', 'Remove the cause so it does not happen again, and verify the result.'),
      options: [
        {
          id: 'fix-index',
          text: bi('Индекс по customer_email — миграцией через конвейер; выкатить релиз заново и проверить время ответа и долю 5xx', 'An index on customer_email as a migration through the pipeline; release again and check the response time and the 5xx share'),
          tags: ['fix', 'verify'],
          rightFor: ['slow-sql'],
          why: { 'slow-sql': bi('Причина — запрос без индекса; индекс через миграцию проверен на стенде и попадёт в историю изменений.', 'The cause is a query without an index; an index as a migration is tested on staging and stays in the change history.'), default: bi('Индекс не поможет: улики говорят о другой причине.', 'An index will not help: the evidence points to another cause.') },
        },
        {
          id: 'fix-pool',
          text: bi('Не держать сессию базы во время внешнего запроса: исправить код, добавить тест и выкатить; размер пула менять по данным нагрузки', 'Do not hold the database session during the external call: fix the code, add a test and release; change the pool size from load data'),
          tags: ['fix', 'verify'],
          rightFor: ['pool'],
          why: { pool: bi('Пул кончался не потому, что мал, а потому, что соединения не возвращались. «Побольше пул» только отложило бы ту же поломку.', 'The pool ran out not because it was small but because connections were not returned. A “bigger pool” would only postpone the same failure.'), default: bi('Пул тут ни при чём: улики говорят о другой причине.', 'The pool is not involved: the evidence points to another cause.') },
        },
        {
          id: 'fix-rule',
          text: bi('Исправить правило с сетевиками: разрешить web-1 → 10.0.0.12:8000, добавить проверку правил перед выкаткой; убедиться, что 5xx < 1%', 'Fix the rule with the network team: allow web-1 → 10.0.0.12:8000, add a rule check before rollouts; make sure 5xx < 1%'),
          tags: ['fix', 'verify'],
          rightFor: ['drop-rule'],
          why: { 'drop-rule': bi('Правило исправлено точечно, а проверка перед выкаткой поймает следующую такую ошибку до прода.', 'The rule is fixed precisely, and a check before rollouts catches the next such mistake before production.'), default: bi('Сеть тут ни при чём: улики говорят о другой причине.', 'The network is not involved: the evidence points to another cause.') },
        },
        {
          id: 'timeout2',
          text: bi('Оставить как есть, но поднять таймауты в nginx и приложении', 'Leave it as it is but raise the timeouts in nginx and the app'),
          tags: ['hide'],
          why: bi('Таймауты прячут проблему: пользователи будут ждать дольше, а следующая волна нагрузки положит сервис снова.', 'Timeouts hide the problem: users wait longer, and the next load wave brings the service down again.'),
        },
      ],
    },
  ],
};

export const DRILL_DISK: Drill = {
  id: 'drill.disk',
  title: bi('«Диск скоро заполнится»', '“The disk will fill up soon”'),
  symptom: bi('Пришёл алерт `DiskWillFillIn4Hours` на сервере `shop`.', 'An alert came in: `DiskWillFillIn4Hours` on the `shop` server.'),
  concepts: ['career.situational', 'career.mitigate-first'],
  variants: [
    { id: 'deleted-open', cause: bi('служба держит открытым удалённый журнал', 'a service holds a deleted log open') },
    { id: 'no-rotate', cause: bi('журнал приложения растёт без ротации', 'the application log grows without rotation') },
    { id: 'tmp', cause: bi('разрослись временные файлы службы', 'a service’s temporary files have piled up') },
  ],
  steps: [
    {
      id: 'clarify',
      prompt: bi('С чего начнёшь?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить: какой раздел, как быстро растёт, что работает на сервере', 'Ask: which partition, how fast it grows, what runs on the server'),
          tags: ['clarify'],
          good: true,
          out: bi('«Раздел /, растёт примерно на гигабайт в час. На сервере nginx, приложение и служба отчётов report».', '“The / partition, growing about a gigabyte an hour. The server runs nginx, the application and the report service.”'),
          why: bi('Скорость роста говорит, сколько у тебя времени, а список служб — где искать.', 'The growth rate tells you how much time you have, and the list of services where to look.'),
        },
        {
          id: 'rmlogs',
          text: bi('Сразу освободить место: `rm -rf /var/log/*`', 'Free space right away: `rm -rf /var/log/*`'),
          tags: ['destructive'],
          cmd: ['rm\\s+-rf'],
          why: bi('Удалены улики и журналы всех служб. И если место держит открытый файл, оно даже не освободится.', 'You deleted the evidence and the logs of every service. And if an open file holds the space, it will not even be freed.'),
        },
        {
          id: 'reboot',
          text: bi('Перезагрузить сервер', 'Reboot the server'),
          tags: ['destructive'],
          cmd: ['reboot'],
          why: bi('Перезагрузка как первое действие — простой без понимания причины. Через несколько часов алерт вернётся.', 'A reboot as the first action is downtime without understanding the cause. In a few hours the alert is back.'),
        },
      ],
    },
    {
      id: 'df',
      prompt: bi('Подтверди симптом: сколько места и где.', 'Confirm the symptom: how much space, and where.'),
      options: [
        {
          id: 'df',
          text: bi('`df -h`', '`df -h`'),
          tags: ['evidence', 'level'],
          good: true,
          cmd: ['^df\\b'],
          out: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        20G   19G  1.0G  95% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm',
          why: bi('Заполнен корневой раздел: 19 ГБ из 20. Теперь — что именно его занимает.', 'The root partition is full: 19 GB of 20. Now: what exactly fills it.'),
        },
        {
          id: 'free',
          text: bi('`free -h`', '`free -h`'),
          tags: ['detour'],
          cmd: ['^free\\b'],
          out: '               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       1.2Gi       1.1Gi        12Mi       1.5Gi       2.4Gi',
          why: bi('Это память, а не диск. Алерт о диске.', 'This is memory, not disk. The alert is about the disk.'),
        },
      ],
    },
    {
      id: 'du',
      prompt: bi('Найди, где место: от общего к частному.', 'Find where the space goes: from the general to the specific.'),
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
          why: bi('`-x` не уходит в другие файловые системы, а сортировка ставит самое большое в конец.', '`-x` stays on one file system, and the sort puts the biggest last.'),
        },
        {
          id: 'find-all',
          text: bi('Удалить всё, что старше недели: `find / -mtime +7 -delete`', 'Delete everything older than a week: `find / -mtime +7 -delete`'),
          tags: ['destructive'],
          cmd: ['find.*-delete'],
          why: bi('Это удалит системные файлы и данные приложения. Сначала улики, потом точечное действие.', 'This deletes system files and application data. Evidence first, then a precise action.'),
        },
      ],
    },
    {
      id: 'read',
      prompt: bi('Что показывает вывод `du` рядом с `df`?', 'What do the `du` and `df` outputs tell you together?'),
      options: [
        {
          id: 'mismatch',
          text: bi('`du` насчитал намного меньше, чем `df`: место держит удалённый, но открытый файл', '`du` counts far less than `df`: a deleted but open file holds the space'),
          tags: ['level'],
          rightFor: ['deleted-open'],
          why: { 'deleted-open': bi('`df` спрашивает файловую систему, сколько занято, а `du` суммирует видимые файлы. 19 ГБ против 7,6 ГБ — разницу держит файл без имени, который ещё открыт процессом.', '`df` asks the file system how much is used, `du` adds up the visible files. 19 GB against 7.6 GB: the difference is held by a file with no name that a process still keeps open.'), default: bi('Здесь `du` и `df` сходятся: видно конкретный большой каталог.', 'Here `du` and `df` agree: a specific big directory is visible.') },
        },
        {
          id: 'biglog',
          text: bi('Растёт журнал приложения в /var/log/app', 'The application log in /var/log/app is growing'),
          tags: ['level'],
          rightFor: ['no-rotate'],
          why: { 'no-rotate': bi('11 ГБ в /var/log/app — почти всё занятое место.', '11 GB in /var/log/app is nearly all the used space.'), default: bi('В выводе /var/log/app не самый большой каталог.', 'In the output /var/log/app is not the biggest directory.') },
        },
        {
          id: 'tmpdir',
          text: bi('Разрослись временные файлы службы report', 'The report service’s temporary files have piled up'),
          tags: ['level'],
          rightFor: ['tmp'],
          why: { tmp: bi('9,8 ГБ в /var/lib/report/tmp — это временные файлы, а не данные.', '9.8 GB in /var/lib/report/tmp are temporary files, not data.'), default: bi('В выводе каталог report/tmp не выделяется.', 'In the output the report/tmp directory does not stand out.') },
        },
        {
          id: 'inodes',
          text: bi('Кончились inode', 'The inodes ran out'),
          tags: ['contradicts'],
          why: bi('При нехватке inode `df -h` показывал бы свободное место, а здесь кончились именно байты. Проверить можно `df -i`.', 'With no inodes left `df -h` would still show free space, but here the bytes ran out. `df -i` would check it.'),
        },
      ],
    },
    {
      id: 'confirm',
      prompt: bi('Подтверди причину одной командой.', 'Confirm the cause with one command.'),
      options: [
        {
          id: 'lsof',
          text: bi('Открытые удалённые файлы: `lsof +L1`', 'Deleted files still open: `lsof +L1`'),
          tags: ['evidence'],
          rightFor: ['deleted-open'],
          cmd: ['lsof', '/proc/.*/fd'],
          out: { 'deleted-open': 'COMMAND  PID USER FD   TYPE DEVICE    SIZE/OFF NLINK  NODE NAME\nreport  1290 app   3w   REG  253,1 12884901888     0 26312 /var/log/report/report.log (deleted)', default: '(no output)' },
          why: { 'deleted-open': bi('Служба report держит открытым удалённый журнал на 12 ГБ: NLINK 0, имени нет, а место занято, пока файл открыт.', 'The report service keeps a deleted 12 GB log open: NLINK 0, no name, and the space stays used while the file is open.'), default: bi('Удалённых открытых файлов нет: место держат обычные файлы.', 'No deleted open files: ordinary files hold the space.') },
        },
        {
          id: 'lslog',
          text: bi('`ls -lh /var/log/app` и `ls /etc/logrotate.d`', '`ls -lh /var/log/app` and `ls /etc/logrotate.d`'),
          tags: ['evidence'],
          rightFor: ['no-rotate'],
          cmd: ['ls.*(/var/log/app|logrotate)'],
          out: { 'no-rotate': '-rw-r--r-- 1 app app 11G Nov 18 14:20 app.log\n$ ls /etc/logrotate.d\nnginx  rsyslog', default: '-rw-r--r-- 1 app app 40M Nov 18 14:20 app.log' },
          why: { 'no-rotate': bi('Один файл на 11 ГБ и ни одного правила ротации для приложения.', 'One 11 GB file and no rotation rule for the application.'), default: bi('Журнал приложения маленький: дело не в нём.', 'The application log is small: it is not the culprit.') },
        },
        {
          id: 'lstmp',
          text: bi('`ls /var/lib/report/tmp | wc -l` и самые старые файлы', '`ls /var/lib/report/tmp | wc -l` and the oldest files'),
          tags: ['evidence'],
          rightFor: ['tmp'],
          cmd: ['report/tmp'],
          out: { tmp: '48211\n$ ls -ltr /var/lib/report/tmp | head -2\n-rw-r--r-- 1 app app 210K Sep  2 03:00 render-0001.tmp', default: '12' },
          why: { tmp: bi('Почти 50 тысяч временных файлов с сентября: служба не убирает за собой.', 'Almost 50 thousand temporary files since September: the service does not clean up after itself.'), default: bi('Временных файлов немного: дело не в них.', 'There are few temporary files: they are not the culprit.') },
        },
      ],
    },
    {
      id: 'free',
      prompt: bi('Освободи место безопасно.', 'Free the space safely.'),
      options: [
        {
          id: 'reopen',
          text: bi('Заставить report заново открыть журнал: перезапустить службу в спокойный момент или послать ей сигнал переоткрытия журналов', 'Make report reopen its log: restart the service at a quiet moment or send it its log-reopen signal'),
          tags: ['mitigate'],
          rightFor: ['deleted-open'],
          why: { 'deleted-open': bi('Место вернётся, только когда процесс закроет файл. Теперь перезапуск — осознанное действие по улике, а не гадание.', 'The space comes back only when the process closes the file. Now a restart is a deliberate action based on evidence, not a guess.'), default: bi('Перезапуск ничего не освободит: место занимают обычные файлы.', 'A restart frees nothing: ordinary files take the space.') },
        },
        {
          id: 'truncate',
          text: bi('Сохранить хвост журнала в улики и обнулить файл: `truncate -s 0 /var/log/app/app.log`', 'Keep the tail of the log as evidence and truncate the file: `truncate -s 0 /var/log/app/app.log`'),
          tags: ['mitigate'],
          rightFor: ['no-rotate'],
          cmd: ['truncate'],
          why: { 'no-rotate': bi('`truncate` освобождает место сразу, даже если приложение держит файл открытым, — в отличие от `rm`.', '`truncate` frees the space at once even while the application keeps the file open — unlike `rm`.'), default: bi('Журнал приложения не виноват: место это не вернёт.', 'The application log is not the culprit: this does not bring the space back.') },
        },
        {
          id: 'cleantmp',
          text: bi('Удалить временные файлы службы старше суток: `find /var/lib/report/tmp -mtime +1 -delete`', 'Delete the service’s temporary files older than a day: `find /var/lib/report/tmp -mtime +1 -delete`'),
          tags: ['mitigate'],
          rightFor: ['tmp'],
          why: { tmp: bi('Удаляются только временные файлы одной службы и только старые — данные не тронуты.', 'Only one service’s temporary files, and only old ones, are removed — the data is untouched.'), default: bi('Временные файлы не виноваты: место это не вернёт.', 'The temporary files are not the culprit: this does not bring the space back.') },
        },
        {
          id: 'rmdata',
          text: bi('Удалить /var/lib/report/data — там много места', 'Delete /var/lib/report/data — there is a lot of space there'),
          tags: ['destructive'],
          why: bi('Это данные приложения. Свободное место ценой данных — авария похуже исходной.', 'This is the application’s data. Free space at the price of data is a worse incident than the original one.'),
        },
      ],
    },
    {
      id: 'prevent',
      prompt: bi('Сделай так, чтобы это не повторилось.', 'Make sure it does not happen again.'),
      options: [
        {
          id: 'logrotate',
          text: bi('Правило logrotate для журнала (с переоткрытием в postrotate или copytruncate) и проверка, что алерт остаётся', 'A logrotate rule for the log (with a reopen in postrotate or copytruncate), and keep the alert'),
          tags: ['fix', 'verify'],
          rightFor: ['deleted-open', 'no-rotate'],
          why: { default: bi('Ротация с переоткрытием не даёт журналу ни расти бесконечно, ни застревать удалённым.', 'Rotation with a reopen keeps the log from growing forever or getting stuck as a deleted file.'), tmp: bi('Журналы тут ни при чём: копятся временные файлы.', 'Logs are not the problem here: temporary files pile up.') },
        },
        {
          id: 'tmpfiles',
          text: bi('Правило systemd-tmpfiles для каталога (или уборка в самой службе) и алерт на рост', 'A systemd-tmpfiles rule for the directory (or cleanup in the service itself) and an alert on growth'),
          tags: ['fix', 'verify'],
          rightFor: ['tmp'],
          why: { tmp: bi('Временные файлы будут удаляться по возрасту автоматически.', 'Temporary files will be removed by age automatically.'), default: bi('Временные файлы тут ни при чём.', 'Temporary files are not the problem here.') },
        },
        {
          id: 'bigger',
          text: bi('Увеличить диск вдвое', 'Double the disk size'),
          tags: ['hide'],
          why: bi('Это отложит алерт, но не остановит рост: через пару суток всё повторится на большем диске.', 'This postpones the alert but does not stop the growth: in a couple of days it repeats on a bigger disk.'),
        },
      ],
    },
  ],
};

export const DRILL_CRASHLOOP: Drill = {
  id: 'drill.crashloop',
  title: bi('«Под в CrashLoopBackOff»', '“A pod in CrashLoopBackOff”'),
  symptom: bi('После выкладки новая версия сервиса `api` не принимает трафик. В кластере у тебя есть `kubectl` с правами на namespace `shop`.', 'After a release the new version of the `api` service does not take traffic. You have `kubectl` with rights to the `shop` namespace.'),
  concepts: ['career.situational', 'career.mitigate-first'],
  variants: [
    { id: 'env', cause: bi('в новой версии нужна переменная окружения, которой нет в манифесте', 'the new version needs an environment variable that is missing from the manifest') },
    { id: 'oom', cause: bi('новой версии на старте нужно больше памяти, чем разрешает лимит', 'the new version needs more memory at start than the limit allows') },
  ],
  steps: [
    {
      id: 'clarify',
      prompt: bi('С чего начнёшь?', 'Where do you start?'),
      options: [
        {
          id: 'ask',
          text: bi('Уточнить: что и когда выкатывали, все ли реплики новой версии падают', 'Ask: what was released and when, whether every replica of the new version fails'),
          tags: ['clarify'],
          good: true,
          out: bi('«В 14:05 выкатили новую версию api через Argo CD. Падают все новые поды».', '“A new version of api was released through Argo CD at 14:05. Every new pod fails.”'),
          why: bi('Падают все новые — значит, дело в версии или её настройках, а не в одном узле.', 'All new pods fail: the cause is the version or its settings, not a single node.'),
        },
        {
          id: 'delete',
          text: bi('Удалить упавшие поды, чтобы они пересоздались', 'Delete the failing pods so they are recreated'),
          tags: ['destructive'],
          cmd: ['kubectl delete'],
          why: bi('Новые поды упадут так же, а журналы прошлого запуска (`--previous`) пропадут вместе со старыми.', 'The new pods crash the same way, and the logs of the previous run (`--previous`) disappear with the old ones.'),
        },
        {
          id: 'scale',
          text: bi('Увеличить число реплик', 'Increase the number of replicas'),
          tags: ['hide'],
          cmd: ['kubectl scale'],
          why: bi('Больше реплик той же версии — больше одинаково падающих подов.', 'More replicas of the same version means more pods crashing the same way.'),
        },
      ],
    },
    {
      id: 'get',
      prompt: bi('Посмотри состояние подов.', 'Look at the state of the pods.'),
      options: [
        {
          id: 'get',
          text: bi('`kubectl get pods -n shop`', '`kubectl get pods -n shop`'),
          tags: ['evidence'],
          good: true,
          cmd: ['kubectl get po'],
          out: 'NAME                   READY   STATUS             RESTARTS      AGE\napi-7c9d8f6b5-2xkqp    0/1     CrashLoopBackOff   6 (40s ago)   7m\napi-7c9d8f6b5-9jv4n    0/1     CrashLoopBackOff   6 (35s ago)   7m',
          why: bi('Контейнер стартует, падает, и kubelet перезапускает его со всё большей паузой — это и есть CrashLoopBackOff.', 'The container starts, crashes, and the kubelet restarts it with a growing pause: that is CrashLoopBackOff.'),
        },
      ],
    },
    {
      id: 'describe',
      prompt: bi('Узнай, как завершился прошлый запуск.', 'Find out how the last run ended.'),
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
          why: bi('Поле Last State говорит, почему контейнер завершился в прошлый раз: сам или его убили.', 'The Last State field tells why the container ended last time: on its own, or killed.'),
        },
      ],
    },
    {
      id: 'read',
      prompt: bi('Что значит причина завершения?', 'What does the termination reason mean?'),
      options: [
        {
          id: 'app',
          text: bi('Приложение само завершилось с ошибкой', 'The application exited with an error on its own'),
          tags: ['level'],
          rightFor: ['env'],
          why: { env: bi('Reason: Error, Exit Code 1 — процесс вышел сам. Ответ, почему, — в его журнале.', 'Reason: Error, Exit Code 1: the process exited by itself. Why is in its log.'), oom: bi('OOMKilled и код 137 = 128 + 9: процесс не выходил сам, его убили сигналом KILL.', 'OOMKilled and code 137 = 128 + 9: the process did not exit, it was killed with signal KILL.') },
        },
        {
          id: 'oomkill',
          text: bi('Ядро убило контейнер за превышение лимита памяти', 'The kernel killed the container for exceeding its memory limit'),
          tags: ['level'],
          rightFor: ['oom'],
          why: { oom: bi('OOMKilled, код 137 = 128 + 9 (SIGKILL), лимит 64Mi: память кончилась раньше, чем приложение запустилось.', 'OOMKilled, code 137 = 128 + 9 (SIGKILL), a 64Mi limit: memory ran out before the application finished starting.'), env: bi('Reason: Error и код 1 — процесс вышел сам; при нехватке памяти было бы OOMKilled.', 'Reason: Error and code 1: the process exited by itself; out of memory would say OOMKilled.') },
        },
        {
          id: 'image',
          text: bi('Не скачался образ', 'The image could not be pulled'),
          tags: ['contradicts'],
          why: bi('Тогда статус был бы ImagePullBackOff, а у контейнера не было бы ни одного запуска.', 'Then the status would be ImagePullBackOff, and the container would have no runs at all.'),
        },
      ],
    },
    {
      id: 'evidence',
      prompt: bi('Собери улику, которая назовёт причину.', 'Collect the evidence that names the cause.'),
      options: [
        {
          id: 'previous',
          text: bi('Журнал прошлого запуска: `kubectl logs api-7c9d8f6b5-2xkqp -n shop --previous`', 'The log of the previous run: `kubectl logs api-7c9d8f6b5-2xkqp -n shop --previous`'),
          tags: ['evidence'],
          rightFor: ['env'],
          cmd: ['logs.*(-p\\b|--previous)'],
          out: { env: 'Traceback (most recent call last):\n  File "/app/main.py", line 12, in <module>\n    DB = os.environ["DATABASE_URL"]\nKeyError: \'DATABASE_URL\'', oom: 'starting api 2.4.0\nloading catalog cache (90 MiB)…' },
          why: { env: bi('Новой версии нужна переменная DATABASE_URL, а в манифесте её нет.', 'The new version needs a DATABASE_URL variable that the manifest does not have.'), oom: bi('Журнал обрывается на загрузке кэша на 90 МиБ при лимите 64Mi — ядро убило процесс посреди загрузки.', 'The log stops while loading a 90 MiB cache under a 64Mi limit: the kernel killed the process mid-load.') },
        },
        {
          id: 'limits',
          text: bi('Сравнить лимит памяти с тем, сколько нужно на старте (журнал прошлого запуска, `kubectl top`)', 'Compare the memory limit with what the start needs (the previous log, `kubectl top`)'),
          tags: ['evidence'],
          rightFor: ['oom'],
          cmd: ['kubectl top'],
          out: { oom: 'NAME                  CPU(cores)   MEMORY(bytes)\napi-7c9d8f6b5-2xkqp   120m         63Mi', default: 'NAME                  CPU(cores)   MEMORY(bytes)\napi-7c9d8f6b5-2xkqp   2m           18Mi' },
          why: { oom: bi('Под упирается в 64Mi и умирает: лимит меньше, чем приложению нужно на старте.', 'The pod hits 64Mi and dies: the limit is lower than the application needs to start.'), env: bi('Памяти хватает с запасом: дело не в лимите.', 'There is plenty of memory: the limit is not the cause.') },
        },
        {
          id: 'logsnow',
          text: bi('`kubectl logs api-7c9d8f6b5-2xkqp -n shop` без флагов', '`kubectl logs api-7c9d8f6b5-2xkqp -n shop` without flags'),
          tags: ['detour'],
          cmd: ['^kubectl logs(?!.*(-p\\b|--previous))'],
          out: 'Error from server (BadRequest): container "api" in pod "api-7c9d8f6b5-2xkqp" is waiting to start: CrashLoopBackOff',
          why: bi('Текущий запуск ещё не начался; журнал упавшего — с флагом `--previous`.', 'The current run has not started yet; the crashed one’s log needs `--previous`.'),
        },
      ],
    },
    {
      id: 'mitigate',
      prompt: bi('Верни сервис.', 'Restore the service.'),
      options: [
        {
          id: 'undo',
          text: bi('Откатить выкладку: вернуть прошлую ревизию в Git (или `kubectl rollout undo`, если GitOps нет)', 'Roll back the release: revert to the previous revision in Git (or `kubectl rollout undo` without GitOps)'),
          tags: ['mitigate'],
          good: true,
          cmd: ['rollout undo', 'git revert'],
          out: 'deployment.apps/api rolled back\napi-5b8f7d9c4-k2m1x   1/1   Running   0   20s',
          why: bi('Прошлая версия работала: откат возвращает сервис за минуту, а причину можно чинить без спешки.', 'The previous version worked: a rollback restores the service in a minute, and the cause can be fixed without a rush.'),
        },
        {
          id: 'nolimit',
          text: bi('Снять лимит памяти совсем', 'Remove the memory limit entirely'),
          tags: ['hide'],
          why: bi('Под без лимита может съесть память узла и уронить соседей. Лимит задают по данным, а не убирают.', 'A pod without a limit can eat the node’s memory and take its neighbours down. A limit is set from data, not removed.'),
        },
        {
          id: 'edit',
          text: bi('Поправить Deployment руками: `kubectl edit`', 'Edit the Deployment by hand: `kubectl edit`'),
          tags: ['fix-first'],
          cmd: ['kubectl edit'],
          why: bi('Выкладка идёт через Argo CD из Git: ручная правка откатится при следующей синхронизации или разойдётся с Git. Сначала откат, потом исправление в Git.', 'Releases go through Argo CD from Git: a manual edit is reverted on the next sync or drifts from Git. Roll back first, then fix it in Git.'),
        },
      ],
    },
    {
      id: 'fix',
      prompt: bi('Исправь причину и выкати заново.', 'Fix the cause and release again.'),
      options: [
        {
          id: 'env-fix',
          text: bi('Добавить DATABASE_URL из Secret в манифест в Git и выкатить через конвейер; проверить, что поды Ready', 'Add DATABASE_URL from a Secret to the manifest in Git and release through the pipeline; check the pods are Ready'),
          tags: ['fix', 'verify'],
          rightFor: ['env'],
          why: { env: bi('Причина устранена там, где живёт желаемое состояние, — в Git; секрет не попал в репозиторий открытым текстом.', 'The cause is fixed where the desired state lives — in Git; the secret did not land in the repository as plain text.'), oom: bi('Переменные на месте: убивает ядро за память.', 'The variables are there: the kernel kills it for memory.') },
        },
        {
          id: 'mem-fix',
          text: bi('Поднять лимит по данным: пик на старте 90Mi плюс запас, например 128Mi, — в манифесте в Git; выкатить и проверить', 'Raise the limit from data: the 90Mi start peak plus headroom, say 128Mi, in the manifest in Git; release and verify'),
          tags: ['fix', 'verify'],
          rightFor: ['oom'],
          why: { oom: bi('Лимит выбран по измерению, а не «побольше», и изменение прошло через Git.', 'The limit comes from a measurement, not “more”, and the change went through Git.'), env: bi('Память ни при чём: не хватает переменной.', 'Memory is not the issue: a variable is missing.') },
        },
      ],
    },
  ],
};

export const DRILLS: Drill[] = [DRILL_504, DRILL_DISK, DRILL_CRASHLOOP];

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
