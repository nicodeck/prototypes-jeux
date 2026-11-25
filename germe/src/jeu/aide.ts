// L'aide contextuelle : une seule phrase à la fois, en bas de l'écran, qui dit quoi faire ici et maintenant.
// D'abord le tutoriel (ramasser, pousser la pierre, planter), puis des conseils selon la situation.
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;

export interface ContexteAide {
  monde: Monde;
  dirJoueur: import("three").Vector3;
  devant: import("three").Vector3;
  graines: number;
  ramassees: number;
  plantees: number;
  bouchonEnPlace: boolean;
  sourceProche: number;
  dansLeVent: boolean;
  souffleDispo: boolean;
  temps: number;
}

export class Aide {
  private vus = new Set<string>();
  private conseil: { texte: string; jusqua: number } | null = null;

  /** Un conseil affiché une seule fois, quelques secondes. */
  conseiller(cle: string, texte: string, temps: number, duree = 7) {
    if (this.vus.has(cle)) return;
    this.vus.add(cle);
    this.conseil = { texte, jusqua: temps + duree };
  }

  texte(c: ContexteAide): string {
    const m = c.monde;
    if (c.dansLeVent && c.souffleDispo) return "Le vent de cendre dessèche tout : <kbd>C</kbd> souffle pour le chasser";
    if (c.dansLeVent) return "Abrite-toi près des arbres : ils protègent du vent de cendre";
    if (c.sourceProche >= 0) {
      return c.graines > 0
        ? "Une source dort ici : <kbd>E</kbd> offre-lui une graine pour la réveiller"
        : "Cette source dort. Apporte-lui une graine pour la réveiller";
    }
    if (c.ramassees === 0) return "Va ramasser la graine lumineuse";
    if (c.bouchonEnPlace && m.part < 0.15) {
      const d = m.pierres[0].dir.angleTo(c.dirJoueur) * R;
      return d < 3
        ? "Pousse la pierre en marchant contre elle : elle retient l'eau de la source"
        : "Une pierre bouche la source, sur la butte : va la pousser";
    }
    if (this.conseil && c.temps < this.conseil.jusqua) return this.conseil.texte;
    if (c.graines > 0) {
      const p = m.plantable(c.devant);
      if (p === "ok") return c.plantees === 0 ? "<kbd>E</kbd> plante ta graine dans la terre humide" : "<kbd>E</kbd> planter ici";
      if (c.plantees === 0) {
        if (p === "sec") return "Le sol est trop sec : plante près de l'eau, là où la terre a bruni";
        if (p === "eau") return "Pas dans l'eau : plante sur la berge";
      }
    }
    return "";
  }
}
