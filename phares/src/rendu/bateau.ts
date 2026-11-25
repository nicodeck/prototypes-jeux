// Le voilier « L'Étincelle » : coque bordée, cabine aux hublots chauds,
// grand-voile et foc gonflés par le vent, lanterne au mât.
// Repère local : l'avant est vers -z, la flottaison à y = 0.

import * as THREE from "three";
import { creerLueur } from "./lueur";

const LONG_ARRIERE = 3.2;
const LONG_AVANT = -3.7;
const MAT_Z = -1.0;
const HAUTEUR_MAT = 9.5;
const BOME_Y = 1.35;
const LONG_BOME = 3.9;

function demiLargeur(t: number) {
  return 1.42 * Math.pow(Math.sin(Math.PI * (0.25 + 0.75 * t)), 0.75);
}
function hauteurPlatBord(t: number) {
  return 0.8 + 0.4 * t * t;
}
function profondeurQuille(t: number) {
  return -0.6 * (1 - Math.pow(t, 3)) - 0.05;
}

function coque() {
  const S = 28;
  const M = 18;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const peinture = new THREE.Color(0.02, 0.05, 0.07);
  const antifouling = new THREE.Color(0.22, 0.035, 0.025);
  const listel = new THREE.Color(0.3, 0.18, 0.09);
  for (let s = 0; s <= S; s++) {
    const t = s / S;
    const z = THREE.MathUtils.lerp(LONG_ARRIERE, LONG_AVANT, t);
    const w = demiLargeur(t);
    const g = hauteurPlatBord(t);
    const d = profondeurQuille(t);
    for (let m = 0; m <= M; m++) {
      const a = (m / M - 0.5) * Math.PI;
      const sa = Math.sin(a);
      const x = w * Math.sign(sa) * Math.pow(Math.abs(sa), 0.65);
      const y = g - (g - d) * Math.pow(Math.cos(a), 0.35);
      pos.push(x, y, z);
      const c = y > g - 0.06 ? listel : y < 0.08 ? antifouling : peinture;
      col.push(c.r, c.g, c.b);
    }
  }
  const l = M + 1;
  for (let s = 0; s < S; s++) {
    for (let m = 0; m < M; m++) {
      const a = s * l + m;
      idx.push(a, a + 1, a + l, a + 1, a + l + 1, a + l);
    }
  }
  // tableau arrière
  const base = pos.length / 3;
  let cx = 0;
  let cy = 0;
  for (let m = 0; m <= M; m++) {
    cx += pos[m * 3];
    cy += pos[m * 3 + 1];
  }
  pos.push(cx / l, cy / l + 0.2, LONG_ARRIERE);
  col.push(peinture.r, peinture.g, peinture.b);
  for (let m = 0; m < M; m++) idx.push(base, m + 1, m);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function pont() {
  const S = 24;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s <= S; s++) {
    const t = s / S;
    const z = THREE.MathUtils.lerp(LONG_ARRIERE, LONG_AVANT, t);
    const w = demiLargeur(t) * 0.96;
    const g = hauteurPlatBord(t) - 0.08;
    pos.push(-w, g, z, w, g, z);
  }
  for (let s = 0; s < S; s++) {
    const a = s * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Une voile triangulaire en grille, déformée à chaque image. */
class Voile {
  mesh: THREE.Mesh;
  private n = 10;
  private geo: THREE.BufferGeometry;

  constructor(mat: THREE.Material) {
    const n = this.n;
    const pos = new Float32Array((n + 1) * (n + 1) * 3);
    const idx: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  /** amure (A), têtière (T), point d'écoute (E) ; creux le long de la normale ; faseyement. */
  deformer(A: THREE.Vector3, T: THREE.Vector3, E: THREE.Vector3, creux: number, faseye: number, temps: number) {
    const n = this.n;
    const p = this.geo.getAttribute("position") as THREE.BufferAttribute;
    const u1 = new THREE.Vector3().subVectors(E, A);
    const v1 = new THREE.Vector3().subVectors(T, A);
    const normale = new THREE.Vector3().crossVectors(v1, u1).normalize();
    const q = new THREE.Vector3();
    for (let j = 0; j <= n; j++) {
      const v = j / n;
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * (1 - v);
        q.copy(A).addScaledVector(u1, u).addScaledVector(v1, v);
        const largeur = 1 - v;
        const uu = largeur > 0.001 ? u / largeur : 0;
        const forme = 4 * uu * (1 - uu) * Math.pow(largeur, 0.6);
        const ondule = Math.sin(temps * 17 + uu * 9 + v * 4) * Math.sin(temps * 5.3 + v * 3) * faseye * 0.35 * uu;
        q.addScaledVector(normale, forme * creux + ondule);
        p.setXYZ(j * (n + 1) + i, q.x, q.y, q.z);
      }
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

export class ModeleBateau {
  racine = new THREE.Group(); // position + cap
  assiette = new THREE.Group(); // tangage + roulis
  lanternePos = new THREE.Vector3();
  lumiere: THREE.PointLight;
  private bome = new THREE.Group();
  private grandVoile: Voile;
  private foc: Voile;
  private flamme: THREE.Mesh;
  private verreLanterne: THREE.MeshBasicMaterial;
  private halo: THREE.Sprite;
  private lanterne = new THREE.Group();
  private toile: THREE.MeshStandardMaterial;

  constructor() {
    this.racine.add(this.assiette);
    const a = this.assiette;

    const matCoque = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    a.add(new THREE.Mesh(coque(), matCoque));
    const matPont = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.32, 0.2, 0.11), roughness: 0.7 });
    a.add(new THREE.Mesh(pont(), matPont));

    // cabine
    const bois = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.38, 0.24, 0.13), roughness: 0.6 });
    const blanc = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.52, 0.46), roughness: 0.6 });
    const cabine = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.3), blanc);
    cabine.position.set(0, 1.15, 0.55);
    a.add(cabine);
    const toit = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 2.45), bois);
    toit.position.set(0, 1.5, 0.55);
    a.add(toit);
    const hublot = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 0.55, 0.2), emissiveIntensity: 2.5 });
    for (const cote of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), hublot);
        h.position.set(cote * 0.86, 1.17, -0.2 + k * 0.7);
        h.rotation.y = (cote * Math.PI) / 2;
        a.add(h);
      }
    }
    // barre franche
    const barre = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.3), bois);
    barre.position.set(0, 1.05, 2.6);
    a.add(barre);

    // mât, bôme, gréement
    const matBois = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.25, 0.16, 0.09), roughness: 0.6 });
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, HAUTEUR_MAT, 8), matBois);
    mat.position.set(0, 0.9 + HAUTEUR_MAT / 2, MAT_Z);
    a.add(mat);
    const bomeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, LONG_BOME, 6), matBois);
    bomeMesh.rotation.x = Math.PI / 2;
    bomeMesh.position.z = LONG_BOME / 2;
    this.bome.add(bomeMesh);
    this.bome.position.set(0, 0.9 + BOME_Y, MAT_Z);
    a.add(this.bome);

    const tete = new THREE.Vector3(0, 0.9 + HAUTEUR_MAT - 0.2, MAT_Z);
    const cordage: number[] = [];
    const relier = (p: THREE.Vector3, q: THREE.Vector3) => cordage.push(p.x, p.y, p.z, q.x, q.y, q.z);
    relier(tete, new THREE.Vector3(0, 1.2, LONG_AVANT));
    relier(tete, new THREE.Vector3(0, 1.0, LONG_ARRIERE));
    relier(tete, new THREE.Vector3(1.35, 0.95, MAT_Z + 0.3));
    relier(tete, new THREE.Vector3(-1.35, 0.95, MAT_Z + 0.3));
    const geoCordage = new THREE.BufferGeometry();
    geoCordage.setAttribute("position", new THREE.Float32BufferAttribute(cordage, 3));
    a.add(new THREE.LineSegments(geoCordage, new THREE.LineBasicMaterial({ color: 0x1a1612 })));

    // voiles
    const toile = (this.toile = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.78, 0.7, 0.56),
      roughness: 0.85,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0.06, 0.035, 0.015),
    }));
    this.grandVoile = new Voile(toile);
    a.add(this.grandVoile.mesh);
    this.foc = new Voile(toile);
    a.add(this.foc.mesh);

    // flamme en tête de mât (indique le vent)
    const geoFlamme = new THREE.BufferGeometry();
    geoFlamme.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.12, 0, 0, -0.12, 0, 0, 0, 1.1], 3));
    geoFlamme.computeVertexNormals();
    this.flamme = new THREE.Mesh(geoFlamme, new THREE.MeshStandardMaterial({ color: 0x8a1a10, side: THREE.DoubleSide, emissive: 0x200402 }));
    this.flamme.position.copy(tete).add(new THREE.Vector3(0, 0.35, 0));
    a.add(this.flamme);

    // lanterne accrochée au mât, côté avant
    const fer = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.4, metalness: 0.7 });
    this.verreLanterne = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 4.2, 1.6) });
    const verre = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 10), this.verreLanterne);
    this.lanterne.add(verre);
    const chapeau = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.16, 10), fer);
    chapeau.position.y = 0.22;
    this.lanterne.add(chapeau);
    const fond = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.06, 10), fer);
    fond.position.y = -0.17;
    this.lanterne.add(fond);
    for (let k = 0; k < 4; k++) {
      const barreau = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.3, 0.025), fer);
      const ang = (k / 4) * Math.PI * 2 + 0.4;
      barreau.position.set(Math.cos(ang) * 0.15, 0, Math.sin(ang) * 0.15);
      this.lanterne.add(barreau);
    }
    this.halo = creerLueur(new THREE.Color(1, 0.6, 0.25), 3.2);
    this.lanterne.add(this.halo);
    this.lanterne.position.set(0, 0.9 + 2.3, MAT_Z - 0.32);
    a.add(this.lanterne);

    this.lumiere = new THREE.PointLight(new THREE.Color(1.0, 0.58, 0.24), 16, 70, 1.7);
    this.lumiere.position.copy(this.lanterne.position).add(new THREE.Vector3(0, -0.05, -0.1));
    a.add(this.lumiere);

    this.racine.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = false;
    });
  }

  /**
   * angleBome : angle de la bôme par rapport à l'axe (rad, + vers bâbord) ;
   * creux : gonflement des voiles (signé selon l'amure) ; faseye : 0..1 ; hisse : 0..1 voile hissée.
   */
  maj(temps: number, angleBome: number, creux: number, faseye: number, hisse: number, ventRelatif: number, lanterne: number) {
    this.bome.rotation.y = angleBome;
    const mat = new THREE.Vector3(0, 0.9 + BOME_Y, MAT_Z);
    const hauteurVoile = (HAUTEUR_MAT - BOME_Y - 0.5) * (0.12 + 0.88 * hisse);
    const tete = mat.clone().add(new THREE.Vector3(0, hauteurVoile, 0));
    const ecoute = mat.clone().add(new THREE.Vector3(Math.sin(angleBome) * LONG_BOME, 0, Math.cos(angleBome) * LONG_BOME));
    this.grandVoile.deformer(mat, tete, ecoute, creux * hisse, faseye, temps);
    this.grandVoile.mesh.visible = hisse > 0.02;

    const amure = new THREE.Vector3(0, 1.25, LONG_AVANT + 0.15);
    const teteFoc = new THREE.Vector3(0, 0.9 + HAUTEUR_MAT * 0.78, MAT_Z - 0.05);
    const angleFoc = angleBome * 0.75;
    const ecouteFoc = new THREE.Vector3(Math.sin(angleFoc) * 2.3, 1.25, LONG_AVANT + 0.15 + Math.cos(angleFoc) * 2.3);
    const teteReelle = amure.clone().lerp(teteFoc, 0.15 + 0.85 * hisse);
    this.foc.deformer(amure, teteReelle, ecouteFoc, -creux * 0.8 * hisse, faseye, temps + 1.3);
    this.foc.mesh.visible = hisse > 0.02;

    // la flamme flotte sous le vent (ventRelatif : direction vers laquelle souffle le vent, repère bateau)
    this.flamme.rotation.y = ventRelatif + Math.sin(temps * 13) * 0.12;
    this.flamme.rotation.z = Math.sin(temps * 9.1) * 0.25;

    const scintille = 0.85 + 0.15 * Math.sin(temps * 23) * Math.sin(temps * 7.7);
    const l = lanterne * scintille;
    this.verreLanterne.color.setRGB(8 * l + 0.05, 4.2 * l + 0.03, 1.6 * l + 0.02);
    this.halo.visible = l > 0.01;
    this.halo.scale.setScalar(3.4 * (0.6 + 0.4 * l));
    (this.halo.material as THREE.SpriteMaterial).opacity = l;
    this.lumiere.intensity = 16 * l;
    this.toile.emissiveIntensity = l; // la toile ne rougeoie que sous la lanterne
    this.lanterne.rotation.z = Math.sin(temps * 2.1) * 0.15;
    this.lanterne.rotation.x = Math.sin(temps * 1.7) * 0.1;
    this.lanterne.getWorldPosition(this.lanternePos);
  }
}
