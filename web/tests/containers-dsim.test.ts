import { beforeAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { terminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import dsim from '../src/engine/dsim/module';
import { dockerOf, parseRef, stopOutcome } from '../src/engine/dsim/engine';
import { diff, merge, chainIds, makeLayer, file, whiteout } from '../src/engine/dsim/layers';
import { render } from '../src/engine/dsim/template';
import { parseDockerfile, ignoredBy } from '../src/engine/dsim/build';
import type { TerminalSetup } from '../src/core/types';

beforeAll(() => {
  for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...(dsim.commands ?? [])]) if (!terminalRegistry.commands.get(c.name)) terminalRegistry.commands.add(c);
  for (const f of dsim.facts ?? []) if (!terminalRegistry.facts.some((x) => x.scope === f.scope)) terminalRegistry.facts.push(f);
  for (const s of dsim.setup ?? []) if (!terminalRegistry.setup.some((x) => x.key === s.key)) terminalRegistry.setup.push(s);
});

const fast: TerminalSetup = { ext: { docker: { timeScale: 0 } } };
const mk = (setup: TerminalSetup = fast) => createSimMachine({ ...setup, ext: { docker: { timeScale: 0, ...((setup.ext?.docker as object) ?? {}) } } });
const sh = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('dsim: layers and digests', () => {
  it('merges layers bottom-up with whiteouts and computes a ChainID', async () => {
    const l1 = { '/etc/a': file('a'), '/www/index.html': file('old'), '/www/old.txt': file('x') };
    const l2 = { '/www/index.html': file('new'), '/www/old.txt': whiteout() };
    const merged = merge([l1, l2]);
    expect(merged['/www/index.html'].text).toBe('new');
    expect(merged['/www/old.txt']).toBeUndefined();
    expect(diff(l1, merged)['/www/old.txt'].t).toBe('w');
    const a = await makeLayer(l1, 'COPY');
    const b = await makeLayer(l2, 'COPY');
    expect(a.diffId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a.digest).not.toBe(a.diffId);
    const chain = await chainIds([a.diffId, b.diffId]);
    expect(chain[0]).toBe(a.diffId);
    expect(chain[1]).not.toBe(b.diffId);
    // the same content gives the same digest
    expect((await makeLayer(l1, 'other')).diffId).toBe(a.diffId);
  });

  it('parses image references', () => {
    expect(parseRef('nginx')).toMatchObject({ registry: 'docker.io', repo: 'library/nginx', tag: 'latest' });
    expect(parseRef('registry.lab/learner/web:1.0')).toMatchObject({ registry: 'registry.lab', repo: 'learner/web', tag: '1.0' });
    expect(parseRef('NGINX')).toBeNull();
  });

  it('renders Go templates for --format', () => {
    const d = { State: { Status: 'running' }, Mounts: [{ Destination: '/a' }, { Destination: '/b' }], Config: { Labels: { k: 'v' } } };
    expect(render('{{.State.Status}}', d)).toBe('running');
    expect(render('{{range .Mounts}}{{.Destination}} {{end}}', d)).toBe('/a /b ');
    expect(render('{{index .Config.Labels "k"}} {{len .Mounts}}', d)).toBe('v 2');
    expect(render('{{json .State}}', d)).toBe('{"Status":"running"}');
  });
});

describe('dsim: containers', () => {
  it('runs hello-world: pull, create, run, exit 0', async () => {
    const m = await mk();
    const r = await sh(m, 'docker run hello-world');
    expect(r.out).toContain("Unable to find image 'hello-world:latest' locally");
    expect(r.out).toContain('Pull complete');
    expect(r.out).toContain('Hello from Docker!');
    expect(r.exit).toBe(0);
    const ps = await sh(m, 'docker ps -a');
    expect(ps.out).toMatch(/hello-world\s+"\/hello"/);
    expect(ps.out).toContain('Exited (0)');
    expect((await sh(m, 'docker ps')).out.trim().split('\n')).toHaveLength(1);
  });

  it('publishes a port and serves files from the container', async () => {
    const m = await mk();
    const r = await sh(m, 'docker run -d --name web -p 8080:80 nginx:1.30-alpine');
    expect(r.out.trim().split('\n').pop()).toMatch(/^[0-9a-f]{64}$/);
    expect((await sh(m, 'curl -s localhost:8080')).out).toContain('Welcome to nginx!');
    await sh(m, "docker exec web sh -c 'echo Hello, DevOps > /usr/share/nginx/html/index.html'");
    expect((await sh(m, 'curl -s localhost:8080')).out).toBe('Hello, DevOps\n');
    expect((await sh(m, 'docker diff web')).out).toContain('C /usr/share/nginx/html/index.html');
    const f = await m.facts();
    expect(evaluateCheck({ when: "containers[name=web].state=running && http['localhost:8080'].status=200" }, f).pass).toBe(true);
    // the port is taken now
    const second = await sh(m, 'docker run -d --name web2 -p 8080:80 nginx:1.30-alpine');
    expect(second.out).toContain('port is already allocated');
    expect(second.exit).toBe(125);
  });

  it('fails fast without a required variable and reports it in logs', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name app trainer/api:1.0');
    const logs = await sh(m, 'docker logs app');
    expect(logs.out).toContain("KeyError: 'DB_HOST'");
    expect((await m.facts()).containers).toMatchObject([{ name: 'app', state: 'exited', exitCode: 1 }]);
  });

  it('resolves names only on a user-defined network', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:17-alpine');
    const r = await sh(m, 'docker run --rm alpine:3.22 nslookup db');
    expect(r.out).toContain("can't find db");
    await sh(m, 'docker network create appnet');
    await sh(m, 'docker network connect appnet db');
    const ok = await sh(m, 'docker run --rm --network appnet alpine:3.22 nslookup db');
    expect(ok.out).toMatch(/Address: 172\.18\.0\.\d+/);
  });

  it('applies the PID 1 rule on docker stop', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name s alpine:3.22 sleep 1000');
    await sh(m, 'docker stop s');
    const c = dockerOf(m).s.containers.find((x) => x.name === 's')!;
    expect(c.exitCode).toBe(137);
    expect(c.stopDurationMs).toBe(10_000);
    await sh(m, 'docker run -d --init --name t alpine:3.22 sleep 1000');
    await sh(m, 'docker stop -t 3 t');
    const t = dockerOf(m).s.containers.find((x) => x.name === 't')!;
    expect(t.exitCode).toBe(143);
    expect(t.stopDurationMs!).toBeLessThan(1000);
    // nginx handles its stop signal (SIGQUIT from the image config)
    await sh(m, 'docker run -d --name n nginx:1.30-alpine');
    await sh(m, 'docker stop n');
    const n = dockerOf(m).s.containers.find((x) => x.name === 'n')!;
    expect(n.exitCode).toBe(0);
    expect(stopOutcome({ ...n, program: { ...n.program!, shellParent: true } } as never, 'TERM', 10).why).toBe('shell-pid1');
  });

  it('kills a container that needs more memory than its limit', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name w --memory 64m trainer/worker:1.0');
    const f = await m.facts();
    expect(evaluateCheck({ when: 'containers[name=w].oomKilled=true && containers[name=w].exitCode=137' }, f).pass).toBe(true);
    await sh(m, 'docker rm w');
    await sh(m, 'docker run -d --name w --memory 128m trainer/worker:1.0');
    expect(evaluateCheck({ when: 'containers[name=w].state=running' }, await m.facts()).pass).toBe(true);
  });

  it('keeps data in a named volume across rm and run', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name d -v data:/data alpine:3.22 sleep 1000');
    await sh(m, "docker exec d sh -c 'echo kept > /data/note.txt'");
    await sh(m, 'docker rm -f d');
    const r = await sh(m, 'docker run --rm -v data:/data alpine:3.22 cat /data/note.txt');
    expect(r.out).toContain('kept');
    // without a volume the upper layer goes with the container
    await sh(m, 'docker run -d --name e alpine:3.22 sleep 1000');
    await sh(m, "docker exec e sh -c 'echo lost > /tmp/x'");
    await sh(m, 'docker rm -f e');
    expect((await sh(m, 'docker run --rm alpine:3.22 cat /tmp/x')).exit).not.toBe(0);
  });

  it('enforces bind-mount ownership by number', async () => {
    const m = await mk({ files: [{ path: '/srv/data', type: 'd', owner: 'root', mode: '0755' }] });
    await sh(m, 'docker run -d --name u -u 1001 -v /srv/data:/data alpine:3.22 sleep 1000');
    const r = await sh(m, 'docker exec u touch /data/x');
    expect(r.out).toMatch(/Permission denied/);
    await sh(m, 'docker run -d --name r -v /srv/data:/data alpine:3.22 sleep 1000');
    await sh(m, 'docker exec r touch /data/y');
    expect((await m.facts()).files['/srv/data/y']).toMatchObject({ type: 'f', uid: 0 });
  });

  it('attaches an interactive shell with docker exec -it and returns on exit', async () => {
    const m = await mk();
    await sh(m, 'docker run -d --name web nginx:1.30-alpine');
    await sh(m, 'docker exec -it web sh');
    expect(m.prompt()).toBe('/ # ');
    expect((await sh(m, 'hostname')).out.trim()).toMatch(/^[0-9a-f]{12}$/);
    expect((await sh(m, 'ps')).out).toContain('nginx: master process');
    await sh(m, 'exit');
    expect(m.prompt()).toContain('learner@');
  });

  it('pushes to the course registry and pulls by digest', async () => {
    const m = await mk();
    await sh(m, 'docker pull alpine:3.22');
    await sh(m, 'docker tag alpine:3.22 registry.lab/learner/base:1.0');
    const p = await sh(m, 'docker push registry.lab/learner/base:1.0');
    expect(p.out).toMatch(/1\.0: digest: sha256:[0-9a-f]{64}/);
    const digest = /digest: (sha256:[0-9a-f]{64})/.exec(p.out)![1];
    const again = await sh(m, 'docker push registry.lab/learner/base:1.0');
    expect(again.out).toContain('Layer already exists');
    const byDigest = await sh(m, `docker pull registry.lab/learner/base@${digest}`);
    expect(byDigest.exit).toBe(0);
    expect((await m.facts()).registry).toMatchObject({ repoNames: ['registry.lab/learner/base'] });
  });
});

describe('dsim: build', () => {
  const project: TerminalSetup = {
    files: [
      { path: '~/app/Dockerfile', content: 'FROM python:3.13-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nCMD ["python", "main.py"]\n' },
      { path: '~/app/requirements.txt', content: 'flask==3.1.2\n' },
      { path: '~/app/main.py', content: 'print("hello from the image")\n' },
      { path: '~/app/README.md', content: '# app\n' },
      { path: '~/app/.dockerignore', content: 'README.md\n.git\n' },
    ],
    ext: { docker: { timeScale: 0 } },
  };

  it('parses a Dockerfile and .dockerignore', () => {
    const p = parseDockerfile('FROM alpine:3.22 AS base\nRUN apk add \\\n  curl\n# comment\nCMD ["sh"]\n');
    expect(p.ok && p.ins.map((i) => i.op)).toEqual(['FROM', 'RUN', 'CMD']);
    expect(p.ok && p.ins[1].args).toBe('apk add curl');
    const ign = ignoredBy(['*.md', 'testdata/', '!keep.md']);
    expect(ign('README.md')).toBe(true);
    expect(ign('keep.md')).toBe(false);
    expect(ign('testdata/big.bin')).toBe(true);
    expect(ign('main.py')).toBe(false);
  });

  it('builds, caches, and rebuilds from the first changed step', async () => {
    const m = await mk(project);
    const b1 = await sh(m, 'docker build -t app:1.0 ~/app');
    if (b1.exit) console.log(b1.out);
    expect(b1.exit).toBe(0);
    expect(b1.out).toContain('naming to docker.io/library/app:1.0');
    const run = await sh(m, 'docker run --rm app:1.0');
    expect(run.out).toContain('hello from the image');
    // a change in code: pip install stays cached, COPY . . rebuilds
    await sh(m, "echo 'print(\"v2\")' > ~/app/main.py");
    const b2 = await sh(m, 'docker build -t app:1.1 ~/app');
    expect(b2.out).toMatch(/CACHED \[4\/6\] RUN pip install/);
    expect(b2.out).not.toMatch(/CACHED \[5\/6\] COPY \. \./);
    // README is ignored: changing it does not touch the cache
    await sh(m, "echo 'more docs' >> ~/app/README.md");
    const b3 = await sh(m, 'docker build -t app:1.2 ~/app');
    expect(b3.out).toMatch(/CACHED \[5\/6\] COPY \. \./);
    const f = await m.facts();
    expect(evaluateCheck({ when: "builds[last].cachedSteps has 'RUN pip install --no-cache-dir -r requirements.txt'" }, f).pass).toBe(true);
    const hist = await sh(m, 'docker history app:1.2');
    expect(hist.out).toContain('CMD ["python", "main.py"]');
  });

  it('makes a small image with a multi-stage build', async () => {
    const m = await mk({
      files: [
        { path: '~/go/main.go', content: 'package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") })\n\thttp.ListenAndServe(":8080", nil)\n}\n' },
        { path: '~/go/Dockerfile', content: 'FROM golang:1.25 AS build\nWORKDIR /src\nCOPY . .\nRUN go build -o /out/app .\n\nFROM alpine:3.22\nCOPY --from=build /out/app /usr/local/bin/app\nUSER 1001\nCMD ["app"]\n' },
      ],
      ext: { docker: { timeScale: 0 } },
    });
    const b = await sh(m, 'docker build -t goapp:1.0 ~/go');
    if (b.exit) console.log(b.out);
    expect(b.exit).toBe(0);
    const f = await m.facts();
    const img = (f.images as { tags: string[]; size: number; user: string }[]).find((i) => i.tags.includes('goapp:1.0'))!;
    expect(img.size).toBeLessThan(30_000_000);
    expect(img.user).toBe('1001');
    await sh(m, 'docker run -d --name g -p 8080:8080 goapp:1.0');
    expect((await sh(m, 'curl -s localhost:8080/health')).out).toBe('ok');
  });
});

describe('dsim: compose', () => {
  it('brings a project up and down', async () => {
    const m = await mk({
      files: [
        {
          path: '~/shop/compose.yaml',
          content: 'services:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: pw\n    volumes:\n      - db-data:/var/lib/postgresql/data\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - "8000:8000"\n    depends_on:\n      db:\n        condition: service_healthy\nvolumes:\n  db-data:\n',
        },
      ],
      cwd: '~/shop',
      ext: { docker: { timeScale: 0 } },
    });
    const up = await sh(m, 'docker compose up -d');
    expect(up.exit).toBe(0);
    expect(up.out).toContain('Network shop_default  Created');
    expect(up.out).toContain('Container shop-db-1  Healthy');
    expect((await sh(m, 'curl -s localhost:8000')).out).toContain('"db": "db"');
    const ps = await sh(m, 'docker compose ps');
    expect(ps.out).toContain('shop-api-1');
    await sh(m, 'docker compose down');
    expect((await m.facts()).containers).toEqual([]);
    expect(((await m.facts()).volumes as { name: string }[]).map((v) => v.name)).toContain('shop_db-data');
  });

  it('starts the API too early without a health condition', async () => {
    const m = await mk({
      files: [{ path: '~/p/compose.yaml', content: 'services:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: pw\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    depends_on: [db]\n' }],
      cwd: '~/p',
      ext: { docker: { timeScale: 0 } },
    });
    await sh(m, 'docker compose up -d');
    const logs = await sh(m, 'docker logs p-api-1');
    expect(logs.out).toContain('ConnectionRefusedError');
  });
});

describe('dsim: crun', () => {
  it('walks the OCI states create → start → stopped → delete', async () => {
    const m = await mk({ files: [{ path: '/c/bundle/rootfs/bin/sh', content: 'x' }], user: 'root', cwd: '/c/bundle', ext: { docker: { timeScale: 0 } } });
    await sh(m, 'crun spec');
    expect(JSON.parse((await m.facts()).files['/c/bundle/config.json'].text!).linux.namespaces.map((n: { type: string }) => n.type)).toContain('pid');
    await sh(m, "sed -i 's/x/x/' config.json || true");
    await m.exec(`echo '${JSON.stringify({ ...JSON.parse((await m.facts()).files['/c/bundle/config.json'].text!), process: { args: ['sleep', '1000'], terminal: false } })}' > config.json`);
    await sh(m, 'crun create box');
    expect((await sh(m, 'crun state box')).out).toContain('"status": "created"');
    await sh(m, 'crun start box');
    expect((await sh(m, 'crun state box')).out).toContain('"status": "running"');
    await sh(m, 'crun kill box KILL');
    expect((await sh(m, 'crun state box')).out).toContain('"status": "stopped"');
    expect((await sh(m, 'crun delete box')).exit).toBe(0);
  });
});
