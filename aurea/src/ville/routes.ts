// Le réseau des routes : quelles cases sont reliées entre elles, et le plus court chemin de l'une
// à l'autre en suivant les routes.
import { TAILLE } from "./ile";

export interface Case {
  i: number;
  j: number;
}

const VOISINS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Numérote les morceaux de réseau : deux routes reliées ont le même numéro (0 = pas de route). */
export function composantes(routes: Uint8Array): Int32Array {
  const comp = new Int32Array(TAILLE * TAILLE);
  const file = new Int32Array(TAILLE * TAILLE);
  let numero = 0;
  for (let k = 0; k < routes.length; k++) {
    if (!routes[k] || comp[k]) continue;
    numero++;
    let debut = 0;
    let fin = 0;
    file[fin++] = k;
    comp[k] = numero;
    while (debut < fin) {
      const c = file[debut++]!;
      const i = c % TAILLE;
      const j = (c - i) / TAILLE;
      for (const [di, dj] of VOISINS) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= TAILLE || nj >= TAILLE) continue;
        const n = nj * TAILLE + ni;
        if (routes[n] && !comp[n]) {
          comp[n] = numero;
          file[fin++] = n;
        }
      }
    }
  }
  return comp;
}

/** Les cases qui bordent un rectangle (sans les coins), dans la carte. */
export function bordure(i: number, j: number, l: number, p: number): Case[] {
  const res: Case[] = [];
  for (let x = i; x < i + l; x++) {
    res.push({ i: x, j: j - 1 }, { i: x, j: j + p });
  }
  for (let z = j; z < j + p; z++) {
    res.push({ i: i - 1, j: z }, { i: i + l, j: z });
  }
  return res.filter((c) => c.i >= 0 && c.j >= 0 && c.i < TAILLE && c.j < TAILLE);
}

/**
 * Le plus court chemin sur les routes, d'une des cases de `departs` à une des cases de `arrivees`
 * (largeur d'abord). Renvoie null s'il n'y en a pas.
 */
export function chemin(routes: Uint8Array, departs: Case[], arrivees: Case[]): Case[] | null {
  const cible = new Set<number>();
  for (const a of arrivees) if (routes[a.j * TAILLE + a.i]) cible.add(a.j * TAILLE + a.i);
  if (cible.size === 0) return null;
  const venu = new Int32Array(TAILLE * TAILLE).fill(-2);
  const file: number[] = [];
  for (const d of departs) {
    const k = d.j * TAILLE + d.i;
    if (!routes[k] || venu[k] !== -2) continue;
    venu[k] = -1;
    file.push(k);
  }
  let tete = 0;
  while (tete < file.length) {
    const c = file[tete++]!;
    if (cible.has(c)) {
      const res: Case[] = [];
      for (let k = c; k !== -1; k = venu[k]!) res.push({ i: k % TAILLE, j: Math.floor(k / TAILLE) });
      return res.reverse();
    }
    const i = c % TAILLE;
    const j = (c - i) / TAILLE;
    for (const [di, dj] of VOISINS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= TAILLE || nj >= TAILLE) continue;
      const n = nj * TAILLE + ni;
      if (routes[n] && venu[n] === -2) {
        venu[n] = c;
        file.push(n);
      }
    }
  }
  return null;
}

/** Un tracé en L entre deux cases : d'abord le long du plus grand écart, puis l'autre. */
export function traceEnL(a: Case, b: Case): Case[] {
  const res: Case[] = [];
  const di = Math.sign(b.i - a.i);
  const dj = Math.sign(b.j - a.j);
  const horizontalDAbord = Math.abs(b.i - a.i) >= Math.abs(b.j - a.j);
  let i = a.i;
  let j = a.j;
  res.push({ i, j });
  if (horizontalDAbord) {
    while (i !== b.i) res.push({ i: (i += di), j });
    while (j !== b.j) res.push({ i, j: (j += dj) });
  } else {
    while (j !== b.j) res.push({ i, j: (j += dj) });
    while (i !== b.i) res.push({ i: (i += di), j });
  }
  return res;
}
