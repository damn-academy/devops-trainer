import { expect, it } from 'vitest';
import { CompilePool } from '../src/engine/rv64/compile-pool';
it('bounds workers, drains queued jobs and recovers capacity after a failed job', async () => {
  const finishes: ((fail?: boolean) => void)[] = [];
  const module = new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
  const worker = () => new Promise<{ module: WebAssembly.Module; compileMs: number }>((resolve, reject) => {
    finishes.push(fail => fail ? reject(Error('compile failed')) : resolve({ module, compileMs: 7 }));
  });
  const pool = new CompilePool([worker, worker]);
  const jobs = [0,1,2].map(() => pool.compile(new Uint8Array()).catch(error => error));
  expect(pool.stats().compilePoolBusy).toBe(2); expect(pool.stats().compilePoolQueued).toBe(1);
  finishes[0]!(true); finishes[1]!();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(finishes).toHaveLength(3); finishes[2]!();
  const results = await Promise.all(jobs);
  expect(results[0]).toBeInstanceOf(Error); expect(results[2]).toBe(module);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(pool.stats()).toMatchObject({ compilePoolBusy: 0, compilePoolQueued: 0, compileJobs: 2, compileJobMeanMs: 7 });
});
