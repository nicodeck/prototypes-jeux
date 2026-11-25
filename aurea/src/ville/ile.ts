// L'île : son relief, ses côtes, ses rochers et ses forêts, tirés d'une seule fonction de hauteur.
//
// La carte fait TAILLE × TAILLE cases. Le relief est une fonction continue `hauteur(x, z)` : le
// jeu s'en sert pour savoir où l'on peut bâtir, et le rendu pour modeler le terrain, si bien que
// les deux sont toujours d'accord. Le niveau de la mer est à 0.
//
// La géographie : une baie au sud abrite le port ; au nord de la baie, une plaine douce monte vers
// des collines couvertes de pins (au nord-ouest) et un mont calcaire (au nord-est) dont les flancs
// donnent du marbre. À l'est, un promontoire aux falaises abruptes porte un plateau, fait pour un
// temple. À l'ouest, une longue plage.
import { hachage } from "./hasard";

export const TAILLE = 128;

export type Sol = "eau" | "plage" | "herbe" | "roche";
export type Essence = "pin" | "chene" | "cypres" | "olivier";

// ---------------------------------------------------------------------------------------------
// Bruit
// ---------------------------------------------------------------------------------------------

const lisse = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function bruit(x: number, z: number, n = 0): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = lisse(x - x0);
  const tz = lisse(z - z0);
  const a = hachage(x0, z0, n);
  const b = hachage(x0 + 1, z0, n);
  const c = hachage(x0, z0 + 1, n);
  const d = hachage(x0 + 1, z0 + 1, n);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export function fbm(x: number, z: number, octaves = 4, n = 0): number {
  let s = 0;
  let amp = 0.5;
  let poids = 0;
  for (let o = 0; o < octaves; o++) {
    s += bruit(x, z, n + o * 17) * amp;
    poids += amp;
    x = x * 2.03 + 3.7;
    z = z * 2.03 + 1.3;
    amp *= 0.5;
  }
  return s / poids;
}

const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = borne((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const sminimum = (a: number, b: number, k: number) => {
  const h = borne(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
};
const smaximum = (a: number, b: number, k: number) => -sminimum(-a, -b, k);
const gauss = (x: number, z: number, cx: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

function distanceSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = borne(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return { d: Math.hypot(x - ax - vx * t, z - az - vz * t), t };
}

// ---------------------------------------------------------------------------------------------
// La géographie
// ---------------------------------------------------------------------------------------------

export const GEO = {
  centre: { x: 63, z: 58 },
  /** Le centre et le rayon de la baie du port */
  baie: { x: 58, z: 107, r: 15 },
  /** Le promontoire du temple : son axe et sa demi-largeur */
  promontoire: { ax: 95, az: 74, bx: 116, bz: 80, r: 7 },
  /** Les sommets */
  collines: { x: 36, z: 30 },
  mont: { x: 87, z: 25 },
  ilots: [
    { x: 80, z: 117, r: 2.6 },
    { x: 120, z: 58, r: 2.2 },
    { x: 113, z: 99, r: 1.6 },
    { x: 11, z: 44, r: 2.0 },
    { x: 24, z: 104, r: 1.4 },
  ],
};

/**
 * La distance à la côte, en cases : positive à l'intérieur des terres, négative en mer.
 * (Une approximation, mais continue et assez fidèle près des côtes.)
 */
export function distanceCote(x: number, z: number): number {
  const { centre, baie, promontoire: pr } = GEO;
  const dx = x - centre.x;
  const dz = z - centre.z;
  const th = Math.atan2(dz, dx);
  const d = Math.hypot(dx, dz);
  const r =
    47 +
    5.5 * Math.sin(3 * th + 0.7) +
    3.5 * Math.sin(5 * th + 2.1) +
    1.8 * Math.sin(9 * th + 0.3) +
    (fbm(Math.cos(th) * 3 + 10, Math.sin(th) * 3 + 10, 3, 5) - 0.5) * 9;
  let s = (1 - d / r) * r;
  s += (fbm(x * 0.09, z * 0.09, 3, 11) - 0.5) * 4;
  // La baie
  const sBaie = Math.hypot((x - baie.x) * 0.9, (z - baie.z) * 1.15) - baie.r;
  s = sminimum(s, sBaie, 3);
  // Le promontoire
  const seg = distanceSegment(x, z, pr.ax, pr.az, pr.bx, pr.bz);
  const sProm = pr.r * (1 - 0.25 * seg.t) - seg.d + (fbm(x * 0.2, z * 0.2, 2, 23) - 0.5) * 1.5;
  s = smaximum(s, sProm, 3);
  for (const i of GEO.ilots) s = Math.max(s, i.r - Math.hypot(x - i.x, z - i.z) + (bruit(x * 0.8, z * 0.8, 31) - 0.5) * 0.8);
  return s;
}

/** Les côtes rocheuses : l'est, le nord-est et le promontoire tombent en falaises dans la mer. */
function falaise(x: number, z: number): number {
  const th = Math.atan2(z - GEO.centre.z, x - GEO.centre.x);
  // Est et nord-est : entre -100° et +25°
  const est = smoothstep(-1.95, -1.55, th) * (1 - smoothstep(0.25, 0.6, th));
  const pr = GEO.promontoire;
  const prom = 1 - smoothstep(pr.r + 2, pr.r + 7, distanceSegment(x, z, pr.ax, pr.az, pr.bx, pr.bz).d);
  const nord = smoothstep(-2.6, -2.2, th) * (1 - smoothstep(-1.4, -1.0, th)) * 0.6;
  return borne(Math.max(est, prom, nord) * (0.75 + 0.5 * fbm(x * 0.05, z * 0.05, 2, 41)), 0, 1);
}

export function hauteur(x: number, z: number): number {
  const s = distanceCote(x, z);
  const f = falaise(x, z);
  if (s < 0) {
    // Les fonds : un plateau peu profond, turquoise, puis le grand bleu. Sous les falaises, ça
    // plonge tout de suite.
    const plat = -0.35 - 3.2 * (1 - Math.exp(s / 5)) - 16 * (1 - Math.exp(s / 26));
    const raide = -0.6 - 9 * (1 - Math.exp(s / 3)) - 14 * (1 - Math.exp(s / 22));
    const rides = (fbm(x * 0.15, z * 0.15, 3, 7) - 0.5) * 0.9 * smoothstep(0, -6, s);
    return plat * (1 - f) + raide * f + rides;
  }
  // Le relief de l'intérieur, puis la façon dont il rejoint la mer : en pente douce sur les
  // plages, d'un coup sous les falaises
  const terre = relief(x, z);
  const rampe = (1 - Math.exp(-s / 5.5)) * (1 - f) + smoothstep(0, 2.2, s) * f;
  return terre * rampe + 0.02 * Math.min(s, 10);
}

/** Le relief de l'intérieur des terres, comme si la mer n'existait pas. */
function relief(x: number, z: number): number {
  // La plaine monte doucement vers le nord
  const plaine = 1.25 + Math.max(0, 98 - z) * 0.026 + (fbm(x * 0.07, z * 0.07, 3, 3) - 0.5) * 0.9;
  const { collines, mont } = GEO;
  let reliefs =
    10.5 * gauss(x, z, collines.x, collines.z, 13) +
    7 * gauss(x, z, collines.x + 15, collines.z - 5, 8.5) +
    22 * gauss(x, z, mont.x, mont.z, 10.5) +
    8 * gauss(x, z, mont.x - 14, mont.z + 4, 7) +
    5 * gauss(x, z, 22, 60, 8);
  const accidente = borne(reliefs / 8, 0, 1);
  reliefs += (fbm(x * 0.11, z * 0.11, 4, 13) - 0.5) * 5 * accidente;
  // Des ravines sur le mont
  reliefs -= Math.abs(fbm(x * 0.18, z * 0.06, 3, 19) - 0.5) * 3 * accidente * smoothstep(8, 18, reliefs);
  let h = plaine + Math.max(0, reliefs);

  // Le plateau du promontoire, relié à la plaine par une rampe douce
  const pr = GEO.promontoire;
  const seg = distanceSegment(x, z, pr.ax, pr.az, pr.bx, pr.bz);
  const plateau = 3.2 + 3.4 * smoothstep(0.04, 0.42, seg.t) + (fbm(x * 0.3, z * 0.3, 2, 29) - 0.5) * 0.12;
  const surPlateau = (1 - smoothstep(pr.r - 2.5, pr.r + 3, seg.d)) * smoothstep(-0.1, 0.1, seg.t);
  h = h * (1 - surPlateau) + Math.max(h * 0.4, plateau) * surPlateau;
  return h;
}

/** Vrai sur le plateau du promontoire (on y garde la place pour le temple) */
export function surPromontoire(x: number, z: number) {
  const pr = GEO.promontoire;
  const seg = distanceSegment(x, z, pr.ax, pr.az, pr.bx, pr.bz);
  return seg.d < pr.r + 1 && seg.t > 0.2;
}

// ---------------------------------------------------------------------------------------------
// La carte en cases
// ---------------------------------------------------------------------------------------------

export interface Ile {
  /** Hauteur aux coins des cases : (TAILLE + 1)² valeurs */
  coins: Float32Array;
  /** Hauteur au centre de chaque case */
  centres: Float32Array;
  /** Écart de hauteur entre les coins de chaque case (la pente) */
  pentes: Float32Array;
  sols: Sol[];
  /** Arbres sur chaque case (0 à 3), et leur essence */
  arbres: Uint8Array;
  essences: Essence[];
}

export const indice = (i: number, j: number) => j * TAILLE + i;
export const dansCarte = (i: number, j: number) => i >= 0 && j >= 0 && i < TAILLE && j < TAILLE;

export const PENTE_MAX_BATIR = 0.62;
export const PENTE_ROCHE = 1.05;

export function creerIle(): Ile {
  const N = TAILLE;
  const coins = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) coins[j * (N + 1) + i] = hauteur(i, j);
  const centres = new Float32Array(N * N);
  const pentes = new Float32Array(N * N);
  const sols: Sol[] = new Array(N * N);
  const arbres = new Uint8Array(N * N);
  const essences: Essence[] = new Array(N * N).fill("pin");
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = indice(i, j);
      const c = [coins[j * (N + 1) + i]!, coins[j * (N + 1) + i + 1]!, coins[(j + 1) * (N + 1) + i]!, coins[(j + 1) * (N + 1) + i + 1]!];
      const h = hauteur(i + 0.5, j + 0.5);
      centres[k] = h;
      const pente = Math.max(...c) - Math.min(...c);
      pentes[k] = pente;
      const s = distanceCote(i + 0.5, j + 0.5);
      let sol: Sol = "herbe";
      if (h < 0.02 || Math.min(...c) < -0.05) sol = "eau";
      else if (pente > PENTE_ROCHE || h > 17) sol = "roche";
      else if (s < 4.5 && h < 0.75 && falaise(i, j) < 0.4) sol = "plage";
      sols[k] = sol;

      // Les forêts : sur les collines surtout, en bosquets ailleurs, jamais au milieu de la plaine
      if (sol === "herbe" || (sol === "roche" && pente < 2.2)) {
        const relief = smoothstep(2.5, 9, h);
        const bosquets = fbm(i * 0.09, j * 0.09, 3, 51);
        const plaineVille = gauss(i, j, 60, 80, 17) + (surPromontoire(i, j) ? 2 : 0);
        let densite = relief * 0.9 + smoothstep(0.58, 0.72, bosquets) * 0.8 - plaineVille * 1.1 - (sol === "roche" ? 0.5 : 0);
        densite += (hachage(i, j, 3) - 0.5) * 0.35;
        if (densite > 0.42) {
          arbres[k] = densite > 0.85 ? 3 : densite > 0.6 ? 2 : 1;
          const r = hachage(i, j, 9);
          essences[k] = h > 9 ? (r < 0.65 ? "chene" : "pin") : h > 4 ? (r < 0.55 ? "pin" : r < 0.8 ? "chene" : "olivier") : r < 0.75 ? "pin" : r < 0.88 ? "cypres" : "olivier";
        } else if (hachage(i, j, 5) < 0.018 && plaineVille < 0.5) {
          // Un cyprès isolé, ici et là
          arbres[k] = 1;
          essences[k] = "cypres";
        }
      }
    }
  }
  return { coins, centres, pentes, sols, arbres, essences };
}

export function hauteurCoin(ile: Ile, i: number, j: number) {
  return ile.coins[j * (TAILLE + 1) + i]!;
}
