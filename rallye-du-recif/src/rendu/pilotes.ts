// Les pilotes en 3D, et les couleurs des huit karts.
import type { NomPilote } from "../course/pilotes";
import type { Pantin } from "./pantin";
import { COULEURS_GANZO, construireGanzo } from "./persos/ganzo";
import { COULEURS_MIRA, construireMira, VARIANTE_MIRA } from "./persos/mira";
import { COULEURS_RIN, construireRin } from "./persos/rin";
import { COULEURS_TAO, construireTao, VARIANTE_TAO } from "./persos/tao";

/** Les couleurs de rechange, quand un pilote court deux fois. */
const VARIANTE_RIN = { ...COULEURS_RIN, cheveux: "#e8e6f2", cheveuxOmbre: "#8b86b5", echarpe: "#2b6fe0", echarpeOmbre: "#1a2f80", ceinture: "#e3202e", chaussures: "#3fa66a" };
const VARIANTE_GANZO = { ...COULEURS_GANZO, gilet: "#6b3d8f", giletOmbre: "#2c1846", pantalon: "#3a3446", pantalonOmbre: "#1d1a26", ceinture: "#e3a72f", bandeau: "#2b2b33" };

export function fabriquerPilote(nom: NomPilote, variante = false): Pantin {
  if (nom === "rin") return construireRin(variante ? VARIANTE_RIN : COULEURS_RIN);
  if (nom === "tao") return construireTao(variante ? VARIANTE_TAO : COULEURS_TAO);
  if (nom === "mira") return construireMira(variante ? VARIANTE_MIRA : COULEURS_MIRA);
  return construireGanzo(variante ? VARIANTE_GANZO : COULEURS_GANZO);
}

/** Deux couleurs de kart par pilote : la sienne, puis celle de sa variante. */
export const COULEURS_KARTS = ["#e8322f", "#2f6fe8", "#ff8a1f", "#7a4fd6", "#1fb6a6", "#f2c21b", "#3f9a3a", "#e8559a"];

export function couleurKart(nom: NomPilote, variante: boolean) {
  const i = ["rin", "tao", "mira", "ganzo"].indexOf(nom);
  return COULEURS_KARTS[i * 2 + (variante ? 1 : 0)];
}
