// Le cycle du jour : le soleil fait le tour de la planète, la lune le suit à l'opposé.
// Comme la planète est minuscule, marcher vers l'est avance l'heure, et vers l'ouest la recule !
import * as THREE from "three";
import { REGLAGES } from "../reglages";

export class Cycle {
  private readonly axe: THREE.Vector3;
  private readonly midi: THREE.Vector3;
  /** Heure au point de départ (0 minuit, 0,5 midi), qui avance avec le temps. */
  heure: number;
  readonly soleil = new THREE.Vector3();
  readonly lune = new THREE.Vector3();

  constructor(depart: THREE.Vector3, heure: number) {
    this.midi = depart.clone().normalize();
    // Un axe perpendiculaire à la verticale du départ, légèrement incliné
    const a = new THREE.Vector3(0.2, 0.1, 1);
    this.axe = a.addScaledVector(this.midi, -a.dot(this.midi)).normalize();
    this.heure = heure;
    this.calculer();
  }

  avancer(dt: number) {
    this.heure += dt / REGLAGES.dureeJour;
    this.calculer();
  }

  private calculer() {
    const angle = (this.heure - 0.5) * Math.PI * 2;
    this.soleil.copy(this.midi).applyAxisAngle(this.axe, angle).normalize();
    const decale = new THREE.Vector3().crossVectors(this.axe, this.soleil).normalize();
    this.lune.copy(this.soleil).negate().applyAxisAngle(decale, 0.45).normalize();
  }

  /** Lumière du jour à un endroit (1 plein jour, 0 nuit). */
  jour(haut: THREE.Vector3) {
    return THREE.MathUtils.smoothstep(this.soleil.dot(haut), -0.25, 0.2);
  }
}
