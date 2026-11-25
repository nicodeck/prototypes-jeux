// Les animations : d'après l'état du combattant dans la simulation, on choisit une pose.
// Les coups suivent exactement les images de la simulation : la pose « frappe » tombe
// pile sur les images où la frappe est active.
import type { Combattant } from "../combat/combat";
import { ajouter, cles, melanger, type Pose } from "./pantin";

export interface Contexte {
  temps: number;
  /** Phase de la foulée, qui avance avec la distance parcourue. */
  foulee: number;
  /** Vitesse horizontale, de 0 (arrêt) à 1 (pleine course). */
  allure: number;
  /** Vrai pendant le double saut (salto). */
  salto: number;
  victoire: boolean;
}

export interface Jeu {
  garde: Pose;
  course: (phase: number) => Pose;
  accroupi: Pose;
  saut: Pose;
  chute: Pose;
  bouclier: Pose;
  touche: Pose;
  tournoie: Pose;
  aTerre: Pose;
  etourdi: (t: number) => Pose;
  apparition: Pose;
  victoire: (t: number) => Pose;
  coups: Record<string, (image: number, charge: number) => Pose>;
  /** Amplitude de la respiration en garde. */
  souffle: number;
}

export function poseDe(c: Combattant, jeu: Jeu, x: Contexte): { pose: Pose; lissage: number; ancrer: boolean } {
  const t = x.temps;
  switch (c.etat) {
    case "coup": {
      const f = c.coup ? jeu.coups[c.coup.nom] : undefined;
      const pose = f ? f(c.image, c.charge) : jeu.garde;
      return { pose: { ...pose, expression: pose.expression ?? "cri" }, lissage: 0.55, ancrer: c.auSol };
    }
    case "garde":
    case "gardeFin":
      return { pose: jeu.bouclier, lissage: 0.4, ancrer: true };
    case "elan":
    case "atterrissage":
      return { pose: jeu.accroupi, lissage: 0.5, ancrer: true };
    case "etourdi":
      return { pose: { ...jeu.touche, expression: "douleur" }, lissage: 0.6, ancrer: c.auSol };
    case "tournoie":
      return {
        pose: { ...jeu.tournoie, tour: c.image * 0.38, expression: "douleur" },
        lissage: 0.5,
        ancrer: false,
      };
    case "aTerre":
      return { pose: { ...jeu.aTerre, expression: "douleur" }, lissage: 0.35, ancrer: false };
    case "brise":
      return { pose: { ...jeu.etourdi(t), expression: "douleur" }, lissage: 0.2, ancrer: c.auSol };
    case "reapparition":
      return { pose: jeu.apparition, lissage: 0.2, ancrer: false };
    default:
      break;
  }
  if (x.victoire) return { pose: jeu.victoire(t), lissage: 0.15, ancrer: c.auSol };
  if (!c.auSol) {
    if (x.salto > 0) return { pose: { ...jeu.saut, tour: -x.salto * Math.PI * 2 }, lissage: 0.5, ancrer: false };
    const montee = Math.max(0, Math.min(1, (c.vy + 4) / 12));
    return { pose: melanger(jeu.chute, jeu.saut, montee), lissage: 0.25, ancrer: false };
  }
  const souffle = Math.sin(t * 3.2) * jeu.souffle;
  const garde = ajouter(jeu.garde, { torse: [souffle * 0.6, 0, 0], tete: [-souffle * 0.4, 0, 0] }, souffle * 0.5);
  if (x.allure < 0.05) return { pose: garde, lissage: 0.22, ancrer: true };
  return { pose: melanger(garde, jeu.course(x.foulee), Math.min(1, x.allure * 1.6)), lissage: 0.35, ancrer: true };
}

/** Raccourci : une animation de coup par images clés. */
export const coup = (images: [number, Pose][]) => (f: number) => cles(images, f);
