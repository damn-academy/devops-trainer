// The career diagnostic (01 §4.3, 10 §9.1). Owner decision: the interview
// check is one for everyone — we are all entering DevOps, so there are no
// separate interview levels. Two variants stay for the retake.

import { bi } from '../../core/i18n';
import type { PlacementTask, QuizItem } from '../../core/types';
import { orderAsMatch } from './order-fallback';

const structure1: QuizItem = {
  id: 'career.p.structure.1',
  kind: 'order',
  prompt: bi('Расставьте части ответа на вопрос «Что такое DNS?» в том порядке, в каком вы ответили бы на собеседовании.', 'Order the parts of an answer to “What is DNS?” as you would at an interview.'),
  steps: [
    { id: 'what', text: bi('DNS превращает имя в адрес и хранит другие записи', 'Turns a name into an address and other records') },
    { id: 'why', text: bi('Имена остаются прежними, а адреса меняются', 'Names are stable, addresses change') },
    { id: 'how', text: bi('Резолвер проходит от корневых серверов к серверу зоны и запоминает ответ на время TTL', 'The resolver walks from the root to the authoritative server and caches for the TTL') },
    { id: 'when', text: bi('Проверяю командой `dig` через резолвер и напрямую у сервера зоны', 'I check with `dig` through the resolver and directly') },
  ],
};

const structure2: QuizItem = {
  id: 'career.p.structure.2',
  kind: 'order',
  prompt: bi('Расставьте части ответа на вопрос «Что такое жёсткая ссылка?».', 'Order the parts of an answer to “What is a hard link?”.'),
  steps: [
    { id: 'what', text: bi('Жёсткая ссылка даёт тому же inode ещё одно имя', 'A hard link gives the same inode one more name') },
    { id: 'why', text: bi('В Linux имя файла и его данные хранятся отдельно', 'In Linux a file’s name and data are separate') },
    { id: 'how', text: bi('Данные хранятся, пока счётчик ссылок больше нуля или файл кем-то открыт', 'The data lives while the link count is above zero or the file is open') },
    { id: 'when', text: bi('Пользуюсь ими редко, а для версий чаще беру символические ссылки', 'I rarely use them: more often symlinks for versions') },
  ],
};

const dontKnow1: QuizItem = {
  id: 'career.p.dontknow.1',
  kind: 'mcq',
  prompt: bi('Вас спрашивают о Nomad, с которым вы не работали. Какой ответ лучше?', 'A question about Nomad, which you have never used. Which answer is best?'),
  options: [
    { id: 'a', text: bi('«Не работал. Судя по задаче, это планировщик, который распределяет нагрузку по машинам, как Kubernetes. Выяснял бы по официальной документации, по разделу об архитектуре, и попробовал бы запустить у себя».', '“I haven’t used it. From the task it sounds like a workload scheduler, like Kubernetes. I’d check the official docs, the architecture section, and try it locally.”'), correct: true },
    { id: 'b', text: bi('«Nomad — это система мониторинга».', '“Nomad is a monitoring system.”'), why: bi('Это выдумка, и за неё ставят ноль по честности.', 'An invention: zero for honesty.') },
    { id: 'c', text: bi('«Не знаю».', '“I don’t know.”'), why: bi('Ответ честный, но в нём нет ни рассуждения, ни плана, как выяснить ответ.', 'Honest, but no reasoning and no plan to find out.') },
    { id: 'd', text: bi('«Это неважно, я быстро разберусь».', '“It doesn’t matter, I’ll figure it out fast.”'), why: bi('Это уход от ответа, после которого интервьюер не узнал ни того, что вы знаете, ни того, как вы ищете.', 'This is a dodge, after which the interviewer has learned neither what you know nor how you look things up.') },
  ],
};

const dontKnow2: QuizItem = {
  id: 'career.p.dontknow.2',
  kind: 'mcq',
  prompt: bi('Вас спросили о eBPF, а вы о нём только слышали. Какой ответ лучше?', 'You are asked about eBPF, which you have only heard of. Which answer is best?'),
  options: [
    { id: 'a', text: bi('«Глубоко не знаю. Знаю, что это программы, которые ядро выполняет при определённых событиях, и что на них построены некоторые сетевые плагины Kubernetes. Начал бы с документации ядра и сайта проекта ebpf.io».', '“Not in depth. I know these are programs the kernel runs on events — some Kubernetes network plugins are built on it. I’d start with the kernel docs and the ebpf.io project.”'), correct: true },
    { id: 'b', text: bi('«Это новая версия iptables».', '“It is a new version of iptables.”'), why: bi('Это уверенная неточность, и она хуже честного «не знаю».', 'A confident inaccuracy: worse than an honest “I don’t know”.') },
    { id: 'c', text: bi('«Погуглю, если понадобится».', '“I’ll google it if needed.”'), why: bi('Источник не назван, и вопрос не связан с тем, что вы знаете.', 'No source named, no link to what you know.') },
  ],
};

const cv1: QuizItem = {
  id: 'career.p.cv.1',
  kind: 'multi',
  prompt: bi('Учебное резюме бывшего менеджера по продажам. Какие строки не нужны в DevOps-версии в таком виде? Отметьте все.', 'A training CV of a former sales manager. Which lines do not belong in the DevOps version as they are? Mark them all.'),
  options: [
    { id: 'kpi', text: bi('«Выполнял план продаж на 115%»', '“Achieved 115% of the sales plan”'), correct: true, why: bi('Это достижение не относится к новой роли, поэтому оставьте должность одной строкой, без подробностей.', 'This achievement has nothing to do with the new role, so leave the position as one line without details.') },
    { id: 'pc', text: bi('«Уверенный пользователь ПК, стрессоустойчив»', '“Confident PC user, stress-resistant”'), correct: true, why: bi('Это пустые формулировки, и проверить их нельзя.', 'Empty phrases.') },
    { id: 'bridge', text: bi('«Автоматизировал отчёты в Excel и сократил работу над ними с 5 часов до 40 минут в неделю»', '“Automated Excel reports and cut the work on them from 5 hours to 40 minutes a week”'), why: bi('Эта строка перекидывает мост к DevOps, потому что описывает автоматизацию с измеримым результатом.', 'This line builds a bridge to DevOps, because it describes automation with a measurable result.') },
    { id: 'repo', text: bi('«Пет-проект: сайт в Docker с автоматической выкладкой, github.com/…»', '“Pet project: a site in Docker with automatic releases, github.com/…”'), why: bi('Подтверждение навыка важнее всего в резюме начинающего инженера.', 'Skill evidence is the core of a junior CV.') },
  ],
};

const cv2: QuizItem = {
  id: 'career.p.cv.2',
  kind: 'multi',
  prompt: bi('Учебное резюме специалиста поддержки. Какие строки стоит переписать или убрать? Отметьте все.', 'A training CV of a support specialist. Which lines should be rewritten or removed? Mark them all.'),
  options: [
    { id: 'duty', text: bi('«Отвечал за обработку обращений»', '“Was responsible for handling tickets”'), correct: true, why: bi('Здесь описана обязанность, а не действие и его результат.', 'A duty instead of an action and result.') },
    { id: 'fast', text: bi('«Быстро обучаюсь»', '“Fast learner”'), correct: true, why: bi('Это пустая формулировка, и проверить её нельзя.', 'An empty phrase.') },
    { id: 'logs', text: bi('«Находил причину проблем по журналам и передавал инженерам с описанием»', '“Located problems from logs and escalated with a write-up”'), why: bi('Опыт разбора инцидентов пригодится в DevOps.', 'Incident experience is a plus.') },
    { id: 'docs', text: bi('«Написал 12 инструкций для команды из 20 человек»', '“Wrote 12 how-tos for a team of 20”'), why: bi('Пункт о документации с числами хорошо показывает результат.', 'Documentation with numbers is a good bullet.') },
  ],
};


const method1: QuizItem = {
  id: 'career.p.504.1',
  kind: 'order',
  prompt: bi('Сайт отвечает ошибкой 504. Расставьте шаги в том порядке, в каком действовал бы дежурный.', '“The site returns 504.” Order the steps as an on-call engineer would.'),
  steps: [
    { id: 'ask', text: bi('Уточнить, насколько широк сбой и что перед ним менялось', 'Ask how wide the failure is and what changed before it') },
    { id: 'curl', text: bi('Выяснить командой `curl -sv`, кто отвечает ошибкой 504', 'Find out with `curl -sv` who answers 504') },
    { id: 'log', text: bi('Прочитать журнал ошибок прокси', 'Read the proxy error log') },
    { id: 'direct', text: bi('Проверить приложение напрямую, мимо прокси', 'Check the application directly, bypassing the proxy') },
    { id: 'rollback', text: bi('Откатить изменение, которое вызвало сбой', 'Roll back the change that caused the failure') },
  ],
};

const method2: QuizItem = {
  id: 'career.p.504.2',
  kind: 'mcq',
  prompt: bi('В 14:05 выложили новую версию приложения, в 14:08 ввели новые правила межсетевого экрана, а с 14:10 сайт отвечает ошибкой 504. В журнале ошибок nginx строка кончается словами «while connecting to upstream». Что вы откатите первым?', 'A release went out at 14:05, new firewall rules at 14:08; 504s since 14:10. The nginx log: “while connecting to upstream”. What do you roll back first?'),
  options: [
    { id: 'rule', text: bi('Правила межсетевого экрана, потому что nginx даже не соединяется с приложением', 'The firewall rules: nginx cannot even connect'), correct: true },
    { id: 'release', text: bi('Новую версию приложения, потому что её выложили раньше, чем правила межсетевого экрана', 'The release, because it went out earlier than the firewall rules'), why: bi('Решает не порядок изменений, а улика, и слова «while connecting» в журнале указывают на сеть.', 'What decides is not the order of the changes but the evidence, and the words “while connecting” in the log point at the network.') },
    { id: 'both', text: bi('Откатить всё сразу, и версию, и правила экрана, а потом перезапустить все службы', 'Roll back everything at once, both the release and the rules, then restart every service'), why: bi('Так вы не узнаете причину, а улики пропадут.', 'That way you never learn the cause, and the evidence is lost.') },
  ],
};

const vm: QuizItem = {
  id: 'career.p.vm',
  kind: 'mcq',
  prompt: bi('Какая фраза точнее всего описывает контейнер?', 'Which sentence describes a container most precisely?'),
  options: [
    { id: 'proc', text: bi('Процесс хоста в собственных пространствах имён, ресурсы которого ограничены cgroups, а ядро общее с хостом', 'A host process in its own namespaces with cgroup limits; the kernel is shared'), correct: true },
    { id: 'lightvm', text: bi('Лёгкая виртуальная машина со своим урезанным ядром, которая загружается быстрее обычной, потому что у неё гипервизор попроще', 'A lightweight virtual machine with its own trimmed-down kernel that boots faster than a normal one'), why: bi('У контейнера нет ни своего ядра, ни гипервизора.', 'A container has no kernel or hypervisor of its own.') },
    { id: 'image', text: bi('Образ Docker', 'A Docker image'), why: bi('Образ состоит из файлов, а контейнер работает как процесс, запущенный из этих файлов.', 'An image consists of files, and a container runs as a process started from those files.') },
  ],
};

const L = 'intermediate' as const;
const t = (id: string, key: boolean, item: QuizItem, concepts: string[], variant?: number): PlacementTask => ({ id, level: L, key, concepts, variant, kind: 'quiz', item: orderAsMatch(item) });

export const CAREER_PLACEMENT: PlacementTask[] = [
  t(`${L}.structure.1`, false, { ...structure1, id: `${structure1.id}.${L}` }, ['career.answer-structure'], 1),
  t(`${L}.structure.2`, false, { ...structure2, id: `${structure2.id}.${L}` }, ['career.answer-structure'], 2),
  t(`${L}.dontknow.1`, true, { ...dontKnow1, id: `${dontKnow1.id}.${L}` }, ['career.dont-know'], 1),
  t(`${L}.dontknow.2`, true, { ...dontKnow2, id: `${dontKnow2.id}.${L}` }, ['career.dont-know'], 2),
  t(`${L}.cv.1`, false, { ...cv1, id: `${cv1.id}.${L}` }, ['career.evidence', 'career.bridge'], 1),
  t(`${L}.cv.2`, false, { ...cv2, id: `${cv2.id}.${L}` }, ['career.evidence', 'career.bridge'], 2),
  t(`${L}.504.1`, true, { ...method1, id: `${method1.id}.${L}` }, ['career.situational', 'career.mitigate-first'], 1),
  t(`${L}.504.2`, true, { ...method2, id: `${method2.id}.${L}` }, ['career.situational', 'career.mitigate-first'], 2),
  t(`${L}.vm`, false, { ...vm, id: `${vm.id}.${L}` }, ['career.q-vm-container']),
];
