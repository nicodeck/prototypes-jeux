// Ce que chaque module de dessin a besoin de savoir sur l'instant présent.

import type { Palette } from "./palette";

export interface Vue {
  /** Instant du morceau (secondes) et position musicale (temps). */
  t: number;
  temps: number;
  /** Secondes réelles écoulées depuis le lancement (animations d'ambiance, même en pause du morceau). */
  reel: number;
  W: number;
  H: number;
  ySol: number;
  xCoureur: number;
  pixelsParTemps: number;
  palette: Palette;
  /** Section visuelle, fractionnaire pendant les fondus. */
  section: number;
  /** Impulsion de la grosse caisse (1 au coup, retombe vite). */
  pouls: number;
  /** Impulsion du temps (1 sur chaque noire). */
  battement: number;
  /** Impulsion du premier temps de la mesure. */
  mesure: number;
  /** Avancement dans le morceau (0 à 1). */
  progression: number;
  /** Intensité musicale lissée (0 à 4). */
  intensite: number;
  bpm: number;
}

/** Position à l'écran d'un objet posé au temps `temps` sur le plan du coureur. */
export function xEcran(v: Vue, temps: number): number {
  return v.xCoureur + (temps - v.temps) * v.pixelsParTemps;
}
