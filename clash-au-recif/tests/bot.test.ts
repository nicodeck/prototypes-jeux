// Le bot : il revient sur le récif, gagne contre un joueur immobile, et son niveau compte.
// Ces tests jouent des combats entiers : comptez une vingtaine de secondes.
import { describe, expect, test } from "bun:test";
import { ARENE } from "../src/combat/arene";
import { Bot, hasard } from "../src/combat/bot";
import { AUCUNE_COMMANDE, Combat } from "../src/combat/combat";
import type { NomPerso } from "../src/combat/persos";
import { bot, immobile, jouer } from "./outils";

const PERSOS: NomPerso[] = ["rin", "ganzo"];

describe("le bot revient sur le récif", () => {
  for (const nom of PERSOS)
    test(`${nom} revient de la plupart des positions hors du récif`, () => {
      let reussites = 0;
      let essais = 0;
      for (let y = -2; y <= 3; y++)
        for (let d = 0.5; d <= 4; d += 0.5)
          for (const cote of [-1, 1]) {
            essais++;
            const combat = new Combat([nom, "rin"]);
            const c = combat.combattants[0];
            Object.assign(c, { x: cote * (ARENE.bord + d), y, auSol: false });
            combat.combattants[1].x = -cote * 4;
            const b = new Bot("difficile", hasard(essais));
            for (let i = 0; i < 300; i++) {
              combat.pas([b.commandes(combat, 0), AUCUNE_COMMANDE]);
              if (c.auSol || c.etat === "ko") break;
            }
            if (c.auSol) reussites++;
          }
      expect(reussites / essais).toBeGreaterThan(0.95);
    });
});

describe("le bot se bat", () => {
  for (const a of PERSOS)
    for (const b of PERSOS)
      test(`${a} (bot difficile) bat ${b} immobile sans tomber tout seul`, () => {
        const { combat } = jouer([a, b], [bot("difficile", 1), immobile]);
        expect(combat.gagnant).toBe(0);
        expect(combat.combattants[0].vies).toBe(3);
        expect(combat.combattants[0].stats.autodestructions).toBe(0);
      });

  test("un combat entre deux bots se termine, avec très peu de chutes toutes seules", () => {
    let autodestructions = 0;
    let ko = 0;
    for (let g = 0; g < 6; g++) {
      const persos: [NomPerso, NomPerso] = g % 2 ? ["rin", "ganzo"] : ["ganzo", "rin"];
      const { combat, ko: liste } = jouer(persos, [bot("moyen", g * 2 + 1), bot("moyen", g * 2 + 2)]);
      expect(combat.fini).toBe(true);
      ko += liste.length;
      autodestructions += liste.filter((k) => k.autodestruction).length;
    }
    expect(autodestructions / ko).toBeLessThan(0.1);
  });

  test("le niveau difficile bat le niveau facile la plupart du temps", () => {
    let victoires = 0;
    for (let g = 0; g < 10; g++) {
      const persos: [NomPerso, NomPerso] = g % 2 ? ["rin", "ganzo"] : ["ganzo", "rin"];
      if (jouer(persos, [bot("difficile", g + 1), bot("facile", g + 100)]).combat.gagnant === 0) victoires++;
    }
    expect(victoires).toBeGreaterThanOrEqual(8);
  });

  test("deux combats avec les mêmes graines se déroulent à l'identique", () => {
    const a = jouer(["rin", "ganzo"], [bot("moyen", 7), bot("moyen", 8)]);
    const b = jouer(["rin", "ganzo"], [bot("moyen", 7), bot("moyen", 8)]);
    expect(a.combat.image).toBe(b.combat.image);
    expect(a.ko).toEqual(b.ko);
  });
});
