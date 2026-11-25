// La caméra à la troisième personne : derrière le petit être, la verticale locale en haut.
// La souris la fait tourner ; sans souris, elle se recale doucement derrière lui quand il marche.
// Elle sait aussi s'éloigner en orbite (écran titre, fin) et revenir en douceur.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";
import type { Joueur } from "./joueur";

const R = REGLAGES.planete.rayon;

export class CameraJeu {
  /** Direction horizontale de la caméra (tangente). */
  readonly cap = new THREE.Vector3();
  tangage = 0.42;
  distance = 5.4;
  /** 0 : suit le joueur, 1 : en orbite autour de la planète. */
  orbite = 1;
  angleOrbite = 0;
  readonly axeOrbite = new THREE.Vector3(0.15, 1, 0.1).normalize();
  private readonly pos = new THREE.Vector3();
  private readonly vise = new THREE.Vector3();
  private readonly haut = new THREE.Vector3();
  private premier = true;
  secousse = 0;
  /** En orbite, vise au-dessus (positif) ou au-dessous du centre, pour laisser la place au texte. */
  decalage = 7;

  constructor(private readonly monde: Monde) {}

  init(j: Joueur) {
    this.cap.copy(j.avant);
  }

  maj(dt: number, cam: THREE.PerspectiveCamera, j: Joueur, dx: number, dy: number, molette: number, calme: number) {
    const up = j.pos.clone().normalize();
    this.cap.applyQuaternion(j.transport);
    this.cap.addScaledVector(up, -this.cap.dot(up)).normalize();
    // Souris
    this.cap.applyAxisAngle(up, -dx * 0.0035);
    this.tangage = THREE.MathUtils.clamp(this.tangage + dy * 0.0025, 0.08, 1.15);
    this.distance = THREE.MathUtils.clamp(this.distance + molette * 0.6, 3.5, 11);
    // Recalage automatique derrière le petit être quand il marche
    if (calme > 1.2 && j.vitesse > 0.5) {
      const angle = this.cap.angleTo(j.avant);
      if (angle < 2.5) {
        const sens = Math.sign(new THREE.Vector3().crossVectors(this.cap, j.avant).dot(up)) || 1;
        this.cap.applyAxisAngle(up, sens * Math.min(angle, dt * 1.1 * (j.vitesse / 5) * Math.sin(Math.min(angle, 1.5))));
      }
    }

    // Pose « suivi »
    const D = this.distance;
    const suivi = j.pos
      .clone()
      .addScaledVector(up, 0.9 + Math.sin(this.tangage) * D)
      .addScaledVector(this.cap, -Math.cos(this.tangage) * D);
    // Pas sous le sol
    const dirS = suivi.clone().normalize();
    const solS = R + Math.max(this.monde.hauteurSol(dirS), 0) + 0.7;
    if (suivi.length() < solS) suivi.setLength(solS);
    const viseSuivi = j.pos.clone().addScaledVector(up, 0.85).addScaledVector(this.cap, 1.2);

    // Pose « orbite »
    this.angleOrbite += dt * 0.07;
    const base = new THREE.Vector3(0, 0, 1).applyAxisAngle(this.axeOrbite, this.angleOrbite);
    const orb = base.multiplyScalar(52).add(this.axeOrbite.clone().multiplyScalar(10));
    const viseOrb = this.axeOrbite.clone().multiplyScalar(this.decalage);

    const t = this.orbite * this.orbite * (3 - 2 * this.orbite);
    const cible = suivi.clone().lerp(orb, t);
    const viseCible = viseSuivi.clone().lerp(viseOrb, t);
    const hautCible = up.clone().lerp(this.axeOrbite, t).normalize();
    if (this.premier) {
      this.pos.copy(cible);
      this.vise.copy(viseCible);
      this.haut.copy(hautCible);
      this.premier = false;
    }
    const k = 1 - Math.exp(-dt * (this.orbite > 0.01 && this.orbite < 0.99 ? 30 : 9));
    this.pos.lerp(cible, k);
    this.vise.lerp(viseCible, 1 - Math.exp(-dt * 14));
    this.haut.lerp(hautCible, 1 - Math.exp(-dt * 8)).normalize();
    cam.position.copy(this.pos);
    if (this.secousse > 0) {
      this.secousse = Math.max(0, this.secousse - dt * 1.5);
      cam.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.secousse * 0.15));
    }
    cam.up.copy(this.haut);
    cam.lookAt(this.vise);
  }

  /** Avant et droite de la caméra dans le plan tangent du joueur (pour diriger la marche). */
  reperes(j: Joueur) {
    const up = j.pos.clone().normalize();
    const avant = this.cap.clone().addScaledVector(up, -this.cap.dot(up)).normalize();
    const droite = new THREE.Vector3().crossVectors(avant, up).normalize();
    return { avant, droite };
  }
}
