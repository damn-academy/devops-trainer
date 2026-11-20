import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseCi } from '../../git-cicd/ci/config';
import { jobScript } from './ci';

it('reuses repository objects and provider cache without leaking files between jobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dt-ci-cache-'));
  try {
    const repo = resolve(process.cwd(), '..');
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    const pipeline = { repo: 'test', sha, env: { TF_PLUGIN_CACHE_DIR: join(dir, 'providers') } };
    const first = parseCi('first:\n  script:\n    - touch stray\n    - touch "$TF_PLUGIN_CACHE_DIR/provider"\n').config!.jobs[0];
    const second = parseCi('second:\n  script:\n    - test ! -e stray\n    - test -e "$TF_PLUGIN_CACHE_DIR/provider"\n').config!.jobs[0];
    for (const job of [first, second]) {
      const script = jobScript(pipeline, job, join(dir, 'work'), repo, join(dir, 'artifacts'));
      expect(execFileSync('sh', ['-c', script], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1_000_000 })).toContain('Job succeeded');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
