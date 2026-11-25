// Lit les salles écrites en texte et les assemble en une seule mine.
import { SALLES, type SalleTexte } from "./carte";
import type { Zone } from "./zones";

export const CASE = 16;

export const VIDE = 0;
export const ROCHE = 1;
export const PLANCHE = 2;

export type Objet = { lettre: string; col: number; ligne: number };

export type Salle = {
  nom: string;
  zone: Zone;
  col: number;
  ligne: number;
  largeur: number;
  hauteur: number;
};

export type Mine = {
  largeur: number;
  hauteur: number;
  /** VIDE, ROCHE ou PLANCHE, ligne par ligne */
  cases: Uint8Array;
  /** 1 là où il y a de l'eau */
  eau: Uint8Array;
  salles: Salle[];
  /** Les lanternes, dans l'ordre de lecture des salles */
  lanternes: Objet[];
  cristaux: Objet[];
  /** Les décors : chaînes, étais, wagonnets, rais de lumière */
  decors: Objet[];
  coeur: Objet;
  depart: Objet;
};

const DECORS = new Set(["!", "|", "w", "R"]);

export function lireMine(salles: SalleTexte[] = SALLES): Mine {
  const largeur = Math.max(...salles.map((s) => s.col + s.largeur));
  const hauteur = Math.max(...salles.map((s) => s.ligne + s.carte.length));
  const cases = new Uint8Array(largeur * hauteur).fill(ROCHE);
  const eau = new Uint8Array(largeur * hauteur);
  const mine: Mine = {
    largeur,
    hauteur,
    cases,
    eau,
    salles: [],
    lanternes: [],
    cristaux: [],
    decors: [],
    coeur: { lettre: "C", col: 0, ligne: 0 },
    depart: { lettre: "H", col: 0, ligne: 0 },
  };
  let coeur = false;
  let depart = false;

  for (const s of salles) {
    mine.salles.push({ nom: s.nom, zone: s.zone, col: s.col, ligne: s.ligne, largeur: s.largeur, hauteur: s.carte.length });
    s.carte.forEach((texte, y) => {
      if (texte.length > s.largeur) throw new Error(`${s.nom}, ligne ${y} : ${texte.length} cases au lieu de ${s.largeur}`);
      const complete = texte.padEnd(s.largeur, "#");
      for (let x = 0; x < s.largeur; x++) {
        const lettre = complete[x];
        const col = s.col + x;
        const ligne = s.ligne + y;
        const i = ligne * largeur + col;
        const objet = { lettre, col, ligne };
        cases[i] = lettre === "#" ? ROCHE : lettre === "=" ? PLANCHE : VIDE;
        if (lettre === "~") eau[i] = 1;
        else if (lettre === "L") mine.lanternes.push(objet);
        else if (lettre === "*") mine.cristaux.push(objet);
        else if (lettre === "C") {
          mine.coeur = objet;
          coeur = true;
        } else if (lettre === "H") {
          mine.depart = objet;
          depart = true;
        } else if (DECORS.has(lettre)) mine.decors.push(objet);
        else if (lettre !== "#" && lettre !== "=" && lettre !== " ") throw new Error(`${s.nom} : lettre inconnue « ${lettre} »`);
      }
    });
  }
  if (!coeur) throw new Error("Il manque le Cœur (C)");
  if (!depart) throw new Error("Il manque le départ (H)");
  return mine;
}

export function caseEn(m: Mine, col: number, ligne: number) {
  if (col < 0 || ligne < 0 || col >= m.largeur || ligne >= m.hauteur) return ROCHE;
  return m.cases[ligne * m.largeur + col];
}

export function eauEn(m: Mine, col: number, ligne: number) {
  if (col < 0 || ligne < 0 || col >= m.largeur || ligne >= m.hauteur) return false;
  return m.eau[ligne * m.largeur + col] === 1;
}

/** La salle qui contient ce point (en pixels), ou -1. */
export function salleEn(m: Mine, x: number, y: number) {
  const col = Math.floor(x / CASE);
  const ligne = Math.floor(y / CASE);
  return m.salles.findIndex((s) => col >= s.col && col < s.col + s.largeur && ligne >= s.ligne && ligne < s.ligne + s.hauteur);
}
