// L'ambiance du moment : à partir de l'heure et du temps qu'il fait, la course du soleil et de la
// lune, la couleur et la force de la lumière, la brume, l'exposition et l'étalonnage de l'image.
import * as THREE from "three";
import type { EtatCiel } from "../ville/temps";
import { COUCHER, LEVER } from "../ville/temps";
import { ATMO } from "./atmosphere";
import { transmittanceSoleil, type Ciel } from "./ciel";
import type { Post } from "./post";

const ELEVATION_MAX = THREE.MathUtils.degToRad(56);

export function directionSoleil(h: number, cible = new THREE.Vector3()) {
  const a = ((h - LEVER) / (COUCHER - LEVER)) * Math.PI;
  return cible.set(Math.cos(a), Math.sin(a) * Math.sin(ELEVATION_MAX), Math.sin(a) * Math.cos(ELEVATION_MAX) - 0.22).normalize();
}

export function directionLune(soleil: THREE.Vector3, cible = new THREE.Vector3()) {
  return cible.set(-soleil.x, -soleil.y * 0.92 + 0.12, -soleil.z * 0.5 + 0.35).normalize();
}

const lisse = (a: number, b: number, v: number) => THREE.MathUtils.smoothstep(v, a, b);
const melange = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

/** La part des fenêtres allumées selon l'heure */
export function lampes(h: number, sombre: number) {
  let v = 0;
  if (h >= 18 && h < 21) v = lisse(18.3, 20.6, h) * 0.85;
  else if (h >= 21 && h < 24) v = 0.85 - lisse(22.5, 24, h) * 0.35;
  else if (h < 4.5) v = 0.5 - lisse(0, 4.5, h) * 0.15;
  else if (h < 7) v = 0.35 * (1 - lisse(5, 6.8, h));
  return Math.max(v, sombre * 0.3);
}

export interface Ambiance {
  soleil: THREE.Vector3;
  lune: THREE.Vector3;
  /** La direction de la lumière principale (soleil, ou lune la nuit) */
  lumiere: THREE.Vector3;
  couleur: THREE.Color;
  intensite: number;
  nuit: number;
  /** 0 à 1 : la lumière rasante et dorée du matin et du soir */
  dore: number;
}

export class Ambiances {
  private mouille = 0;
  private pluieMax = 0;
  private arc = 0;
  private angleVent = 0.4;
  readonly etat: Ambiance = {
    soleil: new THREE.Vector3(),
    lune: new THREE.Vector3(),
    lumiere: new THREE.Vector3(),
    couleur: new THREE.Color(),
    intensite: 1,
    nuit: 0,
    dore: 0,
  };

  appliquer(dt: number, heure: number, ciel: EtatCiel, temps: number, eclair: number, cielRendu: Ciel, post: Post, scene: THREE.Scene) {
    const e = this.etat;
    directionSoleil(heure, e.soleil);
    directionLune(e.soleil, e.lune);
    const hs = e.soleil.y;
    const jour = lisse(-0.04, 0.08, hs);
    const nuit = 1 - lisse(-0.16, 0.02, hs);
    e.nuit = nuit;
    e.dore = lisse(0.42, 0.05, hs) * jour;

    const couvert = ciel.nuages * ciel.nuages;
    if (jour > 0.001) {
      e.lumiere.copy(e.soleil);
      const t = transmittanceSoleil(new THREE.Vector3(e.soleil.x, Math.max(e.soleil.y, 0.015), e.soleil.z).normalize());
      e.couleur.copy(t);
      e.intensite = 3.4 * jour * (1 - 0.7 * couvert);
    } else {
      e.lumiere.copy(e.lune);
      e.couleur.setRGB(0.5, 0.62, 1.0);
      e.intensite = 0.85 * lisse(0.0, 0.25, e.lune.y) * lisse(-0.04, -0.12, hs) * (1 - 0.6 * couvert);
    }

    // Les uniformes partagés
    ATMO.uTemps.value = temps;
    ATMO.uHeure.value = heure;
    ATMO.uSoleilDir.value.copy(e.soleil);
    ATMO.uLumiereDir.value.copy(e.lumiere);
    ATMO.uLumiereCouleur.value.copy(e.couleur).multiplyScalar(e.intensite);
    ATMO.uNuit.value = nuit;
    ATMO.uLampes.value = lampes(heure, ciel.orage * 0.8 + couvert * 0.3);
    ATMO.uNuages.value = ciel.nuages;
    ATMO.uBrumeBasse.value = ciel.brume;
    ATMO.uBrumeDensite.value = 0.0014 + 0.0006 * e.dore + 0.003 * ciel.brume + 0.005 * ciel.pluie + 0.0012 * ciel.nuages + 0.0008 * nuit;
    ATMO.uBrumeHauteur.value = 28 - ciel.brume * 10;
    ATMO.uEclair.value = eclair;
    // Le vent tourne lentement
    this.angleVent += dt * 0.01 * Math.sin(temps * 0.013);
    const force = 0.15 + ciel.vent * 0.85;
    ATMO.uVent.value.set(Math.cos(this.angleVent) * force, Math.sin(this.angleVent) * force);
    ATMO.uNuagesDecalage.value.x += Math.cos(this.angleVent) * dt * 0.0016 * (0.4 + ciel.vent);
    ATMO.uNuagesDecalage.value.y += Math.sin(this.angleVent) * dt * 0.0016 * (0.4 + ciel.vent);
    // Les surfaces restent mouillées un moment après la pluie
    this.mouille = Math.max(ciel.pluie, this.mouille - dt * 0.012);
    ATMO.uPluie.value = this.mouille;
    // L'arc-en-ciel, quand la pluie s'arrête et que le soleil revient
    this.pluieMax = Math.max(this.pluieMax - dt * 0.01, ciel.pluie);
    const arcCible = this.pluieMax > 0.45 && ciel.pluie < 0.25 && hs > 0.04 && hs < 0.6 && ciel.nuages < 0.8 ? 1 : 0;
    this.arc += (arcCible - this.arc) * Math.min(1, dt * 0.15);

    // Le ciel
    cielRendu.vue.uSoleil.value.copy(e.soleil);
    cielRendu.vue.uLune.value.copy(e.lune);
    cielRendu.vue.uNuages.value = ciel.nuages * 0.8 + ciel.pluie * 0.2;
    cielRendu.vue.uOrage.value = ciel.orage;
    cielRendu.vue.uBrumeHorizon.value = 0.4 + ciel.brume * 0.6;
    const disque = transmittanceSoleil(new THREE.Vector3(e.soleil.x, Math.max(e.soleil.y, 0.0), e.soleil.z).normalize());
    cielRendu.uDome.uSoleilDisque.value.copy(disque).multiplyScalar(lisse(-0.02, 0.01, hs) * (1 - 0.95 * lisse(0.6, 0.95, ciel.nuages)));
    cielRendu.uDome.uLuneDir.value.copy(e.lune);
    cielRendu.uDome.uEtoiles.value = nuit * (1 - 0.9 * ciel.nuages);
    cielRendu.uDome.uArcEnCiel.value = this.arc;
    cielRendu.uDome.uPluieCiel.value = ciel.pluie;

    scene.environmentIntensity = 1.0 + nuit * 1.6;

    // L'image
    const f = post.final;
    f.uExposition.value = (0.92 + nuit * 1.05 + e.dore * 0.12) * (1 + 0.25 * couvert);
    const blancJour = new THREE.Color(1.02, 1.0, 0.97);
    const blancDore = new THREE.Color(1.1, 0.99, 0.84);
    const blancNuit = new THREE.Color(0.82, 0.94, 1.18);
    const blancGris = new THREE.Color(0.97, 1.0, 1.04);
    let blanc = melange(blancJour, blancDore, e.dore);
    blanc = melange(blanc, blancGris, ciel.nuages * 0.8);
    blanc = melange(blanc, blancNuit, nuit);
    f.uBlanc.value.copy(blanc);
    f.uOmbres.value.setRGB(-0.004 + e.dore * 0.012, 0.004, 0.03 + nuit * 0.02);
    f.uSaturation.value = (1.1 + e.dore * 0.12) * (1 - 0.25 * ciel.nuages) * (1 - 0.3 * nuit);
    f.uContraste.value = 1.06 + e.dore * 0.04 - ciel.brume * 0.06;
    f.uCouleurRayons.value.copy(e.couleur).multiplyScalar(0.9 * (1 - nuit));
    post.bloom.strength = 0.3 + nuit * 0.25 + e.dore * 0.1;
    post.bloom.threshold = 1.2 - nuit * 0.3;
  }
}
