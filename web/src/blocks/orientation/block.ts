// The Orientation block (route id `orient`, 01 §3.4): route data, what each
// level means here, and the three-question check that lets Intermediate and
// Experienced learners mark F01–F12 as placed (01 §2.3).

import { bi } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Block, PlacementTask } from '../../core/types';
import { EN, RU } from './shared';

const route = ROUTE.find((r) => r.id === 'orient')!;

const MACHINE = ['orient.computer', 'orient.program', 'orient.os', 'orient.file', 'orient.command'];
const NET = ['orient.network', 'orient.internet', 'orient.server', 'orient.client-request', 'orient.cloud'];
const CODE = ['orient.source-build', 'orient.version', 'orient.environments', 'orient.config', 'orient.collaboration', 'orient.roles'];

const placement: PlacementTask[] = [
  {
    id: 'orient.place.machine',
    level: 'intermediate',
    key: true,
    concepts: MACHINE,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.machine',
      kind: 'multi',
      prompt: bi('Что из этого верно?', 'Which of these are true?'),
      options: [
        { id: 'ram', text: bi('Несохранённый текст живёт в памяти и пропадает при выключении', 'Unsaved text lives in memory and is lost at power-off'), correct: true },
        { id: 'os', text: bi('Программы обращаются к диску через операционную систему', 'Programs reach the disk through the operating system'), correct: true },
        { id: 'first', text: bi('В строке `ls -l notes` первое слово — что сделать, остальные — с чем и как', 'In the line `ls -l notes` the first word is what to do, the rest with what and how'), correct: true },
        { id: 'icon', text: bi('Значок на рабочем столе и есть сама программа', 'The icon on the desktop is the program itself'), why: bi('Значок — ярлык, программа — файл на диске.', 'The icon is a shortcut; the program is a file on the disk.') },
      ],
    },
  },
  {
    id: 'orient.place.net',
    level: 'intermediate',
    key: true,
    concepts: NET,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.net',
      kind: 'mcq',
      prompt: bi('Машина магазина включена, но программа на ней остановлена. Что получит браузер покупателя?', 'The shop’s machine is on, but the program on it is stopped. What does the shopper’s browser get?'),
      options: [
        { id: 'refused', text: bi('Сразу отказ в соединении', 'An immediate connection refusal'), correct: true },
        { id: 'timeout', text: bi('Долгое ожидание и «время вышло»', 'A long wait and “timed out”'), why: bi('Так бывает, когда сообщение не доходит. Здесь машина отвечает, просто никто не слушает.', 'That happens when the message does not arrive. Here the machine answers; nobody is listening.') },
        { id: 'page', text: bi('Последнюю сохранённую страницу', 'The last saved page'), why: bi('Отвечать некому: без программы сервер страниц не отдаёт.', 'There is nobody to answer: without the program the server hands out no pages.') },
      ],
    },
  },
  {
    id: 'orient.place.code',
    level: 'intermediate',
    key: true,
    concepts: CODE,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.code',
      kind: 'mcq',
      prompt: bi('Программа версии 1.4.2 прошла тестовый стенд. Что должно уехать на прод?', 'Version 1.4.2 of a program passed the test stand. What should go to production?'),
      options: [
        { id: 'same', text: bi('Та же сборка 1.4.2 и файл настроек прода рядом с ней', 'The same 1.4.2 build with the production settings file next to it'), correct: true },
        { id: 'rebuild', text: bi('Новая сборка с настройками прода внутри', 'A new build with the production settings inside'), why: bi('Тогда на прод поедет программа, которую на стенде не проверяли.', 'Then production gets a program the stand never checked.') },
        { id: 'latest', text: bi('Самая свежая копия из общей ветки, какой бы она ни была', 'The freshest copy from the shared branch, whatever it is'), why: bi('Свежая копия могла получить новые правки, которых стенд не видел.', 'The freshest copy may have new edits the stand never saw.') },
      ],
    },
  },
  {
    id: 'orient.place.exp.files',
    level: 'experienced',
    key: true,
    concepts: MACHINE,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.exp.files',
      kind: 'fill-command',
      prompt: bi('Одной строкой запишите в файл `~/notes/plan.txt` слово `ready`.', 'In one line write the word `ready` into the file `~/notes/plan.txt`.'),
      setup: { hostname: 'trainer', files: [{ path: '~/notes/todo.txt', content: 'x\n' }] },
      check: { when: "files['/home/learner/notes/plan.txt'].text~'ready'" },
    },
  },
  {
    id: 'orient.place.exp.load',
    level: 'experienced',
    key: true,
    concepts: NET,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.exp.load',
      kind: 'mcq',
      prompt: bi('Сервер отвечает на 200 запросов в секунду. Загрузка выросла с 50% до 95%. Что с ожиданием в очереди?', 'A server answers 200 requests a second. The load rose from 50% to 95%. What about the queue wait?'),
      options: [
        { id: 'many', text: bi('Выросло примерно в двадцать раз', 'It grew about twentyfold'), correct: true, why: bi('Ожидание растёт как ρ/(1−ρ): 1 при 50% и 19 при 95%.', 'The wait grows as ρ/(1−ρ): 1 at 50% and 19 at 95%.') },
        { id: 'twice', text: bi('Почти удвоилось, как и загрузка', 'Almost doubled, like the load'), why: bi('Очередь растёт нелинейно: чем ближе к 100%, тем круче.', 'A queue grows non-linearly: the closer to 100%, the steeper.') },
        { id: 'same', text: bi('Не изменилось, пока загрузка ниже 100%', 'Unchanged while the load is under 100%'), why: bi('Задолго до 100% запросы начинают ждать друг друга.', 'Long before 100% requests start waiting for each other.') },
      ],
    },
  },
  {
    id: 'orient.place.exp.semver',
    level: 'experienced',
    key: true,
    concepts: CODE,
    kind: 'quiz',
    item: {
      id: 'orient.place.q.exp.semver',
      kind: 'mcq',
      prompt: bi('В выпуске 3.7.4 переименовали параметр в файле настроек; старое имя больше не читается. Какой номер у следующего выпуска?', 'In release 3.7.4 a settings-file parameter was renamed; the old name is no longer read. What is the next release number?'),
      options: [
        { id: 'major', text: '4.0.0', correct: true },
        { id: 'minor', text: '3.8.0', why: bi('Старые файлы настроек перестанут работать — это несовместимое изменение.', 'Old settings files stop working: that is an incompatible change.') },
        { id: 'patch', text: '3.7.5', why: bi('Это не исправление ошибки: поведение для пользователей ломается.', 'This is not a bug fix: behaviour breaks for users.') },
      ],
    },
  },
];

export const block: Block = {
  id: 'orient',
  order: route.order,
  title: route.title,
  summary: route.summary,
  checklistStep: route.checklistStep,
  beginnerOnly: true,
  levels: {
    beginner: bi(
      'Знаете компьютер как пользователь. Итог: объясняете своими словами, что делают процессор, память, диск и операционная система, что такое сервер, клиент и запрос, облако, сборка, версия, окружения и файл настроек; уверенно выполняете первые команды на учебной машине.',
      'You know computers as a user. Outcome: you explain in your own words what the processor, memory, disk and operating system do, what a server, client and request are, the cloud, a build, a version, environments and a settings file; you run your first commands on the training machine with confidence.',
    ),
    intermediate: bi('Работали рядом с IT-командой. Блок закрывается тремя вопросами: верные ответы отмечают все его понятия как известные.', 'You have worked next to an IT team. The block is closed with three questions: right answers mark all its ideas as known.'),
    experienced: bi('Программист или администратор. Три вопроса, один из них — команда на учебной машине.', 'A programmer or an administrator. Three questions, one of them a command on the training machine.'),
  },
  hours: route.hours,
  placement,
  lessons: ['orient.inside', 'orient.system', 'orient.text', 'orient.net', 'orient.requests', 'orient.rent', 'orient.release', 'orient.places', 'orient.together', 'orient.team'],
  sources: {
    en: [EN.vonNeumann, EN.os, EN.clientServer, EN.nist, EN.semver, EN.config12, EN.gitAbout],
    ru: [RU.vonNeumann, RU.os, RU.clientServer, RU.cloud, RU.semver, RU.config12, RU.gitAbout],
  },
  docSources: ['man', 'help'],
};
