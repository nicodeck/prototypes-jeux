// Les détails qui reviennent d'un bâtiment à l'autre : fenêtres, portes, colonnes, amphores,
// pergolas, torches, étals, fontaines, statues… et la palette commune.
import * as THREE from "three";
import { MAT } from "../materiaux";
import { type Chantier, type Teinte, type V3, teinte, varier } from "./formes";

// ---------------------------------------------------------------------------------------------
// La palette (en sRGB, convertie en linéaire par THREE.Color)
// ---------------------------------------------------------------------------------------------

export const C = {
  enduit: 0xf3eee4,
  pierre: 0xc9ba9c,
  pierreSombre: 0xa59479,
  pierreClaire: 0xddd3be,
  tuf: 0xc9b07e,
  brique: 0xb5623e,
  tuiles: [0xb85a35, 0xc0643a, 0xc8703f, 0xad5331, 0xbe6a44],
  bois: 0x7a5534,
  boisSombre: 0x553823,
  boisClair: 0x9c774f,
  boisGris: 0x8b7b66,
  marbre: 0xefebe2,
  rouge: 0x8e3326,
  ocre: 0xc59034,
  noir: 0x2e2724,
  vertPompei: 0x56704d,
  terrecuite: 0xbd6c40,
  amphore: 0xc47a4a,
  ouverture: 0x3b2c22,
  feu: 0xffa040,
  eau: 0x4a8c96,
  vin: 0x5a1a2c,
  feuillage: 0x5b7a37,
  feuillageSombre: 0x3f5e2b,
  bronze: 0x8c6b3a,
  dallage: 0xbdb4a2,
  terre: 0x9c8463,
  paille: 0xd6b45e,
  basalte: 0x5f5a55,
  toiles: [0xc23b2b, 0xe0c060, 0x3d6b8f, 0xeae2cc, 0x6b8c4e, 0x7a3560],
} as const;

export function tuile(hasard: () => number): THREE.Color {
  return varier(C.tuiles[Math.floor(hasard() * C.tuiles.length)]!, 0.06, hasard);
}

export function toile(hasard: () => number): number {
  return C.toiles[Math.floor(hasard() * C.toiles.length)]!;
}

// ---------------------------------------------------------------------------------------------
// Ouvertures
// ---------------------------------------------------------------------------------------------

export type Face = "z" | "-z" | "x" | "-x";
const ANGLE: Record<Face, number> = { z: 0, x: Math.PI / 2, "-z": Math.PI, "-x": -Math.PI / 2 };

export function angleFace(face: Face) {
  return ANGLE[face];
}

/** Une fenêtre sur le mur dont la surface passe par (x, z), tournée vers `face`, d'appui y. */
export function fenetre(
  ch: Chantier,
  x: number,
  y: number,
  z: number,
  l: number,
  h: number,
  face: Face,
  o: { volets?: Teinte; cadre?: Teinte; arc?: boolean; barreaux?: boolean } = {},
) {
  ch.repere(x, y, z, ANGLE[face], () => {
    ch.boite(0, 0, 0, l, h, 0.04, C.ouverture, MAT.ouverture);
    if (o.arc) {
      const g = new THREE.CylinderGeometry(l / 2, l / 2, 0.04, 10, 1, false, -Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      g.translate(0, h, 0);
      ch.ajouter(g, C.ouverture, MAT.ouverture);
    }
    const cadre = o.cadre ?? C.pierreClaire;
    ch.boite(0, -0.035, 0.014, l + 0.07, 0.035, 0.075, cadre, MAT.pierre);
    if (!o.arc) ch.boite(0, h, 0.01, l + 0.06, 0.04, 0.055, cadre, MAT.pierre);
    else {
      const anneau = new THREE.TorusGeometry(l / 2 + 0.022, 0.024, 4, 10, Math.PI);
      anneau.translate(0, h, 0.012);
      ch.ajouter(anneau, cadre, MAT.pierre);
    }
    if (o.volets) {
      ch.boite(-l / 2 - l * 0.26, 0, 0.024, l * 0.48, h * 0.98, 0.02, o.volets, MAT.bois);
      ch.boite(l / 2 + l * 0.26, 0, 0.024, l * 0.48, h * 0.98, 0.02, o.volets, MAT.bois);
    }
    if (o.barreaux) {
      for (const bx of [-l / 4, 0, l / 4]) ch.boite(bx, 0, 0.022, 0.012, h, 0.012, C.noir, MAT.bronze);
    }
  });
}

/** Une porte : panneau sombre (ouvert) ou vantaux de bois (fermée), avec encadrement. */
export function porte(
  ch: Chantier,
  x: number,
  y: number,
  z: number,
  l: number,
  h: number,
  face: Face,
  o: { arc?: boolean; cadre?: Teinte; matCadre?: number; vantaux?: Teinte; entrouverte?: boolean; seuil?: boolean } = {},
) {
  ch.repere(x, y, z, ANGLE[face], () => {
    ch.boite(0, 0, 0, l, h, 0.04, C.ouverture, MAT.ouverture);
    if (o.arc) {
      const g = new THREE.CylinderGeometry(l / 2, l / 2, 0.04, 12, 1, false, -Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      g.translate(0, h, 0);
      ch.ajouter(g, C.ouverture, MAT.ouverture);
    }
    if (o.vantaux) {
      // Deux vantaux de bois, l'un entrouvert
      const v = o.vantaux;
      ch.boite(-l / 4, 0, 0.026, l / 2 - 0.01, h * 0.98, 0.022, v, MAT.bois);
      if (o.entrouverte) ch.boiteTournee(l / 2 - 0.02, 0, 0.06, 0.02, h * 0.98, l / 2 - 0.01, 0.6, v, MAT.bois);
      else ch.boite(l / 4, 0, 0.026, l / 2 - 0.01, h * 0.98, 0.022, v, MAT.bois);
    }
    const cadre = o.cadre ?? C.pierreClaire;
    const mc = o.matCadre ?? MAT.pierre;
    ch.boite(-l / 2 - 0.025, 0, 0.012, 0.05, h, 0.06, cadre, mc);
    ch.boite(l / 2 + 0.025, 0, 0.012, 0.05, h, 0.06, cadre, mc);
    if (o.arc) {
      const anneau = new THREE.TorusGeometry(l / 2 + 0.03, 0.032, 4, 12, Math.PI);
      anneau.translate(0, h, 0.014);
      ch.ajouter(anneau, cadre, mc);
    } else ch.boite(0, h, 0.014, l + 0.12, 0.06, 0.07, cadre, mc);
    if (o.seuil !== false) ch.boite(0, -0.015, 0.03, l + 0.08, 0.03, 0.09, C.pierreClaire, MAT.marbre);
  });
}

// ---------------------------------------------------------------------------------------------
// Colonnes
// ---------------------------------------------------------------------------------------------

export type Ordre = "toscan" | "ionique" | "corinthien";

/** Un fût de colonne, cannelé si `cannelures` > 0, légèrement aminci en haut. */
function fut(r: number, h: number, cannelures: number, rangs = 3) {
  const n = cannelures > 0 ? cannelures * 2 : 8;
  const g = new THREE.CylinderGeometry(r * 0.86, r, h, n, rangs, true);
  if (cannelures > 0) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const a = Math.atan2(pz, px);
      const k = Math.round((a / (Math.PI * 2)) * n);
      if (((k % 2) + 2) % 2 === 1) {
        pos.setX(i, px * 0.88);
        pos.setZ(i, pz * 0.88);
      }
    }
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

/** Une colonne complète (base, fût, chapiteau), posée en (x, y, z), de hauteur totale h. */
export function colonne(ch: Chantier, x: number, y: number, z: number, h: number, r: number, ordre: Ordre, c: Teinte = C.marbre, mat: number = MAT.marbre, detail = 1) {
  const hBase = r * 0.75;
  const hChap = ordre === "corinthien" ? r * 2.3 : ordre === "ionique" ? r * 0.9 : r * 0.7;
  const hFut = h - hBase - hChap;
  // Base : plinthe et tore
  ch.boite(x, y, z, r * 2.5, r * 0.3, r * 2.5, c, mat);
  ch.tour(x, y + r * 0.3, z, [
    [r * 1.22, 0],
    [r * 1.25, r * 0.12],
    [r * 1.12, r * 0.24],
    [r * 1.02, r * 0.3],
    [r * 1.08, r * 0.38],
    [r, r * 0.45],
  ], detail > 0 ? 12 : 6, c, mat);
  const g = fut(r, hFut, detail > 0 && ordre !== "toscan" ? 10 : 0, detail > 0 ? 3 : 1);
  g.translate(x, y + hBase, z);
  ch.ajouter(g, c, mat);
  const y0 = y + hBase + hFut;
  const rh = r * 0.86;
  if (ordre === "corinthien") {
    // La corbeille évasée et deux couronnes de feuilles d'acanthe
    ch.tour(x, y0, z, [
      [rh, 0],
      [rh * 1.05, hChap * 0.3],
      [rh * 1.25, hChap * 0.65],
      [rh * 1.45, hChap * 0.82],
    ], detail > 0 ? 10 : 6, c, mat);
    if (detail > 0) {
      for (let couronne = 0; couronne < 2; couronne++) {
        const nb = 8;
        for (let i = 0; i < nb; i++) {
          const a = ((i + couronne * 0.5) / nb) * Math.PI * 2;
          const hf = hChap * (couronne === 0 ? 0.42 : 0.62);
          const rr = rh * (1.02 + couronne * 0.12);
          const m = new THREE.Matrix4()
            .makeRotationY(-a + Math.PI / 2)
            .multiply(new THREE.Matrix4().makeRotationX(-0.28))
            .setPosition(x + Math.cos(a) * rr, y0 + hf / 2 + couronne * hChap * 0.1, z + Math.sin(a) * rr);
          ch.boiteM(m, r * 0.55, hf, r * 0.12, c, mat);
        }
      }
      // Les volutes d'angle
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        ch.boule(x + Math.cos(a) * rh * 1.4, y0 + hChap * 0.8, z + Math.sin(a) * rh * 1.4, r * 0.22, r * 0.22, r * 0.22, c, mat, 0);
      }
    }
    // L'abaque
    ch.boite(x, y0 + hChap * 0.82, z, r * 3.0, hChap * 0.18, r * 3.0, c, mat);
  } else if (ordre === "ionique") {
    ch.tour(x, y0, z, [
      [rh, 0],
      [rh * 1.2, hChap * 0.35],
      [rh * 1.15, hChap * 0.55],
    ], detail > 0 ? 10 : 6, c, mat);
    // Les volutes enroulées de part et d'autre
    ch.cylindreCouche(x, y0 + hChap * 0.45, z, hChap * 0.32, r * 2.6, "x", detail > 0 ? 8 : 5, c, mat);
    ch.boite(x, y0 + hChap * 0.72, z, r * 2.7, hChap * 0.28, r * 2.2, c, mat);
  } else {
    ch.tour(x, y0, z, [
      [rh, 0],
      [rh * 1.1, hChap * 0.25],
      [rh * 1.3, hChap * 0.6],
    ], detail > 0 ? 10 : 6, c, mat);
    ch.boite(x, y0 + hChap * 0.6, z, r * 2.7, hChap * 0.4, r * 2.7, c, mat);
  }
}

/** Un entablement simple (architrave, frise, corniche) le long de x, base y. */
export function entablement(ch: Chantier, x: number, y: number, z: number, l: number, p: number, h: number, c: Teinte = C.marbre, frise?: Teinte) {
  ch.boite(x, y, z, l, h * 0.42, p, c, MAT.marbre);
  ch.boite(x, y + h * 0.42, z, l, h * 0.33, p * 0.96, frise ?? c, frise ? MAT.peint : MAT.marbre);
  ch.boite(x, y + h * 0.75, z, l + 0.08, h * 0.25, p + 0.08, c, MAT.marbre);
}

/** Un fronton triangulaire qui regarde +z (largeur l en x, hauteur h, épaisseur p en z). */
export function fronton(ch: Chantier, x: number, y: number, z: number, l: number, h: number, p: number, c: Teinte = C.marbre, tympan?: Teinte) {
  ch.repere(x, y, z, Math.PI / 2, () => {
    ch.prisme(0, 0, 0, p, h, l, tympan ?? c, tympan ? MAT.peint : MAT.marbre);
  });
  // Corniches rampantes, légèrement en saillie
  const a = Math.atan2(h, l / 2);
  const long = Math.hypot(l / 2, h) + 0.06;
  for (const s of [1, -1]) {
    const m = new THREE.Matrix4()
      .makeRotationZ(s * a)
      .setPosition(x - (s * l) / 4, y + h / 2 + 0.02, z + 0.015);
    ch.boiteM(m, long, 0.05, p + 0.05, c, MAT.marbre);
  }
}

// ---------------------------------------------------------------------------------------------
// Terre cuite, bois et petits objets
// ---------------------------------------------------------------------------------------------

const PROFIL_AMPHORE: [number, number][] = [
  [0, 0],
  [0.025, 0.01],
  [0.04, 0.07],
  [0.11, 0.24],
  [0.16, 0.42],
  [0.17, 0.56],
  [0.14, 0.68],
  [0.07, 0.76],
  [0.048, 0.8],
  [0.048, 0.94],
  [0.065, 0.965],
  [0.06, 1.0],
  [0, 1.0],
];

/** Une amphore de hauteur h, éventuellement inclinée (autour de x) et tournée. */
export function amphore(ch: Chantier, x: number, y: number, z: number, h: number, c: Teinte = C.amphore, inclinaison = 0, rotY = 0) {
  const m = new THREE.Matrix4()
    .makeRotationY(rotY)
    .multiply(new THREE.Matrix4().makeRotationX(inclinaison))
    .setPosition(x, y, z);
  ch.repereM(m, () => {
    ch.tour(0, 0, 0, PROFIL_AMPHORE.map(([r, yy]) => [r * h, yy * h]), 8, c, MAT.terrecuite);
    // Les deux anses, du col à l'épaule
    for (const s of [1, -1]) {
      ch.barre([s * h * 0.045, h * 0.9, 0], [s * h * 0.12, h * 0.88, 0], h * 0.014, c, MAT.terrecuite, 4);
      ch.barre([s * h * 0.12, h * 0.88, 0], [s * h * 0.135, h * 0.68, 0], h * 0.014, c, MAT.terrecuite, 4);
    }
  });
}

/** Un rang d'amphores couchées en pyramide (dans un port, un entrepôt). */
export function pileAmphores(ch: Chantier, x: number, y: number, z: number, n: number, rangs: number, h: number, rotY: number, hasard: () => number) {
  ch.repere(x, y, z, rotY, () => {
    for (let r = 0; r < rangs; r++) {
      const nb = n - r;
      for (let i = 0; i < nb; i++) {
        const px = (i - (nb - 1) / 2) * h * 0.36;
        amphore(ch, px, h * 0.17 + r * h * 0.3, -h / 2, h, varier(C.amphore, 0.1, hasard), Math.PI / 2);
      }
    }
  });
}

/** Un dolium (grande jarre ronde), éventuellement enterré jusqu'aux épaules. */
export function dolium(ch: Chantier, x: number, y: number, z: number, r: number, enterre = false, c: Teinte = C.terrecuite) {
  if (enterre) {
    ch.tour(x, y - r * 0.2, z, [
      [r * 0.8, 0],
      [r * 0.7, r * 0.2],
      [r * 0.42, r * 0.36],
      [r * 0.46, r * 0.42],
      [r * 0.36, r * 0.42],
      [r * 0.3, r * 0.3],
      [0, r * 0.3],
    ], 10, c, MAT.terrecuite);
    return;
  }
  ch.tour(x, y, z, [
    [0, 0],
    [r * 0.45, 0.01],
    [r * 0.85, r * 0.35],
    [r, r * 0.8],
    [r * 0.85, r * 1.3],
    [r * 0.45, r * 1.55],
    [r * 0.5, r * 1.62],
    [r * 0.38, r * 1.62],
    [0, r * 1.5],
  ], 10, c, MAT.terrecuite);
}

/** Une pile de rondins couchés le long de x. */
export function pileBois(ch: Chantier, x: number, y: number, z: number, longueur: number, rangs: number, rotY: number, hasard: () => number, r = 0.045) {
  ch.repere(x, y, z, rotY, () => {
    for (let k = 0; k < rangs; k++) {
      const nb = rangs - k + 1;
      for (let i = 0; i < nb; i++) {
        const pz = (i - (nb - 1) / 2) * r * 2.05;
        ch.cylindreCouche((hasard() - 0.5) * 0.04, r + k * r * 1.75, pz, r * (0.85 + hasard() * 0.3), longueur, "x", 6, varier(C.bois, 0.15, hasard), MAT.bois);
      }
    }
  });
}

export function caisse(ch: Chantier, x: number, y: number, z: number, s: number, rotY: number, c: Teinte = C.boisClair) {
  ch.boiteTournee(x, y, z, s, s * 0.8, s, rotY, c, MAT.bois);
  ch.boiteTournee(x, y + s * 0.8, z, s * 1.02, s * 0.06, s * 1.02, rotY, teinte(c).clone().multiplyScalar(0.8), MAT.bois);
}

export function sac(ch: Chantier, x: number, y: number, z: number, s: number, c: Teinte = 0xd8ccb0) {
  ch.boule(x, y + s * 0.5, z, s * 0.45, s * 0.55, s * 0.4, c, MAT.tissu, 1);
  ch.cylindre(x, y + s * 0.95, z, s * 0.12, s * 0.15, 5, c, MAT.tissu);
}

export function panier(ch: Chantier, x: number, y: number, z: number, r: number, contenu?: Teinte) {
  ch.tour(x, y, z, [
    [r * 0.7, 0],
    [r, r * 0.9],
    [r * 0.92, r * 0.9],
    [r * 0.6, r * 0.12],
    [0, r * 0.12],
  ], 8, C.paille, MAT.bois);
  if (contenu) ch.boule(x, y + r * 0.75, z, r * 0.85, r * 0.3, r * 0.85, contenu, MAT.feuillage, 1);
}

export function echelle(ch: Chantier, x: number, y: number, z: number, h: number, rotY: number, inclinaison = 0.25) {
  const m = new THREE.Matrix4().makeRotationY(rotY).multiply(new THREE.Matrix4().makeRotationX(-inclinaison)).setPosition(x, y, z);
  ch.repereM(m, () => {
    ch.boite(-0.08, 0, 0, 0.022, h, 0.022, C.boisClair, MAT.bois);
    ch.boite(0.08, 0, 0, 0.022, h, 0.022, C.boisClair, MAT.bois);
    for (let yy = 0.12; yy < h; yy += 0.14) ch.boite(0, yy, 0, 0.16, 0.016, 0.016, C.boisClair, MAT.bois);
  });
}

/** Un pot de fleurs en terre cuite. */
export function pot(ch: Chantier, x: number, y: number, z: number, s: number, hasard: () => number) {
  ch.tour(x, y, z, [
    [s * 0.5, 0],
    [s * 0.7, s * 0.8],
    [s * 0.78, s * 0.85],
    [0, s * 0.85],
  ], 8, C.terrecuite, MAT.terrecuite);
  ch.boule(x, y + s * 1.05, z, s * 0.75, s * 0.55, s * 0.75, varier(C.feuillage, 0.2, hasard), MAT.feuillage, 1);
  const fleurs = [0xd2384a, 0xe8a0b4, 0xf2d250, 0xf4f0e6, 0xb04aa0];
  const f = fleurs[Math.floor(hasard() * fleurs.length)]!;
  for (let i = 0; i < 3; i++) {
    const a = hasard() * Math.PI * 2;
    ch.boule(x + Math.cos(a) * s * 0.4, y + s * 1.35, z + Math.sin(a) * s * 0.4, s * 0.2, s * 0.2, s * 0.2, f, MAT.feuillage, 0);
  }
}

/** Une pergola couverte de vigne, posée sur un rectangle l × p, de hauteur h. */
export function pergola(ch: Chantier, x: number, y: number, z: number, l: number, p: number, h: number, hasard: () => number, raisins = true, densite = 1) {
  const bx = l / 2 - 0.04;
  const bz = p / 2 - 0.04;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ch.boite(x + sx * bx, y, z + sz * bz, 0.045, h, 0.045, C.boisGris, MAT.bois);
  ch.boite(x, y + h, z - bz, l + 0.06, 0.04, 0.04, C.boisGris, MAT.bois);
  ch.boite(x, y + h, z + bz, l + 0.06, 0.04, 0.04, C.boisGris, MAT.bois);
  const nbLattes = Math.max(2, Math.round(l / 0.16));
  for (let i = 0; i <= nbLattes; i++) {
    const px = x - bx + (2 * bx * i) / nbLattes;
    ch.boite(px, y + h + 0.04, z, 0.025, 0.025, p + 0.08, C.boisGris, MAT.bois);
  }
  // La vigne : des rangs de feuillage qui suivent les lattes, avec des trouées et des pousses
  const nbRangs = Math.max(2, Math.round(p / 0.15));
  for (let i = 0; i < nbRangs; i++) {
    if (densite < 1 && hasard() > densite) continue;
    const pz = z - p / 2 + 0.04 + ((p - 0.08) * (i + 0.5)) / nbRangs;
    const long = (l + 0.08) * (0.75 + hasard() * 0.25);
    const px = x + (hasard() - 0.5) * (l + 0.08 - long);
    ch.masse(px, y + h + 0.08, pz, long, 0.1, (p / nbRangs) * 0.95, varier(hasard() < 0.5 ? C.feuillage : 0x55743a, 0.12, hasard), MAT.feuillage, hasard, 0.42);
  }
  for (let i = 0; i < Math.round(l * p * 10) + 2; i++) {
    const px = x + (hasard() - 0.5) * (l + 0.12);
    const pz = z + (hasard() < 0.5 ? -1 : 1) * (p / 2 + 0.02);
    ch.boule(px, y + h + 0.02 - hasard() * 0.08, pz, 0.05, 0.08, 0.04, varier(C.feuillageSombre, 0.15, hasard), MAT.feuillage, 0);
  }
  // Un pied de vigne qui grimpe le long d'un poteau
  ch.barre([x - bx + 0.05, y, z + bz - 0.05], [x - bx + 0.02, y + h, z + bz - 0.02], 0.022, C.boisSombre, MAT.bois, 5);
  if (raisins) {
    for (let i = 0; i < Math.round(l * p * 6) + 1; i++) {
      const px = x + (hasard() - 0.5) * l * 0.8;
      const pz = z + (hasard() - 0.5) * p * 0.8;
      ch.boule(px, y + h - 0.05, pz, 0.03, 0.05, 0.03, 0x4a2350, MAT.feuillage, 0);
    }
  }
}

/** Une torche fixée au mur dont la surface passe par (x, z), tournée vers `face`. */
export function torche(ch: Chantier, x: number, y: number, z: number, face: Face) {
  ch.repere(x, y, z, ANGLE[face], () => {
    ch.boite(0, -0.02, 0.02, 0.03, 0.06, 0.04, C.noir, MAT.bronze);
    ch.barre([0, 0, 0.04], [0, 0.16, 0.09], 0.014, C.boisSombre, MAT.bois, 5);
    ch.cylindre(0, 0.15, 0.095, 0.03, 0.04, 6, C.noir, MAT.bronze, 0.036);
    ch.cylindre(0, 0.18, 0.095, 0.03, 0.08, 6, C.feu, MAT.feu, 0.0);
    ch.emettre("torche", 0, 0.22, 0.1);
  });
}

/** Un brasero sur trépied de bronze (devant les temples), avec son feu. */
export function brasero(ch: Chantier, x: number, y: number, z: number, h: number) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ch.barre([x + Math.cos(a) * h * 0.22, y, z + Math.sin(a) * h * 0.22], [x + Math.cos(a) * h * 0.1, y + h * 0.85, z + Math.sin(a) * h * 0.1], h * 0.025, C.bronze, MAT.bronze, 5);
  }
  ch.tour(x, y + h * 0.8, z, [
    [h * 0.05, 0],
    [h * 0.2, h * 0.08],
    [h * 0.24, h * 0.2],
    [h * 0.2, h * 0.2],
    [0, h * 0.12],
  ], 10, C.bronze, MAT.bronze);
  ch.cylindre(x, y + h * 0.95, z, h * 0.16, h * 0.22, 7, C.feu, MAT.feu, 0);
  ch.emettre("feu", x, y + h * 1.1, z);
}

/** Une statue drapée (toge) sur un piédestal, le bras droit levé. */
export function statue(ch: Chantier, x: number, y: number, z: number, h: number, rotY = 0, c: Teinte = C.bronze, mat: number = MAT.bronze, socle = true) {
  ch.repere(x, y, z, rotY, () => {
    let y0 = 0;
    if (socle) {
      ch.boite(0, 0, 0, h * 0.42, h * 0.08, h * 0.42, C.marbre, MAT.marbre);
      ch.boite(0, h * 0.08, 0, h * 0.34, h * 0.5, h * 0.34, C.marbre, MAT.marbre);
      ch.boite(0, h * 0.58, 0, h * 0.4, h * 0.06, h * 0.4, C.marbre, MAT.marbre);
      y0 = h * 0.64;
    }
    const f = h * 0.95;
    // Le corps drapé
    ch.tour(0, y0, 0, [
      [f * 0.11, 0],
      [f * 0.12, f * 0.05],
      [f * 0.1, f * 0.35],
      [f * 0.085, f * 0.5],
      [f * 0.1, f * 0.68],
      [f * 0.11, f * 0.78],
      [f * 0.05, f * 0.84],
      [0, f * 0.84],
    ], 8, c, mat);
    // Le pan de toge sur l'épaule
    ch.boule(-f * 0.05, y0 + f * 0.62, f * 0.02, f * 0.07, f * 0.2, f * 0.08, c, mat, 1);
    // La tête
    ch.boule(0, y0 + f * 0.9, 0, f * 0.055, f * 0.065, f * 0.06, c, mat, 1);
    // Le bras droit levé (adlocutio) et le gauche qui tient un sceptre
    ch.barre([f * 0.1, y0 + f * 0.74, 0], [f * 0.2, y0 + f * 0.98, f * 0.08], f * 0.022, c, mat, 5);
    ch.barre([-f * 0.1, y0 + f * 0.72, 0], [-f * 0.14, y0 + f * 0.5, f * 0.08], f * 0.022, c, mat, 5);
    ch.barre([-f * 0.15, y0 + f * 0.1, f * 0.09], [-f * 0.13, y0 + f * 1.05, f * 0.07], f * 0.012, c, mat, 4);
  });
}

/** Une Victoire ailée (acrotère de fronton). */
export function victoire(ch: Chantier, x: number, y: number, z: number, h: number, c: Teinte = C.bronze) {
  statue(ch, x, y, z, h, 0, c, MAT.bronze, false);
  for (const s of [1, -1]) {
    const m = new THREE.Matrix4()
      .makeRotationZ(s * 0.5)
      .multiply(new THREE.Matrix4().makeRotationY(s * 0.3))
      .setPosition(x + s * h * 0.12, y + h * 0.78, z - h * 0.06);
    ch.boiteM(m, h * 0.06, h * 0.42, h * 0.16, c, MAT.bronze);
  }
}

/** Un étal de marché sous un auvent à rayures, avec ses marchandises. */
export function etal(
  ch: Chantier,
  x: number,
  y: number,
  z: number,
  rotY: number,
  toiles: [Teinte, Teinte],
  marchandise: "fruits" | "poisson" | "poterie" | "etoffes" | "pain" | "fleurs",
  hasard: () => number,
) {
  ch.repere(x, y, z, rotY, () => {
    const l = 0.62;
    const p = 0.36;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const hp = sz < 0 ? 0.78 : 0.66;
        ch.boite((sx * l) / 2, 0, (sz * p) / 2, 0.025, hp, 0.025, C.boisGris, MAT.bois);
      }
    ch.boite(0, 0.32, 0.02, l, 0.04, p * 0.8, C.bois, MAT.bois);
    ch.boite(0, 0, 0.02, l * 0.96, 0.32, 0.02, C.boisSombre, MAT.bois);
    // L'auvent en bandes
    const nb = 5;
    const a = Math.atan2(0.14, p + 0.12);
    for (let i = 0; i < nb; i++) {
      const px = -l / 2 - 0.03 + ((l + 0.06) * (i + 0.5)) / nb;
      const m = new THREE.Matrix4().makeRotationX(a).setPosition(px, 0.73, 0.02);
      ch.boiteM(m, (l + 0.06) / nb, 0.012, p + 0.2, toiles[i % 2]!, MAT.tissu);
    }
    // Le lambrequin découpé à l'avant
    for (let i = 0; i < 6; i++) ch.boite(-l / 2 + 0.05 + i * (l / 5.6), 0.56, p / 2 + 0.08, 0.06, 0.06, 0.008, toiles[0], MAT.tissu);
    // Les marchandises
    const yt = 0.36;
    if (marchandise === "fruits" || marchandise === "fleurs") {
      const couleurs = marchandise === "fruits" ? [0xd88a2a, 0x7c9a32, 0xa42a2a, 0xe0c040, 0x5a2a5a] : [0xd2384a, 0xf2d250, 0xf4f0e6, 0xb04aa0];
      for (let k = 0; k < 4; k++) {
        const px = -l / 2 + 0.1 + k * 0.14;
        panier(ch, px, yt, 0.02, 0.06, couleurs[Math.floor(hasard() * couleurs.length)]!);
      }
    } else if (marchandise === "poisson") {
      ch.boite(0, yt, 0.02, l * 0.85, 0.02, p * 0.6, 0xa8b4b8, MAT.eau);
      for (let k = 0; k < 7; k++) {
        const px = -l / 2 + 0.08 + hasard() * (l - 0.16);
        const pz = -0.06 + hasard() * 0.14;
        const m = new THREE.Matrix4().makeRotationY(hasard() * Math.PI).setPosition(px, yt + 0.035, pz);
        ch.ajouter(new THREE.SphereGeometry(0.02, 6, 4).scale(3.2, 0.7, 1), 0x9aa4ac, MAT.bronze, m);
      }
    } else if (marchandise === "poterie") {
      for (let k = 0; k < 5; k++) {
        const px = -l / 2 + 0.08 + k * 0.12;
        ch.tour(px, yt, 0.02 + (hasard() - 0.5) * 0.1, [
          [0.025, 0],
          [0.05, 0.05],
          [0.03, 0.1],
          [0.035, 0.12],
          [0, 0.11],
        ], 7, varier(C.terrecuite, 0.2, hasard), MAT.terrecuite);
      }
    } else if (marchandise === "etoffes") {
      for (let k = 0; k < 5; k++) {
        ch.cylindreCouche(-l / 2 + 0.08 + k * 0.12, yt + 0.035, 0.02, 0.035, p * 0.7, "z", 6, C.toiles[Math.floor(hasard() * C.toiles.length)]!, MAT.tissu);
      }
    } else {
      for (let k = 0; k < 8; k++) {
        ch.boule(-l / 2 + 0.07 + (k % 4) * 0.15, yt + 0.025, -0.06 + Math.floor(k / 4) * 0.13, 0.055, 0.025, 0.055, 0xb07a3c, MAT.terrecuite, 1);
      }
    }
    // Quelques amphores et paniers au pied de l'étal
    amphore(ch, l / 2 + 0.06, 0, -0.08, 0.3, varier(C.amphore, 0.1, hasard), 0.12);
    panier(ch, -l / 2 - 0.05, 0, 0.12, 0.07);
  });
}

/** Une fontaine ronde avec sa vasque et son jet. */
export function fontaine(ch: Chantier, x: number, y: number, z: number, r: number) {
  ch.tour(x, y, z, [
    [r * 0.9, 0],
    [r, r * 0.06],
    [r, r * 0.42],
    [r * 0.88, r * 0.46],
    [r * 0.82, r * 0.42],
    [r * 0.82, r * 0.12],
    [0, r * 0.12],
  ], 14, C.marbre, MAT.marbre);
  ch.cylindre(x, y + r * 0.1, z, r * 0.83, r * 0.24, 14, C.eau, MAT.eau);
  ch.tour(x, y + r * 0.1, z, [
    [r * 0.14, 0],
    [r * 0.1, r * 0.5],
    [r * 0.12, r * 0.65],
    [r * 0.38, r * 0.75],
    [r * 0.4, r * 0.82],
    [r * 0.3, r * 0.82],
    [r * 0.08, r * 0.95],
    [r * 0.06, r * 1.1],
    [0, r * 1.12],
  ], 10, C.marbre, MAT.marbre);
  ch.cylindre(x, y + r * 0.86, z, r * 0.3, r * 0.03, 10, C.eau, MAT.eau);
  ch.emettre("fontaine", x, y + r * 1.15, z);
}

/** Une cheminée de briques sur un toit, qui fume. */
export function cheminee(ch: Chantier, x: number, y: number, z: number, h: number) {
  ch.boite(x, y, z, 0.13, h, 0.13, C.brique, MAT.pierre);
  ch.boite(x, y + h, z, 0.17, 0.03, 0.17, C.pierreSombre, MAT.pierre);
  ch.boite(x, y + h + 0.03, z, 0.07, 0.05, 0.07, C.brique, MAT.terrecuite);
  ch.emettre("fumee", x, y + h + 0.1, z);
}

/** Une corde à linge avec des draps colorés, de (x1, z1) à (x2, z2) à la hauteur y. */
export function linge(ch: Chantier, x1: number, z1: number, x2: number, z2: number, y: number, hasard: () => number) {
  ch.barre([x1, y, z1], [x2, y - 0.02, z2], 0.006, C.boisClair, MAT.bois, 3);
  const n = 3 + Math.floor(hasard() * 2);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    const h = 0.12 + hasard() * 0.1;
    const couleurs = [0xf1ece0, 0xe8dcc0, 0x8aa6c0, 0xc0503c, 0xe4c46a];
    ch.boiteTournee(px, y - h, pz, Math.hypot(x2 - x1, z2 - z1) / n - 0.03, h, 0.008, ang, couleurs[Math.floor(hasard() * couleurs.length)]!, MAT.tissu);
  }
}

/** Un muret de (x1, z1) à (x2, z2), de base y et de hauteur h, coiffé de tuiles. */
export function muret(ch: Chantier, x1: number, z1: number, x2: number, z2: number, y: number, h: number, ep: number, c: Teinte, mat: number, chaperon: Teinte | null = C.tuiles[0]) {
  const l = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  ch.repere((x1 + x2) / 2, y, (z1 + z2) / 2, ang, () => {
    ch.boite(0, 0, 0, l, h, ep, c, mat);
    if (chaperon !== null) ch.prisme(0, h, 0, l + 0.02, 0.05, ep + 0.05, chaperon, MAT.tuiles);
  });
}

/** Une haie taillée de (x1, z1) à (x2, z2). */
export function haie(ch: Chantier, x1: number, z1: number, x2: number, z2: number, y: number, h: number, ep: number, hasard: () => number) {
  const l = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  ch.masse((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2, l, h, ep, varier(C.feuillageSombre, 0.1, hasard), MAT.feuillage, hasard, 0.12, ang);
}

/** Un cyprès taillé en topiaire, en pot ou en pleine terre. */
export function topiaire(ch: Chantier, x: number, y: number, z: number, h: number, hasard: () => number) {
  ch.tour(x, y, z, [
    [h * 0.12, 0],
    [h * 0.16, h * 0.25],
    [h * 0.13, h * 0.6],
    [h * 0.05, h * 0.92],
    [0, h],
  ], 7, varier(C.feuillageSombre, 0.1, hasard), MAT.feuillage);
}

/** La margelle d'un puits ou d'une citerne (puteal). */
export function puits(ch: Chantier, x: number, y: number, z: number, r: number) {
  ch.tour(x, y, z, [
    [r, 0],
    [r, r * 1.1],
    [r * 0.75, r * 1.15],
    [r * 0.7, r * 0.3],
    [0, r * 0.3],
  ], 12, C.pierreClaire, MAT.marbre);
  ch.cylindre(x, y + r * 0.3, z, r * 0.68, 0.01, 10, 0x1d2a2a, MAT.eau);
}

/** Un banc de pierre. */
export function banc(ch: Chantier, x: number, y: number, z: number, l: number, rotY: number) {
  ch.repere(x, y, z, rotY, () => {
    ch.boite(-l / 2 + 0.05, 0, 0, 0.06, 0.13, 0.12, C.pierreClaire, MAT.pierre);
    ch.boite(l / 2 - 0.05, 0, 0, 0.06, 0.13, 0.12, C.pierreClaire, MAT.pierre);
    ch.boite(0, 0.13, 0, l, 0.04, 0.16, C.marbre, MAT.marbre);
  });
}

/** Les meules pompéiennes : la meta (cône) et le catillus (sablier), avec son bâti de bois. */
export function meule(ch: Chantier, x: number, y: number, z: number, s: number) {
  ch.cylindre(x, y, z, s * 0.42, s * 0.18, 12, C.pierreSombre, MAT.pierre, s * 0.42);
  ch.tour(x, y + s * 0.18, z, [
    [s * 0.25, 0],
    [s * 0.2, s * 0.3],
    [0, s * 0.42],
  ], 10, C.basalte, MAT.terrecuite);
  ch.tour(x, y + s * 0.2, z, [
    [s * 0.27, 0],
    [s * 0.18, s * 0.22],
    [s * 0.12, s * 0.3],
    [s * 0.18, s * 0.38],
    [s * 0.28, s * 0.62],
    [s * 0.22, s * 0.62],
    [0, s * 0.5],
  ], 10, C.basalte, MAT.terrecuite);
  ch.boite(x, y + s * 0.44, z, s * 0.9, s * 0.06, s * 0.08, C.bois, MAT.bois);
}

/** Une grue à roue (polyspaste) : flèche inclinée et grande roue où marchent les ouvriers. */
export function grueRoue(ch: Chantier, x: number, y: number, z: number, rotY: number, h: number) {
  ch.repere(x, y, z, rotY, () => {
    // La flèche : deux mâts inclinés vers +z, liés en tête
    const tete: V3 = [0, h, h * 0.42];
    for (const s of [-1, 1]) {
      ch.barre([s * 0.32, 0, -0.1], [s * 0.06, h, h * 0.42], 0.045, C.bois, MAT.bois, 6);
      ch.barre([s * 0.3, 0, -0.1], [s * 0.1, h * 0.55, -0.9], 0.018, C.boisClair, MAT.bois, 4);
    }
    ch.boite(0, h - 0.05, h * 0.42, 0.22, 0.08, 0.12, C.boisSombre, MAT.bois);
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      ch.boite(0, h * t - 0.02, h * 0.42 * t - 0.1 * (1 - t), 0.64 * (1 - t) + 0.12 * t, 0.035, 0.035, C.boisClair, MAT.bois);
    }
    // La roue
    const rr = h * 0.24;
    const anneau = new THREE.TorusGeometry(rr, 0.035, 4, 20);
    anneau.rotateY(Math.PI / 2);
    for (const s of [-0.13, 0.13]) {
      const g = anneau.clone();
      g.translate(-0.62 + s, rr + 0.08, -0.25);
      ch.ajouter(g, C.bois, MAT.bois);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ch.barre([-0.62, rr + 0.08, -0.25], [-0.62, rr + 0.08 + Math.sin(a) * rr, -0.25 + Math.cos(a) * rr], 0.016, C.boisClair, MAT.bois, 4);
      ch.boite(-0.62, rr + 0.08 + Math.sin(a) * rr - 0.015, -0.25 + Math.cos(a) * rr, 0.3, 0.03, 0.03, C.boisClair, MAT.bois);
    }
    ch.cylindreCouche(-0.4, rr + 0.08, -0.25, 0.04, 0.5, "x", 6, C.boisSombre, MAT.bois);
    for (const s of [-1, 1]) ch.barre([-0.62 + s * 0.2, 0, -0.25 + s * 0.15], [-0.62, rr + 0.08, -0.25], 0.03, C.bois, MAT.bois, 5);
    // Le câble et la charge (un ballot)
    ch.barre(tete, [0, h * 0.42, h * 0.42], 0.007, 0xc8b890, MAT.tissu, 3);
    ch.barre(tete, [-0.4, rr + 0.08, -0.25], 0.007, 0xc8b890, MAT.tissu, 3);
    ch.boule(0, h * 0.36, h * 0.42, 0.12, 0.09, 0.1, 0xd6c8a6, MAT.tissu, 1);
  });
}

/** Une chèvre de levage (trépied) avec son palan et un bloc suspendu. */
export function chevre(ch: Chantier, x: number, y: number, z: number, h: number, bloc: Teinte) {
  const tete: V3 = [x, y + h, z];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    ch.barre([x + Math.cos(a) * h * 0.38, y, z + Math.sin(a) * h * 0.38], tete, 0.03, C.bois, MAT.bois, 5);
  }
  ch.barre(tete, [x, y + h * 0.42, z], 0.008, 0xc8b890, MAT.tissu, 3);
  ch.boite(x, y + h * 0.18, z, h * 0.28, h * 0.22, h * 0.2, bloc, MAT.marbre);
}
