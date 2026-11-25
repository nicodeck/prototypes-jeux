// La cité : ses bâtiments, ses routes, ses habitants, ses marchandises et ses denarii.
//
// La simulation avance par pas fixes de PAS secondes, toujours de la même façon (même graine,
// mêmes actions : même résultat). Elle ne sait rien du rendu : elle tourne aussi dans les tests.
//
// Les règles, dans l'esprit d'Anno :
// - Les ateliers produisent tant qu'ils sont reliés par la route au port ou à un entrepôt. Leurs
//   charrettes y livrent la marchandise ; ceux qui transforment (moulin, boulangerie, pressoir,
//   cave) y prennent ce qu'il leur faut.
// - Les maisons veulent des biens (pris au stock commun) et des services (un forum, des thermes à
//   portée). Comblées, elles se remplissent et paient plus d'impôts ; comblées assez longtemps,
//   elles montent d'un niveau, si l'on a de quoi payer l'agrandissement.
// - Atteindre assez d'habitants d'un niveau débloque le suivant, puis le temple.
import { REGLAGES } from "../reglages";
import {
  BESOINS,
  COUT_EVOLUTION,
  COUT_ROUTE,
  emprise,
  FICHES,
  NOMS_MARCHANDISES,
  SEUILS,
  type Cout,
  type Marchandise,
  type Palier,
  type TypeBatiment,
} from "./catalogue";
import { CARGAISONS, Chronique, ORIGINES } from "./chronique";
import { hachage, hasard, type Hasard } from "./hasard";
import { creerIle, dansCarte, indice, PENTE_MAX_BATIR, TAILLE, type Ile } from "./ile";
import { bordure, chemin, composantes, type Case } from "./routes";
import { Horloge } from "./temps";

export const PAS = 0.1;

export const MARCHANDISES: Marchandise[] = ["bois", "marbre", "poisson", "ble", "farine", "pain", "olives", "huile", "raisin", "vin"];

export type Besoin = Marchandise | "forum" | "thermes" | "route";

export interface Batiment {
  id: number;
  type: TypeBatiment;
  /** La case en haut à gauche (x et z minimaux) de l'emprise */
  i: number;
  j: number;
  rotation: number;
  l: number;
  p: number;
  palier: Palier;
  variante: number;
  /** Avancement du chantier, de 0 à 1 */
  chantier: number;
  /** Hauteur du sol sous le bâtiment (le coin le plus haut de l'emprise) */
  sol: number;
  habitants: number;
  /** Ce qui manque à la maison, pour l'interface */
  manques: Besoin[];
  /** Secondes passées comblée */
  comble: number;
  /** Production : stock en sortie, matière en entrée, avancement du cycle */
  stock: number;
  entree: number;
  progres: number;
  /** Relié par la route à un entrepôt */
  relie: boolean;
  /** Une charrette est partie */
  charrette: boolean;
  graine: number;
  /** Accumulateur d'arrivées et de départs d'habitants */
  mouvement: number;
}

export interface Charrette {
  id: number;
  batiment: number;
  chemin: Case[];
  /** Distance parcourue le long du chemin, en cases */
  t: number;
  charge: Marchandise;
  quantite: number;
  retour: boolean;
}

export type Evenement =
  | { sorte: "pose"; id: number }
  | { sorte: "construit"; id: number }
  | { sorte: "evolution"; id: number; palier: Palier }
  | { sorte: "palier"; palier: 1 | 2 | 3 }
  | { sorte: "temple"; id: number }
  | { sorte: "livraison"; id: number; marchandise: Marchandise }
  | { sorte: "demoli"; id: number; type: TypeBatiment; i: number; j: number; l: number; p: number }
  | { sorte: "routes" }
  | { sorte: "eclair" }
  | { sorte: "navire"; phase: Navire["phase"] };

/** Un navire marchand qui vient de loin, accoste au port, achète le surplus et repart. */
export interface Navire {
  phase: "approche" | "amarre" | "depart";
  /** Avancement de la phase, de 0 à 1 */
  t: number;
  origine: string;
  cargaison: string;
  /** Variante de coque et de voile */
  graine: number;
}

/** Durée de chaque phase du navire, en secondes */
export const DUREES_NAVIRE = { approche: 45, amarre: 35, depart: 45 };
const PRIX_VENTE: Partial<Record<Marchandise, number>> = { poisson: 3, pain: 5, huile: 7, vin: 9, olives: 2, ble: 2, farine: 3, bois: 2, marbre: 8 };

/** Le décor déjà là : l'aqueduc et son château d'eau, qu'on ne peut ni démolir ni recouvrir. */
export interface Decor {
  aqueduc: { i: number; j: number; hauteur: number; axe: "x" | "z" }[];
  castellum: Case | null;
}

export interface Verdict {
  ok: boolean;
  raison?: string;
}

export class Ville {
  readonly ile: Ile;
  readonly alea: Hasard;
  readonly routes = new Uint8Array(TAILLE * TAILLE);
  /** Le bâtiment sur chaque case (0 = aucun) */
  readonly occupation = new Int32Array(TAILLE * TAILLE);
  /** Les cases du décor (aqueduc) */
  readonly reserve = new Uint8Array(TAILLE * TAILLE);
  comp: Int32Array = new Int32Array(TAILLE * TAILLE);
  readonly batiments = new Map<number, Batiment>();
  charrettes: Charrette[] = [];
  readonly stocks = {} as Record<Marchandise, number>;
  denarii: number;
  /** Le plus haut niveau débloqué : 0 Liberti seuls, 1 Plebeii, 2 Equites, 3 le temple */
  palierMax: 0 | 1 | 2 | 3 = 0;
  temps = 0;
  readonly horloge: Horloge;
  readonly chronique: Chronique;
  readonly decor: Decor = { aqueduc: [], castellum: null };
  evenements: Evenement[] = [];
  /** Dernier instant où chaque marchandise a manqué */
  private readonly manqueDepuis = {} as Record<Marchandise, number>;
  private readonly faim = {} as Record<Marchandise, number>;
  private prochainId = 1;
  private reseauSale = true;
  /** Revenus et dépenses par minute, pour l'interface */
  bilan = { impots: 0, entretien: 0 };
  templeConsacre = false;
  navire: Navire | null = null;
  prochainNavire = 70;
  /** Version des routes et des arbres, pour que le rendu sache quand redessiner */
  versionRoutes = 0;
  versionArbres = 0;

  constructor(graine = 7) {
    this.ile = creerIle();
    this.alea = hasard(graine);
    this.horloge = new Horloge(hasard(graine * 31 + 5), REGLAGES.heureDepart);
    this.chronique = new Chronique(hasard(graine * 97 + 3));
    for (const m of MARCHANDISES) {
      this.stocks[m] = 0;
      this.manqueDepuis[m] = -1e9;
      this.faim[m] = 0;
    }
    const d = REGLAGES.depart;
    this.denarii = d.denarii;
    this.stocks.bois = d.bois;
    this.stocks.marbre = d.marbre;
    this.stocks.poisson = d.poisson;
  }

  // -------------------------------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------------------------------

  population() {
    const parPalier: [number, number, number] = [0, 0, 0];
    for (const b of this.batiments.values()) if (b.type === "maison") parPalier[b.palier] += b.habitants;
    return { total: parPalier[0] + parPalier[1] + parPalier[2], parPalier };
  }

  capaciteStock() {
    let c = 0;
    for (const b of this.batiments.values()) {
      if (b.chantier < 1) continue;
      if (b.type === "port") c += REGLAGES.stockPort;
      else if (b.type === "entrepot") c += REGLAGES.stockEntrepot;
    }
    return c;
  }

  batimentEn(i: number, j: number): Batiment | null {
    if (!dansCarte(i, j)) return null;
    const id = this.occupation[indice(i, j)]!;
    return id ? (this.batiments.get(id) ?? null) : null;
  }

  estRoute(i: number, j: number) {
    return dansCarte(i, j) && this.routes[indice(i, j)] === 1;
  }

  centre(b: Batiment) {
    return { x: b.i + b.l / 2, z: b.j + b.p / 2 };
  }

  debloque(type: TypeBatiment) {
    return FICHES[type].debloque <= this.palierMax;
  }

  peutPayer(c: Cout, fois = 1) {
    return this.denarii >= c.denarii * fois && this.stocks.bois >= (c.bois ?? 0) * fois && this.stocks.marbre >= (c.marbre ?? 0) * fois;
  }

  private payer(c: Cout, fois = 1) {
    this.denarii -= c.denarii * fois;
    this.stocks.bois -= (c.bois ?? 0) * fois;
    this.stocks.marbre -= (c.marbre ?? 0) * fois;
  }

  // -------------------------------------------------------------------------------------------
  // Bâtir
  // -------------------------------------------------------------------------------------------

  /** Peut-on bâtir sur cette case (libre, plate, à sec) ? */
  caseLibre(i: number, j: number) {
    if (!dansCarte(i, j)) return false;
    const k = indice(i, j);
    const sol = this.ile.sols[k];
    return sol !== "eau" && sol !== "roche" && this.ile.pentes[k]! <= PENTE_MAX_BATIR && !this.occupation[k] && !this.routes[k] && !this.reserve[k];
  }

  /** La rangée de cases juste devant la façade */
  devant(i: number, j: number, rotation: number, l: number, p: number): Case[] {
    const r = ((rotation % 4) + 4) % 4;
    const res: Case[] = [];
    if (r === 0) for (let x = i; x < i + l; x++) res.push({ i: x, j: j + p });
    else if (r === 1) for (let z = j; z < j + p; z++) res.push({ i: i + l, j: z });
    else if (r === 2) for (let x = i; x < i + l; x++) res.push({ i: x, j: j - 1 });
    else for (let z = j; z < j + p; z++) res.push({ i: i - 1, j: z });
    return res.filter((c) => dansCarte(c.i, c.j));
  }

  peutPoser(type: TypeBatiment, i: number, j: number, rotation: number, gratuit = false): Verdict {
    const f = FICHES[type];
    const { l, p } = emprise(type, rotation);
    if (!gratuit && !f.constructible) return { ok: false, raison: "On ne peut pas en bâtir" };
    if (!gratuit && !this.debloque(type)) return { ok: false, raison: "Pas encore débloqué" };
    if (i < 1 || j < 1 || i + l > TAILLE - 1 || j + p > TAILLE - 1) return { ok: false, raison: "Hors de l'île" };
    // Le port et le phare sont posés à la main, sur la côte et sur un îlot
    if (gratuit && !f.constructible) return { ok: true };
    let hMin = Infinity;
    let hMax = -Infinity;
    for (let z = j; z < j + p; z++) {
      for (let x = i; x < i + l; x++) {
        const k = indice(x, z);
        if (this.occupation[k] || this.routes[k] || this.reserve[k]) return { ok: false, raison: "Emplacement occupé" };
        const sol = this.ile.sols[k];
        if (sol === "eau") return { ok: false, raison: "Dans l'eau" };
        if (sol === "roche" || this.ile.pentes[k]! > PENTE_MAX_BATIR) return { ok: false, raison: "Terrain trop pentu" };
      }
    }
    for (let z = j; z <= j + p; z++)
      for (let x = i; x <= i + l; x++) {
        const h = this.ile.coins[z * (TAILLE + 1) + x]!;
        hMin = Math.min(hMin, h);
        hMax = Math.max(hMax, h);
      }
    if (hMax - hMin > 1.7) return { ok: false, raison: "Terrain trop pentu" };
    if (f.emplacement === "cote") {
      const eau = this.devant(i, j, rotation, l, p).filter((c) => this.ile.sols[indice(c.i, c.j)] === "eau").length;
      if (eau < 2) return { ok: false, raison: "La façade doit donner sur l'eau" };
    } else if (f.emplacement === "foret") {
      if (this.arbresAutour(i + l / 2, j + p / 2, 5) < 8) return { ok: false, raison: "Trop peu d'arbres alentour" };
    } else if (f.emplacement === "roche") {
      let roche = 0;
      for (let z = j - 2; z < j + p + 2; z++) for (let x = i - 2; x < i + l + 2; x++) if (dansCarte(x, z) && this.ile.sols[indice(x, z)] === "roche") roche++;
      if (roche < 4) return { ok: false, raison: "Il faut une paroi rocheuse tout près" };
    }
    if (type === "temple" && [...this.batiments.values()].some((b) => b.type === "temple")) return { ok: false, raison: "L'île n'a qu'un temple" };
    if (!gratuit && !this.peutPayer(f.cout)) {
      if (this.denarii < f.cout.denarii) return { ok: false, raison: "Pas assez de denarii" };
      if (this.stocks.bois < (f.cout.bois ?? 0)) return { ok: false, raison: "Pas assez de bois" };
      return { ok: false, raison: "Pas assez de marbre" };
    }
    return { ok: true };
  }

  arbresAutour(cx: number, cz: number, r: number) {
    let n = 0;
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (!dansCarte(x, z) || (x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 > r * r) continue;
        n += this.ile.arbres[indice(x, z)]!;
      }
    return n;
  }

  poser(type: TypeBatiment, i: number, j: number, rotation: number, options: { gratuit?: boolean; fini?: boolean; palier?: Palier } = {}): Batiment | null {
    const verdict = this.peutPoser(type, i, j, rotation, options.gratuit);
    if (!verdict.ok) return null;
    const f = FICHES[type];
    if (!options.gratuit) this.payer(f.cout);
    const { l, p } = emprise(type, rotation);
    let sol = -Infinity;
    for (let z = j; z <= j + p; z++) for (let x = i; x <= i + l; x++) sol = Math.max(sol, this.ile.coins[z * (TAILLE + 1) + x]!);
    const id = this.prochainId++;
    const b: Batiment = {
      id,
      type,
      i,
      j,
      rotation: ((rotation % 4) + 4) % 4,
      l,
      p,
      palier: options.palier ?? 0,
      variante: Math.floor(hachage(i, j, id) * 1000),
      chantier: options.fini ? 1 : 0,
      sol,
      habitants: 0,
      manques: [],
      comble: 0,
      stock: 0,
      entree: 0,
      progres: hachage(j, i, 7) * 0.5,
      relie: false,
      charrette: false,
      graine: hachage(i, j, 11),
      mouvement: 0,
    };
    this.batiments.set(id, b);
    for (let z = j; z < j + p; z++)
      for (let x = i; x < i + l; x++) {
        const k = indice(x, z);
        this.occupation[k] = id;
        this.ile.arbres[k] = 0;
      }
    // On défriche aussi un peu autour des grands bâtiments
    this.versionArbres++;
    this.reseauSale = true;
    this.evenements.push({ sorte: "pose", id });
    if (options.fini) this.evenements.push({ sorte: "construit", id });
    return b;
  }

  /** Pose des routes sur un tracé. Renvoie le nombre de cases posées. */
  poserRoutes(cases: Case[], gratuit = false): number {
    let n = 0;
    for (const c of cases) {
      if (!this.routePossible(c.i, c.j)) continue;
      const k = indice(c.i, c.j);
      if (this.routes[k]) continue;
      if (!gratuit) {
        if (this.denarii < COUT_ROUTE) break;
        this.denarii -= COUT_ROUTE;
      }
      this.routes[k] = 1;
      if (this.ile.arbres[k]) {
        this.ile.arbres[k] = 0;
        this.versionArbres++;
      }
      n++;
    }
    if (n) {
      this.reseauSale = true;
      this.versionRoutes++;
      this.evenements.push({ sorte: "routes" });
    }
    return n;
  }

  routePossible(i: number, j: number) {
    if (!dansCarte(i, j)) return false;
    const k = indice(i, j);
    const sol = this.ile.sols[k];
    // On peut passer sous les arches de l'aqueduc (reserve = 2), pas sur le château d'eau (1)
    return sol !== "eau" && this.ile.pentes[k]! <= 1.25 && !this.occupation[k] && this.reserve[k] !== 1;
  }

  demolir(i: number, j: number): boolean {
    if (!dansCarte(i, j)) return false;
    const k = indice(i, j);
    const id = this.occupation[k];
    if (id) {
      const b = this.batiments.get(id)!;
      if (!FICHES[b.type].constructible) return false;
      const c = FICHES[b.type].cout;
      const r = REGLAGES.remboursement;
      this.denarii += Math.floor(c.denarii * r);
      this.stocks.bois += Math.floor((c.bois ?? 0) * r);
      this.stocks.marbre += Math.floor((c.marbre ?? 0) * r);
      for (let z = b.j; z < b.j + b.p; z++) for (let x = b.i; x < b.i + b.l; x++) this.occupation[indice(x, z)] = 0;
      this.batiments.delete(id);
      this.charrettes = this.charrettes.filter((ch) => ch.batiment !== id);
      this.reseauSale = true;
      this.couvertureSale = true;
      this.evenements.push({ sorte: "demoli", id, type: b.type, i: b.i, j: b.j, l: b.l, p: b.p });
      return true;
    }
    if (this.routes[k]) {
      this.routes[k] = 0;
      this.reseauSale = true;
      this.versionRoutes++;
      this.evenements.push({ sorte: "routes" });
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------------------------
  // Le réseau
  // -------------------------------------------------------------------------------------------

  /** Les cases de route qui touchent le bâtiment */
  portes(b: Batiment): Case[] {
    return bordure(b.i, b.j, b.l, b.p).filter((c) => this.routes[indice(c.i, c.j)]);
  }

  estEntrepot(b: Batiment) {
    return (b.type === "port" || b.type === "entrepot") && b.chantier >= 1;
  }

  private majReseau() {
    this.comp = composantes(this.routes);
    const relies = new Set<number>();
    for (const b of this.batiments.values()) if (this.estEntrepot(b)) for (const c of this.portes(b)) relies.add(this.comp[indice(c.i, c.j)]!);
    for (const b of this.batiments.values()) {
      if (this.estEntrepot(b)) {
        b.relie = true;
        continue;
      }
      b.relie = this.portes(b).some((c) => relies.has(this.comp[indice(c.i, c.j)]!));
    }
    this.reseauSale = false;
    this.couvertureSale = true;
  }

  /** Le chemin par la route du bâtiment au plus proche entrepôt */
  cheminVersEntrepot(b: Batiment): Case[] | null {
    const arrivees: Case[] = [];
    for (const e of this.batiments.values()) if (this.estEntrepot(e)) arrivees.push(...this.portes(e));
    return chemin(this.routes, this.portes(b), arrivees);
  }

  // -------------------------------------------------------------------------------------------
  // Le pas de simulation
  // -------------------------------------------------------------------------------------------

  pas() {
    const dt = PAS;
    this.evenements = [];
    this.temps += dt;
    if (this.reseauSale) this.majReseau();

    this.horloge.avancer(dt);
    if (this.horloge.eclair) this.evenements.push({ sorte: "eclair" });

    this.avancerChantiers(dt);
    this.produire(dt);
    this.avancerCharrettes(dt);
    const satisfaction = this.consommer(dt);
    this.loger(dt, satisfaction);
    this.compter(dt);
    this.debloquer();
    this.naviguer(dt);
    this.chronique.observer(this);
  }

  private avancerChantiers(dt: number) {
    for (const b of this.batiments.values()) {
      if (b.chantier >= 1) continue;
      const duree =
        b.type === "maison"
          ? REGLAGES.chantierMaison
          : b.type === "temple"
            ? REGLAGES.chantierTemple
            : b.type === "forum" || b.type === "thermes"
              ? REGLAGES.chantierGrand
              : REGLAGES.chantierAtelier;
      b.chantier = Math.min(1, b.chantier + dt / duree);
      if (b.chantier >= 1) {
        this.couvertureSale = true;
        this.evenements.push({ sorte: "construit", id: b.id });
        if (b.type === "temple") {
          this.templeConsacre = true;
          this.evenements.push({ sorte: "temple", id: b.id });
        }
        if (b.type === "entrepot") this.reseauSale = true;
      }
    }
  }

  private produire(dt: number) {
    const capacite = this.capaciteStock();
    const endette = this.denarii < 0 ? 0.5 : 1;
    for (const b of this.batiments.values()) {
      const f = FICHES[b.type];
      if (!f.produit || b.chantier < 1 || !b.relie) continue;
      if (f.consomme && b.entree < 2 && this.stocks[f.consomme] >= 1) {
        this.stocks[f.consomme]--;
        b.entree++;
      }
      const pret = !f.consomme || b.entree >= 1;
      if (pret && b.stock < 4) {
        let efficacite = endette;
        if (b.type === "bucheron") efficacite *= Math.min(1, Math.max(0.35, this.arbresAutour(b.i + b.l / 2, b.j + b.p / 2, 6) / 22));
        b.progres += (dt / f.duree!) * efficacite;
        if (b.progres >= 1) {
          b.progres -= 1;
          b.stock++;
          if (f.consomme) b.entree--;
        }
      }
      // Une charrette part dès qu'il y a de quoi la remplir, si l'entrepôt a de la place
      if (!b.charrette && b.stock >= 2 && this.stocks[f.produit] < capacite) {
        const route = this.cheminVersEntrepot(b);
        if (route) {
          this.charrettes.push({ id: this.prochainId++, batiment: b.id, chemin: route, t: 0, charge: f.produit, quantite: b.stock, retour: false });
          b.stock = 0;
          b.charrette = true;
        }
      }
    }
  }

  private avancerCharrettes(dt: number) {
    const capacite = this.capaciteStock();
    const v = REGLAGES.vitesseCharrettes;
    this.charrettes = this.charrettes.filter((c) => {
      c.t += v * dt;
      const longueur = c.chemin.length - 1;
      if (c.t < longueur) return true;
      if (!c.retour) {
        this.stocks[c.charge] = Math.min(capacite, this.stocks[c.charge] + c.quantite);
        this.evenements.push({ sorte: "livraison", id: c.batiment, marchandise: c.charge });
        c.retour = true;
        c.t = 0;
        c.chemin = [...c.chemin].reverse();
        return true;
      }
      const b = this.batiments.get(c.batiment);
      if (b) b.charrette = false;
      return false;
    });
  }

  /** Consomme les biens ; renvoie, pour chaque marchandise, si elle est disponible */
  private consommer(dt: number): Record<Marchandise, boolean> {
    const { parPalier } = this.population();
    const dispo = {} as Record<Marchandise, boolean>;
    for (const m of MARCHANDISES) {
      let demande = 0;
      for (const pal of [0, 1, 2] as Palier[]) demande += (parPalier[pal] * (BESOINS[pal].biens[m] ?? 0)) / 60;
      this.faim[m] += demande * dt;
      while (this.faim[m] >= 1) {
        if (this.stocks[m] >= 1) {
          this.stocks[m]--;
          this.faim[m]--;
        } else {
          this.manqueDepuis[m] = this.temps;
          this.faim[m] = 0.999;
          break;
        }
      }
      dispo[m] = this.temps - this.manqueDepuis[m] > 8;
    }
    return dispo;
  }

  /** Les cases à portée de chaque service (forum, thermes, temple), recalculées quand ça change */
  private couverture = new Map<TypeBatiment, Uint8Array>();
  private couvertureSale = true;

  private majCouverture() {
    this.couverture.clear();
    for (const service of ["forum", "thermes", "temple"] as TypeBatiment[]) {
      const carte = new Uint8Array(TAILLE * TAILLE);
      const r = FICHES[service].rayon ?? 0;
      for (const s of this.batiments.values()) {
        if (s.type !== service || s.chantier < 1 || !s.relie) continue;
        const c = this.centre(s);
        for (let z = Math.max(0, Math.floor(c.z - r)); z <= Math.min(TAILLE - 1, c.z + r); z++)
          for (let x = Math.max(0, Math.floor(c.x - r)); x <= Math.min(TAILLE - 1, c.x + r); x++)
            if ((x + 0.5 - c.x) ** 2 + (z + 0.5 - c.z) ** 2 <= r * r) carte[indice(x, z)] = 1;
      }
      this.couverture.set(service, carte);
    }
    this.couvertureSale = false;
  }

  /** La maison (ou la case) est-elle à portée de ce service ? */
  servi(b: Batiment | { i: number; j: number; l: number; p: number }, service: TypeBatiment) {
    if (this.couvertureSale) this.majCouverture();
    const x = Math.floor(b.i + b.l / 2);
    const z = Math.floor(b.j + b.p / 2);
    return this.couverture.get(service)![indice(Math.min(TAILLE - 1, x), Math.min(TAILLE - 1, z))] === 1;
  }

  private loger(dt: number, dispo: Record<Marchandise, boolean>) {
    for (const b of this.batiments.values()) {
      if (b.type !== "maison" || b.chantier < 1) continue;
      const besoins = BESOINS[b.palier];
      const manques: Besoin[] = [];
      if (!b.relie) manques.push("route");
      for (const m of Object.keys(besoins.biens) as Marchandise[]) if (!b.relie || !dispo[m]) manques.push(m);
      for (const s of besoins.services) if (!this.servi(b, s)) manques.push(s as Besoin);
      b.manques = manques;
      const total = Object.keys(besoins.biens).length + besoins.services.length;
      const satisfaits = total - manques.filter((m) => m !== "route").length;
      const part = b.relie ? satisfaits / total : 0;
      const cible = Math.round(besoins.plancher + (besoins.capacite - besoins.plancher) * part);
      // Les habitants arrivent vite et partent lentement
      if (b.habitants < cible) {
        b.mouvement += dt / 1.1;
        if (b.mouvement >= 1) {
          b.mouvement = 0;
          b.habitants++;
        }
      } else if (b.habitants > cible) {
        b.mouvement += dt / 3.5;
        if (b.mouvement >= 1) {
          b.mouvement = 0;
          b.habitants--;
        }
      } else b.mouvement = 0;

      // Montée de niveau
      b.comble = manques.length === 0 && b.habitants >= cible ? b.comble + dt : 0;
      const suivant = (b.palier + 1) as 1 | 2;
      if (b.palier < 2 && suivant <= this.palierMax && b.comble >= REGLAGES.attenteEvolution && this.peutPayer(COUT_EVOLUTION[suivant])) {
        this.payer(COUT_EVOLUTION[suivant]);
        b.palier = suivant;
        b.variante = Math.floor(this.alea() * 1000);
        b.comble = 0;
        b.chantier = 0.55;
        this.evenements.push({ sorte: "evolution", id: b.id, palier: suivant });
      }
    }
  }

  private compter(dt: number) {
    let impots = 0;
    let entretien = 0;
    for (const b of this.batiments.values()) {
      if (b.chantier < 1) continue;
      if (b.type === "maison") {
        const besoins = BESOINS[b.palier];
        const total = Object.keys(besoins.biens).length + besoins.services.length;
        const part = 1 - b.manques.filter((m) => m !== "route").length / total;
        const bonus = this.templeConsacre && this.servi(b, "temple") ? 1.25 : 1;
        impots += b.habitants * besoins.impot * (0.45 + 0.55 * part) * bonus * REGLAGES.impots;
      } else entretien += FICHES[b.type].entretien;
    }
    this.bilan = { impots, entretien };
    this.denarii += ((impots - entretien) / 60) * dt;
  }

  private naviguer(dt: number) {
    const port = [...this.batiments.values()].find((b) => b.type === "port");
    if (!port) return;
    const n = this.navire;
    if (!n) {
      if (this.temps >= this.prochainNavire && this.horloge.ciel.orage < 0.3) {
        this.navire = {
          phase: "approche",
          t: 0,
          origine: ORIGINES[Math.floor(this.alea() * ORIGINES.length)]!,
          cargaison: CARGAISONS[Math.floor(this.alea() * CARGAISONS.length)]!,
          graine: this.alea(),
        };
        this.evenements.push({ sorte: "navire", phase: "approche" });
        this.chronique.ecrire(`Une voile à l'horizon : un navire de ${this.navire.origine} apporte ${this.navire.cargaison}.`, 1);
      }
      return;
    }
    n.t += dt / DUREES_NAVIRE[n.phase];
    if (n.t < 1) return;
    n.t = 0;
    if (n.phase === "approche") {
      n.phase = "amarre";
      this.evenements.push({ sorte: "navire", phase: "amarre" });
    } else if (n.phase === "amarre") {
      // Il achète ce qui déborde des entrepôts
      const capacite = this.capaciteStock();
      let gain = 0;
      let principal: Marchandise | null = null;
      let plus = 0;
      for (const m of MARCHANDISES) {
        const prix = PRIX_VENTE[m];
        if (!prix) continue;
        const surplus = Math.floor((this.stocks[m] - capacite * 0.6) * 0.6);
        if (surplus <= 0) continue;
        this.stocks[m] -= surplus;
        gain += surplus * prix;
        if (surplus > plus) {
          plus = surplus;
          principal = m;
        }
      }
      this.denarii += gain;
      if (principal) this.chronique.ecrire(`Le navire repart chargé de nos ${NOMS_MARCHANDISES[principal].toLowerCase()} : ${gain} denarii pour la cité.`, 1);
      n.phase = "depart";
      this.evenements.push({ sorte: "navire", phase: "depart" });
    } else {
      this.navire = null;
      this.prochainNavire = this.temps + 60 + this.alea() * 90;
    }
  }

  private debloquer() {
    const { parPalier } = this.population();
    while (this.palierMax < 3) {
      const suivant = (this.palierMax + 1) as 1 | 2 | 3;
      const s = SEUILS[suivant];
      if (parPalier[s.palier] < s.habitants) break;
      this.palierMax = suivant;
      this.evenements.push({ sorte: "palier", palier: suivant });
    }
  }
}
