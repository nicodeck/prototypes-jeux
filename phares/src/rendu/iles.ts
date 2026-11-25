// Le relief : îles à facettes, sapins sombres, récifs luisants,
// et la carte des hauteurs qui sert à l'écume du rivage dans le shader de l'océan.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ILES, Ile, Rocher, hauteurIle, hauteurTerrain } from "../monde/archipel";
import { aleatoire, bruit2, clamp, entre, fbm2, smoothstep } from "../outils/maths";

export const ZONE_TERRAIN = { xmin: -960, zmin: -960, taille: 1920, resolution: 640 };

/** Carte des hauteurs encodée sur 8 bits : h = v * 24 - 12. */
export function texturerTerrain() {
  const { xmin, zmin, taille, resolution: n } = ZONE_TERRAIN;
  const donnees = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = xmin + ((i + 0.5) / n) * taille;
      const z = zmin + ((j + 0.5) / n) * taille;
      const h = hauteurTerrain(x, z);
      donnees[j * n + i] = Math.round(clamp((h + 12) / 24, 0, 1) * 255);
    }
  }
  const tex = new THREE.DataTexture(donnees, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { texture: tex, zone: new THREE.Vector3(xmin, zmin, taille) };
}

const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const ROCHE_MOUILLEE = C(0.035, 0.032, 0.03);
const ROCHE = C(0.11, 0.1, 0.095);
const ROCHE_CLAIRE = C(0.2, 0.19, 0.17);
const LANDE = C(0.045, 0.065, 0.035);
const HERBE = C(0.09, 0.1, 0.045);
const SABLE = C(0.16, 0.14, 0.1);

function couleurSol(h: number, pente: number, x: number, z: number, c: THREE.Color) {
  const n = bruit2(x * 0.08, z * 0.08) * 0.5 + 0.5;
  if (h < 0.8) return c.copy(ROCHE_MOUILLEE).lerp(SABLE, smoothstep(-0.5, 0.8, h) * 0.4 * n);
  c.copy(ROCHE).lerp(ROCHE_CLAIRE, n * 0.6);
  const vert = smoothstep(0.75, 0.45, pente) * smoothstep(1.5, 4, h);
  const tmp = new THREE.Color().copy(LANDE).lerp(HERBE, bruit2(x * 0.03 + 7, z * 0.03) * 0.5 + 0.5);
  return c.lerp(tmp, vert);
}

function geometrieIle(ile: Ile) {
  const etendue = ile.rayon * 1.45 * ile.etirement + 10;
  const pas = ile.ilot ? 1.6 : ile.rayon > 120 ? 4.2 : 3.2;
  const n = Math.ceil((etendue * 2) / pas);
  const pos: number[] = [];
  const hauteurs: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = ile.x - etendue + (i / n) * etendue * 2;
      const z = ile.z - etendue + (j / n) * etendue * 2;
      const h = hauteurIle(ile, x, z);
      pos.push(x, h, z);
      hauteurs.push(h);
    }
  }
  const idx: number[] = [];
  const l = n + 1;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * l + i;
      const coins = [a, a + 1, a + l, a + l + 1];
      if (coins.every((k) => hauteurs[k] < -7)) continue;
      idx.push(a, a + l, a + 1, a + 1, a + l, a + l + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const plat = geo.toNonIndexed();
  plat.computeVertexNormals();
  // couleur par facette
  const p = plat.getAttribute("position");
  const nrm = plat.getAttribute("normal");
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    couleurSol(cy, 1 - nrm.getY(t), cx, cz, c);
    const v = 0.85 + Math.random() * 0.3;
    for (let k = 0; k < 3; k++) col.set([c.r * v, c.g * v, c.b * v], (t + k) * 3);
  }
  plat.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return plat;
}

function sapin(r: () => number) {
  const h = entre(r, 4, 9);
  const geos: THREE.BufferGeometry[] = [];
  const etages = 3;
  for (let i = 0; i < etages; i++) {
    const rayon = (h * 0.32 * (etages - i)) / etages + 0.4;
    const cone = new THREE.ConeGeometry(rayon, h * 0.5, 7);
    cone.translate(0, h * 0.25 + (i * h * 0.5) / etages + 0.8, 0);
    geos.push(cone.index ? cone.toNonIndexed() : cone);
  }
  const tronc = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 5).toNonIndexed();
  tronc.translate(0, 0.5, 0);
  geos.push(tronc);
  for (const g of geos) {
    g.deleteAttribute("uv");
  }
  return mergeGeometries(geos)!;
}

function geometrieRocher(ro: Rocher) {
  const r = aleatoire(Math.floor(ro.graine * 1000));
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm2(v.x * 1.7 + ro.graine, v.z * 1.7 + v.y * 1.3, 3);
    v.multiplyScalar(1 + n * 0.45);
    // sommet en pointe ou en table
    if (v.y > 0) v.y *= 1 + bruit2(v.x * 2 + ro.graine, v.z * 2) * 0.4;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const hauteurTotale = Math.max(ro.h, -0.3) + 5;
  geo.scale(ro.r * entre(r, 0.9, 1.25), hauteurTotale / 2, ro.r * entre(r, 0.9, 1.25));
  geo.rotateY(r() * Math.PI * 2);
  geo.translate(ro.x, ro.h - hauteurTotale / 2, ro.z);
  const plat = geo.index ? geo.toNonIndexed() : geo;
  plat.computeVertexNormals();
  const pp = plat.getAttribute("position");
  const col = new Float32Array(pp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pp.count; i += 3) {
    const y = (pp.getY(i) + pp.getY(i + 1) + pp.getY(i + 2)) / 3;
    if (y < 0.6) c.setRGB(0.02, 0.03, 0.022); // algues
    else c.copy(ROCHE_MOUILLEE).lerp(ROCHE, smoothstep(0.6, 3, y) * 0.6);
    const k = 0.8 + Math.random() * 0.4;
    for (let j = 0; j < 3; j++) col.set([c.r * k, c.g * k, c.b * k], (i + j) * 3);
  }
  plat.setAttribute("color", new THREE.BufferAttribute(col, 3));
  plat.deleteAttribute("uv");
  return plat;
}

export function creerIles(rochers: Rocher[]) {
  const groupe = new THREE.Group();
  const matSol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  for (const ile of ILES) {
    const m = new THREE.Mesh(geometrieIle(ile), matSol);
    groupe.add(m);
  }

  // sapins
  const r = aleatoire(99);
  const modeles = [sapin(r), sapin(r), sapin(r)];
  const matSapin = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.018, 0.04, 0.025), roughness: 0.95, flatShading: true });
  const placements: THREE.Matrix4[][] = [[], [], []];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const ile of ILES) {
    if (!ile.arbres) continue;
    const nb = Math.floor(((ile.rayon * ile.rayon) / 140) * ile.arbres);
    for (let k = 0; k < nb; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * ile.rayon * 1.2;
      const x = ile.x + Math.cos(a) * d * ile.etirement;
      const z = ile.z + Math.sin(a) * d;
      const h = hauteurIle(ile, x, z);
      if (h < 2.5) continue;
      const pente = Math.abs(hauteurIle(ile, x + 2, z) - h) + Math.abs(hauteurIle(ile, x, z + 2) - h);
      if (pente > 2.6) continue;
      // bosquets : densité modulée par le bruit
      if (bruit2(x * 0.02, z * 0.02) < -0.15) continue;
      const s = entre(r, 0.7, 1.4);
      e.set((r() - 0.5) * 0.15, r() * 6, (r() - 0.5) * 0.15);
      q.setFromEuler(e);
      placements[k % 3].push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.5, z), q, new THREE.Vector3(s, s * entre(r, 0.85, 1.3), s)));
    }
  }
  placements.forEach((liste, i) => {
    const inst = new THREE.InstancedMesh(modeles[i], matSapin, liste.length);
    liste.forEach((m, k) => inst.setMatrixAt(k, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    groupe.add(inst);
  });

  // récifs
  const matRoche = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05, flatShading: true });
  const geos = rochers.map(geometrieRocher);
  if (geos.length) {
    const recifs = new THREE.Mesh(mergeGeometries(geos)!, matRoche);
    groupe.add(recifs);
  }
  return groupe;
}
