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
import { stackNumbers } from '../src/blocks/containers/explainers/stack';
import { plan, firstMiss } from '../src/blocks/containers/explainers/build';
import { stopResult } from '../src/blocks/containers/explainers/stop';

beforeAll(() => {
  for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...(dsim.commands ?? [])]) if (!terminalRegistry.commands.get(c.name)) terminalRegistry.commands.add(c);
  for (const f of dsim.facts ?? []) if (!terminalRegistry.facts.some((x) => x.scope === f.scope)) terminalRegistry.facts.push(f);
  for (const s of dsim.setup ?? []) if (!terminalRegistry.setup.some((x) => x.key === s.key)) terminalRegistry.setup.push(s);
});

describe('containers explainers', () => {
  const models = (block.explainers ?? []).map((e) => e.model as ProcessModel<Record<string, unknown>>);

  it('has eight models with at most 12 nodes', () => {
    expect(models).toHaveLength(8);
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
      digest: [],
    });
    expect(r).toMatchObject({ pull: true, count: true, history: true, push: true });
  });

  it('storage and networks', async () => {
    const r = await solve('containers.storage-net', 'lab', {
      dns: ['docker network create app', 'docker network connect app db', 'docker network connect app api'],
      volume: ['docker rm -f db', 'docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:17-alpine'],
      bind: ['docker run -d --name dev -p 8080:80 -v ~/site:/usr/share/nginx/html nginx:1.30-alpine', "echo '<h1>v2</h1>' > ~/site/index.html"],
    });
    expect(r).toEqual({ dns: true, volume: true, bind: true });
  });

  it('the boundary drills', async () => {
    const r = await solve('containers.boundaries', 'drills', {
      'b-kernel': ['docker logs tool', 'docker run trainer/tool:1.0-multiarch'],
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
  });
});
