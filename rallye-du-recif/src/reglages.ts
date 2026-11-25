// Les réglages de la course. On peut les changer à la main : après un changement,
// `bun test` dit si les bots savent encore finir la course et si le dérapage paie toujours.
// Les distances sont en mètres, les durées en secondes.

export const REGLAGES = {
  /** Nombre de tours d'une course. */
  tours: 3,

  // ——— La conduite ———
  /** Vitesse de pointe sur la route, en m/s (25 m/s = 90 km/h). */
  vitesseMax: 25,
  /** Accélération au départ arrêté, en m/s². Elle diminue à l'approche de la vitesse de pointe. */
  acceleration: 15,
  /** Freinage, en m/s². */
  frein: 30,
  /** Vitesse en marche arrière. */
  recul: 7,
  /** Ralentissement quand on lâche l'accélérateur, en m/s². */
  roueLibre: 6,
  /** Vitesse de rotation du volant à petite vitesse, en radians par seconde. */
  virage: 2.3,
  /** Ce qu'on perd en braquage à pleine vitesse : 0,55 = on tourne 55 % moins vite. Le dérapage compense. */
  perteDeBraquage: 0.55,
  /** Le petit saut (pour lancer un dérapage), en m/s vers le haut. */
  saut: 5,
  gravite: 32,
  /** La vitesse de pointe selon le sol, par rapport à la route. */
  sols: { route: 1, planches: 1, herbe: 0.5, sable: 0.55 },

  // ——— Le dérapage ———
  derive: {
    /** Vitesse minimale pour déraper. */
    vitesseMin: 11,
    /** Rotation pendant le dérapage, en rad/s, quand on ne braque pas. */
    virage: 1.15,
    /** Ce qu'on ajoute en braquant vers l'intérieur (ou qu'on retire en braquant vers l'extérieur). */
    virageEnPlus: 0.75,
    /** Le kart glisse vers l'extérieur du virage, en m/s. */
    glisse: 1.8,
    /** Durées de dérapage pour atteindre les étincelles bleues, puis orange. */
    palier1: 0.7,
    palier2: 1.6,
    /** Durée du mini-turbo à la sortie, selon le palier. */
    turbo1: 0.6,
    turbo2: 1.15,
  },

  // ——— Les turbos ———
  turbo: {
    /** Vitesse de pointe pendant un turbo, par rapport à la normale. */
    vitesse: 1.3,
    /** Durées. */
    bande: 1.0,
    depart: 1.0,
    piment: 1.5,
  },

  // ——— Les objets ———
  objets: {
    /** Le temps que la roulette tourne avant qu'on puisse se servir de l'objet. */
    roulette: 1.0,
    /** Le temps avant qu'une perle réapparaisse. */
    retourPerle: 2.0,
    oursinVitesse: 42,
    oursinVie: 4,
    /** Le nombre maximal de méduses posées sur la piste. */
    medusesMax: 12,
    /** Durée de la bulle (elle éclate au premier coup reçu). */
    bulle: 10,
    /** Le temps qu'on reste sonné quand on est touché. */
    sonne: 1.1,
  },

  /** Le temps passé dans l'eau avant d'être replacé sur la piste. */
  chute: 1.3,
};
