// Tous les réglages du jeu au même endroit : on peut les modifier sans fouiller le code.
// Les durées sont en secondes, les distances en pixels « logiques » (l'écran fait 720 de haut).

export const REGLAGES = {
  ecran: {
    hauteur: 720,
    largeurMin: 1100,
    largeurMax: 1600,
    /** Plafond de la densité de pixels : au-delà, on dessine trop pour rien. */
    densiteMax: 1.5,
  },

  monde: {
    /** Position horizontale du coureur, en fraction de la largeur. */
    xCoureur: 0.27,
    /** Hauteur du sol. */
    ySol: 560,
    /** Distance parcourue pendant un temps : le défilement accélère quand le tempo monte. */
    pixelsParTemps: 250,
  },

  /** Fenêtres de jugement, en demi-largeur autour du temps exact. */
  fenetres: {
    parfait: 0.05,
    bien: 0.11,
    /** Un appui plus tôt que « bien » mais dans cette fenêtre compte comme raté (on ne peut pas tout marteler). */
    tropTot: 0.19,
  },

  points: {
    parfait: 300,
    bien: 120,
    /** Le multiplicateur monte d'un cran tous les N coups réussis d'affilée. */
    comboParCran: 12,
    multiplicateurMax: 4,
  },

  /** La jauge de pouls : si elle tombe à zéro, la partie s'arrête. */
  vie: { max: 100, rate: -13, bien: 2, parfait: 4 },

  /**
   * L'élan fait vivre la musique : il monte à chaque réussite et retombe à chaque raté.
   * Chaque palier franchi ouvre une couche (rythme, arpège, mélodie, éclat).
   */
  elan: {
    parfait: 1,
    bien: 0.6,
    /** Fraction de l'élan conservée après un raté. */
    conserveApresRate: 0.35,
    paliers: [3, 9, 18, 30],
  },

  coureur: {
    /** Durées des gestes, en temps musicaux (elles suivent donc le tempo). */
    sautTemps: 0.8,
    hauteurSaut: 150,
    glisseTemps: 0.65,
    frappeSecondes: 0.2,
  },

  audio: {
    /** L'ordonnanceur se réveille toutes les 25 ms et programme ce qui tombe dans les 150 ms suivantes. */
    periode: 0.025,
    avance: 0.15,
    /** Délai entre « Espace » et le premier temps. */
    attenteDepart: 0.6,
    volume: 0.8,
  },

  /** Calibration de la latence : décalage ajouté au moment de chaque appui. */
  latence: {
    pas: 0.005,
    min: -0.25,
    max: 0.25,
    tapesIgnorees: 4,
    tapesMesurees: 12,
    bpm: 100,
  },

  /** Seuils de note sur la précision (parfait = 1, bien = 0,6). */
  notes: [
    { lettre: "S", min: 0.95 },
    { lettre: "A", min: 0.85 },
    { lettre: "B", min: 0.72 },
    { lettre: "C", min: 0.55 },
    { lettre: "D", min: 0 },
  ],

  couleursActions: {
    saut: "#5cf2ff",
    frappe: "#ff4f8b",
    glisse: "#ffd24a",
  },
} as const;

export type Action = "saut" | "frappe" | "glisse";
