// X2 (04 §6.3): `docker build` layer by layer with the cache. Six
// instructions of a Python service; "what changed" recomputes which steps
// come from the cache, the order switch moves `COPY . .` above `pip install`,
// and breaks remove .dockerignore or delete files in a separate RUN.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

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

export const buildModel = defineModel<P>({
  id: 'containers.build-cache',
  block: 'containers',
  title: bi('docker build: слой за слоем, с кэшем', 'docker build: layer by layer, with the cache'),
  summary: bi('Что пересоберётся после правки и почему вторая сборка быстрее первой. Ключ шага — родитель, текст инструкции и содержимое копируемых файлов.', 'What rebuilds after an edit and why the second build is faster than the first. A step’s key is its parent, the instruction text and the content of the copied files.'),
  concepts: ['docker.dockerfile', 'docker.build-cache', 'docker.layer'],
  diagram: {
    width: 960,
    height: 500,
    nodes: [
      { id: 'n-from', label: 'FROM python:3.13-slim', sub: '120 MB', family: 'store', x: 24, y: 424, w: 400, h: 52, card: { what: bi('Базовые слои целиком: их кэш-ключ — ID базового образа.', 'The base layers as a whole: their cache key is the base image ID.'), who: bi('Чужой Dockerfile (Python).', 'Someone else’s Dockerfile (Python).'), doc: { page: 'web/docs.docker.com/reference/dockerfile', anchor: 'from' } } },
      { id: 'n-workdir', label: 'WORKDIR /app', sub: 'config', family: 'obj', shape: 'doc', x: 24, y: 352, w: 400, h: 52, card: { what: bi('Слоя нет: меняется строка WorkingDir в config образа.', 'No layer: the WorkingDir line in the image config changes.'), who: bi('Ваш Dockerfile.', 'Your Dockerfile.') } },
      { id: 'n-req', label: 'COPY requirements.txt .', sub: '0.1 kB', family: 'store', x: 24, y: 280, w: 400, h: 52, card: { what: bi('Слой с одним файлом. В ключ входит sha256 его содержимого: файл не изменился — шаг из кэша.', 'A layer with one file. The key includes the sha256 of its content: if the file did not change, the step comes from the cache.'), who: bi('Ваш Dockerfile.', 'Your Dockerfile.') } },
      { id: 'n-pip', label: 'RUN pip install -r requirements.txt', sub: '48 MB · 21 s', family: 'ci-build', x: 24, y: 208, w: 400, h: 52, card: { what: bi('Самый долгий шаг. Его ключ — родитель и текст команды: пока выше ничего не поменялось, он берётся из кэша, даже если код приложения другой.', 'The longest step. Its key is the parent and the command text: as long as nothing above changed, it comes from the cache, even if the application code is different.'), who: bi('Ваш Dockerfile.', 'Your Dockerfile.') } },
      { id: 'n-code', label: 'COPY . .', sub: '0.1 MB', family: 'store', x: 24, y: 136, w: 400, h: 52, card: { what: bi('Весь контекст сборки, кроме того, что перечислено в .dockerignore. Любая правка любого файла меняет ключ этого шага.', 'The whole build context except what .dockerignore lists. Any edit of any file changes this step’s key.'), who: bi('Ваш Dockerfile.', 'Your Dockerfile.'), see: 'cat .dockerignore' } },
      { id: 'n-cmd', label: 'CMD ["python", "main.py"]', sub: 'config', family: 'obj', shape: 'doc', x: 24, y: 64, w: 400, h: 52, card: { what: bi('Слоя нет: это строка Cmd в config.', 'No layer: it is the Cmd line in the config.'), who: bi('Ваш Dockerfile.', 'Your Dockerfile.') } },
      { id: 'n-ctx', label: bi('контекст сборки', 'build context'), sub: 'main.py · requirements.txt · README.md', family: 'user', x: 560, y: 136, w: 376, h: 64, card: { what: bi('Каталог, который клиент отправляет сборщику. `.dockerignore` вычёркивает из него лишнее: .git, тестовые данные, секреты.', 'The directory the client sends to the builder. `.dockerignore` strikes out what is not needed: .git, test data, secrets.'), who: bi('Последний аргумент `docker build` (обычно точка).', 'The last argument of `docker build` (usually a dot).') } },
      { id: 'n-cache', label: bi('кэш сборки', 'build cache'), sub: t(bi('ключ → слой', 'key → layer')), family: 'kernel', shape: 'buffer', x: 560, y: 280, w: 376, h: 72, card: { what: bi('Таблица «ключ шага → готовый слой». Ключ = sha256(ключ родителя + текст инструкции + хеш копируемых файлов). С первой изменившейся инструкции и ниже ключи новые.', 'A table “step key → finished layer”. Key = sha256(parent key + instruction text + hash of copied files). From the first changed instruction down, the keys are new.'), who: bi('BuildKit, сборщик Docker.', 'BuildKit, Docker’s builder.'), see: 'docker builder du', doc: { page: 'web/docs.docker.com/build/cache', anchor: 'how-the-cache-works' } } },
      { id: 'n-image', label: bi('образ', 'image'), sub: 'app:1.0', family: 'obj', x: 560, y: 424, w: 376, h: 52, card: { what: bi('Итог: стопка слоёв и config.', 'The result: a stack of layers and a config.'), who: bi('`docker build -t app:1.0 .`', '`docker build -t app:1.0 .`') } },
    ],
    edges: [
      { id: 'e-ctx', from: 'n-ctx', to: 'n-code', label: bi('файлы контекста', 'context files'), card: { what: bi('COPY берёт файлы из контекста; их хеш входит в ключ шага.', 'COPY takes files from the context; their hash goes into the step key.'), who: bi('Сборщик.', 'The builder.') } },
      { id: 'e-req', from: 'n-ctx', to: 'n-req', via: [[520, 168], [520, 306]], label: 'requirements.txt', labelAt: 0.6, card: { what: bi('Отдельный COPY одного файла: зависимости меняются редко, код — часто.', 'A separate COPY of one file: dependencies change rarely, code often.'), who: bi('Сборщик.', 'The builder.') } },
      { id: 'e-key', from: 'n-pip', to: 'n-cache', via: [[480, 234], [480, 316]], label: bi('ключ шага', 'step key'), labelAt: 0.5, card: { what: bi('Сборщик ищет слой по ключу. Нашёл — `CACHED`, не нашёл — выполняет шаг.', 'The builder looks up a layer by key. Found — `CACHED`; not found — it runs the step.'), who: bi('BuildKit.', 'BuildKit.') } },
      { id: 'e-out', from: 'n-cache', to: 'n-image', label: bi('слои', 'layers'), card: { what: bi('Слои из кэша и новые складываются в образ.', 'Cached and new layers are assembled into the image.'), who: bi('BuildKit.', 'BuildKit.') } },
    ],
  },
  params: [
    { id: 'changed', label: bi('Что изменилось с прошлой сборки', 'What changed since the last build'), kind: 'choice', default: 'code', options: [{ id: 'none', label: bi('ничего', 'nothing') }, { id: 'code', label: bi('main.py', 'main.py') }, { id: 'requirements', label: bi('requirements.txt', 'requirements.txt') }, { id: 'readme', label: bi('README.md (в .dockerignore)', 'README.md (in .dockerignore)') }], near: 'n-ctx', predict: { prompt: bi('Поменяли только main.py. Будет ли заново выполняться pip install?', 'Only main.py changed. Will pip install run again?'), options: [{ id: 'cached', text: bi('Нет: он выше COPY . . и его ключ не изменился', 'No: it is above COPY . . and its key did not change') }, { id: 'rerun', text: bi('Да: изменился контекст сборки', 'Yes: the build context changed') }], resolve: (_p, n) => (n.some((s) => s.id === 'pip' && s.states?.['n-pip'] === 'ok') ? 'cached' : 'rerun') } },
    { id: 'order', label: bi('Порядок инструкций', 'Order of instructions'), kind: 'choice', default: 'good', options: [{ id: 'good', label: bi('сначала зависимости, потом код', 'dependencies first, then code') }, { id: 'bad', label: bi('COPY . . перед pip install', 'COPY . . before pip install') }], near: 'n-pip', predict: { prompt: bi('COPY . . поставили выше pip install. Что будет после правки main.py?', 'COPY . . moved above pip install. What happens after editing main.py?'), options: [{ id: 'rerun', text: bi('pip install будет выполняться при каждой правке кода', 'pip install runs again on every code edit') }, { id: 'same', text: bi('Ничего не изменится', 'Nothing changes') }], resolve: (_p, n) => ((n[n.length - 1]?.metrics?.seconds ?? 0) > 10 ? 'rerun' : 'same') } },
    { id: 'noCache', label: bi('--no-cache', '--no-cache'), kind: 'toggle', default: false, near: 'n-cache' },
  ],
  breaks: [
    { id: 'no-ignore', label: bi('Удалить .dockerignore', 'Delete .dockerignore'), remove: ['e-ctx'], boundary: 'storage', predict: { prompt: bi('Удалили .dockerignore (в каталоге .git и 200 МБ testdata/). Что изменится?', 'Deleted .dockerignore (the directory has .git and 200 MB of testdata/). What changes?'), options: [{ id: 'big', text: bi('Контекст вырастет на 200 МБ, а COPY . . будет пересобираться почти всегда', 'The context grows by 200 MB and COPY . . rebuilds almost every time') }, { id: 'none', text: bi('Ничего: Docker сам пропустит лишнее', 'Nothing: Docker skips the extra files itself') }], resolve: () => 'big' } },
    { id: 'rm-later', label: bi('RUN rm -rf /root/.cache отдельной строкой', 'RUN rm -rf /root/.cache on a separate line'), remove: ['e-out'], boundary: 'storage', predict: { prompt: bi('Кэш pip удалили следующей инструкцией RUN rm. Станет ли образ меньше?', 'The pip cache is deleted by the next RUN rm instruction. Will the image get smaller?'), options: [{ id: 'no', text: bi('Нет: файлы остались в предыдущем слое, сверху только пометка об удалении', 'No: the files stay in the previous layer; on top there is only a deletion mark') }, { id: 'yes', text: bi('Да, на размер кэша', 'Yes, by the size of the cache') }], resolve: () => 'no' } },
  ],
  metrics: [
    { id: 'seconds', label: bi('время сборки', 'build time'), unit: 's' },
    { id: 'cached', label: bi('шагов из кэша', 'steps from cache') },
    { id: 'context', label: bi('контекст', 'context'), unit: 'MB' },
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
    ins.forEach((x, i) => {
      const hit = miss < 0 || i < miss;
      if (hit) cached++;
      else seconds += x.ms / 1000;
      size += x.mb;
      const node = NODE[x.id];
      steps.push({
        id: x.id,
        label: x.text.split(' ')[0],
        caption: hit
          ? x.layer
            ? fmt(bi('`{t}` — CACHED: ключ этого шага совпал с прошлой сборкой, слой взят из кэша.', '`{t}` — CACHED: this step’s key matches the last build; the layer comes from the cache.'), { t: x.text })
            : fmt(bi('`{t}` — меняет только config, слоя нет.', '`{t}` — changes only the config, no layer.'), { t: x.text })
          : i === miss
            ? fmt(bi('`{t}` — первый шаг с новым ключом: изменилось {what}. Отсюда и ниже всё пересобирается.', '`{t}` — the first step with a new key: {what} changed. From here down everything rebuilds.'), { t: x.text, what: changedName(changed, p.noCache) })
            : fmt(bi('`{t}` — пересобирается, потому что изменился родитель: ключ включает ключ шага выше.', '`{t}` — rebuilds because its parent changed: the key includes the key of the step above.'), { t: x.text }),
        focus: [node, ...(x.id === 'pip' ? ['e-key', 'n-cache'] : []), ...(x.id === 'copycode' ? ['e-ctx'] : []), ...(x.id === 'copyreq' ? ['e-req'] : [])],
        states: { [node]: hit ? 'ok' : i === miss ? 'warn' : 'on' },
        values: { [node]: hit ? (x.layer ? 'CACHED' : 'config') : `${(x.ms / 1000).toFixed(1)} s` },
        tokens: x.id === 'pip' ? [{ edge: 'e-key' }] : x.id === 'copycode' ? [{ edge: 'e-ctx' }] : [],
        fill: { 'n-cache': cached / ins.length },
        metrics: { seconds: Math.round(seconds * 10) / 10, cached, context, size: Math.round(size) },
      });
    });
    if (broken.has('no-ignore')) {
      steps.push({ id: 'context', label: bi('контекст', 'context'), caption: bi('Без .dockerignore сборщику уезжает весь каталог: .git и 200 МБ testdata/. Каталог .git меняется с каждым коммитом — ключ `COPY . .` почти всегда новый.', 'Without .dockerignore the whole directory travels to the builder: .git and 200 MB of testdata/. .git changes with every commit — the key of `COPY . .` is almost always new.'), focus: ['n-ctx', 'e-ctx', 'n-code'], states: { 'n-ctx': 'warn', 'n-code': 'warn' }, metrics: { seconds: Math.round(seconds * 10) / 10, cached, context, size: Math.round(size) }, broken: { at: 'e-ctx', message: ' => [internal] load build context                      2.4s\n => => transferring context: 200.47MB                   2.4s', caption: bi('лишнее в контексте — это и медленная сборка, и промах кэша, и риск утечки (.env, ключи).', 'extra files in the context mean a slow build, cache misses and a leak risk (.env, keys).') } });
    }
    if (broken.has('rm-later')) {
      steps.push({ id: 'rm', label: 'RUN rm', caption: bi('`RUN rm -rf /root/.cache` создаёт новый слой с пометками об удалении. Предыдущий слой с кэшем никуда не делся — образ не уменьшился.', '`RUN rm -rf /root/.cache` makes a new layer of deletion marks. The previous layer with the cache is still there — the image did not shrink.'), focus: ['n-pip', 'n-image'], states: { 'n-image': 'warn' }, metrics: { seconds: Math.round((seconds + 0.3) * 10) / 10, cached, context, size: Math.round(size) }, broken: { at: 'e-out', message: 'IMAGE          CREATED BY                                SIZE\n<missing>      RUN /bin/sh -c rm -rf /root/.cache        0B\n<missing>      RUN /bin/sh -c pip install -r require…   48MB', caption: bi('удалять нужно в той же инструкции RUN, где файлы появились, или брать multi-stage.', 'delete in the same RUN that created the files, or use a multi-stage build.') } });
    } else {
      steps.push({ id: 'image', label: bi('образ', 'image'), caption: fmt(bi('Образ собран за {s} с: {c} шагов из кэша. Размер {mb} МБ.', 'The image is built in {s} s: {c} steps from the cache. Size {mb} MB.'), { s: Math.round(seconds * 10) / 10, c: cached, mb: Math.round(size) }), focus: ['e-out', 'n-image'], tokens: [{ edge: 'e-out' }], states: { 'n-image': 'ok' }, metrics: { seconds: Math.round(seconds * 10) / 10, cached, context, size: Math.round(size) } });
    }
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана.', 'The failure is removed.');
      return change.id === 'no-ignore' ? fmt(bi('Без .dockerignore контекст — {c} МБ, и .git меняется с каждым коммитом: COPY . . почти всегда мимо кэша.', 'Without .dockerignore the context is {c} MB and .git changes with every commit: COPY . . almost always misses the cache.'), { c: m.context ?? 0 }) : bi('Отдельный RUN rm добавляет слой пометок, а не уменьшает предыдущий.', 'A separate RUN rm adds a layer of marks; it does not shrink the previous one.');
    }
    if (change.id === 'noCache') return b.noCache ? fmt(bi('--no-cache: кэш не используется, сборка {s} с.', '--no-cache: the cache is not used; the build takes {s} s.'), { s: m.seconds ?? 0 }) : bi('Кэш снова используется.', 'The cache is used again.');
    if (change.id === 'order') return b.order === 'bad' ? fmt(bi('COPY . . выше pip install: любая правка кода сбивает ключ — сборка {s} с.', 'COPY . . above pip install: any code edit changes the key — the build takes {s} s.'), { s: m.seconds ?? 0 }) : fmt(bi('Сначала зависимости: правка кода пересобирает только последний COPY — {s} с.', 'Dependencies first: a code edit rebuilds only the last COPY — {s} s.'), { s: m.seconds ?? 0 });
    return fmt(bi('Изменилось: {w}. Из кэша {c} шагов, сборка {s} с.', 'Changed: {w}. {c} steps from the cache, the build takes {s} s.'), { w: changedName(b.changed, false), c: m.cached ?? 0, s: m.seconds ?? 0 });
  },
});

function changedName(c: string, noCache: boolean): string {
  if (noCache) return '--no-cache';
  return { none: '—', code: 'main.py', requirements: 'requirements.txt', readme: 'README.md', git: '.git' }[c] ?? c;
}
