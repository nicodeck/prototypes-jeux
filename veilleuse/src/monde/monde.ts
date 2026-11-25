// Le monde : Veilleuse, les lanternes et le Cœur. Il avance d'une image à la fois, toujours au
// même rythme, et ne dépend pas du navigateur : il tourne aussi dans les tests.
import { REGLAGES as R } from "../reglages";
import { CASE, PLANCHE, ROCHE, caseEn, eauEn, salleEn, type Mine } from "./mine";
import { deplacerX, deplacerY, estPose, type Corps, type Terrain } from "./physique";

export type Commandes = { gauche: boolean; droite: boolean; bas: boolean; saut: boolean };
export const AUCUNE_COMMANDE: Commandes = { gauche: false, droite: false, bas: false, saut: false };

export const LARGEUR_HEROS = 10;
export const HAUTEUR_HEROS = 22;
/** Distance (en pixels) à laquelle une lanterne s'allume */
export const PORTEE_LANTERNE = 26;
export const PORTEE_COEUR = 40;

export type Heros = Corps & {
  vx: number;
  vy: number;
  regard: -1 | 1;
  auSol: boolean;
  /** Images restantes pour sauter après avoir quitté le sol */
  coyote: number;
  /** Images restantes pendant lesquelles un appui de saut est gardé */
  tampon: number;
  sautTenu: boolean;
  sautAvant: boolean;
  /** Côté de la paroi contre laquelle on glisse (0 : aucune) */
  mur: -1 | 0 | 1;
  /** Images depuis le début de la glissade */
  tempsMur: number;
  /** Images restantes pour un saut mural après avoir quitté la paroi, et de quel côté elle était */
  coyoteMur: number;
  coteMur: -1 | 1;
  /** Images pendant lesquelles un saut mural repousse */
  verrou: number;
  dansEau: boolean;
  /** Dans l'eau, la tête dehors */
  surface: boolean;
  /** Images restantes pendant lesquelles on traverse les planches */
  traverse: number;
  /** Distance parcourue au sol depuis le dernier pas */
  foulee: number;
  /** Images passées en l'air (pour la force de l'atterrissage) */
  tempsAir: number;
};

export type Evenement =
  | { sorte: "pas" | "saut" | "sautMural" | "plouf" | "sortieEau" | "brasse"; x: number; y: number }
  | { sorte: "atterrit"; x: number; y: number; force: number }
  | { sorte: "lanterne"; x: number; y: number; numero: number }
  | { sorte: "coeur"; x: number; y: number };

export type Monde = {
  mine: Mine;
  heros: Heros;
  allumees: boolean[];
  /** Le Cœur est rallumé : le voyage est fini */
  fini: boolean;
  salle: number;
  temps: number;
  evenements: Evenement[];
};

export function creerMonde(mine: Mine): Monde {
  const x = mine.depart.col * CASE + (CASE - LARGEUR_HEROS) / 2;
  const y = (mine.depart.ligne + 1) * CASE - HAUTEUR_HEROS;
  return {
    mine,
    heros: {
      x,
      y,
      l: LARGEUR_HEROS,
      h: HAUTEUR_HEROS,
      restX: 0,
      restY: 0,
      vx: 0,
      vy: 0,
      regard: 1,
      auSol: false,
      coyote: 0,
      tampon: 0,
      sautTenu: false,
      sautAvant: false,
      mur: 0,
      tempsMur: 0,
      coyoteMur: 0,
      coteMur: 1,
      verrou: 0,
      dansEau: false,
      surface: false,
      traverse: 0,
      foulee: 0,
      tempsAir: 0,
    },
    allumees: mine.lanternes.map(() => false),
    fini: false,
    salle: salleEn(mine, x, y),
    temps: 0,
    evenements: [],
  };
}

export function copierMonde(m: Monde): Monde {
  return { ...m, heros: { ...m.heros }, allumees: [...m.allumees], evenements: [] };
}

export function terrain(mine: Mine): Terrain {
  return {
    solide(x, y, l, h) {
      const c0 = Math.floor(x / CASE);
      const c1 = Math.floor((x + l - 1) / CASE);
      const l0 = Math.floor(y / CASE);
      const l1 = Math.floor((y + h - 1) / CASE);
      for (let li = l0; li <= l1; li++) for (let c = c0; c <= c1; c++) if (caseEn(mine, c, li) === ROCHE) return true;
      return false;
    },
    dessusTraversable(x, y, l) {
      if (y % CASE !== 0) return false;
      const li = y / CASE;
      for (let c = Math.floor(x / CASE); c <= Math.floor((x + l - 1) / CASE); c++) if (caseEn(mine, c, li) === PLANCHE) return true;
      return false;
    },
  };
}

const terrains = new WeakMap<Mine, Terrain>();
function terrainDe(mine: Mine) {
  let t = terrains.get(mine);
  if (!t) terrains.set(mine, (t = terrain(mine)));
  return t;
}

function eauAuPoint(mine: Mine, x: number, y: number) {
  return eauEn(mine, Math.floor(x / CASE), Math.floor(y / CASE));
}

function rapprocher(v: number, cible: number, pas: number) {
  return v < cible ? Math.min(v + pas, cible) : Math.max(v - pas, cible);
}

export function etape(m: Monde, c: Commandes) {
  m.evenements.length = 0;
  m.temps++;
  if (m.fini) return;
  const h = m.heros;
  const t = terrainDe(m.mine);
  const centreX = h.x + h.l / 2;
  const ev = (sorte: "pas" | "saut" | "sautMural" | "plouf" | "sortieEau" | "brasse") =>
    m.evenements.push({ sorte, x: centreX, y: h.y + h.h });

  const appui = c.saut && !h.sautAvant;
  h.sautAvant = c.saut;
  if (appui) h.tampon = R.tampon;
  else if (h.tampon > 0) h.tampon--;
  const dir = (c.droite ? 1 : 0) - (c.gauche ? 1 : 0);
  if (dir && h.verrou <= 0) h.regard = dir > 0 ? 1 : -1;

  // L'eau : on y entre quand le milieu du corps est mouillé
  const dansEau = eauAuPoint(m.mine, centreX, h.y + h.h * 0.55);
  if (dansEau && !h.dansEau && h.vy > 1.5) ev("plouf");
  if (!dansEau && h.dansEau && h.vy < -1) ev("sortieEau");
  h.dansEau = dansEau;
  h.surface = dansEau && !eauAuPoint(m.mine, centreX, h.y + 3);

  if (dansEau) {
    const N = R.nage;
    h.mur = 0;
    h.verrou = 0;
    h.vx = rapprocher(h.vx, dir * N.vitesse, N.accel);
    // En train de jaillir hors de l'eau : on laisse l'élan intact
    const jaillit = h.sautTenu && h.vy < -3;
    if (!jaillit) {
      h.vy += N.gravite;
      if (!h.surface) h.vy -= N.flottaison;
      if (c.bas) h.vy += N.plongee + (h.surface ? N.flottaison : 0);
      h.vy *= 0.95;
      h.vy = Math.max(-N.vitesseMaxY, Math.min(N.vitesseMaxY, h.vy));
    }
    if (h.tampon > 0) {
      h.tampon = 0;
      if (h.surface) {
        h.vy = -N.sortie;
        h.sautTenu = true;
        ev("saut");
      } else {
        h.vy = Math.min(h.vy, -N.brasse);
        ev("brasse");
      }
    }
    h.coyote = 0;
  } else {
    // Au sol et en l'air
    if (h.verrou > 0) h.verrou--;
    else h.vx = rapprocher(h.vx, dir * R.vitesse, h.auSol ? R.accelSol : R.accelAir);

    if (h.tampon > 0 && (h.auSol || h.coyote > 0)) {
      h.vy = -R.saut;
      h.auSol = false;
      h.coyote = 0;
      h.tampon = 0;
      h.sautTenu = true;
      ev("saut");
    } else if (h.tampon > 0 && !h.auSol && (h.mur !== 0 || h.coyoteMur > 0)) {
      const cote = h.mur !== 0 ? h.mur : h.coteMur;
      h.vy = -R.sautMural;
      h.vx = -cote * R.pousseeMurale;
      h.regard = cote > 0 ? -1 : 1;
      h.verrou = R.verrouMural;
      h.tampon = 0;
      h.coyoteMur = 0;
      h.mur = 0;
      h.sautTenu = true;
      ev("sautMural");
    }

    if (h.sautTenu && !c.saut && h.vy < 0) {
      h.vy *= R.coupeSaut;
      h.sautTenu = false;
    }
    if (h.vy >= 0) h.sautTenu = false;

    // Un peu plus de flottement au sommet du saut
    const sommet = h.sautTenu && Math.abs(h.vy) < 1.2;
    h.vy = Math.min(h.vy + R.gravite * (sommet ? 0.55 : 1), R.chuteMax);

    // Glisser contre une paroi en appuyant vers elle
    const paroi = !h.auSol && dir !== 0 && h.verrou <= 0 && t.solide(h.x + dir, h.y + 4, h.l, h.h - 8);
    if (paroi && h.vy > 0) {
      if (h.mur !== dir) h.tempsMur = 0;
      h.mur = dir as -1 | 1;
      h.tempsMur++;
      h.vy = Math.min(h.vy, R.glisseMur);
      h.coteMur = h.mur;
      h.coyoteMur = 6;
    } else {
      if (h.mur !== 0) h.coteMur = h.mur;
      h.mur = 0;
      h.tempsMur = 0;
      if (h.coyoteMur > 0) h.coyoteMur--;
    }
  }

  // Descendre d'une planche
  const surPlanche = h.auSol && !t.solide(h.x, h.y + 1, h.l, h.h) && t.dessusTraversable(h.x, h.y + h.h, h.l);
  if (surPlanche && c.bas && !dansEau) h.traverse = 10;
  if (h.traverse > 0) h.traverse--;

  const avantX = h.x;
  if (deplacerX(h, h.vx, t)) h.vx = 0;
  const vyAvant = h.vy;
  if (deplacerY(h, h.vy, t, h.traverse > 0)) {
    if (h.vy > 0 && !h.auSol && !dansEau) {
      m.evenements.push({ sorte: "atterrit", x: h.x + h.l / 2, y: h.y + h.h, force: Math.min(1, vyAvant / R.chuteMax) * Math.min(1, h.tempsAir / 30) });
    }
    h.vy = 0;
  }
  const etaitAuSol = h.auSol;
  h.auSol = estPose(h, t, h.traverse > 0) && h.vy >= 0;
  if (h.auSol) {
    h.coyote = R.coyote;
    h.tempsAir = 0;
    h.mur = 0;
    h.coyoteMur = 0;
    if (!dansEau) {
      h.foulee += Math.abs(h.x - avantX);
      if (h.foulee > 15) {
        h.foulee = 0;
        ev("pas");
      }
    }
  } else {
    if (etaitAuSol && h.vy >= 0 && h.coyote === R.coyote) h.coyote = R.coyote - 1;
    else if (h.coyote > 0) h.coyote--;
    h.tempsAir++;
    h.foulee = 10;
  }

  // Les lanternes et le Cœur
  const cx = h.x + h.l / 2;
  const cy = h.y + h.h / 2;
  m.mine.lanternes.forEach((l, i) => {
    if (m.allumees[i]) return;
    if (Math.hypot(cx - (l.col + 0.5) * CASE, cy - (l.ligne + 0.5) * CASE) < PORTEE_LANTERNE) {
      m.allumees[i] = true;
      m.evenements.push({ sorte: "lanterne", x: (l.col + 0.5) * CASE, y: (l.ligne + 0.5) * CASE, numero: i });
    }
  });
  const co = m.mine.coeur;
  if (Math.hypot(cx - (co.col + 0.5) * CASE, cy - (co.ligne + 0.5) * CASE) < PORTEE_COEUR) {
    m.fini = true;
    m.evenements.push({ sorte: "coeur", x: (co.col + 0.5) * CASE, y: (co.ligne + 0.5) * CASE });
  }

  const s = salleEn(m.mine, cx, cy);
  if (s >= 0) m.salle = s;
}
