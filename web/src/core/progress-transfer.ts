// The payload stays in the URL fragment and is never sent to the web server.
const MAX_BYTES = 5_000_000;
export const TRANSFER_TTL = 15 * 60_000;
export async function encodeTransfer(json: string, now = Date.now()): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify({ expires: now + TRANSFER_TTL, json }));
  if (raw.length > MAX_BYTES) throw new Error('Progress is too large');
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function decodeTransfer(payload: string, now = Date.now()): Promise<string> {
  if (payload.length > 64_000 || !/^[\w-]+$/.test(payload)) throw new Error('Invalid transfer');
  const bytes = Uint8Array.from(atob(payload.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('Progress is too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const data = JSON.parse(await new Blob(chunks as BlobPart[]).text());
  if (!Number.isFinite(data.expires) || data.expires <= now || data.expires > now + TRANSFER_TTL || typeof data.json !== 'string') throw new Error('Expired or invalid transfer');
  return data.json;
}
