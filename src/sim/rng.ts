/**
 * Small seeded RNG (mulberry32). The whole state is one 32-bit number, so it can live
 * inside the saved game and a run can be replayed exactly from its seed.
 */
export function next(state: number): [value: number, state: number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** Mutable wrapper for use inside one step; read `.state` back out when done. */
export class Rng {
  constructor(public state: number) {}

  float(): number {
    const [v, s] = next(this.state);
    this.state = s;
    return v;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** Standard normal via Box-Muller. */
  normal(): number {
    const u = Math.max(this.float(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.float());
  }

  /** Index chosen with probability proportional to weight; -1 if all weights are 0. */
  weighted(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return -1;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h | 0;
}
