// Where the learner's API key lives (09 §4.4). When remembered, it is
// encrypted with AES-GCM under a key that WebCrypto generates as
// non-extractable: IndexedDB stores the CryptoKey object, the browser never
// hands out its bytes, so a copy of the database (a profile backup, an export)
// does not contain a usable API key. "Don't remember" keeps the key only in
// the memory of the AI worker until the tab closes. Settings (provider, model,
// address) are stored next to it in the clear; none of this is in the progress
// export or in sync.

export interface Kv {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export class MemoryKv implements Kv {
  map = new Map<string, unknown>();
  async get<T>(key: string) {
    return this.map.get(key) as T | undefined;
  }
  async set(key: string, value: unknown) {
    this.map.set(key, value);
  }
  async del(key: string) {
    this.map.delete(key);
  }
}

/** IndexedDB database `dt-ai`, separate from the progress store. */
export async function idbKv(): Promise<Kv> {
  const { openDB } = await import('idb');
  const db = await openDB('dt-ai', 1, {
    upgrade(d) {
      d.createObjectStore('kv');
    },
  });
  return {
    get: (k) => db.get('kv', k),
    set: async (k, v) => void (await db.put('kv', v, k)),
    del: async (k) => void (await db.delete('kv', k)),
  };
}

interface Sealed {
  v: 1;
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

const WRAP = 'wrap-key';
const SEALED = 'api-key';

export class KeyStore {
  private memory: string | null = null;
  constructor(
    private kv: Kv,
    private subtle: SubtleCrypto = globalThis.crypto.subtle,
  ) {}

  private async wrapKey(create: boolean): Promise<CryptoKey | null> {
    const existing = await this.kv.get<CryptoKey>(WRAP);
    if (existing || !create) return existing ?? null;
    const k = await this.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await this.kv.set(WRAP, k);
    return k;
  }

  /** Keep the key: encrypted on disk when `remember`, otherwise only in memory. */
  async put(apiKey: string, remember: boolean): Promise<void> {
    this.memory = apiKey;
    if (!remember) {
      await this.kv.del(SEALED);
      return;
    }
    const k = (await this.wrapKey(true))!;
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const data = await this.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(apiKey));
    const sealed: Sealed = { v: 1, iv, data };
    await this.kv.set(SEALED, sealed);
  }

  /** The key, from memory or decrypted from disk; null when there is none. */
  async get(): Promise<string | null> {
    if (this.memory !== null) return this.memory;
    const sealed = await this.kv.get<Sealed>(SEALED);
    const k = await this.wrapKey(false);
    if (!sealed || !k) return null;
    try {
      const plain = await this.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, k, sealed.data);
      this.memory = new TextDecoder().decode(plain);
      return this.memory;
    } catch {
      return null;
    }
  }

  async stored(): Promise<boolean> {
    return !!(await this.kv.get(SEALED));
  }

  /** "Disconnect and delete the key": memory, ciphertext and the wrapping key. */
  async forget(): Promise<void> {
    this.memory = null;
    await this.kv.del(SEALED);
    await this.kv.del(WRAP);
  }
}
