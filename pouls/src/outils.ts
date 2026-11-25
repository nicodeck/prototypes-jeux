// Petits outils mathématiques partagés.

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même monde. */
export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const borner = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const melanger = (a: number, b: number, t: number) => a + (b - a) * t;
export const lisse = (t: number) => t * t * (3 - 2 * t);
export const midiVersHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type RVB = [number, number, number];

export function hexVersRvb(hex: string): RVB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rvb(c: RVB, alpha = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

export function melangerRvb(a: RVB, b: RVB, t: number): RVB {
  return [melanger(a[0], b[0], t), melanger(a[1], b[1], t), melanger(a[2], b[2], t)];
}

/** Éclaircit une couleur vers le blanc. */
export function eclaircir(c: RVB, t: number): RVB {
  return melangerRvb(c, [255, 255, 255], t);
}

/** Bruit 1D doux (somme de sinus) pour les ondulations du décor. */
export function onde(x: number, graine = 0): number {
  return (
    Math.sin(x * 1.0 + graine) * 0.5 +
    Math.sin(x * 2.3 + graine * 1.7) * 0.3 +
    Math.sin(x * 5.1 + graine * 2.9) * 0.2
  );
}
