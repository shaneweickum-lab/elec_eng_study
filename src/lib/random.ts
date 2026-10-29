/** Seeded PRNG (mulberry32) so challenge scenarios are reproducible from their seed. */
export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/** A fresh, non-reproducible seed for a new attempt (the seed itself is then stored). */
export function newSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0;
  }
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

/** E12 preferred-number series, one decade. */
export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2] as const;

export function e12Value(rng: Rng, minOhms: number, maxOhms: number): number {
  const candidates: number[] = [];
  for (let decade = 0; decade <= 7; decade++)
    for (const m of E12) {
      const v = Number((m * 10 ** decade).toPrecision(2));
      if (v >= minOhms && v <= maxOhms) candidates.push(v);
    }
  return rng.pick(candidates);
}
