// git.lab against the real Git client of this computer: a tiny Node HTTP
// bridge hands requests to GitServer.handle (the same handler the lab host
// serves over its TCP), and `git clone / push / fetch` run for real.
// Skipped when `git` is not installed. The pieces (inflate, packs) are also
// tested directly against Node's zlib.

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HttpRequest } from '../src/engine/labhost/http';
import { GitServer } from '../src/engine/labhost/git/server';
import { GitStore } from '../src/engine/labhost/git/store';
import { gunzip, inflateZlib, deflateZlibStored } from '../src/engine/labhost/git/zlib';
import { applyDelta, readPack, writePack } from '../src/engine/labhost/git/pack';
import { objectId, sha1 } from '../src/engine/labhost/git/objects';
import { utf8 } from '../src/engine/labhost/wire';

let hasGit = true;
try {
  execFileSync('git', ['--version']);
} catch {
  hasGit = false;
}

describe('zlib and packs', () => {
  it('inflates what Node deflates and reports where the stream ends', () => {
    const data = utf8('hello hello hello '.repeat(500) + Math.random());
    const z = deflateSync(data);
    const tail = Uint8Array.of(9, 9, 9);
    const r = inflateZlib(new Uint8Array([...z, ...tail]));
    expect(new TextDecoder().decode(r.data)).toBe(new TextDecoder().decode(data));
    expect(r.end).toBe(z.length);
    expect(new TextDecoder().decode(gunzip(gzipSync(data)))).toBe(new TextDecoder().decode(data));
    expect(inflateZlib(deflateZlibStored(data)).data).toEqual(data);
  });

  it('hashes like git and round-trips a pack', () => {
    expect(sha1(utf8('abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(objectId('blob', utf8('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    const pack = writePack([{ type: 'blob', body: utf8('hello\n') }]);
    const back = readPack(pack, () => undefined);
    expect([...back.objects.keys()]).toEqual(['ce013625030ba8dba906f756967f9e9ca394464a']);
  });

  it('applies a delta', () => {
    const base = utf8('0123456789');
    // base 10, result 6: copy offset 2 size 3, insert "ab", copy offset 9 size 1
    const delta = Uint8Array.of(10, 6, 0x91, 2, 3, 2, 97, 98, 0x91, 9, 1);
    expect(new TextDecoder().decode(applyDelta(base, delta))).toBe('234ab9');
  });
});

describe.skipIf(!hasGit)('git.lab with the real git client', () => {
  let server: Server;
  let base = '';
  let dir = '';
  const store = new GitStore();
  const git = new GitServer(store);
  const pushes: string[] = [];
  git.onPush((p) => {
    pushes.push(p.updates.map((u) => `${p.repo} ${u.ref}`).join(','));
    return ['pipeline #1 created'];
  });
  const env = () => ({ ...process.env, LC_ALL: 'C', LANG: 'C', LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', HOME: dir, GIT_AUTHOR_NAME: 'Learner', GIT_AUTHOR_EMAIL: 'learner@ws.lab', GIT_COMMITTER_NAME: 'Learner', GIT_COMMITTER_EMAIL: 'learner@ws.lab' });
  // Async: the bridge server runs in this process, so git must not block the event loop.
  const run = async (args: string[], cwd = dir) => (await promisify(execFile)('git', args, { cwd, encoding: 'utf8', env: env() })).stdout;
  const runAll = async (args: string[], cwd = dir) => {
    try {
      const r = await promisify(execFile)('git', args, { cwd, encoding: 'utf8', env: env() });
      return `${r.stdout}${r.stderr}`;
    } catch (e) {
      const err = e as { stdout: string; stderr: string };
      return `${err.stdout}${err.stderr}`;
    }
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dt-git-'));
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', async () => {
        const u = new URL(req.url ?? '/', 'http://git.lab');
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
        const r: HttpRequest = { method: req.method ?? 'GET', target: req.url ?? '/', path: decodeURIComponent(u.pathname), query: u.searchParams, version: 'HTTP/1.1', headers, body: new Uint8Array(Buffer.concat(chunks)), host: 'git.lab', remote: { ip: '10.0.0.11', port: 1 }, local: { ip: '10.0.0.1', port: 80 }, vlan: 1 };
        const out = await git.handle(r);
        res.writeHead(out.status, out.headers);
        res.end(out.body === undefined ? undefined : Buffer.from(typeof out.body === 'string' ? utf8(out.body) : out.body));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    await run(['config', '--global', 'init.defaultBranch', 'main']);
  });
  afterAll(() => {
    server?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('push creates the repository, clone and fetch get it back, non-fast-forward is refused', async () => {
    const a = join(dir, 'a');
    await run(['init', '-q', a]);
    writeFileSync(join(a, 'README.md'), '# site\n');
    writeFileSync(join(a, '.gitlab-ci.yml'), 'test:\n  script: [echo ok]\n');
    await run(['add', '.'], a);
    await run(['commit', '-qm', 'first'], a);
    const out = await runAll(['push', `${base}/team/site.git`, 'main'], a);
    expect(out).toMatch(/\* \[new branch\]\s+main -> main/);
    expect(out).toMatch(/remote: pipeline #1 created/);
    expect(pushes).toEqual(['team/site refs/heads/main']);

    await run(['clone', '-q', `${base}/team/site.git`, join(dir, 'b')]);
    expect(readFileSync(join(dir, 'b', 'README.md'), 'utf8')).toBe('# site\n');

    // A second commit with a changed big file: the client sends a thin pack with deltas.
    writeFileSync(join(a, 'big.txt'), 'line of text\n'.repeat(5000));
    await run(['add', '.'], a);
    await run(['commit', '-qm', 'big'], a);
    await run(['push', '-q', `${base}/team/site.git`, 'main'], a);
    writeFileSync(join(a, 'big.txt'), 'line of text\n'.repeat(5000) + 'one more\n');
    await run(['commit', '-qam', 'delta'], a);
    await run(['push', '-q', `${base}/team/site.git`, 'main'], a);
    await run(['pull', '-q', 'origin', 'main'], join(dir, 'b'));
    expect(readFileSync(join(dir, 'b', 'big.txt'), 'utf8')).toMatch(/one more\n$/);
    expect((await run(['log', '--oneline'], join(dir, 'b'))).trim().split('\n')).toHaveLength(3);

    // Diverged history: rejected.
    await run(['commit', '--amend', '-qm', 'rewritten'], a);
    expect(await runAll(['push', `${base}/team/site.git`, 'main'], a)).toMatch(/rejected|non-fast-forward/);
    expect(await runAll(['push', '--force', `${base}/team/site.git`, 'main'], a)).toMatch(/non-fast-forward|rejected/);

    // Tags and branch deletion.
    await run(['tag', 'v1.0'], a);
    await run(['push', '-q', `${base}/team/site.git`, 'v1.0', 'HEAD~1:refs/heads/feature'], a);
    expect(Object.keys(store.get('team/site')!.refs).sort()).toEqual(['refs/heads/feature', 'refs/heads/main', 'refs/tags/v1.0']);
    await run(['push', '-q', `${base}/team/site.git`, ':feature'], a);
    expect(store.get('team/site')!.refs['refs/heads/feature']).toBeUndefined();
    expect([...store.files('team/site', store.get('team/site')!.refs['refs/heads/main']).keys()].sort()).toEqual(['.gitlab-ci.yml', 'README.md', 'big.txt']);
  });

  it('clones an empty repository and refuses unknown ones', async () => {
    store.create('empty');
    expect(await runAll(['clone', `${base}/empty.git`, join(dir, 'e')])).toMatch(/empty repository/);
    expect(await runAll(['clone', `${base}/nope.git`, join(dir, 'n')])).toMatch(/not found|404/);
  });
});
