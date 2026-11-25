// Les modèles 3D d'Aurea, entièrement générés en code et mis en cache.
//
// `modeleBatiment(type, palier, variante)` rend une géométrie fusionnée (position, normal,
// color, aMat), sa hauteur et ses émetteurs (fumée, vapeur, feu, torches, âne, fontaines), en
// coordonnées locales : emprise centrée sur l'origine, façade vers +z, sol à y = 0.
import type { Palier, TypeBatiment } from "../../ville/catalogue";
import { bucheron, boulangerie, carriere, cave, entrepot, ferme, moulin, oliveraie, peche, pressoir, vigne } from "./ateliers";
import { Chantier, alea } from "./formes";
import { construireMaison, nombreMaisons } from "./maisons";
import { archeAqueduc, castellum, forum, phare, port, temple, thermes } from "./monuments";
import type { Modele } from "./types";

export type { Emetteur, Modele, SorteEmetteur } from "./types";

type Constructeur = (ch: Chantier, hasard: () => number) => void;

const AUTRES: Record<Exclude<TypeBatiment, "maison">, Constructeur[]> = {
  entrepot: [entrepot],
  peche: [peche],
  bucheron: [bucheron],
  ferme: [ferme],
  moulin: [moulin],
  boulangerie: [boulangerie],
  oliveraie: [oliveraie],
  pressoir: [pressoir],
  vigne: [vigne],
  cave: [cave],
  carriere: [carriere],
  forum: [forum],
  thermes: [thermes],
  temple: [temple],
  port: [port],
  phare: [phare],
};

const cache = new Map<string, Modele>();

function enCache(cle: string, fabriquer: () => Modele): Modele {
  let m = cache.get(cle);
  if (!m) {
    m = fabriquer();
    cache.set(cle, m);
  }
  return m;
}

/** Le nombre de variantes d'un type (le palier ne compte que pour les maisons). */
export function nombreVariantes(type: TypeBatiment, palier: Palier): number {
  if (type === "maison") return nombreMaisons(palier);
  return AUTRES[type].length;
}

export function modeleBatiment(type: TypeBatiment, palier: Palier, variante: number): Modele {
  const n = nombreVariantes(type, palier);
  const v = ((variante % n) + n) % n;
  const p = type === "maison" ? palier : 0;
  return enCache(`${type}/${p}/${v}`, () => {
    const ch = new Chantier();
    const hasard = alea(1 + v * 7919 + p * 104729 + type.length * 31 + type.charCodeAt(0) * 977);
    if (type === "maison") construireMaison(ch, p, v, hasard);
    else AUTRES[type][v]!(ch, hasard);
    return ch.fin();
  });
}

/** Un tronçon d'aqueduc d'une case le long de x ; la hauteur est arrondie au dixième pour le cache. */
export function modeleArcheAqueduc(hauteur: number): Modele {
  const h = Math.round(Math.max(1.2, Math.min(8, hauteur)) * 10) / 10;
  return enCache(`aqueduc/${h}`, () => {
    const ch = new Chantier();
    archeAqueduc(ch, h);
    return ch.fin();
  });
}

export function modeleCastellum(): Modele {
  return enCache("castellum", () => {
    const ch = new Chantier();
    castellum(ch);
    return ch.fin();
  });
}

/** Le nombre de triangles d'un modèle (pour l'atelier et les budgets). */
export function triangles(m: Modele): number {
  return m.geometrie.getAttribute("position").count / 3;
}
