// Le jugement d'un appui : on compare l'instant de l'appui à l'instant exact de l'obstacle.

import { REGLAGES } from "./reglages";

export type Jugement = "parfait" | "bien" | "rate";

/**
 * `ecart` = instant de l'appui − instant de l'obstacle (négatif : trop tôt).
 * Renvoie `null` si l'appui est trop loin de l'obstacle pour le concerner.
 */
export function juger(ecart: number, f = REGLAGES.fenetres): Jugement | null {
  const a = Math.abs(ecart);
  if (a <= f.parfait) return "parfait";
  if (a <= f.bien) return "bien";
  if (ecart < 0 && a <= f.tropTot) return "rate";
  return null;
}

/** Note finale à partir de la précision (parfait = 1, bien = 0,6, raté = 0). */
export function precision(parfaits: number, biens: number, rates: number): number {
  const total = parfaits + biens + rates;
  return total === 0 ? 0 : (parfaits + biens * 0.6) / total;
}

export function lettre(p: number): string {
  for (const n of REGLAGES.notes) if (p >= n.min) return n.lettre;
  return "D";
}

/** Multiplicateur de score : un cran tous les N coups réussis d'affilée. */
export function multiplicateur(combo: number): number {
  const { comboParCran, multiplicateurMax } = REGLAGES.points;
  return Math.min(multiplicateurMax, 1 + Math.floor(combo / comboParCran));
}
