/** Deterministic shuffle by a string seed, never returning the original order for n ≥ 2. */
export function shuffle<T>(arr: T[], seed: string): T[] {
  let x = 0;
  for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length >= 2 && out.every((v, i) => v === arr[i])) [out[0], out[1]] = [out[1], out[0]];
  return out;
}
