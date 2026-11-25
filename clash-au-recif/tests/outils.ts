// Outils pour les tests : faire tourner un combat sans navigateur.
import { Bot, hasard, type Niveau } from "../src/combat/bot";
import { AUCUNE_COMMANDE, Combat, type Commandes } from "../src/combat/combat";
import type { NomPerso } from "../src/combat/persos";

export type Pilote = (combat: Combat, index: number) => Commandes;

export const immobile: Pilote = () => ({ ...AUCUNE_COMMANDE });

export function bot(niveau: Niveau, graine: number): Pilote {
  const b = new Bot(niveau, hasard(graine));
  return (combat, index) => b.commandes(combat, index);
}

/** Joue un combat jusqu'au bout (ou jusqu'à la limite d'images). */
export function jouer(persos: [NomPerso, NomPerso], pilotes: [Pilote, Pilote], maxImages = 60 * 60 * 5) {
  const combat = new Combat(persos);
  const ko: { joueur: number; degats: number; autodestruction: boolean }[] = [];
  while (!combat.fini && combat.image < maxImages) {
    combat.pas([pilotes[0](combat, 0), pilotes[1](combat, 1)]);
    for (const e of combat.evenements)
      if (e.type === "ko")
        ko.push({ joueur: e.joueur, degats: e.degats, autodestruction: combat.combattants[e.joueur].imagesDepuisCoupRecu > 240 });
  }
  return { combat, ko };
}

export function resume({ combat, ko }: ReturnType<typeof jouer>) {
  return {
    secondes: Math.round(combat.image / 60),
    gagnant: combat.gagnant,
    ko: ko.map((k) => `${k.joueur}@${Math.round(k.degats)}${k.autodestruction ? "!" : ""}`).join(" "),
  };
}
