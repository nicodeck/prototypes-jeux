// Le circuit de l'île : la route, le raccourci, les perles à objets, les bandes d'accélération
// et le tremplin. Tout est décrit par des points clés : on peut les déplacer à la main, puis
// lancer `bun test` pour vérifier que les bots savent encore faire la course.
import { Piste, type Cote, type PointCle, type Projection } from "./piste";

// ——— Les bas-côtés ———
/** Une plage : du sable, puis la mer. */
const PLAGE: Cote = { sol: "sable", bord: 7, limite: "eau" };
/** La rive de la lagune, plus étroite. */
const RIVE: Cote = { sol: "sable", bord: 4, limite: "eau" };
/** Un pré, bordé de rochers et de palmiers. */
const PRE: Cote = { sol: "herbe", bord: 8, limite: "mur" };
/** Le haut de la falaise : un peu d'herbe, puis des rochers. */
const FALAISE: Cote = { sol: "herbe", bord: 4, limite: "mur" };
/** La rambarde du pont. */
const RAMBARDE: Cote = { sol: "planches", bord: 0.4, limite: "mur" };
/** Le bord du ponton : rien pour retenir le kart. */
const PONTON: Cote = { sol: "planches", bord: 0.3, limite: "eau" };

const p = (x: number, z: number, y: number, largeur: number, g: Cote, d: Cote, pont = false): PointCle => ({
  x,
  z,
  y,
  largeur,
  g,
  d,
  pont,
});

/**
 * La boucle principale, dans le sens de la course. Le départ est au point 0.
 * x vers l'est, z vers le sud ; y est l'altitude (la mer est à 0).
 */
export const POINTS: PointCle[] = [
  p(-60, 60, 1.5, 16, RIVE, PLAGE), // 0 : la ligne de départ, sur la plage sud
  p(-5, 62, 1.5, 16, PRE, PLAGE), // 1 : le village
  p(55, 58, 1.6, 16, PRE, PLAGE), // 2
  p(100, 38, 2.5, 15, PRE, PLAGE), // 3 : on attaque le cap
  p(122, 0, 5, 14, FALAISE, FALAISE), // 4 : la montée
  p(118, -42, 8.5, 14, FALAISE, FALAISE), // 5
  p(98, -78, 11.5, 13, PRE, FALAISE), // 6 : le phare
  p(64, -96, 12.5, 13, PRE, FALAISE), // 7 : l'épingle
  p(34, -82, 12.5, 13, PRE, PRE), // 8
  p(28, -52, 11.5, 13, PRE, PRE), // 9 : la descente
  p(8, -26, 8.5, 14, PRE, PRE), // 10 : le tremplin
  p(-26, -18, 5, 14, RIVE, PLAGE), // 11
  p(-55, -30, 4.5, 14, RAMBARDE, RAMBARDE, true), // 12 : le pont
  p(-95, -40, 4.5, 14, RAMBARDE, RAMBARDE, true), // 13
  p(-132, -38, 3, 15, RIVE, PLAGE), // 14
  p(-174, -24, 1.6, 15, RIVE, PLAGE), // 15 : la grande anse
  p(-205, 8, 1.5, 15, RIVE, PLAGE), // 16
  p(-188, 44, 1.5, 15, RIVE, PLAGE), // 17
  p(-145, 60, 1.5, 15, RIVE, PLAGE), // 18
  p(-105, 61, 1.5, 16, RIVE, PLAGE), // 19
];

/** Le raccourci : un ponton étroit, sans rambarde, qui traverse la lagune. */
export const RACCOURCI: PointCle[] = [
  p(-146, -33, 2.4, 6, PONTON, PONTON),
  p(-157, -14, 1.6, 5, PONTON, PONTON),
  p(-150, 10, 1.5, 5, PONTON, PONTON),
  p(-158, 34, 1.5, 5, PONTON, PONTON),
  p(-145, 54, 1.5, 6, PONTON, PONTON),
];

/** Les rangées de perles à objets : où (en points clés) et combien en travers de la route. */
export const PERLES = [
  { u: 1.4, nombre: 4 },
  { u: 5.3, nombre: 4 },
  { u: 13.4, nombre: 4 },
];

/** Les bandes d'accélération : où, et leur écart au milieu de la route (positif à gauche). */
export const BANDES = [
  { u: 8.6, d: 2.5 },
  { u: 12.6, d: -3 },
  { u: 18.7, d: 0 },
];

/** Le tremplin, en travers de toute la route. */
export const TREMPLINS = [{ u: 10.35, longueur: 7, hauteur: 1.3 }];

// ——— Ce que le jeu en tire ———

export type Surface = "route" | "herbe" | "sable" | "planches" | "eau";

export interface Lieu {
  /** Sur quelle piste on est. */
  piste: "principal" | "raccourci";
  proj: Projection;
  /** La distance parcourue sur la boucle principale (le raccourci compte comme le bout qu'il évite). */
  s: number;
  surface: Surface;
  /** Altitude du sol (tremplin compris). */
  y: number;
  /** Sur la route ou sur une bande d'accélération. */
  bande: boolean;
  /** Le mur du côté où l'on est, s'il y en a un : écart maximal permis pour le centre du kart. */
  mur: number | null;
}

export interface Memo {
  iP?: number;
  iR?: number;
}

export class Circuit {
  readonly principal = new Piste(POINTS, true);
  readonly raccourci = new Piste(RACCOURCI, false);
  /** Où le raccourci quitte et rejoint la boucle. */
  readonly sDebut: number;
  readonly sFin: number;
  readonly perles: { x: number; z: number; y: number }[] = [];
  readonly bandes: { s: number; d: number; longueur: number; largeur: number }[];
  readonly tremplins: { s: number; longueur: number; hauteur: number }[];
  /** Les places sur la grille de départ, de la première à la dernière. */
  readonly grille: { x: number; z: number; y: number; cap: number; s: number }[] = [];

  constructor() {
    const P = this.principal;
    const r = this.raccourci;
    this.sDebut = P.projeter(r.echantillons[0].x, r.echantillons[0].z).s;
    const fin = r.echantillons[r.echantillons.length - 1];
    this.sFin = P.projeter(fin.x, fin.z).s;
    for (const rang of PERLES) {
      const s = this.sDeU(rang.u);
      const largeur = P.point(s).e.largeur;
      for (let k = 0; k < rang.nombre; k++) {
        const d = (k - (rang.nombre - 1) / 2) * ((largeur - 4) / (rang.nombre - 1));
        const q = P.point(s, d);
        this.perles.push({ x: q.x, z: q.z, y: q.y });
      }
    }
    this.bandes = BANDES.map((b) => ({ s: this.sDeU(b.u), d: b.d, longueur: 5, largeur: 3.2 }));
    this.tremplins = TREMPLINS.map((t) => ({ s: this.sDeU(t.u), longueur: t.longueur, hauteur: t.hauteur }));
    for (let k = 0; k < 8; k++) {
      const s = P.longueur - 6 - Math.floor(k / 2) * 7 - (k % 2) * 3.5;
      const q = P.point(s, k % 2 === 0 ? 3.5 : -3.5);
      this.grille.push({ x: q.x, z: q.z, y: q.y, cap: q.cap, s });
    }
  }

  /** La distance sur la boucle d'une position en points clés (3.5 = entre le point 3 et le 4). */
  sDeU(u: number) {
    let meilleur = 0;
    let ecart = Infinity;
    for (const e of this.principal.echantillons) {
      const d = Math.abs(e.u - u);
      if (d < ecart) {
        ecart = d;
        meilleur = e.s;
      }
    }
    return meilleur;
  }

  /** Où se trouve un point : sur quelle piste, sur quel sol, à quelle altitude. */
  lieu(x: number, z: number, memo: Memo = {}): Lieu {
    const pP = this.principal.projeter(x, z, memo.iP);
    memo.iP = pP.i;
    const largeurP = this.principal.echantillons[pP.i].largeur;
    let piste: Lieu["piste"] = "principal";
    let proj = pP;
    let e = this.principal.echantillons[pP.i];
    let s = pP.s;
    // Le raccourci ne compte qu'entre ses deux bouts.
    const pR = this.raccourci.projeter(x, z, memo.iR);
    memo.iR = pR.i;
    if (pR.s >= 0 && pR.s <= this.raccourci.longueur) {
      const eR = this.raccourci.echantillons[pR.i];
      if (Math.abs(pR.d) - eR.largeur / 2 < Math.abs(pP.d) - largeurP / 2) {
        piste = "raccourci";
        proj = pR;
        e = eR;
        s = this.sDebut + (pR.s / this.raccourci.longueur) * (this.sFin - this.sDebut);
      }
    }
    const demi = e.largeur / 2;
    const ad = Math.abs(proj.d);
    const cote = proj.d > 0 ? e.g : e.d;
    let surface: Surface = "route";
    let mur: number | null = null;
    if (ad > demi) surface = cote.sol;
    if (cote.limite === "mur") mur = demi + cote.bord;
    else if (ad > demi + cote.bord) surface = "eau";
    let y = proj.y;
    let bande = false;
    if (piste === "principal" && ad <= demi) {
      for (const t of this.tremplins) {
        const k = (proj.s - t.s) / t.longueur;
        if (k >= 0 && k <= 1) y += t.hauteur * k;
      }
      for (const b of this.bandes)
        if (Math.abs(proj.s - b.s) < b.longueur / 2 && Math.abs(proj.d - b.d) < b.largeur / 2) bande = true;
    }
    return { piste, proj, s, surface, y, bande, mur };
  }
}
