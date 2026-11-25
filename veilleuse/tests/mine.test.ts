// Vérifie que la mine est praticable : chaque lanterne et le Cœur sont atteignables depuis le
// départ, et on ne peut rester coincé nulle part.
import { expect, test } from "bun:test";
import { SALLES } from "../src/monde/carte";
import { lireMine } from "../src/monde/mine";
import { dessinerAtteint, explorer } from "./solveur";

const mine = lireMine();
const resultat = explorer(mine);

test("chaque salle a la largeur annoncée", () => {
  for (const s of SALLES) for (const l of s.carte) expect(l.length).toBe(s.largeur);
});

test("le Cœur est atteignable depuis le départ", () => {
  if (!resultat.coeur) console.log(dessinerAtteint(mine, resultat));
  expect(resultat.coeur).toBe(true);
});

test("chaque lanterne est atteignable", () => {
  const manquantes = mine.lanternes.filter((_, i) => !resultat.lanternes.has(i)).map((l) => `${l.col},${l.ligne}`);
  if (manquantes.length) console.log(dessinerAtteint(mine, resultat));
  expect(manquantes).toEqual([]);
});

test("on ne peut rester coincé nulle part", () => {
  if (resultat.coinces.length) console.log(dessinerAtteint(mine, resultat, resultat.coinces));
  expect(resultat.coinces.length).toBe(0);
});
