// L'architecte : un bâtisseur automatique qui fait grandir la cité comme le ferait un joueur
// appliqué. Il sert à deux choses :
// - les tests : il prouve que l'on peut aller du bourg de départ jusqu'au temple ;
// - la vitrine (?vitrine) : il bâtit en quelques secondes une grande cité pour montrer le rendu.
//
// À chaque décision, il regarde ce qui manque (un bien, un service, de la place pour loger) et
// pose le bâtiment qui y répond, à l'endroit le plus raisonnable : les maisons et les petits
// ateliers sur la grille romaine, près du forum ; les champs, les oliveraies et les vignes à la
// campagne ; la carrière contre la roche ; le temple sur le promontoire.
import { BESOINS, FICHES, type Marchandise, type Palier, type TypeBatiment } from "./catalogue";
import { estRueDeGrille } from "./bourg";
import { GEO, indice, TAILLE } from "./ile";
import { bordure, type Case } from "./routes";
import { MARCHANDISES, type Batiment, type Besoin, type Ville } from "./ville";

/** Qui produit quoi, et ce qu'il lui faut */
const PRODUCTEUR: Partial<Record<Marchandise, TypeBatiment>> = {
  bois: "bucheron",
  marbre: "carriere",
  poisson: "peche",
  ble: "ferme",
  farine: "moulin",
  pain: "boulangerie",
  olives: "oliveraie",
  huile: "pressoir",
  raisin: "vigne",
  vin: "cave",
};

const CENTRE = { x: 58, z: 80 };

/** Où chaque sorte de bâtiment aime s'installer */
const ANCRES: Partial<Record<TypeBatiment, { x: number; z: number }>> = {
  ferme: { x: 34, z: 78 },
  oliveraie: { x: 50, z: 58 },
  vigne: { x: 76, z: 62 },
  carriere: { x: 80, z: 42 },
  bucheron: { x: 44, z: 52 },
  peche: { x: 48, z: 93 },
  moulin: { x: 44, z: 74 },
  boulangerie: { x: 52, z: 70 },
  pressoir: { x: 56, z: 64 },
  cave: { x: 70, z: 66 },
  temple: { x: 108, z: 77 },
};

/** Les bâtiments qui suivent la grille des rues */
const SUR_GRILLE = new Set<TypeBatiment>(["maison", "moulin", "boulangerie", "pressoir", "cave", "entrepot"]);

export interface Decision {
  type: TypeBatiment | "attente";
  raison: string;
}

export class Architecte {
  private prochain = 0;
  /** Les tentatives ratées récentes, pour ne pas boucler sur un bâtiment impossible */
  private echecs = new Map<TypeBatiment, number>();
  journal: Decision[] = [];

  constructor(
    private readonly v: Ville,
    private readonly cadence = 2,
  ) {}

  /** À appeler à chaque pas : l'architecte décide quand c'est son tour. */
  agir(): Decision | null {
    const v = this.v;
    if (v.temps < this.prochain) return null;
    this.prochain = v.temps + this.cadence;
    const d = this.decider();
    if (d) this.journal.push(d);
    return d;
  }

  // -------------------------------------------------------------------------------------------
  // Les décisions
  // -------------------------------------------------------------------------------------------

  private nombre(type: TypeBatiment) {
    let n = 0;
    for (const b of this.v.batiments.values()) if (b.type === type) n++;
    return n;
  }

  /** Production par minute (chantiers compris) */
  private offre(m: Marchandise) {
    const type = PRODUCTEUR[m];
    if (!type) return 0;
    const f = FICHES[type];
    return this.nombre(type) * (60 / f.duree!) * (type === "bucheron" ? 0.8 : 1);
  }

  /** Consommation par minute, en comptant les habitants qui viendront */
  private demande(m: Marchandise) {
    const { parPalier } = this.v.population();
    let d = 0;
    for (const p of [0, 1, 2] as Palier[]) d += parPalier[p] * 1.15 * (BESOINS[p].biens[m] ?? 0);
    return d;
  }

  private decider(): Decision | null {
    const v = this.v;
    const pop = v.population();
    const temple = [...v.batiments.values()].find((b) => b.type === "temple");
    const voulus: { type: TypeBatiment; raison: string; ancre?: { x: number; z: number } }[] = [];

    // Le temple, dès qu'il est débloqué ; et le marbre qu'il demande
    if (v.palierMax >= 3 && !temple) {
      voulus.push({ type: "temple", raison: "le temple est débloqué" });
      if (this.offre("marbre") < 6) voulus.push({ type: "carriere", raison: "il faut du marbre pour le temple" });
    }

    // Du bois avant tout : sans bois, on ne bâtit rien
    if (v.stocks.bois < 25 && this.offre("bois") < 7 + pop.total * 0.025) voulus.push({ type: "bucheron", raison: "le bois manque" });

    // Les services qui manquent (et le marbre des thermes)
    for (const service of ["forum", "thermes"] as TypeBatiment[]) {
      if (service === "thermes" && v.palierMax < 1) continue;
      const prives = [...v.batiments.values()].filter((b) => b.type === "maison" && b.chantier >= 1 && b.manques.includes(service as Besoin));
      if (prives.length < 3) continue;
      if (service === "thermes" && this.nombre("carriere") === 0) voulus.push({ type: "carriere", raison: "il faut du marbre pour les thermes" });
      const x = prives.reduce((s, b) => s + b.i + 1, 0) / prives.length;
      const z = prives.reduce((s, b) => s + b.j + 1, 0) / prives.length;
      voulus.push({ type: service, raison: `${prives.length} maisons sans ${service}`, ancre: { x, z } });
    }
    if (v.palierMax >= 2 && this.offre("marbre") < 3) voulus.push({ type: "carriere", raison: "les Equites veulent du marbre" });

    // Les biens de chaque niveau, en remontant les chaînes
    const biens: Marchandise[] = ["poisson"];
    if (v.palierMax >= 1) biens.push("pain", "huile");
    if (v.palierMax >= 2) biens.push("vin");
    for (const m of biens) {
      const besoin = Math.max(this.demande(m), m === "poisson" ? 2 : 1.5);
      const maillon = this.chaine(m).find((x) => this.offre(x) < besoin);
      if (maillon) voulus.push({ type: PRODUCTEUR[maillon]!, raison: `il manque du ${maillon}` });
    }

    // Un entrepôt quand ça déborde
    const capacite = v.capaciteStock();
    if (MARCHANDISES.some((m) => v.stocks[m] > capacite * 0.85) && this.nombre("entrepot") < 4) voulus.push({ type: "entrepot", raison: "les stocks débordent", ancre: { x: 50, z: 72 } });

    for (const voulu of voulus) {
      const f = FICHES[voulu.type];
      if (!v.debloque(voulu.type)) continue;
      if ((this.echecs.get(voulu.type) ?? -1e9) > v.temps - 30) continue;
      if (!this.peutConstruire(voulu.type)) return { type: "attente", raison: `on économise pour : ${f.nom}` };
      if (this.batir(voulu.type, voulu.ancre)) return voulu;
      this.echecs.set(voulu.type, v.temps);
    }

    // Loger du monde : quand les maisons sont presque pleines
    const maisons = [...v.batiments.values()].filter((b) => b.type === "maison");
    const enChantier = maisons.filter((b) => b.chantier < 1).length;
    const pleines = maisons.filter((b) => b.chantier >= 1 && b.habitants >= BESOINS[b.palier].capacite * 0.7).length;
    if (enChantier < 3 && pleines >= (maisons.length - enChantier) * 0.6 && v.denarii > 260 && this.peutConstruire("maison")) {
      return this.essai("maison", "les maisons sont pleines");
    }
    return { type: "attente", raison: "rien d'urgent" };
  }

  /** Les maillons d'une chaîne, du premier au dernier (blé → farine → pain) */
  private chaine(m: Marchandise): Marchandise[] {
    const type = PRODUCTEUR[m]!;
    const entree = FICHES[type].consomme;
    return entree ? [...this.chaine(entree), m] : [m];
  }

  private peutConstruire(type: TypeBatiment) {
    const f = FICHES[type];
    return this.v.denarii >= f.cout.denarii + 40 && this.v.stocks.bois >= (f.cout.bois ?? 0) && this.v.stocks.marbre >= (f.cout.marbre ?? 0);
  }

  private essai(type: TypeBatiment, raison: string): Decision {
    if (this.batir(type)) return { type, raison };
    this.echecs.set(type, this.v.temps);
    return { type: "attente", raison: `aucune place pour ${type}` };
  }

  // -------------------------------------------------------------------------------------------
  // Trouver une place et y mener une route
  // -------------------------------------------------------------------------------------------

  /** Distances (en cases de route à bâtir) depuis le réseau relié, et le chemin pour y aller */
  private carteAcces(surGrille: boolean) {
    const v = this.v;
    const dist = new Int32Array(TAILLE * TAILLE).fill(-1);
    const parent = new Int32Array(TAILLE * TAILLE).fill(-1);
    const file: number[] = [];
    // On part des routes reliées à un entrepôt
    const relies = new Set<number>();
    for (const b of v.batiments.values()) if (v.estEntrepot(b)) for (const c of v.portes(b)) relies.add(v.comp[indice(c.i, c.j)]!);
    for (let k = 0; k < TAILLE * TAILLE; k++) {
      if (v.routes[k] && relies.has(v.comp[k]!)) {
        dist[k] = 0;
        file.push(k);
      }
    }
    let tete = 0;
    while (tete < file.length) {
      const c = file[tete++]!;
      const i = c % TAILLE;
      const j = (c - i) / TAILLE;
      if (dist[c]! > 45) continue;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 1 || nj < 1 || ni >= TAILLE - 1 || nj >= TAILLE - 1) continue;
        const n = nj * TAILLE + ni;
        if (dist[n] !== -1) continue;
        if (!v.routePossible(ni, nj)) continue;
        if (surGrille && !v.routes[n] && !estRueDeGrille(ni, nj)) continue;
        dist[n] = v.routes[n] ? dist[c]! : dist[c]! + 1;
        parent[n] = c;
        file.push(n);
      }
    }
    return { dist, parent };
  }

  batir(type: TypeBatiment, ancre?: { x: number; z: number }): Batiment | null {
    const v = this.v;
    const f = FICHES[type];
    const surGrille = SUR_GRILLE.has(type);
    const a = ancre ?? ANCRES[type] ?? CENTRE;
    const acces = this.carteAcces(surGrille);
    const rayon = type === "maison" ? 34 : 48;
    let meilleur: { i: number; j: number; r: number; porte: number; score: number } | null = null;
    const rotations = [0, 1, 2, 3];
    for (let j = Math.max(1, Math.floor(a.z - rayon)); j < Math.min(TAILLE - 1, a.z + rayon); j++) {
      for (let i = Math.max(1, Math.floor(a.x - rayon)); i < Math.min(TAILLE - 1, a.x + rayon); i++) {
        for (const r of rotations) {
          const l = r % 2 === 0 ? f.l : f.p;
          const p = r % 2 === 0 ? f.p : f.l;
          // Sur la grille, un bâtiment ne doit pas recouvrir une future rue
          if (surGrille && this.coupeLaGrille(i, j, l, p)) continue;
          if (!surGrille && this.coupeLaGrilleEnVille(i, j, l, p)) continue;
          // Les maisons et les ateliers de la grille ouvrent sur la rue ; les autres prennent la
          // route par n'importe quel côté (la pêcherie a la mer devant elle)
          const devant = surGrille || type === "forum" || type === "thermes" || type === "temple" ? v.devant(i, j, r, l, p) : bordure(i, j, l, p);
          let porte = -1;
          let dPorte = Infinity;
          for (const c of devant) {
            const k = indice(c.i, c.j);
            if (acces.dist[k]! >= 0 && acces.dist[k]! < dPorte) {
              dPorte = acces.dist[k]!;
              porte = k;
            }
          }
          if (porte < 0) continue;
          const cx = i + l / 2;
          const cz = j + p / 2;
          let score = Math.hypot(cx - a.x, cz - a.z) + dPorte * (surGrille ? 0.6 : 1.4);
          if (type === "maison") {
            // Près d'un forum, et alignées
            if (!v.servi({ i, j, l, p }, "forum")) score += 12;
            if (v.palierMax >= 1 && !v.servi({ i, j, l, p }, "thermes")) score += 4;
          }
          if (type === "temple") score -= this.surPromontoire(cx, cz) ? 40 : 0;
          if (meilleur && score >= meilleur.score) continue;
          if (!v.peutPoser(type, i, j, r).ok) continue;
          meilleur = { i, j, r, porte, score };
        }
      }
    }
    if (!meilleur) return null;
    // La route jusqu'à la porte
    const chemin: Case[] = [];
    for (let k = meilleur.porte; k >= 0 && !v.routes[k]; k = acces.parent[k]!) chemin.push({ i: k % TAILLE, j: Math.floor(k / TAILLE) });
    v.poserRoutes(chemin.reverse());
    return v.poser(type, meilleur.i, meilleur.j, meilleur.r);
  }

  private coupeLaGrille(i: number, j: number, l: number, p: number) {
    for (let z = j; z < j + p; z++) for (let x = i; x < i + l; x++) if (estRueDeGrille(x, z)) return true;
    return false;
  }

  private coupeLaGrilleEnVille(i: number, j: number, l: number, p: number) {
    if (Math.hypot(i + l / 2 - CENTRE.x, j + p / 2 - CENTRE.z) > 24) return false;
    let n = 0;
    for (let z = j; z < j + p; z++) for (let x = i; x < i + l; x++) if (estRueDeGrille(x, z)) n++;
    return n > l + p;
  }

  private surPromontoire(x: number, z: number) {
    const pr = GEO.promontoire;
    return x > pr.ax + 3 && Math.abs(z - (pr.az + ((x - pr.ax) / (pr.bx - pr.ax)) * (pr.bz - pr.az))) < pr.r;
  }
}

/** Fait tourner la simulation et l'architecte pendant `secondes` (pour la vitrine et les tests). */
export function batirEnAccelere(v: Ville, secondes: number, architecte = new Architecte(v)) {
  const pas = Math.round(secondes * 10);
  for (let n = 0; n < pas; n++) {
    architecte.agir();
    v.pas();
  }
  return architecte;
}
