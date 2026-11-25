// Le bot : il regarde le combat et produit les mêmes commandes qu'un joueur au clavier.
// Trois niveaux, qui changent son temps de réaction, sa garde et son agressivité.
import { ARENE } from "./arene";
import { AUCUNE_COMMANDE, type Combat, type Combattant, type Commandes } from "./combat";

export type Niveau = "facile" | "moyen" | "difficile";

interface Profil {
  /** Images avant de remarquer une attaque adverse. */
  reaction: number;
  /** Chance de se mettre en garde face à une attaque remarquée. */
  garde: number;
  /** Chance d'attaquer quand l'adversaire est à portée. */
  agressivite: number;
  /** Chance de rester planté un moment sans rien faire. */
  distraction: number;
  /** Chance de bien réussir à revenir sur le récif. */
  retour: number;
  /** Va-t-il guetter l'adversaire au bord du récif ? */
  guetteLeBord: boolean;
}

export const PROFILS: Record<Niveau, Profil> = {
  facile: { reaction: 24, garde: 0.15, agressivite: 0.3, distraction: 0.35, retour: 0.92, guetteLeBord: false },
  moyen: { reaction: 13, garde: 0.45, agressivite: 0.6, distraction: 0.1, retour: 1, guetteLeBord: true },
  difficile: { reaction: 7, garde: 0.8, agressivite: 0.9, distraction: 0, retour: 1, guetteLeBord: true },
};

/** Portée utile de l'attaque au sol, depuis le centre. */
const PORTEE = { rin: 1.25, ganzo: 1.75 };
/** Au-delà de ces dégâts, l'adversaire peut être éjecté : le bot tente son spécial. */
const SEUIL_SPECIAL = { rin: 85, ganzo: 60 };

export class Bot {
  readonly profil: Profil;
  private prec: Commandes = { ...AUCUNE_COMMANDE };
  private tenirSaut = 0;
  private prochaineDecision = 0;
  private veutAttaquer = false;
  private veutSpecial = false;
  private distrait = 0;
  private rateRetour = false;
  private coupRemarque = -1;
  private garder = false;
  private chargeVoulue = 0;

  constructor(
    readonly niveau: Niveau,
    private readonly hasard: () => number,
  ) {
    this.profil = PROFILS[niveau];
  }

  commandes(combat: Combat, index: number): Commandes {
    const c = this.decider(combat, combat.combattants[index], combat.combattants[1 - index]);
    if (this.tenirSaut > 0) {
      this.tenirSaut--;
      if (this.prec.haut) c.haut = true;
    }
    this.prec = c;
    return { ...c };
  }

  private decider(combat: Combat, moi: Combattant, lui: Combattant): Commandes {
    const c: Commandes = { ...AUCUNE_COMMANDE };
    const tap = (k: keyof Commandes) => {
      if (!this.prec[k]) c[k] = true;
    };
    const sauter = () => {
      if (!this.prec.haut) {
        c.haut = true;
        this.tenirSaut = 7;
      }
    };
    const aller = (sens: number) => {
      if (sens > 0) c.droite = true;
      else if (sens < 0) c.gauche = true;
    };
    const bord = ARENE.bord;

    if (moi.etat === "reapparition") {
      if (moi.image > 30 + this.hasard() * 40) c.bas = true;
      return c;
    }
    if (moi.horsJeu) return c;

    // Éjecté : on pousse vers le centre pour limiter la casse.
    if (moi.etat === "tournoie" || moi.etat === "etourdi" || moi.etat === "brise") {
      aller(-Math.sign(moi.x));
      return c;
    }

    // Hors du récif : revenir avant tout.
    const horsRecif = Math.abs(moi.x) > bord - 0.2 || moi.y < -0.05;
    if (!moi.auSol && horsRecif) {
      if (moi.etat !== "libre" && moi.etat !== "coup") return c;
      return this.revenir(moi, c, sauter, tap, aller);
    }
    this.rateRetour = this.hasard() > this.profil.retour;

    // Une nouvelle décision de temps en temps : sinon le bot tremblerait d'une image à l'autre.
    if (combat.image >= this.prochaineDecision) {
      this.prochaineDecision = combat.image + 6 + Math.floor(this.hasard() * this.profil.reaction * 0.6);
      this.veutAttaquer = this.hasard() < this.profil.agressivite;
      this.veutSpecial = this.hasard() < 0.35;
      if (this.distrait <= 0 && this.hasard() < this.profil.distraction * 0.15) this.distrait = 20 + this.hasard() * 50;
    }
    if (this.distrait > 0) {
      this.distrait--;
      return c;
    }

    const dx = lui.x - moi.x;
    const adx = Math.abs(dx);
    const dy = lui.y - moi.y;
    const face = Math.sign(dx) || moi.dir;

    // Garde : l'adversaire attaque, à portée, et on l'a vu venir.
    const debutCoup = combat.image - lui.image - lui.charge;
    const menace =
      lui.etat === "coup" &&
      lui.coup !== null &&
      !lui.toucheCetteFois &&
      adx < porteeCoup(lui) + moi.perso.largeur &&
      Math.abs(dy) < 2.2;
    if (menace && lui.image + lui.charge >= this.profil.reaction && this.coupRemarque !== debutCoup) {
      this.coupRemarque = debutCoup;
      this.garder = moi.auSol && moi.bouclier > 0.3 && this.hasard() < this.profil.garde;
    }
    if (!menace) this.garder = false;
    if (this.garder && moi.auSol && (moi.libre || moi.etat === "garde")) {
      c.garde = true;
      return c;
    }

    // Ganzo charge son poing : il le lâche quand l'adversaire arrive ou que la charge suffit.
    if (moi.etat === "coup" && moi.coup?.charge) {
      if (moi.charge < this.chargeVoulue && adx > 2.3) c.special = true;
      return c;
    }

    // L'adversaire réapparaît ou est invincible : on se replace au centre.
    if (lui.horsJeu || lui.invincible > 0) {
      if (Math.abs(moi.x) > 2) aller(-Math.sign(moi.x));
      return c;
    }

    // L'adversaire est hors du récif : on l'attend au bord.
    const luiDehors = Math.abs(lui.x) > bord || lui.y < -0.3;
    if (luiDehors) {
      if (!this.profil.guetteLeBord) {
        if (Math.abs(moi.x) > 3) aller(-Math.sign(moi.x));
        return c;
      }
      const poste = Math.sign(lui.x) * (bord - 1.1);
      if (Math.abs(poste - moi.x) > 0.4) aller(poste - moi.x);
      else if (moi.dir !== face) aller(face);
      if (adx < PORTEE[moi.nom] + 0.3 && Math.abs(dy) < 1.5 && moi.libre) tap("attaque");
      return c;
    }

    const aPortee = adx < PORTEE[moi.nom] && Math.abs(dy) < 1.4;

    // L'adversaire se protège : Ganzo charge son poing pour casser la garde, Rin attend qu'il la lâche.
    if (lui.etat === "garde" && adx < 3 && moi.libre && moi.auSol) {
      if (moi.nom === "ganzo" && this.veutAttaquer) {
        this.chargeVoulue = 25 + Math.floor(this.hasard() * 30);
        tap("special");
      } else if (adx < 1.6) aller(-face);
      return c;
    }

    // À portée : on frappe.
    if (aPortee) {
      if (moi.dir !== face && moi.libre) {
        aller(face);
        return c;
      }
      if (moi.etat === "coup" || moi.libre) {
        if (!this.veutAttaquer) {
          // On recule un peu, ou on attend.
          if (this.veutSpecial && moi.auSol && Math.abs(moi.x - face) < bord - 1) aller(-face);
          return c;
        }
        if (moi.auSol && this.veutSpecial && lui.degats >= SEUIL_SPECIAL[moi.nom] && moi.libre) {
          this.chargeVoulue = 10 + Math.floor(this.hasard() * 20);
          tap("special");
        } else tap("attaque");
      }
      return c;
    }

    if (!moi.libre) return c;

    // Au-dessus de nous : on saute, puis on frappe en l'air.
    if (dy > 1.2 && adx < 3.5) {
      if (moi.auSol) sauter();
      else if (adx < PORTEE[moi.nom] + 0.4 && dy < 1.6) tap("attaque");
      else if (moi.vy < 0 && dy > 0.8 && moi.sautsRestants > 0) sauter();
      aller(face);
      return c;
    }
    // En dessous : on descend de la plateforme.
    if (dy < -1 && moi.auSol && moi.y > 0.5 && adx < 4) {
      tap("bas");
      return c;
    }

    // Les spéciaux de rapprochement.
    if (moi.auSol && this.veutSpecial && this.veutAttaquer && Math.abs(dy) < 0.8) {
      if (moi.nom === "rin" && adx > 2.4 && adx < 4.6 && moi.dir === face) return (tap("special"), c);
      if (moi.nom === "ganzo" && adx > 3 && adx < 6 && lui.degats >= SEUIL_SPECIAL.ganzo && moi.dir === face) {
        this.chargeVoulue = 20 + Math.floor(this.hasard() * 40);
        tap("special");
        return c;
      }
    }

    // Se rapprocher, sans tomber du récif.
    const devant = moi.x + face * 0.9;
    if (!moi.auSol || Math.abs(devant) < bord - 0.3) aller(face);
    else if (moi.dir !== face) aller(face);
    return c;
  }

  private revenir(
    moi: Combattant,
    c: Commandes,
    sauter: () => void,
    tap: (k: keyof Commandes) => void,
    aller: (sens: number) => void,
  ) {
    const bord = ARENE.bord;
    const versCentre = -Math.sign(moi.x) || 1;
    const loin = Math.abs(moi.x) - bord;
    const sousLeRecif = loin < moi.perso.largeur / 2 + 0.1 && moi.y < -0.3;
    // Sous le récif, on s'écarte d'abord pour ne pas se cogner la tête en remontant.
    if (sousLeRecif && moi.vy > -2) aller(-versCentre);
    else aller(versCentre);
    if (moi.etat !== "libre" || this.rateRetour) return c;
    if (moi.sautsRestants > 0 && moi.vy < 1 && (moi.y < 0.8 || loin > 2.2)) sauter();
    else if (moi.sautsRestants === 0 && !moi.remonteeUtilisee && moi.vy < 0 && (moi.y < -0.6 || loin > 2.6)) {
      if (moi.dir !== versCentre) aller(versCentre);
      else tap("special");
    }
    return c;
  }
}

function porteeCoup(c: Combattant) {
  return Math.max(0, ...(c.coup?.frappes.map((f) => f.x + f.rayon) ?? [0])) + (c.coup?.elan ? 2 : 0);
}

/** Un générateur pseudo-aléatoire reproductible (mulberry32). */
export function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
