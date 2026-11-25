// La houle : une somme de vagues de Gerstner, calculée à l'identique
// sur le GPU (shader de l'océan) et sur le CPU (flottaison du bateau, embruns).

import * as THREE from "three";
import { REGLAGES } from "../reglages";
import { smoothstep } from "../outils/maths";

export interface Vague {
  dir: THREE.Vector2;
  k: number; // nombre d'onde
  omega: number; // pulsation
  amplitude: number;
  q: number; // raideur (déplacement horizontal)
  phase: number;
}

const G = 9.81;
// La houle principale vient du sud-ouest et file vers le nord-est.
export const DIRECTION_HOULE = Math.atan2(-0.75, 0.62);

function creerVagues(): Vague[] {
  const definitions: [number, number, number, number][] = [
    // longueur d'onde, amplitude, décalage d'angle, raideur
    [72, 1.05, 0.0, 0.55],
    [44, 0.62, 0.42, 0.6],
    [29, 0.42, -0.38, 0.62],
    [19, 0.27, 0.85, 0.65],
    [12.5, 0.16, -0.75, 0.7],
    [7.8, 0.09, 1.3, 0.7],
    [5.1, 0.055, -1.15, 0.7],
    [3.3, 0.03, 0.3, 0.6],
  ];
  return definitions.map(([longueur, amplitude, angle, raideur], i) => {
    const k = (2 * Math.PI) / longueur;
    const a = DIRECTION_HOULE + angle;
    return {
      dir: new THREE.Vector2(Math.cos(a), Math.sin(a)),
      k,
      omega: Math.sqrt(G * k),
      amplitude,
      q: raideur / (k * amplitude * definitions.length),
      phase: i * 1.7,
    };
  });
}

export const VAGUES = creerVagues();
export const NB_VAGUES = VAGUES.length;

/** Uniformes passés au shader de l'océan. */
export function uniformesVagues() {
  return {
    uVagueDir: { value: VAGUES.map((v) => new THREE.Vector4(v.dir.x, v.dir.y, v.k, v.omega)) },
    uVagueAmp: { value: VAGUES.map((v) => new THREE.Vector3(v.amplitude, v.q, v.phase)) },
  };
}

/** Facteur de calme autour des phares allumés (0 = pleine tempête, 1 = mer d'huile). */
export class Calme {
  centres: THREE.Vector2[] = [];
  apaisement = 0; // calme global à la fin de la partie

  facteur(x: number, z: number): number {
    const R = REGLAGES.phares.rayonZoneSure;
    let c = 0;
    for (const p of this.centres) {
      const d = Math.hypot(x - p.x, z - p.y);
      const t = smoothstep(R * 1.25, R * 0.45, d);
      c = Math.max(c, t * REGLAGES.phares.calmeZoneSure);
    }
    return Math.max(c, this.apaisement * 0.75);
  }
}

/** Hauteur de la mer en (x, z) à l'instant t. */
export function hauteurMer(x: number, z: number, t: number, ampli: number): number {
  // Une itération pour compenser le déplacement horizontal de Gerstner.
  let px = x;
  let pz = z;
  for (let it = 0; it < 2; it++) {
    let dx = 0;
    let dz = 0;
    for (const v of VAGUES) {
      const f = v.k * (v.dir.x * px + v.dir.y * pz) - v.omega * t + v.phase;
      const c = Math.cos(f) * v.q * v.amplitude * ampli;
      dx += v.dir.x * c;
      dz += v.dir.y * c;
    }
    px = x - dx;
    pz = z - dz;
  }
  let h = 0;
  for (const v of VAGUES) {
    const f = v.k * (v.dir.x * px + v.dir.y * pz) - v.omega * t + v.phase;
    h += Math.sin(f) * v.amplitude * ampli;
  }
  return h;
}

/** Pente de la mer (dh/dx, dh/dz), pour pousser le bateau. */
export function penteMer(x: number, z: number, t: number, ampli: number, sortie: THREE.Vector2) {
  const e = 0.8;
  const hx = hauteurMer(x + e, z, t, ampli) - hauteurMer(x - e, z, t, ampli);
  const hz = hauteurMer(x, z + e, t, ampli) - hauteurMer(x, z - e, t, ampli);
  return sortie.set(hx / (2 * e), hz / (2 * e));
}
