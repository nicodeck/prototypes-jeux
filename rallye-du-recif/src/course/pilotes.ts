// Les quatre pilotes. Les valeurs sont des multiplicateurs autour de 1 : un petit écart
// se sent déjà beaucoup sur un tour.

export type NomPilote = "rin" | "tao" | "mira" | "ganzo";

export interface Pilote {
  nom: string;
  surnom: string;
  description: string;
  /** Vitesse de pointe. */
  vitesse: number;
  acceleration: number;
  /** Braquage. */
  maniabilite: number;
  /** Le poids : qui pousse qui quand deux karts se touchent. */
  poids: number;
  /** La vitesse à laquelle les mini-turbos se chargent pendant un dérapage. */
  derive: number;
}

export const PILOTES: Record<NomPilote, Pilote> = {
  rin: {
    nom: "Rin",
    surnom: "la Bourrasque",
    description: "Légère et vive : elle démarre en flèche et tourne serré, mais on la bouscule facilement.",
    vitesse: 0.975,
    acceleration: 1.2,
    maniabilite: 1.12,
    poids: 0.7,
    derive: 1,
  },
  tao: {
    nom: "Tao",
    surnom: "le Mécano",
    description: "Équilibré en tout. Un kart réglé aux petits oignons, facile à prendre en main.",
    vitesse: 0.985,
    acceleration: 1.0,
    maniabilite: 1.0,
    poids: 1.0,
    derive: 1,
  },
  mira: {
    nom: "Mira",
    surnom: "la Plongeuse",
    description: "Une pilote technique : ses dérapages chargent les mini-turbos bien plus vite.",
    vitesse: 0.975,
    acceleration: 1.05,
    maniabilite: 1.04,
    poids: 0.85,
    derive: 1.25,
  },
  ganzo: {
    nom: "Ganzo",
    surnom: "le Roc",
    description: "Lourd et lent à lancer, mais le plus rapide en ligne droite. Personne ne le pousse.",
    vitesse: 1.005,
    acceleration: 0.8,
    maniabilite: 0.9,
    poids: 1.5,
    derive: 0.95,
  },
};

export const LISTE_PILOTES: NomPilote[] = ["rin", "tao", "mira", "ganzo"];
