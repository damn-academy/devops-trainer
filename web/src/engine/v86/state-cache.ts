// Saved machine states (09 §3.1): v86 snapshots are tens of megabytes, so they
// go to the Origin Private File System, gzip-compressed with the browser's
// CompressionStream, not to IndexedDB. Without OPFS (old Safari, private
// windows) the cache is simply empty and the machine boots from scratch.

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

async function pipe(data: ArrayBuffer | Blob, stream: CompressionStream | DecompressionStream): Promise<ArrayBuffer> {
  const blob = data instanceof Blob ? data : new Blob([data]);
  return new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
}

export async function saveState(key: string, state: ArrayBuffer): Promise<number | null> {
  const d = await dir();
  if (!d || typeof CompressionStream === 'undefined') return null;
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
  if (!d || typeof DecompressionStream === 'undefined') return null;
  try {
    const fh = await d.getFileHandle(fileName(key));
    return await pipe(await fh.getFile(), new DecompressionStream('gzip'));
  } catch {
    return null;
  }
}

export async function deleteState(key: string): Promise<void> {
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
