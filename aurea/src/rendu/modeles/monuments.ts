// Les grands édifices : forum, thermes, temple, port et phare ; l'aqueduc et son château d'eau.
// La façade regarde +z.
import * as THREE from "three";
import { MAT } from "../materiaux";
import {
  C,
  amphore,
  banc,
  brasero,
  caisse,
  colonne,
  entablement,
  etal,
  fenetre,
  fontaine,
  fronton,
  grueRoue,
  pileAmphores,
  porte,
  pot,
  sac,
  statue,
  toile,
  torche,
  tuile,
  victoire,
} from "./details";
import { type Chantier, type Teinte, varier } from "./formes";
import { fondation } from "./maisons";

type Hasard = () => number;

/** Une voûte en berceau (demi-cylindre) le long de x, posée à y, de rayon r. */
function voute(ch: Chantier, x: number, y: number, z: number, longueur: number, r: number, rapport: number, c: Teinte, mat: number, axe: "x" | "z" = "x") {
  const g = new THREE.CylinderGeometry(r, r, longueur, 18, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.scale(1, rapport, 1);
  if (axe === "z") g.rotateY(Math.PI / 2);
  g.translate(x, y, z);
  ch.ajouter(g, c, mat);
}

/** Un quart de sphère (cul-de-four d'une abside) tourné vers `rotY`. */
function culDeFour(ch: Chantier, x: number, y: number, z: number, r: number, rotY: number, c: Teinte, mat: number) {
  const g = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI, 0, Math.PI / 2);
  g.rotateY(rotY);
  g.translate(x, y, z);
  ch.ajouter(g, c, mat);
}

/** Un demi-cylindre vertical (le mur d'une abside). */
function demiTour(ch: Chantier, x: number, y: number, z: number, r: number, h: number, rotY: number, c: Teinte, mat: number) {
  const g = new THREE.CylinderGeometry(r, r, h, 12, 1, false, 0, Math.PI);
  g.rotateY(rotY);
  g.translate(x, y + h / 2, z);
  ch.ajouter(g, c, mat);
}

// ---------------------------------------------------------------------------------------------
// Le forum
// ---------------------------------------------------------------------------------------------

/** Un portique : mur du fond (avec des boutiques), colonnade et toit en appentis, le long de x local. */
function portique(ch: Chantier, longueur: number, profondeur: number, hCol: number, tu: Teinte, r: Hasard) {
  // Le mur du fond est à z = -profondeur, la colonnade à z = 0 (repère local)
  const hMur = hCol + 0.35;
  ch.boite(0, 0.2, -profondeur + 0.07, longueur, hMur, 0.14, C.enduit, MAT.enduit);
  ch.boite(0, 0.2, -profondeur + 0.07, longueur + 0.01, 0.35, 0.15, C.rouge, MAT.peint);
  const n = Math.max(2, Math.round(longueur / 0.52));
  const pas = longueur / n;
  for (let i = 0; i <= n; i++) colonne(ch, -longueur / 2 + i * pas, 0.2, 0, hCol, 0.055, "ionique", C.marbre, MAT.marbre, 0);
  for (let i = 0; i < n; i++) {
    const px = -longueur / 2 + (i + 0.5) * pas;
    porte(ch, px, 0.2, -profondeur + 0.14, 0.26, 0.55, "z", { cadre: C.pierreClaire, seuil: false });
    if (r() < 0.5) amphore(ch, px + 0.15, 0.2, -profondeur + 0.25, 0.26, varier(C.amphore, 0.1, r), -0.15);
  }
  ch.boite(0, 0.2 + hCol, 0, longueur + 0.1, 0.1, 0.16, C.marbre, MAT.marbre);
  ch.appentis(0, 0.2, -profondeur / 2, longueur + 0.04, profondeur, hMur + 0.04, hCol + 0.1, 0.08, 0.05, tu);
  ch.boite(0, 0.2, -profondeur / 2, longueur, 0.012, profondeur, 0xcfc4ae, MAT.dallage);
}

export function forum(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  const D = 2.9;
  fondation(ch, 5.9, 5.9);
  ch.boite(0, 0.06, 0, 5.82, 0.14, 5.82, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, 2.85, 5.6, 0.07, 0.18, C.pierreClaire, MAT.pierre);
  // Trois portiques : nord, ouest et est
  const prof = 0.72;
  ch.repere(0, 0, -D + prof, 0, () => portique(ch, 5.8, prof, 1.2, tu, r));
  ch.repere(-D + prof, 0, 0.42, Math.PI / 2, () => portique(ch, 4.9, prof, 1.2, tu, r));
  ch.repere(D - prof, 0, 0.42, -Math.PI / 2, () => portique(ch, 4.9, prof, 1.2, tu, r));
  // Au centre du portique nord, le sanctuaire des Lares : podium, colonnes et fronton
  ch.boite(0, 0.2, -1.86, 1.5, 0.3, 0.8, C.marbre, MAT.marbre);
  ch.escalier(0, 0.2, -1.38, 0.8, 0.3, 0.24, 3, C.marbre, MAT.marbre, Math.PI);
  for (const px of [-0.6, -0.2, 0.2, 0.6]) colonne(ch, px, 0.5, -1.55, 1.3, 0.06, "corinthien", C.marbre, MAT.marbre, 1);
  ch.boite(0, 0.5, -2.08, 1.4, 1.3, 0.3, C.enduit, MAT.enduit);
  porte(ch, 0, 0.5, -1.93, 0.36, 0.8, "z", { vantaux: C.bronze, cadre: C.marbre, matCadre: MAT.marbre, seuil: false });
  entablement(ch, 0, 1.8, -1.82, 1.5, 0.66, 0.2, C.marbre, 0xa33a2a);
  fronton(ch, 0, 2.0, -1.5, 1.56, 0.42, 0.1);
  ch.toit2(0, 2.0, -1.85, 0.7, 1.5, 0.42, 0.08, 0.05, tu, "z", { c: C.marbre, mat: MAT.marbre });
  ch.ajouter(new THREE.TorusGeometry(0.1, 0.022, 5, 12).translate(0, 2.16, -1.44), C.bronze, MAT.bronze);
  // La statue de bronze au centre, et la fontaine
  statue(ch, 0, 0.2, -0.5, 1.1, 0, C.bronze, MAT.bronze);
  ch.boite(0, 0.2, -0.5, 0.62, 0.05, 0.62, C.marbre, MAT.marbre);
  fontaine(ch, 0, 0.2, 1.05, 0.32);
  // Les étals du marché, aux auvents colorés
  const sortes = ["fruits", "poisson", "poterie", "etoffes", "pain", "fleurs"] as const;
  const places: [number, number, number][] = [
    [-1.5, 0.05, 0.1],
    [-0.75, -0.1, -0.15],
    [0.8, -0.05, 0.12],
    [1.55, 0.1, -0.1],
    [-1.5, 1.6, Math.PI + 0.1],
    [-0.75, 2.05, 0.05],
    [0.8, 1.95, -0.08],
    [1.55, 1.55, Math.PI - 0.12],
  ];
  places.forEach(([px, pz, rot], i) => {
    const t = toile(r);
    etal(ch, px, 0.2, pz, rot, [t, 0xeae2cc], sortes[i % sortes.length]!, r);
  });
  // Bancs, torches aux angles, quelques pots
  banc(ch, -0.55, 0.2, 0.55, 0.5, 0);
  banc(ch, 0.55, 0.2, 0.55, 0.5, 0);
  for (const [px, pz, f] of [
    [-2.18, -2.18, "z"],
    [2.18, -2.18, "z"],
    [-2.18, 2.3, "x"],
    [2.18, 2.3, "-x"],
  ] as const) {
    ch.boite(px, 0.2, pz, 0.06, 0.6, 0.06, C.boisSombre, MAT.bois);
    torche(ch, px, 0.66, pz, f);
  }
  pot(ch, -0.4, 0.2, -1.2, 0.1, r);
  pot(ch, 0.4, 0.2, -1.2, 0.1, r);
}

// ---------------------------------------------------------------------------------------------
// Les thermes
// ---------------------------------------------------------------------------------------------

export function thermes(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  const brique = varier(C.brique, 0.05, r);
  fondation(ch, 4.9, 4.9);
  ch.boite(0, 0.06, 1.25, 4.84, 0.014, 2.3, C.dallage, MAT.dallage);
  // La rotonde du caldarium : tambour percé d'arcades, coupole et lanternon
  const zc = -1.15;
  ch.cylindre(0, 0.06, zc, 1.0, 1.7, 24, C.enduit, MAT.enduit);
  ch.cylindre(0, 0.06, zc, 1.02, 0.25, 24, C.pierre, MAT.pierre);
  ch.cylindre(0, 1.7, zc, 1.06, 0.08, 24, C.pierreClaire, MAT.marbre);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ch.repere(Math.sin(a) * 1.0, 0, zc + Math.cos(a) * 1.0, a, () => fenetre(ch, 0, 0.95, 0, 0.18, 0.4, "z", { arc: true, cadre: C.pierreClaire }));
  }
  ch.dome(0, 1.78, zc, 1.02, varier(C.tuiles[2]!, 0.05, r), MAT.tuiles, 24, 0.78);
  ch.cylindre(0, 2.5, zc, 0.18, 0.22, 10, C.pierreClaire, MAT.marbre);
  ch.dome(0, 2.72, zc, 0.2, C.bronze, MAT.bronze, 10, 0.8);
  ch.emettre("vapeur", 0, 2.9, zc);
  // Les deux grandes salles voûtées, frigidarium à l'ouest et tepidarium à l'est
  for (const s of [-1, 1]) {
    const cx = s * 1.65;
    ch.boite(cx, 0.06, -1.15, 1.5, 1.35, 1.8, brique, MAT.pierre);
    ch.boite(cx, 0.06, -1.15, 1.52, 0.22, 1.82, C.pierre, MAT.pierre);
    ch.boite(cx, 1.35, -1.15, 1.56, 0.06, 1.86, C.pierreClaire, MAT.marbre);
    voute(ch, cx, 1.41, -1.15, 1.56, 0.93, 0.55, varier(C.tuiles[1]!, 0.05, r), MAT.tuiles);
    // La fenêtre thermale en demi-lune, sur le pignon
    ch.repere(s * 2.43, 1.41, -1.15, s > 0 ? Math.PI / 2 : -Math.PI / 2, () => {
      const g = new THREE.CircleGeometry(0.6, 12, 0, Math.PI);
      g.translate(0, 0, 0.012);
      ch.ajouter(g, C.ouverture, MAT.ouverture);
      for (const dx of [-0.2, 0.2]) ch.boite(dx, 0, 0.02, 0.05, 0.55, 0.03, C.pierreClaire, MAT.pierre);
    });
    for (const pz of [-1.7, -0.6]) fenetre(ch, s * 2.4, 0.6, pz, 0.16, 0.42, s > 0 ? "x" : "-x", { arc: true, cadre: C.pierreClaire });
    // L'abside au nord, avec son cul-de-four
    demiTour(ch, cx, 0.06, -2.05, 0.45, 1.0, Math.PI / 2, brique, MAT.pierre);
    culDeFour(ch, cx, 1.06, -2.05, 0.45, Math.PI / 2, varier(C.tuiles[0]!, 0.05, r), MAT.tuiles);
    ch.emettre("vapeur", cx, 1.95, -1.15);
  }
  // Le praefurnium (la chaufferie) à l'arrière, qui fume
  ch.boite(1.65, 0.06, -2.3, 0.4, 0.55, 0.2, brique, MAT.pierre);
  ch.boite(1.65, 0.06, -2.3, 0.14, 1.9, 0.14, brique, MAT.pierre);
  ch.emettre("fumee", 1.65, 2.05, -2.3);
  // L'entrée vers la palestre
  porte(ch, 0, 0.06, -0.15, 0.4, 0.8, "z", { arc: true, cadre: C.marbre, matCadre: MAT.marbre });
  for (const s of [-1, 1]) porte(ch, s * 1.65, 0.06, -0.25, 0.3, 0.65, "z", { arc: true, cadre: C.pierreClaire });
  // La palestre : portiques est et ouest, natatio au centre
  for (const s of [-1, 1]) {
    ch.boite(s * 2.37, 0.06, 1.2, 0.12, 1.0, 2.3, C.enduit, MAT.enduit);
    ch.boite(s * 2.37, 0.06, 1.2, 0.13, 0.26, 2.31, C.rouge, MAT.peint);
    for (let i = 0; i < 5; i++) colonne(ch, s * 1.95, 0.06, 0.25 + i * 0.47, 0.82, 0.045, "ionique", C.marbre, MAT.marbre, 0);
    ch.boite(s * 1.95, 0.88, 1.2, 0.12, 0.08, 2.0, C.marbre, MAT.marbre);
    ch.appentis(s * 2.17, 0.06, 1.2, 2.2, 0.48, 1.08, 0.94, 0.06, 0.04, tu, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  // La natatio : un grand bassin bordé de marbre, des marches pour y descendre
  const bl = 2.3;
  const bp = 1.15;
  const bz = 1.15;
  ch.boite(0, 0.06, bz, bl, 0.05, bp, C.eau, MAT.eau);
  ch.boite(0, 0.06, bz - bp / 2 - 0.05, bl + 0.2, 0.09, 0.1, C.marbre, MAT.marbre);
  ch.boite(0, 0.06, bz + bp / 2 + 0.05, bl + 0.2, 0.09, 0.1, C.marbre, MAT.marbre);
  ch.boite(-bl / 2 - 0.05, 0.06, bz, 0.1, 0.09, bp, C.marbre, MAT.marbre);
  ch.boite(bl / 2 + 0.05, 0.06, bz, 0.1, 0.09, bp, C.marbre, MAT.marbre);
  for (const s of [-1, 1]) {
    statue(ch, s * 1.4, 0.06, 1.9, 0.5, s * 0.5, C.marbre, MAT.marbre);
    pot(ch, s * 1.4, 0.06, 0.35, 0.1, r);
  }
  ch.emettre("vapeur", -0.5, 0.25, bz);
  ch.emettre("vapeur", 0.5, 0.25, bz);
  // Le mur sud et le propylée d'entrée
  for (const s of [-1, 1]) ch.boite(s * 1.55, 0.06, 2.28, 1.7, 0.75, 0.1, C.enduit, MAT.enduit);
  for (const s of [-1, 1]) colonne(ch, s * 0.45, 0.06, 2.28, 1.05, 0.06, "corinthien", C.marbre, MAT.marbre, 1);
  entablement(ch, 0, 1.11, 2.28, 1.1, 0.2, 0.16, C.marbre, C.rouge);
  fronton(ch, 0, 1.27, 2.34, 1.14, 0.3, 0.08);
  torche(ch, -0.7, 0.55, 2.33, "z");
  torche(ch, 0.7, 0.55, 2.33, "z");
}

// ---------------------------------------------------------------------------------------------
// Le temple
// ---------------------------------------------------------------------------------------------

export function temple(ch: Chantier, r: Hasard) {
  const tu = varier(C.tuiles[1]!, 0.04, r);
  const marbre = C.marbre;
  const pierreMarbre = 0xe4ddcd;
  fondation(ch, 5.9, 7.9, 0, 0, 0.06, C.pierreClaire);
  ch.boite(0, 0.06, 0, 5.84, 0.012, 7.84, 0xd3c9b4, MAT.dallage);
  // Le podium, avec ses moulures en bas et en haut
  const zA = -3.78;
  const zF = 1.95;
  const zm = (zA + zF) / 2;
  const lp = zF - zA;
  const yP = 1.0;
  ch.boite(0, 0.06, zm, 4.6, yP - 0.06, lp, pierreMarbre, MAT.pierre);
  ch.boite(0, 0.06, zm, 4.72, 0.16, lp + 0.12, marbre, MAT.marbre);
  ch.boite(0, yP - 0.1, zm, 4.74, 0.1, lp + 0.12, marbre, MAT.marbre);
  // L'escalier frontal, entre deux murs d'échiffre qui portent des braseros
  ch.escalier(0, 0.06, 2.6, 3.4, yP - 0.06, 1.3, 10, marbre, MAT.marbre);
  for (const s of [-1, 1]) {
    ch.boite(s * 1.92, 0.06, 2.55, 0.42, 0.62, 1.2, pierreMarbre, MAT.pierre);
    ch.boite(s * 1.92, 0.68, 2.55, 0.48, 0.06, 1.26, marbre, MAT.marbre);
    brasero(ch, s * 1.92, 0.74, 2.95, 0.42);
  }
  // Le pronaos : six colonnes corinthiennes en façade, deux en retour
  const hc = 2.9;
  const rc = 0.15;
  for (let i = 0; i < 6; i++) colonne(ch, -2.0 + i * 0.8, yP, 1.72, hc, rc, "corinthien", marbre, MAT.marbre, 1);
  for (const s of [-1, 1]) for (const pz of [0.92, 0.12]) colonne(ch, s * 2.0, yP, pz, hc, rc, "corinthien", marbre, MAT.marbre, 1);
  // La cella, en grand appareil de marbre, avec des demi-colonnes engagées
  ch.boite(0, yP, -1.85, 3.92, hc, 3.6, pierreMarbre, MAT.pierre);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) colonne(ch, s * 1.97, yP, -0.75 - i * 0.75, hc, rc * 0.9, "corinthien", marbre, MAT.marbre, 0);
  for (let i = 0; i < 6; i++) colonne(ch, -2.0 + i * 0.8, yP, -3.66, hc, rc * 0.9, "corinthien", marbre, MAT.marbre, 0);
  // La grande porte de bronze
  porte(ch, 0, yP, -0.05, 0.9, 1.85, "z", { vantaux: C.bronze, cadre: marbre, matCadre: MAT.marbre, seuil: false });
  ch.boite(0, yP + 2.0, -0.02, 1.3, 0.12, 0.08, marbre, MAT.marbre);
  torche(ch, -0.85, yP + 0.9, -0.05, "z");
  torche(ch, 0.85, yP + 0.9, -0.05, "z");
  // L'entablement tout autour, frise peinte d'ocre
  const yE = yP + hc;
  const zE = (zA + 0.05 + zF) / 2;
  const lE = zF - zA - 0.05;
  ch.boite(0, yE, zE, 4.5, 0.26, lE, marbre, MAT.marbre);
  ch.boite(0, yE + 0.26, zE, 4.44, 0.24, lE - 0.04, 0xc9a560, MAT.peint);
  for (let i = 0; i < 18; i++) ch.boite(-2.15 + i * 0.25, yE + 0.3, zF - 0.012, 0.08, 0.16, 0.02, marbre, MAT.marbre);
  ch.boite(0, yE + 0.5, zE, 4.66, 0.14, lE + 0.14, marbre, MAT.marbre);
  const yT = yE + 0.64;
  // Le toit de tuiles, ses deux frontons et les acrotères
  ch.toit2(0, yT, zE, lE + 0.12, 4.66, 1.0, 0.1, 0.08, tu, "z", { c: marbre, mat: MAT.marbre });
  fronton(ch, 0, yT, zF + 0.06, 4.66, 1.0, 0.14, marbre, 0x9fb0b8);
  // Le tympan : la couronne civique au centre, des dieux debout, agenouillés puis allongés vers les angles
  const zt = zF + 0.14;
  ch.ajouter(new THREE.TorusGeometry(0.17, 0.04, 6, 16).translate(0, yT + 0.5, zt), C.bronze, MAT.bronze);
  for (const s of [-1, 1]) {
    statue(ch, s * 0.48, yT + 0.03, zt, 0.62, -s * 0.3, marbre, MAT.marbre, false);
    statue(ch, s * 0.98, yT + 0.03, zt, 0.42, -s * 0.5, marbre, MAT.marbre, false);
    ch.boule(s * 1.55, yT + 0.1, zt, 0.32, 0.08, 0.05, marbre, MAT.marbre, 1);
    ch.boule(s * 1.82, yT + 0.12, zt, 0.07, 0.07, 0.05, marbre, MAT.marbre, 1);
    ch.boule(s * 1.4, yT + 0.18, zt, 0.12, 0.08, 0.05, marbre, MAT.marbre, 1);
  }
  victoire(ch, 0, yT + 1.04, zF + 0.05, 0.75);
  for (const s of [-1, 1]) {
    ch.boite(s * 2.2, yT, zF + 0.02, 0.2, 0.12, 0.2, marbre, MAT.marbre);
    statue(ch, s * 2.2, yT + 0.12, zF + 0.02, 0.55, 0, C.bronze, MAT.bronze, false);
  }
  victoire(ch, 0, yT + 1.04, zA + 0.05, 0.6);
  // Les antéfixes le long des égouts du toit
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const pz = zA + 0.2 + i * ((zF - zA - 0.3) / 15);
      ch.boite(s * 2.42, yT - 0.12, pz, 0.03, 0.12, 0.08, C.terrecuite, MAT.terrecuite);
    }
  }
  // Des guirlandes de feuillage entre les colonnes de façade
  for (let i = 0; i < 5; i++) {
    const g = new THREE.TorusGeometry(0.34, 0.03, 5, 10, Math.PI);
    g.rotateZ(Math.PI);
    g.translate(-1.6 + i * 0.8, yE - 0.05, 1.86);
    ch.ajouter(g, C.feuillageSombre, MAT.feuillage);
  }
  // L'autel devant les marches, avec son feu
  ch.boite(0, 0.06, 3.6, 0.8, 0.1, 0.5, marbre, MAT.marbre);
  ch.boite(0, 0.16, 3.6, 0.68, 0.38, 0.38, marbre, MAT.marbre);
  ch.boite(0, 0.36, 3.6, 0.69, 0.06, 0.39, 0xa33a2a, MAT.peint);
  ch.boite(0, 0.54, 3.6, 0.76, 0.06, 0.46, marbre, MAT.marbre);
  for (const s of [-1, 1]) ch.cylindreCouche(s * 0.34, 0.62, 3.6, 0.05, 0.46, "z", 8, marbre, MAT.marbre);
  ch.cylindre(0, 0.6, 3.6, 0.12, 0.2, 7, C.feu, MAT.feu, 0);
  ch.emettre("feu", 0, 0.78, 3.6);
}

// ---------------------------------------------------------------------------------------------
// Le port et le phare
// ---------------------------------------------------------------------------------------------

export function port(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  const brique = varier(C.brique, 0.05, r);
  fondation(ch, 5.9, 3.9);
  ch.boite(0, 0.06, 0.9, 5.84, 0.012, 2.0, C.dallage, MAT.dallage);
  // Le quai : un grand môle de pierre qui avance dans la mer
  ch.boite(0, -2, 3.22, 5.8, 2.06, 2.56, C.pierre, MAT.pierre);
  ch.boite(0, 0.06, 3.22, 5.86, 0.012, 2.5, C.dallage, MAT.dallage);
  ch.boite(0, -0.06, 4.45, 5.9, 0.14, 0.1, C.pierreClaire, MAT.pierre);
  ch.boite(2.9, -0.06, 3.22, 0.1, 0.14, 2.56, C.pierreClaire, MAT.pierre);
  ch.boite(-2.9, -0.06, 3.22, 0.1, 0.14, 2.56, C.pierreClaire, MAT.pierre);
  // Les pierres d'amarrage percées et les bittes
  for (let i = 0; i < 5; i++) {
    const px = -2.4 + i * 1.2;
    ch.boite(px, 0.06, 4.33, 0.16, 0.16, 0.14, C.pierreClaire, MAT.pierre);
    ch.boite(px, 0.1, 4.4, 0.07, 0.07, 0.02, C.ouverture, MAT.ouverture);
    if (i < 4) ch.cylindre(px + 0.6, 0.06, 4.3, 0.05, 0.2, 8, C.pierreSombre, MAT.pierre, 0.06);
  }
  // L'escalier qui descend dans l'eau, sur le côté
  for (let i = 0; i < 6; i++) ch.boite(2.6, 0.06 - (i + 1) * 0.1, 3.0 + i * 0.22, 0.6, 0.1, 0.22, C.pierreClaire, MAT.pierre);
  // L'horreum du port : façade d'arcades en brique
  const hx = -1.0;
  ch.boite(hx, 0.06, -1.0, 3.8, 1.6, 1.8, brique, MAT.pierre);
  ch.boite(hx, 0.06, -1.0, 3.82, 0.2, 1.82, C.pierre, MAT.pierre);
  ch.boite(hx, 1.6, -1.0, 3.86, 0.06, 1.86, C.pierreClaire, MAT.pierre);
  ch.toit2(hx, 1.66, -1.0, 3.8, 1.8, 0.55, 0.1, 0.05, tu, "x", { c: brique, mat: MAT.pierre });
  for (let i = 0; i < 5; i++) {
    const px = hx - 1.52 + i * 0.76;
    porte(ch, px, 0.06, -0.1, 0.4, 0.62, "z", { arc: true, cadre: C.pierreClaire });
    ch.boite(px + 0.38, 0.06, -0.07, 0.1, 1.3, 0.06, brique, MAT.pierre);
    fenetre(ch, px, 1.2, -0.1, 0.12, 0.18, "z", { barreaux: true, cadre: C.pierreClaire });
  }
  ch.boite(hx - 1.9 + 0.0, 0.06, -0.07, 0.1, 1.3, 0.06, brique, MAT.pierre);
  torche(ch, hx - 1.15, 0.7, -0.1, "z");
  torche(ch, hx + 1.15, 0.7, -0.1, "z");
  // La statio (le bureau du port) et son petit portique
  ch.boite(2.05, 0.06, -1.15, 1.6, 1.15, 1.5, C.enduit, MAT.enduit);
  ch.boite(2.05, 0.06, -1.15, 1.62, 0.3, 1.52, C.rouge, MAT.peint);
  ch.toit2(2.05, 1.21, -1.15, 1.5, 1.6, 0.42, 0.08, 0.05, tu, "z", { c: C.enduit, mat: MAT.enduit });
  for (const px of [1.55, 2.55]) colonne(ch, px, 0.06, -0.15, 1.1, 0.05, "ionique", C.marbre, MAT.marbre, 0);
  ch.boite(2.05, 1.16, -0.28, 1.3, 0.08, 0.32, C.marbre, MAT.marbre);
  ch.appentis(2.05, 0.06, -0.28, 1.3, 0.3, 1.2, 1.12, 0.05, 0.035, tu);
  porte(ch, 2.05, 0.06, -0.4, 0.3, 0.7, "z", { vantaux: C.boisSombre, entrouverte: true, cadre: C.marbre, matCadre: MAT.marbre });
  fenetre(ch, 2.85, 0.65, -1.15, 0.14, 0.24, "x");
  // Neptune sur son socle, qui regarde la mer
  statue(ch, 2.2, 0.06, 1.3, 1.0, 0.3, C.bronze, MAT.bronze);
  // La grue à roue au bord du quai
  grueRoue(ch, -1.6, 0.06, 3.5, 0, 2.9);
  // Marchandises sur le quai
  pileAmphores(ch, 0.2, 0.07, 2.4, 5, 3, 0.32, 0, r);
  pileAmphores(ch, 1.3, 0.07, 3.3, 4, 2, 0.3, Math.PI / 2, r);
  for (let i = 0; i < 6; i++) caisse(ch, -0.6 + (i % 3) * 0.2, 0.07 + Math.floor(i / 3) * 0.16, 3.6, 0.18, i * 0.3);
  for (let i = 0; i < 6; i++) sac(ch, 0.5 + (i % 3) * 0.16, 0.07, 3.85 + Math.floor(i / 3) * 0.16, 0.18, i % 2 ? 0xe6dcc4 : 0xc8b48a);
  ch.boite(-0.4, 0.07, 1.1, 0.6, 0.36, 0.4, C.marbre, MAT.marbre);
  for (let i = 0; i < 3; i++) amphore(ch, -2.6 + i * 0.15, 0.07, 1.0, 0.32, varier(C.amphore, 0.1, r), -0.2);
  ch.ajouter(new THREE.TorusGeometry(0.1, 0.025, 4, 12).rotateX(Math.PI / 2).translate(-0.8, 0.09, 4.1), 0xb8a47c, MAT.tissu);
  ch.ajouter(new THREE.TorusGeometry(0.08, 0.025, 4, 12).rotateX(Math.PI / 2).translate(-0.8, 0.13, 4.1), 0xb8a47c, MAT.tissu);
  // Des fanaux aux deux bouts du quai
  for (const px of [-2.75, 2.2]) {
    ch.boite(px, 0.06, 4.25, 0.1, 0.12, 0.1, C.pierreClaire, MAT.pierre);
    ch.cylindre(px, 0.18, 4.25, 0.025, 0.85, 6, C.boisSombre, MAT.bois);
    ch.cylindre(px, 1.03, 4.25, 0.07, 0.04, 6, C.bronze, MAT.bronze, 0.09);
    ch.cylindre(px, 1.06, 4.25, 0.06, 0.1, 6, C.feu, MAT.feu, 0);
    ch.emettre("torche", px, 1.12, 4.25);
  }
}

export function phare(ch: Chantier, r: Hasard) {
  const pierre = varier(C.pierreClaire, 0.04, r);
  fondation(ch, 1.9, 1.9, 0, 0, 0.45, C.pierreSombre);
  ch.escalier(0, 0.0, 0.84, 0.5, 0.45, 0.28, 4, C.pierreSombre, MAT.pierre, 0);
  // Premier étage : la grande tour carrée
  ch.boite(0, 0.45, 0, 1.5, 3.75, 1.5, pierre, MAT.pierre);
  ch.boite(0, 4.2, 0, 1.68, 0.12, 1.68, C.marbre, MAT.marbre);
  porte(ch, 0, 0.45, 0.75, 0.24, 0.5, "z", { arc: true, cadre: C.pierreSombre });
  for (const f of ["z", "-z", "x", "-x"] as const) {
    const [px, pz] = f === "z" ? [0, 0.75] : f === "-z" ? [0, -0.75] : f === "x" ? [0.75, 0] : [-0.75, 0];
    for (const y of [1.6, 2.7, 3.6]) fenetre(ch, px, y, pz, 0.12, 0.24, f, { arc: true, cadre: C.marbre });
  }
  // Deuxième étage, en retrait
  ch.boite(0, 4.32, 0, 1.12, 2.2, 1.12, pierre, MAT.pierre);
  ch.boite(0, 6.52, 0, 1.28, 0.1, 1.28, C.marbre, MAT.marbre);
  for (const f of ["z", "-z", "x", "-x"] as const) {
    const [px, pz] = f === "z" ? [0, 0.56] : f === "-z" ? [0, -0.56] : f === "x" ? [0.56, 0] : [-0.56, 0];
    for (const y of [4.9, 5.8]) fenetre(ch, px, y, pz, 0.11, 0.22, f, { arc: true, cadre: C.marbre });
  }
  // Troisième étage : la tour ronde, puis la lanterne à colonnes où brûle le feu
  ch.cylindre(0, 6.62, 0, 0.44, 1.1, 16, pierre, MAT.pierre);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ch.repere(Math.sin(a) * 0.44, 0, Math.cos(a) * 0.44, a, () => fenetre(ch, 0, 7.0, 0, 0.1, 0.24, "z", { arc: true, cadre: C.marbre }));
  }
  ch.cylindre(0, 7.72, 0, 0.5, 0.08, 16, C.marbre, MAT.marbre);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ch.cylindre(Math.sin(a) * 0.4, 7.8, Math.cos(a) * 0.4, 0.035, 0.75, 6, C.marbre, MAT.marbre);
  }
  ch.tour(0, 7.8, 0, [
    [0.06, 0],
    [0.26, 0.12],
    [0.3, 0.22],
    [0.25, 0.22],
    [0, 0.14],
  ], 12, C.bronze, MAT.bronze);
  ch.boule(0, 8.18, 0, 0.24, 0.3, 0.24, C.feu, MAT.feu, 1);
  ch.cylindre(0, 8.55, 0, 0.48, 0.06, 16, C.marbre, MAT.marbre);
  ch.dome(0, 8.61, 0, 0.42, C.bronze, MAT.bronze, 14, 0.6);
  statue(ch, 0, 8.86, 0, 0.55, 0, C.bronze, MAT.bronze, false);
  ch.emettre("feu", 0, 8.15, 0);
  ch.emettre("fumee", 0, 9.4, 0);
}

// ---------------------------------------------------------------------------------------------
// L'aqueduc et son château d'eau
// ---------------------------------------------------------------------------------------------

const PIERRE_AQUEDUC = 0xcbb68c;

/** Un tronçon d'aqueduc d'une case le long de x, haut de `hauteur` (entre 2 et 7). */
export function archeAqueduc(ch: Chantier, hauteur: number) {
  const h = Math.max(1.2, Math.min(8, hauteur));
  const ep = 0.42;
  const r = 0.37;
  const hSpecus = 0.36;
  const hMur = h - hSpecus;
  if (h >= 4.2) {
    // Deux étages d'arcades, comme au pont du Gard
    const h1 = hMur * 0.56;
    ch.arcade(0, 0, 0, 1.0, h1, ep, r, h1 - r - 0.22, PIERRE_AQUEDUC, MAT.pierre, 0, -2);
    ch.boite(0, h1 - 0.06, 0, 1.0, 0.07, ep + 0.06, C.pierreClaire, MAT.pierre);
    const h2 = hMur - h1;
    ch.arcade(0, h1, 0, 1.0, h2, ep * 0.88, r, h2 - r - 0.18, PIERRE_AQUEDUC, MAT.pierre, 0, 0);
    for (const s of [-1, 1]) ch.boite(s * 0.5 - s * 0.13, h1 + h2 - r - 0.2, 0, 0.27, 0.04, ep * 0.88 + 0.04, C.pierreClaire, MAT.pierre);
  } else {
    ch.arcade(0, 0, 0, 1.0, hMur, ep, r, Math.max(0.3, hMur - r - 0.22), PIERRE_AQUEDUC, MAT.pierre, 0, -2);
  }
  // Les impostes, à la naissance des arcs
  const yImp = h >= 4.2 ? hMur * 0.56 - r - 0.22 : Math.max(0.3, hMur - r - 0.22);
  for (const s of [-1, 1]) ch.boite(s * 0.5 - s * 0.13, yImp - 0.04, 0, 0.27, 0.05, ep + 0.04, C.pierreClaire, MAT.pierre);
  // Le canal (specus) et ses dalles de couverture
  ch.boite(0, hMur, 0, 1.0, hSpecus - 0.05, ep * 0.86, PIERRE_AQUEDUC, MAT.pierre);
  ch.boite(0, hMur - 0.03, 0, 1.0, 0.05, ep + 0.04, C.pierreClaire, MAT.pierre);
  ch.boite(0, h - 0.05, 0, 0.98, 0.05, ep * 0.95, C.pierreClaire, MAT.pierre);
}

/** Le château d'eau (castellum divisorium) et la fontaine où l'eau arrive en ville. */
export function castellum(ch: Chantier) {
  const brique = C.brique;
  fondation(ch, 0.9, 0.9);
  ch.boite(0, 0.06, -0.15, 0.8, 1.0, 0.6, brique, MAT.pierre);
  ch.boite(0, 0.06, -0.15, 0.82, 0.16, 0.62, C.pierre, MAT.pierre);
  ch.boite(0, 1.06, -0.15, 0.86, 0.06, 0.66, C.pierreClaire, MAT.pierre);
  voute(ch, 0, 1.12, -0.15, 0.86, 0.33, 0.5, C.tuiles[2]!, MAT.tuiles, "z");
  porte(ch, 0, 0.06, 0.15, 0.16, 0.42, "z", { arc: true, cadre: C.pierreClaire });
  fenetre(ch, 0, 0.78, -0.45, 0.16, 0.12, "-z", { cadre: C.pierreClaire });
  // La fontaine : un bassin de pierre et un mascaron de bronze
  ch.boite(0, 0.06, 0.32, 0.76, 0.26, 0.04, C.pierreClaire, MAT.pierre);
  for (const s of [-1, 1]) ch.boite(s * 0.36, 0.06, 0.22, 0.04, 0.26, 0.24, C.pierreClaire, MAT.pierre);
  ch.boite(0, 0.06, 0.22, 0.68, 0.2, 0.2, C.eau, MAT.eau);
  ch.boule(0.25, 0.55, 0.16, 0.05, 0.06, 0.03, C.bronze, MAT.bronze, 1);
  ch.emettre("fontaine", 0.25, 0.54, 0.2);
}
