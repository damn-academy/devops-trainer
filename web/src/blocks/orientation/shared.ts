// Shared bits of the Orientation block: sources, terminal setups, doc refs.

import type { DocRef, SourceLink, Sources, TerminalSetup } from '../../core/types';

const wikiEn = (title: string, page: string): SourceLink => ({ title: `${title} — Wikipedia`, url: `https://en.wikipedia.org/wiki/${page}` });
const wikiRu = (title: string): SourceLink => ({ title: `${title} — Википедия`, url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` });

export const EN = {
  vonNeumann: wikiEn('Von Neumann architecture', 'Von_Neumann_architecture'),
  cpu: wikiEn('Central processing unit', 'Central_processing_unit'),
  ram: wikiEn('Random-access memory', 'Random-access_memory'),
  file: wikiEn('Computer file', 'Computer_file'),
  os: wikiEn('Operating system', 'Operating_system'),
  cli: wikiEn('Command-line interface', 'Command-line_interface'),
  tlcl: { title: 'William Shotts — The Linux Command Line', url: 'https://linuxcommand.org/tlcl.php' },
  network: wikiEn('Computer network', 'Computer_network'),
  internet: wikiEn('Internet', 'Internet'),
  mdnWeb: { title: 'MDN — How the web works', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works' },
  mdnHttp: { title: 'MDN — An overview of HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview' },
  clientServer: wikiEn('Client–server model', 'Client%E2%80%93server_model'),
  server: wikiEn('Server (computing)', 'Server_(computing)'),
  nist: { title: 'NIST SP 800-145 — The NIST Definition of Cloud Computing', url: 'https://csrc.nist.gov/pubs/sp/800/145/final' },
  cloud: wikiEn('Cloud computing', 'Cloud_computing'),
  source: wikiEn('Source code', 'Source_code'),
  build: wikiEn('Software build', 'Software_build'),
  semver: { title: 'Semantic Versioning 2.0.0', url: 'https://semver.org/' },
  versioning: wikiEn('Software versioning', 'Software_versioning'),
  envs: wikiEn('Deployment environment', 'Deployment_environment'),
  config12: { title: 'The Twelve-Factor App — III. Config', url: 'https://12factor.net/config' },
  parity12: { title: 'The Twelve-Factor App — X. Dev/prod parity', url: 'https://12factor.net/dev-prod-parity' },
  gitAbout: { title: 'Pro Git — About Version Control', url: 'https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control' },
  merge: wikiEn('Merge (version control)', 'Merge_(version_control)'),
  softwareDev: wikiEn('Software development', 'Software_development'),
  sysadmin: wikiEn('System administrator', 'System_administrator'),
  testing: wikiEn('Software testing', 'Software_testing'),
} satisfies Record<string, SourceLink>;

export const RU = {
  vonNeumann: wikiRu('Архитектура фон Неймана'),
  cpu: wikiRu('Центральный процессор'),
  ram: wikiRu('Оперативная память'),
  file: wikiRu('Файл'),
  os: wikiRu('Операционная система'),
  cli: wikiRu('Интерфейс командной строки'),
  network: wikiRu('Компьютерная сеть'),
  internet: wikiRu('Интернет'),
  mdnHttp: { title: 'MDN — Обзор протокола HTTP', url: 'https://developer.mozilla.org/ru/docs/Web/HTTP/Overview' },
  clientServer: wikiRu('Клиент — сервер'),
  server: wikiRu('Сервер (аппаратное обеспечение)'),
  cloud: wikiRu('Облачные вычисления'),
  source: wikiRu('Исходный код'),
  compiler: wikiRu('Компилятор'),
  semver: { title: 'Семантическое версионирование 2.0.0', url: 'https://semver.org/lang/ru/' },
  config12: { title: 'Двенадцать факторов — III. Конфигурация', url: 'https://12factor.net/ru/config' },
  parity12: { title: 'Двенадцать факторов — X. Паритет разработки и работы приложения', url: 'https://12factor.net/ru/dev-prod-parity' },
  gitAbout: { title: 'Pro Git — О системе контроля версий', url: 'https://git-scm.com/book/ru/v2/%D0%92%D0%B2%D0%B5%D0%B4%D0%B5%D0%BD%D0%B8%D0%B5-%D0%9E-%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B5-%D0%BA%D0%BE%D0%BD%D1%82%D1%80%D0%BE%D0%BB%D1%8F-%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D0%B9' },
  vcs: wikiRu('Система управления версиями'),
  softwareDev: wikiRu('Разработка программного обеспечения'),
  sysadmin: wikiRu('Системный администратор'),
  testing: wikiRu('Тестирование программного обеспечения'),
} satisfies Record<string, SourceLink>;

export const sources = (en: SourceLink[], ru: SourceLink[]): Sources => ({ en, ru });

export const man = (page: string, anchor = 'DESCRIPTION', line?: string): DocRef => ({ page: `man/${page}`, anchor, line });

/** The first training machine: an ordinary user with a few files in the home folder. */
export const desk = (extra: Partial<TerminalSetup> = {}): TerminalSetup => ({
  hostname: 'trainer',
  ...extra,
  files: [
    { path: '~/notes/todo.txt', content: 'buy tea\ncall the bank\nread chapter 2\n' },
    { path: '~/notes/ideas.txt', content: 'a shop that sells only green tea\n' },
    { path: '~/photos/cat.jpg', content: 'JPEG…' },
    ...(extra.files ?? []),
  ],
});

/** The laptop on the home network of the networks block (preset `home`): shop.example answers over the internet. */
export const laptop = (extra: Partial<TerminalSetup> = {}): TerminalSetup => ({ hostname: 'laptop', ...extra, ext: { net: { preset: 'home' }, ...(extra.ext ?? {}) } });

/** A tiny "project": source, a build script that reads VERSION, two configurations. */
export const GREET_SRC = 'echo "Hello from the tea shop"\n';
export const BUILD_SH = 'v=$(cat VERSION)\nmkdir -p dist\ncp src/greet.sh dist/greet-$v.sh\necho "built dist/greet-$v.sh"\n';
export const APP_SH = 'greeting=$(grep greeting "$1" | tail -n 1 | cut -d= -f2)\ncolor=$(grep color "$1" | tail -n 1 | cut -d= -f2)\necho "$greeting! (page colour: $color)"\n';

export const project = (extra: Partial<TerminalSetup> = {}): TerminalSetup => ({
  hostname: 'trainer',
  cwd: '~/shop',
  ...extra,
  files: [
    { path: '~/shop/src/greet.sh', content: GREET_SRC },
    { path: '~/shop/VERSION', content: '1.4.2\n' },
    { path: '~/shop/build.sh', content: BUILD_SH },
    ...(extra.files ?? []),
  ],
});

export const settings = (extra: Partial<TerminalSetup> = {}): TerminalSetup => ({
  hostname: 'trainer',
  cwd: '~/shop',
  ...extra,
  files: [
    { path: '~/shop/app.sh', content: APP_SH },
    { path: '~/shop/config/dev.conf', content: 'greeting=Hi, developer\ncolor=grey\n' },
    { path: '~/shop/config/test.conf', content: 'greeting=Hi, tester\ncolor=yellow\n' },
    { path: '~/shop/config/prod.conf', content: 'greeting=Welcome to the tea shop\ncolor=grey\n' },
    ...(extra.files ?? []),
  ],
});

export const twoCopies = (extra: Partial<TerminalSetup> = {}): TerminalSetup => ({
  hostname: 'trainer',
  cwd: '~/menu',
  ...extra,
  files: [
    { path: '~/menu/menu-anna.txt', content: 'Green tea — 300\nBlack tea — 250\nOolong — 450\nMatcha — 600\n' },
    { path: '~/menu/menu-boris.txt', content: 'Green tea — 300\nBlack tea — 280\nOolong — 450\nMatcha — 600\n' },
    ...(extra.files ?? []),
  ],
});
