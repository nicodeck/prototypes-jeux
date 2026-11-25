// Des buissons morts éparpillés : des brindilles grises sur le sol mort, qui se couvrent de feuilles
// (et parfois de baies) quand la vie les atteint.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { GLOBAL, GLSL_COMMUN } from "./communs";
import { GLSL_POSE } from "./herbe";
import { Tapis } from "./tapis";

function geometrieBuisson() {
  const pos: number[] = [];
  const partie: number[] = [];
  const index: number[] = [];
  const brins = 7;
  for (let b = 0; b < brins; b++) {
    const a = (b / brins) * Math.PI * 2 + b * 1.3;
    const penche = 0.35 + (b % 3) * 0.15;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz, pz = dx;
    const h = 0.7 + ((b * 7) % 5) * 0.08;
    const base = pos.length / 3;
    const pts: [number, number, number][] = [];
    for (let s = 0; s <= 3; s++) {
      const y = s / 3;
      pts.push([dx * penche * y * (0.6 + y * 0.4), y * h, dz * penche * y * (0.6 + y * 0.4)]);
    }
    for (let s = 0; s <= 3; s++) {
      const w = 0.018 * (1 - s / 3.5);
      const [x, y, z] = pts[s];
      pos.push(x - px * w, y, z - pz * w, x + px * w, y, z + pz * w);
      partie.push(0, 0);
    }
    for (let s = 0; s < 3; s++) {
      const i = base + s * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
    // Feuilles : un losange au bout et un au milieu
    for (const s of [3, 2]) {
      const [x, y, z] = pts[s];
      const l = s === 3 ? 0.3 : 0.24;
      const k = pos.length / 3;
      pos.push(x, y, z, x + dx * l * 0.5 + px * l * 0.35, y + l * 0.3, z + dz * l * 0.5 + pz * l * 0.35, x + dx * l, y + l * 0.45, z + dz * l, x + dx * l * 0.5 - px * l * 0.35, y + l * 0.3, z + dz * l * 0.5 - pz * l * 0.35);
      partie.push(1, 1, 1, 1);
      index.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aPartie", new THREE.Float32BufferAttribute(partie, 1));
  g.setIndex(index);
  return g;
}

export function creerBuissons(monde: Monde) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GLOBAL);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${GLSL_COMMUN}
        ${GLSL_POSE}
        attribute float aPartie;
        varying float vPartie;
        varying float vVie;
        varying float vTeinte;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `poser();
        float vie = smoothstep(0.45, 0.85, pE.z);
        vec3 objectNormal = normalize(aDir + pT * 0.3);`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed;
        {
          float taille = (0.45 + 0.55 * aAlea.y) * (1.0 + 0.25 * vie);
          vec3 lp = position * taille;
          // Les feuilles poussent avec la vie
          if (aPartie > 0.5) lp *= vie;
          float phase = dot(aDir, vec3(17.0, 13.0, 11.0)) + uTemps * 1.5;
          vec3 vent = uVent - aDir * dot(uVent, aDir);
          float h = lp.y;
          vec3 p = aDir * (uRayon + pE.x - 0.03) + pT * lp.x + pB * lp.z + aDir * lp.y;
          p += vent * h * h * sin(phase) * 0.08 * (0.4 + uForceVent);
          transformed = p;
          if (pE.y > 0.04 || pE2.w > 0.1) transformed = aDir * (uRayon - 5.0);
        }
        vPartie = aPartie;
        vVie = vie;
        vTeinte = aAlea.w;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vPartie;
        varying float vVie;
        varying float vTeinte;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 mort = vec3(0.62, 0.57, 0.52) * (0.8 + 0.3 * vTeinte);
          vec3 vivant = vec3(0.36, 0.25, 0.16);
          vec3 c = mix(mort, vivant, vVie);
          if (vPartie > 0.5) c = mix(vec3(0.18, 0.45, 0.12), vec3(0.42, 0.62, 0.15), vTeinte);
          diffuseColor.rgb = c;
        }`,
      );
  };
  return new Tapis(monde, geometrieBuisson(), mat, {
    nombre: 1400,
    graine: 17,
    portee: 30,
    filtre: (_d, i) => monde.solOrigine[i] > -0.3 && !monde.sources.some((s) => s.dir.angleTo(_d) * 16 < 2.6),
  });
}
