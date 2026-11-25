// La végétation : pins parasols, chênes verts, cyprès, oliviers, maquis, lauriers-roses, rochers,
// et les blés des fermes. Tout est modelé en code (des touffes de feuillage bosselées) et dessiné
// en instances : quelques appels de dessin pour des milliers d'arbres.
//
// Les feuillages ont des normales « sphériques » (tournées vers l'extérieur de la couronne), ce
// qui leur donne un modelé doux de peinture ; ils laissent passer le soleil à contre-jour, et
// tout ondule dans le vent, les blés plus que les arbres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hachage } from "../ville/hasard";
import { bruit, hauteur, indice, TAILLE, type Essence } from "../ville/ile";
import type { Batiment, Ville } from "../ville/ville";
import { patcher } from "./atmosphere";

// ---------------------------------------------------------------------------------------------
// Les formes
// ---------------------------------------------------------------------------------------------

type Rgb = [number, number, number];
const lin = (hex: number): Rgb => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

function colorer(geo: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => Rgb, feuille: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const fe = new Float32Array(pos.count).fill(feuille);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = f(p, n);
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aFeuille", new THREE.BufferAttribute(fe, 1));
  return geo;
}

/** Une touffe de feuillage : une sphère bosselée, à normales adoucies vers le centre de la couronne */
function touffe(c: THREE.Vector3, r: THREE.Vector3, centre: THREE.Vector3, bas: Rgb, haut: Rgb, graine: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const b = bruit(v.x * 2.1 + graine, v.y * 2.1 + v.z * 1.3 + graine * 0.7, 3) - 0.5;
    v.multiplyScalar(1 + b * 0.55);
    v.set(v.x * r.x + c.x, v.y * r.y + c.y, v.z * r.z + c.z);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const radial = v.clone().sub(centre).normalize();
    n.lerp(radial, 0.7).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  const ymin = c.y - r.y;
  const ymax = c.y + r.y;
  return colorer(
    g,
    (p) => {
      const t = THREE.MathUtils.clamp((p.y - ymin) / (ymax - ymin), 0, 1);
      const k = 0.85 + 0.3 * (bruit(p.x * 3 + graine, p.z * 3, 7) - 0.5);
      return [THREE.MathUtils.lerp(bas[0], haut[0], t) * k, THREE.MathUtils.lerp(bas[1], haut[1], t) * k, THREE.MathUtils.lerp(bas[2], haut[2], t) * k];
    },
    1,
  );
}

/** Un tronc (ou une branche) : un cylindre effilé entre deux points */
function tronc(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, couleur: Rgb, segments = 6) {
  const longueur = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, longueur, segments, 1, false);
  g.translate(0, longueur / 2, 0);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(a.x, a.y, a.z);
  return colorer(g, (p) => {
    const k = 0.8 + 0.4 * bruit(p.x * 9, p.y * 9 + p.z * 5, 5);
    return [couleur[0] * k, couleur[1] * k, couleur[2] * k];
  }, 0);
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function fusion(geos: THREE.BufferGeometry[]) {
  const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)), false)!;
  g.computeBoundingSphere();
  return g;
}

function pin(variante: number) {
  const h = 3.1 + variante * 0.5;
  const pench = (variante - 0.5) * 0.35;
  const geos: THREE.BufferGeometry[] = [];
  const cime = V(pench, h, pench * 0.4);
  geos.push(tronc(V(0, -0.2, 0), cime.clone().setY(h - 0.15), 0.1, 0.06, lin(0x6a4030), 6));
  // Deux ou trois grosses branches qui portent l'ombrelle
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + variante * 2;
    geos.push(tronc(V(pench * 0.8, h * 0.78, pench * 0.3), V(pench + Math.cos(a) * 0.6, h + 0.05, pench * 0.4 + Math.sin(a) * 0.6), 0.045, 0.03, lin(0x5a3626), 4));
  }
  const centre = V(pench, h + 0.15, pench * 0.4);
  const bas = lin(0x1b2a12);
  const haut = lin(0x3d5524);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + variante;
    const r = k === 0 ? 0 : 0.75 + 0.25 * Math.sin(k * 3.1);
    const c = V(centre.x + Math.cos(a) * r, centre.y + 0.05 * Math.sin(k * 1.7), centre.z + Math.sin(a) * r);
    geos.push(touffe(c, V(0.62, 0.3, 0.62), centre, bas, haut, k * 3.3 + variante * 10));
  }
  return fusion(geos);
}

function chene(variante: number) {
  const h = 1.5 + variante * 0.35;
  const geos: THREE.BufferGeometry[] = [tronc(V(0, -0.2, 0), V(0.05, h * 0.6, 0), 0.11, 0.07, lin(0x3e3328), 6)];
  const centre = V(0, h, 0);
  const bas = lin(0x142010);
  const haut = lin(0x34451f);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + variante * 3;
    const r = k === 0 ? 0 : 0.55;
    const c = V(Math.cos(a) * r, h + (k === 0 ? 0.35 : Math.sin(k * 2.3) * 0.2), Math.sin(a) * r);
    geos.push(touffe(c, V(0.62, 0.55, 0.62), centre, bas, haut, k * 5.1 + variante * 7));
  }
  return fusion(geos);
}

function cypres(variante: number) {
  const h = 3.4 + variante * 1.3;
  const geos: THREE.BufferGeometry[] = [tronc(V(0, -0.2, 0), V(0, 0.4, 0), 0.07, 0.06, lin(0x3a2a20), 5)];
  // Une flamme : un fuseau bosselé
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 18; k++) {
    const t = k / 18;
    pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.36 * (1 - t * 0.35)), 0.25 + t * h));
  }
  const g = new THREE.LatheGeometry(pts, 12);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const b = bruit(v.x * 9 + variante * 9, v.y * 5 + v.z * 9, 13) - 0.5;
    const b2 = bruit(v.x * 21, v.y * 13 + v.z * 21, 14) - 0.5;
    pos.setXYZ(i, v.x * (1 + b * 0.7 + b2 * 0.3), v.y, v.z * (1 + b * 0.7 + b2 * 0.3));
  }
  g.computeVertexNormals();
  geos.push(
    colorer(
      g,
      (p) => {
        const t = p.y / h;
        const k = 0.8 + 0.4 * bruit(p.x * 8, p.y * 4, 21);
        return [(0.018 + t * 0.02) * k, (0.034 + t * 0.03) * k, (0.016 + t * 0.012) * k];
      },
      1,
    ),
  );
  return fusion(geos);
}

function olivier(variante: number) {
  const geos: THREE.BufferGeometry[] = [];
  const brun = lin(0x5b5246);
  // Un tronc noueux, tordu, qui se divise
  const base = V(0, -0.2, 0);
  const noeud = V(0.12 * (variante - 0.5), 0.5, 0.08);
  geos.push(tronc(base, noeud, 0.13, 0.09, brun, 6));
  const bras = [V(-0.35, 0.95, 0.15), V(0.32, 0.9, -0.2), V(0.05, 1.05, 0.35)];
  for (const b of bras) geos.push(tronc(noeud, b, 0.07, 0.04, brun, 5));
  const centre = V(0, 1.15, 0);
  const bas = lin(0x2e3a22);
  const haut = lin(0x7d8a66);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + variante * 4;
    const r = 0.38 + 0.12 * Math.sin(k * 2.7);
    const c = V(Math.cos(a) * r, 1.1 + Math.sin(k * 1.9) * 0.15, Math.sin(a) * r);
    geos.push(touffe(c, V(0.38, 0.3, 0.38), centre, bas, haut, k * 2.9 + variante * 5));
  }
  return fusion(geos);
}

function buisson(variante: number, fleurs: boolean) {
  const geos: THREE.BufferGeometry[] = [];
  const centre = V(0, 0.15, 0);
  const bas = fleurs ? lin(0x1d2f14) : lin(0x18240f);
  const haut = fleurs ? lin(0x3c5a26) : lin(0x3b4a22);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + variante * 5;
    const c = V(Math.cos(a) * 0.18, 0.18 + k * 0.04, Math.sin(a) * 0.18);
    geos.push(touffe(c, V(0.3, 0.24, 0.3), centre, bas, haut, k * 7 + variante * 3, 1));
  }
  if (fleurs) {
    // Des grappes de fleurs roses (laurier-rose)
    const rose = lin(0xe0608a);
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + variante;
      const c = V(Math.cos(a) * 0.3, 0.3 + (k % 3) * 0.08, Math.sin(a) * 0.3);
      geos.push(colorer(new THREE.IcosahedronGeometry(0.06, 0).translate(c.x, c.y, c.z), () => rose, 1));
    }
  }
  return fusion(geos);
}

function rocher(variante: number) {
  const g = new THREE.IcosahedronGeometry(0.4, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const b = bruit(v.x * 3 + variante * 7, v.y * 3 + v.z * 2, 17) - 0.5;
    v.multiplyScalar(1 + b * 0.7);
    pos.setXYZ(i, v.x * 1.2, v.y * 0.55, v.z);
  }
  g.computeVertexNormals();
  return fusion([
    colorer(g, (p, n) => {
      const k = 0.75 + 0.35 * bruit(p.x * 6, p.z * 6, 2);
      const mousse = Math.max(0, n.y) * 0.4;
      return [0.5 * k - mousse * 0.25, 0.47 * k - mousse * 0.15, 0.4 * k - mousse * 0.25];
    }, 0),
  ]);
}

/** Une touffe de blé : des tiges fines, chacune portant son épi */
function ble() {
  const geos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const a = k * 2.39 + 0.3;
    const r = 0.04 + (k % 3) * 0.035;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.42 + ((k * 37) % 10) * 0.012;
    const tige = new THREE.PlaneGeometry(0.018, h, 1, 2);
    tige.translate(0, h / 2, 0);
    tige.rotateY(a);
    tige.translate(x, 0, z);
    geos.push(colorer(tige, (p) => (p.y < h * 0.5 ? lin(0x6b6a2a) : lin(0xb59a45)), 1));
    const epi = new THREE.PlaneGeometry(0.035, 0.12);
    epi.translate(0, h + 0.05, 0);
    epi.rotateY(a + 1.2);
    epi.translate(x, 0, z);
    geos.push(colorer(epi, () => lin(0xd9b45a), 1));
  }
  return fusion(geos);
}

// ---------------------------------------------------------------------------------------------
// Le matériau
// ---------------------------------------------------------------------------------------------

function materiauVegetal(cle: string, vent: number, double = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: double ? THREE.DoubleSide : THREE.FrontSide });
  patcher(m, {
    cle,
    vent,
    vertexDecl: "attribute float aFeuille; varying float vFeuille;",
    vertexDebut: "vFeuille = aFeuille;",
    fragDecl: "varying float vFeuille;",
    fragCouleur: /* glsl */ `
      // Chaque arbre a sa nuance
      float teinte = hash21(floor(vMonde.xz * 0.7));
      diffuseColor.rgb *= 0.88 + 0.24 * teinte;
      diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.0, 0.86), vFeuille * smoothstep(0.6, 0.9, teinte));
    `,
    fragEmission: /* glsl */ `
      {
        // Le soleil à travers les feuilles
        vec3 vue = normalize(vMonde - cameraPosition);
        float contre = pow(max(dot(vue, uLumiereDir), 0.0), 4.0);
        totalEmissiveRadiance += diffuseColor.rgb * uLumiereCouleur * (contre * 0.35 + 0.04) * vFeuille * ombreNuages(vMonde);
      }
    `,
  });
  return m;
}

// ---------------------------------------------------------------------------------------------
// Les instances
// ---------------------------------------------------------------------------------------------

type Sorte = Essence | "buisson" | "laurier" | "rocher";

interface Espece {
  geos: THREE.BufferGeometry[];
  meshes: THREE.InstancedMesh[];
  max: number;
}

const ESPECES: Record<Sorte, { fabrique: (v: number) => THREE.BufferGeometry; variantes: number; max: number; ombre: boolean }> = {
  pin: { fabrique: pin, variantes: 3, max: 2600, ombre: true },
  chene: { fabrique: chene, variantes: 3, max: 2600, ombre: true },
  cypres: { fabrique: cypres, variantes: 2, max: 900, ombre: true },
  olivier: { fabrique: olivier, variantes: 3, max: 2400, ombre: true },
  buisson: { fabrique: (v) => buisson(v, false), variantes: 3, max: 4000, ombre: false },
  laurier: { fabrique: (v) => buisson(v, true), variantes: 2, max: 900, ombre: false },
  rocher: { fabrique: rocher, variantes: 3, max: 1500, ombre: true },
};

export class Vegetation {
  readonly groupe = new THREE.Group();
  private readonly especes = new Map<Sorte, Espece>();
  private readonly ble: THREE.InstancedMesh;
  private version = "";

  constructor() {
    const mat = materiauVegetal("vegetation", 0.012);
    for (const [sorte, def] of Object.entries(ESPECES) as [Sorte, (typeof ESPECES)[Sorte]][]) {
      const geos: THREE.BufferGeometry[] = [];
      const meshes: THREE.InstancedMesh[] = [];
      for (let v = 0; v < def.variantes; v++) {
        const g = def.fabrique(def.variantes === 1 ? 0.5 : v / (def.variantes - 1));
        geos.push(g);
        const m = new THREE.InstancedMesh(g, mat, Math.ceil(def.max / def.variantes));
        m.count = 0;
        m.castShadow = def.ombre;
        m.receiveShadow = true;
        m.frustumCulled = false;
        meshes.push(m);
        this.groupe.add(m);
      }
      this.especes.set(sorte, { geos, meshes, max: def.max });
    }
    const matBle = materiauVegetal("ble", 0.9, true);
    this.ble = new THREE.InstancedMesh(ble(), matBle, 22000);
    this.ble.count = 0;
    this.ble.receiveShadow = true;
    this.ble.castShadow = false;
    this.ble.frustumCulled = false;
    this.groupe.add(this.ble);
  }

  mettreAJour(_dt: number, v: Ville) {
    let cle = `${v.versionArbres}/${v.versionRoutes}/${v.batiments.size}`;
    for (const b of v.batiments.values()) if (b.type === "ferme" || b.type === "oliveraie") cle += `,${b.id}`;
    if (cle === this.version) return;
    this.version = cle;
    this.reconstruire(v);
  }

  private reconstruire(v: Ville) {
    const listes = new Map<Sorte, THREE.Matrix4[]>();
    for (const s of this.especes.keys()) listes.set(s, []);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const ajouter = (s: Sorte, x: number, z: number, echelle: number, graine: number, penche = 0.06) => {
      const y = hauteur(x, z) - 0.06;
      e.set((hachage(graine, 3, 1) - 0.5) * penche, hachage(graine, 5, 2) * Math.PI * 2, (hachage(graine, 7, 3) - 0.5) * penche);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(echelle, echelle * (0.9 + hachage(graine, 9, 4) * 0.2), echelle));
      listes.get(s)!.push(m.clone());
    };
    const ile = v.ile;

    for (let j = 0; j < TAILLE; j++) {
      for (let i = 0; i < TAILLE; i++) {
        const k = indice(i, j);
        const n = ile.arbres[k]!;
        const essence = ile.essences[k]!;
        for (let t = 0; t < n; t++) {
          const g = k * 7 + t;
          const x = i + 0.18 + hachage(i, j, t * 2 + 1) * 0.64;
          const z = j + 0.18 + hachage(i, j, t * 2 + 2) * 0.64;
          ajouter(essence, x, z, 0.8 + hachage(i, j, t + 40) * 0.45, g);
        }
        // Le décor : maquis, lauriers et rochers, seulement sur les cases libres
        const sol = ile.sols[k];
        if (sol === "eau" || v.occupation[k] || v.routes[k] || v.reserve[k]) continue;
        const h = hachage(i, j, 77);
        const pente = ile.pentes[k]!;
        if (sol === "roche" || pente > 0.8) {
          if (h < 0.35) ajouter("rocher", i + hachage(i, j, 78), j + hachage(i, j, 79), 0.6 + h * 2.2, k, 0.6);
          continue;
        }
        if (sol === "plage") continue;
        const bosquet = bruit(i * 0.15, j * 0.15, 61);
        const enVille = Math.exp(-((i - 58) ** 2 + (j - 80) ** 2) / (2 * 16 * 16));
        if (n === 0 && h < (0.02 + bosquet * bosquet * 0.3) * (1 - enVille)) {
          for (let t = 0; t < 2; t++) ajouter("buisson", i + hachage(i, j, 80 + t), j + hachage(i, j, 82 + t), 0.7 + hachage(i, j, 84 + t) * 0.8, k + t);
        }
        // Des lauriers-roses le long des rues
        if (n === 0 && h > 0.93) {
          const rue = v.estRoute(i - 1, j) || v.estRoute(i + 1, j) || v.estRoute(i, j - 1) || v.estRoute(i, j + 1);
          if (rue) ajouter("laurier", i + 0.5, j + 0.5, 0.9 + hachage(i, j, 86) * 0.5, k);
        }
      }
    }

    // Les oliveraies et les champs de blé
    const bles: THREE.Matrix4[] = [];
    for (const b of v.batiments.values()) {
      if (b.type === "oliveraie") this.planterOliveraie(b, ajouter);
      else if (b.type === "ferme") this.semer(b, bles);
      else if (b.type === "temple" || b.type === "thermes") this.cypresAutour(b, v, ajouter);
    }

    for (const [sorte, espece] of this.especes) {
      const liste = listes.get(sorte)!;
      const parVariante = espece.meshes.map(() => 0);
      liste.forEach((mat, n) => {
        const vi = n % espece.meshes.length;
        const mesh = espece.meshes[vi]!;
        if (parVariante[vi]! >= mesh.instanceMatrix.count) return;
        mesh.setMatrixAt(parVariante[vi]!++, mat);
      });
      espece.meshes.forEach((mesh, vi) => {
        mesh.count = parVariante[vi]!;
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
    const nb = Math.min(bles.length, this.ble.instanceMatrix.count);
    for (let n = 0; n < nb; n++) this.ble.setMatrixAt(n, bles[n]!);
    this.ble.count = nb;
    this.ble.instanceMatrix.needsUpdate = true;
  }

  /** Huit oliviers en quinconce, autour de l'abri du coin */
  private planterOliveraie(b: Batiment, ajouter: (s: Sorte, x: number, z: number, e: number, g: number, p?: number) => void) {
    const c = { x: b.i + b.l / 2, z: b.j + b.p / 2 };
    const a = (b.rotation * Math.PI) / 2;
    for (const lx of [-1.25, 0, 1.25])
      for (const lz of [-1.25, 0, 1.25]) {
        if (lx < -1 && lz < -1) continue;
        const x = c.x + lx * Math.cos(a) + lz * Math.sin(a);
        const z = c.z - lx * Math.sin(a) + lz * Math.cos(a);
        ajouter("olivier", x + (hachage(b.id, lx * 10, lz * 10) - 0.5) * 0.2, z, 0.85 + hachage(b.id, lz * 10, lx * 10) * 0.3, b.id * 13 + lx * 7 + lz);
      }
  }

  /** Le champ : tout sauf la bande nord du corps de ferme */
  private semer(b: Batiment, bles: THREE.Matrix4[]) {
    const c = { x: b.i + b.l / 2, z: b.j + b.p / 2 };
    const a = (b.rotation * Math.PI) / 2;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let lz = -0.55; lz <= 1.85; lz += 0.24) {
      for (let lx = -1.85; lx <= 1.85; lx += 0.24) {
        const jx = lx + (hachage(b.id, Math.round(lx * 50), Math.round(lz * 50)) - 0.5) * 0.12;
        const jz = lz + (hachage(Math.round(lz * 50), b.id, Math.round(lx * 50)) - 0.5) * 0.12;
        const x = c.x + jx * Math.cos(a) + jz * Math.sin(a);
        const z = c.z - jx * Math.sin(a) + jz * Math.cos(a);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hachage(Math.round(x * 40), Math.round(z * 40), 3) * Math.PI * 2);
        const s = 0.85 + hachage(Math.round(z * 40), Math.round(x * 40), 5) * 0.35;
        m.compose(new THREE.Vector3(x, hauteur(x, z) - 0.02, z), q, new THREE.Vector3(s, s, s));
        bles.push(m.clone());
      }
    }
  }

  /** Une haie de cyprès autour des grands monuments, sur les cases libres */
  private cypresAutour(b: Batiment, v: Ville, ajouter: (s: Sorte, x: number, z: number, e: number, g: number, p?: number) => void) {
    for (let j = b.j - 2; j < b.j + b.p + 2; j++)
      for (let i = b.i - 2; i < b.i + b.l + 2; i++) {
        const surBord = i === b.i - 2 || j === b.j - 2 || i === b.i + b.l + 1 || j === b.j + b.p + 1;
        if (!surBord || (i + j) % 3 !== 0) continue;
        if (i < 0 || j < 0 || i >= TAILLE || j >= TAILLE) continue;
        const k = indice(i, j);
        if (v.occupation[k] || v.routes[k] || v.ile.sols[k] === "eau" || v.ile.pentes[k]! > 0.8) continue;
        ajouter("cypres", i + 0.5, j + 0.5, 0.7 + hachage(i, j, 91) * 0.3, k * 3);
      }
  }
}
