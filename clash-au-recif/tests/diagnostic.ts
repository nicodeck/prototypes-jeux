// Statistiques bot contre bot : `bun tests/diagnostic.ts`
import { bot, jouer } from "./outils";
import type { NomPerso } from "../src/combat/persos";
import type { Niveau } from "../src/combat/bot";
const paires: [NomPerso, NomPerso][] = [["rin", "ganzo"], ["rin", "rin"], ["ganzo", "ganzo"]];
const duels: [Niveau, Niveau][] = [["difficile", "difficile"], ["moyen", "moyen"], ["facile", "facile"], ["difficile", "facile"], ["moyen", "facile"]];
for (const p of paires)
  for (const [n1, n2] of duels) {
    let v0 = 0, total = 0, sd = 0, secondes = 0, nonFini = 0;
    const pcts: number[] = [];
    for (let g = 0; g < 12; g++) {
      const r = jouer(p, [bot(n1, g * 2 + 1), bot(n2, g * 2 + 2)]);
      if (r.combat.gagnant === 0) v0++;
      if (!r.combat.fini) nonFini++;
      secondes += r.combat.image / 60;
      for (const k of r.ko) { total++; if (k.autodestruction) sd++; else pcts.push(k.degats); }
    }
    pcts.sort((a, b) => a - b);
    console.log(`${p[0]}(${n1}) vs ${p[1]}(${n2}) : J1 gagne ${v0}/12, non finis ${nonFini}, durée moy ${Math.round(secondes / 12)} s, KO ${total} dont autodestructions ${sd}, % au KO médian ${Math.round(pcts[pcts.length >> 1] ?? 0)} (min ${Math.round(pcts[0] ?? 0)})`);
  }
