// Vérifie que le niveau est jouable : chaque objet est atteignable et l'arrivée aussi.
import { expect, test } from "bun:test";
import { lireNiveau, CASE } from "../src/monde/niveau";
import { NIVEAU_1 } from "../src/monde/niveau-1";
import { explorer } from "./solveur";

const niveau = lireNiveau(NIVEAU_1);
const sansPlume = explorer(niveau);
const avecPlume = explorer(niveau, { plume: true });

/** Dessine la carte avec les endroits où le héros a pu se tenir, pour comprendre un échec. */
function carteAccessible() {
  return NIVEAU_1.carte
    .map((ligne, y) =>
      [...ligne.padEnd(niveau.largeur)].map((c, x) => (sansPlume.positions.has(`${x},${y}`) ? "·" : c)).join(""),
    )
    .join("\n");
}

test("l'arrivée est atteignable sans la plume", () => {
  if (!sansPlume.arrivee) console.log(carteAccessible());
  expect(sansPlume.arrivee).toBe(true);
});

test("chaque graine et chaque bloc mystère est atteignable sans la plume", () => {
  const manquants: string[] = [];
  for (const a of niveau.apparitions) {
    if (a.lettre === "o" && !sansPlume.ramasses.has(`o${a.colonne},${a.ligne}`)) manquants.push(`graine ${a.colonne},${a.ligne}`);
  }
  for (const i of niveau.contenus.keys()) {
    if (!sansPlume.ramasses.has(`case${i}`)) manquants.push(`bloc ${i % niveau.largeur},${Math.floor(i / niveau.largeur)}`);
  }
  if (manquants.length) console.log(carteAccessible());
  expect(manquants).toEqual([]);
});

test("les trois œufs : deux sans la plume, le dernier seulement avec", () => {
  const oeufs = niveau.apparitions.filter((a) => a.lettre === "O").map((a) => `O${a.colonne},${a.ligne}`);
  expect(oeufs.length).toBe(3);
  const sans = oeufs.filter((id) => sansPlume.ramasses.has(id));
  const avec = oeufs.filter((id) => avecPlume.ramasses.has(id));
  console.log(`œufs sans plume : ${sans.join(" ")} ; avec plume : ${avec.join(" ")}`);
  expect(sans.length).toBe(2);
  expect(avec.length).toBe(3);
});

test("pas de brique inutile : CASE reste cohérent", () => {
  expect(CASE.brique).toBe(3);
});
