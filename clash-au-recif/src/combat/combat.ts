// La simulation du combat. Elle ne dépend pas du navigateur : elle avance d'une image à la fois,
// toujours au même rythme (60 images par seconde), et tourne aussi dans les tests.
import { ARENE } from "./arene";
import { PERSOS, REGLES, type Coup, type Effet, type Frappe, type NomPerso, type Perso } from "./persos";

export interface Commandes {
  gauche: boolean;
  droite: boolean;
  haut: boolean;
  bas: boolean;
  attaque: boolean;
  special: boolean;
  garde: boolean;
}

export const AUCUNE_COMMANDE: Commandes = {
  gauche: false,
  droite: false,
  haut: false,
  bas: false,
  attaque: false,
  special: false,
  garde: false,
};

export type Etat =
  | "libre"
  | "elan" // accroupi juste avant le saut
  | "coup"
  | "garde"
  | "gardeFin"
  | "etourdi" // touché, sans tournoyer
  | "tournoie" // éjecté fort
  | "aTerre"
  | "brise" // bouclier cassé
  | "atterrissage"
  | "ko"
  | "reapparition";

export type Evenement =
  | {
      type: "touche";
      attaquant: number;
      victime: number;
      x: number;
      y: number;
      degats: number;
      force: number;
      effet: Effet;
      garde: boolean;
      armure: boolean;
    }
  | { type: "saut"; joueur: number; air: boolean }
  | { type: "atterrit"; joueur: number; fort: boolean }
  | { type: "coup"; joueur: number; nom: string; charge: number }
  | { type: "ko"; joueur: number; x: number; y: number; degats: number }
  | { type: "brise"; joueur: number }
  | { type: "reapparait"; joueur: number }
  | { type: "fin"; gagnant: number };

const DT = 1 / 60;

interface Contact {
  a: Combattant;
  v: Combattant;
  f: Frappe;
  x: number;
  y: number;
  coup: Coup;
  ratio: number;
}
type Action = "saut" | "attaque" | "special";

export class Combattant {
  readonly perso: Perso;
  x: number;
  y: number;
  /** Vitesse propre (marche, saut, gravité). */
  vx = 0;
  vy = 0;
  /** Vitesse d'éjection, qui s'amortit. */
  ex = 0;
  ey = 0;
  dir: 1 | -1;
  auSol = true;
  sautsRestants: number;
  remonteeUtilisee = false;
  chuteRapide = false;
  degats = 0;
  vies: number;
  etat: Etat = "libre";
  /** Images passées dans l'état (ou dans le coup) en cours. */
  image = 0;
  coup: Coup | null = null;
  toucheCetteFois = false;
  charge = 0;
  bouclier = 1;
  gardeBloquee = 0;
  /** Images de gel à l'impact. */
  gel = 0;
  invincible = 0;
  etourdi = 0;
  retardAtterrissage = 0;
  traverse = 0;
  commandes: Commandes = { ...AUCUNE_COMMANDE };
  private precedentes: Commandes = { ...AUCUNE_COMMANDE };
  private tampon: { action: Action; images: number } | null = null;
  basPresse = false;
  /** Pour les statistiques et les tests. */
  imagesDepuisCoupRecu = 10_000;
  stats = { koDonnes: 0, autodestructions: 0, degatsInfliges: 0, coupsPortes: 0 };

  constructor(
    readonly nom: NomPerso,
    readonly index: number,
    vies: number,
  ) {
    this.perso = PERSOS[nom];
    const depart = ARENE.departs[index];
    this.x = depart.x;
    this.y = depart.y;
    this.dir = index === 0 ? 1 : -1;
    this.sautsRestants = this.perso.sautsAir;
    this.vies = vies;
  }

  get horsJeu() {
    return this.etat === "ko" || this.etat === "reapparition";
  }

  /** Peut agir librement (marcher, sauter, attaquer). */
  get libre() {
    return this.etat === "libre";
  }

  get chargeRatio() {
    return this.coup?.charge ? this.charge / this.coup.charge.max : 0;
  }

  lire(c: Commandes) {
    const presse = (k: keyof Commandes) => c[k] && !this.precedentes[k];
    if (presse("haut")) this.tampon = { action: "saut", images: 6 };
    if (presse("attaque")) this.tampon = { action: "attaque", images: 6 };
    if (presse("special")) this.tampon = { action: "special", images: 6 };
    this.basPresse = presse("bas");
    this.commandes = { ...c };
    this.precedentes = { ...c };
  }

  vieillirTampon() {
    if (this.tampon && --this.tampon.images <= 0) this.tampon = null;
  }

  prendre(action: Action) {
    if (this.tampon?.action !== action) return false;
    this.tampon = null;
    return true;
  }

  aEnTampon(action: Action) {
    return this.tampon?.action === action;
  }
}

export class Combat {
  readonly combattants: Combattant[];
  image = 0;
  fini = false;
  gagnant: number | null = null;
  evenements: Evenement[] = [];

  constructor(persos: [NomPerso, NomPerso], vies = REGLES.vies) {
    this.combattants = persos.map((nom, i) => new Combattant(nom, i, vies));
  }

  adversaire(c: Combattant) {
    return this.combattants[1 - c.index];
  }

  pas(commandes: Commandes[]) {
    this.evenements = [];
    if (this.fini) return;
    this.combattants.forEach((c, i) => c.lire(commandes[i] ?? AUCUNE_COMMANDE));
    for (const c of this.combattants) {
      c.imagesDepuisCoupRecu++;
      if (c.gel > 0) {
        c.gel--;
        continue;
      }
      this.avancer(c);
      c.vieillirTampon();
    }
    // Les deux frappes d'un même instant portent toutes les deux : pas d'avantage au joueur 1.
    const contacts = this.combattants.flatMap((a) => this.contact(a, this.adversaire(a)) ?? []);
    for (const k of contacts) this.toucher(k);
    for (const c of this.combattants) this.verifierLimites(c);
    this.image++;
  }

  // ————— Un combattant, une image —————

  private avancer(c: Combattant) {
    const p = c.perso;
    c.image++;
    if (c.invincible > 0 && c.etat !== "reapparition") c.invincible--;
    if (c.traverse > 0) c.traverse--;
    if (c.etat !== "garde") c.bouclier = Math.min(1, c.bouclier + REGLES.bouclierRegain);

    switch (c.etat) {
      case "ko":
        if (c.image >= 70 && c.vies > 0) this.reapparaitre(c);
        return;
      case "reapparition": {
        const k = c.commandes;
        if (c.image > 150 || (c.image > 20 && (k.gauche || k.droite || k.bas || k.haut || k.attaque || k.special))) {
          this.changer(c, "libre");
          c.auSol = false;
          c.invincible = REGLES.invincibilite;
        }
        return;
      }
      case "etourdi":
      case "tournoie":
        if (--c.etourdi <= 0) this.changer(c, "libre");
        break;
      case "aTerre":
        if (c.image >= 26) {
          this.changer(c, "libre");
          c.invincible = 12;
        }
        break;
      case "brise":
        if (c.image >= 150) this.changer(c, "libre");
        break;
      case "atterrissage":
        if (c.image >= c.retardAtterrissage) this.changer(c, "libre");
        break;
      case "gardeFin":
        if (c.image >= 7) this.changer(c, "libre");
        break;
      case "elan":
        if (c.image >= 3) {
          c.vy = c.commandes.haut ? p.saut : p.saut * 0.72;
          c.auSol = false;
          this.changer(c, "libre");
          this.evenements.push({ type: "saut", joueur: c.index, air: false });
        }
        break;
      case "garde":
        c.bouclier -= REGLES.bouclierUsure;
        if (c.gardeBloquee > 0) c.gardeBloquee--;
        else if (c.prendre("saut")) {
          this.changer(c, "elan");
        } else if (!c.commandes.garde) this.changer(c, "gardeFin");
        if (c.bouclier <= 0) this.briser(c);
        break;
      case "coup":
        this.avancerCoup(c);
        break;
    }
    if (c.etat === "libre") this.controler(c);
    this.physique(c);
  }

  private changer(c: Combattant, etat: Etat) {
    c.etat = etat;
    c.image = 0;
    if (etat !== "coup") {
      c.coup = null;
      c.charge = 0;
    }
  }

  private controler(c: Combattant) {
    const p = c.perso;
    const k = c.commandes;
    const sx = (k.droite ? 1 : 0) - (k.gauche ? 1 : 0);
    if (c.auSol) {
      if (c.prendre("saut")) return this.changer(c, "elan");
      if (k.garde) {
        this.changer(c, "garde");
        c.vx *= 0.3;
        return;
      }
      if (c.prendre("attaque")) return this.lancer(c, p.coups.sol);
      if (c.prendre("special")) return this.lancer(c, p.coups.special);
      if (c.basPresse && this.surPlateforme(c)) {
        c.traverse = 12;
        c.auSol = false;
        c.y -= 0.02;
        return;
      }
      if (sx !== 0) {
        c.dir = sx as 1 | -1;
        c.vx = approcher(c.vx, sx * p.marche, p.accelSol * DT);
      } else c.vx = approcher(c.vx, 0, REGLES.frottement * DT);
    } else {
      if (c.prendre("saut") && c.sautsRestants > 0) {
        c.sautsRestants--;
        c.vy = p.sautAir;
        c.ey = Math.min(c.ey, 0);
        c.chuteRapide = false;
        if (sx !== 0) {
          c.dir = sx as 1 | -1;
          c.vx = sx * p.vitesseAir * 0.8;
        }
        this.evenements.push({ type: "saut", joueur: c.index, air: true });
        return;
      }
      if (c.prendre("attaque")) return this.lancer(c, p.coups.air);
      if (c.aEnTampon("special") && !c.remonteeUtilisee) {
        c.prendre("special");
        return this.lancer(c, p.coups.specialAir);
      }
      if (sx !== 0) {
        c.dir = sx as 1 | -1;
        c.vx = approcher(c.vx, sx * p.vitesseAir, p.accelAir * DT);
      } else c.vx = approcher(c.vx, 0, p.accelAir * 0.25 * DT);
      if (c.basPresse && c.vy < 3) c.chuteRapide = true;
    }
  }

  private lancer(c: Combattant, coup: Coup) {
    this.changer(c, "coup");
    c.coup = coup;
    c.toucheCetteFois = false;
    c.charge = 0;
    if (coup.remontee) c.remonteeUtilisee = true;
    if (c.auSol) c.vx *= 0.3;
    this.evenements.push({ type: "coup", joueur: c.index, nom: coup.nom, charge: 0 });
  }

  private avancerCoup(c: Combattant) {
    const k = c.coup!;
    const p = c.perso;
    if (k.charge && c.image === k.charge.debut && c.commandes.special && c.charge < k.charge.max && c.auSol) {
      c.charge++;
      c.image--;
    }
    if (k.remontee && k.remontee.vy && c.image === k.remontee.image) {
      c.vy = k.remontee.vy;
      c.ey = Math.min(c.ey, 0);
      c.chuteRapide = false;
    }
    if (k.elan && c.image >= k.elan.debut && c.image <= k.elan.fin) {
      c.vx = c.dir * k.elan.vx;
      if (k.elan.vy !== undefined) c.vy = k.elan.vy;
    }
    // À la fin de l'élan, on freine net : sinon on glisserait loin (et hors du récif).
    if (k.elan && c.image === k.elan.fin + 1) c.vx *= 0.2;
    if (k.suite && c.image >= k.suite.des && c.prendre("attaque")) {
      const suivant = p.coups[k.suite.coup];
      if (suivant) return this.lancer(c, suivant);
    }
    if (c.image >= k.duree) this.changer(c, "libre");
  }

  // ————— Déplacements et collisions —————

  private physique(c: Combattant) {
    const p = c.perso;
    if (!c.auSol) {
      const g = p.gravite * (c.chuteRapide ? 1.4 : 1);
      c.vy -= g * DT;
      const max = c.chuteRapide ? p.chuteRapide : p.chuteMax;
      if (c.vy < -max) c.vy = -max;
    } else if (c.etat !== "libre") {
      const enElan = c.etat === "coup" && c.coup?.elan && c.image >= c.coup.elan.debut && c.image <= c.coup.elan.fin;
      if (!enElan) c.vx = approcher(c.vx, 0, REGLES.frottement * DT);
    }
    const amorti = 1 - REGLES.amortiEjection;
    c.ex *= amorti;
    c.ey *= amorti;
    if (Math.abs(c.ex) < 0.3) c.ex = 0;
    if (Math.abs(c.ey) < 0.3) c.ey = 0;
    if (c.auSol && c.ey > 0) c.auSol = false;

    this.deplacerX(c, (c.vx + c.ex) * DT);
    this.deplacerY(c, (c.vy + c.ey) * DT);
    if (c.auSol && !this.soutenu(c)) {
      c.auSol = false;
      if (c.vy > 0) c.vy = 0;
    }
  }

  private boite(c: Combattant, x = c.x, y = c.y) {
    const w = c.perso.largeur / 2;
    return { gauche: x - w, droite: x + w, bas: y, haut: y + c.perso.hauteur };
  }

  private deplacerX(c: Combattant, dx: number) {
    if (dx === 0) return;
    c.x += dx;
    const w = c.perso.largeur / 2;
    for (const b of ARENE.blocs) {
      const r = this.boite(c);
      if (r.droite <= b.gauche || r.gauche >= b.droite || r.haut <= b.bas || r.bas >= b.haut) continue;
      c.x = dx > 0 ? b.gauche - w - 1e-4 : b.droite + w + 1e-4;
      if (c.etat === "tournoie") c.ex = -c.ex * 0.5;
      else c.ex = 0;
      c.vx = 0;
    }
  }

  private deplacerY(c: Combattant, dy: number) {
    if (dy === 0) return;
    const avant = c.y;
    c.y += dy;
    for (const b of ARENE.blocs) {
      const r = this.boite(c);
      if (r.droite <= b.gauche || r.gauche >= b.droite || r.haut <= b.bas || r.bas >= b.haut) continue;
      if (dy < 0) {
        c.y = b.haut;
        this.atterrir(c);
      } else {
        c.y = b.bas - c.perso.hauteur - 1e-4;
        c.vy = Math.min(c.vy, 0);
        c.ey = c.etat === "tournoie" ? -c.ey * 0.4 : Math.min(c.ey, 0);
      }
    }
    if (dy < 0 && c.traverse === 0 && !c.auSol) {
      for (const pl of ARENE.plateformes) {
        if (avant >= pl.y - 1e-6 && c.y < pl.y && this.auDessus(c, pl.gauche, pl.droite)) {
          c.y = pl.y;
          this.atterrir(c);
          break;
        }
      }
    }
  }

  private auDessus(c: Combattant, gauche: number, droite: number) {
    const marge = c.perso.largeur * 0.3;
    return c.x > gauche - marge && c.x < droite + marge;
  }

  private surPlateforme(c: Combattant) {
    return ARENE.plateformes.some((pl) => Math.abs(c.y - pl.y) < 1e-3 && this.auDessus(c, pl.gauche, pl.droite));
  }

  private soutenu(c: Combattant) {
    if (ARENE.blocs.some((b) => Math.abs(c.y - b.haut) < 1e-3 && this.auDessus(c, b.gauche, b.droite))) return true;
    return c.traverse === 0 && this.surPlateforme(c);
  }

  private atterrir(c: Combattant) {
    const p = c.perso;
    const fort = c.vy + c.ey < -11;
    if (c.etat === "tournoie" && c.ey < -14) {
      // Rebond sur le sol quand on arrive trop vite.
      c.ey = -c.ey * 0.45;
      c.vy = 0;
      this.evenements.push({ type: "atterrit", joueur: c.index, fort: true });
      return;
    }
    c.auSol = true;
    c.vy = 0;
    c.ey = 0;
    c.sautsRestants = p.sautsAir;
    c.remonteeUtilisee = false;
    c.chuteRapide = false;
    if (c.etat === "coup" && c.coup && (c.coup === p.coups.air || c.coup === p.coups.specialAir)) {
      c.retardAtterrissage = c.coup.atterrissage ?? 4;
      this.changer(c, "atterrissage");
    } else if (c.etat === "tournoie") {
      this.changer(c, "aTerre");
      c.ex *= 0.3;
    } else if (c.etat === "libre" && c.vx !== 0) {
      c.vx *= 0.6;
    }
    this.evenements.push({ type: "atterrit", joueur: c.index, fort });
  }

  // ————— Les coups —————

  private contact(a: Combattant, v: Combattant): Contact | null {
    if (a.etat !== "coup" || !a.coup || a.toucheCetteFois || a.gel > 0) return null;
    if (v.horsJeu || v.invincible > 0) return null;
    for (const f of a.coup.frappes) {
      if (a.image < f.debut || a.image > f.fin) continue;
      const cx = a.x + a.dir * f.x;
      const cy = a.y + f.y;
      const r = this.boite(v);
      const px = Math.max(r.gauche, Math.min(cx, r.droite));
      const py = Math.max(r.bas, Math.min(cy, r.haut));
      if ((px - cx) ** 2 + (py - cy) ** 2 > f.rayon ** 2) continue;
      return { a, v, f, x: (cx + px) / 2, y: (cy + py) / 2, coup: a.coup, ratio: a.chargeRatio };
    }
    return null;
  }

  private toucher({ a, v, f, x, y, coup, ratio }: Contact) {
    a.toucheCetteFois = true;
    const charge = coup.charge;
    const degats = Math.round(f.degats * (1 + (charge ? ratio * charge.degats : 0)));
    const sens: 1 | -1 = f.x < 0.3 ? (Math.sign(v.x - a.x) as 1 | -1) || a.dir : a.dir;
    const evenement = { type: "touche" as const, attaquant: a.index, victime: v.index, x, y, degats, effet: f.effet };

    if (v.etat === "garde") {
      v.bouclier -= degats * REGLES.bouclierParDegat;
      const gel = Math.round(3 + degats * 0.3);
      a.gel = v.gel = gel;
      v.gardeBloquee = Math.round(4 + degats * 0.6);
      v.vx = sens * (2 + degats * 0.3);
      a.vx = -sens * 1.5;
      this.evenements.push({ ...evenement, force: 0, garde: true, armure: false });
      if (v.bouclier <= 0) this.briser(v);
      return;
    }

    v.degats = Math.min(999, v.degats + degats);
    a.stats.degatsInfliges += degats;
    a.stats.coupsPortes++;
    v.imagesDepuisCoupRecu = 0;
    const base = f.base * (1 + (charge ? ratio * charge.ejection : 0));
    const force = (base + (f.croissance * v.degats) / 100) * v.perso.ejection;

    const armure = v.etat === "coup" && v.coup?.armure;
    if (armure && v.image >= armure.debut && v.image <= armure.fin && force < 45) {
      a.gel = v.gel = Math.round(4 + degats * 0.3);
      this.evenements.push({ ...evenement, force, garde: false, armure: true });
      return;
    }

    const angle = (f.angle * Math.PI) / 180;
    v.ex = Math.cos(angle) * force * sens;
    v.ey = Math.sin(angle) * force;
    if (v.auSol && v.ey < 0) v.ey = -v.ey * 0.6;
    if (v.auSol && force < 8) v.ey = 0;
    if (v.ey > 0) v.auSol = false;
    v.vx = 0;
    v.vy = 0;
    this.changer(v, force >= REGLES.seuilTournoie ? "tournoie" : "etourdi");
    v.etourdi = Math.round(8 + force * 0.9);
    v.dir = -sens as 1 | -1;
    v.chuteRapide = false;
    v.remonteeUtilisee = false;
    a.gel = v.gel = Math.round(3 + degats * 0.35 + (force > 30 ? 4 : 0));
    this.evenements.push({ ...evenement, force, garde: false, armure: false });
  }

  private briser(c: Combattant) {
    c.bouclier = 0.4;
    this.changer(c, "brise");
    c.auSol = false;
    c.vy = 12;
    this.evenements.push({ type: "brise", joueur: c.index });
  }

  // ————— Éjections, vies, réapparition —————

  private verifierLimites(c: Combattant) {
    if (c.horsJeu) return;
    const l = ARENE.limites;
    if (c.x > l.gauche && c.x < l.droite && c.y > l.bas && c.y < l.haut) return;
    c.vies--;
    if (c.imagesDepuisCoupRecu > 240) c.stats.autodestructions++;
    else this.adversaire(c).stats.koDonnes++;
    this.evenements.push({
      type: "ko",
      joueur: c.index,
      degats: c.degats,
      x: Math.max(l.gauche, Math.min(l.droite, c.x)),
      y: Math.max(l.bas, Math.min(l.haut, c.y)),
    });
    this.changer(c, "ko");
    c.vx = c.vy = c.ex = c.ey = 0;
    c.gel = 0;
    if (c.vies <= 0) {
      this.fini = true;
      this.gagnant = this.adversaire(c).index;
      this.evenements.push({ type: "fin", gagnant: this.gagnant });
    }
  }

  private reapparaitre(c: Combattant) {
    const r = ARENE.reapparition;
    c.x = r.x;
    c.y = r.y;
    c.degats = 0;
    c.bouclier = 1;
    c.auSol = false;
    c.sautsRestants = c.perso.sautsAir;
    c.remonteeUtilisee = false;
    c.dir = c.x <= this.adversaire(c).x ? 1 : -1;
    this.changer(c, "reapparition");
    this.evenements.push({ type: "reapparait", joueur: c.index });
  }
}

function approcher(v: number, cible: number, pas: number) {
  if (v < cible) return Math.min(cible, v + pas);
  return Math.max(cible, v - pas);
}
