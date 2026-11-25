// L'atelier de géométrie : un « chantier » accumule des formes simples (boîtes, cylindres, tours,
// toits, arcades…) dans un repère qu'on peut déplacer et tourner, puis les fusionne en une seule
// géométrie avec, pour chaque sommet, sa couleur (linéaire) et son numéro de matière (`aMat`).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAT } from "../materiaux";
import type { Modele, SorteEmetteur } from "./types";

export type Teinte = number | THREE.Color;
export type V3 = [number, number, number];

const AXE_Y = new THREE.Vector3(0, 1, 0);

export function teinte(c: Teinte): THREE.Color {
  return typeof c === "number" ? new THREE.Color(c) : c;
}

/** Une couleur proche de `c`, plus claire ou plus sombre d'au plus `ecart` (0.1 = 10 %). */
export function varier(c: Teinte, ecart: number, hasard: () => number): THREE.Color {
  return teinte(c)
    .clone()
    .multiplyScalar(1 + (hasard() - 0.5) * 2 * ecart);
}

/** Un générateur pseudo-aléatoire reproductible (mulberry32). */
export function alea(graine: number): () => number {
  let a = (graine * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Retourne les triangles d'une géométrie non indexée (après un miroir). */
function inverserFaces(geo: THREE.BufferGeometry) {
  for (const nom of ["position", "normal"]) {
    const a = geo.getAttribute(nom) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const t = a.array as Float32Array;
    for (let i = 0; i < t.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const v = t[i + 3 + k]!;
        t[i + 3 + k] = t[i + 6 + k]!;
        t[i + 6 + k] = v;
      }
    }
    a.needsUpdate = true;
  }
}

export class Chantier {
  private morceaux: THREE.BufferGeometry[] = [];
  private pile: THREE.Matrix4[] = [new THREE.Matrix4()];
  readonly emetteurs: { sorte: SorteEmetteur; x: number; y: number; z: number }[] = [];

  private get courant(): THREE.Matrix4 {
    return this.pile[this.pile.length - 1]!;
  }

  /** Dessine `fn` dans un repère déplacé de (x, y, z), tourné de `rotY` autour de la verticale. */
  repere(x: number, y: number, z: number, rotY: number, fn: () => void, echelle = 1) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(AXE_Y, rotY),
      new THREE.Vector3(echelle, echelle, echelle),
    );
    this.repereM(m, fn);
  }

  repereM(m: THREE.Matrix4, fn: () => void) {
    this.pile.push(this.courant.clone().multiply(m));
    try {
      fn();
    } finally {
      this.pile.pop();
    }
  }

  /** Ajoute une géométrie (consommée) avec sa couleur et sa matière. */
  ajouter(g: THREE.BufferGeometry, c: Teinte, mat: number, local?: THREE.Matrix4) {
    const geo = g.index ? g.toNonIndexed() : g;
    for (const nom of Object.keys(geo.attributes)) if (nom !== "position" && nom !== "normal") geo.deleteAttribute(nom);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    geo.morphAttributes = {};
    geo.clearGroups();
    const m = local ? this.courant.clone().multiply(local) : this.courant;
    geo.applyMatrix4(m);
    if (m.determinant() < 0) inverserFaces(geo);
    const n = geo.getAttribute("position").count;
    const col = teinte(c);
    const couleurs = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      couleurs[i * 3] = col.r;
      couleurs[i * 3 + 1] = col.g;
      couleurs[i * 3 + 2] = col.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(couleurs, 3));
    geo.setAttribute("aMat", new THREE.BufferAttribute(new Float32Array(n).fill(mat), 1));
    this.morceaux.push(geo);
  }

  emettre(sorte: SorteEmetteur, x: number, y: number, z: number) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(this.courant);
    this.emetteurs.push({ sorte, x: p.x, y: p.y, z: p.z });
  }

  fin(): Modele {
    const geo = mergeGeometries(this.morceaux, false);
    if (!geo) throw new Error("modèle vide ou attributs incohérents");
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return { geometrie: geo, hauteur: geo.boundingBox!.max.y, emetteurs: this.emetteurs };
  }

  // -------------------------------------------------------------------------------------------
  // Formes de base
  // -------------------------------------------------------------------------------------------

  /** Une boîte posée en (x, y, z) : y est sa base, x et z son centre. */
  boite(x: number, y: number, z: number, l: number, h: number, p: number, c: Teinte, mat: number) {
    if (l <= 0 || h <= 0 || p <= 0) return;
    const g = new THREE.BoxGeometry(l, h, p);
    g.translate(x, y + h / 2, z);
    this.ajouter(g, c, mat);
  }

  /** Une boîte tournée de `rotY` autour de son axe vertical. */
  boiteTournee(x: number, y: number, z: number, l: number, h: number, p: number, rotY: number, c: Teinte, mat: number) {
    this.repere(x, y, z, rotY, () => this.boite(0, 0, 0, l, h, p, c, mat));
  }

  /** Une boîte quelconque, centrée, avec sa matrice locale. */
  boiteM(m: THREE.Matrix4, l: number, h: number, p: number, c: Teinte, mat: number) {
    this.ajouter(new THREE.BoxGeometry(l, h, p), c, mat, m);
  }

  /** Un cylindre vertical (ou un cône tronqué) de base y. */
  cylindre(x: number, y: number, z: number, r: number, h: number, seg: number, c: Teinte, mat: number, rHaut = r, ouvert = false) {
    const g = new THREE.CylinderGeometry(rHaut, r, h, seg, 1, ouvert);
    g.translate(x, y + h / 2, z);
    this.ajouter(g, c, mat);
  }

  /** Un cylindre couché le long de x ou de z, centré en (x, y, z). */
  cylindreCouche(x: number, y: number, z: number, r: number, longueur: number, axe: "x" | "z", seg: number, c: Teinte, mat: number) {
    const g = new THREE.CylinderGeometry(r, r, longueur, seg, 1, false);
    if (axe === "x") g.rotateZ(Math.PI / 2);
    else g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.ajouter(g, c, mat);
  }

  /** Une barre (cylindre) entre deux points. */
  barre(a: V3, b: V3, r: number, c: Teinte, mat: number, seg = 6) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const longueur = d.length();
    if (longueur < 1e-5) return;
    const g = new THREE.CylinderGeometry(r, r, longueur, seg, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(AXE_Y, d.normalize());
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.ajouter(g, c, mat, m);
  }

  /** Une forme de révolution : profil [rayon, hauteur] de bas en haut, posée en (x, y, z). */
  tour(x: number, y: number, z: number, profil: [number, number][], seg: number, c: Teinte, mat: number) {
    const g = new THREE.LatheGeometry(
      profil.map(([r, h]) => new THREE.Vector2(Math.max(r, 0), h)),
      seg,
    );
    g.translate(x, y, z);
    this.ajouter(g, c, mat);
  }

  /** Une boule à facettes (icosaèdre), étirée en (rx, ry, rz). */
  boule(x: number, y: number, z: number, rx: number, ry: number, rz: number, c: Teinte, mat: number, detail = 1) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.scale(rx, ry, rz);
    g.translate(x, y, z);
    this.ajouter(g, c, mat);
  }

  /**
   * Une masse végétale allongée le long de x (haie, rang de vigne, buisson) : un boudin aux bouts
   * arrondis, centré en (x, y, z), dont la surface ondule doucement pour paraître touffue.
   */
  masse(x: number, y: number, z: number, l: number, h: number, p: number, c: Teinte, mat: number, hasard: () => number, rugosite = 0.22, rotY = 0) {
    const segL = Math.max(8, Math.min(28, Math.round(l / 0.12)));
    const g = new THREE.SphereGeometry(1, 9, segL);
    g.rotateZ(Math.PI / 2);
    const ph = [hasard() * 6.3, hasard() * 6.3, hasard() * 6.3, hasard() * 6.3];
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      // Des bouts émoussés plutôt qu'en pointe
      const bx = Math.sign(px) * Math.pow(Math.abs(px), 0.35);
      const ondule =
        Math.sin(bx * l * 9 + ph[0]!) * 0.5 + Math.sin(bx * l * 23 + py * 5 + ph[1]!) * 0.3 + Math.sin(pz * 7 + py * 6 + bx * l * 14 + ph[2]!) * 0.2;
      const k = 1 + rugosite * ondule;
      pos.setXYZ(i, (bx * l) / 2, ((py * h) / 2) * k, ((pz * p) / 2) * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    this.ajouter(g, c, mat, m);
  }

  /** Une demi-sphère posée en (x, y, z), aplatie ou étirée par `rapport`. */
  dome(x: number, y: number, z: number, r: number, c: Teinte, mat: number, seg = 16, rapport = 1) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg / 3)), 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, rapport, 1);
    g.translate(x, y, z);
    this.ajouter(g, c, mat);
  }

  /** Un solide convexe : les faces sont orientées automatiquement vers l'extérieur. */
  solide(points: V3[], faces: number[][], c: Teinte, mat: number) {
    const centre = new THREE.Vector3();
    for (const p of points) centre.add(new THREE.Vector3(...p));
    centre.divideScalar(points.length);
    const pos: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (const f of faces) {
      const centreFace = new THREE.Vector3();
      for (const i of f) centreFace.add(new THREE.Vector3(...points[i]!));
      centreFace.divideScalar(f.length);
      const vers = centreFace.sub(centre);
      for (let k = 1; k + 1 < f.length; k++) {
        const p0 = points[f[0]!]!;
        let p1 = points[f[k]!]!;
        let p2 = points[f[k + 1]!]!;
        a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
        d.crossVectors(a, b);
        if (d.lengthSq() < 1e-12) continue;
        if (d.dot(vers) < 0) [p1, p2] = [p2, p1];
        pos.push(...p0, ...p1, ...p2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    this.ajouter(g, c, mat);
  }

  /** Des polygones plans, chacun orienté vers la direction `vers` donnée. */
  polygones(polys: { pts: V3[]; vers: V3 }[], c: Teinte, mat: number) {
    const pos: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (const { pts, vers } of polys) {
      const v = new THREE.Vector3(...vers);
      for (let k = 1; k + 1 < pts.length; k++) {
        const p0 = pts[0]!;
        let p1 = pts[k]!;
        let p2 = pts[k + 1]!;
        a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
        d.crossVectors(a, b);
        if (d.lengthSq() < 1e-12) continue;
        if (d.dot(v) < 0) [p1, p2] = [p2, p1];
        pos.push(...p0, ...p1, ...p2);
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    this.ajouter(g, c, mat);
  }

  /** Un prisme triangulaire (pignon, fronton) : base p en travers, faîte le long de x, hauteur h. */
  prisme(x: number, y: number, z: number, l: number, h: number, p: number, c: Teinte, mat: number) {
    const L = l / 2;
    const P = p / 2;
    this.solide(
      [
        [x - L, y, z - P],
        [x - L, y, z + P],
        [x - L, y + h, z],
        [x + L, y, z - P],
        [x + L, y, z + P],
        [x + L, y + h, z],
      ],
      [
        [0, 1, 2],
        [3, 4, 5],
        [0, 1, 4, 3],
        [1, 2, 5, 4],
        [2, 0, 3, 5],
      ],
      c,
      mat,
    );
  }

  // -------------------------------------------------------------------------------------------
  // Toits
  // -------------------------------------------------------------------------------------------

  /**
   * Un toit à deux pans posé sur des murs de hauteur y : faîte le long de `axe`, longueur `l`
   * le long du faîte, portée `p` en travers, hauteur `h` au-dessus des murs. Le toit déborde de
   * `debord` et a une épaisseur `ep`. Avec `pignon`, les triangles sous le toit sont remplis.
   */
  toit2(
    x: number,
    y: number,
    z: number,
    l: number,
    p: number,
    h: number,
    debord: number,
    ep: number,
    c: Teinte,
    axe: "x" | "z" = "x",
    pignon?: { c: Teinte; mat: number },
  ) {
    if (axe === "z") {
      this.repere(x, y, z, Math.PI / 2, () => this.toit2(0, 0, 0, l, p, h, debord, ep, c, "x", pignon));
      return;
    }
    const demi = p / 2;
    const pente = h / demi;
    const L = l + 2 * debord;
    const course = demi + debord;
    const yBord = y - pente * debord;
    const largeur = Math.hypot(course, h + pente * debord);
    const alpha = Math.atan2(h, demi);
    for (const s of [1, -1]) {
      const n = new THREE.Vector3(0, Math.cos(alpha), s * Math.sin(alpha));
      const centre = new THREE.Vector3(x, (y + h + yBord) / 2, z + (s * course) / 2).addScaledVector(n, -ep / 2);
      const m = new THREE.Matrix4().makeRotationX(s * alpha).setPosition(centre);
      this.boiteM(m, L, ep, largeur, c, MAT.tuiles);
    }
    // Les tuiles faîtières, un peu plus sombres
    this.cylindreCouche(x, y + h + ep * 0.15, z, ep * 0.85 + 0.015, L, "x", 6, teinte(c).clone().multiplyScalar(0.82), MAT.tuiles);
    // Le pignon reste juste sous le versant, pour ne pas scintiller avec les tuiles
    if (pignon) this.prisme(x, y, z, l, Math.max(0.01, h - ep * 0.9), p, pignon.c, pignon.mat);
  }

  /** Un toit à quatre pans (en croupe) sur un rectangle l × p, de hauteur h au-dessus des murs. */
  toit4(x: number, y: number, z: number, l: number, p: number, h: number, debord: number, ep: number, c: Teinte) {
    const L = l / 2 + debord;
    const P = p / 2 + debord;
    const pente = h / (Math.min(l, p) / 2);
    const yb = y - pente * debord;
    const yh = y + h;
    const pts: V3[] = [
      [x - L, yb - ep, z - P],
      [x + L, yb - ep, z - P],
      [x + L, yb - ep, z + P],
      [x - L, yb - ep, z + P],
      [x - L, yb, z - P],
      [x + L, yb, z - P],
      [x + L, yb, z + P],
      [x - L, yb, z + P],
    ];
    const faces = [
      [0, 1, 2, 3],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ];
    if (l >= p) {
      const r = (l - p) / 2;
      pts.push([x - r, yh, z], [x + r, yh, z]);
      faces.push([4, 5, 9, 8], [6, 7, 8, 9], [5, 6, 9], [7, 4, 8]);
      if (r > 0.01) this.cylindreCouche(x, yh + ep * 0.1, z, ep * 0.8 + 0.012, 2 * r + 0.04, "x", 6, teinte(c).clone().multiplyScalar(0.82), MAT.tuiles);
    } else {
      const r = (p - l) / 2;
      pts.push([x, yh, z - r], [x, yh, z + r]);
      faces.push([4, 7, 9, 8], [5, 6, 9, 8], [4, 5, 8], [6, 7, 9]);
      if (r > 0.01) this.cylindreCouche(x, yh + ep * 0.1, z, ep * 0.8 + 0.012, 2 * r + 0.04, "z", 6, teinte(c).clone().multiplyScalar(0.82), MAT.tuiles);
    }
    this.solide(pts, faces, c, MAT.tuiles);
  }

  /**
   * Un appentis (toit à un pan) : il couvre l × p, haut de `hHaut` à l'arrière (-z local) et de
   * `hBas` à l'avant (+z local), au-dessus de y. `rotY` le tourne autour de (x, z).
   */
  appentis(x: number, y: number, z: number, l: number, p: number, hHaut: number, hBas: number, debord: number, ep: number, c: Teinte, rotY = 0, mat: number = MAT.tuiles) {
    this.repere(x, y, z, rotY, () => {
      const s = (hHaut - hBas) / p;
      const L = l / 2 + debord;
      const za = -p / 2 - debord * 0.3;
      const zf = p / 2 + debord;
      const ya = hHaut + s * debord * 0.3;
      const yf = hBas - s * debord;
      this.solide(
        [
          [-L, ya - ep, za],
          [L, ya - ep, za],
          [L, yf - ep, zf],
          [-L, yf - ep, zf],
          [-L, ya, za],
          [L, ya, za],
          [L, yf, zf],
          [-L, yf, zf],
        ],
        [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
        ],
        c,
        mat,
      );
    });
  }

  /**
   * Un toit en anneau autour d'une cour (domus à atrium) : versants vers l'extérieur et vers la
   * cour (compluvium). Rectangle extérieur lo × po (à la hauteur des murs y), faîte en anneau à
   * mi-chemin, ouverture io × ip au centre.
   */
  toitCompluvium(x: number, y: number, z: number, lo: number, po: number, io: number, ip: number, h: number, debord: number, c: Teinte) {
    const Lo = lo / 2 + debord;
    const Po = po / 2 + debord;
    const Li = io / 2;
    const Pi = ip / 2;
    const Lr = (lo / 2 + Li) / 2;
    const Pr = (po / 2 + Pi) / 2;
    const yh = y + h;
    const pente = h / Math.max(0.05, lo / 2 - Lr);
    const yo = y - pente * debord * 0.7;
    const yi = y - h * 0.15;
    const coins = (L: number, P: number, yy: number): V3[] => [
      [x - L, yy, z - P],
      [x + L, yy, z - P],
      [x + L, yy, z + P],
      [x - L, yy, z + P],
    ];
    const ext = coins(Lo, Po, yo);
    const fai = coins(Lr, Pr, yh);
    const int = coins(Li, Pi, yi);
    const bas = coins(Lo, Po, yo - 0.05);
    const intBas = coins(Li, Pi, yi - 0.06);
    const sens: V3[] = [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ];
    const polys: { pts: V3[]; vers: V3 }[] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const s = sens[i]!;
      polys.push({ pts: [ext[i]!, ext[j]!, fai[j]!, fai[i]!], vers: [s[0], 1.2, s[2]] });
      polys.push({ pts: [fai[i]!, fai[j]!, int[j]!, int[i]!], vers: [-s[0], 1.2, -s[2]] });
      polys.push({ pts: [bas[i]!, bas[j]!, ext[j]!, ext[i]!], vers: s });
      polys.push({ pts: [intBas[i]!, intBas[j]!, int[j]!, int[i]!], vers: [-s[0], 0, -s[2]] });
    }
    this.polygones(polys, c, MAT.tuiles);
  }

  // -------------------------------------------------------------------------------------------
  // Formes extrudées
  // -------------------------------------------------------------------------------------------

  /** Une forme 2D (dans le plan xy) extrudée sur `profondeur`, centrée en z, puis posée et tournée. */
  forme(shape: THREE.Shape, profondeur: number, c: Teinte, mat: number, x: number, y: number, z: number, rotY = 0, segments = 8) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: profondeur, bevelEnabled: false, curveSegments: segments });
    g.translate(0, 0, -profondeur / 2);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(AXE_Y, rotY), new THREE.Vector3(1, 1, 1));
    this.ajouter(g, c, mat, m);
  }

  /**
   * Un pan de mur percé d'une arche (une travée) : largeur l, hauteur h, épaisseur ep, arche de
   * rayon r dont les piédroits montent à hPied. Le mur est dans le plan xy local (épaisseur en z).
   */
  arcade(x: number, y: number, z: number, l: number, h: number, ep: number, r: number, hPied: number, c: Teinte, mat: number, rotY = 0, bas = 0) {
    const s = new THREE.Shape();
    s.moveTo(-l / 2, bas);
    s.lineTo(-r, bas);
    s.lineTo(-r, hPied);
    s.absarc(0, hPied, r, Math.PI, 0, true);
    s.lineTo(r, bas);
    s.lineTo(l / 2, bas);
    s.lineTo(l / 2, h);
    s.lineTo(-l / 2, h);
    s.lineTo(-l / 2, bas);
    this.forme(s, ep, c, mat, x, y, z, rotY, 10);
  }

  /** Un escalier qui monte vers -z local : n marches, hauteur totale hT, profondeur totale pT. */
  escalier(x: number, y: number, z: number, l: number, hT: number, pT: number, n: number, c: Teinte, mat: number, rotY = 0) {
    this.repere(x, y, z, rotY, () => {
      const hm = hT / n;
      const pm = pT / n;
      for (let i = 0; i < n; i++) {
        const prof = pT - i * pm;
        this.boite(0, 0, -pT / 2 + prof / 2, l, (i + 1) * hm, prof, c, mat);
      }
    });
  }
}
