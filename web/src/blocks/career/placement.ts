// The career diagnostic (01 §4.3, 10 §9.1). Here the level means interview
// experience, and the check only sets emphasis. Two variants for the retake.

import { bi } from '../../core/i18n';
import type { Level, PlacementTask, QuizItem } from '../../core/types';

const structure1: QuizItem = {
  id: 'career.p.structure.1',
  kind: 'order',
  prompt: bi('Расставь части ответа на «Что такое DNS?» так, как ответил бы на собеседовании.', 'Order the parts of an answer to “What is DNS?” as you would at an interview.'),
  steps: [
    { id: 'what', text: bi('Превращает имя в адрес и другие записи', 'Turns a name into an address and other records') },
    { id: 'why', text: bi('Имена стабильны, адреса меняются', 'Names are stable, addresses change') },
    { id: 'how', text: bi('Резолвер идёт от корня к авторитативному серверу и кэширует ответ на TTL', 'The resolver walks from the root to the authoritative server and caches for the TTL') },
    { id: 'when', text: bi('Проверяю `dig` через резолвер и напрямую', 'I check with `dig` through the resolver and directly') },
  ],
};

const structure2: QuizItem = {
  id: 'career.p.structure.2',
  kind: 'order',
  prompt: bi('Расставь части ответа на «Что такое жёсткая ссылка?».', 'Order the parts of an answer to “What is a hard link?”.'),
  steps: [
    { id: 'what', text: bi('Ещё одно имя того же inode', 'Another name for the same inode') },
    { id: 'why', text: bi('Имя и данные файла в Linux разделены', 'In Linux a file’s name and data are separate') },
    { id: 'how', text: bi('Данные живут, пока счётчик ссылок больше нуля или файл открыт', 'The data lives while the link count is above zero or the file is open') },
    { id: 'when', text: bi('Пользуюсь редко: чаще символическими для версий', 'I rarely use them: more often symlinks for versions') },
  ],
};

const dontKnow1: QuizItem = {
  id: 'career.p.dontknow.1',
  kind: 'mcq',
  prompt: bi('Вопрос про Nomad, с которым ты не работал. Какой ответ лучше?', 'A question about Nomad, which you have never used. Which answer is best?'),
  options: [
    { id: 'a', text: bi('«Не работал. Судя по названию задачи, это планировщик нагрузки, как Kubernetes. Выяснял бы по официальной документации, разделу архитектуры, и попробовал бы локально».', '“I haven’t used it. From the task it sounds like a workload scheduler, like Kubernetes. I’d check the official docs, the architecture section, and try it locally.”'), correct: true },
    { id: 'b', text: bi('«Nomad — это система мониторинга».', '“Nomad is a monitoring system.”'), why: bi('Выдумка: ноль по честности.', 'An invention: zero for honesty.') },
    { id: 'c', text: bi('«Не знаю».', '“I don’t know.”'), why: bi('Честно, но без рассуждения и плана, как выяснить.', 'Honest, but no reasoning and no plan to find out.') },
    { id: 'd', text: bi('«Это неважно, я быстро разберусь».', '“It doesn’t matter, I’ll figure it out fast.”'), why: bi('Уход от ответа: интервьюер не узнал ни что ты знаешь, ни как ищешь.', 'A dodge: the interviewer learns neither what you know nor how you look.') },
  ],
};

const dontKnow2: QuizItem = {
  id: 'career.p.dontknow.2',
  kind: 'mcq',
  prompt: bi('Тебя спросили про eBPF, а ты о нём только слышал. Какой ответ лучше?', 'You are asked about eBPF, which you have only heard of. Which answer is best?'),
  options: [
    { id: 'a', text: bi('«Глубоко не знаю. Знаю, что это программы, которые ядро выполняет по событиям, — на этом построены некоторые сетевые плагины Kubernetes. Начал бы с документации ядра и проекта ebpf.io».', '“Not in depth. I know these are programs the kernel runs on events — some Kubernetes network plugins are built on it. I’d start with the kernel docs and the ebpf.io project.”'), correct: true },
    { id: 'b', text: bi('«Это новая версия iptables».', '“It is a new version of iptables.”'), why: bi('Уверенная неточность: хуже честного «не знаю».', 'A confident inaccuracy: worse than an honest “I don’t know”.') },
    { id: 'c', text: bi('«Погуглю, если понадобится».', '“I’ll google it if needed.”'), why: bi('Источник не назван, связи с известным нет.', 'No source named, no link to what you know.') },
  ],
};

const cv1: QuizItem = {
  id: 'career.p.cv.1',
  kind: 'multi',
  prompt: bi('Учебное резюме бывшего менеджера по продажам. Какие строки не нужны в DevOps-версии в таком виде? Отметь все.', 'A training CV of a former sales manager. Which lines do not belong in the DevOps version as they are? Mark them all.'),
  options: [
    { id: 'kpi', text: bi('«Выполнял план продаж на 115%»', '“Achieved 115% of the sales plan”'), correct: true, why: bi('Не про эту роль: должность одной строкой, без подробностей.', 'Not about this role: the position in one line, no details.') },
    { id: 'pc', text: bi('«Уверенный пользователь ПК, стрессоустойчив»', '“Confident PC user, stress-resistant”'), correct: true, why: bi('Пустые формулировки.', 'Empty phrases.') },
    { id: 'bridge', text: bi('«Автоматизировал отчёты в Excel: с 5 часов до 40 минут в неделю»', '“Automated Excel reports: from 5 hours to 40 minutes a week”'), why: bi('Мост к DevOps: автоматизация с результатом.', 'A bridge to DevOps: automation with a result.') },
    { id: 'repo', text: bi('«Пет-проект: сайт в Docker с автодеплоем — github.com/…»', '“Pet project: a site in Docker with auto-deploy — github.com/…”'), why: bi('Подтверждение навыка — главное в резюме джуна.', 'Skill evidence is the core of a junior CV.') },
  ],
};

const cv2: QuizItem = {
  id: 'career.p.cv.2',
  kind: 'multi',
  prompt: bi('Учебное резюме специалиста поддержки. Какие строки стоит переписать или убрать? Отметь все.', 'A training CV of a support specialist. Which lines should be rewritten or removed? Mark them all.'),
  options: [
    { id: 'duty', text: bi('«Отвечал за обработку обращений»', '“Was responsible for handling tickets”'), correct: true, why: bi('Обязанность вместо действия и результата.', 'A duty instead of an action and result.') },
    { id: 'fast', text: bi('«Быстро обучаюсь»', '“Fast learner”'), correct: true, why: bi('Пустая формулировка.', 'An empty phrase.') },
    { id: 'logs', text: bi('«Локализовал проблемы по журналам и эскалировал с описанием»', '“Located problems from logs and escalated with a write-up”'), why: bi('Опыт инцидентов — плюс.', 'Incident experience is a plus.') },
    { id: 'docs', text: bi('«Написал 12 инструкций для команды из 20 человек»', '“Wrote 12 how-tos for a team of 20”'), why: bi('Документация с числами — хороший пункт.', 'Documentation with numbers is a good bullet.') },
  ],
};

const method1: QuizItem = {
  id: 'career.p.504.1',
  kind: 'order',
  prompt: bi('«Сайт отдаёт 504». Расставь шаги так, как действовал бы дежурный.', '“The site returns 504.” Order the steps as an on-call engineer would.'),
  steps: [
    { id: 'ask', text: bi('Уточнить масштаб и что менялось', 'Ask about scope and what changed') },
    { id: 'curl', text: bi('`curl -sv`: кто отвечает 504', '`curl -sv`: who answers 504') },
    { id: 'log', text: bi('Журнал ошибок прокси', 'The proxy error log') },
    { id: 'direct', text: bi('Приложение напрямую, мимо прокси', 'The application directly, bypassing the proxy') },
    { id: 'rollback', text: bi('Откатить изменение, которое вызвало сбой', 'Roll back the change that caused the failure') },
  ],
};

const method2: QuizItem = {
  id: 'career.p.504.2',
  kind: 'mcq',
  prompt: bi('В 14:05 вышел релиз, в 14:08 — новые правила межсетевого экрана; с 14:10 504. Журнал nginx: «while connecting to upstream». Что откатываешь первым?', 'A release went out at 14:05, new firewall rules at 14:08; 504s since 14:10. The nginx log: “while connecting to upstream”. What do you roll back first?'),
  options: [
    { id: 'rule', text: bi('Правила межсетевого экрана: nginx не может даже соединиться', 'The firewall rules: nginx cannot even connect'), correct: true },
    { id: 'release', text: bi('Релиз: он вышел раньше', 'The release: it came first'), why: bi('Порядок изменений не важен — важна улика: «while connecting» указывает на сеть.', 'The order of changes does not matter — the evidence does: “while connecting” points at the network.') },
    { id: 'both', text: bi('Всё сразу и перезапустить', 'Everything at once, and restart'), why: bi('Так не узнать причину, а улики пропадут.', 'That way you never learn the cause, and the evidence is lost.') },
  ],
};

const vm: QuizItem = {
  id: 'career.p.vm',
  kind: 'mcq',
  prompt: bi('Какая фраза точнее всего описывает контейнер?', 'Which sentence describes a container most precisely?'),
  options: [
    { id: 'proc', text: bi('Процесс хоста в своих пространствах имён с ограничениями cgroups; ядро общее', 'A host process in its own namespaces with cgroup limits; the kernel is shared'), correct: true },
    { id: 'lightvm', text: bi('Лёгкая виртуальная машина', 'A lightweight virtual machine'), why: bi('Своего ядра и гипервизора у контейнера нет.', 'A container has no kernel or hypervisor of its own.') },
    { id: 'image', text: bi('Образ Docker', 'A Docker image'), why: bi('Образ — файлы; контейнер — запущенный из них процесс.', 'An image is files; a container is the process started from them.') },
  ],
};

const t = (id: string, level: Level, key: boolean, item: QuizItem, concepts: string[], variant?: number): PlacementTask => ({ id, level, key, concepts, variant, kind: 'quiz', item });

export const CAREER_PLACEMENT: PlacementTask[] = (['intermediate', 'experienced'] as Level[]).flatMap((l) => [
  t(`${l}.structure.1`, l, false, { ...structure1, id: `${structure1.id}.${l}` }, ['career.answer-structure'], 1),
  t(`${l}.structure.2`, l, false, { ...structure2, id: `${structure2.id}.${l}` }, ['career.answer-structure'], 2),
  t(`${l}.dontknow.1`, l, true, { ...dontKnow1, id: `${dontKnow1.id}.${l}` }, ['career.dont-know'], 1),
  t(`${l}.dontknow.2`, l, true, { ...dontKnow2, id: `${dontKnow2.id}.${l}` }, ['career.dont-know'], 2),
  t(`${l}.cv.1`, l, false, { ...cv1, id: `${cv1.id}.${l}` }, ['career.evidence', 'career.bridge'], 1),
  t(`${l}.cv.2`, l, false, { ...cv2, id: `${cv2.id}.${l}` }, ['career.evidence', 'career.bridge'], 2),
  t(`${l}.504.1`, l, true, { ...method1, id: `${method1.id}.${l}` }, ['career.situational', 'career.mitigate-first'], 1),
  t(`${l}.504.2`, l, true, { ...method2, id: `${method2.id}.${l}` }, ['career.situational', 'career.mitigate-first'], 2),
  t(`${l}.vm`, l, false, { ...vm, id: `${vm.id}.${l}` }, ['career.q-vm-container']),
]);
