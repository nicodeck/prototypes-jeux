// Les bâtiments de production : entrepôt, pêcherie, bûcheron, ferme, moulin, boulangerie,
// oliveraie, pressoir, vignoble, cave à vin et carrière de marbre.
// La façade regarde +z. Emprise utile : [-l/2 + 0,05 ; l/2 - 0,05].
import * as THREE from "three";
import { MAT } from "../materiaux";
import {
  C,
  amphore,
  caisse,
  cheminee,
  chevre,
  dolium,
  echelle,
  fenetre,
  fronton,
  meule,
  muret,
  panier,
  pergola,
  pileAmphores,
  pileBois,
  porte,
  sac,
  torche,
  tuile,
} from "./details";
import { type Chantier, varier } from "./formes";
import { fondation } from "./maisons";

type Hasard = () => number;

/** L'horreum : un grand entrepôt de brique à contreforts, porte monumentale à fronton. */
export function entrepot(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  const brique = varier(C.brique, 0.05, r);
  fondation(ch, 2.9, 2.9);
  ch.boite(0, 0.06, 0.98, 2.84, 0.014, 0.94, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, -0.45, 2.8, 1.4, 1.9, brique, MAT.pierre);
  ch.boite(0, 0.06, -0.45, 2.82, 0.2, 1.92, C.pierre, MAT.pierre);
  ch.boite(0, 1.4, -0.45, 2.86, 0.06, 1.96, C.pierreClaire, MAT.pierre);
  ch.toit2(0, 1.46, -0.45, 2.8, 1.9, 0.55, 0.1, 0.05, tu, "x", { c: brique, mat: MAT.pierre });
  // Contreforts sur les côtés et à l'arrière
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const pz = -1.3 + i * 0.6;
      ch.boite(s * 1.45, 0.06, pz, 0.1, 1.15, 0.13, brique, MAT.pierre);
      ch.boite(s * 1.43, 1.21, pz, 0.08, 0.1, 0.13, C.pierreClaire, MAT.pierre);
      fenetre(ch, s * 1.4, 1.0, pz + 0.3, 0.06, 0.22, s > 0 ? "x" : "-x", { barreaux: true, cadre: C.pierreClaire });
    }
  }
  for (let i = 0; i < 5; i++) ch.boite(-1.2 + i * 0.6, 0.06, -1.44, 0.13, 1.15, 0.1, brique, MAT.pierre);
  // La porte monumentale, entre deux pilastres, sous un fronton de brique
  porte(ch, 0, 0.06, 0.5, 0.5, 0.7, "z", { arc: true, vantaux: C.boisSombre, entrouverte: true, cadre: C.pierreClaire });
  for (const s of [-1, 1]) ch.boite(s * 0.4, 0.06, 0.53, 0.1, 1.08, 0.07, brique, MAT.pierre);
  ch.boite(0, 1.06, 0.535, 0.92, 0.06, 0.09, C.pierreClaire, MAT.pierre);
  fronton(ch, 0, 1.12, 0.55, 0.92, 0.22, 0.06, brique);
  ch.boite(0, 0.92, 0.515, 0.4, 0.1, 0.02, C.marbre, MAT.marbre);
  for (const px of [-1.0, 1.0]) fenetre(ch, px, 0.95, 0.5, 0.08, 0.26, "z", { barreaux: true, cadre: C.pierreClaire });
  torche(ch, -0.55, 0.62, 0.5, "z");
  torche(ch, 0.55, 0.62, 0.5, "z");
  // La cour : amphores, caisses, sacs et une balance
  pileAmphores(ch, -0.95, 0.07, 1.0, 4, 3, 0.3, 0, r);
  pileAmphores(ch, 0.95, 0.07, 1.15, 3, 2, 0.28, Math.PI / 2, r);
  for (let i = 0; i < 4; i++) caisse(ch, 0.6 + (i % 2) * 0.17, 0.07 + Math.floor(i / 2) * 0.13, 0.75, 0.15, i * 0.2);
  for (let i = 0; i < 5; i++) sac(ch, -0.3 + i * 0.13, 0.07, 1.2 + (i % 2) * 0.08, 0.16);
  ch.boite(0.15, 0.07, 1.25, 0.04, 0.4, 0.04, C.boisSombre, MAT.bois);
  ch.boite(0.15, 0.47, 1.25, 0.4, 0.02, 0.02, C.bronze, MAT.bronze);
}

/** La pêcherie : une cabane, un ponton sur l'eau, des filets qui sèchent et des nasses. */
export function peche(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  // Le plancher de bois devant la cabane
  for (let i = 0; i < 11; i++) ch.boite(-0.9 + i * 0.17 + 0.085, 0.06, 0.4, 0.16, 0.03, 1.1, varier(C.boisGris, 0.08, r), MAT.bois);
  // La cabane de planches
  ch.boite(-0.3, 0.06, -0.52, 1.2, 0.72, 0.76, C.boisGris, MAT.bois);
  ch.boite(-0.3, 0.06, -0.52, 1.22, 0.14, 0.78, C.pierre, MAT.pierre);
  ch.appentis(-0.3, 0.06, -0.52, 1.2, 0.76, 0.92, 0.72, 0.1, 0.04, tu);
  porte(ch, -0.1, 0.09, -0.14, 0.22, 0.5, "z", { cadre: C.boisSombre, matCadre: MAT.bois, seuil: false });
  fenetre(ch, -0.6, 0.42, -0.14, 0.14, 0.13, "z", { volets: C.bois, cadre: C.boisSombre });
  cheminee(ch, -0.75, 0.75, -0.75, 0.3);
  // Le ponton qui avance sur l'eau
  for (let k = 0; k < 9; k++) ch.boite(0.45, 0.02, 0.98 + k * 0.17 + 0.085, 0.44, 0.03, 0.16, varier(C.boisGris, 0.1, r), MAT.bois);
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1]) ch.cylindre(0.45 + s * 0.2, -1.8, 1.05 + k * 0.48, 0.035, 1.88, 6, C.boisSombre, MAT.bois);
  }
  ch.cylindre(0.67, 0.02, 2.48, 0.04, 0.3, 6, C.boisSombre, MAT.bois);
  ch.ajouter(new THREE.TorusGeometry(0.06, 0.015, 4, 10).rotateX(Math.PI / 2).translate(0.3, 0.06, 2.3), 0xb8a47c, MAT.tissu);
  // Les filets tendus entre deux perches
  for (const px of [-0.85, -0.1]) ch.boite(px, 0.06, 0.62, 0.03, 0.7, 0.03, C.boisSombre, MAT.bois);
  ch.boite(-0.475, 0.74, 0.62, 0.8, 0.025, 0.025, C.boisSombre, MAT.bois);
  ch.boite(-0.475, 0.22, 0.62, 0.72, 0.5, 0.012, 0x6b5a44, MAT.tissu);
  for (let i = 0; i < 6; i++) ch.boule(-0.78 + i * 0.12, 0.26 + (i % 2) * 0.08, 0.63, 0.018, 0.018, 0.018, 0xd8c070, MAT.bois, 0);
  // Le séchoir à poissons
  ch.boite(0.55, 0.06, -0.55, 0.03, 0.55, 0.03, C.boisSombre, MAT.bois);
  ch.boite(0.85, 0.06, -0.55, 0.03, 0.55, 0.03, C.boisSombre, MAT.bois);
  ch.boite(0.7, 0.58, -0.55, 0.34, 0.02, 0.02, C.boisSombre, MAT.bois);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Matrix4().setPosition(0.58 + i * 0.06, 0.5, -0.55);
    ch.ajouter(new THREE.SphereGeometry(0.018, 5, 4).scale(0.7, 3.2, 1), 0x9aa4ac, MAT.bronze, m);
  }
  // Nasses, paniers, rames et ancre de pierre
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.3 + i * 0.16, 0.12, 0.25 + (i % 2) * 0.1);
    ch.repereM(m, () => panier(ch, 0, -0.07, 0, 0.065));
  }
  panier(ch, -0.2, 0.09, 0.15, 0.08, 0x9aa4ac);
  for (const pz of [-0.05, 0.02]) ch.barre([0.82, 0.09, pz], [0.88, 0.78, pz - 0.05], 0.012, C.boisClair, MAT.bois, 4);
  ch.boite(0.8, 0.09, 0.82, 0.14, 0.09, 0.1, C.pierreSombre, MAT.pierre);
}

/** Le bûcheron : cabane de rondins, grosse pile de bois, billot et chevalet de sciage. */
export function bucheron(ch: Chantier, r: Hasard) {
  fondation(ch, 1.9, 1.9);
  ch.boite(0, 0.06, 0, 1.84, 0.012, 1.84, C.terre, MAT.terrecuite);
  // La cabane : des rondins empilés en façade et sur le côté
  ch.boite(-0.35, 0.06, -0.47, 1.1, 0.7, 0.86, C.bois, MAT.bois);
  for (let k = 0; k < 8; k++) {
    const y = 0.1 + k * 0.085;
    ch.cylindreCouche(-0.35, y, -0.035, 0.045, 1.2, "x", 6, varier(C.bois, 0.12, r), MAT.bois);
    ch.cylindreCouche(-0.905, y, -0.47, 0.045, 0.96, "z", 6, varier(C.bois, 0.12, r), MAT.bois);
    ch.cylindreCouche(0.205, y, -0.47, 0.045, 0.96, "z", 6, varier(C.bois, 0.12, r), MAT.bois);
  }
  ch.toit2(-0.35, 0.76, -0.47, 1.1, 0.86, 0.36, 0.12, 0.05, 0x7d6a55, "x", { c: C.boisGris, mat: MAT.bois });
  porte(ch, -0.15, 0.06, 0.02, 0.22, 0.5, "z", { cadre: C.boisSombre, matCadre: MAT.bois, seuil: false });
  fenetre(ch, -0.62, 0.38, 0.02, 0.12, 0.12, "z", { volets: C.boisSombre, cadre: C.boisSombre });
  cheminee(ch, -0.7, 0.8, -0.65, 0.38);
  // Le bois coupé, empilé sous un auvent
  pileBois(ch, 0.6, 0.06, -0.45, 0.6, 4, Math.PI / 2, r, 0.05);
  ch.appentis(0.6, 0.06, -0.45, 0.82, 0.42, 0.62, 0.5, 0.05, 0.03, 0x7d6a55, -Math.PI / 2, MAT.tuiles);
  for (const pz of [-0.82, -0.08]) ch.boite(0.78, 0.06, pz, 0.03, 0.5, 0.03, C.boisSombre, MAT.bois);
  pileBois(ch, -0.45, 0.06, 0.6, 0.9, 2, 0, r, 0.06);
  // Le billot et la hache, le chevalet avec un tronc à scier
  ch.cylindre(0.35, 0.06, 0.35, 0.09, 0.18, 8, C.boisClair, MAT.bois);
  ch.barre([0.35, 0.24, 0.35], [0.47, 0.42, 0.36], 0.01, C.boisSombre, MAT.bois, 4);
  ch.boite(0.36, 0.22, 0.35, 0.06, 0.05, 0.015, 0x6a6a70, MAT.bronze);
  for (const s of [-1, 1]) {
    ch.barre([0.55 + s * 0.08, 0.06, 0.62], [0.55 - s * 0.05, 0.36, 0.62], 0.015, C.boisSombre, MAT.bois, 4);
    ch.barre([0.85 + s * 0.08, 0.06, 0.62], [0.85 - s * 0.05, 0.36, 0.62], 0.015, C.boisSombre, MAT.bois, 4);
  }
  ch.cylindreCouche(0.7, 0.34, 0.62, 0.06, 0.6, "x", 7, C.bois, MAT.bois);
  // Copeaux et souches
  for (let i = 0; i < 14; i++) ch.boite(0.1 + r() * 0.8, 0.072, 0.15 + r() * 0.75, 0.03, 0.006, 0.02, C.paille, MAT.bois);
  ch.cylindre(-0.8, 0.06, 0.25, 0.07, 0.09, 7, C.boisClair, MAT.bois);
}

/** La ferme : un corps de logis et un grenier surélevé au nord ; le champ (dessiné ailleurs) au sud. */
export function ferme(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 3.9, 1.25, 0, -1.325);
  ch.boite(0, 0.06, -1.325, 3.86, 0.012, 1.2, C.terre, MAT.terrecuite);
  // Le logis
  ch.boite(-0.75, 0.06, -1.4, 2.3, 0.88, 1.0, C.enduit, MAT.enduit);
  ch.boite(-0.75, 0.06, -1.4, 2.32, 0.14, 1.02, C.pierre, MAT.pierre);
  ch.toit2(-0.75, 0.94, -1.4, 2.3, 1.0, 0.38, 0.1, 0.05, tu, "x", { c: C.enduit, mat: MAT.enduit });
  cheminee(ch, -1.4, 0.95, -1.6, 0.52);
  porte(ch, -0.6, 0.06, -0.9, 0.26, 0.55, "z", { vantaux: C.boisSombre, entrouverte: true });
  for (const px of [-1.5, -1.1, -0.15]) fenetre(ch, px, 0.5, -0.9, 0.15, 0.17, "z", { volets: C.bois });
  fenetre(ch, -1.9, 0.5, -1.4, 0.14, 0.16, "-x");
  // Le grenier, posé sur des piliers pour garder le grain au sec
  for (const px of [0.75, 1.25, 1.75]) for (const pz of [-1.8, -1.05]) ch.boite(px, 0.06, pz, 0.1, 0.28, 0.1, C.pierre, MAT.pierre);
  ch.boite(1.25, 0.34, -1.425, 1.2, 0.05, 0.9, C.boisSombre, MAT.bois);
  ch.boite(1.25, 0.39, -1.425, 1.1, 0.6, 0.8, C.boisClair, MAT.bois);
  ch.toit2(1.25, 0.99, -1.425, 1.1, 0.8, 0.32, 0.1, 0.045, tu, "x", { c: C.boisClair, mat: MAT.bois });
  porte(ch, 1.25, 0.39, -1.025, 0.22, 0.42, "z", { vantaux: C.boisGris, seuil: false });
  ch.escalier(1.25, 0.06, -0.86, 0.2, 0.3, 0.3, 3, C.boisGris, MAT.bois);
  // La meule de foin, la charrue, les paniers
  ch.tour(0.35, 0.06, -1.45, [
    [0.28, 0],
    [0.3, 0.25],
    [0.22, 0.48],
    [0.08, 0.62],
    [0, 0.66],
  ], 10, C.paille, MAT.terrecuite);
  ch.barre([0.35, 0.06, -1.45], [0.35, 0.78, -1.45], 0.015, C.boisSombre, MAT.bois, 4);
  ch.barre([0.1, 0.07, -0.85], [0.55, 0.3, -0.95], 0.02, C.bois, MAT.bois, 4);
  ch.boite(0.1, 0.07, -0.85, 0.12, 0.05, 0.04, 0x6a6a70, MAT.bronze);
  panier(ch, -0.2, 0.07, -0.8, 0.07, C.paille);
  amphore(ch, -1.75, 0.06, -0.82, 0.3, varier(C.amphore, 0.1, r), -0.2);
  // La clôture du champ : piquets et deux lisses
  const clot = (x1: number, z1: number, x2: number, z2: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 0.5));
    for (let i = 0; i <= n; i++) ch.cylindre(x1 + ((x2 - x1) * i) / n, -0.5, z1 + ((z2 - z1) * i) / n, 0.018, 0.82, 4, C.boisGris, MAT.bois);
    for (const y of [0.12, 0.26]) ch.barre([x1, y, z1], [x2, y, z2], 0.01, C.boisGris, MAT.bois, 3);
  };
  clot(-1.92, -0.7, -1.92, 1.92);
  clot(1.92, -0.7, 1.92, 1.92);
  clot(-1.92, 1.92, -0.2, 1.92);
  clot(0.2, 1.92, 1.92, 1.92);
}

/** Le moulin : un âne fait tourner la grande meule de la cour (l'âne est animé ailleurs). */
export function moulin(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  ch.boite(0, 0.06, 0.4, 1.84, 0.012, 1.1, C.dallage, MAT.dallage);
  // La réserve à grain
  ch.boite(-0.5, 0.06, -0.5, 0.8, 0.85, 0.8, C.enduit, MAT.enduit);
  ch.boite(-0.5, 0.06, -0.5, 0.82, 0.14, 0.82, C.pierre, MAT.pierre);
  ch.toit4(-0.5, 0.91, -0.5, 0.8, 0.8, 0.32, 0.08, 0.045, tu);
  porte(ch, -0.5, 0.06, -0.1, 0.22, 0.5, "z", { vantaux: C.bois, entrouverte: true });
  fenetre(ch, -0.9, 0.5, -0.5, 0.12, 0.14, "-x", { barreaux: true });
  // L'appentis et sa deuxième meule
  for (const [px, pz] of [
    [0.05, -0.88],
    [0.85, -0.88],
    [0.05, -0.18],
    [0.85, -0.18],
  ] as const)
    ch.boite(px, 0.06, pz, 0.05, 0.72, 0.05, C.boisSombre, MAT.bois);
  ch.appentis(0.45, 0.06, -0.53, 0.88, 0.76, 0.82, 0.7, 0.06, 0.04, tu);
  meule(ch, 0.45, 0.06, -0.55, 0.4);
  // La grande meule de la cour (l'âne tourne autour)
  meule(ch, 0.2, 0.06, 0.42, 0.55);
  ch.emettre("ane", 0.2, 0.07, 0.42);
  // Sacs de farine et de blé, tamis, paniers
  for (let i = 0; i < 6; i++) sac(ch, -0.8 + (i % 2) * 0.13, 0.07 + Math.floor(i / 2) * 0.0, 0.15 + Math.floor(i / 2) * 0.17, 0.16, i % 3 ? 0xece4d2 : 0xd8c49a);
  panier(ch, 0.75, 0.07, 0.85, 0.07, C.paille);
  ch.cylindre(-0.45, 0.07, 0.85, 0.09, 0.04, 10, C.boisClair, MAT.bois);
}

/** La boulangerie : la boutique et son four en coupole, dont la cheminée fume dès l'aube. */
export function boulangerie(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  ch.boite(0, 0.06, 0.65, 1.84, 0.012, 0.6, C.dallage, MAT.dallage);
  ch.boite(-0.25, 0.06, -0.28, 1.3, 1.0, 1.24, C.enduit, MAT.enduit);
  ch.boite(-0.25, 0.06, -0.28, 1.32, 0.16, 1.26, C.pierre, MAT.pierre);
  ch.toit4(-0.25, 1.06, -0.28, 1.3, 1.24, 0.42, 0.09, 0.05, tu);
  // La boutique : grand comptoir et pains ronds (panis quadratus)
  porte(ch, -0.35, 0.06, 0.34, 0.6, 0.72, "z", { cadre: C.brique });
  ch.boite(-0.35, 0.06, 0.44, 0.6, 0.3, 0.16, varier(C.ocre, 0.05, r), MAT.peint);
  ch.boite(-0.35, 0.36, 0.44, 0.64, 0.03, 0.2, C.marbre, MAT.marbre);
  for (let i = 0; i < 6; i++) ch.boule(-0.58 + i * 0.09, 0.405, 0.44, 0.038, 0.018, 0.038, 0xa8682c, MAT.terrecuite, 1);
  fenetre(ch, -0.85, 0.55, -0.28, 0.13, 0.18, "-x", { barreaux: true });
  ch.boite(-0.25, 0.85, 0.345, 0.44, 0.1, 0.02, 0xe8dcc0, MAT.peint);
  // Le four : un massif de brique, une coupole et la bouche où rougeoie la braise
  ch.boite(0.6, 0.06, -0.48, 0.62, 0.42, 0.84, C.brique, MAT.pierre);
  ch.dome(0.6, 0.48, -0.5, 0.29, C.terrecuite, MAT.terrecuite, 14, 0.85);
  porte(ch, 0.6, 0.18, -0.06, 0.2, 0.12, "z", { arc: true, cadre: C.brique, seuil: false });
  ch.boite(0.6, 0.19, -0.075, 0.14, 0.05, 0.02, C.feu, MAT.feu);
  cheminee(ch, 0.6, 0.65, -0.78, 0.6);
  // Bois pour le four, sacs de farine et une petite meule
  pileBois(ch, 0.62, 0.06, 0.5, 0.5, 2, 0, r);
  for (let i = 0; i < 3; i++) sac(ch, 0.25 + i * 0.12, 0.07, 0.82, 0.15, 0xece4d2);
  meule(ch, -0.7, 0.06, 0.72, 0.3);
}

/** L'oliveraie : seulement un abri et la récolte dans le coin nord-ouest ; les oliviers sont dessinés ailleurs. */
export function oliveraie(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.05, 1.05, -1.425, -1.425);
  for (const [px, pz] of [
    [-1.88, -1.88],
    [-1.0, -1.88],
    [-1.88, -1.1],
    [-1.0, -1.1],
  ] as const)
    ch.boite(px, 0.06, pz, 0.05, 0.62, 0.05, C.boisSombre, MAT.bois);
  ch.appentis(-1.44, 0.06, -1.5, 0.98, 0.86, 0.7, 0.58, 0.06, 0.04, tu);
  ch.boite(-1.44, 0.06, -1.86, 0.9, 0.5, 0.06, C.pierre, MAT.pierre);
  for (let i = 0; i < 4; i++) panier(ch, -1.75 + (i % 2) * 0.18, 0.06, -1.6 + Math.floor(i / 2) * 0.2, 0.075, i % 2 ? 0x3d4a22 : 0x4a2a3a);
  echelle(ch, -1.1, 0.06, -1.6, 0.7, 0.3, 0.2);
  amphore(ch, -1.2, 0.06, -1.25, 0.3, varier(C.amphore, 0.1, r), -0.15);
  amphore(ch, -1.3, 0.06, -1.2, 0.28, varier(C.amphore, 0.1, r), -0.2, 1);
  ch.boite(-1.6, 0.06, -1.15, 0.3, 0.12, 0.16, C.pierreClaire, MAT.pierre);
}

/** Le pressoir à huile : le broyeur (trapetum) dans la cour, le pressoir à levier sous l'appentis. */
export function pressoir(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 1.9, 1.9);
  ch.boite(0, 0.06, 0.35, 1.84, 0.012, 1.15, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, -0.56, 1.8, 0.92, 0.7, C.enduit, MAT.enduit);
  ch.boite(0, 0.06, -0.56, 1.82, 0.14, 0.72, C.pierre, MAT.pierre);
  ch.toit2(0, 0.98, -0.56, 1.8, 0.7, 0.3, 0.08, 0.045, tu, "x", { c: C.enduit, mat: MAT.enduit });
  porte(ch, 0.45, 0.06, -0.21, 0.24, 0.55, "z", { vantaux: C.boisSombre, entrouverte: true });
  fenetre(ch, 0.85, 0.5, -0.21, 0.12, 0.14, "z");
  // L'appentis et le pressoir à levier (prelum), lesté d'une grosse pierre
  for (const [px, pz] of [
    [-0.88, 0.85],
    [-0.12, 0.85],
  ] as const)
    ch.boite(px, 0.06, pz, 0.05, 0.75, 0.05, C.boisSombre, MAT.bois);
  ch.appentis(-0.5, 0.06, 0.32, 0.86, 1.06, 0.88, 0.76, 0.06, 0.04, tu);
  for (const s of [-1, 1]) ch.boite(-0.5 + s * 0.09, 0.06, -0.12, 0.07, 0.8, 0.07, C.bois, MAT.bois);
  ch.barre([-0.5, 0.6, -0.12], [-0.5, 0.42, 0.78], 0.045, C.bois, MAT.bois, 6);
  ch.boite(-0.5, 0.06, 0.78, 0.22, 0.18, 0.2, C.pierreSombre, MAT.pierre);
  ch.barre([-0.5, 0.42, 0.78], [-0.5, 0.24, 0.78], 0.01, 0xb8a47c, MAT.tissu, 3);
  ch.cylindre(-0.5, 0.06, 0.2, 0.22, 0.08, 14, C.pierreClaire, MAT.pierre);
  ch.cylindre(-0.5, 0.14, 0.2, 0.13, 0.12, 10, 0x6a5a3a, MAT.tissu);
  // Le broyeur à olives : une cuve ronde et deux meules en demi-sphère sur un axe
  ch.tour(0.45, 0.06, 0.45, [
    [0.32, 0],
    [0.34, 0.24],
    [0.3, 0.26],
    [0.28, 0.1],
    [0, 0.12],
  ], 16, C.pierreClaire, MAT.pierre);
  ch.cylindre(0.45, 0.06, 0.45, 0.06, 0.34, 8, C.pierreClaire, MAT.pierre);
  for (const s of [-1, 1]) ch.cylindreCouche(0.45 + s * 0.14, 0.26, 0.45, 0.13, 0.08, "x", 12, C.pierreSombre, MAT.pierre);
  ch.cylindreCouche(0.45, 0.28, 0.45, 0.018, 0.65, "x", 5, C.bois, MAT.bois);
  // Dolia enterrés et amphores d'huile
  dolium(ch, 0.1, 0.06, 0.82, 0.16, true);
  dolium(ch, 0.45, 0.06, 0.88, 0.16, true);
  for (let i = 0; i < 4; i++) amphore(ch, 0.82, 0.06, 0.0 + i * 0.13, 0.3, varier(C.amphore, 0.1, r), -0.2, -Math.PI / 2);
  panier(ch, -0.15, 0.07, 0.5, 0.07, 0x3d4a22);
}

/** Le vignoble : des rangs de vigne sur de petites terrasses de pierre sèche, un abri dans un coin. */
export function vigne(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 0.95, 0.95, 1.45, -1.45);
  const rangs = [-1.55, -0.95, -0.35, 0.25, 0.85, 1.45];
  for (const z of rangs) {
    const x0 = -1.82;
    const x1 = z < -0.6 ? 0.85 : 1.82;
    const l = x1 - x0;
    // La terrasse de pierre sèche qui porte le rang
    ch.boite((x0 + x1) / 2, -1.0, z, l + 0.1, 1.05, 0.36, varier(C.pierre, 0.06, r), MAT.pierre);
    ch.boite((x0 + x1) / 2, 0.05, z, l + 0.06, 0.012, 0.3, C.terre, MAT.terrecuite);
    // Les échalas et le fil
    const n = Math.round(l / 0.45);
    for (let i = 0; i <= n; i++) ch.boite(x0 + (l * i) / n, -0.2, z, 0.022, 0.82, 0.022, C.boisGris, MAT.bois);
    ch.barre([x0, 0.52, z], [x1, 0.52, z], 0.005, C.boisGris, MAT.bois, 3);
    // Le feuillage : des tronçons touffus, irréguliers, séparés par de petites trouées
    let xa = x0 + 0.02;
    while (xa < x1 - 0.25) {
      const seg = Math.min(x1 - xa, 0.5 + r() * 0.55);
      const vert = [0x55743a, 0x6a8a3c, 0x4e6a30, 0x627f36][Math.floor(r() * 4)]!;
      ch.masse(xa + seg / 2, 0.33 + r() * 0.03, z + (r() - 0.5) * 0.03, seg - 0.03, 0.28 + r() * 0.07, 0.19, varier(vert, 0.08, r), MAT.feuillage, r, 0.34);
      xa += seg + 0.02 + r() * 0.07;
    }
    const nb = Math.round(l / 0.5);
    for (let i = 0; i < nb; i++) {
      const px = x0 + 0.15 + ((l - 0.3) * (i + 0.5)) / nb + (r() - 0.5) * 0.15;
      ch.boule(px, 0.55 + r() * 0.05, z + (r() - 0.5) * 0.08, 0.1 + r() * 0.05, 0.06, 0.08, varier(0x7a9a44, 0.12, r), MAT.feuillage, 0);
    }
    for (let i = 0; i < Math.round(l * 3); i++) {
      const px = x0 + 0.1 + r() * (l - 0.2);
      ch.boule(px, 0.2 + r() * 0.06, z + (r() < 0.5 ? -0.12 : 0.12), 0.028, 0.045, 0.028, r() < 0.85 ? 0x4a2350 : 0x9aa040, MAT.feuillage, 0);
    }
  }
  // L'abri du vigneron, ses paniers et ses amphores
  ch.boite(1.45, 0.06, -1.6, 0.8, 0.62, 0.6, C.pierre, MAT.pierre);
  ch.toit2(1.45, 0.68, -1.6, 0.8, 0.6, 0.26, 0.08, 0.04, tu, "x", { c: C.pierre, mat: MAT.pierre });
  porte(ch, 1.45, 0.06, -1.3, 0.2, 0.42, "z", { cadre: C.pierreClaire, seuil: false });
  for (let i = 0; i < 3; i++) panier(ch, 1.2 + i * 0.17, 0.06, -1.12, 0.07, 0x4a2350);
  amphore(ch, 1.82, 0.06, -1.15, 0.3, varier(C.amphore, 0.1, r), -0.15);
}

/** La cave à vin (3 × 2) : le chai au fond, la cuve de foulage et les dolia enterrés sous une treille. */
export function cave(ch: Chantier, r: Hasard) {
  const tu = tuile(r);
  fondation(ch, 2.9, 1.9);
  ch.boite(0, 0.06, 0.38, 2.84, 0.012, 1.1, C.dallage, MAT.dallage);
  ch.boite(0, 0.06, -0.53, 2.8, 0.98, 0.76, C.enduit, MAT.enduit);
  ch.boite(0, 0.06, -0.53, 2.82, 0.16, 0.78, C.pierre, MAT.pierre);
  ch.toit2(0, 1.04, -0.53, 2.8, 0.76, 0.34, 0.1, 0.05, tu, "x", { c: C.enduit, mat: MAT.enduit });
  porte(ch, -0.3, 0.06, -0.15, 0.4, 0.62, "z", { arc: true, vantaux: C.boisSombre, entrouverte: true });
  for (const px of [-1.1, 0.5, 1.1]) fenetre(ch, px, 0.55, -0.15, 0.13, 0.16, "z", { barreaux: true });
  // Les dolia enterrés, en rangs, sous la treille
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) dolium(ch, -1.15 + i * 0.4, 0.07, 0.2 + k * 0.42, 0.16, true);
  pergola(ch, -0.55, 0.06, 0.42, 1.65, 0.86, 0.9, r, true, 0.7);
  // La cuve de foulage pleine de jus, et son bec
  const x0 = 0.95;
  ch.boite(x0, 0.06, 0.42, 0.8, 0.24, 0.06, C.pierreClaire, MAT.pierre);
  ch.boite(x0, 0.06, 0.82, 0.8, 0.24, 0.06, C.pierreClaire, MAT.pierre);
  ch.boite(x0 - 0.37, 0.06, 0.62, 0.06, 0.24, 0.34, C.pierreClaire, MAT.pierre);
  ch.boite(x0 + 0.37, 0.06, 0.62, 0.06, 0.24, 0.34, C.pierreClaire, MAT.pierre);
  ch.boite(x0, 0.06, 0.62, 0.7, 0.17, 0.36, C.vin, MAT.eau);
  dolium(ch, x0, 0.06, 0.88, 0.08, true);
  for (let i = 0; i < 3; i++) panier(ch, 0.4 + i * 0.15, 0.07, 0.15, 0.07, 0x4a2350);
  pileAmphores(ch, 1.25, 0.07, 0.15, 3, 2, 0.26, 0, r);
  muret(ch, -1.42, 0.92, 1.42, 0.92, 0.06, 0.12, 0.05, C.pierre, MAT.pierre, null);
}

/** La carrière : un front de taille en gradins de blocs irréguliers, une chèvre de levage, des blocs. */
export function carriere(ch: Chantier, r: Hasard) {
  const marbre = 0xefece4;
  fondation(ch, 2.9, 2.9, 0, 0, 0.06, C.pierreClaire);
  ch.boite(0, 0.06, 0.5, 2.84, 0.012, 1.84, 0xdcd7cc, MAT.terrecuite);
  // Les gradins : chaque banc est fait de blocs taillés de largeur et de hauteur inégales
  const gradins = [
    { z0: -1.42, z1: -0.92, h: 1.85, xa: -1.42, xb: 1.42, ecart: 0.28 },
    { z0: -0.92, z1: -0.42, h: 1.2, xa: -1.42, xb: 1.42, ecart: 0.18 },
    { z0: -0.42, z1: 0.02, h: 0.58, xa: -1.38, xb: 0.62, ecart: 0.12 },
  ];
  for (const g of gradins) {
    let x = g.xa;
    while (x < g.xb - 0.05) {
      const l = Math.min(g.xb - x, 0.32 + r() * 0.42);
      const h = g.h + (r() - 0.5) * g.ecart;
      const recul = (r() - 0.3) * 0.08;
      const p = g.z1 - g.z0 - recul;
      ch.boite(x + l / 2, 0.06, g.z0 + p / 2, l - 0.01, h, p, varier(marbre, 0.04, r), MAT.pierre);
      // Les saignées laissées par les outils des carriers, sur la face
      if (r() < 0.6) ch.boite(x + l * (0.3 + r() * 0.4), 0.06 + h * 0.35, g.z0 + p + 0.004, 0.014, h * 0.6, 0.012, 0x8c8678, MAT.ouverture);
      x += l;
    }
  }
  // Des blocs à moitié détachés sur le banc du milieu, et des coins de bois dans les saignées
  for (let i = 0; i < 4; i++) {
    const px = -1.05 + i * 0.62;
    ch.boite(px, 1.26, -0.67, 0.5, 0.26, 0.4, varier(marbre, 0.04, r), MAT.pierre);
    for (let k = 0; k < 3; k++) ch.boite(px - 0.15 + k * 0.15, 1.42, -0.465, 0.03, 0.05, 0.02, C.bois, MAT.bois);
  }
  // La roche brute au sommet, qui raccorde la carrière à la falaise
  ch.masse(0, 2.0, -1.14, 2.95, 0.45, 0.5, varier(0x948e84, 0.06, r), MAT.pierre, r, 0.4);
  for (let i = 0; i < 6; i++) ch.boule(-1.3 + r() * 2.6, 1.95 + r() * 0.2, -1.25 + r() * 0.2, 0.18 + r() * 0.1, 0.12 + r() * 0.08, 0.2, varier(0x8a847a, 0.1, r), MAT.pierre, 0);
  // Des coulées ocre sur le front de taille
  for (let i = 0; i < 5; i++) ch.boite(-1.2 + r() * 2.4, 1.0 + r() * 0.5, -0.915, 0.06 + r() * 0.08, 0.5 + r() * 0.3, 0.008, 0xc8a878, MAT.peint);
  // Une rampe de bois pour monter sur le premier banc, une échelle vers le second
  const m = new THREE.Matrix4().makeRotationX(-0.42).setPosition(1.05, 0.33, 0.3);
  ch.boiteM(m, 0.42, 0.04, 1.2, C.boisGris, MAT.bois);
  echelle(ch, -1.2, 0.64, -0.38, 0.62, 0, 0.25);
  // La chèvre de levage avec un bloc, et des blocs prêts à partir
  chevre(ch, 0.3, 0.06, 0.65, 1.15, varier(marbre, 0.03, r));
  for (const [px, pz, rot, s] of [
    [-0.8, 0.6, 0.2, 1],
    [-0.45, 0.95, -0.1, 0.8],
    [-1.1, 1.05, 0.4, 0.7],
    [0.9, 1.2, 0.1, 0.9],
  ] as const)
    ch.boiteTournee(px, 0.07, pz, 0.42 * s, 0.26 * s, 0.3 * s, rot, varier(marbre, 0.03, r), MAT.marbre);
  // La traîne de bois pour tirer les blocs
  ch.boite(-0.8, 0.07, 1.35, 0.5, 0.04, 0.3, C.boisSombre, MAT.bois);
  // La cabane des carriers et leurs outils
  ch.boite(1.15, 0.06, 1.15, 0.5, 0.5, 0.45, C.pierre, MAT.pierre);
  ch.appentis(1.15, 0.06, 1.15, 0.6, 0.45, 0.62, 0.5, 0.05, 0.035, tuile(r));
  porte(ch, 0.9, 0.06, 1.15, 0.16, 0.38, "-x", { seuil: false });
  for (let i = 0; i < 3; i++) ch.barre([0.75 + i * 0.06, 0.07, 0.95], [0.78 + i * 0.06, 0.5, 0.92], 0.01, C.boisClair, MAT.bois, 4);
  // Éclats de marbre au sol
  for (let i = 0; i < 18; i++) ch.boiteTournee(-1.3 + r() * 2.4, 0.072, 0.1 + r() * 1.3, 0.04 + r() * 0.05, 0.02, 0.03 + r() * 0.04, r() * 3, marbre, MAT.marbre);
}
