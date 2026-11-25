// Les réglages du jeu. Les vitesses sont en pixels par image (le jeu tourne à 60 images par seconde).
// Une case fait 16 pixels. Change un nombre, sauvegarde : le jeu se recharge.

export const REGLAGES = {
  // Marcher et courir (touche de course : X ou Maj)
  marcheMax: 1.5,
  courseMax: 2.5,
  acceleration: 0.09,
  freinageSol: 0.14,
  freinageAir: 0.03,
  demiTour: 0.22, // freinage quand on change de sens

  // Sauter
  forceSaut: 7.1,
  graviteMontee: 0.32, // tant qu'on garde le bouton appuyé pendant la montée
  graviteChute: 0.75,
  monteeSiOnLache: 3.5, // si on lâche le bouton en montant, la montée est plafonnée à cette vitesse
  chuteMax: 5,
  toleranceBord: 5, // images pendant lesquelles on peut encore sauter après avoir quitté un bord
  memoireSaut: 5, // images pendant lesquelles un appui un peu trop tôt compte quand même
  forceDoubleSaut: 5.6,

  // Rebonds
  rebondEnnemi: 4,
  rebondEnnemiAppuye: 6.4,
  forceRessort: 9,

  // Coups
  invincibilite: 90,
};
