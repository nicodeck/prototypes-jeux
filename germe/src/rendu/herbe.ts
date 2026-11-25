// L'herbe : des touffes de brins instanciées sur toute la planète. Elles restent couchées (invisibles)
// sur le sol mort et se dressent quand la vie arrive. Le vent les fait onduler, le petit être les écarte.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { GLOBAL, GLSL_COMMUN } from "./communs";
import { Tapis } from "./tapis";

function geometrieTouffe() {
  const pos: number[] = [];
  const hauteur: number[] = [];
  const index: number[] = [];
  const brins = 5;
  for (let b = 0; b < brins; b++) {
    const a = (b / brins) * Math.PI * 2 + b * 0.7;
    const ox = Math.cos(a) * 0.09 * (b % 2 ? 1 : 0.4);
    const oz = Math.sin(a) * 0.09 * (b % 2 ? 1 : 0.4);
    const rot = a * 1.7;
    const cx = Math.cos(rot), cz = Math.sin(rot);
    const h = 0.75 + ((b * 37) % 10) / 20;
    const penche = 0.12 + (b % 3) * 0.08;
    const base = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const y = s / segs;
      const w = 0.032 * (1 - y * 0.85);
      const px = ox + Math.cos(a) * penche * y * y;
      const pz = oz + Math.sin(a) * penche * y * y;
      if (s < segs) {
        pos.push(px - cx * w, y * h, pz - cz * w, px + cx * w, y * h, pz + cz * w);
        hauteur.push(y, y);
      } else {
        pos.push(px, y * h, pz);
        hauteur.push(y);
      }
    }
    for (let s = 0; s < segs - 1; s++) {
      const i = base + s * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
    const i = base + (segs - 1) * 2;
    index.push(i, i + 1, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aH", new THREE.Float32BufferAttribute(hauteur, 1));
  g.setIndex(index);
  return g;
}

/** Le morceau de vertex shader qui pose une instance sur la planète (repère local, sol, état). */
export const GLSL_POSE = /* glsl */ `
  attribute vec3 aDir;
  attribute float aIdx;
  attribute vec4 aAlea;
  uniform vec3 uJoueur;
  uniform vec3 uVent;
  uniform float uForceVent;
  vec3 pT, pB;
  vec4 pE, pE2;
  void poser() {
    pE = etat(aIdx);
    pE2 = etat2(aIdx);
    vec3 t0, b0;
    repere(aDir, t0, b0);
    float ang = aAlea.x * 6.2831;
    pT = t0 * cos(ang) + b0 * sin(ang);
    pB = cross(aDir, pT);
  }
`;

export function creerHerbe(monde: Monde) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GLOBAL);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${GLSL_COMMUN}
        ${GLSL_POSE}
        attribute float aH;
        varying float vH;
        varying float vCendre;
        varying float vTeinte;
        float hTouffe;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `poser();
        float vie = pE.z;
        float seuil = 0.25 + aAlea.z * 0.5;
        hTouffe = smoothstep(seuil, seuil + 0.25, vie) * (0.2 + 0.3 * aAlea.y) * (1.0 - 0.5 * pE2.x);
        hTouffe *= 1.0 - smoothstep(0.01, 0.05, pE.y);
        hTouffe *= 1.0 - smoothstep(0.1, 0.4, pE2.w);
        vec3 objectNormal = normalize(aDir + pT * (aAlea.w - 0.5) * 0.6);`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed;
        {
          vec3 base = aDir * (uRayon + pE.x - 0.02);
          vec3 p = base + (pT * position.x + pB * position.z) * (0.6 + hTouffe * 1.4) + aDir * position.y * hTouffe;
          // Vent : les brins plient d'autant plus qu'ils sont hauts.
          float phase = dot(aDir, vec3(17.0, 13.0, 11.0)) * 1.3 + uTemps * (1.6 + uForceVent * 2.0);
          float rafale = sin(phase) * 0.5 + sin(phase * 0.37 + 1.7) * 0.5;
          vec3 vent = uVent - aDir * dot(uVent, aDir);
          float pli = aH * aH * hTouffe;
          p += vent * pli * (0.25 + rafale * 0.35) * (0.4 + uForceVent * 1.6);
          // Le petit être écarte l'herbe sur son passage.
          vec3 d = p - uJoueur;
          d -= aDir * dot(d, aDir);
          float l = length(d);
          p += normalize(d + 1e-4) * pli * 0.9 * (1.0 - smoothstep(0.2, 0.9, l));
          transformed = p;
        }
        vH = aH;
        vCendre = pE2.x;
        vTeinte = aAlea.w;
        if (hTouffe < 0.01) transformed = aDir * (uRayon - 5.0);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vH;
        varying float vCendre;
        varying float vTeinte;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 pied = vec3(0.07, 0.22, 0.06);
          vec3 pointe = mix(vec3(0.45, 0.72, 0.18), vec3(0.62, 0.78, 0.25), vTeinte);
          pointe = mix(pointe, vec3(0.25, 0.55, 0.16), step(0.7, vTeinte));
          vec3 c = mix(pied, pointe, smoothstep(0.0, 1.0, vH));
          c = mix(c, vec3(0.25, 0.24, 0.23), vCendre * 0.8);
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.05, 0.09, 0.02) * vH * vH;`,
      );
  };
  return new Tapis(monde, geometrieTouffe(), mat, { nombre: 70000, graine: 3, portee: 26 });
}
