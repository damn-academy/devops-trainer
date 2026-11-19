// A snapshot also clones the guest RNG. Generate clone IDs and SSH keys using
// host WebCrypto, never the saved guest random stream.
// Key format: openssh-portable/PROTOCOL.key (unencrypted Ed25519).
const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const str = (b: Uint8Array) => concat(u32(b.length), b);
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unbase64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export interface CloneIdentity {
  machineId: string;
  privateKey?: string;
  publicKey?: string;
}

export async function cloneIdentity(ssh: boolean): Promise<CloneIdentity> {
  const identity: CloneIdentity = { machineId: crypto.randomUUID().replace(/-/g, '') };
  if (!ssh) return identity;
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = unbase64(jwk.x!);
  const seed = unbase64(jwk.d!);
  const algorithm = str(bytes('ssh-ed25519'));
  const publicBlob = concat(algorithm, str(pub));
  const check = crypto.getRandomValues(new Uint8Array(4));
  const privateBlob = concat(check, check, algorithm, str(pub), str(concat(seed, pub)), str(bytes('dt-clone')));
  const padding = Uint8Array.from({ length: (8 - privateBlob.length % 8) % 8 }, (_, i) => i + 1);
  const key = concat(bytes('openssh-key-v1\0'), str(bytes('none')), str(bytes('none')), str(new Uint8Array()), u32(1), str(publicBlob), str(concat(privateBlob, padding)));
  identity.privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64(key).match(/.{1,70}/g)!.join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`;
  identity.publicKey = `ssh-ed25519 ${b64(publicBlob)} dt-clone`;
  return identity;
}
