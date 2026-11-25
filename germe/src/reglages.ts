// Les réglages du jeu, regroupés ici pour qu'on puisse les changer à la main.
// Les distances sont en mètres (la planète fait 16 m de rayon), les durées en secondes.

export const REGLAGES = {
  // ——— La planète ———
  planete: {
    /** Rayon de la planète. */
    rayon: 16,
    /** Finesse du maillage : 6 donne 40 962 sommets, espacés d'environ 30 cm. */
    finesse: 6,
    /** Amplitude du relief (collines et creux). */
    relief: 0.9,
    /** Graine du hasard : la même graine donne la même planète. */
    graine: 7,
  },

  // ——— La partie ———
  /** Part de la planète qui doit vivre pour gagner (0,85 = 85 %). */
  objectif: 0.85,
  /** Durée d'une journée complète (le soleil fait le tour de la planète). */
  dureeJour: 200,
  /** Heure au début de la partie, là où l'on apparaît (0 = minuit, 0,5 = midi). */
  heureDepart: 0.3,

  // ——— Le petit être ———
  joueur: {
    vitesse: 4.6,
    /** Vitesse en courant (Maj). */
    course: 7.4,
    /** Temps pour atteindre la vitesse voulue (plus petit = plus nerveux). */
    reactivite: 0.12,
    saut: 7.5,
    gravite: 20,
    /** Ralentissement dans l'eau profonde. */
    freinEau: 0.55,
    /** Distance à laquelle on ramasse une graine. */
    ramassage: 1.3,
    /** Rayon du trou creusé autour de soi. */
    rayonPelle: 0.85,
    /** Vitesse à laquelle on creuse, en mètres par seconde. */
    vitessePelle: 0.9,
    /** Profondeur maximale d'une rigole, sous le sol d'origine. */
    profondeurMax: 0.75,
    /** Graines en poche au départ. */
    grainesDepart: 1,
  },

  // ——— L'eau ———
  eau: {
    /** Pas de simulation de l'eau, par seconde. */
    pasParSeconde: 30,
    /** Fraction de la différence de niveau qui s'écoule à chaque pas, par voisin. */
    ecoulement: 0.13,
    /** Hauteur d'eau ajoutée par seconde au cœur d'une source. */
    debitSource: 3.4,
    /** Évaporation : une part fixe, plus une part proportionnelle à la profondeur. */
    evaporation: 0.0015,
    evaporationProfonde: 0.004,
    /** Hauteur d'eau à partir de laquelle un sommet compte comme mouillé. */
    seuilMouille: 0.012,
  },

  // ——— L'humidité, l'herbe ———
  vie: {
    /** Pas de simulation de la vie, par seconde. */
    pasParSeconde: 10,
    /** Distance jusqu'où l'eau humidifie le sol. */
    porteeEau: 3.2,
    /** Humidité minimale pour que l'herbe pousse ou qu'une graine germe. */
    seuilHumide: 0.25,
    /** Vitesse de pousse de l'herbe (par seconde, en plein jour, sol bien humide). */
    pousseHerbe: 0.45,
    /** Séchage du sol quand l'eau s'en va, par seconde. */
    sechage: 0.05,
    /** Pousse la nuit, par rapport au jour. */
    pousseNuit: 0.3,
    /** Le gel des nuits froides : perte de vie par seconde de l'herbe sèche, loin des arbres et de l'eau. */
    gel: 0.012,
  },

  // ——— Les arbres ———
  arbres: {
    /** Durée pour qu'un arbre atteigne sa taille adulte, en plein jour, sol humide. */
    dureePousse: 40,
    /** Rayon que l'arbre adulte humidifie et protège. */
    rayonAdulte: 7.2,
    /** Rayon d'une jeune pousse. */
    rayonPousse: 1.6,
    /** Un arbre adulte lâche une graine toutes les… (en secondes, avec du hasard). */
    intervalleGraine: 30,
    /** Chance qu'une graine tombée germe seule (sinon elle reste au sol, à ramasser). */
    chanceSemisSeul: 0.55,
    /** Nombre maximal d'arbres sur la planète. */
    maximum: 90,
  },

  // ——— Les sources ———
  sources: {
    /** Nombre de sources endormies à réveiller (en plus de la première). */
    endormies: 3,
    /** Graines éparpillées sur la planète au départ. */
    grainesEparpillees: 11,
  },

  // ——— Les vents de cendre ———
  cendre: {
    /** Premier vent, après le début de la partie. */
    premier: 150,
    /** Intervalle entre deux vents (avec du hasard en plus). */
    intervalle: 80,
    /** Durée d'un vent. */
    duree: 22,
    /** Rayon du front de cendre. */
    rayon: 7,
    /** Vitesse du front, en mètres par seconde. */
    vitesse: 1.6,
    /** Perte de vie par seconde de l'herbe non protégée. */
    degat: 0.14,
    /** Assèchement du sol, par seconde. */
    assechement: 0.45,
  },

  // ——— Le souffle (touche C) ———
  souffle: {
    rayon: 6,
    recharge: 7,
    /** Coup de pouce à la pousse autour de soi. */
    elan: 0.35,
  },
};

export type Reglages = typeof REGLAGES;
