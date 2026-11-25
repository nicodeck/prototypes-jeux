// La simulation d'une course : les karts, les objets, les perles, les tours et le classement.
// Elle avance d'une image à la fois (60 par seconde), toujours de la même façon pour les mêmes
// commandes : elle ne dépend pas du rendu et tourne aussi dans les tests.
import { REGLAGES as R } from "../reglages";
import { Circuit, type Lieu, type Memo } from "./circuit";
import { hasard } from "./hasard";
import { PILOTES, type NomPilote } from "./pilotes";

export const IMAGES_PAR_SECONDE = 60;
const DT = 1 / IMAGES_PAR_SECONDE;
const img = (secondes: number) => Math.round(secondes * IMAGES_PAR_SECONDE);

/** Le rayon d'un kart, pour les chocs. */
export const RAYON_KART = 0.95;

export interface Commandes {
  /** Le volant : -1 à gauche, 1 à droite. */
  direction: number;
  accelerer: boolean;
  freiner: boolean;
  /** Saut et dérapage. */
  derive: boolean;
  objet: boolean;
}

export const AUCUNE_COMMANDE: Commandes = { direction: 0, accelerer: false, freiner: false, derive: false, objet: false };

export type NomObjet = "piment" | "oursin" | "meduse" | "bulle";
export const LISTE_OBJETS: NomObjet[] = ["piment", "oursin", "meduse", "bulle"];

export type TypeEvenement =
  | "decompte"
  | "depart"
  | "turboDepart"
  | "saut"
  | "atterrit"
  | "derive"
  | "palier"
  | "miniTurbo"
  | "bande"
  | "perle"
  | "objet"
  | "lance"
  | "touche"
  | "bulleEclate"
  | "eclat"
  | "rebond"
  | "choc"
  | "mur"
  | "plouf"
  | "retour"
  | "tour"
  | "arrivee";

export interface Evenement {
  type: TypeEvenement;
  /** Le kart concerné, s'il y en a un. */
  kart: number;
  x: number;
  y: number;
  z: number;
  valeur?: number;
  objet?: NomObjet;
}

export interface ObjetPose {
  id: number;
  type: "oursin" | "meduse";
  x: number;
  y: number;
  z: number;
  cap: number;
  vitesse: number;
  /** Images restantes (les méduses restent jusqu'à ce qu'on les touche). */
  vie: number;
  age: number;
  proprietaire: number;
  memo: Memo;
}

export interface Perle {
  x: number;
  y: number;
  z: number;
  /** Images avant de réapparaître (0 = là). */
  retour: number;
}

export class Kart {
  x: number;
  y: number;
  z: number;
  vy = 0;
  /** Direction de la marche, en radians : (cos, sin) dans le plan (x, z). */
  cap: number;
  /** Vitesse vers l'avant. */
  v = 0;
  /** Une poussée qui s'amortit (chocs). */
  pousseX = 0;
  pousseZ = 0;
  auSol = true;
  /** Le sens du dérapage : -1 à gauche, 1 à droite, 0 sans dérapage. */
  derive = 0;
  /** Le petit saut est en cours, et le sens du dérapage qu'il prépare. */
  sautDerive = false;
  sensPrevu = 0;
  /** Le temps passé à déraper, et le palier atteint (0, 1 bleu, 2 orange). */
  charge = 0;
  palier = 0;
  /** Images de turbo restantes. */
  turbo = 0;
  /** Images où le kart est sonné (il tourne sur lui-même), où il est dans l'eau, où il est intouchable. */
  sonne = 0;
  chute = 0;
  invincible = 0;
  objet: NomObjet | null = null;
  /** La roulette tourne : l'objet qu'on aura à la fin. */
  roulette = 0;
  prochainObjet: NomObjet | null = null;
  bulle = 0;
  /** Le volant à l'image précédente (pour le rendu). */
  braquage = 0;
  /** La distance parcourue depuis la ligne (négative sur la grille). */
  distance: number;
  tour = 1;
  fini = false;
  /** Le temps de course à l'arrivée, en images. */
  temps = 0;
  rang = 1;
  /** Les temps à chaque passage de la ligne, en images. */
  passages: number[] = [];
  lieu!: Lieu;
  readonly memo: Memo = {};
  sPrec: number;
  /** Le dernier endroit sûr, pour être replacé après une chute. */
  sur: { piste: "principal" | "raccourci"; s: number; d: number };
  precedent: Commandes = { ...AUCUNE_COMMANDE };
  /** Quand l'accélérateur a été enfoncé pendant le décompte (pour le turbo de départ). */
  accelDepuis: number | null = null;
  /** Compteurs, pour les tests. */
  chutes = 0;
  miniTurbos = 0;

  constructor(
    readonly numero: number,
    readonly pilote: NomPilote,
    place: { x: number; y: number; z: number; cap: number; s: number },
    longueur: number,
  ) {
    this.x = place.x;
    this.y = place.y;
    this.z = place.z;
    this.cap = place.cap;
    this.sPrec = place.s;
    this.distance = place.s - longueur;
    this.sur = { piste: "principal", s: place.s, d: 0 };
  }

  get stats() {
    return PILOTES[this.pilote];
  }

  /** Le kart obéit au pilote (ni sonné, ni dans l'eau). */
  get maitrise() {
    return this.sonne === 0 && this.chute === 0;
  }
}

export interface OptionsCourse {
  graine?: number;
  /** Sans objets ni perles (contre-la-montre, tests). */
  objets?: boolean;
  circuit?: Circuit;
  /** Durée du décompte, en secondes. */
  decompte?: number;
}

let circuitPartage: Circuit | null = null;

export class Course {
  readonly circuit: Circuit;
  readonly karts: Kart[];
  readonly objets: ObjetPose[] = [];
  readonly perles: Perle[];
  readonly avecObjets: boolean;
  /** Le nombre d'images avant le départ. */
  readonly depart: number;
  image = 0;
  evenements: Evenement[] = [];
  private readonly alea: () => number;
  private prochainId = 1;

  constructor(pilotes: NomPilote[], options: OptionsCourse = {}) {
    this.circuit = options.circuit ?? (circuitPartage ??= new Circuit());
    this.avecObjets = options.objets ?? true;
    this.depart = img(options.decompte ?? 3);
    this.alea = hasard(options.graine ?? 1);
    const L = this.circuit.principal.longueur;
    this.karts = pilotes.map((p, i) => {
      const k = new Kart(i, p, this.circuit.grille[i], L);
      k.lieu = this.circuit.lieu(k.x, k.z, k.memo);
      k.y = k.lieu.y;
      return k;
    });
    this.perles = this.avecObjets ? this.circuit.perles.map((p) => ({ ...p, retour: 0 })) : [];
    this.classer();
  }

  get longueur() {
    return this.circuit.principal.longueur;
  }

  /** Le chrono de la course, en secondes. */
  get chrono() {
    return Math.max(0, this.image - this.depart) / IMAGES_PAR_SECONDE;
  }

  get lancee() {
    return this.image >= this.depart;
  }

  get terminee() {
    return this.karts.every((k) => k.fini);
  }

  private evt(type: TypeEvenement, k: Kart | null, extra: Partial<Evenement> = {}) {
    this.evenements.push({ type, kart: k ? k.numero : -1, x: k?.x ?? 0, y: k?.y ?? 0, z: k?.z ?? 0, ...extra });
  }

  /** Avance d'une image. */
  pas(commandes: Commandes[]) {
    this.evenements = [];
    this.image++;
    if (!this.lancee) {
      if ((this.depart - this.image) % IMAGES_PAR_SECONDE === 0) this.evt("decompte", null, { valeur: (this.depart - this.image) / IMAGES_PAR_SECONDE });
      for (const k of this.karts) {
        const c = commandes[k.numero] ?? AUCUNE_COMMANDE;
        if (c.accelerer) k.accelDepuis ??= this.image;
        else k.accelDepuis = null;
        k.braquage = c.direction;
        k.precedent = { ...c };
      }
      return;
    }
    if (this.image === this.depart) {
      this.evt("depart", null);
      // Le turbo de départ : accélérer juste avant le top, pas trop tôt.
      for (const k of this.karts)
        if (k.accelDepuis !== null && this.depart - k.accelDepuis <= img(0.55)) {
          k.turbo = img(R.turbo.depart);
          k.v = 10;
          this.evt("turboDepart", k);
        }
    }
    for (const k of this.karts) this.piloter(k, commandes[k.numero] ?? AUCUNE_COMMANDE);
    this.chocs();
    this.avancerObjets();
    this.ramasserPerles();
    this.classer();
  }

  private piloter(k: Kart, c: Commandes) {
    const appuiDerive = c.derive && !k.precedent.derive;
    const appuiObjet = c.objet && !k.precedent.objet;
    k.precedent = { ...c };
    k.braquage = c.direction;
    if (k.invincible > 0) k.invincible--;
    if (k.bulle > 0) k.bulle--;
    if (k.turbo > 0) k.turbo--;

    if (k.chute > 0) {
      k.chute--;
      k.y -= 0.03;
      if (k.chute === 0) this.reapparaitre(k);
      return;
    }

    // ——— La roulette et les objets
    if (k.roulette > 0) {
      k.roulette--;
      if (k.roulette === 0) {
        k.objet = k.prochainObjet;
        this.evt("objet", k, { objet: k.objet ?? undefined });
      }
    } else if (appuiObjet && k.objet && k.maitrise) this.utiliser(k);

    const st = k.stats;
    const maitrise = k.maitrise;
    if (k.sonne > 0) k.sonne--;
    const lieu = k.lieu;
    const sol = lieu.surface === "eau" ? "sable" : lieu.surface;

    // ——— La vitesse
    const vRef = R.vitesseMax * st.vitesse;
    let vmax = vRef * (k.turbo > 0 ? R.turbo.vitesse : R.sols[sol]);
    if (!maitrise) vmax *= 0.3;
    if (k.turbo > 0 && k.auSol) k.v = Math.min(vmax, k.v + 45 * DT);
    if (maitrise && c.freiner) {
      if (k.v > 0.5) k.v -= R.frein * DT;
      else k.v = Math.max(-R.recul, k.v - R.acceleration * 0.6 * DT);
    } else if (maitrise && c.accelerer) {
      if (k.v < vmax) k.v = Math.min(vmax, k.v + R.acceleration * st.acceleration * Math.max(0.1, 1 - k.v / vmax) * DT);
    } else if (k.turbo === 0) {
      k.v -= Math.sign(k.v) * Math.min(Math.abs(k.v), R.roueLibre * DT);
    }
    if (k.v > vmax) k.v = Math.max(vmax, k.v - (k.v - vmax) * 3 * DT - 2 * DT);

    // ——— Le saut et le dérapage
    if (maitrise && appuiDerive && k.auSol && k.derive === 0) {
      k.vy = R.saut;
      k.auSol = false;
      k.sautDerive = true;
      k.sensPrevu = 0;
      this.evt("saut", k);
    }
    if (k.sautDerive && Math.abs(c.direction) > 0.25) k.sensPrevu = Math.sign(c.direction);
    if (k.derive !== 0) {
      if (!maitrise || !c.derive || k.v < R.derive.vitesseMin * 0.6) this.finirDerive(k, maitrise && !c.derive);
      else {
        if (sol === "route" || sol === "planches")
          k.charge += DT * st.derive * (1 + 0.7 * Math.max(0, c.direction * k.derive));
        const palier = k.charge >= R.derive.palier2 ? 2 : k.charge >= R.derive.palier1 ? 1 : 0;
        if (palier > k.palier) {
          k.palier = palier;
          this.evt("palier", k, { valeur: palier });
        }
      }
    }

    // ——— Le volant
    let rotation: number;
    if (k.derive !== 0) {
      rotation = k.derive * (R.derive.virage + R.derive.virageEnPlus * c.direction * k.derive) * Math.sqrt(st.maniabilite);
    } else {
      const vr = Math.min(1, Math.abs(k.v) / R.vitesseMax);
      const taux = R.virage * st.maniabilite * Math.min(1, Math.abs(k.v) / 4) * (1 - R.perteDeBraquage * vr * vr);
      rotation = c.direction * taux;
    }
    if (!k.auSol && !k.sautDerive) rotation *= 0.5;
    if (!maitrise) rotation = 0;
    k.cap += rotation * DT * (k.v >= 0 ? 1 : -1);

    // ——— Le déplacement
    const fx = Math.cos(k.cap);
    const fz = Math.sin(k.cap);
    let dx = fx * k.v + k.pousseX;
    let dz = fz * k.v + k.pousseZ;
    if (k.derive !== 0) {
      // Glisse vers l'extérieur : la droite du kart est (-fz, fx).
      const g = -k.derive * R.derive.glisse * Math.min(1, k.v / R.vitesseMax);
      dx += -fz * g;
      dz += fx * g;
    }
    k.x += dx * DT;
    k.z += dz * DT;
    k.pousseX *= 0.88;
    k.pousseZ *= 0.88;

    let ici = this.circuit.lieu(k.x, k.z, k.memo);
    // Les murs : on recolle le kart contre le mur, il perd de la vitesse et longe le bord.
    if (ici.mur !== null && Math.abs(ici.proj.d) > ici.mur - RAYON_KART) {
      const piste = ici.piste === "principal" ? this.circuit.principal : this.circuit.raccourci;
      const e = piste.echantillons[ici.proj.i];
      const signe = Math.sign(ici.proj.d);
      const exces = Math.abs(ici.proj.d) - (ici.mur - RAYON_KART);
      k.x -= e.nx * signe * exces;
      k.z -= e.nz * signe * exces;
      const versMur = (dx * e.nx + dz * e.nz) * signe;
      if (versMur > 0) {
        const vitesse = Math.hypot(dx, dz) || 1;
        const angle = versMur / vitesse;
        k.v *= Math.max(0.35, 1 - angle * 0.9);
        // Le kart se remet dans l'axe de la route.
        const sens = fx * e.tx + fz * e.tz >= 0 ? 1 : -1;
        const capRoute = Math.atan2(e.tz * sens, e.tx * sens);
        let ecart = capRoute - k.cap;
        while (ecart > Math.PI) ecart -= Math.PI * 2;
        while (ecart < -Math.PI) ecart += Math.PI * 2;
        k.cap += ecart * Math.min(1, angle * 1.5);
        k.pousseX = -e.nx * signe * versMur * 0.35;
        k.pousseZ = -e.nz * signe * versMur * 0.35;
        if (versMur > 5) {
          this.evt("mur", k, { valeur: versMur });
          if (k.derive !== 0) this.finirDerive(k, false);
        }
      }
      ici = this.circuit.lieu(k.x, k.z, k.memo);
    }
    k.lieu = ici;

    // ——— La hauteur : on colle au sol tant qu'il ne se dérobe pas plus vite que la gravité.
    const yAvant = k.y;
    if (k.auSol) {
      const vy = k.vy - R.gravite * DT;
      const y = k.y + vy * DT;
      if (y <= ici.y) {
        k.y = ici.y;
        k.vy = Math.max(-15, Math.min(15, (ici.y - yAvant) / DT));
      } else {
        k.auSol = false;
        k.y = y;
        k.vy = vy;
      }
    } else {
      k.vy -= R.gravite * DT;
      k.y += k.vy * DT;
      if (k.y <= ici.y) {
        const force = -k.vy;
        k.y = ici.y;
        k.vy = 0;
        k.auSol = true;
        if (force > 3) this.evt("atterrit", k, { valeur: force });
        if (k.sautDerive) {
          k.sautDerive = false;
          const sens = k.sensPrevu || (Math.abs(c.direction) > 0.25 ? Math.sign(c.direction) : 0);
          if (maitrise && c.derive && sens !== 0 && k.v >= R.derive.vitesseMin) {
            k.derive = sens;
            k.charge = 0;
            k.palier = 0;
            this.evt("derive", k, { valeur: sens });
          }
        }
      }
    }

    // ——— L'eau
    if (ici.surface === "eau" && k.y <= ici.y + 0.05) {
      k.chute = img(R.chute);
      k.chutes++;
      k.v = 0;
      k.turbo = 0;
      k.pousseX = k.pousseZ = 0;
      if (k.derive !== 0) this.finirDerive(k, false);
      this.evt("plouf", k);
      return;
    }
    if (k.auSol && (ici.surface === "route" || ici.surface === "planches")) {
      const piste = ici.piste === "principal" ? this.circuit.principal : this.circuit.raccourci;
      const demi = piste.echantillons[ici.proj.i].largeur / 2;
      k.sur = { piste: ici.piste, s: ici.proj.s, d: Math.max(-demi + 1.5, Math.min(demi - 1.5, ici.proj.d)) };
    }
    if (ici.bande && k.auSol) {
      if (k.turbo < img(R.turbo.bande) - 10) this.evt("bande", k);
      k.turbo = Math.max(k.turbo, img(R.turbo.bande));
    }

    this.avancer(k);
  }

  /** Compte la distance parcourue, les tours et l'arrivée. */
  private avancer(k: Kart) {
    const L = this.longueur;
    let ds = k.lieu.s - k.sPrec;
    if (ds > L / 2) ds -= L;
    if (ds < -L / 2) ds += L;
    k.distance += ds;
    k.sPrec = k.lieu.s;
    if (k.fini) return;
    const tour = Math.floor(k.distance / L) + 1;
    if (tour > k.tour) {
      k.tour = tour;
      k.passages.push(this.image - this.depart);
      if (tour > R.tours) {
        k.fini = true;
        k.temps = this.image - this.depart;
        this.evt("arrivee", k, { valeur: this.karts.filter((a) => a.fini).length });
      } else this.evt("tour", k, { valeur: tour });
    }
  }

  private finirDerive(k: Kart, volontaire: boolean) {
    if (volontaire && k.palier > 0) {
      const duree = img(k.palier === 2 ? R.derive.turbo2 : R.derive.turbo1);
      k.turbo = Math.max(k.turbo, duree);
      k.miniTurbos++;
      this.evt("miniTurbo", k, { valeur: k.palier });
    }
    k.derive = 0;
    k.charge = 0;
    k.palier = 0;
  }

  private reapparaitre(k: Kart) {
    const piste = k.sur.piste === "principal" ? this.circuit.principal : this.circuit.raccourci;
    const q = piste.point(k.sur.s, k.sur.d);
    k.x = q.x;
    k.z = q.z;
    k.cap = q.cap;
    k.v = 0;
    k.vy = 0;
    k.auSol = true;
    k.invincible = img(1.5);
    k.memo.iP = undefined;
    k.memo.iR = undefined;
    k.lieu = this.circuit.lieu(k.x, k.z, k.memo);
    k.y = k.lieu.y;
    this.avancer(k);
    this.evt("retour", k);
  }

  // ——— Les objets ———

  private tirage(k: Kart): NomObjet {
    // Plus on est loin derrière, plus on a de chances de tomber sur un bon objet.
    const r = (k.rang - 1) / Math.max(1, this.karts.length - 1);
    const poids: Record<NomObjet, number> = {
      piment: 0.08 + 0.5 * r,
      oursin: 0.28 + 0.12 * r,
      meduse: 0.42 - 0.38 * r,
      bulle: 0.22 - 0.1 * r,
    };
    let total = 0;
    for (const o of LISTE_OBJETS) total += poids[o];
    let x = this.alea() * total;
    for (const o of LISTE_OBJETS) {
      x -= poids[o];
      if (x <= 0) return o;
    }
    return "piment";
  }

  private utiliser(k: Kart) {
    const objet = k.objet!;
    k.objet = null;
    const fx = Math.cos(k.cap);
    const fz = Math.sin(k.cap);
    if (objet === "piment") k.turbo = Math.max(k.turbo, img(R.turbo.piment));
    else if (objet === "bulle") k.bulle = img(R.objets.bulle);
    else {
      const devant = objet === "oursin";
      const o: ObjetPose = {
        id: this.prochainId++,
        type: objet,
        x: k.x + fx * (devant ? 2.4 : -2.6),
        z: k.z + fz * (devant ? 2.4 : -2.6),
        y: k.y,
        cap: k.cap,
        vitesse: devant ? R.objets.oursinVitesse + Math.max(0, k.v) * 0.3 : 0,
        vie: devant ? img(R.objets.oursinVie) : Infinity,
        age: 0,
        proprietaire: k.numero,
        memo: {},
      };
      const l = this.circuit.lieu(o.x, o.z, o.memo);
      o.y = l.y;
      this.objets.push(o);
      const meduses = this.objets.filter((m) => m.type === "meduse");
      if (meduses.length > R.objets.medusesMax) this.objets.splice(this.objets.indexOf(meduses[0]), 1);
    }
    this.evt("lance", k, { objet });
  }

  private toucher(k: Kart, par: ObjetPose | null) {
    if (k.chute > 0 || k.invincible > 0) return false;
    if (k.bulle > 0) {
      k.bulle = 0;
      k.invincible = img(0.5);
      this.evt("bulleEclate", k);
      return true;
    }
    k.sonne = img(R.objets.sonne);
    k.invincible = k.sonne + img(0.8);
    k.v *= 0.3;
    k.turbo = 0;
    if (k.derive !== 0) this.finirDerive(k, false);
    this.evt("touche", k, { objet: par?.type });
    return true;
  }

  private avancerObjets() {
    const C = this.circuit;
    for (let i = this.objets.length - 1; i >= 0; i--) {
      const o = this.objets[i];
      o.age++;
      if (o.type === "oursin") {
        o.vie--;
        o.x += Math.cos(o.cap) * o.vitesse * DT;
        o.z += Math.sin(o.cap) * o.vitesse * DT;
        const l = C.lieu(o.x, o.z, o.memo);
        const piste = l.piste === "principal" ? C.principal : C.raccourci;
        const e = piste.echantillons[l.proj.i];
        const bord = e.largeur / 2 + 0.3;
        // L'oursin rebondit sur les bords de la route.
        if (Math.abs(l.proj.d) > bord) {
          const signe = Math.sign(l.proj.d);
          const exces = Math.abs(l.proj.d) - bord;
          o.x -= e.nx * signe * exces * 2;
          o.z -= e.nz * signe * exces * 2;
          const vx = Math.cos(o.cap);
          const vz = Math.sin(o.cap);
          const pn = vx * e.nx + vz * e.nz;
          if (pn * signe > 0) {
            o.cap = Math.atan2(vz - 2 * pn * e.nz, vx - 2 * pn * e.nx);
            this.evenements.push({ type: "rebond", kart: -1, x: o.x, y: o.y, z: o.z });
          }
        }
        o.y = C.lieu(o.x, o.z, o.memo).y;
        if (o.vie <= 0) {
          this.objets.splice(i, 1);
          this.evenements.push({ type: "eclat", kart: -1, x: o.x, y: o.y, z: o.z });
          continue;
        }
      }
      // Les karts
      let touche = false;
      for (const k of this.karts) {
        if (k.chute > 0) continue;
        if (k.numero === o.proprietaire && o.age < 25) continue;
        const d2 = (k.x - o.x) ** 2 + (k.z - o.z) ** 2;
        if (d2 < 1.6 * 1.6 && Math.abs(k.y - o.y) < 2) {
          if (this.toucher(k, o) || k.invincible > 0) {
            touche = true;
            break;
          }
        }
      }
      if (touche) {
        this.objets.splice(i, 1);
        this.evenements.push({ type: "eclat", kart: -1, x: o.x, y: o.y, z: o.z });
        continue;
      }
      // Un oursin qui croise une méduse : les deux disparaissent.
      if (o.type === "oursin")
        for (let j = this.objets.length - 1; j >= 0; j--) {
          const m = this.objets[j];
          if (m === o || m.type !== "meduse") continue;
          if ((m.x - o.x) ** 2 + (m.z - o.z) ** 2 < 1.5 * 1.5) {
            this.evenements.push({ type: "eclat", kart: -1, x: o.x, y: o.y, z: o.z });
            const a = Math.max(i, j);
            const b = Math.min(i, j);
            this.objets.splice(a, 1);
            this.objets.splice(b, 1);
            i = Math.min(i, this.objets.length);
            break;
          }
        }
    }
  }

  private ramasserPerles() {
    for (const p of this.perles) {
      if (p.retour > 0) {
        p.retour--;
        continue;
      }
      for (const k of this.karts) {
        if (k.chute > 0) continue;
        if ((k.x - p.x) ** 2 + (k.z - p.z) ** 2 < 2.0 * 2.0 && Math.abs(k.y - p.y) < 2.5) {
          p.retour = img(R.objets.retourPerle);
          this.evt("perle", k);
          if (!k.objet && k.roulette === 0) {
            k.roulette = img(R.objets.roulette);
            k.prochainObjet = this.tirage(k);
          }
          break;
        }
      }
    }
  }

  // ——— Les chocs entre karts ———

  private chocs() {
    const K = this.karts;
    for (let i = 0; i < K.length; i++)
      for (let j = i + 1; j < K.length; j++) {
        const a = K[i];
        const b = K[j];
        if (a.chute > 0 || b.chute > 0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const min = RAYON_KART * 2;
        if (d2 >= min * min || Math.abs(a.y - b.y) > 1.2) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d;
        const nz = dz / d;
        const ma = a.stats.poids;
        const mb = b.stats.poids;
        const recouvre = min - d;
        a.x -= nx * recouvre * (mb / (ma + mb));
        a.z -= nz * recouvre * (mb / (ma + mb));
        b.x += nx * recouvre * (ma / (ma + mb));
        b.z += nz * recouvre * (ma / (ma + mb));
        const va = a.v * (Math.cos(a.cap) * nx + Math.sin(a.cap) * nz) + a.pousseX * nx + a.pousseZ * nz;
        const vb = b.v * (Math.cos(b.cap) * nx + Math.sin(b.cap) * nz) + b.pousseX * nx + b.pousseZ * nz;
        const rapproche = va - vb;
        if (rapproche <= 0) continue;
        const coup = rapproche + 2;
        a.pousseX -= nx * coup * (mb / (ma + mb));
        a.pousseZ -= nz * coup * (mb / (ma + mb));
        b.pousseX += nx * coup * (ma / (ma + mb));
        b.pousseZ += nz * coup * (ma / (ma + mb));
        // Celui qui rentre dans l'autre perd un peu de sa vitesse.
        const avantA = Math.cos(a.cap) * nx + Math.sin(a.cap) * nz;
        const avantB = -(Math.cos(b.cap) * nx + Math.sin(b.cap) * nz);
        if (avantA > 0) a.v -= avantA * rapproche * 0.5 * (mb / (ma + mb));
        if (avantB > 0) b.v -= avantB * rapproche * 0.5 * (ma / (ma + mb));
        if (rapproche > 3) this.evenements.push({ type: "choc", kart: a.numero, x: (a.x + b.x) / 2, y: a.y, z: (a.z + b.z) / 2, valeur: rapproche });
      }
  }

  /** Le classement : les arrivés par temps, puis les autres par distance parcourue. */
  private classer() {
    const ordre = [...this.karts].sort((a, b) => {
      if (a.fini && b.fini) return a.temps - b.temps;
      if (a.fini !== b.fini) return a.fini ? -1 : 1;
      return b.distance - a.distance;
    });
    ordre.forEach((k, i) => (k.rang = i + 1));
  }

  /** Les karts dans l'ordre du classement. */
  classement() {
    return [...this.karts].sort((a, b) => a.rang - b.rang);
  }
}
