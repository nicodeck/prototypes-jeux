// La carte de l'archipel : îles, phares, récifs, balises et tonneaux d'huile.
// Le relief est une fonction hauteurTerrain(x, z) qui sert à la fois au dessin,
// à l'écume du rivage et aux collisions.

import { aleatoire, entre, fbm2, smoothstep } from "../outils/maths";

export interface Ile {
  x: number;
  z: number;
  rayon: number;
  hauteur: number;
  graine: number;
  etirement: number; // allongement de l'île
  angle: number; // orientation de l'allongement
  arbres: number; // densité de sapins
  ilot?: boolean; // îlot de phare : sommet aplati
}

export interface PhareDef {
  nom: string;
  x: number;
  z: number;
  socle: number; // altitude du pied de la tour (rempli au chargement)
  hauteurTour: number;
  rayures: number; // couleur des bandes
}

export interface Rocher {
  x: number;
  z: number;
  r: number; // rayon de collision
  h: number; // hauteur au-dessus de l'eau (négatif : affleurant)
  graine: number;
  troncon: number; // tronçon de route qu'il garde (-1 : nulle part)
}

export interface Balise {
  x: number;
  z: number;
  troncon: number;
}

export interface Tonneau {
  x: number;
  z: number;
}

export const DEPART = { x: 30, z: 575, cap: 0 }; // cap façon boussole : 0 = nord (-z), π/2 = est (+x)

export const PHARES: PhareDef[] = [
  { nom: "Le Feu du Port", x: 95, z: 655, socle: 0, hauteurTour: 22, rayures: 0 },
  { nom: "La Veilleuse", x: -210, z: 330, socle: 0, hauteurTour: 24, rayures: 1 },
  { nom: "Le Guetteur", x: -480, z: -30, socle: 0, hauteurTour: 26, rayures: 2 },
  { nom: "La Sentinelle", x: -190, z: -410, socle: 0, hauteurTour: 25, rayures: 0 },
  { nom: "L'Ourse", x: 300, z: -340, socle: 0, hauteurTour: 27, rayures: 1 },
  { nom: "Le Dernier Feu", x: 490, z: 185, socle: 0, hauteurTour: 30, rayures: 2 },
];

const GRANDES_ILES: Omit<Ile, "graine">[] = [
  { x: 60, z: -10, rayon: 175, hauteur: 62, etirement: 1.35, angle: 0.5, arbres: 1 },
  { x: -330, z: 205, rayon: 72, hauteur: 30, etirement: 1.2, angle: -0.4, arbres: 1 },
  { x: -385, z: -265, rayon: 92, hauteur: 38, etirement: 1.3, angle: 1.1, arbres: 1 },
  { x: 225, z: 360, rayon: 95, hauteur: 34, etirement: 1.4, angle: 0.2, arbres: 1 },
  { x: 535, z: -85, rayon: 85, hauteur: 36, etirement: 1.25, angle: -0.7, arbres: 1 },
  { x: 10, z: -500, rayon: 62, hauteur: 24, etirement: 1.5, angle: 0.1, arbres: 0.8 },
  { x: -580, z: 270, rayon: 55, hauteur: 20, etirement: 1.2, angle: 0.9, arbres: 0.7 },
  { x: -170, z: 110, rayon: 42, hauteur: 16, etirement: 1.3, angle: 0.4, arbres: 0.6 },
  { x: 310, z: 90, rayon: 48, hauteur: 22, etirement: 1.2, angle: -0.2, arbres: 0.8 },
  { x: 680, z: 360, rayon: 58, hauteur: 22, etirement: 1.3, angle: 0.6, arbres: 0.7 },
  { x: -40, z: 345, rayon: 34, hauteur: 13, etirement: 1.6, angle: -0.5, arbres: 0.5 },
  { x: 175, z: 690, rayon: 60, hauteur: 26, etirement: 1.3, angle: 0.3, arbres: 1 },
  { x: -150, z: 690, rayon: 70, hauteur: 30, etirement: 1.2, angle: -0.3, arbres: 1 },
  { x: -620, z: -230, rayon: 70, hauteur: 26, etirement: 1.3, angle: 0.3, arbres: 0.8 },
  { x: 330, z: -600, rayon: 75, hauteur: 30, etirement: 1.2, angle: 0.8, arbres: 0.8 },
  { x: 720, z: 40, rayon: 50, hauteur: 18, etirement: 1.2, angle: 0.1, arbres: 0.6 },
];

export const ILES: Ile[] = [
  ...GRANDES_ILES.map((ile, i) => ({ ...ile, graine: i * 13.7 + 3 })),
  ...PHARES.map((p, i) => ({
    x: p.x,
    z: p.z,
    rayon: 23,
    hauteur: 7 + (i % 2) * 2,
    graine: 100 + i * 7.3,
    etirement: 1.15,
    angle: i,
    arbres: 0,
    ilot: true,
  })),
];

/** Hauteur du relief (île) en (x, z) : positive au-dessus de l'eau. */
export function hauteurIle(ile: Ile, x: number, z: number) {
  const dx = x - ile.x;
  const dz = z - ile.z;
  const c = Math.cos(ile.angle);
  const s = Math.sin(ile.angle);
  const u = (dx * c + dz * s) / ile.etirement;
  const v = (-dx * s + dz * c) * ile.etirement;
  const d = Math.hypot(u, v);
  const echelle = 1 / Math.max(ile.rayon, 30);
  const contour = 1 + 0.28 * fbm2(x * echelle * 1.6 + ile.graine, z * echelle * 1.6 - ile.graine, 3);
  const dn = d / (ile.rayon * contour);
  if (dn > 2.2) return -30;
  if (ile.ilot) {
    // îlot rocheux au sommet plat, falaises sur le pourtour
    const plateau = smoothstep(1.0, 0.55, dn);
    const rugueux = fbm2(x * 0.15 + ile.graine, z * 0.15, 3);
    const h = ile.hauteur * plateau + (1 - dn) * 4 + rugueux * 1.6 * (1 - plateau * 0.8) - 1.2;
    return dn < 1.2 ? h : h - (dn - 1.2) * 30;
  }
  const cime = Math.pow(Math.max(0, 1 - dn), 1.15);
  const crete = 1 - Math.abs(fbm2(x * 0.011 + ile.graine, z * 0.011, 4));
  const detail = fbm2(x * 0.06, z * 0.06 + ile.graine, 3);
  let h = ile.hauteur * cime * (0.55 + 0.6 * crete * crete);
  h += detail * 3.5 * smoothstep(1.2, 0.7, dn);
  h += (1 - dn) * 6 - 2.5; // falaise du rivage
  if (dn > 1) h -= (dn - 1) * 40;
  return h;
}

let rochers: Rocher[] = [];
let balises: Balise[] = [];
let tonneaux: Tonneau[] = [];

export const getRochers = () => rochers;
export const getBalises = () => balises;
export const getTonneaux = () => tonneaux;

function hauteurRocher(r: Rocher, x: number, z: number) {
  const d = Math.hypot(x - r.x, z - r.z) / (r.r * 1.15);
  if (d > 2) return -30;
  return r.h + 1.5 - d * d * (Math.max(r.h, 0) + 6);
}

/** Relief complet (îles + récifs). */
export function hauteurTerrain(x: number, z: number) {
  let h = -30;
  for (const ile of ILES) {
    const dx = x - ile.x;
    const dz = z - ile.z;
    const lim = ile.rayon * 2.4 * ile.etirement;
    if (dx * dx + dz * dz > lim * lim) continue;
    h = Math.max(h, hauteurIle(ile, x, z));
  }
  for (const r of rochers) {
    const dx = x - r.x;
    const dz = z - r.z;
    if (dx * dx + dz * dz > r.r * r.r * 6) continue;
    h = Math.max(h, hauteurRocher(r, x, z));
  }
  return h;
}

function distanceAuxIles(x: number, z: number) {
  let h = -30;
  for (const ile of ILES) h = Math.max(h, hauteurIle(ile, x, z));
  return h;
}

/** Place les récifs, balises et tonneaux (reproductible). */
export function genererArchipel() {
  const r = aleatoire(1234);
  rochers = [];
  balises = [];
  tonneaux = [];
  const libre = (x: number, z: number, marge: number) => {
    if (distanceAuxIles(x, z) > -6) return false;
    for (const p of PHARES) if (Math.hypot(x - p.x, z - p.z) < marge + 30) return false;
    if (Math.hypot(x - DEPART.x, z - DEPART.z) < 70) return false;
    return true;
  };

  for (let t = 0; t < PHARES.length - 1; t++) {
    const a = PHARES[t];
    const b = PHARES[t + 1];
    const longueur = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = -(b.z - a.z) / longueur;
    const nz = (b.x - a.x) / longueur;
    const nbAmas = 3 + Math.min(t, 2);
    for (let k = 0; k < nbAmas; k++) {
      const s = 0.22 + (0.6 * (k + entre(r, 0.1, 0.9))) / nbAmas;
      const decalage = entre(r, -45, 45);
      const cx = a.x + (b.x - a.x) * s + nx * decalage;
      const cz = a.z + (b.z - a.z) * s + nz * decalage;
      if (!libre(cx, cz, 20)) continue;
      const nb = 3 + Math.floor(r() * (4 + t));
      let premier = true;
      for (let i = 0; i < nb; i++) {
        const ang = r() * Math.PI * 2;
        const rad = premier ? 0 : entre(r, 4, 22);
        const x = cx + Math.cos(ang) * rad;
        const z = cz + Math.sin(ang) * rad;
        if (!libre(x, z, 10)) continue;
        rochers.push({
          x,
          z,
          r: premier ? entre(r, 3.5, 5) : entre(r, 1.6, 3.8),
          h: premier ? entre(r, 3, 6) : r() < 0.35 ? entre(r, -0.6, -0.1) : entre(r, 0.4, 3.2),
          graine: r() * 1000,
          troncon: t,
        });
        premier = false;
      }
      balises.push({ x: cx, z: cz, troncon: t });
    }
    // tonneaux d'huile le long de la route, à l'écart des récifs
    for (let k = 0; k < 3; k++) {
      for (let essai = 0; essai < 12; essai++) {
        const s = entre(r, 0.25, 0.85);
        const decalage = entre(r, -70, 70);
        const x = a.x + (b.x - a.x) * s + nx * decalage;
        const z = a.z + (b.z - a.z) * s + nz * decalage;
        if (!libre(x, z, 10)) continue;
        if (rochers.some((ro) => Math.hypot(ro.x - x, ro.z - z) < 25)) continue;
        tonneaux.push({ x, z });
        break;
      }
    }
  }

  // récifs épars ailleurs, pour que la mer ne soit jamais vide
  for (let i = 0; i < 70; i++) {
    const x = entre(r, -760, 760);
    const z = entre(r, -760, 760);
    if (Math.hypot(x, z) > 780 || !libre(x, z, 30)) continue;
    const nb = 1 + Math.floor(r() * 4);
    for (let k = 0; k < nb; k++) {
      const px = x + entre(r, -10, 10);
      const pz = z + entre(r, -10, 10);
      if (!libre(px, pz, 30)) continue;
      rochers.push({ x: px, z: pz, r: entre(r, 1.5, 4), h: entre(r, -0.5, 4.5), graine: r() * 1000, troncon: -1 });
    }
  }

  for (const p of PHARES) p.socle = hauteurTerrain(p.x, p.z);
}
