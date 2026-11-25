// La simulation de la planète, sans rendu : relief, eau, humidité, herbe, arbres, graines, sources,
// pierres et vents de cendre. Tout vit sur les sommets du maillage géodésique.
import * as THREE from "three";
import { REGLAGES } from "../reglages";
import { borne, hasard, lisse } from "./bruit";
import { avancer, genererRelief, type PlanRelief } from "./relief";
import { Sphere } from "./sphere";

const R = REGLAGES.planete.rayon;

export interface Source {
  dir: THREE.Vector3;
  noeud: number;
  active: boolean;
  /** Temps depuis l'éveil (pour les effets). */
  depuis: number;
  /** Niveau que l'eau ne dépasse pas à la source (comme un puits artésien). */
  niveau: number;
}

export interface Graine {
  id: number;
  dir: THREE.Vector3;
  noeud: number;
  age: number;
}

export interface Arbre {
  id: number;
  dir: THREE.Vector3;
  noeud: number;
  espece: number;
  croissance: number;
  age: number;
  forme: number;
  prochaineGraine: number;
  /** Planté par le joueur (sinon semé tout seul). */
  plante: boolean;
}

export interface Pierre {
  dir: THREE.Vector3;
  noeud: number;
  rayon: number;
  hauteur: number;
  /** Sommets touchés et leur part de hauteur, pour pouvoir l'enlever quand la pierre bouge. */
  touches: { i: number; h: number }[];
  /** Rotation visuelle (la pierre roule). */
  rotation: THREE.Quaternion;
}

export interface Vent {
  centre: THREE.Vector3;
  axe: THREE.Vector3;
  temps: number;
  duree: number;
  noeud: number;
}

export type Evenement =
  | { type: "source"; source: number }
  | { type: "arbreAdulte"; arbre: Arbre }
  | { type: "semis"; arbre: Arbre }
  | { type: "graineTombee"; graine: Graine }
  | { type: "vent"; vent: Vent }
  | { type: "ventFini" }
  | { type: "victoire" };

export class Monde {
  readonly sphere: Sphere;
  readonly n: number;
  /** Hauteur du sol (après les coups de pelle), par rapport au rayon. */
  readonly sol: Float32Array;
  readonly solOrigine: Float32Array;
  /** Hauteur ajoutée par les pierres. */
  readonly bloc: Float32Array;
  readonly eau: Float32Array;
  readonly humid: Float32Array;
  readonly vie: Float32Array;
  readonly cendre: Float32Array;
  /** Humidité et protection apportées par les arbres (0 à 1). */
  readonly champ: Float32Array;
  /** Portée de l'eau : 1 sur l'eau, décroît avec la distance. */
  private readonly portee: Float32Array;
  private readonly delta: Float32Array;
  readonly plan: PlanRelief;

  readonly sources: Source[] = [];
  readonly graines: Graine[] = [];
  readonly arbres: Arbre[] = [];
  readonly pierres: Pierre[] = [];
  readonly vents: Vent[] = [];
  readonly evenements: Evenement[] = [];

  /** Sommets dont le sol a changé (pour mettre à jour le maillage). */
  readonly solModifie = new Set<number>();
  /** Part de la planète vivante (0 à 1). */
  part = 0;
  temps = 0;
  /** Direction du soleil (unitaire), fournie par le cycle du jour. */
  readonly soleil = new THREE.Vector3(0, 1, 0);
  /** Facteur d'accélération de la vie (débogage). */
  vite = 1;
  victoire = false;
  arbresPlantes = 0;
  prochainVent: number = REGLAGES.cendre.premier;

  private accEau = 0;
  private accVie = 0;
  private accChamp = 0;
  private champSale = true;
  private idSuivant = 1;
  private readonly alea = hasard(REGLAGES.planete.graine * 31 + 5);

  constructor() {
    this.sphere = new Sphere(REGLAGES.planete.finesse);
    const n = (this.n = this.sphere.n);
    this.sol = new Float32Array(n);
    this.bloc = new Float32Array(n);
    this.eau = new Float32Array(n);
    this.humid = new Float32Array(n);
    this.vie = new Float32Array(n);
    this.cendre = new Float32Array(n);
    this.champ = new Float32Array(n);
    this.portee = new Float32Array(n);
    this.delta = new Float32Array(n);
    this.plan = genererRelief(this.sphere, this.sol);
    this.solOrigine = this.sol.slice();

    this.plan.sources.forEach((dir, k) => {
      this.sources.push({ dir: dir.clone(), noeud: this.noeud(dir), active: k === 0, depuis: k === 0 ? 99 : 0, niveau: k === 0 ? 1.42 : 1.8 });
    });
    for (const g of this.plan.graines) this.poserGraine(g);
    this.ajouterPierre(this.plan.pierreBouchon, 0.78, 1.05);
    for (const p of this.plan.pierres) this.ajouterPierre(p, 0.55 + this.alea() * 0.3, 0.8);

    // La cuvette de la première source se remplit avant le début de la partie.
    for (let k = 0; k < 60 * REGLAGES.eau.pasParSeconde; k++) this.pasEau(1 / REGLAGES.eau.pasParSeconde);
    this.majChamp();
    for (let k = 0; k < 30; k++) this.pasVie(0.1, false);
  }

  // ——— Outils géométriques ———

  noeud(dir: THREE.Vector3, depart = -1) {
    return this.sphere.plusProche(dir.x, dir.y, dir.z, depart);
  }

  dirNoeud(i: number, cible = new THREE.Vector3()) {
    const d = this.sphere.dir;
    return cible.set(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
  }

  // Résultat de `barycentre` : trois sommets et leurs poids.
  readonly bi = [0, 0, 0];
  readonly bw = [1, 0, 0];

  /** Trouve le triangle traversé par la direction et les poids de ses trois sommets. */
  barycentre(x: number, y: number, z: number, indice = -1) {
    const s = this.sphere;
    const c = s.plusProche(x, y, z, indice);
    const d = s.dir;
    const t = s.triangles;
    for (let k = s.trisDebut[c]; k < s.trisDebut[c + 1]; k++) {
      const f = s.tris[k] * 3;
      const a = t[f], b = t[f + 1], cc = t[f + 2];
      const ax = d[a * 3], ay = d[a * 3 + 1], az = d[a * 3 + 2];
      const e1x = d[b * 3] - ax, e1y = d[b * 3 + 1] - ay, e1z = d[b * 3 + 2] - az;
      const e2x = d[cc * 3] - ax, e2y = d[cc * 3 + 1] - ay, e2z = d[cc * 3 + 2] - az;
      // Möller–Trumbore, rayon partant du centre
      const px = y * e2z - z * e2y, py = z * e2x - x * e2z, pz = x * e2y - y * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const tx = -ax, ty = -ay, tz = -az;
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < -1e-4 || u > 1.0001) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (x * qx + y * qy + z * qz) * inv;
      if (v < -1e-4 || u + v > 1.0001) continue;
      this.bi[0] = a; this.bi[1] = b; this.bi[2] = cc;
      this.bw[0] = 1 - u - v; this.bw[1] = u; this.bw[2] = v;
      return c;
    }
    this.bi[0] = this.bi[1] = this.bi[2] = c;
    this.bw[0] = 1; this.bw[1] = 0; this.bw[2] = 0;
    return c;
  }

  /** Interpole un champ par sommet au dernier barycentre calculé. */
  interpoler(champ: Float32Array) {
    return champ[this.bi[0]] * this.bw[0] + champ[this.bi[1]] * this.bw[1] + champ[this.bi[2]] * this.bw[2];
  }

  /** Hauteur du sol (sans les pierres) dans une direction. */
  hauteurSol(dir: THREE.Vector3, indice = -1) {
    this.barycentre(dir.x, dir.y, dir.z, indice);
    return this.interpoler(this.sol);
  }

  /** Point de la surface dans une direction. */
  surface(dir: THREE.Vector3, cible = new THREE.Vector3(), decalage = 0) {
    const h = this.hauteurSol(dir);
    return cible.copy(dir).normalize().multiplyScalar(R + h + decalage);
  }

  mouille(i: number) {
    return this.eau[i] > REGLAGES.eau.seuilMouille;
  }

  /** Le soleil éclaire-t-il ce sommet ? (1 en plein jour, 0 la nuit) */
  jour(i: number) {
    const d = this.sphere.dir;
    const s = this.soleil;
    return lisse(-0.2, 0.15, d[i * 3] * s.x + d[i * 3 + 1] * s.y + d[i * 3 + 2] * s.z);
  }

  // ——— Actions du joueur ———

  /** Creuse autour d'une direction. Renvoie la quantité de terre retirée. */
  creuser(dir: THREE.Vector3, dt: number) {
    const J = REGLAGES.joueur;
    const c = this.noeud(dir);
    let retire = 0;
    this.sphere.autour(c, J.rayonPelle / R, (i, cos) => {
      const dist = Math.acos(Math.min(1, cos)) * R;
      const f = 1 - lisse(J.rayonPelle * 0.35, J.rayonPelle, dist);
      const min = this.solOrigine[i] - J.profondeurMax;
      const avant = this.sol[i];
      const apres = Math.max(min, avant - J.vitessePelle * dt * f);
      if (apres < avant) {
        this.sol[i] = apres;
        retire += avant - apres;
        this.vie[i] = Math.min(this.vie[i], 0.35);
        this.solModifie.add(i);
      }
    });
    return retire;
  }

  /** Peut-on planter ici ? */
  plantable(dir: THREE.Vector3): "ok" | "sec" | "eau" | "arbre" | "source" {
    const i = this.noeud(dir);
    if (this.eau[i] > 0.08) return "eau";
    if (this.sources.some((s) => s.dir.angleTo(dir) * R < 1.8)) return "source";
    if (this.arbres.some((a) => a.dir.angleTo(dir) * R < 1.7)) return "arbre";
    if (this.humid[i] < REGLAGES.vie.seuilHumide) return "sec";
    return "ok";
  }

  planter(dir: THREE.Vector3, parJoueur = true) {
    const noeud = this.noeud(dir);
    const especes = [0, 0, 1, 2, 3];
    const a: Arbre = {
      id: this.idSuivant++,
      dir: this.dirNoeud(noeud),
      noeud,
      espece: especes[Math.floor(this.alea() * especes.length)],
      croissance: 0.02,
      age: 0,
      forme: Math.floor(this.alea() * 1e6),
      prochaineGraine: REGLAGES.arbres.intervalleGraine * (0.6 + this.alea() * 0.6),
      plante: parJoueur,
    };
    this.arbres.push(a);
    if (parJoueur) this.arbresPlantes++;
    this.champSale = true;
    return a;
  }

  poserGraine(dir: THREE.Vector3) {
    const g: Graine = { id: this.idSuivant++, dir: dir.clone().normalize(), noeud: this.noeud(dir), age: 0 };
    this.graines.push(g);
    return g;
  }

  reveillerSource(k: number) {
    const s = this.sources[k];
    if (s.active) return;
    s.active = true;
    s.depuis = 0;
    this.evenements.push({ type: "source", source: k });
  }

  // ——— Pierres ———

  private ajouterPierre(dir: THREE.Vector3, rayon: number, hauteur: number) {
    const p: Pierre = {
      dir: dir.clone().normalize(),
      noeud: this.noeud(dir),
      rayon,
      hauteur,
      touches: [],
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(this.alea() * 6, this.alea() * 6, this.alea() * 6)),
    };
    this.pierres.push(p);
    this.poserBloc(p);
  }

  private poserBloc(p: Pierre) {
    for (const t of p.touches) this.bloc[t.i] -= t.h;
    p.touches.length = 0;
    p.noeud = this.noeud(p.dir, p.noeud);
    this.sphere.autour(p.noeud, (p.rayon * 1.15) / R, (i, cos) => {
      const dist = Math.acos(Math.min(1, cos)) * R;
      const x = dist / (p.rayon * 1.15);
      if (x >= 1) return;
      const h = p.hauteur * Math.sqrt(1 - x * x);
      this.bloc[i] += h;
      p.touches.push({ i, h });
    });
  }

  /** Déplace une pierre vers une nouvelle direction (le joueur la pousse). */
  deplacerPierre(p: Pierre, dir: THREE.Vector3) {
    const avant = p.dir.clone();
    p.dir.copy(dir).normalize();
    // Elle roule : rotation autour de l'axe perpendiculaire au déplacement.
    const depl = p.dir.clone().sub(avant);
    const dist = depl.length() * R;
    if (dist > 1e-6) {
      const axe = new THREE.Vector3().crossVectors(p.dir, depl).normalize();
      p.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axe, dist / p.rayon));
    }
    if (this.noeud(p.dir, p.noeud) !== p.noeud || dist > 0.05) this.poserBloc(p);
  }

  // ——— Simulation ———

  avancer(dt: number) {
    this.temps += dt;
    const E = REGLAGES.eau;
    this.accEau += dt;
    const pasEau = 1 / E.pasParSeconde;
    let garde = 0;
    while (this.accEau >= pasEau && garde++ < 4) {
      this.accEau -= pasEau;
      this.pasEau(pasEau);
    }
    if (garde >= 4) this.accEau = 0;

    this.accVie += dt;
    const pasVie = 1 / REGLAGES.vie.pasParSeconde;
    if (this.accVie >= pasVie) {
      this.accVie -= pasVie;
      if (this.accVie > pasVie) this.accVie = 0;
      this.pasVie(pasVie * this.vite, true);
    }
    this.accChamp += dt;
    if (this.accChamp > 0.5 && this.champSale) {
      this.accChamp = 0;
      this.majChamp();
    }
    this.pasVents(dt);
  }

  private pasEau(dt: number) {
    const E = REGLAGES.eau;
    const { sol, bloc, eau, delta } = this;
    const s = this.sphere;
    const vd = s.voisinsDebut;
    const vs = s.voisins;
    const c = E.ecoulement;
    delta.fill(0);
    for (const src of this.sources) {
      if (!src.active) continue;
      const surface = sol[src.noeud] + eau[src.noeud];
      const pression = borne((src.niveau - surface) / 0.2);
      const debit = E.debitSource * dt * Math.min(1, 0.3 + src.depuis * 0.25) * pression;
      delta[src.noeud] += debit * 0.4;
      const nv = vd[src.noeud + 1] - vd[src.noeud];
      for (let k = vd[src.noeud]; k < vd[src.noeud + 1]; k++) delta[vs[k]] += (debit * 0.6) / nv;
    }
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const w = eau[i];
      if (w <= 1e-6) continue;
      const hi = sol[i] + bloc[i] + w;
      let total = 0;
      const k0 = vd[i], k1 = vd[i + 1];
      for (let k = k0; k < k1; k++) {
        const j = vs[k];
        const dh = hi - (sol[j] + bloc[j] + eau[j]);
        if (dh > 0) total += dh;
      }
      if (total <= 0) continue;
      const sortie = Math.min(w, total * c);
      const f = sortie / total;
      for (let k = k0; k < k1; k++) {
        const j = vs[k];
        const dh = hi - (sol[j] + bloc[j] + eau[j]);
        if (dh > 0) delta[j] += dh * f;
      }
      delta[i] -= sortie;
    }
    const ev = E.evaporation * dt;
    const evp = E.evaporationProfonde * dt;
    for (let i = 0; i < n; i++) {
      let w = eau[i] + delta[i];
      if (w > 0) w -= ev + evp * w;
      eau[i] = w > 0 ? w : 0;
    }
  }

  /** Recalcule l'humidité et la protection apportées par les arbres. */
  private majChamp() {
    this.champSale = false;
    const A = REGLAGES.arbres;
    const champ = this.champ;
    champ.fill(0);
    for (const a of this.arbres) {
      const r = A.rayonPousse + (A.rayonAdulte - A.rayonPousse) * lisse(0, 1, a.croissance);
      this.sphere.autour(a.noeud, r / R, (i, cos) => {
        const dist = Math.acos(Math.min(1, cos)) * R;
        const v = 1 - lisse(r * 0.55, r, dist);
        if (v > champ[i]) champ[i] = v;
      });
    }
  }

  private pasVie(dt: number, evenements: boolean) {
    const V = REGLAGES.vie;
    const { eau, humid, vie, cendre, champ, portee } = this;
    const s = this.sphere;
    const vd = s.voisinsDebut;
    const vs = s.voisins;
    const n = this.n;
    const decr = (s.pas * R) / V.porteeEau;
    const seuilM = REGLAGES.eau.seuilMouille;
    const sx = this.soleil.x, sy = this.soleil.y, sz = this.soleil.z;
    const d = s.dir;
    let total = 0;

    for (let i = 0; i < n; i++) {
      // Portée de l'eau : un champ de distance qui se propage d'un sommet à l'autre.
      let p = eau[i] > seuilM ? 1 : 0;
      let voisinVivant = false;
      for (let k = vd[i]; k < vd[i + 1]; k++) {
        const j = vs[k];
        const q = portee[j] - decr;
        if (q > p) p = q;
        if (vie[j] > 0.5) voisinVivant = true;
      }
      portee[i] = p;
      const cible = Math.max(p, champ[i]);
      const h = humid[i];
      if (cible > h) humid[i] = Math.min(cible, h + 1.5 * dt);
      else humid[i] = Math.max(cible, h - V.sechage * dt);

      const ens = d[i * 3] * sx + d[i * 3 + 1] * sy + d[i * 3 + 2] * sz;
      const lumiere = ens > 0.15 ? 1 : ens < -0.2 ? V.pousseNuit : V.pousseNuit + ((ens + 0.2) / 0.35) * (1 - V.pousseNuit);
      const mouille = eau[i] > seuilM;
      let v = vie[i];
      if (humid[i] >= V.seuilHumide && (voisinVivant || p > 0.85 || champ[i] > 0.35 || v > 0.05)) {
        v += V.pousseHerbe * dt * lumiere * (1 - cendre[i]) * (0.4 + humid[i]);
      } else if (ens < -0.25 && humid[i] < 0.15 && champ[i] < 0.05 && !mouille) {
        v -= V.gel * dt;
      }
      vie[i] = v > 1 ? 1 : v < 0 ? 0 : v;
      const c = cendre[i];
      if (c > 0) cendre[i] = Math.max(0, c - (0.015 + humid[i] * 0.12) * dt);
      total += mouille ? 1 : vie[i];
    }
    this.part = total / n;

    // Arbres
    const A = REGLAGES.arbres;
    for (const a of [...this.arbres]) {
      a.age += dt;
      if (a.croissance < 1) {
        const avant = a.croissance;
        const humide = humid[a.noeud] >= V.seuilHumide ? 1 : 0.25;
        a.croissance = Math.min(1, a.croissance + (dt / A.dureePousse) * this.jour(a.noeud) * humide + dt * 0.002);
        if (Math.floor(avant * 12) !== Math.floor(a.croissance * 12)) this.champSale = true;
        if (a.croissance >= 1 && evenements) this.evenements.push({ type: "arbreAdulte", arbre: a });
      } else {
        a.prochaineGraine -= dt;
        if (a.prochaineGraine <= 0) {
          a.prochaineGraine = A.intervalleGraine * (0.7 + this.alea() * 0.6);
          this.lacherGraine(a, evenements);
        }
      }
    }

    // Sources endormies : la vie qui les atteint les réveille.
    for (let k = 0; k < this.sources.length; k++) {
      const src = this.sources[k];
      src.depuis += dt;
      if (src.active) continue;
      let atteinte = false;
      s.autour(src.noeud, 2.2 / R, (i) => {
        if (vie[i] > 0.6) atteinte = true;
      });
      if (atteinte) this.reveillerSource(k);
    }

    for (const g of this.graines) g.age += dt;

    if (!this.victoire && this.part >= REGLAGES.objectif) {
      this.victoire = true;
      if (evenements) this.evenements.push({ type: "victoire" });
    }
  }

  private lacherGraine(a: Arbre, evenements: boolean) {
    const A = REGLAGES.arbres;
    const t = new THREE.Vector3(this.alea() - 0.5, this.alea() - 0.5, this.alea() - 0.5);
    t.sub(a.dir.clone().multiplyScalar(t.dot(a.dir))).normalize();
    const dir = avancer(a.dir, t, 3.2 + this.alea() * 3);
    const i = this.noeud(dir);
    const loinDesArbres = this.arbres.every((b) => b.dir.angleTo(dir) * R > 2.6);
    if (
      this.arbres.length < A.maximum &&
      loinDesArbres &&
      this.humid[i] >= REGLAGES.vie.seuilHumide &&
      this.eau[i] < 0.05 &&
      this.alea() < A.chanceSemisSeul
    ) {
      const nouveau = this.planter(dir, false);
      if (evenements) this.evenements.push({ type: "semis", arbre: nouveau });
    } else if (this.graines.length < 14 && this.eau[i] < 0.05) {
      const g = this.poserGraine(dir);
      if (evenements) this.evenements.push({ type: "graineTombee", graine: g });
    }
  }

  // ——— Vents de cendre ———

  private pasVents(dt: number) {
    const C = REGLAGES.cendre;
    if (this.temps >= this.prochainVent && !this.victoire) {
      this.prochainVent = this.temps + C.intervalle + this.alea() * 30;
      this.lancerVent();
    }
    for (const v of [...this.vents]) {
      v.temps += dt;
      v.centre.applyAxisAngle(v.axe, (C.vitesse / R) * dt).normalize();
      v.noeud = this.noeud(v.centre, v.noeud);
      const force = lisse(0, 3, v.temps) * (1 - lisse(v.duree - 4, v.duree, v.temps));
      this.sphere.autour(v.noeud, C.rayon / R, (i, cos) => {
        const dist = Math.acos(Math.min(1, cos)) * R;
        const f = force * (1 - lisse(C.rayon * 0.5, C.rayon, dist));
        const protection = borne(this.champ[i] * 1.8 + (this.eau[i] > 0.05 ? 1 : 0));
        const k = f * (1 - protection) * dt;
        if (k <= 0) return;
        this.cendre[i] = Math.min(1, this.cendre[i] + k * 0.9);
        this.humid[i] = Math.max(0, this.humid[i] - C.assechement * k);
        this.vie[i] = Math.max(0, this.vie[i] - C.degat * k);
      });
      if (v.temps >= v.duree) {
        this.vents.splice(this.vents.indexOf(v), 1);
        this.evenements.push({ type: "ventFini" });
      }
    }
  }

  /** Lance un vent de cendre qui traverse la partie la plus verte de la planète, ou le joueur. */
  lancerVent(vers?: THREE.Vector3) {
    const C = REGLAGES.cendre;
    // On vise un sommet vivant au hasard (ou le joueur), et le vent arrive de loin.
    let cible = vers?.clone().normalize();
    if (!cible) {
      for (let essai = 0; essai < 40; essai++) {
        const i = Math.floor(this.alea() * this.n);
        if (this.vie[i] > 0.5) {
          cible = this.dirNoeud(i);
          break;
        }
      }
    }
    cible ??= new THREE.Vector3(this.alea() - 0.5, this.alea() - 0.5, this.alea() - 0.5).normalize();
    const t = new THREE.Vector3(this.alea() - 0.5, this.alea() - 0.5, this.alea() - 0.5);
    t.sub(cible.clone().multiplyScalar(t.dot(cible))).normalize();
    const axe = new THREE.Vector3().crossVectors(t, cible).normalize();
    // Le centre part en amont : il atteint la cible au milieu de sa course.
    const centre = cible.clone().applyAxisAngle(axe, (-C.vitesse * C.duree * 0.5) / R);
    const v: Vent = { centre, axe, temps: 0, duree: C.duree, noeud: this.noeud(centre) };
    this.vents.push(v);
    this.evenements.push({ type: "vent", vent: v });
    return v;
  }

  /** Débogage : rend une partie de la planète vivante d'un coup (autour des sources et de quelques arbres). */
  verdir(part: number) {
    if (part <= 0) return;
    for (const s of this.sources) {
      s.active = true;
      s.depuis = 99;
    }
    for (let k = 0; k < 30 * REGLAGES.eau.pasParSeconde; k++) this.pasEau(1 / REGLAGES.eau.pasParSeconde);
    let essais = 0;
    while (essais++ < 400) {
      let compte = 0;
      for (let i = 0; i < this.n; i++) if (this.vie[i] > 0.5 || this.mouille(i)) compte++;
      if (compte / this.n >= part) break;
      const i = Math.floor(this.alea() * this.n);
      const dir = this.dirNoeud(i);
      if (this.arbres.some((a) => a.dir.angleTo(dir) * R < 4)) continue;
      const a = this.planter(dir, false);
      a.croissance = 1;
      this.majChamp();
      for (let k = 0; k < 3; k++) this.pasVie(0.1, false);
      this.sphere.autour(a.noeud, 5 / R, (j) => {
        if (this.humid[j] >= 0.2) this.vie[j] = 1;
      });
    }
    for (let k = 0; k < 20; k++) this.pasVie(0.2, false);
  }
}
