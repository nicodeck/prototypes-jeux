// Dessine le monde : décor, personnages, effets, et l'affichage du haut de l'écran.
import { CASE, T } from "../monde/niveau";
import { caseEn, type Evenement, type Monde } from "../monde/monde";
import { dessiner, ecrire, HAUTEUR, image, LARGEUR } from "../moteur/ecran";
import { PALETTE } from "./palette";
import * as D from "./dessins";

// ——— La caméra ———

export type Camera = { x: number; y: number; avance: number; secousse: number };

export function nouvelleCamera(m: Monde): Camera {
  const c = { x: 0, y: 0, avance: 0, secousse: 0 };
  suivre(c, m, true);
  return c;
}

export function suivre(c: Camera, m: Monde, immediat = false) {
  const h = m.heros;
  const maxX = m.niveau.largeur * T - LARGEUR;
  const maxY = m.niveau.hauteur * T - HAUTEUR;
  // On regarde un peu devant soi, du côté où l'on court
  const avanceVoulue = Math.abs(h.vx) > 0.5 ? h.regard * 28 : c.avance;
  c.avance += (avanceVoulue - c.avance) * 0.04;
  const cibleX = h.x + h.l / 2 - LARGEUR / 2 + c.avance;
  // Verticalement : on suit le héros quand il se pose, ou quand il sort d'une bande au milieu de l'écran
  let cibleY = c.y;
  const ecranY = h.y - c.y;
  if (h.auSol || h.mort > 0) cibleY = h.y - 112;
  else if (ecranY < 40) cibleY = h.y - 40;
  else if (ecranY > 130) cibleY = h.y - 130;
  const k = immediat ? 1 : 0.12;
  c.x = Math.max(0, Math.min(maxX, c.x + (cibleX - c.x) * k));
  c.y = Math.max(0, Math.min(maxY, c.y + (cibleY - c.y) * (immediat ? 1 : 0.08)));
  if (c.secousse > 0) c.secousse--;
}

// ——— Les particules ———

type Particule = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  couleur: string;
  taille: number;
  gravite: number;
  dessin?: D.Dessin;
};
const particules: Particule[] = [];

function jaillir(n: number, x: number, y: number, couleurs: string[], o: Partial<Particule> & { force?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const force = (o.force ?? 1.2) * (0.4 + Math.random() * 0.8);
    particules.push({
      x, y,
      vx: Math.cos(angle) * force + (o.vx ?? 0),
      vy: Math.sin(angle) * force + (o.vy ?? 0),
      vie: o.vie ?? 20 + Math.random() * 20,
      couleur: couleurs[i % couleurs.length],
      taille: o.taille ?? 1,
      gravite: o.gravite ?? 0.05,
    });
  }
}

export function viderParticules() {
  particules.length = 0;
}

/** Transforme ce qui vient de se passer dans le monde en effets visuels. */
export function reagir(evenements: Evenement[], m: Monde, camera: Camera) {
  const h = m.heros;
  const pieds = { x: h.x + h.l / 2, y: h.y + h.h };
  for (const e of evenements) {
    switch (e.sorte) {
      case "saut":
      case "atterrissage":
        jaillir(5, pieds.x, pieds.y - 1, [PALETTE.B, PALETTE.g], { vy: -0.4, gravite: 0, vie: 14, force: 0.7 });
        break;
      case "doubleSaut":
        jaillir(8, pieds.x, pieds.y, [PALETTE.B, PALETTE.c], { vy: 0.5, gravite: 0, vie: 18 });
        break;
      case "graine":
        if (e.y < h.y - 4) particules.push({ x: e.x - 8, y: e.y - 8, vx: 0, vy: -3, vie: 24, couleur: "", taille: 0, gravite: 0.25, dessin: D.GRAINE[0] });
        jaillir(6, e.x, e.y, [PALETTE.J, PALETTE.B], { gravite: 0, vie: 16 });
        break;
      case "oeuf":
        jaillir(30, e.x, e.y, [PALETTE.J, PALETTE.B, PALETTE.O], { force: 2.2, vie: 40 });
        camera.secousse = 8;
        break;
      case "plume":
        jaillir(16, e.x, e.y, [PALETTE.B, PALETTE.c], { force: 1.8 });
        break;
      case "perdPlume":
        jaillir(14, pieds.x, h.y, [PALETTE.B, PALETTE.c, PALETTE.g], { force: 1.6, gravite: 0.03, vie: 50 });
        camera.secousse = 10;
        break;
      case "ecrase":
      case "ejecte":
        jaillir(8, e.x, e.y, [PALETTE.B, PALETTE.g], { force: 1.4, vie: 16 });
        camera.secousse = 4;
        break;
      case "brique":
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0], [1, 0]]) {
          particules.push({ x: e.x + 8 + dx * 4, y: e.y + 8 + dy * 4, vx: dx * 1.2, vy: -3 + dy, vie: 50, couleur: PALETTE.O, taille: 4, gravite: 0.25 });
        }
        camera.secousse = 6;
        break;
      case "bloc":
        jaillir(4, e.x + 8, e.y, [PALETTE.g], { vy: -0.5, vie: 12 });
        break;
      case "drapeau":
        jaillir(16, e.x, e.y + 8, [PALETTE.R, PALETTE.J, PALETTE.B], { force: 1.6 });
        break;
      case "mort":
        camera.secousse = 12;
        break;
      case "victoire":
        jaillir(60, m.arrivee.x + 24, m.arrivee.y + 20, [PALETTE.R, PALETTE.J, PALETTE.C, PALETTE.v, PALETTE.p], { force: 3, vie: 90, gravite: 0.06, taille: 2 });
        break;
    }
  }
}

function animerParticules() {
  for (const p of particules) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravite;
    p.vie--;
  }
  for (let i = particules.length - 1; i >= 0; i--) if (particules[i].vie <= 0) particules.splice(i, 1);
}

// ——— Le fond ———

const fond = (() => {
  const ciel = document.createElement("canvas");
  ciel.width = 1;
  ciel.height = HAUTEUR;
  const c = ciel.getContext("2d")!;
  const bandes = ["#4d8fe0", "#5b9fe6", "#6aaeea", "#7dbdee", "#90cbf0", "#a5d8f1", "#bce4f2", "#d4eef2"];
  bandes.forEach((b, i) => {
    c.fillStyle = b;
    c.fillRect(0, Math.round((i * HAUTEUR) / bandes.length), 1, Math.ceil(HAUTEUR / bandes.length));
  });
  // Deux rangées de collines, dessinées une fois sur une bande qui se répète
  const colline = (hauteur: number, couleur: string, bosses: number, graine: number, arbres: boolean) => {
    const toile = document.createElement("canvas");
    toile.width = 480;
    toile.height = hauteur;
    const ctx = toile.getContext("2d")!;
    ctx.fillStyle = couleur;
    for (let x = 0; x < 480; x++) {
      const t = (x / 480) * Math.PI * 2;
      const y = Math.round(hauteur * 0.45 + Math.sin(t * bosses + graine) * hauteur * 0.18 + Math.sin(t * bosses * 2.3 + graine * 2) * hauteur * 0.08);
      ctx.fillRect(x, y, 1, hauteur - y);
      if (arbres && x % 23 === graine % 23) {
        // un sapin en silhouette
        for (let k = 0; k < 14; k++) ctx.fillRect(x - Math.floor(k / 3), y - 14 + k, 1 + Math.floor(k / 3) * 2, 1);
      }
    }
    return toile;
  };
  return {
    ciel,
    loin: colline(110, "#7fa7c9", 2, 1, false),
    milieu: colline(90, "#5f9a7a", 3, 4, true),
    pres: colline(70, "#3f7f55", 4, 7, true),
  };
})();

export function dessinerFond(ctx: CanvasRenderingContext2D, cam: Camera, m: Monde) {
  ctx.drawImage(fond.ciel, 0, 0, LARGEUR, HAUTEUR);
  // Le soleil
  ctx.fillStyle = "#fff4c4";
  ctx.beginPath();
  ctx.arc(250 - cam.x * 0.02, 38, 14, 0, Math.PI * 2);
  ctx.fill();
  // Les nuages, très loin
  for (let i = 0; i < 6; i++) {
    const x = ((i * 137 - cam.x * 0.12 - m.temps * 0.05) % 560 + 560) % 560 - 80;
    dessinerNuageFond(ctx, x, 18 + ((i * 41) % 50));
  }
  const decalY = -cam.y * 0.3;
  const couche = (img: HTMLCanvasElement, vitesse: number, y: number) => {
    const x = -((cam.x * vitesse) % img.width);
    for (let k = -1; k < 2; k++) ctx.drawImage(img, Math.round(x + k * img.width), Math.round(y));
  };
  couche(fond.loin, 0.1, HAUTEUR - 125 + decalY * 0.5);
  couche(fond.milieu, 0.25, HAUTEUR - 95 + decalY * 0.8);
  couche(fond.pres, 0.45, HAUTEUR - 60 + decalY);
}

function dessinerNuageFond(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#f4f9fb";
  ctx.fillRect(x + 8, y, 24, 6);
  ctx.fillRect(x + 2, y + 4, 44, 6);
  ctx.fillRect(x, y + 8, 52, 4);
  ctx.fillStyle = "#d8e8f0";
  ctx.fillRect(x, y + 11, 52, 2);
}

// ——— Les cases ———

const cacheSol = new Map<number, HTMLCanvasElement>();

/** Une case de sol, avec herbe et bords selon ses voisines (masque : haut, gauche, droite). */
export function caseSol(masque: number): HTMLCanvasElement {
  let c = cacheSol.get(masque);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = T;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image(D.TERRE), 0, 0);
  const hautLibre = masque & 1, gaucheLibre = masque & 2, droiteLibre = masque & 4;
  ctx.fillStyle = PALETTE.K;
  if (gaucheLibre) ctx.fillRect(0, 0, 1, T);
  if (droiteLibre) ctx.fillRect(T - 1, 0, 1, T);
  if (hautLibre) {
    ctx.drawImage(image(D.HERBE), 0, 0);
    ctx.fillStyle = PALETTE.T;
    if (gaucheLibre) ctx.fillRect(0, 1, 1, 4);
    if (droiteLibre) ctx.fillRect(T - 1, 1, 1, 4);
    if (gaucheLibre) ctx.clearRect(0, 0, 1, 1);
    if (droiteLibre) ctx.clearRect(T - 1, 0, 1, 1);
  }
  cacheSol.set(masque, c);
  return c;
}

function dessinerCases(ctx: CanvasRenderingContext2D, cam: Camera, m: Monde, ox: number, oy: number) {
  const c0 = Math.floor(cam.x / T), c1 = Math.ceil((cam.x + LARGEUR) / T);
  const l0 = Math.floor(cam.y / T), l1 = Math.ceil((cam.y + HAUTEUR) / T);
  const solEn = (c: number, l: number) => caseEn(m, c, l) === CASE.sol;
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      const sorte = caseEn(m, c, l);
      if (sorte === CASE.vide || c < 0 || c >= m.niveau.largeur) continue;
      const i = l * m.niveau.largeur + c;
      const secousse = m.blocsSecoues.get(i);
      const x = c * T - ox;
      const y = l * T - oy - (secousse ? Math.round(Math.sin((secousse / 8) * Math.PI) * 4) : 0);
      switch (sorte) {
        case CASE.sol: {
          const masque = (solEn(c, l - 1) ? 0 : 1) | (solEn(c - 1, l) || c === 0 ? 0 : 2) | (solEn(c + 1, l) || c === m.niveau.largeur - 1 ? 0 : 4);
          ctx.drawImage(caseSol(masque), x, y);
          break;
        }
        case CASE.pierre: dessiner(ctx, D.PIERRE, x, y); break;
        case CASE.brique: dessiner(ctx, D.BRIQUE, x, y); break;
        case CASE.mystere: dessiner(ctx, D.MYSTERE[Math.floor(m.temps / 8) % 16 < 4 ? Math.floor(m.temps / 8) % 4 : 0], x, y); break;
        case CASE.utilise: dessiner(ctx, D.UTILISE, x, y); break;
        case CASE.passerelle: dessiner(ctx, D.PASSERELLE, x, y); break;
        case CASE.pics: dessiner(ctx, D.RONCES, x, y); break;
      }
    }
  }
}

// ——— Le monde entier ———

export function dessinerMonde(ctx: CanvasRenderingContext2D, m: Monde, cam: Camera) {
  animerParticules();
  const sx = cam.secousse > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const sy = cam.secousse > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const ox = Math.round(cam.x) + sx;
  const oy = Math.round(cam.y) + sy;
  const t = m.temps;
  const visible = (x: number, l = 48) => x + l > ox - 16 && x < ox + LARGEUR + 16;

  dessinerFond(ctx, cam, m);

  // Décor derrière les personnages
  for (const a of m.niveau.apparitions) {
    const x = a.colonne * T, y = a.ligne * T;
    if (!visible(x)) continue;
    if (a.lettre === "*") dessiner(ctx, D.FLEUR, x - ox, y - oy);
    if (a.lettre === ",") dessiner(ctx, D.TOUFFE, x - ox, y - oy);
    if (a.lettre === "%") dessiner(ctx, D.BUISSON, x - ox, y - oy);
    if (a.lettre === "G") dessiner(ctx, D.NID, x - 16 - ox, y - 8 - oy);
  }
  for (const p of m.niveau.panneaux) dessiner(ctx, D.PANNEAU, p.colonne * T - ox, p.ligne * T - oy);
  for (const d of m.drapeaux) if (visible(d.x)) dessiner(ctx, d.leve ? D.DRAPEAU_HAUT : D.DRAPEAU_BAS, d.x - ox, d.y - oy);

  dessinerCases(ctx, cam, m, ox, oy);

  // Plateformes
  for (const p of m.plateformes) {
    if (!visible(p.x, p.l)) continue;
    if (p.sorte === "nuage") {
      if (p.etat === "disparu") continue;
      if (p.etat === "tremble" && p.minuteur < 14 && t % 4 < 2) continue;
      const tx = p.etat === "tremble" ? Math.round(Math.sin(t * 1.3)) : 0;
      for (let k = 0; k < p.l; k += T) {
        const morceau = D.NUAGE.milieu;
        dessiner(ctx, morceau, p.x + k - ox + tx, p.y - oy);
      }
      dessiner(ctx, D.NUAGE.gauche, p.x - 6 - ox + tx, p.y - oy);
      dessiner(ctx, D.NUAGE.gauche, p.x + p.l - 2 - ox + tx, p.y - oy, true);
    } else {
      dessiner(ctx, D.BUCHE, p.x - ox, p.y - oy);
    }
  }

  // Ressorts
  for (const r of m.ressorts) if (visible(r.x)) dessiner(ctx, D.RESSORT[r.compression > 4 ? 1 : 0], r.x - 1 - ox, r.y - 8 - oy);

  // Objets
  for (const o of m.objets) {
    if (!visible(o.x)) continue;
    if (o.sorte === "graine") dessiner(ctx, D.GRAINE[Math.floor((t + o.x) / 7) % 4], o.x - 3 - ox, o.y - 3 - oy);
    if (o.sorte === "oeuf") {
      dessiner(ctx, D.OEUF, o.x - 3 - ox, o.y - 3 - oy + Math.round(Math.sin(t / 15) * 1.5));
      if (t % 40 < 3) jaillir(1, o.x + 2 + Math.random() * 8, o.y + Math.random() * 8, [PALETTE.B], { gravite: 0, vie: 10, force: 0.2 });
    }
    if (o.sorte === "plume") dessiner(ctx, D.PLUME, o.x - 2 - ox, o.y - 2 - oy + (o.flotte ? 0 : Math.round(Math.sin(t / 12))));
  }

  // Ennemis
  for (const e of m.ennemis) {
    if (!visible(e.x)) continue;
    const x = e.x + e.l / 2 - 8 - ox;
    const y = e.y + e.h - 16 - oy;
    const retourne = e.sens > 0;
    let dessin: D.Dessin;
    if (e.sorte === "limace") dessin = e.etat === "ecrase" ? D.LIMACE_ECRASEE : D.LIMACE[Math.floor(e.minuteur / 16) % 2];
    else if (e.sorte === "bogue") dessin = D.BOGUE;
    else if (e.sorte === "grenouille") dessin = e.vy < 0 || e.vy > 1 ? D.GRENOUILLE[1] : D.GRENOUILLE[0];
    else dessin = D.GUEPE[Math.floor(t / 3) % 2];
    if (e.etat === "ejecte") {
      ctx.save();
      ctx.translate(Math.round(x + 8), Math.round(y + 8));
      ctx.scale(1, -1);
      dessiner(ctx, dessin, -8, -8, retourne);
      ctx.restore();
    } else if (e.etat === "ecrase" && e.sorte !== "limace") {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y + 16));
      ctx.scale(1, 0.4);
      dessiner(ctx, dessin, 0, -16, retourne);
      ctx.restore();
    } else {
      dessiner(ctx, dessin, x, y, e.sorte === "bogue" ? Math.floor(t / 12) % 2 === 0 : retourne);
    }
  }

  dessinerHeros(ctx, m, ox, oy);

  // Particules
  for (const p of particules) {
    if (p.dessin) {
      dessiner(ctx, p.dessin, p.x - ox, p.y - oy);
      continue;
    }
    ctx.fillStyle = p.couleur;
    ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.taille, p.taille);
  }

  // Les panneaux s'ouvrent quand on est tout près
  const h = m.heros;
  for (const p of m.niveau.panneaux) {
    const px = p.colonne * T + 8;
    if (Math.abs(h.x + h.l / 2 - px) < 22 && Math.abs(h.y - p.ligne * T) < 24) bulle(ctx, p.texte, px - ox, p.ligne * T - 4 - oy);
  }
}

function dessinerHeros(ctx: CanvasRenderingContext2D, m: Monde, ox: number, oy: number) {
  const h = m.heros;
  if (h.invincible > 0 && h.mort === 0 && Math.floor(h.invincible / 3) % 2 === 0) return;
  let dessin = D.HEROS.repos;
  if (h.mort > 0) dessin = D.HEROS.mort;
  else if (!h.auSol) dessin = h.vy < 0 ? D.HEROS.saut : D.HEROS.chute;
  else if (Math.abs(h.vx) > 0.2) dessin = [D.HEROS.course0, D.HEROS.course1, D.HEROS.course2, D.HEROS.course3][Math.floor(m.temps / (Math.abs(h.vx) > 2 ? 4 : 6)) % 4];
  else if (m.temps % 150 < 6) dessin = D.HEROS.cligne;
  const x = h.x + h.l / 2 - 8 - ox;
  const y = h.y + h.h - 16 - oy;
  dessiner(ctx, dessin, x, y, h.regard < 0);
  if (h.plume && h.mort === 0) dessiner(ctx, D.PLUME_TETE, x + (h.regard < 0 ? 7 : 1), y - 1, h.regard < 0);
}

function bulle(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number) {
  const lignes = texte.split("\n");
  const l = Math.max(...lignes.map((li) => li.length)) * 4 + 10;
  const largeur = Math.min(LARGEUR - 8, Math.max(60, l));
  const hauteur = lignes.length * 9 + 6;
  const bx = Math.round(Math.max(4, Math.min(LARGEUR - 4 - largeur, x - largeur / 2)));
  const by = Math.round(Math.max(18, y - hauteur - 6));
  ctx.fillStyle = PALETTE.N;
  ctx.fillRect(bx - 1, by - 1, largeur + 2, hauteur + 2);
  ctx.fillStyle = PALETTE.B;
  ctx.fillRect(bx, by, largeur, hauteur);
  ecrire(ctx, texte, bx + largeur / 2, by + 2, PALETTE.N, { aligner: "centre" });
}

// ——— L'affichage du haut ———

export function dessinerInterface(ctx: CanvasRenderingContext2D, m: Monde) {
  ctx.fillStyle = "rgba(27,20,36,0.55)";
  ctx.fillRect(0, 0, LARGEUR, 13);
  dessiner(ctx, D.GRAINE[0], 0, -2);
  ecrire(ctx, `${m.stats.graines}`, 15, 2, PALETTE.J);
  for (let i = 0; i < m.stats.oeufsTotal; i++) {
    ctx.globalAlpha = i < m.stats.oeufs ? 1 : 0.3;
    dessiner(ctx, D.OEUF, 40 + i * 12, -2);
  }
  ctx.globalAlpha = 1;
  if (m.heros.plume) dessiner(ctx, D.PLUME, 82, -2);
  const s = Math.floor(m.stats.temps / 60);
  ecrire(ctx, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, LARGEUR - 4, 2, PALETTE.B, { aligner: "droite" });
}
