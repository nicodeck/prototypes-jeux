// Les maisons, 2 × 2 cases, en trois niveaux :
// - Liberti : maisonnettes d'un niveau avec leur cour, leurs amphores et leur bois de chauffage ;
// - Plebeii : maisons à étage, boutique (taberna) ouverte sur la rue, balcon de bois (maenianum) ;
// - Equites : domus à atrium et compluvium, bandeau rouge pompéien, entrées à colonnes.
// La façade regarde +z (la rue). L'emprise utile est [-0,95 ; 0,95] sur x comme sur z.
import * as THREE from "three";
import { MAT } from "../materiaux";
import {
  C,
  amphore,
  banc,
  caisse,
  cheminee,
  colonne,
  dolium,
  entablement,
  fenetre,
  fontaine,
  fronton,
  haie,
  linge,
  muret,
  panier,
  pergola,
  pileAmphores,
  pileBois,
  porte,
  pot,
  puits,
  statue,
  topiaire,
  torche,
  toile,
  tuile,
} from "./details";
import { type Chantier, type Teinte, varier } from "./formes";

type Hasard = () => number;

/** Le socle de pierre, qui descend loin sous terre pour masquer les pentes. */
export function fondation(ch: Chantier, l: number, p: number, cx = 0, cz = 0, haut = 0.06, c: Teinte = C.pierre) {
  ch.boite(cx, -2, cz, l, 2 + haut, p, c, MAT.pierre);
}

/** Un sol de cour : terre battue, dallage ou mosaïque. */
function sol(ch: Chantier, x: number, z: number, l: number, p: number, c: Teinte, mat: number) {
  ch.boite(x, 0.06, z, l, 0.014, p, c, mat);
}

// ---------------------------------------------------------------------------------------------
// Liberti
// ---------------------------------------------------------------------------------------------

/** La maison à cour murée : un toit à deux pans, une cour de terre battue devant. */
function liberti0(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0, 0.47, 1.84, 0.9, C.terre, MAT.terrecuite);
  ch.boite(0, 0.06, -0.45, 1.8, 0.86, 0.9, C.enduit, MAT.enduit);
  ch.toit2(0, 0.92, -0.45, 1.8, 0.9, 0.36, 0.09, 0.05, tu, "x", { c: C.enduit, mat: MAT.enduit });
  cheminee(ch, 0.55, 0.95, -0.62, 0.5);
  porte(ch, 0.28, 0.06, 0.0, 0.24, 0.52, "z", { vantaux: C.boisSombre, entrouverte: true });
  fenetre(ch, -0.42, 0.46, 0.0, 0.17, 0.18, "z", { volets: C.bois });
  fenetre(ch, 0.7, 0.5, 0.0, 0.12, 0.15, "z");
  fenetre(ch, -0.9, 0.5, -0.45, 0.14, 0.15, "-x");
  fenetre(ch, 0.1, 0.55, -0.9, 0.14, 0.14, "-z", { barreaux: true });
  // Le muret de la cour, percé d'un portail
  const m = varier(C.pierre, 0.08, r);
  muret(ch, -0.9, 0.02, -0.9, 0.93, 0.06, 0.3, 0.07, m, MAT.pierre);
  muret(ch, 0.9, 0.02, 0.9, 0.93, 0.06, 0.3, 0.07, m, MAT.pierre);
  muret(ch, -0.9, 0.9, -0.22, 0.9, 0.06, 0.3, 0.07, m, MAT.pierre);
  muret(ch, 0.22, 0.9, 0.9, 0.9, 0.06, 0.3, 0.07, m, MAT.pierre);
  ch.boite(-0.22, 0.06, 0.9, 0.1, 0.42, 0.1, C.pierreClaire, MAT.pierre);
  ch.boite(0.22, 0.06, 0.9, 0.1, 0.42, 0.1, C.pierreClaire, MAT.pierre);
  // Dans la cour : amphores contre le mur, bois de chauffage, citerne
  for (let i = 0; i < 3; i++) amphore(ch, -0.8, 0.06, 0.25 + i * 0.13, 0.32, varier(C.amphore, 0.1, r), -0.25, Math.PI / 2);
  pileBois(ch, 0.74, 0.06, 0.48, 0.5, 2, Math.PI / 2, r);
  puits(ch, -0.5, 0.06, 0.62, 0.1);
  panier(ch, 0.1, 0.06, 0.35, 0.07, 0x7c9a32);
}

/** La maison en L : un corps à croupe, un appentis sur le côté et une pergola de vigne. */
function liberti1(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0.58, 0.36, 0.7, 1.12, C.dallage, MAT.dallage);
  sol(ch, -0.33, 0.64, 1.15, 0.58, C.terre, MAT.terrecuite);
  ch.boite(-0.33, 0.06, -0.28, 1.15, 0.94, 1.24, C.enduit, MAT.enduit);
  ch.toit4(-0.33, 1.0, -0.28, 1.15, 1.24, 0.42, 0.09, 0.05, tu);
  cheminee(ch, -0.6, 1.0, -0.55, 0.52);
  // L'appentis, plus bas, qui s'appuie sur le corps principal
  ch.boite(0.57, 0.06, -0.55, 0.65, 0.6, 0.7, C.enduit, MAT.enduit);
  ch.appentis(0.57, 0.06, -0.55, 0.7, 0.65, 0.74, 0.6, 0.07, 0.04, tu, Math.PI / 2);
  porte(ch, 0.62, 0.06, -0.2, 0.2, 0.42, "z", { vantaux: C.boisGris });
  porte(ch, -0.55, 0.06, 0.34, 0.24, 0.55, "z", { vantaux: C.boisSombre, entrouverte: true });
  fenetre(ch, -0.08, 0.5, 0.34, 0.16, 0.18, "z", { volets: C.vertPompei });
  fenetre(ch, -0.905, 0.52, -0.3, 0.14, 0.16, "-x");
  fenetre(ch, -0.33, 0.55, -0.9, 0.14, 0.14, "-z");
  // La pergola de vigne au-dessus de la cour dallée
  pergola(ch, 0.58, 0.06, 0.4, 0.6, 0.92, 0.78, r);
  ch.boite(0.58, 0.06, 0.38, 0.36, 0.26, 0.2, C.boisClair, MAT.bois);
  banc(ch, 0.58, 0.06, 0.7, 0.4, 0);
  amphore(ch, 0.82, 0.06, 0.05, 0.3, varier(C.amphore, 0.1, r), -0.2, Math.PI / 2);
  dolium(ch, -0.78, 0.06, 0.72, 0.13);
  muret(ch, -0.92, 0.92, -0.05, 0.92, 0.06, 0.26, 0.06, C.pierre, MAT.pierre);
  pileBois(ch, 0.7, 0.06, -0.08, 0.36, 1, 0, r);
}

/** La maison à terrasse : un toit plat où sèche le linge, un escalier extérieur. */
function liberti2(ch: Chantier, r: Hasard) {
  fondation(ch, 1.9, 1.9);
  sol(ch, 0, 0.7, 1.84, 0.44, C.terre, MAT.terrecuite);
  ch.boite(-0.225, 0.06, -0.225, 1.35, 0.86, 1.35, C.enduit, MAT.enduit);
  // La terrasse et son parapet
  ch.boite(-0.225, 0.92, -0.225, 1.41, 0.05, 1.41, C.pierreClaire, MAT.dallage);
  const yp = 0.97;
  ch.boite(-0.225, yp, 0.455, 1.4, 0.14, 0.05, C.enduit, MAT.enduit);
  ch.boite(-0.225, yp, -0.905, 1.4, 0.14, 0.05, C.enduit, MAT.enduit);
  ch.boite(-0.905, yp, -0.225, 0.05, 0.14, 1.32, C.enduit, MAT.enduit);
  ch.boite(0.455, yp, 0.02, 0.05, 0.14, 0.82, C.enduit, MAT.enduit);
  // L'escalier le long du mur est, qui monte vers l'arrière
  ch.escalier(0.6, 0.06, -0.12, 0.24, 0.86, 1.0, 8, C.pierre, MAT.pierre);
  ch.boite(0.735, 0.06, -0.12, 0.03, 0.2, 1.0, C.pierreSombre, MAT.pierre);
  // Un abri de toile sur la terrasse
  const t = toile(r);
  for (const [px, pz] of [
    [-0.84, -0.84],
    [-0.25, -0.84],
    [-0.84, -0.35],
    [-0.25, -0.35],
  ] as const)
    ch.boite(px, yp, pz, 0.03, 0.46, 0.03, C.boisGris, MAT.bois);
  ch.boite(-0.545, yp + 0.46, -0.595, 0.68, 0.015, 0.58, t, MAT.tissu);
  linge(ch, -0.8, 0.2, 0.3, 0.2, yp + 0.38, r);
  ch.boite(-0.8, yp, 0.2, 0.025, 0.4, 0.025, C.boisGris, MAT.bois);
  ch.boite(0.3, yp, 0.2, 0.025, 0.4, 0.025, C.boisGris, MAT.bois);
  amphore(ch, -0.05, yp, -0.7, 0.28, varier(C.amphore, 0.1, r), -0.15);
  pot(ch, 0.2, yp + 0.14, 0.455, 0.08, r);
  pot(ch, -0.6, yp + 0.14, 0.455, 0.08, r);
  porte(ch, -0.45, 0.06, 0.45, 0.24, 0.52, "z", { vantaux: C.bois });
  fenetre(ch, 0.1, 0.5, 0.45, 0.15, 0.16, "z", { volets: C.boisSombre });
  fenetre(ch, -0.9, 0.5, -0.4, 0.14, 0.15, "-x");
  fenetre(ch, 0.45, 0.5, -0.6, 0.12, 0.14, "x");
  // La petite cour devant
  puits(ch, 0.3, 0.06, 0.72, 0.09);
  pot(ch, -0.8, 0.06, 0.75, 0.1, r);
  pot(ch, -0.62, 0.06, 0.8, 0.08, r);
  muret(ch, -0.92, 0.92, 0.92, 0.92, 0.06, 0.22, 0.06, C.pierre, MAT.pierre);
}

/** La maison au pignon sur rue, avec un four à pain dans la cour. */
function liberti3(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0.55, 0, 0.74, 1.84, C.terre, MAT.terrecuite);
  ch.boite(-0.37, 0.06, 0, 1.1, 0.89, 1.8, C.enduit, MAT.enduit);
  ch.toit2(-0.37, 0.95, 0, 1.8, 1.1, 0.44, 0.09, 0.05, tu, "z", { c: C.enduit, mat: MAT.enduit });
  porte(ch, -0.37, 0.06, 0.9, 0.28, 0.56, "z", { arc: true, vantaux: C.boisSombre, entrouverte: true });
  fenetre(ch, -0.37, 1.04, 0.9, 0.1, 0.08, "z", { arc: true });
  fenetre(ch, 0.18, 0.5, 0.3, 0.15, 0.16, "x", { volets: C.bois });
  fenetre(ch, 0.18, 0.5, -0.45, 0.13, 0.15, "x");
  fenetre(ch, -0.92, 0.5, 0.1, 0.13, 0.15, "-x");
  // Le four à pain, en coupole de terre cuite sur un socle de pierre
  ch.boite(0.58, 0.06, -0.5, 0.5, 0.22, 0.5, C.pierre, MAT.pierre);
  ch.dome(0.58, 0.28, -0.5, 0.21, C.terrecuite, MAT.terrecuite, 12, 0.9);
  ch.boite(0.58, 0.28, -0.3, 0.12, 0.1, 0.04, C.ouverture, MAT.ouverture);
  ch.boite(0.58, 0.26, -0.255, 0.18, 0.02, 0.06, C.pierreSombre, MAT.pierre);
  cheminee(ch, 0.58, 0.4, -0.66, 0.24);
  pileBois(ch, 0.6, 0.06, 0.05, 0.42, 2, 0, r);
  // L'appentis qui abrite le bois, contre le mur du fond
  ch.boite(0.4, 0.06, -0.86, 0.03, 0.55, 0.03, C.boisGris, MAT.bois);
  // Murets de la cour et quelques objets
  muret(ch, 0.92, -0.92, 0.92, 0.92, 0.06, 0.3, 0.06, C.pierre, MAT.pierre);
  muret(ch, 0.2, 0.92, 0.5, 0.92, 0.06, 0.3, 0.06, C.pierre, MAT.pierre);
  muret(ch, 0.2, -0.92, 0.92, -0.92, 0.06, 0.3, 0.06, C.pierre, MAT.pierre);
  banc(ch, 0.55, 0.06, 0.55, 0.36, Math.PI / 2);
  pot(ch, 0.78, 0.06, 0.78, 0.09, r);
  amphore(ch, 0.3, 0.06, 0.8, 0.3, varier(C.amphore, 0.1, r), -0.2, 0);
  panier(ch, 0.75, 0.06, 0.4, 0.06, 0xd88a2a);
}

// ---------------------------------------------------------------------------------------------
// Plebeii
// ---------------------------------------------------------------------------------------------

/** Un comptoir de taberna maçonné, dessus de marbre, avec ses jarres encastrées. */
function comptoir(ch: Chantier, x: number, z: number, l: number, r: Hasard) {
  ch.boite(x, 0.06, z, l, 0.3, 0.17, varier(C.ocre, 0.06, r), MAT.peint);
  ch.boite(x, 0.36, z, l + 0.04, 0.03, 0.21, C.marbre, MAT.marbre);
  for (const dx of [-l / 4, l / 4]) {
    ch.cylindre(x + dx, 0.39, z, 0.055, 0.008, 8, C.terrecuite, MAT.terrecuite);
    ch.cylindre(x + dx, 0.392, z, 0.04, 0.008, 8, C.ouverture, MAT.ouverture);
  }
}

/** Un balcon de bois en encorbellement, le long de x, plancher à y, profondeur p devant le mur z. */
function balcon(ch: Chantier, x: number, y: number, zMur: number, l: number, p: number, r: Hasard) {
  const zc = zMur + p / 2;
  ch.boite(x, y, zc, l, 0.04, p, C.bois, MAT.bois);
  const nPoutres = Math.max(2, Math.round(l / 0.3));
  for (let i = 0; i <= nPoutres; i++) {
    const px = x - l / 2 + 0.04 + ((l - 0.08) * i) / nPoutres;
    ch.boite(px, y - 0.06, zc, 0.04, 0.06, p, C.boisSombre, MAT.bois);
  }
  ch.boite(x, y + 0.26, zMur + p - 0.015, l, 0.03, 0.03, C.boisSombre, MAT.bois);
  ch.boite(x - l / 2 + 0.015, y + 0.04, zc, 0.03, 0.25, p, C.boisSombre, MAT.bois);
  ch.boite(x + l / 2 - 0.015, y + 0.04, zc, 0.03, 0.25, p, C.boisSombre, MAT.bois);
  const nb = Math.round(l / 0.1);
  for (let i = 1; i < nb; i++) ch.boite(x - l / 2 + (l * i) / nb, y + 0.04, zMur + p - 0.015, 0.016, 0.22, 0.016, C.bois, MAT.bois);
  for (let i = 0; i < Math.round(l / 0.4); i++) pot(ch, x - l / 2 + 0.15 + i * 0.38, y + 0.04, zMur + p - 0.07, 0.07, r);
}

/** Un auvent de toile rayée, accroché au mur z à la hauteur y, qui descend vers la rue. */
function auvent(ch: Chantier, x: number, y: number, zMur: number, l: number, p: number, r: Hasard) {
  const t1 = toile(r);
  const t2 = 0xeae2cc;
  const a = Math.atan2(0.14, p);
  const nb = Math.max(3, Math.round(l / 0.14));
  for (let i = 0; i < nb; i++) {
    const px = x - l / 2 + (l * (i + 0.5)) / nb;
    ch.repere(px, y - 0.07, zMur + p / 2, 0, () => {
      ch.ajouter(boiteInclinee(l / nb, 0.012, Math.hypot(p, 0.14), a), i % 2 ? t1 : t2, MAT.tissu);
    });
  }
  ch.boite(x - l / 2 + 0.03, 0.06, zMur + p - 0.02, 0.025, y - 0.2, 0.025, C.boisGris, MAT.bois);
  ch.boite(x + l / 2 - 0.03, 0.06, zMur + p - 0.02, 0.025, y - 0.2, 0.025, C.boisGris, MAT.bois);
}

function boiteInclinee(l: number, h: number, p: number, a: number) {
  const g = new THREE.BoxGeometry(l, h, p);
  g.rotateX(a);
  return g;
}

/** L'insula à balcon : toit en croupe, boutique sous un auvent, balcon à l'étage. */
function plebeii0(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0, 0.79, 1.84, 0.3, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, -0.13, 1.8, 1.9, 1.54, C.enduit, MAT.enduit);
  ch.boite(0, 0.06, -0.13, 1.82, 0.18, 1.56, C.pierre, MAT.pierre);
  ch.boite(0, 1.02, -0.13, 1.84, 0.04, 1.58, C.pierreClaire, MAT.pierre);
  ch.toit4(0, 1.96, -0.13, 1.8, 1.54, 0.4, 0.1, 0.05, tu);
  cheminee(ch, 0.5, 1.9, -0.5, 0.6);
  // La boutique et son comptoir
  porte(ch, -0.4, 0.06, 0.64, 0.74, 0.72, "z", { cadre: C.brique });
  comptoir(ch, -0.52, 0.76, 0.42, r);
  amphore(ch, -0.12, 0.06, 0.74, 0.3, varier(C.amphore, 0.1, r), -0.15);
  auvent(ch, -0.4, 1.0, 0.64, 0.9, 0.28, r);
  porte(ch, 0.6, 0.06, 0.64, 0.24, 0.62, "z", { vantaux: C.boisSombre });
  // L'étage : balcon, portes-fenêtres et fenêtres à volets
  balcon(ch, 0.42, 1.06, 0.64, 0.92, 0.26, r);
  porte(ch, 0.42, 1.08, 0.64, 0.22, 0.5, "z", { vantaux: C.vertPompei, entrouverte: true, seuil: false });
  fenetre(ch, -0.55, 1.35, 0.64, 0.17, 0.24, "z", { volets: C.vertPompei });
  fenetre(ch, -0.15, 1.35, 0.64, 0.17, 0.24, "z", { volets: C.vertPompei });
  fenetre(ch, -0.9, 1.35, -0.2, 0.16, 0.22, "-x", { volets: C.vertPompei });
  fenetre(ch, 0.9, 1.35, -0.4, 0.16, 0.22, "x", { volets: C.vertPompei });
  fenetre(ch, 0.9, 0.5, -0.4, 0.14, 0.18, "x", { barreaux: true });
  fenetre(ch, 0.0, 1.35, -0.9, 0.16, 0.2, "-z");
}

/** La maison au pignon sur rue, avec son escalier extérieur qui monte à l'étage. */
function plebeii1(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0.7, 0.3, 0.44, 1.24, C.dallage, MAT.dallage);
  ch.boite(-0.21, 0.06, 0, 1.42, 1.9, 1.8, C.enduit, MAT.enduit);
  ch.boite(-0.21, 1.02, 0, 1.46, 0.04, 1.84, C.pierreClaire, MAT.pierre);
  ch.toit2(-0.21, 1.96, 0, 1.8, 1.42, 0.52, 0.1, 0.05, tu, "z", { c: C.enduit, mat: MAT.enduit });
  cheminee(ch, -0.55, 1.95, -0.5, 0.65);
  // Boutique sur la rue, avec un présentoir d'amphores
  porte(ch, -0.42, 0.06, 0.9, 0.66, 0.72, "z", { cadre: C.pierreClaire });
  comptoir(ch, -0.52, 0.92, 0.36, r);
  porte(ch, 0.25, 0.06, 0.9, 0.22, 0.6, "z", { vantaux: C.boisSombre });
  fenetre(ch, -0.6, 1.38, 0.9, 0.17, 0.24, "z", { volets: C.boisSombre });
  fenetre(ch, 0.15, 1.38, 0.9, 0.17, 0.24, "z", { volets: C.boisSombre });
  fenetre(ch, -0.21, 2.06, 0.9, 0.12, 0.1, "z", { arc: true });
  fenetre(ch, -0.92, 1.38, 0.0, 0.16, 0.22, "-x", { volets: C.boisSombre });
  fenetre(ch, -0.92, 0.5, -0.5, 0.13, 0.16, "-x", { barreaux: true });
  // L'escalier extérieur et le palier couvert
  ch.escalier(0.66, 0.06, 0.28, 0.26, 0.96, 1.2, 9, C.pierre, MAT.pierre);
  ch.boite(0.67, 1.02, -0.58, 0.32, 0.04, 0.66, C.bois, MAT.bois);
  for (const pz of [-0.88, -0.28]) ch.boite(0.81, 0.06, pz, 0.04, 0.96, 0.04, C.boisSombre, MAT.bois);
  ch.barre([0.81, 0.36, 0.86], [0.81, 1.3, -0.26], 0.012, C.boisSombre, MAT.bois, 4);
  ch.boite(0.81, 1.06, -0.58, 0.02, 0.24, 0.62, C.bois, MAT.bois);
  porte(ch, 0.5, 1.06, -0.6, 0.22, 0.5, "x", { vantaux: C.bois, seuil: false });
  ch.appentis(0.69, 1.6, -0.58, 0.7, 0.36, 0.25, 0.12, 0.05, 0.035, tu, Math.PI / 2);
  pot(ch, 0.75, 1.06, -0.82, 0.07, r);
  pileAmphores(ch, 0.7, 0.06, 0.78, 3, 2, 0.26, Math.PI / 2, r);
}

/** L'insula de brique à portique, façon Ostie : arcades de boutiques et terrasse à l'étage. */
function plebeii2(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  const brique = varier(C.brique, 0.06, r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0, 0.62, 1.84, 0.64, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, -0.3, 1.84, 1.9, 1.2, brique, MAT.pierre);
  ch.boite(0, 1.02, -0.3, 1.88, 0.05, 1.24, C.pierreClaire, MAT.pierre);
  ch.boite(0, 1.9, -0.3, 1.88, 0.06, 1.24, C.pierreClaire, MAT.pierre);
  ch.toit4(0, 1.96, -0.3, 1.84, 1.2, 0.3, 0.09, 0.05, tu);
  // Trois boutiques voûtées sous le portique
  for (const px of [-0.6, 0, 0.6]) porte(ch, px, 0.06, 0.3, 0.34, 0.46, "z", { arc: true, cadre: C.pierreClaire });
  // Piliers de brique, et la terrasse qu'ils portent
  for (const px of [-0.86, -0.3, 0.3, 0.86]) {
    ch.boite(px, 0.06, 0.84, 0.11, 0.98, 0.11, brique, MAT.pierre);
    ch.boite(px, 0.06, 0.84, 0.13, 0.08, 0.13, C.pierreClaire, MAT.pierre);
  }
  ch.boite(0, 1.0, 0.6, 1.86, 0.08, 0.6, C.pierreClaire, MAT.pierre);
  ch.boite(0, 1.08, 0.885, 1.84, 0.16, 0.05, brique, MAT.pierre);
  ch.boite(0, 1.24, 0.885, 1.86, 0.025, 0.07, C.pierreClaire, MAT.pierre);
  pergola(ch, 0.5, 1.08, 0.6, 0.72, 0.5, 0.48, r, true, 0.8);
  pot(ch, -0.7, 1.08, 0.75, 0.08, r);
  pot(ch, -0.3, 1.08, 0.78, 0.07, r);
  // L'étage : fenêtres à linteau de brique et une porte sur la terrasse
  for (const px of [-0.62, -0.2]) fenetre(ch, px, 1.35, 0.3, 0.17, 0.26, "z", { volets: C.boisSombre, cadre: C.brique });
  porte(ch, 0.2, 1.08, 0.3, 0.22, 0.5, "z", { vantaux: C.boisSombre, entrouverte: true, seuil: false });
  fenetre(ch, 0.62, 1.35, 0.3, 0.17, 0.26, "z", { cadre: C.brique });
  fenetre(ch, -0.92, 1.35, -0.4, 0.16, 0.24, "-x", { cadre: C.brique });
  fenetre(ch, 0.92, 1.35, -0.4, 0.16, 0.24, "x", { cadre: C.brique });
  fenetre(ch, 0.92, 0.5, -0.5, 0.14, 0.18, "x", { barreaux: true, cadre: C.brique });
  // Marchandises sous le portique
  caisse(ch, -0.75, 0.06, 0.55, 0.14, 0.3);
  caisse(ch, -0.62, 0.06, 0.5, 0.12, -0.2);
  amphore(ch, 0.38, 0.06, 0.45, 0.3, varier(C.amphore, 0.1, r), -0.15);
  amphore(ch, 0.46, 0.06, 0.42, 0.28, varier(C.amphore, 0.1, r), -0.18, 0.4);
  panier(ch, -0.15, 0.06, 0.55, 0.07, 0xd88a2a);
}

/** La maison à colombages d'Herculanum (opus craticium) : étage en encorbellement sur des poteaux. */
function plebeii3(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  sol(ch, 0, 0.66, 1.84, 0.56, C.dallage, MAT.dallage);
  // Rez-de-chaussée en retrait
  ch.boite(0, 0.06, -0.26, 1.8, 0.98, 1.28, C.enduit, MAT.enduit);
  ch.boite(0, 0.06, -0.26, 1.82, 0.2, 1.3, C.pierre, MAT.pierre);
  porte(ch, -0.35, 0.06, 0.38, 0.62, 0.68, "z", { cadre: C.bois, matCadre: MAT.bois });
  comptoir(ch, -0.45, 0.5, 0.3, r);
  porte(ch, 0.5, 0.06, 0.38, 0.24, 0.62, "z", { vantaux: C.boisSombre, cadre: C.bois, matCadre: MAT.bois });
  // L'étage avance au-dessus de la rue, porté par des poteaux
  ch.boite(0, 1.04, -0.02, 1.84, 0.06, 1.78, C.boisSombre, MAT.bois);
  ch.boite(0, 1.1, -0.02, 1.8, 0.82, 1.74, C.enduit, MAT.enduit);
  for (const px of [-0.86, 0.0, 0.86]) {
    ch.boite(px, 0.06, 0.82, 0.06, 0.98, 0.06, C.boisSombre, MAT.bois);
    ch.boite(px, 0.06, 0.82, 0.1, 0.06, 0.1, C.pierre, MAT.pierre);
  }
  // Les colombages : poteaux, sablière et croix de Saint-André sur la façade
  const zf = 0.855;
  for (let i = 0; i <= 6; i++) ch.boite(-0.9 + i * 0.3, 1.1, zf, 0.035, 0.82, 0.02, C.boisSombre, MAT.bois);
  ch.boite(0, 1.5, zf, 1.82, 0.035, 0.02, C.boisSombre, MAT.bois);
  ch.boite(0, 1.9, zf, 1.84, 0.04, 0.025, C.boisSombre, MAT.bois);
  for (const px of [-0.75, 0.75]) {
    for (const s of [1, -1]) {
      const m = new THREE.Matrix4().makeRotationZ(s * 0.93).setPosition(px, 1.3, zf + 0.004);
      ch.boiteM(m, 0.03, 0.48, 0.02, C.boisSombre, MAT.bois);
    }
  }
  for (const s of [1, -1]) for (let i = 0; i <= 5; i++) ch.boite(s * 0.905, 1.1, -0.88 + i * 0.35, 0.02, 0.82, 0.035, C.boisSombre, MAT.bois);
  for (const px of [-0.45, 0.15]) fenetre(ch, px, 1.6, zf, 0.16, 0.22, "z", { volets: C.bois, cadre: C.boisSombre });
  fenetre(ch, 0.45, 1.2, zf, 0.14, 0.18, "z", { cadre: C.boisSombre });
  fenetre(ch, -0.9, 1.6, -0.3, 0.15, 0.2, "-x", { cadre: C.boisSombre });
  ch.toit2(0, 1.92, -0.02, 1.8, 1.74, 0.45, 0.12, 0.05, tu, "x", { c: C.enduit, mat: MAT.enduit });
  cheminee(ch, -0.55, 1.95, -0.4, 0.6);
  linge(ch, -0.86, 0.8, 0.0, 0.8, 0.86, r);
  pot(ch, 0.75, 0.06, 0.55, 0.09, r);
  pileAmphores(ch, 0.2, 0.06, 0.56, 3, 1, 0.24, 0, r);
}

// ---------------------------------------------------------------------------------------------
// Equites
// ---------------------------------------------------------------------------------------------

/** Un mur de domus : socle de pierre, bandeau rouge pompéien, enduit et corniche. */
function murDomus(ch: Chantier, x: number, z: number, l: number, p: number, h: number, bandeau: Teinte = C.rouge) {
  ch.boite(x, 0.06, z, l, h - 0.06, p, C.enduit, MAT.enduit);
  ch.boite(x, 0.06, z, l + 0.024, 0.22, p + 0.024, C.pierre, MAT.pierre);
  ch.boite(x, 0.28, z, l + 0.012, 0.3, p + 0.012, bandeau, MAT.peint);
  ch.boite(x, 0.58, z, l + 0.016, 0.025, p + 0.016, C.marbre, MAT.marbre);
  ch.boite(x, h - 0.05, z, l + 0.04, 0.05, p + 0.04, C.pierreClaire, MAT.marbre);
}

/** Le corps d'une domus autour de son atrium : quatre ailes, impluvium et toit en compluvium. */
function corpsAtrium(ch: Chantier, cx: number, cz: number, l: number, p: number, h: number, tu: Teinte) {
  const ep = 0.27;
  const x0 = cx - l / 2;
  const x1 = cx + l / 2;
  const z0 = cz - p / 2;
  const z1 = cz + p / 2;
  murDomus(ch, cx, z1 - ep / 2, l, ep, h);
  murDomus(ch, cx, z0 + ep / 2, l, ep, h);
  murDomus(ch, x0 + ep / 2, cz, ep, p - 2 * ep, h);
  murDomus(ch, x1 - ep / 2, cz, ep, p - 2 * ep, h);
  // L'atrium : sol en mosaïque claire, impluvium bordé de marbre
  const al = l - 2 * ep;
  const ap = p - 2 * ep;
  ch.boite(cx, 0.06, cz, al, 0.012, ap, 0xd9d0c0, MAT.dallage);
  const il = al * 0.46;
  const ip = ap * 0.46;
  ch.boite(cx, 0.06, cz, il, 0.03, ip, C.eau, MAT.eau);
  ch.boite(cx, 0.06, cz - ip / 2 - 0.02, il + 0.08, 0.05, 0.04, C.marbre, MAT.marbre);
  ch.boite(cx, 0.06, cz + ip / 2 + 0.02, il + 0.08, 0.05, 0.04, C.marbre, MAT.marbre);
  ch.boite(cx - il / 2 - 0.02, 0.06, cz, 0.04, 0.05, ip, C.marbre, MAT.marbre);
  ch.boite(cx + il / 2 + 0.02, 0.06, cz, 0.04, 0.05, ip, C.marbre, MAT.marbre);
  // Les quatre colonnes aux angles de l'impluvium (atrium tétrastyle)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) colonne(ch, cx + sx * (il / 2 + 0.05), 0.06, cz + sz * (ip / 2 + 0.05), h - 0.22, 0.028, "toscan", C.marbre, MAT.marbre, 0);
  // Portes intérieures donnant sur l'atrium
  porte(ch, cx, 0.06, z0 + ep, 0.28, 0.6, "z", { seuil: false });
  porte(ch, x0 + ep, 0.06, cz, 0.18, 0.5, "x", { seuil: false });
  porte(ch, x1 - ep, 0.06, cz, 0.18, 0.5, "-x", { seuil: false });
  ch.toitCompluvium(cx, h, cz, l, p, al * 0.7, ap * 0.72, 0.3, 0.08, tu);
}

/** Le vestibule : deux colonnes et un petit fronton devant la porte d'entrée. */
function vestibule(ch: Chantier, x: number, zMur: number, h: number, profondeur: number) {
  const zc = zMur + profondeur;
  for (const s of [-1, 1]) colonne(ch, x + s * 0.2, 0.06, zc, h, 0.032, "corinthien", C.marbre, MAT.marbre, 0);
  entablement(ch, x, 0.06 + h, zMur + profondeur / 2, 0.5, profondeur + 0.08, 0.1);
  fronton(ch, x, 0.16 + h, zc + 0.02, 0.54, 0.16, 0.06);
  ch.boite(x, 0.06, zMur + profondeur / 2, 0.5, 0.025, profondeur + 0.1, C.marbre, MAT.marbre);
  porte(ch, x, 0.06, zMur, 0.26, h - 0.08, "z", { vantaux: C.boisSombre, cadre: C.marbre, matCadre: MAT.marbre, seuil: false });
  torche(ch, x - 0.34, 0.62, zMur, "z");
  torche(ch, x + 0.34, 0.62, zMur, "z");
}

/** La domus à atrium et péristyle : la maison sur la rue, le jardin à colonnades derrière. */
function equites0(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  corpsAtrium(ch, 0, 0.27, 1.84, 1.1, 1.3, tu);
  vestibule(ch, 0, 0.82, 0.86, 0.1);
  fenetre(ch, -0.6, 0.75, 0.82, 0.14, 0.22, "z", { barreaux: true, cadre: C.marbre });
  fenetre(ch, 0.6, 0.75, 0.82, 0.14, 0.22, "z", { barreaux: true, cadre: C.marbre });
  // Le péristyle : murs de jardin, colonnades, portique couvert et jardin
  murDomus(ch, -0.885, -0.6, 0.07, 0.62, 1.08);
  murDomus(ch, 0.885, -0.6, 0.07, 0.62, 1.08);
  murDomus(ch, 0, -0.885, 1.84, 0.07, 1.08);
  sol(ch, 0, -0.6, 1.7, 0.6, 0x7a8a4a, MAT.feuillage);
  for (const px of [-0.62, -0.2, 0.2, 0.62]) colonne(ch, px, 0.06, -0.48, 0.82, 0.03, "ionique", C.marbre, MAT.marbre, 0);
  ch.boite(0, 0.88, -0.48, 1.36, 0.05, 0.07, C.marbre, MAT.marbre);
  ch.appentis(0, 0.06, -0.69, 1.7, 0.36, 1.08, 0.88, 0.05, 0.04, tu);
  haie(ch, -0.55, -0.32, 0.55, -0.32, 0.07, 0.14, 0.08, r);
  fontaine(ch, 0, 0.07, -0.33, 0.1);
  topiaire(ch, -0.7, 0.07, -0.33, 0.32, r);
  topiaire(ch, 0.7, 0.07, -0.33, 0.32, r);
  pot(ch, 0.4, 0.07, -0.66, 0.08, r);
  statue(ch, -0.4, 0.07, -0.68, 0.32, 0.3, C.marbre, MAT.marbre);
}

/** La domus à tour-belvédère : l'atrium devant, une tour à loggia et un jardin derrière. */
function equites1(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  corpsAtrium(ch, 0, 0.32, 1.84, 1.16, 1.25, tu);
  vestibule(ch, 0.35, 0.9, 0.82, 0.0001);
  fenetre(ch, -0.5, 0.72, 0.9, 0.14, 0.22, "z", { barreaux: true, cadre: C.marbre });
  // La tour : deux niveaux, une loggia à arcades sous un toit en croupe
  murDomus(ch, -0.56, -0.62, 0.7, 0.6, 2.25, C.ocre);
  for (const [px, pz, f] of [
    [-0.56, -0.32, "z"],
    [-0.91, -0.62, "-x"],
    [-0.21, -0.62, "x"],
  ] as const) {
    fenetre(ch, px, 1.75, pz, 0.14, 0.22, f, { arc: true, cadre: C.marbre });
    fenetre(ch, px, 1.05, pz, 0.12, 0.2, f, { cadre: C.marbre });
  }
  ch.toit4(-0.56, 2.25, -0.62, 0.7, 0.6, 0.3, 0.1, 0.045, tu);
  ch.boite(-0.56, 1.42, -0.27, 0.5, 0.035, 0.1, C.marbre, MAT.marbre);
  cheminee(ch, -0.75, 2.2, -0.8, 0.42);
  // Le jardin du fond, avec bassin et pergola
  sol(ch, 0.36, -0.6, 1.1, 0.62, 0x7a8a4a, MAT.feuillage);
  murDomus(ch, 0.36, -0.885, 1.12, 0.07, 0.9);
  murDomus(ch, 0.885, -0.6, 0.07, 0.6, 0.9);
  pergola(ch, 0.55, 0.06, -0.62, 0.62, 0.5, 0.74, r);
  ch.boite(0.05, 0.06, -0.6, 0.3, 0.06, 0.4, C.marbre, MAT.marbre);
  ch.boite(0.05, 0.065, -0.6, 0.24, 0.06, 0.34, C.eau, MAT.eau);
  banc(ch, 0.55, 0.06, -0.62, 0.4, 0);
  pot(ch, 0.82, 0.07, -0.35, 0.08, r);
}

/** La domus à façade de temple : un portique à fronton, un jardin d'agrément devant. */
function equites2(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  murDomus(ch, 0, -0.4, 1.84, 1.04, 1.32);
  ch.toit2(0, 1.32, -0.4, 1.84, 1.04, 0.38, 0.09, 0.05, tu, "x", { c: C.enduit, mat: MAT.enduit });
  cheminee(ch, 0.6, 1.4, -0.65, 0.45);
  // Le portique : quatre colonnes, entablement, fronton et petit toit
  ch.boite(0, 0.06, 0.27, 1.56, 0.08, 0.36, C.marbre, MAT.marbre);
  for (const px of [-0.66, -0.22, 0.22, 0.66]) colonne(ch, px, 0.14, 0.38, 0.92, 0.04, "corinthien", C.marbre, MAT.marbre, 0);
  entablement(ch, 0, 1.06, 0.27, 1.5, 0.34, 0.14, C.marbre, C.rouge);
  ch.toit2(0, 1.2, 0.27, 0.4, 1.5, 0.3, 0.06, 0.04, tu, "z", { c: C.marbre, mat: MAT.marbre });
  porte(ch, 0, 0.14, 0.12, 0.3, 0.72, "z", { vantaux: C.boisSombre, cadre: C.marbre, matCadre: MAT.marbre, seuil: false });
  fenetre(ch, -0.5, 0.62, 0.12, 0.14, 0.26, "z", { barreaux: true, cadre: C.marbre });
  fenetre(ch, 0.5, 0.62, 0.12, 0.14, 0.26, "z", { barreaux: true, cadre: C.marbre });
  fenetre(ch, -0.92, 0.75, -0.4, 0.14, 0.24, "-x", { cadre: C.marbre });
  fenetre(ch, 0.92, 0.75, -0.4, 0.14, 0.24, "x", { cadre: C.marbre });
  torche(ch, -0.66, 0.6, 0.42, "z");
  torche(ch, 0.66, 0.6, 0.42, "z");
  // Le jardin : allée dallée, haies, fontaine, topiaires, statue
  sol(ch, 0, 0.7, 1.84, 0.5, 0x6f8445, MAT.feuillage);
  ch.boite(0, 0.074, 0.7, 0.3, 0.01, 0.5, C.dallage, MAT.dallage);
  haie(ch, -0.85, 0.5, -0.25, 0.5, 0.07, 0.12, 0.07, r);
  haie(ch, 0.25, 0.5, 0.85, 0.5, 0.07, 0.12, 0.07, r);
  fontaine(ch, -0.55, 0.07, 0.72, 0.13);
  statue(ch, 0.55, 0.07, 0.72, 0.4, -0.4, C.marbre, MAT.marbre);
  topiaire(ch, -0.86, 0.07, 0.88, 0.36, r);
  topiaire(ch, 0.86, 0.07, 0.88, 0.36, r);
  // Muret et piliers du portail
  muret(ch, -0.92, 0.92, -0.2, 0.92, 0.06, 0.2, 0.06, C.pierre, MAT.pierre, C.marbre);
  muret(ch, 0.2, 0.92, 0.92, 0.92, 0.06, 0.2, 0.06, C.pierre, MAT.pierre, C.marbre);
  for (const s of [-1, 1]) {
    ch.boite(s * 0.2, 0.06, 0.92, 0.09, 0.4, 0.09, C.pierreClaire, MAT.pierre);
    ch.boule(s * 0.2, 0.5, 0.92, 0.045, 0.045, 0.045, C.marbre, MAT.marbre, 1);
  }
}

/** La domus en L : une aile à loggia sur deux niveaux, une aile basse, un péristyle d'angle. */
function equites3(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  // L'aile du fond, à étage, avec une loggia ouverte au sud
  murDomus(ch, 0, -0.6, 1.84, 0.64, 1.25, C.vertPompei);
  ch.boite(0, 1.25, -0.68, 1.84, 0.7, 0.48, C.enduit, MAT.enduit);
  ch.boite(0, 1.25, -0.6, 1.84, 0.04, 0.64, C.pierreClaire, MAT.marbre);
  for (let i = 0; i < 6; i++) colonne(ch, -0.82 + i * 0.328, 1.29, -0.33, 0.6, 0.025, "ionique", C.marbre, MAT.marbre, 0);
  ch.boite(0, 1.89, -0.6, 1.88, 0.05, 0.66, C.marbre, MAT.marbre);
  ch.toit4(0, 1.94, -0.6, 1.84, 0.64, 0.3, 0.09, 0.045, tu);
  for (const px of [-0.5, 0, 0.5]) porte(ch, px, 1.29, -0.44, 0.2, 0.45, "z", { seuil: false });
  cheminee(ch, -0.7, 1.95, -0.75, 0.38);
  // L'aile d'entrée, basse, sur le côté est
  murDomus(ch, 0.6, 0.31, 0.64, 1.18, 1.2, C.rouge);
  ch.toit4(0.6, 1.2, 0.31, 0.64, 1.18, 0.28, 0.08, 0.045, tu);
  vestibule(ch, 0.6, 0.9, 0.78, 0.0001);
  fenetre(ch, 0.28, 0.72, 0.4, 0.13, 0.22, "-x", { cadre: C.marbre });
  fenetre(ch, 0.92, 0.72, 0.2, 0.13, 0.22, "x", { cadre: C.marbre, barreaux: true });
  // Le péristyle d'angle : colonnes, bassin long (euripe), haies et pergola
  sol(ch, -0.33, 0.33, 1.18, 1.14, 0x748848, MAT.feuillage);
  for (let i = 0; i < 4; i++) colonne(ch, -0.84 + i * 0.3, 0.06, -0.18, 0.84, 0.026, "toscan", C.marbre, MAT.marbre, 0);
  for (let i = 1; i < 4; i++) colonne(ch, 0.18, 0.06, -0.18 + i * 0.3, 0.84, 0.026, "toscan", C.marbre, MAT.marbre, 0);
  ch.appentis(-0.33, 0.06, -0.21, 1.2, 0.12, 0.98, 0.9, 0.04, 0.035, tu);
  ch.boite(-0.33, 0.06, 0.38, 0.9, 0.06, 0.18, C.marbre, MAT.marbre);
  ch.boite(-0.33, 0.065, 0.38, 0.84, 0.06, 0.12, C.eau, MAT.eau);
  haie(ch, -0.85, 0.62, 0.1, 0.62, 0.07, 0.12, 0.07, r);
  topiaire(ch, -0.82, 0.07, 0.05, 0.3, r);
  topiaire(ch, 0.05, 0.07, 0.05, 0.3, r);
  statue(ch, -0.33, 0.07, 0.12, 0.3, 0, C.bronze, MAT.bronze);
  muret(ch, -0.92, 0.92, 0.27, 0.92, 0.06, 0.28, 0.06, C.pierre, MAT.pierre, C.marbre);
  muret(ch, -0.92, -0.25, -0.92, 0.92, 0.06, 0.28, 0.06, C.pierre, MAT.pierre, C.marbre);
  pot(ch, -0.6, 0.07, 0.8, 0.08, r);
  pot(ch, 0.0, 0.07, 0.8, 0.08, r);
}

const MAISONS = [
  [liberti0, liberti1, liberti2, liberti3],
  [plebeii0, plebeii1, plebeii2, plebeii3],
  [equites0, equites1, equites2, equites3],
] as const;

export function nombreMaisons(palier: number) {
  return MAISONS[palier]!.length;
}

export function construireMaison(ch: Chantier, palier: number, variante: number, r: Hasard) {
  const liste = MAISONS[palier]!;
  liste[variante % liste.length]!(ch, r);
}

