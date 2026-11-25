// La vie de l'île : les passants dans les rues (et leurs lanternes la nuit), les charrettes qui
// livrent, les barques de pêche qui sortent à l'aube et rentrent au crépuscule, le grand navire
// marchand, les mouettes au-dessus du port, les martinets du soir, les chèvres sur les collines,
// l'âne qui tourne la meule, et parfois des dauphins à l'entrée de la baie.
//
// Tout est cosmétique, sauf les charrettes et le navire, qui viennent de la simulation.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Marchandise } from "../ville/catalogue";
import { hachage } from "../ville/hasard";
import { hauteur, indice, TAILLE } from "../ville/ile";
import { chemin, type Case } from "../ville/routes";
import { DUREES_NAVIRE, type Batiment, type Ville } from "../ville/ville";
import { ATMO, patcher } from "./atmosphere";
import type { EmetteurMonde } from "./batiments";

// ---------------------------------------------------------------------------------------------
// Les petits modèles
// ---------------------------------------------------------------------------------------------

/** Couleur « à remplacer » : la tunique, la voile ou la cargaison prennent la couleur de l'instance */
const TEINTE = 0xff00ff;

function boite(l: number, h: number, p: number, couleur: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(l, h, p);
  g.rotateX(rx).rotateY(ry).rotateZ(rz);
  g.translate(x, y, z);
  return teindre(g, couleur);
}

function teindre(g: THREE.BufferGeometry, couleur: number) {
  // On ne garde que la position (et l'attribut d'aile des oiseaux), plus la couleur
  const src = g.index ? g.toNonIndexed() : g;
  const r = new THREE.BufferGeometry();
  r.setAttribute("position", src.attributes.position!);
  if (src.attributes.aAile) r.setAttribute("aAile", src.attributes.aAile);
  const c = new THREE.Color(couleur);
  const n = src.attributes.position!.count;
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) col.set(couleur === TEINTE ? [1, 0, 1] : [c.r, c.g, c.b], k * 3);
  r.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return r;
}

function forme(geo: THREE.BufferGeometry, couleur: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  return teindre(geo, couleur);
}

const fusion = (g: THREE.BufferGeometry[]) => {
  const r = mergeGeometries(g, false)!;
  r.computeVertexNormals();
  return r;
};

function passant() {
  const peau = 0xb07a55;
  return fusion([
    boite(0.07, 0.2, 0.07, 0x4a3426, -0.04, 0.1, 0),
    boite(0.07, 0.2, 0.07, 0x4a3426, 0.04, 0.1, 0),
    forme(new THREE.CylinderGeometry(0.075, 0.12, 0.3, 6), TEINTE, 0, 0.33, 0),
    forme(new THREE.SphereGeometry(0.065, 6, 5), peau, 0, 0.55, 0),
    boite(0.05, 0.22, 0.05, TEINTE, -0.11, 0.37, 0, 0, 0, 0.2),
    boite(0.05, 0.22, 0.05, TEINTE, 0.11, 0.37, 0, 0, 0, -0.2),
  ]);
}

function charrette() {
  const bois = 0x6b4a2e;
  const g = [
    boite(0.42, 0.08, 0.7, bois, 0, 0.26, 0),
    boite(0.04, 0.12, 0.7, bois, -0.21, 0.34, 0),
    boite(0.04, 0.12, 0.7, bois, 0.21, 0.34, 0),
    forme(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10).rotateZ(Math.PI / 2), 0x4a3422, -0.25, 0.17, 0),
    forme(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10).rotateZ(Math.PI / 2), 0x4a3422, 0.25, 0.17, 0),
    boite(0.03, 0.03, 0.55, bois, -0.08, 0.24, 0.55),
    boite(0.03, 0.03, 0.55, bois, 0.08, 0.24, 0.55),
    // La cargaison (teinte)
    boite(0.34, 0.16, 0.5, TEINTE, 0, 0.41, -0.02),
    // L'âne
    boite(0.16, 0.18, 0.42, 0x6e665c, 0, 0.36, 0.95),
    boite(0.1, 0.12, 0.2, 0x6e665c, 0, 0.5, 1.18, -0.6),
    boite(0.03, 0.1, 0.03, 0x5a524a, -0.03, 0.6, 1.14),
    boite(0.03, 0.1, 0.03, 0x5a524a, 0.03, 0.6, 1.14),
    ...[-0.06, 0.06].flatMap((x) => [boite(0.04, 0.25, 0.04, 0x4e473f, x, 0.13, 0.8), boite(0.04, 0.25, 0.04, 0x4e473f, x, 0.13, 1.1)]),
  ];
  return fusion(g);
}

function barque() {
  // Une coque effilée, un mât, une voile latine (teinte)
  const coque = new THREE.CylinderGeometry(0.22, 0.12, 1.3, 10, 1, false, 0, Math.PI);
  coque.rotateZ(Math.PI / 2).rotateY(Math.PI / 2).rotateZ(Math.PI);
  const pos = coque.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const z = pos.getZ(k);
    const f = 1 - Math.pow(Math.abs(z) / 0.65, 3) * 0.75;
    pos.setX(k, pos.getX(k) * f);
  }
  const voile = new THREE.BufferGeometry();
  voile.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.2, -0.35, 0, 1.35, 0.25, 0, 0.25, 0.55, 0, 0.2, -0.35, 0, 0.25, 0.55, 0, 1.35, 0.25], 3));
  return fusion([
    teindre(coque.translate(0, 0.12, 0), 0x6a4630),
    boite(0.26, 0.03, 1.0, 0x8a6a48, 0, 0.13, 0),
    boite(0.03, 1.1, 0.03, 0x5a3a24, 0, 0.6, 0.05),
    teindre(voile, TEINTE),
  ]);
}

function navire() {
  // Une corbita : coque ventrue, poupe en cou de cygne, grande voile carrée rayée
  const g: THREE.BufferGeometry[] = [];
  const coque = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  coque.scale(0.95, 0.75, 3.2);
  g.push(teindre(coque.translate(0, 0.55, 0), 0x5e3e28));
  g.push(boite(1.7, 0.08, 5.6, 0x8a6a48, 0, 0.55, 0));
  g.push(boite(1.8, 0.18, 5.8, 0x4a3020, 0, 0.5, 0));
  // Le cou de cygne à la poupe
  const cou = new THREE.TorusGeometry(0.45, 0.09, 6, 10, Math.PI * 1.2);
  cou.rotateY(Math.PI / 2).rotateX(-0.3);
  g.push(teindre(cou.translate(0, 1.15, -3.0), 0xc9a65a));
  g.push(boite(1.2, 0.5, 1.0, 0x6a4a32, 0, 0.85, -2.2));
  g.push(boite(0.08, 4.2, 0.08, 0x4a3020, 0, 2.6, 0.2));
  g.push(boite(3.2, 0.07, 0.07, 0x4a3020, 0, 4.4, 0.25));
  g.push(boite(0.05, 0.05, 1.6, 0x4a3020, 0, 1.3, 3.2, 0.5));
  // La voile (teinte) : un drap bombé
  const voile = new THREE.PlaneGeometry(3.0, 2.8, 6, 6);
  const pv = voile.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pv.count; k++) {
    const x = pv.getX(k);
    const y = pv.getY(k);
    pv.setZ(k, (1 - (x / 1.5) ** 2) * (1 - (y / 1.4) ** 2) * 0.45);
  }
  g.push(teindre(voile.translate(0, 2.95, 0.32), TEINTE));
  const voile2 = voile.clone().rotateY(Math.PI);
  g.push(teindre(voile2, TEINTE));
  // Des amphores sur le pont
  for (let k = 0; k < 6; k++) g.push(forme(new THREE.CylinderGeometry(0.08, 0.06, 0.3, 6), 0xa85a34, -0.4 + (k % 3) * 0.4, 0.75, 0.9 + Math.floor(k / 3) * 0.45));
  return fusion(g);
}

function oiseau() {
  const g = new THREE.BufferGeometry();
  // Deux ailes en V, articulées au corps (les sommets d'aile ont y = 1 dans l'attribut aAile)
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.12, -0.42, 0, -0.02, 0, 0, -0.1, 0, 0, 0.12, 0, 0, -0.1, 0.42, 0, -0.02, 0, -0.02, 0.18, 0, -0.03, -0.2, 0.04, -0.01, 0], 3));
  g.setAttribute("aAile", new THREE.Float32BufferAttribute([0, 1, 0, 0, 0, 1, 0, 0, 0], 1));
  const r = teindre(g, 0xeeeeee);
  r.computeVertexNormals();
  return r;
}

function chevre() {
  return fusion([
    boite(0.12, 0.13, 0.3, TEINTE, 0, 0.2, 0),
    boite(0.08, 0.1, 0.14, TEINTE, 0, 0.3, 0.19, -0.5),
    boite(0.02, 0.08, 0.02, 0x3a3028, -0.025, 0.38, 0.17, -0.5),
    boite(0.02, 0.08, 0.02, 0x3a3028, 0.025, 0.38, 0.17, -0.5),
    ...[-0.04, 0.04].flatMap((x) => [boite(0.03, 0.15, 0.03, 0x4a3e34, x, 0.07, -0.1), boite(0.03, 0.15, 0.03, 0x4a3e34, x, 0.07, 0.1)]),
  ]);
}

function dauphin() {
  const corps = new THREE.SphereGeometry(1, 10, 6);
  corps.scale(0.18, 0.18, 0.75);
  const aileron = new THREE.ConeGeometry(0.08, 0.2, 4).translate(0, 0.22, -0.05);
  return fusion([teindre(corps, 0x5c6670), teindre(aileron, 0x4c565e), boite(0.4, 0.02, 0.12, 0x4c565e, 0, 0, -0.72)]);
}

// ---------------------------------------------------------------------------------------------
// Le matériau
// ---------------------------------------------------------------------------------------------

function materiauVie(cle: string, oiseaux = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: oiseaux ? THREE.DoubleSide : THREE.FrontSide });
  patcher(m, {
    cle,
    vertexDecl: `attribute vec3 aCouleur; attribute vec2 aAnim; varying vec3 vCouleur; ${oiseaux ? "attribute float aAile;" : ""}`,
    vertexDebut: /* glsl */ `
      #ifdef USE_INSTANCING
        vCouleur = aCouleur;
        ${
          oiseaux
            ? `transformed.y += aAile * sin(uTemps * aAnim.x + aAnim.y) * 0.28;`
            : `transformed.y += abs(sin(uTemps * aAnim.x + aAnim.y)) * 0.025 * step(0.01, aAnim.x);`
        }
      #else
        vCouleur = vec3(1.0);
      #endif
    `,
    fragDecl: "varying vec3 vCouleur;",
    fragCouleur: /* glsl */ `
      if (vColor.r > 0.99 && vColor.g < 0.01 && vColor.b > 0.99) diffuseColor.rgb = vCouleur;
    `,
  });
  return m;
}

class Troupe {
  readonly mesh: THREE.InstancedMesh;
  private readonly couleurs: THREE.InstancedBufferAttribute;
  private readonly anims: THREE.InstancedBufferAttribute;
  n = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, max: number, ombre = true) {
    this.couleurs = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.anims = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    geo.setAttribute("aCouleur", this.couleurs);
    geo.setAttribute("aAnim", this.anims);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.castShadow = ombre;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  debut() {
    this.n = 0;
  }

  ajouter(x: number, y: number, z: number, lacet: number, couleur: THREE.Color, anim = 0, phase = 0, echelle = 1, tangage = 0, roulis = 0) {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.e.set(tangage, lacet, roulis, "YXZ");
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.setScalar(echelle);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(this.n, this.m);
    this.couleurs.setXYZ(this.n, couleur.r, couleur.g, couleur.b);
    this.anims.setXY(this.n, anim, phase);
    this.n++;
  }

  fin() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.couleurs.needsUpdate = true;
    this.anims.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------
// La vie
// ---------------------------------------------------------------------------------------------

const TUNIQUES = [0xf0e8d8, 0xe8dcc0, 0xc85a3a, 0x3c5a8a, 0xb88a4a, 0x8a3a4a, 0xd8c8a0, 0x6a7a4a, 0xf4f0e6].map((c) => new THREE.Color(c));
const CARGAISONS: Partial<Record<Marchandise, number>> = { bois: 0x8a5a32, marbre: 0xf0eee8, poisson: 0x8aa0b0, ble: 0xd8b860, farine: 0xf0e8d8, pain: 0xc08848, olives: 0x5a6a30, huile: 0xb06038, raisin: 0x5a2a5a, vin: 0x8a2a2a };

interface Passant {
  chemin: Case[];
  t: number;
  vitesse: number;
  cote: number;
  couleur: THREE.Color;
  phase: number;
  lanterne: boolean;
}

interface Barque {
  peche: number;
  depart: THREE.Vector3;
  large: THREE.Vector3;
  couleur: THREE.Color;
  graine: number;
}

export class Vie {
  readonly groupe = new THREE.Group();
  private readonly passants: Troupe;
  private readonly charrettes: Troupe;
  private readonly barques: Troupe;
  private readonly navire: Troupe;
  private readonly oiseaux: Troupe;
  private readonly chevres: Troupe;
  private readonly anes: Troupe;
  private readonly dauphins: Troupe;
  private foule: Passant[] = [];
  private barquesListe: Barque[] = [];
  private cleBarques = "";
  private readonly lisses = new Map<number, THREE.Vector3>();
  private alea = 7;
  /** Les lanternes des passants la nuit, pour les halos */
  readonly lanternes: THREE.Vector3[] = [];
  private prochainDauphin = 20;
  private dauphinsT = -1;
  private dauphinsPos = new THREE.Vector3(70, 0, 118);

  constructor() {
    const mat = materiauVie("vie");
    this.passants = new Troupe(passant(), mat, 900, false);
    this.charrettes = new Troupe(charrette(), mat, 200);
    this.barques = new Troupe(barque(), mat, 80);
    this.navire = new Troupe(navire(), mat, 2);
    this.oiseaux = new Troupe(oiseau(), materiauVie("oiseaux", true), 220, false);
    this.chevres = new Troupe(chevre(), mat, 80);
    this.anes = new Troupe(fusion([boite(0.16, 0.18, 0.42, 0x6e665c, 0, 0.36, 0), boite(0.1, 0.12, 0.2, 0x6e665c, 0, 0.5, 0.23, -0.6), ...[-0.06, 0.06].flatMap((x) => [boite(0.04, 0.25, 0.04, 0x4e473f, x, 0.13, -0.15), boite(0.04, 0.25, 0.04, 0x4e473f, x, 0.13, 0.15)])]), mat, 60);
    this.dauphins = new Troupe(dauphin(), mat, 4, false);
    for (const t of [this.passants, this.charrettes, this.barques, this.navire, this.oiseaux, this.chevres, this.anes, this.dauphins]) this.groupe.add(t.mesh);
  }

  private hasard() {
    this.alea = (this.alea * 16807) % 2147483647;
    return this.alea / 2147483647;
  }

  mettreAJour(dt: number, v: Ville, emetteurs: EmetteurMonde[], temps: number) {
    const h = v.horloge.heure;
    const nuit = ATMO.uNuit.value;
    this.majPassants(dt, v, h, nuit);
    this.majCharrettes(dt, v);
    this.majBarques(v, h, temps);
    this.majNavire(v, temps);
    this.majOiseaux(v, h, temps);
    this.majChevres(v, temps);
    this.majAnes(emetteurs, temps);
    this.majDauphins(dt, temps);
  }

  // --- Les passants ---

  private majPassants(dt: number, v: Ville, h: number, nuit: number) {
    const pop = v.population().total;
    const pluie = v.horloge.ciel.pluie;
    const jour = h > 6 && h < 21 ? 1 : 0.12;
    const voulu = Math.min(900, Math.floor(Math.min(420, pop * 0.3) * jour * (1 - pluie * 0.7)));
    const maisons: Batiment[] = [];
    const lieux: Batiment[] = [];
    for (const b of v.batiments.values()) {
      if (b.chantier < 1) continue;
      if (b.type === "maison") maisons.push(b);
      else lieux.push(b);
    }
    // On complète la foule, quelques passants par image
    for (let k = 0; k < 6 && this.foule.length < voulu && maisons.length; k++) {
      const a = maisons[Math.floor(this.hasard() * maisons.length)]!;
      const b = this.hasard() < 0.55 && lieux.length ? lieux[Math.floor(this.hasard() * lieux.length)]! : maisons[Math.floor(this.hasard() * maisons.length)]!;
      const ch = chemin(v.routes, v.portes(a), v.portes(b));
      if (!ch || ch.length < 3) continue;
      this.foule.push({
        chemin: ch,
        t: this.hasard() * (ch.length - 1) * 0.5,
        vitesse: 0.45 + this.hasard() * 0.3,
        cote: (this.hasard() - 0.5) * 0.5,
        couleur: TUNIQUES[Math.floor(this.hasard() * TUNIQUES.length)]!,
        phase: this.hasard() * 10,
        lanterne: this.hasard() < 0.4,
      });
    }
    if (this.foule.length > voulu + 20) this.foule.length = voulu;
    this.passants.debut();
    this.lanternes.length = 0;
    const versRoute = v.versionRoutes;
    void versRoute;
    this.foule = this.foule.filter((p) => {
      p.t += p.vitesse * dt;
      if (p.t >= p.chemin.length - 1) return false;
      const k = Math.floor(p.t);
      const f = p.t - k;
      const a = p.chemin[k]!;
      const b = p.chemin[k + 1]!;
      if (!v.routes[indice(b.i, b.j)]) return false;
      const dx = b.i - a.i;
      const dz = b.j - a.j;
      // Ils tiennent leur droite
      const x = a.i + 0.5 + dx * f - dz * p.cote;
      const z = a.j + 0.5 + dz * f + dx * p.cote;
      const y = hauteur(x, z);
      this.passants.ajouter(x, y, z, Math.atan2(dx, dz), p.couleur, 9 * p.vitesse, p.phase);
      if (nuit > 0.5 && p.lanterne) this.lanternes.push(new THREE.Vector3(x + dz * 0.12, y + 0.42, z - dx * 0.12));
      return true;
    });
    this.passants.fin();
  }

  // --- Les charrettes ---

  private majCharrettes(dt: number, v: Ville) {
    this.charrettes.debut();
    const vues = new Set<number>();
    for (const c of v.charrettes) {
      const l = c.chemin.length - 1;
      if (l < 1) continue;
      const t = Math.min(c.t, l - 0.001);
      const k = Math.floor(t);
      const f = t - k;
      const a = c.chemin[k]!;
      const b = c.chemin[k + 1]!;
      const dx = b.i - a.i;
      const dz = b.j - a.j;
      const cible = new THREE.Vector3(a.i + 0.5 + dx * f - dz * 0.2, 0, a.j + 0.5 + dz * f + dx * 0.2);
      let lisse = this.lisses.get(c.id);
      if (!lisse) {
        lisse = cible.clone();
        this.lisses.set(c.id, lisse);
      }
      lisse.lerp(cible, 1 - Math.exp(-dt * 10));
      vues.add(c.id);
      const couleur = new THREE.Color(c.retour ? 0x6b4a2e : (CARGAISONS[c.charge] ?? 0x8a6a48));
      this.charrettes.ajouter(lisse.x, hauteur(lisse.x, lisse.z), lisse.z, Math.atan2(dx, dz), couleur, 0, 0, 0.9);
    }
    for (const id of this.lisses.keys()) if (!vues.has(id)) this.lisses.delete(id);
    this.charrettes.fin();
  }

  // --- Les barques de pêche ---

  private majBarques(v: Ville, h: number, temps: number) {
    const peches = [...v.batiments.values()].filter((b) => b.type === "peche" && b.chantier >= 1);
    const cle = peches.map((b) => b.id).join(",");
    if (cle !== this.cleBarques) {
      this.cleBarques = cle;
      this.barquesListe = [];
      for (const b of peches) {
        const a = (b.rotation * Math.PI) / 2;
        const cx = b.i + b.l / 2;
        const cz = b.j + b.p / 2;
        const devant = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const depart = new THREE.Vector3(cx + devant.x * 2.7, 0, cz + devant.z * 2.7);
        // Un coin de pêche au large, en eau profonde
        let large = depart.clone().addScaledVector(devant, 14);
        for (let essai = 0; essai < 12; essai++) {
          const ang = (hachage(b.id, essai, 1) - 0.5) * 1.6;
          const d = 10 + hachage(b.id, essai, 2) * 14;
          const p = depart.clone().add(devant.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).multiplyScalar(d));
          if (hauteur(p.x, p.z) < -2.5) {
            large = p;
            break;
          }
        }
        for (let k = 0; k < 2; k++) this.barquesListe.push({ peche: b.id, depart: depart.clone().add(new THREE.Vector3(k * 0.6, 0, 0)), large: large.clone().add(new THREE.Vector3(k * 2.5, 0, k * 1.7)), couleur: new THREE.Color(k ? 0xe8dcc0 : 0xd8a878), graine: hachage(b.id, k, 9) });
      }
    }
    this.barques.debut();
    const orage = v.horloge.ciel.orage;
    for (const bq of this.barquesListe) {
      // 0 au port, 1 au large ; on sort entre 6 h et 7 h 30, on rentre entre 17 h 30 et 19 h
      const decale = bq.graine * 0.8;
      let s = h < 6 + decale ? 0 : h < 7.5 + decale ? (h - 6 - decale) / 1.5 : h < 17.5 + decale ? 1 : h < 19 + decale ? 1 - (h - 17.5 - decale) / 1.5 : 0;
      s *= 1 - orage;
      const e = s * s * (3 - 2 * s);
      const p = bq.depart.clone().lerp(bq.large, e);
      // Au large, elle dérive lentement en rond
      p.x += Math.sin(temps * 0.05 + bq.graine * 20) * 2.5 * e;
      p.z += Math.cos(temps * 0.04 + bq.graine * 20) * 2.5 * e;
      const enRoute = s > 0.02 && s < 0.98;
      const dir = bq.large.clone().sub(bq.depart);
      const retour = h > 12;
      const lacet = enRoute ? Math.atan2(dir.x, dir.z) + (retour ? Math.PI : 0) : temps * 0.03 + bq.graine * 6;
      const houle = Math.sin(temps * 1.3 + bq.graine * 30);
      this.barques.ajouter(p.x, -0.05 + houle * 0.04, p.z, lacet, bq.couleur, 0, 0, 1, houle * 0.06, Math.sin(temps * 0.9 + bq.graine * 7) * 0.08);
    }
    this.barques.fin();
  }

  // --- Le navire marchand ---

  private majNavire(v: Ville, temps: number) {
    this.navire.debut();
    const n = v.navire;
    if (n) {
      // Il vient du large au sud, entre dans la baie, et accoste le long du quai
      const loin = new THREE.Vector3(30 + n.graine * 80, 0, 420);
      const entree = new THREE.Vector3(66, 0, 128);
      const quai = new THREE.Vector3(57.5, 0, 98.6);
      const bez = (t: number) => {
        const a = loin.clone().lerp(entree, t);
        const b = entree.clone().lerp(quai, t);
        return a.lerp(b, t);
      };
      let t = n.phase === "approche" ? n.t : n.phase === "amarre" ? 1 : 1 - n.t;
      t = 1 - Math.pow(1 - t, 2.2);
      const p = bez(t);
      const avant = bez(Math.min(1, t + 0.01)).sub(bez(Math.max(0, t - 0.01)));
      let lacet = Math.atan2(avant.x, avant.z) + (n.phase === "depart" ? Math.PI : 0);
      if (n.phase === "amarre") lacet = Math.PI / 2;
      else if (t > 0.9) lacet = THREE.MathUtils.lerp(lacet, Math.PI / 2, (t - 0.9) / 0.1);
      const houle = Math.sin(temps * 0.8);
      const voile = new THREE.Color(n.graine < 0.5 ? 0xf0e4c8 : 0xc84a32);
      this.navire.ajouter(p.x, -0.15 + houle * 0.05, p.z, lacet, voile, 0, 0, 1, houle * 0.025, Math.sin(temps * 0.6) * 0.035);
      void DUREES_NAVIRE;
    }
    this.navire.fin();
  }

  // --- Les oiseaux ---

  private majOiseaux(v: Ville, h: number, temps: number) {
    this.oiseaux.debut();
    const blanc = new THREE.Color(0xf4f4f0);
    const sombre = new THREE.Color(0x2a2622);
    // Les mouettes tournent au-dessus du port et des pêcheries
    const centres: THREE.Vector3[] = [];
    for (const b of v.batiments.values()) if (b.type === "port" || b.type === "peche") centres.push(new THREE.Vector3(b.i + b.l / 2, 0, b.j + b.p / 2 + 3));
    if (h > 5.5 && h < 20.5) {
      centres.forEach((c, k) => {
        const nb = k === 0 ? 14 : 5;
        for (let n = 0; n < nb; n++) {
          const g = hachage(k, n, 5);
          const r = 3 + g * 7;
          const w = (0.25 + g * 0.2) * (n % 2 ? 1 : -1);
          const a = temps * w + g * 40;
          const x = c.x + Math.cos(a) * r + Math.sin(temps * 0.1 + g * 9) * 3;
          const z = c.z + Math.sin(a) * r;
          const y = 3.5 + g * 5 + Math.sin(temps * 0.5 + g * 7);
          this.oiseaux.ajouter(x, y, z, a + (w > 0 ? 0 : Math.PI), blanc, 7 + g * 3, g * 30, 0.75, 0, w > 0 ? -0.35 : 0.35);
        }
      });
    }
    // Les martinets du soir : une nuée rapide au-dessus des toits
    const soir = Math.max(0, 1 - Math.abs(h - 19.2) / 1.3);
    if (soir > 0) {
      const maisons = [...v.batiments.values()].filter((b) => b.type === "maison");
      if (maisons.length) {
        let cx = 0;
        let cz = 0;
        for (const m of maisons) {
          cx += m.i + 1;
          cz += m.j + 1;
        }
        cx /= maisons.length;
        cz /= maisons.length;
        const nb = Math.floor(70 * soir);
        for (let n = 0; n < nb; n++) {
          const g = hachage(n, 3, 17);
          const a = temps * (1.2 + g) + g * 50;
          const r = 4 + g * 12 + Math.sin(temps * 0.7 + g * 13) * 4;
          const x = cx + Math.cos(a) * r + Math.sin(temps * 0.31 + g * 5) * 6;
          const z = cz + Math.sin(a * 1.3) * r;
          this.oiseaux.ajouter(x, 5 + g * 6 + Math.sin(a * 2) * 1.5, z, a + Math.PI / 2, sombre, 16, g * 20, 0.45, 0, -0.5);
        }
      }
    }
    this.oiseaux.fin();
  }

  // --- Les chèvres ---

  private majChevres(v: Ville, temps: number) {
    this.chevres.debut();
    const troupeaux = [
      { x: 30, z: 44 },
      { x: 68, z: 38 },
      { x: 24, z: 66 },
      { x: 100, z: 46 },
    ];
    const pelages = [0xf0ebe0, 0x7a5a3a, 0x2e2622, 0xc8b8a0].map((c) => new THREE.Color(c));
    troupeaux.forEach((t, k) => {
      for (let n = 0; n < 8; n++) {
        const g = hachage(k, n, 23);
        const g2 = hachage(n, k, 29);
        const cx = t.x + Math.sin(temps * 0.006 + k) * 5;
        const cz = t.z + Math.cos(temps * 0.005 + k * 2) * 5;
        const x = cx + (g - 0.5) * 6 + Math.sin(temps * 0.03 + g * 20) * 0.8;
        const z = cz + (g2 - 0.5) * 6 + Math.cos(temps * 0.025 + g2 * 20) * 0.8;
        const i = Math.floor(x);
        const j = Math.floor(z);
        if (i < 0 || j < 0 || i >= TAILLE || j >= TAILLE) continue;
        const kk = indice(i, j);
        if (v.occupation[kk] || v.routes[kk] || v.ile.sols[kk] === "eau") continue;
        const y = hauteur(x, z);
        if (y < 0.5) continue;
        this.chevres.ajouter(x, y, z, g * 6 + Math.sin(temps * 0.05 + g * 9), pelages[Math.floor(g2 * 4)]!, 0, 0, 1);
      }
    });
    this.chevres.fin();
  }

  // --- Les ânes des moulins ---

  private majAnes(emetteurs: EmetteurMonde[], temps: number) {
    this.anes.debut();
    const gris = new THREE.Color(1, 1, 1);
    for (const e of emetteurs) {
      if (e.sorte !== "ane") continue;
      const a = temps * 0.5 + e.batiment;
      const r = 0.48;
      this.anes.ajouter(e.pos.x + Math.cos(a) * r, e.pos.y, e.pos.z - Math.sin(a) * r, a + Math.PI, gris, 6, e.batiment, 0.9);
    }
    this.anes.fin();
  }

  // --- Les dauphins ---

  private majDauphins(dt: number, temps: number) {
    this.dauphins.debut();
    this.prochainDauphin -= dt;
    if (this.dauphinsT < 0 && this.prochainDauphin <= 0) {
      this.dauphinsT = 0;
      this.dauphinsPos.set(50 + this.hasard() * 40, 0, 112 + this.hasard() * 18);
      this.prochainDauphin = 50 + this.hasard() * 60;
    }
    if (this.dauphinsT >= 0) {
      this.dauphinsT += dt;
      const gris = new THREE.Color(1, 1, 1);
      for (let k = 0; k < 3; k++) {
        const t = this.dauphinsT - k * 0.45;
        const saut = (t % 2.6) / 1.3;
        if (t < 0 || saut > 1) continue;
        const x = this.dauphinsPos.x + t * 1.6 + k * 0.7;
        const z = this.dauphinsPos.z + k * 0.9 + Math.sin(t * 0.3) * 1.5;
        const y = Math.sin(saut * Math.PI) * 0.75 - 0.15;
        this.dauphins.ajouter(x, y, z, Math.PI / 2, gris, 0, 0, 1, -Math.cos(saut * Math.PI) * 0.9);
      }
      if (this.dauphinsT > 9) this.dauphinsT = -1;
    }
    this.dauphins.fin();
    void temps;
  }
}
