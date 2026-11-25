// Tous les réglages de gameplay au même endroit.
// Les distances sont en mètres, les durées en secondes, les angles en degrés sauf mention contraire.

export const REGLAGES = {
  bateau: {
    vitesseMax: 14, // vitesse au meilleur cap, vent nominal, voile pleine
    acceleration: 0.55, // fraction de l'écart à la vitesse visée rattrapée par seconde
    freinageVentDebout: 1.6, // décélération quand on est face au vent (m/s²)
    reculVentDebout: 1.2, // le bateau recule un peu s'il reste face au vent
    virageMin: 0.42, // vitesse de rotation sans erre (rad/s)
    virageParVitesse: 0.045, // rotation supplémentaire par m/s de vitesse
    vitesseVoile: 0.7, // vitesse à laquelle on hisse ou affale la voile (fraction/s)
    angleMort: 38, // en dessous de cet angle au vent, la voile faseye
    meilleurAngle: 100, // angle au vent le plus rapide (travers / largue)
    rendementVentArriere: 0.72, // rendement plein vent arrière
    pousseeVagues: 2.2, // à quel point la pente des vagues pousse le bateau
    derive: 0.9, // le courant de tempête pousse le bateau sous le vent
    longueur: 7,
  },

  vent: {
    forceBase: 1, // multiplicateur de vitesse du vent nominal
    directionDepart: 200, // d'où vient le vent au départ (0 = nord, 90 = est)
    rotationAmplitude: 75, // le vent oscille de ± cet angle autour de sa direction moyenne
    rotationPeriode: 140, // durée d'une oscillation complète du vent
    rafaleIntervalle: [7, 16] as [number, number], // délai entre deux rafales
    rafaleDuree: [2.5, 5] as [number, number],
    rafaleForce: 0.45, // la rafale ajoute cette fraction à la force du vent
  },

  coque: {
    max: 100,
    degatsParVitesse: 2.6, // points de coque perdus par m/s au moment du choc
    degatsMin: 6,
    reparationAuPhare: 14, // points rendus par seconde dans la zone d'un phare allumé
    rebond: 0.55,
  },

  huile: {
    max: 100,
    consommation: 0.85, // par seconde quand la lanterne brûle
    remplissageAuPhare: 30, // par seconde dans la zone d'un phare allumé
    tonneau: 40, // un tonneau d'huile repêché
    seuilFaible: 25,
  },

  phares: {
    rayonAllumage: 34, // il faut approcher le pied du phare à cette distance
    dureeAllumage: 2.6,
    rayonZoneSure: 120, // la mer s'y calme, on y répare et on y fait le plein
    calmeZoneSure: 0.65, // fraction de houle retirée dans la zone sûre
    vitesseRotation: 0.55, // rad/s pour le faisceau
  },

  meteo: {
    eclairIntervalle: [5, 13] as [number, number],
    pluie: 1,
  },

  monde: {
    rayon: 820, // au-delà, la houle du large repousse le bateau
  },
};

export type Reglages = typeof REGLAGES;
