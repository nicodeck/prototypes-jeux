// La caméra, à la manière d'Anno : elle vise un point du sol, tourne autour, et s'incline en
// s'approchant, jusqu'au ras des rues où l'on voit l'horizon et le ciel.
//
// Elle a aussi un mode cinéma : de lents plans de survol, choisis parmi les plus beaux endroits
// de la cité, qui s'enchaînent en fondu.
import * as THREE from "three";
import { hauteur, TAILLE } from "../ville/ile";

export interface Plan {
  x: number;
  z: number;
  distance: number;
  lacet: number;
  /** Inclinaison forcée (sinon elle suit la distance) */
  tangage?: number;
}

export const DISTANCE_MIN = 3.2;
export const DISTANCE_MAX = 165;

const lisse = (a: number, b: number, v: number) => THREE.MathUtils.smoothstep(v, a, b);

export function tangagePour(distance: number) {
  const t = Math.pow(lisse(DISTANCE_MIN, DISTANCE_MAX, distance), 0.62);
  return THREE.MathUtils.degToRad(7 + 51 * t);
}

export class Camera {
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.3, 6000);
  /** Ce que vise le joueur */
  readonly voulu: Plan = { x: 58, z: 84, distance: 46, lacet: 0.25 };
  /** Où en est la caméra (elle rejoint le voulu en douceur) */
  readonly actuel: Plan = { x: 58, z: 84, distance: 46, lacet: 0.25 };
  private solVise = 1;
  /** Mode cinéma : la suite des plans */
  cinema: { de: Plan; vers: Plan; t: number; duree: number } | null = null;

  get tangage() {
    return this.actuel.tangage ?? tangagePour(this.actuel.distance);
  }

  /** Avance dans le repère de la caméra (dx vers la droite, dz vers l'avant), en cases */
  deplacer(dx: number, dz: number) {
    const v = this.voulu;
    const s = Math.sin(v.lacet);
    const c = Math.cos(v.lacet);
    v.x += dx * c - dz * s;
    v.z += -dx * s - dz * c;
    this.borner();
  }

  tourner(da: number) {
    this.voulu.lacet += da;
  }

  /** Zoom vers un point du sol (celui sous la souris) */
  zoomer(facteur: number, vers?: THREE.Vector3) {
    const v = this.voulu;
    const avant = v.distance;
    v.distance = THREE.MathUtils.clamp(v.distance * facteur, DISTANCE_MIN, DISTANCE_MAX);
    if (vers) {
      const k = 1 - v.distance / avant;
      v.x += (vers.x - v.x) * k * 0.85;
      v.z += (vers.z - v.z) * k * 0.85;
      this.borner();
    }
  }

  viser(x: number, z: number, distance?: number) {
    this.voulu.x = x;
    this.voulu.z = z;
    if (distance) this.voulu.distance = distance;
  }

  private borner() {
    const v = this.voulu;
    v.x = THREE.MathUtils.clamp(v.x, -10, TAILLE + 10);
    v.z = THREE.MathUtils.clamp(v.z, -10, TAILLE + 14);
  }

  /** Place la caméra tout de suite, sans transition */
  sauter(p: Plan) {
    Object.assign(this.voulu, p);
    Object.assign(this.actuel, p);
    this.solVise = Math.max(0, hauteur(p.x, p.z));
  }

  lancerCinema(de: Plan, vers: Plan, duree: number) {
    this.cinema = { de, vers, t: 0, duree };
  }

  arreterCinema() {
    if (!this.cinema) return;
    this.cinema = null;
    Object.assign(this.voulu, { ...this.actuel, tangage: undefined });
    delete this.voulu.tangage;
    delete this.actuel.tangage;
  }

  /** `obstacle(x, z)` : la hauteur à ne pas traverser (le toit d'un bâtiment), ou -Infinity */
  mettreAJour(dt: number, aspect: number, obstacle: (x: number, z: number) => number = () => -Infinity) {
    const a = this.actuel;
    if (this.cinema) {
      const c = this.cinema;
      c.t = Math.min(1, c.t + dt / c.duree);
      const e = c.t * c.t * (3 - 2 * c.t) * 0.5 + c.t * 0.5;
      a.x = THREE.MathUtils.lerp(c.de.x, c.vers.x, e);
      a.z = THREE.MathUtils.lerp(c.de.z, c.vers.z, e);
      a.distance = THREE.MathUtils.lerp(c.de.distance, c.vers.distance, e);
      a.lacet = THREE.MathUtils.lerp(c.de.lacet, c.vers.lacet, e);
      const tde = c.de.tangage ?? tangagePour(c.de.distance);
      const tvers = c.vers.tangage ?? tangagePour(c.vers.distance);
      a.tangage = THREE.MathUtils.lerp(tde, tvers, e);
    } else {
      const v = this.voulu;
      const k = 1 - Math.exp(-dt * 7);
      const kz = 1 - Math.exp(-dt * 6);
      a.x += (v.x - a.x) * k;
      a.z += (v.z - a.z) * k;
      a.distance += (v.distance - a.distance) * kz;
      a.lacet += (v.lacet - a.lacet) * k;
    }
    const sol = Math.max(0, hauteur(a.x, a.z));
    this.solVise += (sol - this.solVise) * (1 - Math.exp(-dt * 4));

    const tangage = this.tangage;
    const cam = this.camera;
    const d = a.distance;
    const cible = new THREE.Vector3(a.x, this.solVise + 0.3, a.z);
    cam.position.set(
      cible.x + Math.sin(a.lacet) * Math.cos(tangage) * d,
      cible.y + Math.sin(tangage) * d,
      cible.z + Math.cos(a.lacet) * Math.cos(tangage) * d,
    );
    // Jamais sous le sol, sous l'eau, ni dans un bâtiment
    const sous = Math.max(Math.max(0, hauteur(cam.position.x, cam.position.z)) + 0.7, obstacle(cam.position.x, cam.position.z) + 0.6);
    if (cam.position.y < sous) cam.position.y = sous;
    cam.lookAt(cible);
    cam.fov = THREE.MathUtils.lerp(55, 36, lisse(DISTANCE_MIN, 110, d));
    cam.aspect = aspect;
    cam.near = THREE.MathUtils.clamp(d * 0.015, 0.08, 1.5);
    cam.far = 6000;
    cam.updateProjectionMatrix();
    return cible;
  }
}
