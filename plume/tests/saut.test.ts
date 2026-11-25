// Mesure ce que le héros sait faire avec les réglages actuels, sur un terrain plat.
import { expect, test } from "bun:test";
import { lireNiveau } from "../src/monde/niveau";
import { AUCUNE_COMMANDE, creerMonde, etape, type Commandes } from "../src/monde/monde";

function plat() {
  const sol = "#".repeat(60);
  return creerMonde(lireNiveau({ nom: "plat", panneaux: [], carte: [...Array(12).fill(" ".repeat(60)), " S" + " ".repeat(58), sol, sol] }));
}

/** Saute en gardant le bouton `maintien` images, en avançant ; renvoie la hauteur et la distance du saut. */
export function mesurerSaut(maintien: number, course: boolean) {
  const m = plat();
  const c: Commandes = { ...AUCUNE_COMMANDE, droite: true, course };
  for (let i = 0; i < 90; i++) etape(m, c); // prendre de l'élan
  const depart = { x: m.heros.x, y: m.heros.y };
  let haut = 0;
  for (let i = 0; i < 200; i++) {
    etape(m, { ...c, saut: i < maintien });
    haut = Math.max(haut, depart.y - m.heros.y);
    if (i > 2 && m.heros.auSol) break;
  }
  return { hauteur: haut, distance: m.heros.x - depart.x };
}

test("les sauts", () => {
  const long = mesurerSaut(60, true);
  const court = mesurerSaut(1, false);
  const marche = mesurerSaut(60, false);
  console.log(`saut maximal : ${long.hauteur} px de haut ; ${long.distance} px de long en courant, ${marche.distance} px en marchant`);
  console.log(`petit saut : ${court.hauteur} px`);
  expect(long.hauteur).toBeGreaterThanOrEqual(72); // monter de 4 cases, avec de la marge
  expect(long.hauteur).toBeLessThan(80); // mais pas de 5
  expect(court.hauteur).toBeLessThan(32);
});

test("aucun rattrapage : un bord à 1 pixel trop haut reste inaccessible", () => {
  const { hauteur } = mesurerSaut(60, true);
  // Une marche juste au-dessus de la hauteur maximale du saut
  const cases = Math.ceil((hauteur + 1) / 16);
  const largeur = 40;
  const carte = Array(16).fill(" ".repeat(largeur));
  carte[14] = "#".repeat(largeur);
  carte[13] = " S" + " ".repeat(8) + "#".repeat(largeur - 10);
  for (let k = 1; k < cases; k++) carte[13 - k] = " ".repeat(10) + "#".repeat(largeur - 10);
  const m = creerMonde(lireNiveau({ nom: "marche", panneaux: [], carte }));
  let plusLoin = 0;
  for (let i = 0; i < 600; i++) {
    etape(m, { ...AUCUNE_COMMANDE, droite: true, course: true, saut: i % 60 < 40 });
    plusLoin = Math.max(plusLoin, m.heros.x + m.heros.l);
  }
  expect(cases * 16).toBeGreaterThan(hauteur);
  expect(plusLoin).toBeLessThanOrEqual(10 * 16); // on n'est jamais passé sur la marche
});
