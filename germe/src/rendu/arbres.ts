// Les arbres, construits par programme : un tronc qui se divise en branches, et des boules de feuillage
// à facettes au bout. Quatre espèces : le rondier (vert, rond), la flèche (conifère), la floraison (rose)
// et la lanterne (fruits qui luisent la nuit). Ils sortent d'une pousse puis grandissent en rebondissant.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Arbre, Monde } from "../monde/monde";
import { bruit3, hasard, lisse } from "../monde/bruit";
import { REGLAGES } from "../reglages";
import { GLOBAL } from "./communs";

const R = REGLAGES.planete.rayon;
const bruit = bruit3(99);
const HAUT = new THREE.Vector3(0, 1, 0);

interface Forme {
  tronc: THREE.BufferGeometry;
  feuillage: THREE.BufferGeometry;
  fruits: THREE.BufferGeometry | null;
}

function colorer(g: THREE.BufferGeometry, f: (p: THREE.Vector3, i: number) => THREE.Color) {
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = f(p, i);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Une branche : un cylindre effilé de a vers b. */
function branche(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number) {
  const l = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, l, 6, 1, true);
  g.translate(0, l / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(HAUT, b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Une boule de feuillage bosselée, à facettes. */
function boule(c: THREE.Vector3, r: number, teinte: THREE.Color, alea: () => number, aplati = 1) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const dec = alea() * 100;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = 1 + 0.22 * bruit(p.x * 1.8 + dec, p.y * 1.8, p.z * 1.8);
    p.multiplyScalar(k);
    p.y *= aplati;
    pos.setXYZ(i, p.x + c.x, p.y + c.y, p.z + c.z);
  }
  g.computeVertexNormals();
  // Une couleur par facette, plus sombre en dessous
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3 - c.y;
    const lum = 0.72 + 0.4 * lisse(-r, r, y) + (alea() - 0.5) * 0.12;
    tmp.copy(teinte).multiplyScalar(lum);
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = tmp.r;
      col[(f + k) * 3 + 1] = tmp.g;
      col[(f + k) * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  return g;
}

function cone(c: THREE.Vector3, r: number, h: number, teinte: THREE.Color, alea: () => number) {
  const g = new THREE.ConeGeometry(r, h, 8, 2).toNonIndexed();
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const rot = alea() * Math.PI;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    p.applyAxisAngle(HAUT, rot);
    const k = 1 + 0.12 * bruit(p.x * 3, p.y * 3 + c.y, p.z * 3);
    pos.setXYZ(i, p.x * k + c.x, p.y + c.y, p.z * k + c.z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3 - c.y;
    tmp.copy(teinte).multiplyScalar(0.7 + 0.45 * lisse(-h / 2, h / 2, y) + (alea() - 0.5) * 0.1);
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = tmp.r;
      col[(f + k) * 3 + 1] = tmp.g;
      col[(f + k) * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  return g;
}

const ECORCE = [new THREE.Color(0.36, 0.24, 0.16), new THREE.Color(0.3, 0.22, 0.18), new THREE.Color(0.55, 0.45, 0.4), new THREE.Color(0.32, 0.2, 0.14)];
const FEUILLES = [
  [new THREE.Color(0.3, 0.62, 0.16), new THREE.Color(0.42, 0.7, 0.2), new THREE.Color(0.22, 0.52, 0.18)],
  [new THREE.Color(0.1, 0.38, 0.28), new THREE.Color(0.14, 0.44, 0.3)],
  [new THREE.Color(1.0, 0.62, 0.78), new THREE.Color(1.0, 0.8, 0.88), new THREE.Color(0.95, 0.5, 0.68)],
  [new THREE.Color(0.55, 0.72, 0.22), new THREE.Color(0.68, 0.78, 0.3)],
];

export function construireForme(espece: number, graine: number): Forme {
  const alea = hasard(graine);
  const troncs: THREE.BufferGeometry[] = [];
  const feuilles: THREE.BufferGeometry[] = [];
  const fruits: THREE.BufferGeometry[] = [];
  const teinte = (k: number) => FEUILLES[espece][k % FEUILLES[espece].length];

  if (espece === 1) {
    // La flèche : un tronc droit, des étages de cônes
    const h = 2.6 + alea() * 0.9;
    troncs.push(branche(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, h * 0.9, 0), 0.16, 0.05));
    const etages = 4 + Math.floor(alea() * 2);
    for (let e = 0; e < etages; e++) {
      const f = e / etages;
      const r = (1.15 - f * 0.85) * (0.9 + alea() * 0.2);
      const y = h * (0.28 + f * 0.62);
      feuilles.push(cone(new THREE.Vector3(0, y, 0), r, 0.95 - f * 0.25, teinte(e), alea));
    }
  } else {
    // Rondier, floraison, lanterne : un tronc courbe qui se divise
    const h = (espece === 2 ? 1.5 : espece === 3 ? 1.9 : 1.8) + alea() * 0.6;
    const penche = new THREE.Vector3(alea() - 0.5, 0, alea() - 0.5).multiplyScalar(0.5);
    const p0 = new THREE.Vector3(0, -0.2, 0);
    const p1 = new THREE.Vector3(penche.x * 0.3, h * 0.5, penche.z * 0.3);
    const p2 = new THREE.Vector3(penche.x, h * 0.85, penche.z);
    troncs.push(branche(p0, p1, 0.2, 0.15), branche(p1, p2, 0.15, 0.1));
    // Racines
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + alea();
      troncs.push(branche(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(Math.cos(a) * 0.45, -0.15, Math.sin(a) * 0.45), 0.09, 0.02));
    }
    const nb = 3 + Math.floor(alea() * 2);
    feuilles.push(boule(p2.clone().add(new THREE.Vector3(0, 0.45, 0)), 0.85 + alea() * 0.25, teinte(0), alea, 0.85));
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + alea() * 0.8;
      const ouverture = espece === 3 ? 0.95 : 0.7;
      const l = 0.7 + alea() * 0.5;
      const bout = p2.clone().add(new THREE.Vector3(Math.cos(a) * l * ouverture, 0.35 + alea() * 0.4, Math.sin(a) * l * ouverture));
      troncs.push(branche(p2, bout, 0.09, 0.04));
      const r = (espece === 2 ? 0.7 : 0.6) + alea() * 0.3;
      feuilles.push(boule(bout.clone().add(new THREE.Vector3(0, 0.15, 0)), r, teinte(k + 1), alea, espece === 2 ? 0.75 : 0.9));
      if (espece === 3) {
        for (let f = 0; f < 3; f++) {
          const fa = alea() * Math.PI * 2;
          const fp = bout.clone().add(new THREE.Vector3(Math.cos(fa) * r * 0.9, -r * 0.55 - alea() * 0.2, Math.sin(fa) * r * 0.9));
          const s = new THREE.SphereGeometry(0.09 + alea() * 0.04, 8, 6);
          s.translate(fp.x, fp.y, fp.z);
          fruits.push(s);
          troncs.push(branche(fp.clone().add(new THREE.Vector3(0, 0.3, 0)), fp, 0.012, 0.01));
        }
      }
    }
  }
  const ecorce = ECORCE[espece];
  const tronc = mergeGeometries(troncs.map((g) => {
    g.deleteAttribute("uv");
    return g.index ? g.toNonIndexed() : g;
  }))!;
  colorer(tronc, (p) => ecorce.clone().multiplyScalar(0.8 + 0.3 * lisse(0, 2.5, p.y)));
  const feuillage = mergeGeometries(feuilles)!;
  let geoFruits: THREE.BufferGeometry | null = null;
  if (fruits.length) {
    geoFruits = mergeGeometries(fruits.map((g) => {
      g.deleteAttribute("uv");
      return g;
    }))!;
  }
  return { tronc, feuillage, fruits: geoFruits };
}

/** Le balancement au vent, ajouté aux matériaux des arbres. */
function balancer(mat: THREE.Material, force: number) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GLOBAL);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTemps;\nuniform float uForceVent;\nvarying vec3 vMonde;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 o = modelMatrix[3].xyz;
          float ph = dot(o, vec3(0.7, 1.3, 0.9));
          float k = max(position.y, 0.0);
          k = k * k * ${force.toFixed(3)} * (0.6 + uForceVent * 1.5);
          transformed.x += sin(uTemps * 1.3 + ph) * k + sin(uTemps * 3.1 + ph * 2.0 + position.y) * k * 0.25;
          transformed.z += cos(uTemps * 1.1 + ph * 1.7) * k * 0.7;
          vMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;
        }`,
      );
    // Ce qui se trouve entre la caméra et le petit être s'efface en pointillé, pour ne jamais le cacher.
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uCamera;
        uniform vec3 uJoueur;
        varying vec3 vMonde;`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        {
          vec3 ab = uJoueur - uCamera;
          float t = clamp(dot(vMonde - uCamera, ab) / dot(ab, ab), 0.0, 1.0);
          float d = distance(vMonde, uCamera + ab * t);
          float pres = distance(vMonde, uCamera);
          float voile = max(1.0 - smoothstep(0.6, 1.4, d), 1.0 - smoothstep(1.2, 2.4, pres)) * step(t, 0.92);
          float tramage = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (tramage < voile * 0.85) discard;
        }`,
      );
  };
}

function geometriePousse() {
  const g: THREE.BufferGeometry[] = [];
  g.push(branche(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.35, 0), 0.03, 0.02));
  for (const s of [-1, 1]) {
    const f = new THREE.SphereGeometry(0.13, 6, 4);
    f.scale(1, 0.3, 0.55);
    f.translate(s * 0.13, 0.38, 0);
    f.rotateZ(-s * 0.25);
    g.push(f);
  }
  const m = mergeGeometries(g.map((x) => {
    x.deleteAttribute("uv");
    return x.index ? x.toNonIndexed() : x;
  }))!;
  colorer(m, (p) => (p.y < 0.3 ? new THREE.Color(0.35, 0.55, 0.2) : new THREE.Color(0.45, 0.8, 0.25)));
  return m;
}

interface ArbreVu {
  arbre: Arbre;
  groupe: THREE.Group;
  tronc: THREE.Mesh;
  feuillage: THREE.Mesh;
  fruits: THREE.Mesh | null;
  pousse: THREE.Mesh;
  vu: number;
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const easeOutElastic = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

export class RenduArbres {
  readonly groupe = new THREE.Group();
  private readonly vus = new Map<number, ArbreVu>();
  private readonly matTronc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  private readonly matFeuilles = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  readonly matFruits = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 0.4, roughness: 0.4 });
  private readonly geoPousse = geometriePousse();

  constructor(private readonly monde: Monde) {
    balancer(this.matTronc, 0.012);
    balancer(this.matFeuilles, 0.018);
    balancer(this.matFruits, 0.018);
  }

  private creer(a: Arbre) {
    const f = construireForme(a.espece, a.forme);
    const groupe = new THREE.Group();
    const pos = this.monde.surface(a.dir);
    groupe.position.copy(pos);
    groupe.quaternion.setFromUnitVectors(HAUT, a.dir);
    groupe.rotateY((a.forme % 628) / 100);
    const tronc = new THREE.Mesh(f.tronc, this.matTronc);
    const feuillage = new THREE.Mesh(f.feuillage, this.matFeuilles);
    const fruits = f.fruits ? new THREE.Mesh(f.fruits, this.matFruits) : null;
    const pousse = new THREE.Mesh(this.geoPousse, this.matTronc);
    for (const m of [tronc, feuillage, fruits, pousse]) {
      if (!m) continue;
      m.castShadow = true;
      m.receiveShadow = true;
      groupe.add(m);
    }
    // Les fruits pendent aux branches : ils suivent le feuillage.
    if (fruits) {
      feuillage.add(fruits);
      fruits.castShadow = false;
    }
    this.groupe.add(groupe);
    const v: ArbreVu = { arbre: a, groupe, tronc, feuillage, fruits, pousse, vu: 0 };
    this.vus.set(a.id, v);
    return v;
  }

  maj(dt: number) {
    for (const a of this.monde.arbres) {
      const v = this.vus.get(a.id) ?? this.creer(a);
      // L'affichage rattrape la croissance avec douceur (et un temps de plus pour l'élan des rebonds).
      v.vu += (a.croissance - v.vu) * Math.min(1, dt * 3);
      const c = v.vu;
      const pousse = lisse(0, 0.08, c) * (1 - lisse(0.18, 0.3, c));
      v.pousse.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, pousse)) * 1.4));
      v.pousse.visible = pousse > 0.01;
      const t = lisse(0.15, 1, c);
      const s = Math.max(0.001, easeOutBack(t) * (0.55 + 0.45 * t));
      v.tronc.scale.setScalar(s);
      v.tronc.visible = t > 0.001;
      const ft = Math.min(1, Math.max(0, (c - 0.3) / 0.6));
      const fs = Math.max(0.001, easeOutElastic(ft) * s);
      v.feuillage.scale.setScalar(fs);
      v.feuillage.visible = ft > 0.001;
      // Le sol peut avoir été creusé sous l'arbre
      if (Math.random() < 0.02) this.monde.surface(a.dir, v.groupe.position);
    }
    // Les arbres disparus (aucun pour l'instant, mais au cas où)
    if (this.vus.size > this.monde.arbres.length) {
      const ids = new Set(this.monde.arbres.map((a) => a.id));
      for (const [id, v] of this.vus) {
        if (!ids.has(id)) {
          this.groupe.remove(v.groupe);
          this.vus.delete(id);
        }
      }
    }
  }

  /** Position du sommet du feuillage d'un arbre (pour les oiseaux, les effets). */
  cime(a: Arbre, cible = new THREE.Vector3()) {
    return cible.copy(a.dir).multiplyScalar(R + this.monde.sol[a.noeud] + 2.6 * a.croissance);
  }

  nuit(n: number) {
    this.matFruits.emissiveIntensity = 0.3 + n * 2.2;
  }
}
