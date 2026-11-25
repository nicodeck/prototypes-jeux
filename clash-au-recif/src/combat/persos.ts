// Les deux combattants : leurs mesures, leurs déplacements et leurs coups.
// Unités : 1 = environ 1 mètre ; vitesses en unités par seconde ; durées en images (60 par seconde).
// Les angles d'éjection sont en degrés : 0 = droit devant, 90 = vers le haut, négatif = vers le bas.

export type NomPerso = "rin" | "ganzo";
export type Effet = "leger" | "lourd" | "tranchant";

export interface Frappe {
  debut: number;
  fin: number;
  /** Position du centre de la frappe, devant (x) et au-dessus des pieds (y). */
  x: number;
  y: number;
  rayon: number;
  degats: number;
  angle: number;
  /** Éjection de base, puis ce qui s'ajoute pour 100 % de dégâts. */
  base: number;
  croissance: number;
  effet: Effet;
}

export interface Coup {
  nom: string;
  duree: number;
  frappes: Frappe[];
  /** Un élan pendant le coup (vitesse imposée). */
  elan?: { debut: number; fin: number; vx: number; vy?: number };
  /** Le coup suivant d'un enchaînement, si on appuie à nouveau à partir de l'image `des`. */
  suite?: { coup: string; des: number };
  /** Retard à l'atterrissage pendant un coup aérien. */
  atterrissage?: number;
  /** Charge en gardant le bouton appuyé : on reste figé à l'image `debut`, au plus `max` images. */
  charge?: { debut: number; max: number; degats: number; ejection: number };
  /** Encaisse les coups sans être éjecté pendant ces images. */
  armure?: { debut: number; fin: number };
  /** Coup aérien utilisable une seule fois par saut : donne aussi de la hauteur. */
  remontee?: { image: number; vy: number };
}

export interface Perso {
  nom: string;
  surnom: string;
  largeur: number;
  hauteur: number;
  marche: number;
  accelSol: number;
  accelAir: number;
  vitesseAir: number;
  gravite: number;
  chuteMax: number;
  chuteRapide: number;
  saut: number;
  sautAir: number;
  sautsAir: number;
  /** Multiplie l'éjection reçue : plus c'est haut, plus on vole loin. */
  ejection: number;
  coups: {
    sol: Coup;
    air: Coup;
    special: Coup;
    specialAir: Coup;
    [nom: string]: Coup;
  };
}

const frappe = (f: Partial<Frappe> & Pick<Frappe, "debut" | "fin" | "x" | "y" | "rayon" | "degats">): Frappe => ({
  angle: 40,
  base: 6,
  croissance: 10,
  effet: "leger",
  ...f,
});

const RIN: Perso = {
  nom: "Rin",
  surnom: "la Bourrasque",
  largeur: 0.7,
  hauteur: 1.75,
  marche: 7.5,
  accelSol: 70,
  accelAir: 40,
  vitesseAir: 6.2,
  gravite: 48,
  chuteMax: 13,
  chuteRapide: 20,
  saut: 16.5,
  sautAir: 14.5,
  sautsAir: 2,
  ejection: 1.2,
  coups: {
    sol: {
      nom: "poing",
      duree: 16,
      frappes: [frappe({ debut: 3, fin: 4, x: 0.75, y: 1.2, rayon: 0.45, degats: 3, angle: 20, base: 4, croissance: 4 })],
      suite: { coup: "poing2", des: 6 },
    },
    poing2: {
      nom: "poing2",
      duree: 16,
      frappes: [frappe({ debut: 3, fin: 4, x: 0.8, y: 1.15, rayon: 0.45, degats: 3, angle: 20, base: 4, croissance: 4 })],
      suite: { coup: "tornade", des: 6 },
    },
    tornade: {
      nom: "tornade",
      duree: 28,
      frappes: [
        frappe({ debut: 5, fin: 8, x: 0.95, y: 0.95, rayon: 0.65, degats: 6, angle: 40, base: 9, croissance: 24, effet: "lourd" }),
      ],
      elan: { debut: 3, fin: 8, vx: 4 },
    },
    air: {
      nom: "vrille",
      duree: 26,
      frappes: [frappe({ debut: 5, fin: 12, x: 0.15, y: 0.9, rayon: 0.95, degats: 7, angle: 50, base: 8, croissance: 20 })],
      atterrissage: 6,
    },
    special: {
      nom: "lame",
      duree: 34,
      frappes: [
        frappe({ debut: 7, fin: 19, x: 0.5, y: 0.9, rayon: 0.75, degats: 9, angle: 32, base: 10, croissance: 26, effet: "tranchant" }),
      ],
      elan: { debut: 7, fin: 19, vx: 22, vy: 0 },
    },
    specialAir: {
      nom: "lame",
      duree: 34,
      frappes: [
        frappe({ debut: 7, fin: 19, x: 0.5, y: 0.9, rayon: 0.75, degats: 9, angle: 32, base: 10, croissance: 26, effet: "tranchant" }),
      ],
      elan: { debut: 7, fin: 19, vx: 16, vy: 10 },
      remontee: { image: 0, vy: 0 },
      atterrissage: 8,
    },
  },
};

const GANZO: Perso = {
  nom: "Ganzo",
  surnom: "le Roc",
  largeur: 1.1,
  hauteur: 2.35,
  marche: 5.6,
  accelSol: 45,
  accelAir: 26,
  vitesseAir: 5.2,
  gravite: 55,
  chuteMax: 15,
  chuteRapide: 22,
  saut: 17.5,
  sautAir: 16,
  sautsAir: 1,
  ejection: 0.78,
  coups: {
    sol: {
      nom: "crochet",
      duree: 36,
      frappes: [
        frappe({ debut: 9, fin: 12, x: 1.2, y: 1.45, rayon: 0.75, degats: 13, angle: 38, base: 10, croissance: 28, effet: "lourd" }),
      ],
      elan: { debut: 7, fin: 11, vx: 3 },
      armure: { debut: 1, fin: 9 },
    },
    air: {
      nom: "marteau",
      duree: 38,
      frappes: [
        // Les poings montent au-dessus de la tête (ça touche déjà), puis s'abattent vers le bas.
        frappe({ debut: 6, fin: 9, x: 0.5, y: 2.3, rayon: 0.8, degats: 8, angle: 75, base: 8, croissance: 16 }),
        frappe({ debut: 11, fin: 15, x: 0.95, y: 0.4, rayon: 0.85, degats: 13, angle: -75, base: 9, croissance: 18, effet: "lourd" }),
      ],
      atterrissage: 12,
    },
    special: {
      nom: "canon",
      duree: 40,
      frappes: [
        frappe({ debut: 14, fin: 17, x: 1.35, y: 1.35, rayon: 0.85, degats: 15, angle: 35, base: 12, croissance: 28, effet: "lourd" }),
      ],
      elan: { debut: 12, fin: 17, vx: 9 },
      charge: { debut: 8, max: 60, degats: 0.7, ejection: 0.35 },
      armure: { debut: 6, fin: 14 },
    },
    specialAir: {
      nom: "canon",
      duree: 40,
      frappes: [
        frappe({ debut: 9, fin: 13, x: 1.1, y: 1.6, rayon: 0.85, degats: 12, angle: 55, base: 10, croissance: 24, effet: "lourd" }),
      ],
      elan: { debut: 4, fin: 13, vx: 6 },
      remontee: { image: 4, vy: 19 },
      atterrissage: 14,
    },
  },
};

export const PERSOS: Record<NomPerso, Perso> = { rin: RIN, ganzo: GANZO };

/** Les règles communes. */
export const REGLES = {
  vies: 3,
  /** Freinage au sol, quand on ne pousse pas le stick. */
  frottement: 55,
  /** Une éjection de cette force ou plus fait tournoyer (on ne contrôle plus rien). */
  seuilTournoie: 18,
  /** La vitesse d'éjection perd cette part à chaque image. */
  amortiEjection: 0.045,
  /** Bouclier : usure par image tenue, regain par image, perte par point de dégât encaissé. */
  bouclierUsure: 0.0015,
  bouclierRegain: 0.004,
  bouclierParDegat: 0.03,
  /** Images d'invincibilité après la réapparition. */
  invincibilite: 100,
};
