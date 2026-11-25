// Les couleurs de chaque section, et le fondu de l'une à l'autre.

import { hexVersRvb, lisse, melangerRvb, type RVB } from "../outils";
import type { Partition } from "../partition";

export interface Palette {
  cielHaut: RVB;
  cielBas: RVB;
  /** Lueur de l'horizon, derrière l'Arbre-Cœur. */
  horizon: RVB;
  brume: RVB;
  /** Silhouettes, du plus lointain au plus proche. */
  loin: RVB;
  milieu: RVB;
  proche: RVB;
  sol: RVB;
  /** Lueurs des plantes et champignons. */
  lueurs: [RVB, RVB, RVB];
  lucioles: RVB;
  /** Couleur de la traînée du coureur. */
  trainee: RVB;
}

function p(o: { [K in keyof Palette]: K extends "lueurs" ? [string, string, string] : string }): Palette {
  return {
    cielHaut: hexVersRvb(o.cielHaut),
    cielBas: hexVersRvb(o.cielBas),
    horizon: hexVersRvb(o.horizon),
    brume: hexVersRvb(o.brume),
    loin: hexVersRvb(o.loin),
    milieu: hexVersRvb(o.milieu),
    proche: hexVersRvb(o.proche),
    sol: hexVersRvb(o.sol),
    lueurs: [hexVersRvb(o.lueurs[0]), hexVersRvb(o.lueurs[1]), hexVersRvb(o.lueurs[2])],
    lucioles: hexVersRvb(o.lucioles),
    trainee: hexVersRvb(o.trainee),
  };
}

export const PALETTES: Palette[] = [
  // Sous-bois : vert d'eau et turquoise
  p({
    cielHaut: "#02050f",
    cielBas: "#0a2a3a",
    horizon: "#2fd6b0",
    brume: "#18706f",
    loin: "#0c3442",
    milieu: "#07202b",
    proche: "#03101a",
    sol: "#020a10",
    lueurs: ["#3dffc4", "#7ae8ff", "#c6ff6a"],
    lucioles: "#e2ff8f",
    trainee: "#56ffd9",
  }),
  // Marais des spores : violet et rose
  p({
    cielHaut: "#07031a",
    cielBas: "#220a3a",
    horizon: "#d04cff",
    brume: "#5e2a8c",
    loin: "#2a1250",
    milieu: "#170a32",
    proche: "#0b0520",
    sol: "#060212",
    lueurs: ["#ff6ad8", "#a98bff", "#5fe7ff"],
    lucioles: "#ffc2f4",
    trainee: "#ff7ae0",
  }),
  // Canopée : ambre, orange et vert de jade
  p({
    cielHaut: "#060a1c",
    cielBas: "#3d1f2e",
    horizon: "#ffb35c",
    brume: "#b0603a",
    loin: "#3a2030",
    milieu: "#211322",
    proche: "#100a14",
    sol: "#08050a",
    lueurs: ["#ffd25f", "#ff8d4a", "#5fffc8"],
    lucioles: "#fff0b0",
    trainee: "#ffcf6a",
  }),
  // Le Cœur : carmin, rose et blanc
  p({
    cielHaut: "#0f0210",
    cielBas: "#340720",
    horizon: "#ff3d6e",
    brume: "#6e1a3c",
    loin: "#3a0b26",
    milieu: "#2a0620",
    proche: "#150310",
    sol: "#0a0208",
    lueurs: ["#ff4a7a", "#ff9cc4", "#ffa24a"],
    lucioles: "#ffffff",
    trainee: "#ff6a9a",
  }),
];

export function melangerPalettes(a: Palette, b: Palette, t: number): Palette {
  const m = (k: Exclude<keyof Palette, "lueurs">) => melangerRvb(a[k], b[k], t);
  return {
    cielHaut: m("cielHaut"),
    cielBas: m("cielBas"),
    horizon: m("horizon"),
    brume: m("brume"),
    loin: m("loin"),
    milieu: m("milieu"),
    proche: m("proche"),
    sol: m("sol"),
    lueurs: [melangerRvb(a.lueurs[0], b.lueurs[0], t), melangerRvb(a.lueurs[1], b.lueurs[1], t), melangerRvb(a.lueurs[2], b.lueurs[2], t)],
    lucioles: m("lucioles"),
    trainee: m("trainee"),
  };
}

/**
 * Palette à l'instant `temps` (en temps musicaux) : le fondu commence au début de la mesure de remplissage
 * et finit au premier temps de la section suivante. Renvoie aussi la section « visuelle » (fractionnaire).
 */
export function paletteAuTemps(partition: Partition, temps: number): { palette: Palette; section: number } {
  const debuts = partition.debutsSections;
  let s = 0;
  for (let i = 0; i < debuts.length; i++) if (temps >= debuts[i].temps - 4) s = i;
  if (s === 0) return { palette: PALETTES[0], section: 0 };
  const debut = debuts[s].temps;
  const f = lisse(Math.max(0, Math.min(1, (temps - (debut - 4)) / 5)));
  return { palette: melangerPalettes(PALETTES[s - 1], PALETTES[s], f), section: s - 1 + f };
}
