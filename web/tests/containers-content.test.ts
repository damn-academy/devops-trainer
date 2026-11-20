// The containers block: every explainer recomputes for every knob and break,
// and the labs can actually be solved on the simulator (solutions typed as a
// learner would, checks evaluated on the facts).

import { beforeAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import type { ProcessModel, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { terminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import dsim from '../src/engine/dsim/module';
import block from '../src/blocks/containers/index';
import { stackModel, stackNumbers } from '../src/blocks/containers/explainers/stack';
import { plan, firstMiss } from '../src/blocks/containers/explainers/build';
import { stopResult } from '../src/blocks/containers/explainers/stop';
import { netPathModel } from '../src/blocks/containers/explainers/netpath';
import { lintPlacement } from '../src/engine/quiz/placement';

beforeAll(() => {
  for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...(dsim.commands ?? [])]) if (!terminalRegistry.commands.get(c.name)) terminalRegistry.commands.add(c);
  for (const f of dsim.facts ?? []) if (!terminalRegistry.facts.some((x) => x.scope === f.scope)) terminalRegistry.facts.push(f);
  for (const s of dsim.setup ?? []) if (!terminalRegistry.setup.some((x) => x.key === s.key)) terminalRegistry.setup.push(s);
});

describe('containers explainers', () => {
  const models = (block.explainers ?? []).map((e) => e.model as ProcessModel<Record<string, unknown>>);

  it('has nine models with at most 12 nodes', () => {
    expect(models).toHaveLength(9);
    for (const m of models) expect(m.diagram.nodes.length).toBeLessThanOrEqual(12);
  });

  it('recomputes for every knob value and every break, and predictions resolve to an option', () => {
    for (const m of models) {
      const defaults = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
      const base = m.run(defaults, new Set());
      expect(base.length).toBeGreaterThan(1);
      const ids = new Set([...m.diagram.nodes.map((n) => n.id), ...m.diagram.edges.map((e) => e.id), ...(m.diagram.groups ?? []).map((g) => g.id)]);
      for (const p of m.params) {
        const values = p.kind === 'toggle' ? [true, false] : p.kind === 'choice' ? p.options!.map((o) => o.id) : [p.min!, p.max!, p.default];
        for (const v of values) {
          const next = { ...defaults, [p.id]: v };
          const steps = m.run(next, new Set());
          for (const s of steps) for (const f of s.focus) expect(ids.has(f), `${m.id}: focus ${f}`).toBe(true);
          const delta = m.explainDelta(base, steps, { kind: 'param', id: p.id, from: p.default, to: v }, defaults, next);
          expect(delta.ru && delta.en, `${m.id}.${p.id}`).toBeTruthy();
          if (p.predict) expect(p.predict.options.map((o) => o.id)).toContain(p.predict.resolve(base, steps));
        }
      }
      for (const b of m.breaks) {
        const steps = m.run(defaults, new Set([b.id]));
        expect(steps.some((s) => s.broken), `${m.id}: break ${b.id} reports where it stopped`).toBe(true);
        expect(b.predict.options.map((o) => o.id)).toContain(b.predict.resolve(base, steps));
        const d = m.explainDelta(base, steps, { kind: 'break', id: b.id, on: true }, defaults, defaults);
        expect(d.ru && d.en).toBeTruthy();
      }
    }
  });

  it('keeps the counters of the flagship model honest', () => {
    const n = stackNumbers(30);
    expect(n.vmFit).toBe(12);
    expect(n.vmOut).toBe(13);
    expect(n.ctOut).toBe(0);
    expect(n.ctMem).toBeLessThan(n.vmMem);
  });

  it('agrees Russian numerals with the number of applications and machines', () => {
    const caps = (apps: number) => stackModel.run({ apps, conflict: true, vuln: false, otherKernel: false }, new Set()).map((st) => st.caption.ru).join(' ');
    expect(caps(1)).toContain('На 1 приложение сервер');
    expect(caps(1)).toContain('работает 1 виртуальная машина');
    expect(caps(4)).toContain('На 4 приложения сервер');
    expect(caps(4)).toContain('работают 4 виртуальные машины');
    expect(caps(30)).toContain('На 30 приложений сервер');
    expect(caps(30)).toContain('работают 12 виртуальных машин');
  });

  it('rebuilds from the first changed instruction', () => {
    expect(plan('good')[firstMiss(plan('good'), 'code', false)].text).toBe('COPY . .');
    expect(plan('bad')[firstMiss(plan('bad'), 'code', false)].text).toBe('COPY . .');
    expect(plan('bad').findIndex((i) => i.id === 'pip')).toBeGreaterThan(firstMiss(plan('bad'), 'code', false));
    expect(firstMiss(plan('good'), 'readme', false)).toBe(-1);
  });

  it('applies the PID 1 rule in the stop model the same way as the engine', () => {
    expect(stopResult('shell', 10, 'SIGTERM')).toMatchObject({ code: 137, ms: 10_000 });
    expect(stopResult('nohandler', 10, 'SIGTERM')).toMatchObject({ code: 137 });
    expect(stopResult('handler', 10, 'SIGTERM')).toMatchObject({ code: 0 });
    expect(stopResult('init', 10, 'SIGTERM')).toMatchObject({ code: 143 });
    expect(stopResult('nohandler', 10, 'SIGINT')).toMatchObject({ code: 130 });
  });
});

const fast = (s: TerminalSetup): TerminalSetup => ({ ...s, ext: { ...(s.ext ?? {}), docker: { ...((s.ext?.docker as object) ?? {}), timeScale: 0 } } });

async function solve(lessonId: string, sectionId: string, solutions: Record<string, string[]>) {
  const lesson = block.lessons!.find((l) => l.id === lessonId)!;
  const sec = lesson.sections.find((s) => s.id === sectionId) as TerminalSection;
  const m: SimMachine = await createSimMachine(fast(sec.setup));
  const start = await m.facts();
  const results: Record<string, boolean> = {};
  for (const t of sec.tasks as Task[]) {
    for (const line of solutions[t.id] ?? []) await m.exec(line);
    results[t.id] = evaluateCheck(t.check, await m.facts(), start).pass;
  }
  return results;
}

describe('containers labs can be solved', () => {
  it('first steps', async () => {
    const r = await solve('containers.first-steps', 'lab', {
      hello: ['docker run hello-world', 'docker ps -a'],
      web: ['docker run -d --name web -p 8080:80 nginx:1.30-alpine'],
      page: ["docker exec web sh -c 'echo Hello, DevOps > /usr/share/nginx/html/index.html'"],
      env: ['docker run -d --name db postgres:17-alpine', 'docker logs db', 'docker rm db', 'docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:17-alpine'],
      interactive: ['docker run -dit --name box alpine:3.22', 'docker exec box ps'],
      cleanup: ['docker rm -f db box', 'docker container prune -f'],
    });
    expect(r).toEqual({ hello: true, web: true, page: true, env: true, interactive: true, cleanup: true });
  });

  it('the image', async () => {
    const r = await solve('containers.image', 'lab', {
      pull: ['docker pull nginx:1.30-alpine'],
      count: ["docker image inspect nginx:1.30-alpine --format '{{len .RootFS.Layers}}'"],
      history: ['docker history nginx:1.30-alpine'],
      push: ['docker tag nginx:1.30-alpine registry.lab/learner/web:1.0', 'docker push registry.lab/learner/web:1.0'],
      digest: ['docker pull alpine@sha256:2906d475629a72acbc446f89121308df237675baa3e6992575107246d55f9e62'],
    });
    expect(r).toEqual({ pull: true, count: true, history: true, push: true, digest: true });
  });

  it('storage and networks', async () => {
    const r = await solve('containers.storage-net', 'lab', {
      dns: ['docker network create app', 'docker network connect app db', 'docker network connect app api'],
      volume: ['docker rm -f db', 'docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:17-alpine'],
      bind: ['docker run -d --name dev -p 8080:80 -v ~/site:/usr/share/nginx/html nginx:1.30-alpine', "echo '<h1>v2</h1>' > ~/site/index.html"],
    });
    expect(r).toEqual({ dns: true, volume: true, bind: true });
  });

  it('does not count the digest goal before the learner pulls by digest', async () => {
    const r = await solve('containers.image', 'lab', { pull: ['docker pull nginx:1.30-alpine'] });
    expect(r.digest).toBe(false);
  });

  it('explains a name conflict in the first steps', async () => {
    const lesson = block.lessons!.find((l) => l.id === 'containers.first-steps')!;
    const sec = lesson.sections.find((s) => s.id === 'lab') as TerminalSection;
    const m = await createSimMachine(fast(sec.setup));
    await m.exec('docker run -d --name web nginx:1.30-alpine');
    await m.exec('docker run -d --name web -p 8080:80 nginx:1.30-alpine');
    const web = (sec.tasks as Task[]).find((t) => t.id === 'web')!;
    const res = evaluateCheck(web.check, await m.facts());
    expect(res.pass).toBe(false);
    expect(res.say?.ru).toContain('docker rm -f web');
  });

  it('a container by hand', async () => {
    const r = await solve('containers.by-hand', 'lab', {
      chroot: ['chroot /c/rootfs /bin/sh', 'ls /'],
      uts: ['exit', 'unshare --uts sh', 'hostname box'],
      pid: ['exit', 'unshare --pid --fork --mount sh', 'mount -t proc proc /proc'],
      cgroup: ['exit', 'mkdir /sys/fs/cgroup/box && echo 16M > /sys/fs/cgroup/box/memory.max && echo 20 > /sys/fs/cgroup/box/pids.max && echo $$ > /sys/fs/cgroup/box/cgroup.procs'],
      overlay: ['mount -t overlay overlay -o lowerdir=/c/l2:/c/l1,upperdir=/c/upper,workdir=/c/work /c/merged'],
      caps: ["capsh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'"],
      crun: ['cd /c/bundle && cp -r /c/rootfs rootfs && crun spec && crun run mybox', 'hostname', 'exit'],
    });
    expect(r).toEqual({ chroot: true, uts: true, pid: true, cgroup: true, overlay: true, caps: true, crun: true });
  });

  it('the anatomy lab, with crun list accepted for the created state', async () => {
    const r = await solve('containers.anatomy', 'lab', {
      spec: ['crun spec'],
      namespaces: ['cat config.json'],
      create: ['crun create box', 'crun list'],
      start: ['crun start box', 'hostname', 'exit', 'crun state box'],
      delete: ['crun delete box', 'crun list'],
    });
    expect(r).toEqual({ spec: true, namespaces: true, create: true, start: true, delete: true });
  });

  it('the boundary drills', async () => {
    const r = await solve('containers.boundaries', 'drills', {
      'b-kernel': ['docker logs tool', 'docker run --rm trainer/tool:1.0-multiarch'],
      'b-network': ['docker rm -f web', 'docker run -d --name web -p 8080:8000 -e BIND=0.0.0.0 trainer/web:1.0'],
      'b-io': ['docker rm -f logger', 'docker run -d --name logger -e LOG_FILE=/dev/stdout trainer/logger:1.0'],
      'b-identity': ['docker exec -u 0 app chown 1001 /data', 'docker exec app touch /data/ok'],
      'b-process': ['docker rm front', "docker run -d --name front nginx:1.30-alpine nginx -g 'daemon off;'"],
    });
    expect(r).toEqual({ 'b-kernel': true, 'b-network': true, 'b-io': true, 'b-identity': true, 'b-process': true });
  });

  it('security', async () => {
    const r = await solve('containers.security', 'lab', {
      nonroot: ['docker run -d --name app --user 1000:1000 alpine:3.22 sleep 3600'],
      minimal: ['docker run -d --name web -p 8080:80 --read-only --tmpfs /var/cache/nginx --tmpfs /run --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID --cap-add NET_BIND_SERVICE --security-opt no-new-privileges nginx:1.30-alpine'],
    });
    expect(r).toEqual({ nonroot: true, minimal: true });
  });

  it('the Dockerfile chapter', async () => {
    const r = await solve('containers.dockerfile', 'lab', {
      site: ["echo 'FROM nginx:1.30-alpine' > ~/site/Dockerfile", "echo 'COPY index.html /usr/share/nginx/html/' >> ~/site/Dockerfile", 'docker build -t site:1.0 ~/site', 'docker run -d -p 8080:80 site:1.0'],
      cache: [
        "echo 'FROM python:3.13-slim' > ~/app/Dockerfile",
        "echo 'WORKDIR /app' >> ~/app/Dockerfile",
        "echo 'COPY requirements.txt .' >> ~/app/Dockerfile",
        "echo 'RUN pip install -r requirements.txt' >> ~/app/Dockerfile",
        "echo 'COPY . .' >> ~/app/Dockerfile",
        'docker build -t app:1.0 ~/app',
        "echo 'print(1)' > ~/app/main.py",
        'docker build -t app:1.1 ~/app',
      ],
      stop: ["echo 'FROM python:3.13-slim' > ~/stop/Dockerfile", "echo 'COPY app.py /app/' >> ~/stop/Dockerfile", `echo 'CMD ["python", "/app/app.py"]' >> ~/stop/Dockerfile`, 'docker build -t stopper:1.1 ~/stop', 'docker run -d --init --name app stopper:1.1', 'docker stop app'],
      small: ["echo 'FROM golang:1.25 AS build' > ~/go/Dockerfile", "echo 'WORKDIR /src' >> ~/go/Dockerfile", "echo 'COPY . .' >> ~/go/Dockerfile", "echo 'RUN go build -o /out/app .' >> ~/go/Dockerfile", "echo 'FROM alpine:3.22' >> ~/go/Dockerfile", "echo 'COPY --from=build /out/app /usr/local/bin/app' >> ~/go/Dockerfile", `echo 'CMD ["app"]' >> ~/go/Dockerfile`, 'docker build -t goapp:small ~/go'],
    });
    expect(r).toEqual({ site: true, cache: true, stop: true, small: true });
  });

  it('accepts a two-stage Go build on scratch and refuses a single stage', async () => {
    const twoStage = await solve('containers.dockerfile', 'lab', {
      small: [`printf 'FROM golang:1.25 AS build\\nWORKDIR /src\\nCOPY . .\\nRUN CGO_ENABLED=0 go build -o /out/app .\\nFROM scratch\\nCOPY --from=build /out/app /app\\nCMD ["/app"]\\n' > ~/go/Dockerfile`, 'docker build -t goapp:small ~/go'],
    });
    expect(twoStage.small).toBe(true);
    const oneStage = await solve('containers.dockerfile', 'lab', { small: ["echo 'FROM alpine:3.22' > ~/go/Dockerfile", 'docker build -t goapp:small ~/go'] });
    expect(oneStage.small).toBe(false);
  });

  it('compose', async () => {
    const healthy = `cat > compose.yaml <<'EOF'
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
  api:
    image: trainer/api:1.0
    environment:
      DB_HOST: db
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
volumes:
  db-data:
EOF`;
    const r = await solve('containers.compose', 'lab', {
      up: ['docker compose up -d', 'docker compose ps -a'],
      healthy: [healthy, 'docker compose up -d --force-recreate'],
      persist: ['docker compose down', 'docker compose up -d'],
    });
    expect(r).toEqual({ up: true, healthy: true, persist: true });
    const early = await solve('containers.compose', 'lab', { up: ['docker compose up -d'], healthy: [healthy, 'docker compose up -d --force-recreate'] });
    expect(early.persist).toBe(false);
  });
});


describe('containers: second persona round', () => {
  it('the placement check has 5–10 tasks per level, at least half of them practical', () => {
    expect(lintPlacement(block.blocks![0].placement)).toEqual([]);
  });

  async function place(id: string, lines: string[]) {
    const t = block.blocks![0].placement.find((x) => x.id === id)!;
    if (t.kind !== 'task') throw new Error(`${id} is not a task`);
    const m = await createSimMachine(fast(t.setup));
    const start = await m.facts();
    for (const line of lines) await m.exec(line);
    return evaluateCheck(t.task.check, await m.facts(), start).pass;
  }

  it('the practical placement tasks can be solved', async () => {
    expect(await place('containers.place.env', ['docker logs db', 'docker rm db', 'docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:17-alpine'])).toBe(true);
    expect(await place('containers.place.dns', ['docker network create app', 'docker network connect app db', 'docker network connect app api'])).toBe(true);
    expect(await place('containers.place.dns-x', [])).toBe(false);
    expect(await place('containers.place.small', [`printf 'FROM golang:1.25 AS build\\nWORKDIR /src\\nCOPY . .\\nRUN CGO_ENABLED=0 go build -o /out/app .\\nFROM scratch\\nCOPY --from=build /out/app /app\\nCMD ["/app"]\\n' > ~/go/Dockerfile`, 'docker build -t goapp:small ~/go'])).toBe(true);
    expect(await place('containers.place.stop', [`printf 'FROM python:3.13-slim\\nCOPY app.py /app/\\nCMD ["python", "/app/app.py"]\\n' > ~/stop/Dockerfile`, 'docker build -t stopper:1.0 ~/stop', 'docker run -d --init --name app stopper:1.0', 'docker stop app'])).toBe(true);
    expect(await place('containers.place.cache-x', [`printf 'FROM python:3.13-slim\\nWORKDIR /app\\nCOPY requirements.txt .\\nRUN pip install -r requirements.txt\\nCOPY . .\\nCMD ["python", "main.py"]\\n' > ~/app/Dockerfile`, 'docker build -t app:1 ~/app', "echo 'print(2)' > ~/app/main.py", 'docker build -t app:2 ~/app'])).toBe(true);
  });

  it('the net-path model: localhost from a container stays in the container, names need a user network', () => {
    const run = (p: Record<string, unknown>, b: string[] = []) => netPathModel.run({ request: 'published', userNet: true, netHost: false, addHost: true, hostLocalOnly: false, ...p } as never, new Set(b));
    const fails = (p: Record<string, unknown>, b: string[] = []) => run(p, b).some((s) => s.broken);
    expect(fails({})).toBe(false);
    expect(fails({}, ['web-local'])).toBe(true);
    expect(fails({ request: 'name' })).toBe(false);
    expect(fails({ request: 'name', userNet: false })).toBe(true);
    expect(fails({ request: 'localhost' })).toBe(true);
    expect(fails({ request: 'localhost', netHost: true })).toBe(false);
    expect(fails({ request: 'hostgw' })).toBe(false);
    expect(fails({ request: 'hostgw', addHost: false })).toBe(true);
    expect(fails({ request: 'hostgw', hostLocalOnly: true })).toBe(true);
    expect(fails({ request: 'egress' })).toBe(false);
  });

  it('explains the build-context error in the Dockerfile lab and accepts grep for the namespaces goal', async () => {
    const lesson = block.lessons!.find((l) => l.id === 'containers.dockerfile')!;
    const sec = lesson.sections.find((s) => s.id === 'lab') as TerminalSection;
    const m = await createSimMachine(fast(sec.setup));
    await m.exec('cd ~/site');
    await m.exec("echo 'FROM nginx:1.30-alpine' > Dockerfile");
    await m.exec('docker build -t site:1.0 .');
    const site = (sec.tasks as Task[]).find((t) => t.id === 'site')!;
    const res = evaluateCheck(site.check, await m.facts());
    expect(res.pass).toBe(false);
    expect(res.say?.ru).toContain('В этом тренажёре контекст сборки');
    const a = await solve('containers.anatomy', 'lab', { spec: ['crun spec'], namespaces: ['grep -n namespaces config.json'] });
    expect(a.namespaces).toBe(true);
  });

  it('the interview asks situations the lessons did not', () => {
    const interview = block.lessons!.find((l) => l.id === 'containers.interview')!;
    const twelve = (interview.sections.find((s) => s.id === 'twelve') as { items: string[] }).items;
    expect(twelve).toHaveLength(12);
    const inLessons = new Set(block.lessons!.filter((l) => l.id !== 'containers.interview').flatMap((l) => l.sections.flatMap((s) => (s.kind === 'quiz' ? s.items.map((x) => (typeof x === 'string' ? x : x.id)) : []))));
    expect(twelve.filter((id) => inLessons.has(id))).toEqual([]);
  });
});
