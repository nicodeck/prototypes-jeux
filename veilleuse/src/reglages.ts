// Les réglages du mouvement, en pixels et en images (60 par seconde). Une case fait 16 pixels.
// Après une modification, `bun test` dit si toute la mine est encore praticable.

export const REGLAGES = {
  /** Vitesse de marche (pixels par image) */
  vitesse: 2.0,
  /** Accélération au sol et en l'air : plus c'est grand, plus Veilleuse répond sec */
  accelSol: 0.45,
  accelAir: 0.3,
  gravite: 0.38,
  chuteMax: 7,
  /** Vitesse de départ d'un saut : environ 4 cases et demie de haut en gardant la touche */
  saut: 7.4,
  /** En lâchant la touche pendant la montée, la vitesse est multipliée par ce nombre */
  coupeSaut: 0.4,
  /** Images pendant lesquelles on peut encore sauter après avoir quitté un bord */
  coyote: 6,
  /** Images pendant lesquelles un appui trop tôt est gardé en mémoire */
  tampon: 6,

  /** Vitesse de glissade contre une paroi, en appuyant vers elle */
  glisseMur: 1.6,
  sautMural: 6.8,
  pousseeMurale: 2.6,
  /** Images pendant lesquelles un saut mural repousse, avant qu'on reprenne la main */
  verrouMural: 8,

  nage: {
    vitesse: 1.3,
    accel: 0.1,
    gravite: 0.05,
    /** Poussée vers le haut quand la tête est sous l'eau */
    flottaison: 0.16,
    /** Coup de pied vers le haut, sous l'eau */
    brasse: 2.6,
    /** Saut pour sortir de l'eau, depuis la surface */
    sortie: 6.6,
    /** Poussée vers le fond en appuyant sur ↓ */
    plongee: 0.16,
    vitesseMaxY: 1.8,
  },
};
