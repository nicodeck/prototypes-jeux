// Les fleurs : elles sortent sur l'herbe bien installée, de plus en plus nombreuses à mesure que la planète
// revit. Elles s'ouvrent le jour et se ferment la nuit ; certaines, les veilleuses, s'ouvrent la nuit et luisent.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { GLOBAL, GLSL_COMMUN } from "./communs";
import { GLSL_POSE } from "./herbe";
import { Tapis } from "./tapis";

function geometrieFleur() {
  const ouvert: number[] = [];
  const ferme: number[] = [];
  const partie: number[] = [];
  const index: number[] = [];
  const tige = 1;
  // Tige : deux quads croisés
  for (const [cx, cz] of [[1, 0], [0, 1]]) {
    const b = ouvert.length / 3;
    const w = 0.012;
    const pts = [-cx * w, 0, -cz * w, cx * w, 0, cz * w, -cx * w, tige, -cz * w, cx * w, tige, cz * w];
    ouvert.push(...pts);
    ferme.push(...pts);
    partie.push(0, 0, 0.6, 0.6);
    index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  // Pétales
  const n = 5;
  for (let p = 0; p < n; p++) {
    const a = (p / n) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cb = Math.cos(a + Math.PI / 2), sb = Math.sin(a + Math.PI / 2);
    const b = ouvert.length / 3;
    const L = 1, W = 0.42;
    // ouvert : à plat, un peu relevé
    ouvert.push(0, tige, 0);
    ouvert.push(ca * L * 0.5 + cb * W, tige + 0.12, sa * L * 0.5 + sb * W);
    ouvert.push(ca * L, tige + 0.28, sa * L);
    ouvert.push(ca * L * 0.5 - cb * W, tige + 0.12, sa * L * 0.5 - sb * W);
    // fermé : dressé en bouton
    ferme.push(0, tige, 0);
    ferme.push(ca * 0.12 + cb * W * 0.4, tige + 0.4, sa * 0.12 + sb * W * 0.4);
    ferme.push(ca * 0.05, tige + 0.85, sa * 0.05);
    ferme.push(ca * 0.12 - cb * W * 0.4, tige + 0.4, sa * 0.12 - sb * W * 0.4);
    partie.push(1, 1.5, 2, 1.5);
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // Cœur
  const b = ouvert.length / 3;
  ouvert.push(0, tige + 0.22, 0);
  ferme.push(0, tige + 0.3, 0);
  partie.push(3);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    ouvert.push(Math.cos(a) * 0.22, tige + 0.08, Math.sin(a) * 0.22);
    ferme.push(Math.cos(a) * 0.06, tige + 0.2, Math.sin(a) * 0.06);
    partie.push(3);
  }
  for (let p = 0; p < 6; p++) index.push(b, b + 1 + ((p + 1) % 6), b + 1 + p);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ouvert, 3));
  g.setAttribute("aFerme", new THREE.Float32BufferAttribute(ferme, 3));
  g.setAttribute("aPartie", new THREE.Float32BufferAttribute(partie, 1));
  g.setIndex(index);
  return g;
}

const PALETTE = [
  [1.0, 0.97, 0.9],
  [1.0, 0.82, 0.2],
  [1.0, 0.55, 0.72],
  [0.62, 0.5, 1.0],
  [1.0, 0.42, 0.25],
  [0.98, 0.98, 0.6],
];

export function creerFleurs(monde: Monde) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GLOBAL);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${GLSL_COMMUN}
        ${GLSL_POSE}
        uniform float uFloraison;
        attribute vec3 aFerme;
        attribute float aPartie;
        attribute vec3 aCouleur;
        varying float vPartie;
        varying vec3 vCouleur;
        varying float vLueur;
        float fTaille;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `poser();
        float veilleuse = step(0.78, aAlea.w);
        float jour = smoothstep(-0.15, 0.25, dot(aDir, uSoleil));
        float ouverture = mix(jour, 1.0 - jour, veilleuse);
        fTaille = smoothstep(0.7, 0.95, pE.z) * smoothstep(0.0, 0.06, uFloraison - aAlea.z * 0.95);
        fTaille *= (1.0 - smoothstep(0.01, 0.04, pE.y)) * (1.0 - pE2.x);
        vec3 objectNormal = aDir;
        vLueur = veilleuse * (1.0 - jour) * fTaille;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed;
        {
          float ouv = mix(jour, 1.0 - jour, veilleuse);
          vec3 lp = mix(aFerme, position, ouv);
          float tete = 0.045 + 0.03 * aAlea.y;
          float tige = 0.28 + 0.22 * aAlea.y;
          vec3 local = aPartie < 0.9 ? vec3(lp.x, lp.y * tige, lp.z) : vec3(lp.x * tete, tige + (lp.y - 1.0) * tete, lp.z * tete);
          local *= fTaille;
          float phase = dot(aDir, vec3(17.0, 13.0, 11.0)) * 1.3 + uTemps * 1.8;
          vec3 vent = uVent - aDir * dot(uVent, aDir);
          float h = local.y / max(tige, 0.01);
          vec3 p = aDir * (uRayon + pE.x - 0.01) + pT * local.x + pB * local.z + aDir * local.y;
          p += vent * h * h * sin(phase) * 0.06 * (0.5 + uForceVent);
          transformed = p;
          if (fTaille < 0.01) transformed = aDir * (uRayon - 5.0);
        }
        vPartie = aPartie;
        vCouleur = aCouleur;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vPartie;
        varying vec3 vCouleur;
        varying float vLueur;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 c = vec3(0.2, 0.42, 0.12);
          if (vPartie > 0.9) c = mix(vCouleur * 0.75, vCouleur, smoothstep(1.0, 2.0, vPartie));
          if (vPartie > 2.5) c = vec3(1.0, 0.8, 0.25);
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (vPartie > 0.9) totalEmissiveRadiance += mix(vec3(0.35, 0.8, 1.0), vec3(1.0, 0.9, 0.5), step(2.5, vPartie)) * vLueur * 1.6;`,
      );
  };
  return new Tapis(monde, geometrieFleur(), mat, {
    nombre: 16000,
    graine: 9,
    portee: 22,
    extra: [
      {
        nom: "aCouleur",
        taille: 3,
        valeur: (alea, dir) => {
          // Les couleurs se regroupent en prairies : le choix dépend un peu de l'endroit.
          const zone = Math.floor(((Math.sin(dir.x * 5.1) + Math.sin(dir.y * 4.3 + 1) + Math.sin(dir.z * 4.7 + 2)) * 0.5 + 1.5) * 2);
          const k = alea() < 0.6 ? zone % PALETTE.length : Math.floor(alea() * PALETTE.length);
          return PALETTE[k];
        },
      },
    ],
  });
}
