// The CI/CD exam on real machines in the tab (design 00 §6.13): the same
// café site, but the forge is git.lab, the runner is a real Linux machine
// (shell executor) and the site is served by nginx on a real VM booted by the
// in-tab cloud. Goals read what git.lab, ci.lab and the VM report, never the
// typed commands. The lab widget is `iac.cloudlab` (blocks/iac/cloudlab).

import { bi } from '../../../core/i18n';
import type { Exam, Facts, QuizItem } from '../../../core/types';
import type { CloudLabFacts } from '../../iac/cloudlab/facts';
import { quiz } from './cicd';

type LabF = Facts & Partial<CloudLabFacts>;
const lf = (f: Facts) => f as LabF;
const sitePipes = (f: Facts) => (lf(f).ci?.pipelines ?? []).filter((p) => p.repo === 'site');

const PAGE = '<!doctype html>\n<title>Café</title>\n<h1>Café: release 2</h1>\n<p>Fresh beans every morning.</p>\n';
const TEST = '#!/bin/sh\n# The page must have a title and a heading.\nset -e\ngrep -q "<title>" public/index.html\ngrep -q "<h1>" public/index.html\necho "site ok"\n';
const NGINX = `#!/bin/sh
cat > /etc/nginx/http.d/default.conf <<'EOF'
server {
  listen 80 default_server;
  root /var/www/site;
}
EOF
mkdir -p /var/www/site
echo "<h1>Café: release 1</h1>" > /var/www/site/index.html
rc-service nginx start
`;
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const CICD_TAB_EXAM: Exam = {
  id: 'cicd.exam.tab',
  block: 'cicd',
  kind: 'block',
  title: bi('Экзамен по CI/CD на настоящих машинах', 'CI/CD on real machines: deploying the site'),
  story: bi(
    'Сайт кофейни теперь работает на виртуальной машине `web-1`, и новую версию на неё до сих пор копируют вручную. Тимлид хочет, чтобы выкладку делал пайплайн, причём проверка должна идти на каждой ветке, а выкладка только из `main`.',
    'The café site now runs on the virtual machine `web-1`, and new versions are still copied there by hand. The team lead wants the pipeline to deploy: a check on every branch, a deployment only from `main`.',
  ),
  intro: bi(
    'Экзамен в этой вкладке проходит на настоящих машинах. У вас есть рабочая станция, Git-сервер `git.lab`, раннер CI с исполнителем shell и виртуальная машина `web-1` с nginx. Цели проверяются по тому, что видят git.lab, ci.lab и сама виртуальная машина. Открыты справочник GitLab CI и справка команд, а подсказок нет. Для этой вкладки нужно около 2 ГБ свободной памяти.',
    'An exam in this tab on real machines: a workstation, the Git server `git.lab`, a CI runner with the shell executor and the VM `web-1` with nginx. Goals are judged by what git.lab, ci.lab and the VM itself see. The GitLab CI reference and the command help are open; no hints. The tab needs about 2 GB of free memory.',
  ),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['docs.gitlab.com', 'help', 'man'],
  inTab: {
    widget: 'iac.cloudlab',
    props: {
      intro: bi('Код сайта лежит в каталоге `~/site`. Раннер подключается к `web-1` по SSH с ключом рабочей станции `~/.ssh/id_ed25519`.', 'The site code is in `~/site`. The runner reaches `web-1` over SSH with the workstation’s key `~/.ssh/id_ed25519`.'),
      ci: true,
      token: false,
      vmWatch: ['/var/www/site/index.html'],
      vmScopes: ['listen'],
      setup: [
        '[ -f /root/.ssh/id_ed25519 ] || (mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519)',
        `mkdir -p /root/site/public && printf '%s' ${q(PAGE)} > /root/site/public/index.html && printf '%s' ${q(TEST)} > /root/site/test.sh`,
        'git config --global user.name "Learner" && git config --global user.email learner@ws.lab && git config --global init.defaultBranch main',
        'printf "Host web-1 web-1.vm.lab\\n  StrictHostKeyChecking accept-new\\n" >> /root/.ssh/config',
      ],
      seed: [{ method: 'POST', path: '/v1/projects/{project}/vms', body: { name: 'web-1', flavor: 'lab.small', image: 'lab-node', ssh_authorized_keys: ['{ws_pubkey}'], user_data: NGINX } }],
    },
  },
  tasks: [
    {
      id: 'deploy',
      weight: 3,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('«Репозиторий находится по адресу `http://git.lab/site.git`, ветка `main`. Стадия test запускает `sh test.sh`, а стадия deploy копирует `public/index.html` в каталог `/var/www/site/` на `web-1` и выполняется только на `main`. На `web-1` должна открываться release 2».', '“The repository `http://git.lab/site.git`, branch `main`. The test stage runs `sh test.sh`, the deploy stage copies `public/index.html` to `/var/www/site/` on `web-1` and runs only on `main`. `web-1` must serve release 2.”'),
        concepts: ['cicd.stage', 'cicd.runner', 'cicd.rules'],
        goals: [
          { id: 'green', label: bi('последний пайплайн `main` прошёл, и в нём были test и deploy', 'the last `main` pipeline passed and had test and deploy'), on: 'cloud', check: { when: (f) => { const p = sitePipes(f).filter((x) => x.ref === 'main').at(-1); return !!p && p.status === 'success' && p.jobs.length >= 2 && p.jobs.some((j) => j.stage === 'test' && j.status === 'success') && p.jobs.some((j) => j.stage === 'deploy' && j.status === 'success'); } } },
          { id: 'served', label: bi('`web-1` отдаёт release 2', '`web-1` serves release 2'), on: 'web-1', check: { when: "files['/var/www/site/index.html'].text ~ 'release 2' && listen[port=80]" } },
        ],
      },
    },
    {
      id: 'branch',
      weight: 2,
      kind: 'real',
      real: {
        prompt: bi('«Ветки не должны выкладываться». Отправьте на сервер ветку `typo` с любой правкой. Пайплайн этой ветки должен пройти test, а deploy в нём быть не должно.', '“Branches are not deployed.” Push a branch `typo` with any edit: its pipeline passes test and has no deploy.'),
        concepts: ['cicd.rules'],
        goals: [{ id: 'nodeploy', label: bi('в пайплайне `typo` test прошёл, а deploy нет', 'the `typo` pipeline: test passed, no deploy'), on: 'cloud', check: { when: (f) => sitePipes(f).some((p) => p.ref === 'typo' && p.jobs.some((j) => j.stage === 'test' && j.status === 'success') && !p.jobs.some((j) => j.stage === 'deploy')) } }],
      },
    },
    {
      id: 'broken',
      weight: 2,
      kind: 'real',
      real: {
        prompt: bi('«Сломанная страница не должна попасть на `web-1`». Отправьте в `main` версию без `<h1>`. Пайплайн должен упасть на test, deploy не должен запуститься, а на `web-1` должна остаться release 2. Затем верните страницу.', '“A broken page must not reach `web-1`.” Push a version without `<h1>` to `main`: the pipeline fails at test, deploy does not run, `web-1` keeps release 2. Then restore the page.'),
        concepts: ['cicd.stage'],
        goals: [
          { id: 'stopped', label: bi('есть пайплайн `main`, который упал на test, и deploy в нём пропущен', 'there is a `main` pipeline that failed at test with deploy skipped'), on: 'cloud', check: { when: (f) => sitePipes(f).some((p) => p.ref === 'main' && p.status === 'failed' && p.jobs.some((j) => j.stage === 'test' && j.status === 'failed') && p.jobs.some((j) => j.stage === 'deploy' && j.status === 'skipped')) } },
          { id: 'kept', label: bi('на `web-1` по-прежнему release 2', '`web-1` still serves release 2'), on: 'web-1', check: { when: "files['/var/www/site/index.html'].text ~ 'release 2'" } },
        ],
      },
    },
    { id: 'q-stages', weight: 1, kind: 'quiz', item: { ...(quiz.find((x) => x.id === 'cicd.q.stages-order') as QuizItem), id: 'cicd.exam.tab.q.stages' } },
  ],
  explain: [
    { id: 'shell', prompt: bi('Тимлид спрашивает, чем раннер с исполнителем shell отличается от раннера с Docker и чем он опасен. Ответьте ему.', '“How does a runner with the shell executor differ from one with Docker, and what is risky about it?”'), keyPoints: [bi('джоба выполняется прямо на машине раннера без изоляции', 'the job runs right on the runner machine, without isolation'), bi('всё, что установила одна джоба, видит следующая', 'whatever one job installs, the next one sees'), bi('у джобы есть права пользователя раннера и его ключи', 'the job has the runner user’s rights and keys')] },
  ],
};
