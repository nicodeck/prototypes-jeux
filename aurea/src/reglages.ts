// Les réglages d'Aurea. On peut les modifier à la main : la page se recharge toute seule.
// Après une modification, `bun test` dit si la cité peut toujours grandir jusqu'au temple.

export const REGLAGES = {
  // --- Le temps ---
  /** Secondes réelles pour une heure de jeu, le jour et la nuit (à vitesse ×1) */
  secondesParHeureJour: 19,
  secondesParHeureNuit: 7,
  /** L'heure au lancement (6.2 = 6 h 12, juste avant le lever du soleil) */
  heureDepart: 6.2,

  // --- L'économie ---
  /** Ce qu'on a en arrivant sur l'île */
  depart: { denarii: 2400, bois: 30, marbre: 0, poisson: 16 },
  /** Ce que peut stocker le port, puis chaque entrepôt, pour chaque marchandise */
  stockPort: 60,
  stockEntrepot: 40,
  /** Vitesse des charrettes, en cases par seconde */
  vitesseCharrettes: 2.4,
  /** Durée d'un chantier, en secondes */
  chantierMaison: 3,
  chantierAtelier: 6,
  chantierGrand: 12,
  chantierTemple: 30,
  /** Secondes pendant lesquelles une maison doit être comblée avant de monter de niveau */
  attenteEvolution: 6,
  /** Multiplie tous les impôts */
  impots: 1,
  /** Ce qu'on récupère en démolissant (part du coût) */
  remboursement: 0.5,

  // --- L'image ---
  /** Taille des cartes d'ombre (par cascade) : 2048 est un bon compromis */
  ombres: 2048,
  /** Flou de maquette en haut et en bas de l'image (0 = aucun) */
  flouMaquette: 1,
  /** Rayons de soleil à travers les nuages et les arbres (0 = aucun) */
  rayons: 1,
  /** Halo des lumières */
  halo: 0.7,
  /** Résolution maximale (multiple de la taille de l'écran) ; elle baisse toute seule si l'image rame */
  resolutionMax: 2,
  /** Nombre maximal de passants dans les rues */
  passants: 420,
};
