// Les pilotes bots. Ils jouent avec les mêmes commandes qu'un joueur : un volant, l'accélérateur,
// le frein, le dérapage et le bouton d'objet. Ils visent un point un peu plus loin sur la route,
// coupent les virages, dérapent dans les courbes et se servent de leurs objets.
import { REGLAGES as R } from "../reglages";
import { AUCUNE_COMMANDE, type Commandes, type Course, type Kart } from "./course";

export type Niveau = "facile" | "moyen" | "difficile";

interface Profil {
  /** Le bot lâche l'accélérateur au-delà de cette part de sa vitesse de pointe. */
  vitesse: number;
  /** Dérape-t-il, et jusqu'à quel palier attend-il ? */
  derive: boolean;
  palierVise: number;
  /** À quel point il coupe les virages (0 = au milieu de la route, 1 = à la corde). */
  corde: number;
  /** Ses chances de prendre le raccourci. */
  raccourci: number;
  /** Le temps qu'il met à se servir d'un objet, en images. */
  reaction: number;
  /** Ses chances de réussir le turbo de départ. */
  depart: number;
  /** Il évite les méduses. */
  evite: boolean;
}

export const PROFILS: Record<Niveau, Profil> = {
  facile: { vitesse: 0.86, derive: false, palierVise: 0, corde: 0.3, raccourci: 0, reaction: 100, depart: 0, evite: false },
  moyen: { vitesse: 0.94, derive: true, palierVise: 1, corde: 0.6, raccourci: 0.2, reaction: 45, depart: 0.4, evite: true },
  difficile: { vitesse: 1, derive: true, palierVise: 2, corde: 0.85, raccourci: 0.75, reaction: 15, depart: 0.9, evite: true },
};

const angle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const borne = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export class Bot {
  readonly profil: Profil;
  private voie = 0;
  private prochaineVoie = 0;
  private prendRaccourci = false;
  private tourDecide = 0;
  private tenu = 0;
  private relache = 0;
  private trop = 0;
  private sens = 0;
  private bloque = 0;
  private recule = 0;
  private appuiObjet = false;
  private departVise: number | null = null;

  constructor(
    readonly niveau: Niveau,
    private readonly alea: () => number,
    /** Pour les tests : interdire le dérapage. */
    options: { derive?: boolean; raccourci?: boolean } = {},
  ) {
    const p = PROFILS[niveau];
    this.profil = {
      ...p,
      derive: options.derive ?? p.derive,
      raccourci: options.raccourci === undefined ? p.raccourci : options.raccourci ? 1 : 0,
    };
  }

  commandes(course: Course, numero: number): Commandes {
    const k = course.karts[numero];
    const c: Commandes = { ...AUCUNE_COMMANDE };
    const P = this.profil;

    // ——— Le décompte : accélérer au bon moment pour le turbo de départ.
    if (!course.lancee) {
      if (this.departVise === null)
        this.departVise = this.alea() < P.depart ? course.depart - 8 - Math.floor(this.alea() * 18) : course.depart + 5;
      c.accelerer = course.image >= this.departVise;
      return c;
    }
    if (k.chute > 0 || k.sonne > 0) return c;

    const C = course.circuit;
    const lieu = k.lieu;
    const s = lieu.s;
    const v = k.v;

    // ——— La voie : chacun la sienne, qui change de temps en temps.
    if (--this.prochaineVoie <= 0) {
      this.voie = (this.alea() * 2 - 1) * 2.2;
      this.prochaineVoie = 150 + Math.floor(this.alea() * 200);
    }
    // ——— Le raccourci : décidé une fois par tour, en approchant de l'entrée.
    const avantEntree = s - C.sDebut;
    if (avantEntree > -80 && avantEntree < -40 && this.tourDecide !== k.tour) {
      this.tourDecide = k.tour;
      this.prendRaccourci = this.alea() < P.raccourci;
    }
    const surRaccourci = this.prendRaccourci && avantEntree > -30 && s < C.sFin - 2;

    // ——— Le point visé
    const regard = surRaccourci ? 6 + v * 0.3 : 7 + Math.max(0, v) * 0.5;
    const courbe = C.principal.virage(s, 0, 30);
    const demi = C.principal.point(s).e.largeur / 2;
    let voie = borne(-courbe / 0.8, -1, 1) * (demi - 2.5) * P.corde + this.voie * (1 - Math.min(1, Math.abs(courbe) / 0.5));
    if (P.evite) voie = this.eviter(course, k, voie, demi);
    voie = borne(voie, -demi + 1.8, demi - 1.8);
    let cible: { x: number; z: number };
    if (surRaccourci) {
      const pr = C.raccourci.projeter(k.x, k.z, k.memo.iR);
      const sr = Math.max(0, pr.s) + regard;
      cible = sr <= C.raccourci.longueur ? C.raccourci.point(sr) : C.principal.point(C.sFin + (sr - C.raccourci.longueur), voie);
    } else cible = C.principal.point(s + regard, voie);
    const erreur = angle(Math.atan2(cible.z - k.z, cible.x - k.x) - k.cap);

    // ——— Coincé ? On recule un peu.
    if (this.recule > 0) {
      this.recule--;
      c.freiner = true;
      c.direction = -Math.sign(erreur) || 1;
      return c;
    }
    if (Math.abs(v) < 1.5) {
      if (++this.bloque > 90) {
        this.bloque = 0;
        this.recule = 50;
      }
    } else this.bloque = 0;

    // ——— Le volant : on vise le point comme un arc de cercle (poursuite pure), et on en déduit
    // la vitesse de rotation voulue, puis le coup de volant qui la donne.
    const distance = Math.max(4, Math.hypot(cible.x - k.x, cible.z - k.z));
    const voulu = (2 * Math.max(4, v) * Math.sin(erreur)) / distance;
    const vr = Math.min(1, Math.abs(v) / R.vitesseMax);
    const taux = R.virage * k.stats.maniabilite * Math.min(1, Math.abs(v) / 4) * (1 - R.perteDeBraquage * vr * vr);
    c.direction = borne(voulu / Math.max(0.3, taux), -1, 1);
    const vmax = R.vitesseMax * k.stats.vitesse;
    c.accelerer = k.turbo > 0 || v < vmax * P.vitesse;
    if (Math.abs(erreur) > 1.1 && v > 12) {
      c.accelerer = false;
      c.freiner = true;
    }
    if (surRaccourci && Math.abs(erreur) > 0.3 && v > 17) c.accelerer = false;

    // ——— Le dérapage
    const D = R.derive;
    const racine = Math.sqrt(k.stats.maniabilite);
    const proche = C.principal.virage(s, 0, 18);
    if (this.relache > 0) this.relache--;
    if (k.derive !== 0) {
      c.derive = true;
      // Le coup de volant qui donne la rotation voulue pendant le dérapage.
      const interieur = ((voulu / racine) * k.derive - D.virage) / D.virageEnPlus;
      c.direction = borne(interieur, -1, 1) * k.derive;
      this.trop = interieur < -1.15 ? this.trop + 1 : 0;
      const fini = k.palier >= P.palierVise && Math.abs(proche) < 0.12;
      const deroute = this.trop > 8 || erreur * k.derive < -0.5;
      if (fini || deroute || surRaccourci) {
        c.derive = false;
        this.relache = 20;
      }
    } else if (k.sautDerive) {
      // Pendant le petit saut : on braque juste assez pour annoncer le sens du dérapage.
      c.derive = true;
      c.direction = this.sens * Math.max(0.3, c.direction * this.sens);
    } else if (
      P.derive &&
      this.relache === 0 &&
      !surRaccourci &&
      k.auSol &&
      v > D.vitesseMin + 3 &&
      Math.abs(C.principal.virage(s, 4, 4 + v * 1.4)) > 0.5 &&
      lieu.surface === "route" &&
      Math.abs(lieu.proj.d) < demi - 1
    ) {
      this.sens = Math.sign(C.principal.virage(s, 4, 4 + v * 1.4));
      c.derive = true;
      c.direction = this.sens;
    }

    // ——— Les objets
    c.objet = this.objet(course, k, s);
    return c;
  }

  /** S'écarte des méduses qui sont sur sa route. */
  private eviter(course: Course, k: Kart, voie: number, demi: number) {
    const fx = Math.cos(k.cap);
    const fz = Math.sin(k.cap);
    for (const o of course.objets) {
      if (o.type !== "meduse") continue;
      const rx = o.x - k.x;
      const rz = o.z - k.z;
      const devant = rx * fx + rz * fz;
      if (devant < 2 || devant > 28) continue;
      const pm = course.circuit.principal.projeter(o.x, o.z, o.memo.iP);
      if (Math.abs(pm.d - voie) < 2.6) {
        const gauche = pm.d < voie ? 1 : -1;
        const autre = pm.d + gauche * 3.2;
        voie = Math.abs(autre) < demi - 1.8 ? autre : pm.d - gauche * 3.2;
      }
    }
    return voie;
  }

  private objet(course: Course, k: Kart, s: number) {
    if (this.appuiObjet) {
      this.appuiObjet = false;
      return false;
    }
    if (!k.objet) {
      this.tenu = 0;
      return false;
    }
    this.tenu++;
    if (this.tenu < this.profil.reaction) return false;
    const C = course.circuit;
    const fx = Math.cos(k.cap);
    const fz = Math.sin(k.cap);
    let tirer = false;
    if (k.objet === "bulle") tirer = true;
    else if (k.objet === "piment") tirer = Math.abs(C.principal.virage(s, 0, 70)) < 0.3 && k.lieu.surface === "route";
    else {
      for (const a of course.karts) {
        if (a === k || a.chute > 0) continue;
        const rx = a.x - k.x;
        const rz = a.z - k.z;
        const devant = rx * fx + rz * fz;
        const cote = Math.abs(-rx * fz + rz * fx);
        if (k.objet === "oursin" && devant > 4 && devant < 55 && cote < 1.2 + devant * 0.03) tirer = true;
        if (k.objet === "meduse" && devant < -2 && devant > -16 && cote < 2.5) tirer = true;
      }
      if (this.tenu > 60 * 9) tirer = true;
    }
    if (tirer) this.appuiObjet = true;
    return tirer;
  }
}
