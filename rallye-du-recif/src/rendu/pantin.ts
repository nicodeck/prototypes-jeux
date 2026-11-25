// Le squelette d'un combattant : des articulations emboîtées, qu'on oriente selon une pose.
// Les poses sont écrites pour un perso tourné vers la droite : « P » est le côté près de la
// caméra, « L » le côté loin. Tourné vers la gauche, la pose est retournée en miroir.
import * as THREE from "three";
import { Tube } from "./formes";
import { encrer, matToon } from "./toon";

export type Rot = [number, number, number];
export type CleOs =
  | "bassin"
  | "torse"
  | "cou"
  | "tete"
  | "brasP"
  | "avantBrasP"
  | "mainP"
  | "brasL"
  | "avantBrasL"
  | "mainL"
  | "cuisseP"
  | "molletP"
  | "piedP"
  | "cuisseL"
  | "molletL"
  | "piedL";
export type Expression = "neutre" | "cri" | "douleur";

export interface Pose {
  os: Partial<Record<CleOs, Rot>>;
  /** Monte ou descend le bassin. */
  y?: number;
  /** Avance le bassin. */
  avance?: number;
  /** Tour complet dans le plan de l'écran (vrilles, éjections), en radians. */
  tour?: number;
  /** Monte ou descend tout le corps (allongé au sol). */
  sol?: number;
  expression?: Expression;
}

const CENTRAUX = ["bassin", "torse", "cou", "tete"] as const;
const COTES = ["bras", "avantBras", "main", "cuisse", "mollet", "pied"] as const;
type NomOs = (typeof CENTRAUX)[number] | `${(typeof COTES)[number]}${"D" | "G"}`;

export interface Gabarit {
  pied: number;
  cuisse: number;
  mollet: number;
  ecartHanches: number;
  torse: number;
  epaules: number;
  cou: number;
  bras: number;
  avantBras: number;
}

/** Une chaîne souple (écharpe, queue de cheval, bandeau) qui suit le perso avec du retard. */
export class Chaine {
  readonly points: THREE.Vector3[];
  private readonly avant: THREE.Vector3[];
  readonly tube: Tube;
  readonly mesh: THREE.Mesh;
  private readonly ancreMonde = new THREE.Vector3();
  private initialisee = false;

  constructor(
    readonly ancre: THREE.Object3D,
    readonly decalage: THREE.Vector3,
    readonly nombre: number,
    readonly segment: number,
    rayon: (u: number) => number,
    couleur: THREE.ColorRepresentation,
    readonly options: { aplati?: number; raideur?: number; flotte?: number; derriere?: number; eclat?: { value: number } } = {},
  ) {
    this.points = Array.from({ length: nombre }, () => new THREE.Vector3());
    this.avant = Array.from({ length: nombre }, () => new THREE.Vector3());
    this.tube = new Tube(nombre * 2, 8, rayon, options.aplati ?? 1);
    this.mesh = new THREE.Mesh(this.tube.geometrie, matToon(couleur, { cote: THREE.DoubleSide, eclat: options.eclat }));
    this.mesh.frustumCulled = false;
    encrer(this.mesh, 0.9, { eclat: options.eclat });
    (this.mesh.children[0] as THREE.Mesh).frustumCulled = false;
  }

  mettreAJour(dt: number, dir: number, temps: number) {
    this.ancre.updateWorldMatrix(true, false);
    this.ancreMonde.copy(this.decalage).applyMatrix4(this.ancre.matrixWorld);
    if (!this.initialisee) {
      this.points.forEach((p, i) => p.set(this.ancreMonde.x - dir * i * this.segment, this.ancreMonde.y - i * this.segment * 0.3, this.ancreMonde.z));
      this.avant.forEach((p, i) => p.copy(this.points[i]));
      this.initialisee = true;
    }
    const flotte = this.options.flotte ?? 1;
    const derriere = this.options.derriere ?? -0.35;
    const g = new THREE.Vector3(
      -dir * 3.5 * flotte + Math.sin(temps * 6 + this.segment * 40) * 2.5 * flotte,
      -16 + Math.sin(temps * 4.3) * 3 * flotte,
      derriere * 8,
    );
    const pas = Math.min(dt, 1 / 30);
    this.points[0].copy(this.ancreMonde);
    for (let i = 1; i < this.nombre; i++) {
      const p = this.points[i];
      const a = this.avant[i];
      const vitesse = p.clone().sub(a).multiplyScalar(0.9);
      a.copy(p);
      p.add(vitesse).addScaledVector(g, pas * pas * (0.6 + i / this.nombre));
    }
    const raideur = this.options.raideur ?? 0;
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i < this.nombre; i++) {
        const p = this.points[i];
        const q = this.points[i - 1];
        const d = p.clone().sub(q);
        const l = d.length() || 1e-6;
        p.copy(q).addScaledVector(d, this.segment / l);
        if (raideur > 0 && i >= 2) {
          // Garde un peu la direction du segment précédent.
          const prev = q.clone().sub(this.points[i - 2]).normalize();
          const cible = q.clone().addScaledVector(prev, this.segment);
          p.lerp(cible, raideur);
        }
      }
      this.points[0].copy(this.ancreMonde);
    }
    this.tube.suivre(this.points);
  }

  reinitialiser() {
    this.initialisee = false;
  }
}

export class Pantin {
  /** Placé aux pieds du combattant. */
  readonly racine = new THREE.Group();
  /** Tourne dans le plan de l'écran (vrilles), autour du milieu du corps. */
  readonly pivot = new THREE.Group();
  /** S'oriente vers la gauche ou la droite. */
  readonly orient = new THREE.Group();
  readonly os = {} as Record<NomOs, THREE.Group>;
  readonly chaines: Chaine[] = [];
  /** Le perso blanchit quand on le touche. */
  readonly eclat = { value: 0 };
  readonly eclatCouleur = { value: new THREE.Color("#ffffff") };
  private rotations = new Map<NomOs, THREE.Euler>();
  private bassinY: number;
  private y = 0;
  private avance = 0;
  private tour = 0;
  private sol = 0;
  private correctionPieds = 0;
  private orientation: number | null = null;
  expression: Expression = "neutre";
  private visages: Partial<Record<Expression, THREE.Texture>> = {};
  private visage: THREE.MeshBasicMaterial | null = null;
  readonly milieu: number;

  constructor(readonly gabarit: Gabarit) {
    const g = gabarit;
    const os = (nom: NomOs, parent: THREE.Object3D, x: number, y: number, z = 0) => {
      const o = new THREE.Group();
      o.name = nom;
      o.position.set(x, y, z);
      parent.add(o);
      this.os[nom] = o;
      this.rotations.set(nom, new THREE.Euler());
      return o;
    };
    this.bassinY = g.pied + g.mollet + g.cuisse;
    this.milieu = this.bassinY;
    this.racine.add(this.pivot);
    this.pivot.position.y = this.milieu;
    this.pivot.add(this.orient);
    this.orient.position.y = -this.milieu;
    const bassin = os("bassin", this.orient, 0, this.bassinY);
    const torse = os("torse", bassin, 0, 0.06);
    const cou = os("cou", torse, 0, g.torse);
    os("tete", cou, 0, g.cou);
    for (const [cote, s] of [
      ["D", -1],
      ["G", 1],
    ] as const) {
      const bras = os(`bras${cote}`, torse, s * g.epaules, g.torse - 0.04);
      const avantBras = os(`avantBras${cote}`, bras, 0, -g.bras);
      os(`main${cote}`, avantBras, 0, -g.avantBras);
      const cuisse = os(`cuisse${cote}`, bassin, s * g.ecartHanches, 0);
      const mollet = os(`mollet${cote}`, cuisse, 0, -g.cuisse);
      os(`pied${cote}`, mollet, 0, -g.mollet);
    }
  }

  /** Ajoute une pièce à une articulation. */
  attacher(nom: NomOs, objet: THREE.Object3D, x = 0, y = 0, z = 0) {
    objet.position.set(x, y, z);
    this.os[nom].add(objet);
    return objet;
  }

  ajouterVisages(materiau: THREE.MeshBasicMaterial, visages: Partial<Record<Expression, THREE.Texture>>) {
    this.visage = materiau;
    this.visages = visages;
  }

  /** Oriente les articulations vers la pose (en lissant si `lissage` < 1). */
  poser(pose: Pose, dir: number, lissage: number, angleFace: number) {
    const miroir = dir < 0;
    const cible = (nom: NomOs, r: Rot | undefined) => {
      const e = this.rotations.get(nom)!;
      const [x, y, z] = r ?? [0, 0, 0];
      const ty = miroir ? -y : y;
      const tz = miroir ? -z : z;
      e.x += (x - e.x) * lissage;
      e.y += (ty - e.y) * lissage;
      e.z += (tz - e.z) * lissage;
      this.os[nom].rotation.copy(e);
    };
    for (const c of CENTRAUX) cible(c, pose.os[c]);
    const pres = miroir ? "G" : "D";
    const loin = miroir ? "D" : "G";
    for (const c of COTES) {
      cible(`${c}${pres}` as NomOs, pose.os[`${c}P` as CleOs]);
      cible(`${c}${loin}` as NomOs, pose.os[`${c}L` as CleOs]);
    }
    this.y += ((pose.y ?? 0) - this.y) * lissage;
    this.avance += ((pose.avance ?? 0) - this.avance) * lissage;
    this.sol += ((pose.sol ?? 0) - this.sol) * lissage;
    this.os.bassin.position.y = this.bassinY + this.y + this.correctionPieds;
    this.os.bassin.position.z = this.avance;
    this.pivot.position.y = this.milieu + this.sol;
    // Les vrilles ne passent pas par le lissage, sinon elles « dérouleraient » à l'envers.
    this.tour = pose.tour ?? 0;
    this.pivot.rotation.z = this.tour * dir;
    const face = dir * angleFace;
    if (this.orientation === null) this.orientation = face;
    this.orientation += (face - this.orientation) * Math.min(1, lissage * 1.4 + 0.12);
    this.orient.rotation.y = this.orientation;
    if (pose.expression && pose.expression !== this.expression) {
      this.expression = pose.expression;
      const t = this.visages[this.expression];
      if (this.visage && t) this.visage.map = t;
    }
  }

  /** Pose le pied le plus bas sur le sol (y = 0 de la racine), quand le perso est au sol. */
  ancrerPieds(actif: boolean) {
    if (!actif) {
      this.correctionPieds *= 0.8;
      this.os.bassin.position.y = this.bassinY + this.y + this.correctionPieds;
      return;
    }
    this.racine.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    const inverse = this.racine.matrixWorld.clone().invert();
    let bas = Infinity;
    for (const nom of ["piedD", "piedG"] as const) {
      v.set(0, -this.gabarit.pied, 0).applyMatrix4(this.os[nom].matrixWorld).applyMatrix4(inverse);
      bas = Math.min(bas, v.y);
    }
    this.correctionPieds -= bas;
    this.os.bassin.position.y = this.bassinY + this.y + this.correctionPieds;
  }

  animerChaines(dt: number, dir: number, temps: number) {
    for (const c of this.chaines) c.mettreAJour(dt, dir, temps);
  }

  reinitialiserChaines() {
    for (const c of this.chaines) c.reinitialiser();
  }
}

/** Mélange deux poses. */
export function melanger(a: Pose, b: Pose, t: number): Pose {
  const os: Pose["os"] = {};
  const cles = new Set([...Object.keys(a.os), ...Object.keys(b.os)]) as Set<CleOs>;
  for (const k of cles) {
    const ra = a.os[k] ?? [0, 0, 0];
    const rb = b.os[k] ?? [0, 0, 0];
    os[k] = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t];
  }
  const m = (x = 0, y = 0) => x + (y - x) * t;
  return {
    os,
    y: m(a.y, b.y),
    avance: m(a.avance, b.avance),
    tour: m(a.tour, b.tour),
    expression: t < 0.5 ? a.expression : b.expression,
  };
}

const adoucir = (t: number) => t * t * (3 - 2 * t);

/** Une animation par images clés : [image, pose]. */
export function cles(images: [number, Pose][], f: number): Pose {
  if (f <= images[0][0]) return images[0][1];
  for (let i = 1; i < images.length; i++) {
    const [f1, p1] = images[i];
    const [f0, p0] = images[i - 1];
    if (f <= f1) return melanger(p0, p1, adoucir((f - f0) / Math.max(1e-6, f1 - f0)));
  }
  return images[images.length - 1][1];
}

/** Ajoute des rotations à une pose (petites variations : respiration, tremblement). */
export function ajouter(p: Pose, ajout: Pose["os"], y = 0): Pose {
  const os = { ...p.os };
  for (const k of Object.keys(ajout) as CleOs[]) {
    const a = os[k] ?? [0, 0, 0];
    const b = ajout[k]!;
    os[k] = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
  return { ...p, os, y: (p.y ?? 0) + y };
}
