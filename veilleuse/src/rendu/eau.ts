// L'eau : chaque étendue a une surface faite de petits ressorts qui ondulent quand Veilleuse y
// entre ou y nage. Une couche sombre passe derrière Veilleuse, une couche teintée devant.
import * as THREE from "three";
import type { Mine } from "../monde/mine";
import { GLSL_BRUIT } from "./bruit";
import { GLSL_LUMIERES, LUMIERES } from "./lumieres";

const PAR_CASE = 6;

type Etendue = {
  x0: number;
  x1: number;
  haut: number;
  bas: number;
  hauteurs: Float32Array;
  vitesses: Float32Array;
  geos: THREE.BufferGeometry[];
};

function etendues(mine: Mine) {
  const vu = new Uint8Array(mine.eau.length);
  const liste: { c0: number; c1: number; l0: number; l1: number }[] = [];
  for (let i = 0; i < mine.eau.length; i++) {
    if (!mine.eau[i] || vu[i]) continue;
    const boite = { c0: Infinity, c1: -Infinity, l0: Infinity, l1: -Infinity };
    const pile = [i];
    vu[i] = 1;
    while (pile.length) {
      const j = pile.pop()!;
      const c = j % mine.largeur;
      const l = Math.floor(j / mine.largeur);
      boite.c0 = Math.min(boite.c0, c);
      boite.c1 = Math.max(boite.c1, c);
      boite.l0 = Math.min(boite.l0, l);
      boite.l1 = Math.max(boite.l1, l);
      for (const k of [j - 1, j + 1, j - mine.largeur, j + mine.largeur]) {
        if (k >= 0 && k < mine.eau.length && mine.eau[k] && !vu[k]) {
          vu[k] = 1;
          pile.push(k);
        }
      }
    }
    liste.push(boite);
  }
  return liste;
}

const SOMMETS = /* glsl */ `
  varying vec2 vMonde;
  void main() {
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xy;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

export function creerEau(mine: Mine) {
  const groupe = new THREE.Group();
  const uniforms = {
    ...LUMIERES,
    uCouleur: { value: new THREE.Color("#0b3138") },
    uSurfaces: { value: 0 },
  };
  const fond = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: SOMMETS.replace("varying vec2 vMonde;", "varying vec2 vMonde; attribute float profondeur; varying float vProf;").replace("vMonde = m.xy;", "vMonde = m.xy; vProf = profondeur;"),
    fragmentShader: /* glsl */ `
      ${GLSL_BRUIT}
      ${GLSL_LUMIERES}
      uniform vec3 uCouleur;
      varying vec2 vMonde;
      varying float vProf;
      void main() {
        vec3 L = lumiere(vMonde, vec3(0.0, 0.0, 1.0));
        // Des caustiques : un réseau clair qui danse, visible là où il y a de la lumière
        vec2 q = vMonde * 1.4;
        float c1 = bruit(q + vec2(uTemps * 0.35, uTemps * 0.2));
        float c2 = bruit(q * 1.7 - vec2(uTemps * 0.25, -uTemps * 0.3));
        float caus = pow(1.0 - abs(c1 - c2), 8.0);
        vec3 col = uCouleur * (0.25 + 0.75 * exp(-vProf * 0.6));
        col += uCouleur * L * 1.6 + L * caus * 0.22 * exp(-vProf * 0.4);
        gl_FragColor = vec4(col, 0.82 + 0.15 * smoothstep(0.0, 3.0, vProf));
      }
    `,
  });
  const devant = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: SOMMETS.replace("varying vec2 vMonde;", "varying vec2 vMonde; attribute float profondeur; varying float vProf;").replace("vMonde = m.xy;", "vMonde = m.xy; vProf = profondeur;"),
    fragmentShader: /* glsl */ `
      ${GLSL_BRUIT}
      ${GLSL_LUMIERES}
      uniform vec3 uCouleur;
      varying vec2 vMonde;
      varying float vProf;
      void main() {
        vec3 L = lumiere(vMonde, vec3(0.0, 0.6, 0.8));
        float l = dot(L, vec3(0.33));
        // La ligne de surface, qui accroche la lumière
        float ligne = smoothstep(0.07, 0.0, vProf);
        float sous = smoothstep(0.0, 0.25, vProf) * exp(-vProf * 1.4);
        // Les reflets des lumières : des traits tremblés sous la surface
        float tremble = bruit(vec2(vMonde.x * 3.0, vMonde.y * 9.0 + uTemps * 2.0));
        vec3 col = uCouleur * 0.5 + L * (0.08 + sous * tremble * 0.8);
        col += (uBrume * 0.35 + L * 2.0) * ligne;
        float a = 0.16 + 0.22 * smoothstep(0.0, 3.0, vProf) + ligne * 0.7;
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const liste: Etendue[] = etendues(mine).map((b) => {
    const x0 = b.c0;
    const x1 = b.c1 + 1;
    const haut = -b.l0;
    const bas = -b.l1 - 1;
    const n = (x1 - x0) * PAR_CASE + 1;
    const geos = [fond, devant].map((mat, k) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 2 * 3);
      const prof = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = x0 + i / PAR_CASE;
        pos.set([x, haut, 0, x, bas, 0], i * 6);
        prof[i * 2] = 0;
        prof[i * 2 + 1] = haut - bas;
      }
      const index: number[] = [];
      for (let i = 0; i < n - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("profondeur", new THREE.BufferAttribute(prof, 1));
      geo.setIndex(index);
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = k === 0 ? -35 : -12;
      m.frustumCulled = false;
      groupe.add(m);
      return geo;
    });
    return { x0, x1, haut, bas, hauteurs: new Float32Array(n), vitesses: new Float32Array(n), geos };
  });

  return {
    groupe,
    uniforms,
    /** Une perturbation de la surface en x (positive : vers le bas). */
    eclabousser(x: number, y: number, force: number) {
      for (const e of liste) {
        if (x < e.x0 || x > e.x1 || Math.abs(y - e.haut) > 1.5) continue;
        const i = Math.round((x - e.x0) * PAR_CASE);
        for (let k = -3; k <= 3; k++) {
          const j = i + k;
          if (j >= 0 && j < e.vitesses.length) e.vitesses[j] += force * (1 - Math.abs(k) / 4);
        }
      }
    },
    mettreAJour(dt: number, temps: number) {
      const pas = Math.min(dt, 1 / 30) * 60;
      for (const e of liste) {
        const h = e.hauteurs;
        const v = e.vitesses;
        const n = h.length;
        for (let i = 0; i < n; i++) {
          v[i] += (-0.025 * h[i] - 0.03 * v[i]) * pas;
        }
        for (let k = 0; k < 2; k++) {
          for (let i = 0; i < n; i++) {
            const g = i > 0 ? h[i - 1] - h[i] : 0;
            const d = i < n - 1 ? h[i + 1] - h[i] : 0;
            v[i] += (g + d) * 0.08 * pas;
          }
        }
        for (let i = 0; i < n; i++) h[i] += v[i] * 0.05 * pas;
        for (const geo of e.geos) {
          const pos = geo.getAttribute("position") as THREE.BufferAttribute;
          for (let i = 0; i < n; i++) {
            const x = e.x0 + i / PAR_CASE;
            const houle = Math.sin(x * 1.3 + temps * 1.1) * 0.025 + Math.sin(x * 3.1 - temps * 1.7) * 0.012;
            pos.setY(i * 2, e.haut - 0.12 + houle - h[i] * 0.1);
          }
          pos.needsUpdate = true;
        }
      }
    },
  };
}
