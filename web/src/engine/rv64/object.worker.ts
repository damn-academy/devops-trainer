import { fetchObject, type Encoding, type ObjectRef } from './objects';
/** Fetches, decodes and verifies objects for ObjectPool off the page's thread. */
self.onmessage = async ({ data }: MessageEvent<{ id: number; base: string; ref: ObjectRef; encoding?: Encoding; cache: boolean }>) => {
  try {
    const bytes = await fetchObject(data.base, data.ref, { encoding: data.encoding, cache: data.cache });
    self.postMessage({ id: data.id, bytes }, { transfer: [bytes.buffer] });
  } catch (error) { self.postMessage({ id: data.id, error: String(error) }); }
};
