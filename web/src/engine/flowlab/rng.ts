// Seeded randomness for flowlab (07 §8.1). Every random number is keyed by
// a stream name and a position ("cap:DEV-1:5" = the capacity die of DEV-1 on
// day 5), not drawn from one shared sequence. This is the common-random-numbers
// technique: when the learner changes one decision, the dice of everyone else
// and the events of every day stay the same, so a counterfactual replay differs
// only because of that decision.

/** mulberry32: a small, fast 32-bit generator with good statistical quality. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** xmur3 string hash → 32-bit seed. */
export function hash32(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** A uniform number in [0, 1) for (seed, key). Pure: the same key always gives the same number. */
export function rand(seed: number, key: string): number {
  return mulberry32(hash32(`${seed >>> 0}|${key}`))();
}

/** An integer in [lo, hi] for (seed, key). */
export function randInt(seed: number, key: string, lo: number, hi: number): number {
  return lo + Math.floor(rand(seed, key) * (hi - lo + 1));
}

/** One element of a list for (seed, key). */
export function pick<T>(seed: number, key: string, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rand(seed, key) * list.length))];
}
