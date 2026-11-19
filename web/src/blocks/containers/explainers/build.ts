// X2 (04 §6.3): `docker build` layer by layer with the cache. Six
// instructions of a Python service; "what changed" recomputes which steps
// come from the cache, the order switch moves `COPY . .` above `pip install`,
// and breaks remove .dockerignore or delete files in a separate RUN.
//
// Reading order: at the start only the build context and the empty cache are
// on the diagram. Each instruction appears when the builder reaches it, so the
// image grows from FROM at the bottom up to CMD; the instruction says in a
// callout whether its key matched and the layer came from the cache or why it
// is rebuilt. The finished image appears last.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb, startWith } from './util';

type P = { changed: string; order: string; noCache: boolean };

interface Ins {
  id: string;
  text: string;
  layer: boolean;
  /** Which change invalidates this step's own key. */
  keyOf: string[];
  ms: number;
  mb: number;
}

/** The build plan for a given order; tested separately from the steps. */
export function plan(order: string, ignore = true): Ins[] {
  const head: Ins[] = [
    { id: 'from', text: 'FROM python:3.13-slim', layer: true, keyOf: [], ms: 0, mb: 120 },
    { id: 'workdir', text: 'WORKDIR /app', layer: false, keyOf: [], ms: 0, mb: 0 },
  ];
  const req: Ins = { id: 'copyreq', text: 'COPY requirements.txt .', layer: true, keyOf: ['requirements'], ms: 100, mb: 0 };
  const pip: Ins = { id: 'pip', text: 'RUN pip install -r requirements.txt', layer: true, keyOf: [], ms: 21_000, mb: 48 };
  const code: Ins = { id: 'copycode', text: 'COPY . .', layer: true, keyOf: ignore ? ['code', 'requirements'] : ['code', 'requirements', 'readme', 'git'], ms: ignore ? 100 : 2400, mb: ignore ? 0.1 : 200 };
  const cmd: Ins = { id: 'cmd', text: 'CMD ["python", "main.py"]', layer: false, keyOf: [], ms: 0, mb: 0 };
  return order === 'good' ? [...head, req, pip, code, cmd] : [...head, { ...code }, { ...pip, text: 'RUN pip install -r requirements.txt' }, cmd];
}

/** Index of the first step whose cache key changes, or -1. */
export function firstMiss(ins: Ins[], changed: string, noCache: boolean): number {
  if (noCache) return 0;
  return ins.findIndex((i) => i.keyOf.includes(changed));
}

const NODE: Record<string, string> = { from: 'n-from', workdir: 'n-workdir', copyreq: 'n-req', pip: 'n-pip', copycode: 'n-code', cmd: 'n-cmd' };
const ALL = ['n-from', 'n-workdir', 'n-req', 'n-pip', 'n-code', 'n-cmd', 'n-ctx', 'n-cache', 'n-image', 'e-ctx', 'e-req', 'e-key', 'e-out'];
const DF = bi('Ваш Dockerfile.', 'Your Dockerfile.');

export const buildModel = defineModel<P>({
  id: 'containers.build-cache',
  block: 'containers',
  title: bi('Как docker build собирает образ и пользуется кэшем', 'docker build: layer by layer, with the cache'),
  summary: bi(
    'На схеме сборщик собирает небольшой сервис на Python по Dockerfile из шести инструкций. Схема показывает, какие шаги после вашей правки сборщик возьмёт из кэша, а какие выполнит заново, и почему вторая сборка обычно быстрее первой. Ключ каждого шага складывается из ключа предыдущего шага, текста инструкции и содержимого копируемых файлов.',
    'A build of a small Python service from a six-instruction Dockerfile. The diagram shows which steps the builder takes from the cache after your edit and which it reruns, and why the second build is usually faster than the first. A step’s key is made of the previous step’s key, the instruction text and the content of the copied files.',
  ),
  intro: bi(
    'Сейчас на схеме только каталог с файлами проекта и пустой пока кэш сборщика. Нажмите «Начать с первого шага», а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Инструкции Dockerfile появятся снизу вверх в том порядке, в каком их выполняет сборщик. Облачко у инструкции говорит, совпал ли её ключ с прошлой сборкой. Зелёная рамка означает, что слой взят из кэша, а жёлтая показывает, что с этого шага начинается пересборка.\n\nПосле первого прохода выберите в «Параметрах», какой файл вы поменяли, и переставьте инструкции, а потом следите за временем сборки под схемой.',
    'Now the diagram shows only the project directory and the builder’s cache, still empty. Press “Start from the first step”, then go on with “Step forward”: the Dockerfile instructions appear from the bottom up in the order the builder runs them. The callout at an instruction says whether its key matched the last build. A green outline means the layer came from the cache, a yellow one that the rebuild starts at this step.\n\nAfter the first pass choose in “Parameters” which file you changed and reorder the instructions, and watch the build time under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('инструкция, которую сборщик выполняет сейчас', 'the instruction the builder runs now') },
    { mark: 'say', text: bi('что решил сборщик, взять слой из кэша или выполнить шаг', 'what the builder decided, to take the layer from the cache or to run the step') },
    { mark: 'token', text: bi('что передаётся дальше, то есть файлы, ключ шага или слои', 'what is passed on, that is files, the step key or layers') },
    { mark: 'icon:folder', text: bi('контекст сборки, то есть каталог проекта', 'the build context, that is the project directory') },
    { mark: 'icon:disk', text: bi('инструкция, которая создаёт слой', 'an instruction that makes a layer') },
    { mark: 'icon:file', text: bi('инструкция, которая меняет только настройки образа', 'an instruction that changes only the config') },
    { mark: 'icon:database', text: bi('кэш сборки', 'the build cache') },
    { mark: 'ok', text: bi('слой взят из кэша', 'the layer came from the cache') },
    { mark: 'warn', text: bi('первый шаг с новым ключом, с которого начинается пересборка', 'the first step with a new key, where the rebuild starts') },
  ],
  stopLabel: bi('Сборка с изъяном', 'A flawed build'),
  concepts: ['docker.dockerfile', 'docker.build-cache', 'docker.layer'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      { id: 'n-from', label: 'FROM python:3.13-slim', icon: 'disk', sub: '120 MB', family: 'store', x: 24, y: 440, w: 400, h: 52, card: { what: bi('Эта инструкция берёт базовые слои образа Python целиком, а ключом в кэше для них служит ID базового образа.', 'The base layers as a whole: their cache key is the base image ID.'), who: bi('Слои собраны чужим Dockerfile, который написали авторы образа python.', 'Someone else’s Dockerfile (Python).'), doc: { page: 'web/docs.docker.com/reference/dockerfile', anchor: 'from' } } },
      { id: 'n-workdir', label: 'WORKDIR /app', icon: 'file', sub: 'config', family: 'obj', shape: 'doc', x: 24, y: 368, w: 400, h: 52, card: { what: bi('Эта инструкция не создаёт слоя, а только меняет строку WorkingDir в настройках образа.', 'No layer: the WorkingDir line in the image config changes.'), who: DF } },
      { id: 'n-req', label: 'COPY requirements.txt .', icon: 'disk', sub: '0.1 kB', family: 'store', x: 24, y: 296, w: 400, h: 52, card: { what: bi('Эта инструкция создаёт слой с одним файлом. В ключ шага входит отпечаток sha256 содержимого этого файла, поэтому, если файл не менялся, шаг берётся из кэша.', 'A layer with one file. The key includes the sha256 of its content: if the file did not change, the step comes from the cache.'), who: DF } },
      { id: 'n-pip', label: 'RUN pip install -r requirements.txt', icon: 'disk', sub: '48 MB · 21 s', family: 'ci-build', x: 24, y: 224, w: 400, h: 52, card: { what: bi('Этот шаг сборки самый долгий. Его ключ складывается из ключа предыдущего шага и текста команды, поэтому, пока выше ничего не поменялось, шаг берётся из кэша, даже если код приложения другой.', 'The longest step. Its key is the parent and the command text: as long as nothing above changed, it comes from the cache, even if the application code is different.'), who: DF } },
      { id: 'n-code', label: 'COPY . .', icon: 'disk', sub: '0.1 MB', family: 'store', x: 24, y: 152, w: 400, h: 52, card: { what: bi('Инструкция копирует весь контекст сборки, кроме того, что перечислено в .dockerignore. Любая правка любого скопированного файла меняет ключ этого шага.', 'The whole build context except what .dockerignore lists. Any edit of any file changes this step’s key.'), who: DF, see: 'cat .dockerignore' } },
      { id: 'n-cmd', label: 'CMD ["python", "main.py"]', icon: 'file', sub: 'config', family: 'obj', shape: 'doc', x: 24, y: 80, w: 400, h: 52, card: { what: bi('Эта инструкция тоже не создаёт слоя, а записывает строку Cmd в настройки образа.', 'No layer: it is the Cmd line in the config.'), who: DF } },
      { id: 'n-ctx', label: bi('Контекст сборки', 'Build context'), icon: 'folder', sub: 'main.py · requirements.txt · README.md', family: 'user', x: 560, y: 152, w: 376, h: 64, card: { what: bi('Контекстом называют каталог, который клиент отправляет сборщику. Файл `.dockerignore` вычёркивает из него лишнее, например каталог .git, тестовые данные и секреты.', 'The directory the client sends to the builder. `.dockerignore` strikes out what is not needed: .git, test data, secrets.'), who: bi('Контекст задаёт последний аргумент `docker build`, обычно точка.', 'The last argument of `docker build` (usually a dot).') } },
      { id: 'n-cache', label: bi('Кэш сборки', 'Build cache'), icon: 'database', sub: t(bi('ключ → слой', 'key → layer')), family: 'kernel', shape: 'buffer', x: 560, y: 296, w: 376, h: 72, card: { what: bi('Кэш устроен как таблица, где каждому ключу шага соответствует готовый слой. Ключ вычисляется как sha256 от ключа родителя, текста инструкции и отпечатка копируемых файлов, поэтому начиная с первой изменившейся инструкции все ключи ниже по Dockerfile получаются новыми.', 'A table “step key → finished layer”. Key = sha256(parent key + instruction text + hash of copied files). From the first changed instruction down, the keys are new.'), who: bi('Таблицу ведёт BuildKit, сборщик Docker.', 'BuildKit, Docker’s builder.'), see: 'docker builder du', doc: { page: 'web/docs.docker.com/build/cache', anchor: 'how-the-cache-works' } } },
      { id: 'n-image', label: bi('Образ', 'Image'), icon: 'container', sub: 'app:1.0', family: 'obj', x: 560, y: 440, w: 376, h: 52, card: { what: bi('В результате сборки получаются стопка слоёв и документ настроек.', 'The result: a stack of layers and a config.'), who: bi('Его создаёт команда `docker build -t app:1.0 .`.', '`docker build -t app:1.0 .`') } },
    ],
    edges: [
      { id: 'e-ctx', from: 'n-ctx', to: 'n-code', label: bi('файлы проекта', 'context files'), card: { what: bi('COPY берёт файлы из контекста, и их отпечаток входит в ключ шага.', 'COPY takes files from the context; their hash goes into the step key.'), who: bi('Файлы проекта копирует в образ сборщик BuildKit.', 'The builder.') } },
      { id: 'e-req', from: 'n-ctx', to: 'n-req', via: [[520, 184], [520, 322]], label: 'requirements.txt', labelAt: 0.6, card: { what: bi('Файл requirements.txt копируется отдельной инструкцией COPY, потому что список зависимостей меняется редко, а код часто.', 'A separate COPY of one file: dependencies change rarely, code often.'), who: bi('Файл requirements.txt копирует в образ сборщик BuildKit.', 'The builder.') } },
      { id: 'e-key', from: 'n-pip', to: 'n-cache', via: [[480, 250], [480, 332]], label: bi('ключ шага', 'step key'), labelAt: 0.5, card: { what: bi('Сборщик ищет слой по ключу. Если находит, пишет `CACHED`, а если нет, выполняет шаг.', 'The builder looks up a layer by key. Found — `CACHED`; not found — it runs the step.'), who: bi('Слой по ключу ищет в своём кэше сборщик BuildKit.', 'BuildKit.') } },
      { id: 'e-out', from: 'n-cache', to: 'n-image', label: bi('слои', 'layers'), card: { what: bi('Слои из кэша и новые слои складываются в образ.', 'Cached and new layers are assembled into the image.'), who: bi('Слои в готовый образ складывает сборщик BuildKit.', 'BuildKit.') } },
    ],
  },
  params: [
    {
      id: 'changed',
      label: bi('Какой файл вы поменяли после прошлой сборки', 'What changed since the last build'),
      kind: 'choice',
      default: 'code',
      options: [
        { id: 'none', label: bi('ничего не меняли', 'nothing') },
        { id: 'code', label: bi('код main.py', 'main.py') },
        { id: 'requirements', label: bi('список зависимостей requirements.txt', 'requirements.txt') },
        { id: 'readme', label: bi('README.md, который вычеркнут в .dockerignore', 'README.md (in .dockerignore)') },
      ],
      near: 'n-ctx',
      group: bi('Что изменилось в проекте', 'What changed in the project'),
      predict: {
        prompt: bi('Инструкции стоят в порядке «сначала зависимости, потом код», и вы поменяли только main.py. Выполнится ли pip install заново?', 'Dependencies come first, then the code, and only main.py changed. Will pip install run again?'),
        options: [
          { id: 'cached', text: bi('Нет, потому что pip install стоит выше COPY . . и его ключ не изменился', 'No, because it is above COPY . . and its key did not change') },
          { id: 'rerun', text: bi('Да, потому что контекст сборки изменился и всё пересобирается', 'Yes, because the build context changed and everything rebuilds') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'pip' && s.states?.['n-pip'] === 'ok') ? 'cached' : 'rerun'),
      },
    },
    {
      id: 'order',
      label: bi('Порядок инструкций в Dockerfile', 'Order of instructions'),
      kind: 'choice',
      default: 'good',
      options: [
        { id: 'good', label: bi('сначала зависимости, потом код', 'dependencies first, then code') },
        { id: 'bad', label: bi('COPY . . перед pip install', 'COPY . . before pip install') },
      ],
      near: 'n-pip',
      group: bi('Как написан Dockerfile', 'How the Dockerfile is written'),
      predict: {
        prompt: bi('Вы поставили COPY . . выше pip install и поменяли main.py. Что будет со следующей сборкой?', 'COPY . . moved above pip install. What happens after editing main.py?'),
        options: [
          { id: 'rerun', text: bi('pip install будет выполняться заново после каждой правки кода', 'pip install runs again on every code edit') },
          { id: 'same', text: bi('Ничего не изменится, pip install возьмётся из кэша', 'Nothing changes') },
        ],
        resolve: (_p, n) => ((n[n.length - 1]?.metrics?.seconds ?? 0) > 10 ? 'rerun' : 'same'),
      },
    },
    { id: 'noCache', label: bi('Собрать с флагом --no-cache', '--no-cache'), kind: 'toggle', default: false, near: 'n-cache', group: bi('Как запускают сборку', 'How the build is run') },
  ],
  breaks: [
    {
      id: 'no-ignore',
      label: bi('Файл .dockerignore удалили', 'Delete .dockerignore'),
      remove: ['e-ctx'],
      boundary: 'storage',
      predict: {
        prompt: bi('Файл .dockerignore удалили, а в каталоге проекта лежат .git и 200 МБ тестовых данных в testdata/. Что изменится?', 'Deleted .dockerignore (the directory has .git and 200 MB of testdata/). What changes?'),
        options: [
          { id: 'big', text: bi('Контекст вырастет на 200 МБ, а COPY . . будет пересобираться почти при каждой сборке', 'The context grows by 200 MB and COPY . . rebuilds almost every time') },
          { id: 'none', text: bi('Ничего не изменится, потому что Docker сам пропустит ненужные файлы', 'Nothing, because Docker skips the extra files itself') },
        ],
        resolve: () => 'big',
      },
    },
    {
      id: 'rm-later',
      label: bi('Кэш pip удаляют отдельной инструкцией RUN rm -rf /root/.cache', 'RUN rm -rf /root/.cache on a separate line'),
      remove: ['e-out'],
      boundary: 'storage',
      predict: {
        prompt: bi('Кэш pip удаляют следующей инструкцией, `RUN rm -rf /root/.cache`. Станет ли образ меньше?', 'The pip cache is deleted by the next RUN rm instruction. Will the image get smaller?'),
        options: [
          { id: 'no', text: bi('Нет, потому что файлы остались в предыдущем слое, а сверху легли только пометки об удалении', 'No, because the files stay in the previous layer; on top there is only a deletion mark') },
          { id: 'yes', text: bi('Да, на размер кэша pip', 'Yes, by the size of the cache') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'seconds', label: bi('время сборки', 'build time'), unit: 's' },
    { id: 'cached', label: bi('сколько шагов взято из кэша', 'how many steps came from the cache') },
    { id: 'context', label: bi('размер контекста', 'context'), unit: 'MB' },
    { id: 'size', label: bi('размер образа', 'image size'), unit: 'MB' },
  ],
  run(p, broken): Step[] {
    const ignore = !broken.has('no-ignore');
    const ins = plan(p.order, ignore);
    let changed = p.changed;
    if (!ignore && changed === 'none') changed = 'git'; // .git changes on every commit
    const miss = firstMiss(ins, changed, p.noCache);
    const steps: Step[] = [];
    let seconds = 0.6;
    let cached = 0;
    let size = 0;
    const context = ignore ? 0.1 : 200;
    const m = () => ({ seconds: Math.round(seconds * 10) / 10, cached, context, size: Math.round(size) });
    steps.push({
      id: 'context',
      label: bi('контекст', 'context'),
      caption: ignore
        ? bi('Вы запускаете `docker build -t app:1.0 .`. Клиент отправляет сборщику каталог проекта, так называемый контекст сборки, и вычёркивает из него всё, что перечислено в `.dockerignore`. В итоге сборщику уходит 0,1 МБ.', 'You run `docker build -t app:1.0 .`. The client sends the project directory, the build context, to the builder, striking out what `.dockerignore` lists: 0.1 MB.')
        : bi('Вы запускаете `docker build -t app:1.0 .`, но файла `.dockerignore` нет, поэтому сборщику уходит весь каталог: и .git, и 200 МБ тестовых данных.', 'You run `docker build -t app:1.0 .`, but there is no `.dockerignore`, so the whole directory travels to the builder: .git and 200 MB of test data.'),
      focus: ['n-ctx'],
      say: { 'n-ctx': fmtb(bi('Клиент отправляет сборщику контекст сборки, {c} МБ.', 'The client sends the build context to the builder, {c} MB.'), { c: context }) },
      states: { ...startWith(ALL, 'n-ctx', 'n-cache'), ...(ignore ? {} : { 'n-ctx': 'warn' }) },
      values: { 'n-ctx': ignore ? 'main.py · requirements.txt · README.md' : '.git · testdata/ · main.py · …' },
      fill: { 'n-cache': 0 },
      metrics: m(),
    });
    ins.forEach((x, i) => {
      const hit = miss < 0 || i < miss;
      if (hit) cached++;
      else seconds += x.ms / 1000;
      size += x.mb;
      const node = NODE[x.id];
      const edge = x.id === 'pip' ? 'e-key' : x.id === 'copycode' ? 'e-ctx' : x.id === 'copyreq' ? 'e-req' : undefined;
      const say = hit
        ? x.layer
          ? bi('Ключ шага совпал с прошлой сборкой, и слой берётся из кэша.', 'The step key matches the last build: the layer comes from the cache.')
          : bi('Эта инструкция слоя не создаёт и меняет только строку в настройках образа.', 'No layer: only a line of the image config changes.')
        : i === miss
          ? p.noCache
            ? bi('Сборка запущена с --no-cache, поэтому кэш не используется и шаг выполняется.', 'The build runs with --no-cache, so the cache is not used and the step runs.')
            : fmtb(bi('Изменился файл {w}, поэтому ключ шага новый, и шаг выполняется заново.', '{w} changed, the key is new, and the step runs again.'), { w: changedName(changed, p.noCache) })
          : bi('Ключ предыдущего шага изменился, поэтому и этот шаг выполняется заново.', 'The previous step’s key changed, so this step runs again too.');
      steps.push({
        id: x.id,
        label: x.text.split(' ')[0],
        caption: hit
          ? x.layer
            ? fmt(bi('Инструкция `{t}` помечена CACHED, потому что её ключ совпал с ключом прошлой сборки и сборщик взял готовый слой из кэша.', '`{t}` — CACHED: this step’s key matches the last build; the layer comes from the cache.'), { t: x.text })
            : fmt(bi('Инструкция `{t}` меняет только настройки образа, и слоя у неё нет.', '`{t}` — changes only the config, no layer.'), { t: x.text })
          : i === miss && p.noCache
            ? fmt(bi('Сборка запущена с флагом --no-cache, поэтому сборщик не заглядывает в кэш и выполняет инструкцию `{t}` и все следующие заново.', '`{t}` — --no-cache: the cache is not consulted, everything from here down runs again.'), { t: x.text })
          : i === miss
            ? fmtb(bi('Инструкция `{t}` стала первым шагом с новым ключом, потому что изменился файл {what}. С этого шага и до конца Dockerfile всё пересобирается.', '`{t}` — the first step with a new key: {what} changed. From here down everything rebuilds.'), { t: x.text, what: changedName(changed, p.noCache) })
            : fmt(bi('Инструкция `{t}` пересобирается, хотя сама не менялась, потому что в её ключ входит ключ шага выше, а он стал новым.', '`{t}` — rebuilds because its parent changed: the key includes the key of the step above.'), { t: x.text }),
        focus: [node, ...(edge ? [edge] : [])],
        reveal: [node, ...(edge ? [edge] : [])],
        say: { [node]: say },
        states: { [node]: hit ? 'ok' : i === miss ? 'warn' : 'on' },
        values: { [node]: hit ? (x.layer ? 'CACHED' : 'config') : `${(x.ms / 1000).toFixed(1)} s` },
        tokens: x.id === 'pip' ? [{ edge: 'e-key', label: hit ? 'CACHED' : 'MISS' }] : x.id === 'copycode' ? [{ edge: 'e-ctx', label: ignore ? 'main.py …' : '.git testdata/ …' }] : x.id === 'copyreq' ? [{ edge: 'e-req', label: 'requirements.txt' }] : [],
        fill: { 'n-cache': cached / ins.length },
        metrics: m(),
      });
    });
    if (broken.has('no-ignore')) {
      steps.push({
        id: 'ctx-broken',
        label: bi('лишнее', 'extra'),
        caption: bi('Без `.dockerignore` сборщику уходит весь каталог, включая .git и 200 МБ testdata/. Каталог .git меняется с каждым коммитом, поэтому ключ `COPY . .` почти всегда получается новым, и вместе с ним пересобирается всё, что ниже.', 'Without .dockerignore the whole directory travels to the builder: .git and 200 MB of testdata/. .git changes with every commit — the key of `COPY . .` is almost always new.'),
        focus: ['n-ctx', 'e-ctx'],
        say: { 'n-ctx': bi('В контексте лежат .git и тестовые данные, и каждый коммит меняет ключ COPY . .', 'The context holds .git and test data, and every commit changes the key of COPY . .') },
        states: { 'n-ctx': 'warn', 'n-code': 'warn' },
        metrics: m(),
        broken: { at: 'e-ctx', message: ' => [internal] load build context                      2.4s\n => => transferring context: 200.47MB                   2.4s', caption: bi('Изъян сидит в контексте сборки. Лишние файлы замедляют сборку, сбивают кэш и могут унести в образ секреты вроде .env и ключей.', 'The flaw sits in the build context. Extra files slow the build down, break the cache and can carry secrets such as .env and keys into the image.') },
      });
    }
    if (broken.has('rm-later')) {
      seconds += 0.3;
      steps.push({
        id: 'rm',
        label: 'RUN rm',
        caption: bi('Инструкция `RUN rm -rf /root/.cache` создаёт новый слой, в котором лежат только пометки об удалении. Предыдущий слой с кэшем pip остался в образе целиком, поэтому образ не уменьшился.', '`RUN rm -rf /root/.cache` makes a new layer of deletion marks. The previous layer with the cache is still there — the image did not shrink.'),
        focus: ['n-image', 'e-out'],
        reveal: ['n-image', 'e-out'],
        say: { 'n-image': bi('В образе остался слой с кэшем pip, а сверху лежит слой с пометками об удалении.', 'The image keeps the layer with the pip cache plus a layer of deletion marks.') },
        states: { 'n-image': 'warn' },
        metrics: m(),
        broken: { at: 'e-out', message: 'IMAGE          CREATED BY                                SIZE\n<missing>      RUN /bin/sh -c rm -rf /root/.cache        0B\n<missing>      RUN /bin/sh -c pip install -r require…   48MB', caption: bi('Изъян сидит в сборке слоёв. Удалять файлы нужно в той же инструкции RUN, где они появились, или пользоваться многоэтапной сборкой.', 'The flaw sits in how the layers are built. Delete files in the same RUN that created them, or use a multi-stage build.') },
      });
    } else {
      steps.push({
        id: 'image',
        label: bi('образ', 'image'),
        caption: fmt(bi('Образ собран за {s} с, и {c} шагов из шести взяты из кэша. Образ занимает {mb} МБ.', 'The image is built in {s} s: {c} steps from the cache. Size {mb} MB.'), { s: Math.round(seconds * 10) / 10, c: cached, mb: Math.round(size) }),
        focus: ['n-image', 'e-out'],
        reveal: ['n-image', 'e-out'],
        tokens: [{ edge: 'e-out', label: bi('6 слоёв и настройки', '6 layers and config') }],
        say: { 'n-image': fmt(bi('Образ app:1.0 собран за {s} с.', 'The app:1.0 image is built in {s} s.'), { s: Math.round(seconds * 10) / 10 }) },
        states: { 'n-image': 'ok' },
        metrics: m(),
      });
    }
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и сборка снова идёт как обычно.', 'The failure is removed.');
      return change.id === 'no-ignore'
        ? fmt(bi('Без .dockerignore контекст весит {c} МБ, а .git меняется с каждым коммитом, поэтому COPY . . почти всегда проходит мимо кэша.', 'Without .dockerignore the context is {c} MB and .git changes with every commit: COPY . . almost always misses the cache.'), { c: m.context ?? 0 })
        : bi('Отдельная инструкция RUN rm добавляет слой с пометками об удалении, а предыдущий слой не уменьшает.', 'A separate RUN rm adds a layer of marks; it does not shrink the previous one.');
    }
    if (change.id === 'noCache') return b.noCache ? fmt(bi('С флагом --no-cache кэш не используется вовсе, и сборка идёт {s} с.', '--no-cache: the cache is not used; the build takes {s} s.'), { s: m.seconds ?? 0 }) : bi('Кэш снова используется.', 'The cache is used again.');
    if (change.id === 'order')
      return b.order === 'bad'
        ? fmt(bi('COPY . . стоит выше pip install, поэтому любая правка кода меняет ключ, и сборка идёт {s} с.', 'COPY . . above pip install: any code edit changes the key — the build takes {s} s.'), { s: m.seconds ?? 0 })
        : fmt(bi('Зависимости ставятся раньше кода, поэтому правка кода пересобирает только последний COPY, и сборка идёт {s} с.', 'Dependencies first: a code edit rebuilds only the last COPY — {s} s.'), { s: m.seconds ?? 0 });
    if (b.changed === 'none') return fmt(bi('Ничего не менялось, поэтому из кэша взяты все шаги ({c}), и сборка идёт {s} с.', 'Nothing changed: {c} steps from the cache, the build takes {s} s.'), { c: m.cached ?? 0, s: m.seconds ?? 0 });
    return fmt(bi('Изменился файл {w}. Число шагов, взятых из кэша, равно {c}, а сборка идёт {s} с.', 'Changed: {w}. {c} steps from the cache, the build takes {s} s.'), { w: changedName(b.changed, false), c: m.cached ?? 0, s: m.seconds ?? 0 });
  },
});

function changedName(c: string, noCache: boolean): string {
  if (noCache) return '--no-cache';
  return { none: '—', code: 'main.py', requirements: 'requirements.txt', readme: 'README.md', git: '.git' }[c] ?? c;
}
