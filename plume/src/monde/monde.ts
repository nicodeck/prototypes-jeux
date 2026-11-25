// Le monde du jeu : son état, et ce qui se passe à chaque image.
// Ce fichier ne dessine rien et ne joue aucun son : il peut tourner sans navigateur, dans les tests.
import { REGLAGES as R } from "../reglages";
import { CASE, T, type NiveauLu } from "./niveau";
import { chevauche, deplacerX, deplacerY, estPose, type Corps, type Terrain } from "./physique";

export type Commandes = { gauche: boolean; droite: boolean; bas: boolean; saut: boolean; course: boolean };
export const AUCUNE_COMMANDE: Commandes = { gauche: false, droite: false, bas: false, saut: false, course: false };

export type Heros = Corps & {
  vx: number;
  vy: number;
  regard: 1 | -1;
  auSol: boolean;
  toleranceBord: number;
  memoireSaut: number;
  sautEnCours: boolean;
  plume: boolean;
  doubleSautFait: boolean;
  traverse: number;
  invincible: number;
  /** 0 tant qu'il est en vie, puis le nombre d'images depuis sa chute. */
  mort: number;
  sautAvant: boolean;
  basAvant: boolean;
};

export type SorteEnnemi = "limace" | "bogue" | "grenouille" | "guepe";
export type Ennemi = Corps & {
  id: string;
  sorte: SorteEnnemi;
  vx: number;
  vy: number;
  sens: 1 | -1;
  etat: "vivant" | "ecrase" | "ejecte";
  minuteur: number;
  origineX: number;
  origineY: number;
  reveille: boolean;
};

export type Objet = Corps & {
  id: string;
  sorte: "graine" | "oeuf" | "plume";
  vx: number;
  vy: number;
  /** Une plume sortie d'un bloc descend doucement en se balançant. */
  flotte: boolean;
  minuteur: number;
};

export type Plateforme = {
  id: string;
  sorte: "horizontale" | "verticale" | "nuage";
  x: number;
  y: number;
  l: number;
  h: number;
  origineX: number;
  origineY: number;
  etat: "stable" | "tremble" | "disparu";
  minuteur: number;
};

export type Ressort = { x: number; y: number; l: number; h: number; compression: number };
export type Drapeau = { id: string; x: number; y: number; leve: boolean };

export type Evenement =
  | { sorte: "saut" | "doubleSaut" | "atterrissage" | "mort" | "perdPlume" | "victoire" | "ressort" | "nuage" }
  | { sorte: "graine" | "oeuf" | "plume" | "ecrase" | "ejecte" | "brique" | "bloc" | "drapeau"; x: number; y: number };

export type Stats = { graines: number; grainesTotal: number; oeufs: number; oeufsTotal: number; chutes: number; temps: number };

export type Monde = {
  niveau: NiveauLu;
  cases: Uint8Array;
  temps: number;
  heros: Heros;
  ennemis: Ennemi[];
  objets: Objet[];
  plateformes: Plateforme[];
  ressorts: Ressort[];
  drapeaux: Drapeau[];
  arrivee: { x: number; y: number; l: number; h: number };
  reprise: { x: number; y: number };
  /** Ce qui a été ramassé ou cassé pour de bon : ça ne revient pas après une chute. */
  definitif: Set<string>;
  stats: Stats;
  gagne: boolean;
  evenements: Evenement[];
  /** Pour l'affichage : les blocs qui viennent d'être frappés (index de case → images restantes). */
  blocsSecoues: Map<number, number>;
};

export const PERIODE_PLATEFORME = 240;
const LARGEUR_HEROS = 10;
const HAUTEUR_HEROS = 13;

// ——— Création ———

export function creerMonde(niveau: NiveauLu): Monde {
  const depart = niveau.apparitions.find((a) => a.lettre === "S");
  const reprise = depart
    ? { x: depart.colonne * T + (T - LARGEUR_HEROS) / 2, y: (depart.ligne + 1) * T - HAUTEUR_HEROS }
    : { x: 32, y: 32 };
  const monde: Monde = {
    niveau,
    cases: niveau.cases.slice(),
    temps: 0,
    heros: nouveauHeros(reprise.x, reprise.y),
    ennemis: [],
    objets: [],
    plateformes: [],
    ressorts: [],
    drapeaux: [],
    arrivee: { x: 0, y: 0, l: 0, h: 0 },
    reprise,
    definitif: new Set(),
    stats: { graines: 0, grainesTotal: 0, oeufs: 0, oeufsTotal: 0, chutes: 0, temps: 0 },
    gagne: false,
    evenements: [],
    blocsSecoues: new Map(),
  };
  for (const contenu of niveau.contenus.values()) if (contenu === "graine") monde.stats.grainesTotal++;
  for (const a of niveau.apparitions) {
    if (a.lettre === "o") monde.stats.grainesTotal++;
    if (a.lettre === "O") monde.stats.oeufsTotal++;
  }
  peupler(monde);
  return monde;
}

function nouveauHeros(x: number, y: number): Heros {
  return {
    x, y, l: LARGEUR_HEROS, h: HAUTEUR_HEROS, restX: 0, restY: 0, vx: 0, vy: 0, regard: 1, auSol: true,
    toleranceBord: 0, memoireSaut: 0, sautEnCours: false, plume: false, doubleSautFait: false, traverse: 0,
    invincible: 0, mort: 0, sautAvant: false, basAvant: false,
  };
}

/** Place les ennemis, objets et plateformes ; appelé au début et après chaque chute. */
function peupler(m: Monde) {
  m.ennemis = [];
  m.objets = m.objets.filter((o) => o.sorte === "plume" && !o.flotte); // une plume posée reste là
  m.plateformes = [];
  m.ressorts = [];
  const dejaVus = new Set<string>();
  for (const a of m.niveau.apparitions) {
    const id = `${a.lettre}${a.colonne},${a.ligne}`;
    const x = a.colonne * T;
    const y = a.ligne * T;
    switch (a.lettre) {
      case "l": case "b": case "g": case "w": {
        const sorte = ({ l: "limace", b: "bogue", g: "grenouille", w: "guepe" } as const)[a.lettre];
        const taille = { limace: [14, 10], bogue: [12, 12], grenouille: [12, 10], guepe: [12, 10] }[sorte];
        m.ennemis.push({
          id, sorte, x: x + (T - taille[0]) / 2, y: y + T - taille[1], l: taille[0], h: taille[1], restX: 0, restY: 0,
          vx: 0, vy: 0, sens: -1, etat: "vivant", minuteur: a.colonne * 7, origineX: x + 2, origineY: y + 3, reveille: false,
        });
        break;
      }
      case "o": case "O":
        if (!m.definitif.has(id)) {
          m.objets.push({ id, sorte: a.lettre === "o" ? "graine" : "oeuf", x: x + 3, y: y + 3, l: 10, h: 10, restX: 0, restY: 0, vx: 0, vy: 0, flotte: false, minuteur: 0 });
        }
        break;
      case "h": case "v":
        m.plateformes.push({ id, sorte: a.lettre === "h" ? "horizontale" : "verticale", x, y, l: 3 * T, h: 6, origineX: x, origineY: y, etat: "stable", minuteur: 0 });
        break;
      case "c": {
        // Des « c » côte à côte forment un seul nuage
        if (dejaVus.has(id)) break;
        let longueur = 1;
        while (m.niveau.apparitions.some((b) => b.lettre === "c" && b.ligne === a.ligne && b.colonne === a.colonne + longueur)) {
          dejaVus.add(`c${a.colonne + longueur},${a.ligne}`);
          longueur++;
        }
        m.plateformes.push({ id, sorte: "nuage", x, y, l: longueur * T, h: 8, origineX: x, origineY: y, etat: "stable", minuteur: 0 });
        break;
      }
      case "R":
        m.ressorts.push({ x: x + 1, y: y + 8, l: 14, h: 8, compression: 0 });
        break;
      case "F":
        if (!m.drapeaux.some((d) => d.id === id)) m.drapeaux.push({ id, x, y: y - T, leve: false });
        break;
      case "G":
        m.arrivee = { x: x - 4, y: y - 2 * T, l: 3 * T, h: 3 * T };
        break;
    }
  }
}

/** Une copie du monde qu'on peut faire évoluer sans toucher à l'original (pour le solveur). */
export function copierMonde(m: Monde): Monde {
  return {
    ...m,
    cases: m.cases.slice(),
    heros: { ...m.heros },
    ennemis: m.ennemis.map((e) => ({ ...e })),
    objets: m.objets.map((o) => ({ ...o })),
    plateformes: m.plateformes.map((p) => ({ ...p })),
    ressorts: m.ressorts.map((r) => ({ ...r })),
    drapeaux: m.drapeaux.map((d) => ({ ...d })),
    reprise: { ...m.reprise },
    definitif: new Set(m.definitif),
    stats: { ...m.stats },
    evenements: [],
    blocsSecoues: new Map(m.blocsSecoues),
  };
}

// ——— Le décor solide ———

export function caseEn(m: Monde, colonne: number, ligne: number): number {
  if (colonne < 0 || colonne >= m.niveau.largeur) return CASE.pierre; // des murs invisibles aux bords
  if (ligne < 0 || ligne >= m.niveau.hauteur) return CASE.vide;
  return m.cases[ligne * m.niveau.largeur + colonne];
}

export function estSolide(c: number) {
  return c === CASE.sol || c === CASE.pierre || c === CASE.brique || c === CASE.mystere || c === CASE.utilise;
}

export function terrain(m: Monde, ignorer?: Plateforme): Terrain {
  return {
    solide(x, y, l, h) {
      const c0 = Math.floor(x / T), c1 = Math.floor((x + l - 1) / T);
      const l0 = Math.floor(y / T), l1 = Math.floor((y + h - 1) / T);
      for (let ligne = l0; ligne <= l1; ligne++) {
        for (let colonne = c0; colonne <= c1; colonne++) if (estSolide(caseEn(m, colonne, ligne))) return true;
      }
      return false;
    },
    dessusTraversable(x, y, l) {
      if (y % T === 0) {
        const ligne = y / T;
        for (let colonne = Math.floor(x / T); colonne <= Math.floor((x + l - 1) / T); colonne++) {
          if (caseEn(m, colonne, ligne) === CASE.passerelle) return true;
        }
      }
      for (const p of m.plateformes) {
        if (p === ignorer || p.etat === "disparu") continue;
        if (p.y === y && x < p.x + p.l && x + l > p.x) return true;
      }
      return false;
    },
  };
}

// ——— Une image ———

export function etape(m: Monde, c: Commandes) {
  m.evenements = [];
  m.temps++;
  if (!m.gagne && m.heros.mort === 0) m.stats.temps++;
  for (const [i, n] of m.blocsSecoues) n <= 1 ? m.blocsSecoues.delete(i) : m.blocsSecoues.set(i, n - 1);

  if (m.heros.mort > 0) {
    animerMort(m);
    return;
  }
  bougerPlateformes(m);
  if (!m.gagne) bougerHeros(m, c);
  else m.heros.vx = 0;
  bougerEnnemis(m);
  bougerObjets(m);
  if (!m.gagne) interactions(m, c);
}

function bougerPlateformes(m: Monde) {
  const h = m.heros;
  for (const p of m.plateformes) {
    const porte = h.mort === 0 && h.vy >= 0 && h.traverse === 0 && h.y + h.h === p.y && h.x < p.x + p.l && h.x + h.l > p.x && p.etat !== "disparu";
    if (p.sorte === "nuage") {
      if (p.etat === "stable" && porte) {
        p.etat = "tremble";
        p.minuteur = 36;
        m.evenements.push({ sorte: "nuage" });
      } else if (p.etat === "tremble" && --p.minuteur <= 0) {
        p.etat = "disparu";
        p.minuteur = 150;
      } else if (p.etat === "disparu" && --p.minuteur <= 0 && !chevauche(h, p)) {
        p.etat = "stable";
      }
      continue;
    }
    // Les plateformes mobiles suivent une sinusoïde, au pixel près
    const angle = ((m.temps + p.origineX / 2) / PERIODE_PLATEFORME) * Math.PI * 2;
    const decalage = Math.round(Math.sin(angle) * (p.sorte === "horizontale" ? 3 * T : 2.5 * T));
    const cibleX = p.sorte === "horizontale" ? p.origineX + decalage : p.origineX;
    const cibleY = p.sorte === "verticale" ? p.origineY + decalage : p.origineY;
    const dx = cibleX - p.x;
    const dy = cibleY - p.y;
    // Une plateforme qui monte soulève le héros dont les pieds se trouvent sur son passage
    const souleve =
      !porte && dy < 0 && h.mort === 0 && h.vy >= 0 && h.traverse === 0 && h.x < p.x + p.l && h.x + h.l > p.x &&
      h.y + h.h > cibleY && h.y + h.h <= p.y;
    if (souleve) deplacerY(h, cibleY - (h.y + h.h), terrain(m, p));
    // Le passager bouge d'abord (la plateforme est ignorée pendant ce temps), puis la plateforme
    if (porte) {
      const t = terrain(m, p);
      if (dx) deplacerX(h, dx, t);
      if (dy) deplacerY(h, dy, t);
    }
    p.x = cibleX;
    p.y = cibleY;
  }
}

function bougerHeros(m: Monde, c: Commandes) {
  const h = m.heros;
  const t = terrain(m);
  const sautPresse = c.saut && !h.sautAvant;
  const basPresse = c.bas && !h.basAvant;
  h.sautAvant = c.saut;
  h.basAvant = c.bas;
  if (h.traverse > 0) h.traverse--;
  if (h.invincible > 0) h.invincible--;

  // — Courir
  const direction = (c.droite ? 1 : 0) - (c.gauche ? 1 : 0);
  const max = c.course ? R.courseMax : R.marcheMax;
  if (direction !== 0) {
    h.regard = direction as 1 | -1;
    if (h.vx * direction < 0) h.vx += direction * R.demiTour;
    else if (Math.abs(h.vx) < max) h.vx = Math.min(Math.abs(h.vx) + R.acceleration, max) * direction;
    else h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx) - max, h.auSol ? R.freinageSol : R.freinageAir);
  } else {
    const freinage = h.auSol ? R.freinageSol : R.freinageAir;
    h.vx = Math.abs(h.vx) <= freinage ? 0 : h.vx - Math.sign(h.vx) * freinage;
  }

  // — Sauter
  h.toleranceBord = h.auSol ? R.toleranceBord : Math.max(0, h.toleranceBord - 1);
  h.memoireSaut = sautPresse ? R.memoireSaut : Math.max(0, h.memoireSaut - 1);
  if (h.auSol) h.doubleSautFait = false;
  if (h.memoireSaut > 0 && h.toleranceBord > 0) {
    h.vy = -R.forceSaut;
    h.sautEnCours = true;
    h.memoireSaut = 0;
    h.toleranceBord = 0;
    m.evenements.push({ sorte: "saut" });
  } else if (sautPresse && !h.auSol && h.plume && !h.doubleSautFait) {
    h.vy = -R.forceDoubleSaut;
    h.sautEnCours = true;
    h.doubleSautFait = true;
    h.memoireSaut = 0;
    m.evenements.push({ sorte: "doubleSaut" });
  }

  // Lâcher le bouton en montant plafonne la montée : petit appui, petit saut
  if (h.sautEnCours && !c.saut && h.vy < -R.monteeSiOnLache) h.vy = -R.monteeSiOnLache;
  if (h.vy >= 0) h.sautEnCours = false;
  const gravite = h.sautEnCours && c.saut ? R.graviteMontee : R.graviteChute;
  h.vy = Math.min(h.vy + gravite, R.chuteMax);

  // — Descendre d'une passerelle
  if (basPresse && h.auSol && !t.solide(h.x, h.y + 1, h.l, h.h)) h.traverse = 8;

  // — Avancer
  if (deplacerX(h, h.vx, t)) h.vx = 0;
  const vyAvant = h.vy;
  if (deplacerY(h, h.vy, t, h.traverse > 0)) {
    if (vyAvant < 0) frapperPlafond(m);
    h.vy = 0;
    h.sautEnCours = false;
  }
  const etaitAuSol = h.auSol;
  h.auSol = estPose(h, t, h.traverse > 0);
  if (h.auSol && !etaitAuSol && vyAvant > 2) m.evenements.push({ sorte: "atterrissage" });
  if (h.auSol && h.vy > 0) h.vy = 0;
}

/** Un coup de tête dans le plafond : on frappe le bloc qui est au-dessus du centre du héros. */
function frapperPlafond(m: Monde) {
  const h = m.heros;
  const ligne = Math.floor((h.y - 1) / T);
  const centre = Math.floor((h.x + h.l / 2) / T);
  const gauche = Math.floor(h.x / T);
  const droite = Math.floor((h.x + h.l - 1) / T);
  const candidates = [centre, gauche, droite].filter((col) => estSolide(caseEn(m, col, ligne)));
  if (!candidates.length) return;
  const colonne = candidates[0];
  const i = ligne * m.niveau.largeur + colonne;
  const sorte = m.cases[i];
  const x = colonne * T;
  const y = ligne * T;
  if (sorte === CASE.brique) {
    m.cases[i] = CASE.vide;
    m.definitif.add(`case${i}`);
    m.evenements.push({ sorte: "brique", x, y });
  } else if (sorte === CASE.mystere) {
    m.cases[i] = CASE.utilise;
    m.definitif.add(`case${i}`);
    m.blocsSecoues.set(i, 8);
    const contenu = m.niveau.contenus.get(i);
    if (contenu === "plume") {
      m.objets.push({ id: `plume${i}`, sorte: "plume", x: x + 2, y: y - 14, l: 12, h: 12, restX: 0, restY: 0, vx: 0, vy: -1.5, flotte: true, minuteur: 0 });
      m.evenements.push({ sorte: "bloc", x, y });
    } else {
      m.stats.graines++;
      m.evenements.push({ sorte: "graine", x: x + 8, y: y - 8 });
    }
  } else {
    m.evenements.push({ sorte: "bloc", x, y });
    return;
  }
  // Un ennemi posé sur le bloc frappé est éjecté
  for (const e of m.ennemis) {
    if (e.etat === "vivant" && e.y + e.h === y && e.x < x + T && e.x + e.l > x) ejecter(m, e, x + T / 2);
  }
}

function bougerEnnemis(m: Monde) {
  const t = terrain(m);
  const h = m.heros;
  for (const e of m.ennemis) {
    if (e.etat === "ecrase") {
      e.minuteur--;
      continue;
    }
    if (e.etat === "ejecte") {
      e.vy = Math.min(e.vy + R.graviteChute, R.chuteMax);
      e.x += e.vx;
      e.y += e.vy;
      continue;
    }
    // Un ennemi ne se réveille que quand il arrive près de l'écran
    if (!e.reveille) {
      if (Math.abs(e.x - h.x) > 220) continue;
      e.reveille = true;
    }
    e.minuteur++;
    if (e.sorte === "guepe") {
      e.x = Math.round(e.origineX + Math.sin(e.minuteur / 50) * 40);
      e.y = Math.round(e.origineY + Math.sin(e.minuteur / 13) * 6);
      e.sens = Math.cos(e.minuteur / 50) >= 0 ? 1 : -1;
      continue;
    }
    const pose = estPose(e, t);
    if (e.sorte === "grenouille") {
      if (pose) {
        e.vx = 0;
        if (e.minuteur % 100 === 0) {
          e.sens = h.x < e.x ? -1 : 1;
          e.vx = e.sens * 1.1;
          e.vy = -5.2;
        }
      }
    } else {
      // Limaces et bogues : demi-tour contre un mur ou au bord du vide
      const vitesse = e.sorte === "limace" ? 0.4 : 0.3;
      if (pose) {
        const devant = e.sens > 0 ? e.x + e.l : e.x - 1;
        if (!t.solide(devant, e.y + e.h, 1, 1) && !t.dessusTraversable(devant, e.y + e.h, 1)) e.sens = (-e.sens) as 1 | -1;
      }
      e.vx = e.sens * vitesse;
    }
    if (deplacerX(e, e.vx, t)) {
      e.sens = (-e.sens) as 1 | -1;
      if (e.sorte === "grenouille") e.vx = 0;
    }
    e.vy = Math.min(e.vy + R.graviteChute * (e.sorte === "grenouille" ? 0.6 : 1), R.chuteMax);
    if (deplacerY(e, e.vy, t)) e.vy = 0;
  }
  const garde = (e: Ennemi) => !(e.etat === "ecrase" && e.minuteur <= 0) && e.y < m.niveau.hauteur * T + 64;
  if (!m.ennemis.every(garde)) m.ennemis = m.ennemis.filter(garde);
}

function bougerObjets(m: Monde) {
  const t = terrain(m);
  for (const o of m.objets) {
    o.minuteur++;
    if (o.sorte !== "plume") continue;
    if (!o.flotte) {
      // Si ce qui la portait disparaît, elle se remet à descendre
      if (!estPose(o, t)) o.flotte = true;
      continue;
    }
    // La plume monte un peu, puis descend en se balançant comme une feuille
    if (o.vy < 0) {
      o.vy += 0.08;
      deplacerY(o, o.vy, t);
    } else {
      deplacerX(o, Math.sin(o.minuteur / 18) * 0.9, t);
      if (deplacerY(o, 0.45, t)) o.flotte = false;
    }
  }
  if (m.objets.some((o) => o.y > m.niveau.hauteur * T + 32)) m.objets = m.objets.filter((o) => o.y < m.niveau.hauteur * T + 32);
}

function interactions(m: Monde, c: Commandes) {
  const h = m.heros;

  // Ennemis : on les écrase en tombant dessus, sinon on est touché
  for (const e of m.ennemis) {
    if (e.etat !== "vivant" || !chevauche(h, e)) continue;
    const venaitDuDessus = h.vy > 0 && h.y + h.h - h.vy <= e.y + 3;
    if (venaitDuDessus && e.sorte !== "bogue") {
      e.etat = "ecrase";
      e.minuteur = 24;
      h.vy = -(c.saut ? R.rebondEnnemiAppuye : R.rebondEnnemi);
      h.sautEnCours = c.saut;
      m.evenements.push({ sorte: "ecrase", x: e.x + e.l / 2, y: e.y });
      if (e.sorte === "guepe") ejecter(m, e, h.x);
    } else {
      toucher(m, e.x + e.l / 2);
    }
  }

  // Objets
  for (const o of m.objets) {
    if (!chevauche(h, o)) continue;
    o.y = 1e9; // retiré au prochain tri
    m.definitif.add(o.id);
    if (o.sorte === "graine") m.stats.graines++;
    if (o.sorte === "oeuf") m.stats.oeufs++;
    if (o.sorte === "plume") h.plume = true;
    m.evenements.push({ sorte: o.sorte, x: o.x + o.l / 2, y: o.y });
  }

  // Ressorts : on rebondit si on arrive dessus par le haut
  for (const r of m.ressorts) {
    if (r.compression > 0) r.compression--;
    const auDessus = h.x < r.x + r.l && h.x + h.l > r.x;
    const pieds = h.y + h.h;
    if (auDessus && h.vy > 0 && pieds >= r.y && pieds - h.vy <= r.y + 1) {
      h.y = r.y - h.h;
      h.restY = 0;
      h.vy = -R.forceRessort;
      h.sautEnCours = true;
      r.compression = 10;
      m.evenements.push({ sorte: "ressort" });
    }
  }

  // Pics : la moitié basse de la case pique
  const l0 = Math.floor(h.y / T), l1 = Math.floor((h.y + h.h - 1) / T);
  for (let ligne = l0; ligne <= l1; ligne++) {
    for (let col = Math.floor(h.x / T); col <= Math.floor((h.x + h.l - 1) / T); col++) {
      if (caseEn(m, col, ligne) === CASE.pics && chevauche(h, { x: col * T + 2, y: ligne * T + 9, l: T - 4, h: 7 })) {
        toucher(m, h.x + h.l / 2 - h.regard);
      }
    }
  }

  // Drapeaux de reprise
  for (const d of m.drapeaux) {
    if (!d.leve && chevauche(h, { x: d.x, y: d.y, l: T, h: 2 * T })) {
      d.leve = true;
      m.reprise = { x: d.x + 3, y: d.y + 2 * T - h.h };
      m.evenements.push({ sorte: "drapeau", x: d.x + 8, y: d.y });
    }
  }

  // Le nid d'arrivée
  if (chevauche(h, m.arrivee)) {
    m.gagne = true;
    m.evenements.push({ sorte: "victoire" });
  }

  // Tomber dans un trou
  if (h.y > m.niveau.hauteur * T) mourir(m, false);
}

function ejecter(m: Monde, e: Ennemi, depuisX: number) {
  e.etat = "ejecte";
  e.vx = e.x + e.l / 2 < depuisX ? -1 : 1;
  e.vy = -4;
  m.evenements.push({ sorte: "ejecte", x: e.x + e.l / 2, y: e.y });
}

function toucher(m: Monde, depuisX: number) {
  const h = m.heros;
  if (h.invincible > 0 || h.mort > 0) return;
  if (h.plume) {
    h.plume = false;
    h.invincible = R.invincibilite;
    h.vy = -3.5;
    h.vx = h.x + h.l / 2 < depuisX ? -1.5 : 1.5;
    h.sautEnCours = false;
    m.evenements.push({ sorte: "perdPlume" });
  } else {
    mourir(m, true);
  }
}

function mourir(m: Monde, avecSaut: boolean) {
  const h = m.heros;
  if (h.mort > 0) return;
  h.mort = 1;
  h.vx = 0;
  h.vy = avecSaut ? -5 : 0;
  m.stats.chutes++;
  m.evenements.push({ sorte: "mort" });
}

function animerMort(m: Monde) {
  const h = m.heros;
  h.mort++;
  if (h.mort > 20) {
    h.vy = Math.min(h.vy + 0.3, 6);
    h.y += h.vy;
  }
  if (h.mort > 110) {
    // On repart du dernier drapeau ; ce qui a été ramassé ou cassé le reste
    Object.assign(h, nouveauHeros(m.reprise.x, m.reprise.y));
    h.invincible = 40;
    peupler(m);
  }
}
