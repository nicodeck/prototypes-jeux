// Ce que rend chaque modèle : une géométrie fusionnée, sa hauteur et ses points d'effets.
import type * as THREE from "three";

export type SorteEmetteur = "fumee" | "vapeur" | "feu" | "torche" | "ane" | "fontaine";

/** Un point d'où partent fumée, vapeur, feu, lumière de torche… en coordonnées locales du modèle. */
export interface Emetteur {
  sorte: SorteEmetteur;
  x: number;
  y: number;
  z: number;
}

export interface Modele {
  /** Attributs position, normal, color (linéaire) et aMat ; non indexée */
  geometrie: THREE.BufferGeometry;
  /** La hauteur maximale du modèle, pour le chantier qui monte du sol */
  hauteur: number;
  emetteurs: Emetteur[];
}
