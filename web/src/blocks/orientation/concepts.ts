// The concept graph of the Orientation block (01 §6.2, F01–F12, plus the
// command line, the internet, the cloud and the roles of a team). Words that
// are everyday speech ("computer", "file", "network") are not scanned in
// prose (scan: false); the technical ones are, so the block itself keeps its
// order: no "server" before the lesson about servers.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

const c = (id: string, ru: string, en: string, shortRu: string, shortEn: string, lesson: string, o: Partial<Concept> = {}): Concept => ({
  id: `orient.${id}`,
  term: bi(ru, en),
  short: bi(shortRu, shortEn),
  introducedIn: `orient.${lesson}`,
  ...o,
});

export const concepts: Concept[] = [
  c('computer', 'компьютер', 'computer', 'Машина, в которой работают процессор, память и диск. Процессор выполняет инструкции, память хранит то, что нужно прямо сейчас, а диск хранит всё остальное.', 'A machine of a processor, memory and a disk: the processor carries out instructions, memory holds what is needed now, the disk keeps everything else.', 'inside', { scan: false }),
  c('program', 'программа', 'program', 'Последовательность инструкций, записанная на диск. Запустить программу значит скопировать её в память и отдать процессору на выполнение.', 'A sequence of instructions stored on the disk. Running it means copying it into memory and letting the processor carry it out.', 'inside', { scan: false }),
  c('os', 'операционная система', 'operating system', 'Главная программа компьютера. Она запускает остальные программы, делит между ними процессор и память, хранит файлы и управляет устройствами.', 'The main program of a computer: it starts the others, shares the processor and memory between them, keeps files and talks to the devices.', 'system', {
    forms: { ru: ['операционной системы', 'операционную систему', 'операционной системой', 'операционной системе', 'операционные системы', 'операционных систем', 'ОС'], en: ['operating systems', 'OS'] },
  }),
  c('file', 'файл', 'file', 'Кусок данных на диске, у которого есть имя. Файлы лежат в папках, папки лежат в других папках, а путь к файлу записывают через знак «/».', 'A named piece of data on the disk. Files live in folders, folders in other folders; a path is written with “/”.', 'system', { scan: false }),
  c('command', 'команда', 'command', 'Строка текста, которую вы печатаете машине. Первое слово говорит, что сделать, а остальные уточняют, с чем и как.', 'A line of text you type to the machine: the first word says what to do, the rest say with what and how.', 'text', { scan: false }),
  c('network', 'сеть', 'network', 'Компьютеры, соединённые проводами или радио так, что они могут посылать друг другу сообщения по адресам.', 'Computers connected by wires or radio so that they can send each other messages by address.', 'net', { scan: false }),
  c('internet', 'интернет', 'internet', 'Десятки тысяч сетей разных владельцев, которые договорились передавать сообщения друг друга.', 'A network of tens of thousands of networks with different owners that agreed to pass each other’s messages on.', 'net', { scan: false }),
  c('server', 'сервер', 'server', 'Компьютер, который работает без перерыва и обслуживает другие компьютеры: отдаёт страницы, хранит данные, принимает заказы.', 'A computer that runs without a break and serves others: it hands out pages, keeps data, takes orders.', 'requests', {
    forms: { ru: ['сервера', 'серверу', 'сервером', 'сервере', 'серверы', 'серверов', 'серверам', 'серверами', 'серверах', 'серверный', 'серверная', 'серверной', 'серверные'], en: ['servers'] },
  }),
  c('client-request', 'клиент и запрос', 'client and request', 'Клиентом называют программу, которая о чём-то просит, а запросом — её просьбу. Сервер на запрос отвечает, а разговор всегда начинает клиент.', 'The client is the program that asks; the request is what it asks; the server answers. The client always starts the conversation.', 'requests', {
    forms: { ru: ['клиент', 'клиента', 'клиенту', 'клиентом', 'клиенты', 'клиентов', 'запрос', 'запроса', 'запросу', 'запросом', 'запросы', 'запросов'], en: ['client', 'clients', 'request', 'requests'] },
  }),
  c('cloud', 'облако', 'cloud', 'Чужие серверы, которые берут напрокат. Машину заказывают за минуту, платят за все часы, пока она существует, и удаляют, когда она больше не нужна.', 'Somebody else’s servers for hire: a machine is ordered in a minute, paid for by the hour and handed back when it is no longer needed.', 'rent', {
    forms: { ru: ['облака', 'облаку', 'облаком', 'облаке', 'облачный', 'облачная', 'облачное', 'облачного', 'облачной', 'облачные'], en: ['clouds'] },
  }),
  c('source-build', 'исходный код и сборка', 'source code and build', 'Исходный код — это текст программы, который пишут и читают люди. Сборка превращает его в то, что запускает машина.', 'Source code is the text of a program that people write and read. The build turns it into what the machine runs.', 'release', {
    forms: { ru: ['исходный код', 'исходного кода', 'исходным кодом', 'исходном коде', 'сборка', 'сборки', 'сборку', 'сборкой', 'собрать', 'собирает', 'собрали'], en: ['source code', 'build', 'builds', 'built'] },
  }),
  c('version', 'версия', 'version', 'Номер, который получает каждый выпуск программы, например 1.4.2. По номеру видно, что изменилось и можно ли обновиться без опаски.', 'The number every release of a program gets, such as 1.4.2. The number tells what changed and whether it is safe to upgrade.', 'release', {
    forms: { ru: ['версии', 'версию', 'версией', 'версий', 'выпуск', 'выпуска', 'выпуски', 'релиз', 'релиза'], en: ['versions', 'release', 'releases'] },
  }),
  c('environments', 'окружение', 'environment', 'Место, где работает программа: ноутбук разработчика, тестовый стенд или рабочее окружение, которое в командах называют продом. Программа везде одна и та же, а различаются машины и настройки.', 'A place where the program runs: at the developer’s, on the test stand, in production. The program is the same everywhere; the machines and settings differ.', 'places', {
    forms: { ru: ['окружения', 'окружений', 'окружениях', 'окружениям', 'прод', 'прода', 'проде', 'продом'], en: ['environments', 'production', 'staging'] },
  }),
  c('config', 'конфигурация', 'configuration', 'Настройки программы, вынесенные из кода в отдельный файл: адреса, имена, включённые возможности. Благодаря этому одна и та же сборка работает с разными конфигурациями.', 'The settings of a program kept out of the code in a separate file: addresses, names, switched-on features. One build, different configurations.', 'places', {
    forms: { ru: ['конфигурации', 'конфигурацию', 'конфигурацией', 'конфиг', 'конфига'], en: ['configurations', 'config'] },
  }),
  c('collaboration', 'совместная работа над кодом', 'working on code together', 'Каждый правит свою копию, программа соединяет правки и помнит историю, а спорное место решает человек.', 'Everyone edits their own copy, a machine joins the edits and keeps the history; a disputed spot is decided by a person.', 'together', { scan: false }),
  c('roles', 'роли в IT-команде', 'roles in an IT team', 'Кто в команде пишет код, кто его проверяет, кто следит за серверами и кто связывает всё это в один путь от идеи до пользователя.', 'Who writes code, who checks it, who looks after the servers and who ties it all into one path from idea to user.', 'team', { scan: false }),
];
