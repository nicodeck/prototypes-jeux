// Un hasard reproductible : la même graine donne toujours la même suite.
export type Hasard = () => number;

export function hasard(graine: number): Hasard {
  let a = graine >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function choisir<T>(alea: Hasard, liste: readonly T[]): T {
  return liste[Math.floor(alea() * liste.length)]!;
}

/** Un nombre entre 0 et 1 qui ne dépend que de (x, y, n) */
export function hachage(x: number, y: number, n = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(n | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
