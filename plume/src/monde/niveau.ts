// Lire un niveau écrit en texte : une lettre par case de 16 × 16 pixels.

export const T = 16;

/** Ce que peut contenir une case de la grille. */
export const CASE = {
  vide: 0,
  sol: 1, // terre et herbe
  pierre: 2, // bloc dur
  brique: 3, // se casse d'un coup de tête
  mystere: 4, // donne quelque chose d'un coup de tête
  utilise: 5, // un bloc mystère déjà frappé
  passerelle: 6, // se traverse par en dessous ; ↓ pour descendre
  pics: 7,
} as const;

export type Case = (typeof CASE)[keyof typeof CASE];

export const LEGENDE: Record<string, string> = {
  "#": "sol",
  "=": "bloc de pierre",
  B: "brique",
  "?": "bloc mystère avec une graine",
  P: "bloc mystère avec une plume (double saut)",
  "-": "passerelle",
  "^": "pics",
  o: "graine",
  O: "œuf d'or (il y en a trois, cachés)",
  S: "départ",
  F: "drapeau de reprise",
  G: "le nid d'arrivée",
  l: "limace",
  b: "bogue (ne pas sauter dessus)",
  g: "grenouille",
  w: "guêpe",
  R: "ressort",
  h: "plateforme qui va et vient",
  v: "plateforme qui monte et descend",
  c: "nuage qui se dissipe quand on marche dessus",
  i: "panneau",
  "*": "fleur",
  ",": "touffe d'herbe",
  "%": "buisson",
};

export type Apparition = { lettre: string; colonne: number; ligne: number };

export type NiveauLu = {
  largeur: number;
  hauteur: number;
  cases: Uint8Array;
  contenus: Map<number, "graine" | "plume">;
  apparitions: Apparition[];
  panneaux: { colonne: number; ligne: number; texte: string }[];
};

export type Niveau = { nom: string; panneaux: string[]; carte: string[] };

export function lireNiveau(niveau: Niveau): NiveauLu {
  const hauteur = niveau.carte.length;
  const largeur = Math.max(...niveau.carte.map((l) => l.length));
  const cases = new Uint8Array(largeur * hauteur);
  const contenus = new Map<number, "graine" | "plume">();
  const apparitions: Apparition[] = [];
  const panneaux: NiveauLu["panneaux"] = [];
  for (let ligne = 0; ligne < hauteur; ligne++) {
    for (let colonne = 0; colonne < largeur; colonne++) {
      const lettre = niveau.carte[ligne][colonne] ?? " ";
      const i = ligne * largeur + colonne;
      switch (lettre) {
        case "#": cases[i] = CASE.sol; break;
        case "=": cases[i] = CASE.pierre; break;
        case "B": cases[i] = CASE.brique; break;
        case "?": cases[i] = CASE.mystere; contenus.set(i, "graine"); break;
        case "P": cases[i] = CASE.mystere; contenus.set(i, "plume"); break;
        case "-": cases[i] = CASE.passerelle; break;
        case "^": cases[i] = CASE.pics; break;
        case "i": panneaux.push({ colonne, ligne, texte: niveau.panneaux[panneaux.length] ?? "" }); break;
        case " ": break;
        default:
          if (!(lettre in LEGENDE)) throw new Error(`Lettre inconnue « ${lettre} » en colonne ${colonne}, ligne ${ligne}`);
          apparitions.push({ lettre, colonne, ligne });
      }
    }
  }
  return { largeur, hauteur, cases, contenus, apparitions, panneaux };
}
