// Saved machine states (09 §3.1): v86 snapshots are tens of megabytes, so they
// go to the Origin Private File System, gzip-compressed with the browser's
// CompressionStream, not to IndexedDB. Without OPFS (old Safari, private
// windows, Node tests) boot snapshots (keys starting with `boot-`) are kept
// compressed in memory for this tab, so the second machine of a lab still
// starts from the first one's snapshot; the learner's own states are not.

const DIR = 'vm';

async function dir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR, { create: true });
  } catch {
    return null;
  }
}

const fileName = (key: string) => key.replace(/[^a-zA-Z0-9._-]+/g, '_') + '.gz';

/** Boot snapshots of this tab when OPFS is not available. */
const memory = new Map<string, ArrayBuffer>();
const memoryKey = (key: string) => key.startsWith('boot-');

async function pipe(data: ArrayBuffer | Blob, stream: CompressionStream | DecompressionStream): Promise<ArrayBuffer> {
  const blob = data instanceof Blob ? data : new Blob([data]);
  return new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
}

export async function saveState(key: string, state: ArrayBuffer): Promise<number | null> {
  const d = await dir();
  if (typeof CompressionStream === 'undefined') return null;
  if (!d) {
    if (!memoryKey(key)) return null;
    const gz = await pipe(state.slice(0), new CompressionStream('gzip'));
    memory.set(key, gz);
    return gz.byteLength;
  }
  try {
    const gz = await pipe(state, new CompressionStream('gzip'));
    const fh = await d.getFileHandle(fileName(key), { create: true });
    const w = await fh.createWritable();
    await w.write(gz);
    await w.close();
    void navigator.storage.persist?.();
    return gz.byteLength;
  } catch {
    return null;
  }
}

export async function loadState(key: string): Promise<ArrayBuffer | null> {
  const d = await dir();
  if (typeof DecompressionStream === 'undefined') return null;
  if (!d) {
    const gz = memory.get(key);
    return gz ? pipe(gz, new DecompressionStream('gzip')) : null;
  }
  try {
    const fh = await d.getFileHandle(fileName(key));
    return await pipe(await fh.getFile(), new DecompressionStream('gzip'));
  } catch {
    return null;
  }
}

export async function deleteState(key: string): Promise<void> {
  memory.delete(key);
  const d = await dir();
  try {
    await d?.removeEntry(fileName(key));
  } catch {
    /* not there */
  }
}

/** Every saved state with its size on disk, for the settings page. */
export async function listStates(): Promise<{ name: string; bytes: number }[]> {
  const d = await dir();
  if (!d) return [];
  const out: { name: string; bytes: number }[] = [];
  try {
    for await (const [name, h] of (d as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if (h.kind === 'file') out.push({ name: name.replace(/\.gz$/, ''), bytes: (await (h as FileSystemFileHandle).getFile()).size });
    }
  } catch {
    /* iteration unsupported */
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function clearStates(): Promise<void> {
  for (const s of await listStates()) await deleteState(s.name);
}
