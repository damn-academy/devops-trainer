// Pool leaf: encoding and deduplication stay in the broker; only V8 compilation
// runs here. Transferred bytes are already covered by the job reservation.
self.onmessage = async ({ data: bytes }) => {
  const start = performance.now();
  try { self.postMessage({ module: await WebAssembly.compile(bytes), compileMs: performance.now() - start }); }
  catch (error) { self.postMessage({ error: String(error), compileMs: performance.now() - start }); }
};
export {};
