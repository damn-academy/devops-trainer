/** One broker per machine; never reuse it for a different shared RAM image. */
export function createSharedCompiler(budget: number, harts: number, poolSize = harts) {
  const worker = new Worker(new URL('./shared-compiler.worker.ts', import.meta.url), { type: 'module' });
  worker.postMessage({ budget, poolSize: Math.min(4, Math.max(1, poolSize)) });
  return Object.assign(worker, {
    connect(client: number) {
      const channel = new MessageChannel();
      worker.postMessage({ client, port: channel.port1 }, [channel.port1]);
      return channel.port2;
    },
  });
}
