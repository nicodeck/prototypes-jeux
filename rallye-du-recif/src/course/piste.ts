// Une piste : une courbe lisse qui passe par des points clés, échantillonnée tous les mètres.
// On sait y projeter n'importe quel point : à quelle distance du départ (s) et à quel écart
// du milieu de la route (d, positif à gauche) il se trouve.

/** Ce qu'il y a sur le bas-côté. */
export type Sol = "herbe" | "sable" | "planches";
/** Ce qui arrête le kart au bout du bas-côté : un mur (rochers, rambarde) ou l'eau (on tombe). */
export type Limite = "mur" | "eau";

export interface Cote {
  sol: Sol;
  /** Largeur du bas-côté, en mètres. */
  bord: number;
  limite: Limite;
}

export interface PointCle {
  x: number;
  z: number;
  /** Altitude de la route. */
  y: number;
  /** Largeur de la route. */
  largeur: number;
  /** Les bas-côtés à gauche et à droite, jusqu'au point clé suivant. */
  g: Cote;
  d: Cote;
  /** La route est un pont : il y a de l'eau dessous (pour le décor). */
  pont?: boolean;
}

export interface Echantillon {
  x: number;
  z: number;
  y: number;
  /** Direction de la route (vecteur unité). */
  tx: number;
  tz: number;
  /** Vers la gauche (vecteur unité). */
  nx: number;
  nz: number;
  largeur: number;
  g: Cote;
  d: Cote;
  pont: boolean;
  /** Distance depuis le début de la piste. */
  s: number;
  /** Position dans les points clés : 3.5 = à mi-chemin entre le point 3 et le point 4. */
  u: number;
}

export interface Projection {
  /** L'échantillon le plus proche. */
  i: number;
  s: number;
  /** Écart au milieu de la route, positif à gauche. */
  d: number;
  /** Altitude de la route à cet endroit. */
  y: number;
  /** Distance au carré jusqu'à la courbe. */
  dist2: number;
}

const PAS = 1;

/** Catmull-Rom centripète, pour une courbe sans boucles parasites. */
function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number) {
  const dist = (a: number[], b: number[]) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const t0 = 0;
  const t1 = t0 + dist(p0, p1);
  const t2 = t1 + dist(p1, p2);
  const t3 = t2 + dist(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const lerp = (a: number[], b: number[], ta: number, tb: number) => {
    const k = (tt - ta) / (tb - ta);
    return a.map((v, i) => v + (b[i] - v) * k);
  };
  const a1 = lerp(p0, p1, t0, t1);
  const a2 = lerp(p1, p2, t1, t2);
  const a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

export class Piste {
  readonly echantillons: Echantillon[];
  readonly longueur: number;

  constructor(
    readonly points: PointCle[],
    readonly fermee: boolean,
  ) {
    const n = points.length;
    const pt = (i: number) => {
      const j = fermee ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
      const p = points[j];
      // Hors des bouts d'une piste ouverte, on prolonge tout droit.
      if (!fermee && (i < 0 || i >= n)) {
        const a = points[i < 0 ? 0 : n - 1];
        const b = points[i < 0 ? 1 : n - 2];
        return [2 * a.x - b.x, 2 * a.z - b.z, a.y, a.largeur];
      }
      return [p.x, p.z, p.y, p.largeur];
    };
    // Un tracé fin, puis un rééchantillonnage tous les mètres.
    const fin: { p: number[]; u: number; l: number }[] = [];
    const segments = fermee ? n : n - 1;
    const SOUS = 60;
    let l = 0;
    for (let i = 0; i < segments; i++)
      for (let k = 0; k < SOUS; k++) {
        const t = k / SOUS;
        const p = catmull(pt(i - 1), pt(i), pt(i + 1), pt(i + 2), t);
        if (fin.length) l += Math.hypot(p[0] - fin[fin.length - 1].p[0], p[1] - fin[fin.length - 1].p[1]);
        fin.push({ p, u: i + t, l });
      }
    const dernier = fermee ? pt(0) : pt(n - 1);
    l += Math.hypot(dernier[0] - fin[fin.length - 1].p[0], dernier[1] - fin[fin.length - 1].p[1]);
    fin.push({ p: dernier, u: segments, l });
    this.longueur = l;

    const nb = fermee ? Math.round(l / PAS) : Math.round(l / PAS) + 1;
    const pas = fermee ? l / nb : l / (nb - 1);
    this.echantillons = [];
    let j = 0;
    for (let k = 0; k < nb; k++) {
      const s = k * pas;
      while (j < fin.length - 2 && fin[j + 1].l < s) j++;
      const a = fin[j];
      const b = fin[j + 1];
      const t = b.l > a.l ? (s - a.l) / (b.l - a.l) : 0;
      const p = a.p.map((v, i) => v + (b.p[i] - v) * t);
      const u = a.u + (b.u - a.u) * t;
      const cle = points[Math.min(n - 1, Math.floor(u)) % n];
      this.echantillons.push({
        x: p[0],
        z: p[1],
        y: p[2],
        largeur: p[3],
        tx: 0,
        tz: 0,
        nx: 0,
        nz: 0,
        g: cle.g,
        d: cle.d,
        pont: !!cle.pont,
        s,
        u,
      });
    }
    const E = this.echantillons;
    for (let k = 0; k < E.length; k++) {
      const a = E[fermee ? (k - 1 + E.length) % E.length : Math.max(0, k - 1)];
      const b = E[fermee ? (k + 1) % E.length : Math.min(E.length - 1, k + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      E[k].tx = dx / len;
      E[k].tz = dz / len;
      // La gauche du pilote : y vers le haut, la caméra regarde vers -z.
      E[k].nx = E[k].tz;
      E[k].nz = -E[k].tx;
    }
  }

  /** L'échantillon d'indice i (en bouclant si la piste est fermée). */
  e(i: number) {
    const n = this.echantillons.length;
    return this.echantillons[this.fermee ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  }

  /** L'indice de l'échantillon à la distance s. */
  indice(s: number) {
    const n = this.echantillons.length;
    const k = Math.round(s / (this.longueur / (this.fermee ? n : n - 1)));
    return this.fermee ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k));
  }

  /** Un point de la piste : à la distance s, décalé de d vers la gauche. */
  point(s: number, d = 0) {
    const L = this.longueur;
    if (this.fermee) s = ((s % L) + L) % L;
    else s = Math.max(0, Math.min(L, s));
    const n = this.echantillons.length;
    const pas = L / (this.fermee ? n : n - 1);
    const k = Math.min(Math.floor(s / pas), this.fermee ? n - 1 : n - 2);
    const a = this.e(k);
    const b = this.e(k + 1);
    const t = (s - k * pas) / pas;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    return {
      x: x + a.nx * d,
      z: z + a.nz * d,
      y: a.y + (b.y - a.y) * t,
      tx: a.tx,
      tz: a.tz,
      cap: Math.atan2(a.tz, a.tx),
      e: a,
    };
  }

  /** Projette un point sur la piste. `pres` : un indice proche, pour chercher autour. */
  projeter(x: number, z: number, pres?: number): Projection {
    const E = this.echantillons;
    const n = E.length;
    let meilleur = -1;
    let min = Infinity;
    const essayer = (k: number) => {
      const e = this.e(k);
      const d2 = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d2 < min) {
        min = d2;
        meilleur = this.fermee ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k));
      }
    };
    if (pres !== undefined) for (let k = pres - 40; k <= pres + 40; k++) essayer(k);
    if (pres === undefined || min > 22 * 22) for (let k = 0; k < n; k++) essayer(k);

    // Affine sur le segment voisin le plus proche.
    const i = meilleur;
    const surSegment = (a: Echantillon, b: Echantillon) => {
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const l2 = vx * vx + vz * vz || 1;
      const t = ((x - a.x) * vx + (z - a.z) * vz) / l2;
      return t;
    };
    const ici = E[i];
    let a = ici;
    let b = this.e(i + 1);
    let t = surSegment(a, b);
    let s0 = ici.s;
    if (t < 0 && (this.fermee || i > 0)) {
      a = this.e(i - 1);
      b = ici;
      t = surSegment(a, b);
      s0 = ici.s - Math.hypot(b.x - a.x, b.z - a.z);
    }
    t = Math.max(0, Math.min(1, t));
    const lg = Math.hypot(b.x - a.x, b.z - a.z);
    const cx = a.x + (b.x - a.x) * t;
    const cz = a.z + (b.z - a.z) * t;
    const nx = a.nx + (b.nx - a.nx) * t;
    const nz = a.nz + (b.nz - a.nz) * t;
    let s = s0 + lg * t;
    if (this.fermee) s = ((s % this.longueur) + this.longueur) % this.longueur;
    // Au-delà des bouts d'une piste ouverte, la distance continue (négative ou plus grande que la longueur).
    if (!this.fermee && i === 0 && b === this.e(1)) s = (x - a.x) * a.tx + (z - a.z) * a.tz;
    if (!this.fermee && i === n - 1) s = ici.s + (x - ici.x) * ici.tx + (z - ici.z) * ici.tz;
    const d = (x - cx) * nx + (z - cz) * nz;
    return { i, s, d, y: a.y + (b.y - a.y) * t, dist2: min };
  }

  /** Le virage à venir : de combien la route tourne entre s + de et s + a (positif = à droite). */
  virage(s: number, de: number, a: number) {
    const p = this.point(s + de);
    const q = this.point(s + a);
    let d = q.cap - p.cap;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
}
