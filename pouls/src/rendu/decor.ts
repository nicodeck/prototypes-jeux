// La jungle : ciel, Arbre-Cœur à l'horizon, plans en parallaxe, brume, rais de lumière, sol, lucioles.
// Les silhouettes sont peintes une fois en blanc dans des bandes qui se répètent, puis teintées à chaque image
// selon la palette : les fondus entre sections ne coûtent rien.

import { creerCanevas, lueur, type Ctx, type Ecran } from "./ecran";
import { eclaircir, hasard, melangerRvb, rvb, type RVB } from "../outils";
import type { Vue } from "./vue";
import { xEcran } from "./vue";

const LARGEUR_BANDE = 1800;

interface Lumiere {
  x: number;
  y: number;
  r: number;
  /** Indice de la couleur dans palette.lueurs. */
  c: number;
  phase: number;
  /** Étirement horizontal (chapeaux de champignons). */
  e: number;
}

interface Plan {
  facteur: number;
  bande: HTMLCanvasElement;
  lumieres: Lumiere[];
  /** Couleur et fondu vers la brume en bas du plan. */
  couleur: (v: Vue) => [RVB, RVB];
  yHaut: number;
}

type Pinceau = { x: Ctx; r: () => number };

// ------------------------------------------------------------------ formes peintes dans les bandes

/** Dessine une forme trois fois (à gauche, au centre, à droite) pour que la bande se raccorde. */
function enBoucle(p: Pinceau, x: number, f: (x: number) => void) {
  f(x);
  if (x < 300) f(x + LARGEUR_BANDE);
  if (x > LARGEUR_BANDE - 300) f(x - LARGEUR_BANDE);
}

function couronne(p: Pinceau, x: number, y: number, r: number) {
  const { x: c } = p;
  c.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.82 + p.r() * 0.3);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.8;
    if (i === 0) c.moveTo(px, py);
    else c.quadraticCurveTo(x + Math.cos(a - 0.35) * rr * 1.25, y + Math.sin(a - 0.35) * rr, px, py);
  }
  c.fill();
}

function tronc(p: Pinceau, x: number, base: number, haut: number, largeur: number) {
  const c = p.x;
  const courbe = (p.r() - 0.5) * largeur * 3;
  c.beginPath();
  c.moveTo(x - largeur * 1.6, base);
  c.quadraticCurveTo(x - largeur * 0.6 + courbe, (base + haut) / 2, x - largeur * 0.4, haut);
  c.lineTo(x + largeur * 0.4, haut);
  c.quadraticCurveTo(x + largeur * 0.6 + courbe, (base + haut) / 2, x + largeur * 1.6, base);
  c.closePath();
  c.fill();
  // Racines-contreforts
  for (let k = 0; k < 3; k++) {
    const s = k % 2 ? 1 : -1;
    const lx = x + s * largeur * (1 + p.r() * 2.5);
    c.beginPath();
    c.moveTo(x + s * largeur * 0.3, base - largeur * 3);
    c.quadraticCurveTo(x + s * largeur, base - largeur, lx, base + 2);
    c.lineTo(x, base + 2);
    c.fill();
  }
}

function liane(p: Pinceau, x: number, y0: number, longueur: number, epaisseur: number): { x: number; y: number } {
  const c = p.x;
  const dx = (p.r() - 0.5) * 60;
  c.lineWidth = epaisseur;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, y0);
  c.bezierCurveTo(x + dx, y0 + longueur * 0.3, x - dx, y0 + longueur * 0.7, x + dx * 0.3, y0 + longueur);
  c.stroke();
  return { x: x + dx * 0.3, y: y0 + longueur };
}

function feuille(p: Pinceau, x: number, y: number, longueur: number, angle: number, largeur: number) {
  const c = p.x;
  const ex = x + Math.cos(angle) * longueur;
  const ey = y + Math.sin(angle) * longueur;
  const nx = -Math.sin(angle) * largeur;
  const ny = Math.cos(angle) * largeur;
  const mx = (x + ex) / 2;
  const my = (y + ey) / 2;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(mx + nx, my + ny, ex, ey);
  c.quadraticCurveTo(mx - nx, my - ny, x, y);
  c.fill();
}

function fougere(p: Pinceau, x: number, base: number, taille: number, angle: number) {
  const c = p.x;
  const n = 11;
  let px = x;
  let py = base;
  let a = angle;
  c.lineWidth = Math.max(1.5, taille * 0.025);
  for (let i = 0; i < n; i++) {
    const l = taille / n;
    const nx = px + Math.cos(a) * l;
    const ny = py + Math.sin(a) * l;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(nx, ny);
    c.stroke();
    const f = (1 - i / n) * taille * 0.22;
    feuille(p, nx, ny, f, a - 1.2, f * 0.22);
    feuille(p, nx, ny, f, a + 1.2, f * 0.22);
    px = nx;
    py = ny;
    a += angle < -Math.PI / 2 ? -0.09 : 0.09;
  }
}

function champignon(p: Pinceau, x: number, base: number, h: number, r: number): { x: number; y: number } {
  const c = p.x;
  const pente = (p.r() - 0.5) * h * 0.3;
  c.lineWidth = Math.max(2, r * 0.22);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, base);
  c.quadraticCurveTo(x + pente, base - h * 0.5, x + pente * 0.6, base - h);
  c.stroke();
  const cx = x + pente * 0.6;
  const cy = base - h;
  c.beginPath();
  c.moveTo(cx - r, cy + r * 0.15);
  c.bezierCurveTo(cx - r, cy - r * 0.9, cx + r, cy - r * 0.9, cx + r, cy + r * 0.15);
  c.quadraticCurveTo(cx, cy - r * 0.1, cx - r, cy + r * 0.15);
  c.fill();
  return { x: cx, y: cy + r * 0.05 };
}

// ------------------------------------------------------------------ fabrication des plans

function nouvelleBande(echelle: number, graine: number): { bande: HTMLCanvasElement; p: Pinceau } {
  const { c, x } = creerCanevas(LARGEUR_BANDE * echelle, 720 * echelle);
  x.scale(echelle, echelle);
  x.fillStyle = "#fff";
  x.strokeStyle = "#fff";
  return { bande: c, p: { x, r: hasard(graine) } };
}

function planLointain(echelle: number): Plan {
  const { bande, p } = nouvelleBande(echelle, 11);
  const lumieres: Lumiere[] = [];
  for (let x = 0; x < LARGEUR_BANDE; x += 34) {
    const r = 40 + p.r() * 50;
    const y = 400 + Math.sin(x * 0.006) * 22 + p.r() * 20;
    enBoucle(p, x, (xx) => couronne(p, xx, y, r));
  }
  p.x.fillRect(0, 430, LARGEUR_BANDE, 300);
  // Quelques géants qui dépassent
  for (let k = 0; k < 4; k++) {
    const x = 150 + k * 440 + p.r() * 120;
    const haut = 230 + p.r() * 80;
    enBoucle(p, x, (xx) => {
      tronc(p, xx, 460, haut, 7);
      for (let j = 0; j < 4; j++) couronne(p, xx + (p.r() - 0.5) * 120, haut + (p.r() - 0.3) * 40, 40 + p.r() * 30);
    });
  }
  for (let i = 0; i < 40; i++) lumieres.push({ x: p.r() * LARGEUR_BANDE, y: 420 + p.r() * 120, r: 3 + p.r() * 4, c: i % 3, phase: p.r() * 6, e: 1 });
  return {
    facteur: 0.1,
    bande,
    lumieres,
    yHaut: 300,
    couleur: (v) => [melangerRvb(v.palette.loin, v.palette.brume, 0.12), melangerRvb(v.palette.loin, v.palette.brume, 0.42)],
  };
}

function planArbres(echelle: number): Plan {
  const { bande, p } = nouvelleBande(echelle, 23);
  const lumieres: Lumiere[] = [];
  for (let k = 0; k < 6; k++) {
    const x = 120 + k * 300 + p.r() * 120;
    const largeur = 12 + p.r() * 10;
    enBoucle(p, x, (xx) => {
      tronc(p, xx, 520, -20, largeur);
      // branches et lianes
      for (let j = 0; j < 3; j++) {
        const y = 60 + p.r() * 200;
        const s = p.r() > 0.5 ? 1 : -1;
        p.x.lineWidth = largeur * 0.5;
        p.x.beginPath();
        p.x.moveTo(xx, y + 30);
        p.x.quadraticCurveTo(xx + s * 60, y, xx + s * (120 + p.r() * 80), y - 20 + p.r() * 30);
        p.x.stroke();
      }
    });
    // Polypores lumineux sur le tronc
    for (let j = 0; j < 3; j++) {
      const y = 260 + p.r() * 200;
      const s = j % 2 ? 1 : -1;
      const fx = x + s * largeur * 0.9;
      enBoucle(p, fx, (xx) => {
        p.x.beginPath();
        p.x.ellipse(xx + s * 8, y, 14, 4, 0, 0, Math.PI * 2);
        p.x.fill();
      });
      lumieres.push({ x: fx + s * 8, y: y + 2, r: 16, c: 1, phase: p.r() * 6, e: 1.8 });
    }
  }
  for (let k = 0; k < 18; k++) {
    const x = p.r() * LARGEUR_BANDE;
    const l = 120 + p.r() * 260;
    let bout = { x, y: l };
    enBoucle(p, x, (xx) => {
      const b = liane(p, xx, -10, l, 2 + p.r() * 2);
      if (xx === x) bout = b;
    });
    lumieres.push({ x: bout.x, y: bout.y + 4, r: 9, c: 0, phase: p.r() * 6, e: 1 });
  }
  // Buissons au pied
  for (let x = 0; x < LARGEUR_BANDE; x += 40) enBoucle(p, x, (xx) => couronne(p, xx, 515 + p.r() * 15, 30 + p.r() * 25));
  p.x.fillRect(0, 520, LARGEUR_BANDE, 200);
  return {
    facteur: 0.28,
    bande,
    lumieres,
    yHaut: 0,
    couleur: (v) => [melangerRvb(v.palette.milieu, v.palette.brume, 0.04), melangerRvb(v.palette.milieu, v.palette.brume, 0.22)],
  };
}

function planSousBois(echelle: number): Plan {
  const { bande, p } = nouvelleBande(echelle, 37);
  const lumieres: Lumiere[] = [];
  for (let k = 0; k < 9; k++) {
    const x = 80 + k * 200 + p.r() * 100;
    const h = 80 + p.r() * 190;
    const r = 26 + p.r() * 34;
    let cap = { x: 0, y: 0 };
    enBoucle(p, x, (xx) => {
      const c = champignon(p, xx, 552, h, r);
      if (xx === x) cap = c;
      // petits voisins
      champignon(p, xx + r * 1.2, 552, h * 0.35, r * 0.4);
    });
    lumieres.push({ x: cap.x, y: cap.y, r: r * 1.3, c: k % 3, phase: p.r() * 6, e: 1.4 });
    lumieres.push({ x: x + r * 1.2, y: 552 - h * 0.35, r: r * 0.6, c: (k + 1) % 3, phase: p.r() * 6, e: 1.3 });
  }
  for (let k = 0; k < 14; k++) {
    const x = p.r() * LARGEUR_BANDE;
    const t = 90 + p.r() * 110;
    enBoucle(p, x, (xx) => {
      fougere(p, xx, 556, t, -Math.PI / 2 - 0.5 - p.r() * 0.4);
      fougere(p, xx, 556, t * 0.9, -Math.PI / 2 + 0.5 + p.r() * 0.4);
    });
  }
  for (let x = 0; x < LARGEUR_BANDE; x += 26) enBoucle(p, x, (xx) => couronne(p, xx, 556 + p.r() * 10, 14 + p.r() * 16));
  p.x.fillRect(0, 556, LARGEUR_BANDE, 200);
  for (let i = 0; i < 30; i++) lumieres.push({ x: p.r() * LARGEUR_BANDE, y: 500 + p.r() * 50, r: 4 + p.r() * 4, c: i % 3, phase: p.r() * 6, e: 1 });
  return {
    facteur: 0.55,
    bande,
    lumieres,
    yHaut: 260,
    couleur: (v) => [v.palette.proche, melangerRvb(v.palette.proche, v.palette.brume, 0.12)],
  };
}

function planAvant(echelle: number): Plan {
  const { bande, p } = nouvelleBande(echelle, 53);
  // Grandes feuilles au ras du bas, rares, et quelques lianes qui pendent du haut.
  for (let k = 0; k < 5; k++) {
    const x = 200 + k * 360 + p.r() * 140;
    enBoucle(p, x, (xx) => {
      for (let j = 0; j < 4; j++) feuille(p, xx + j * 18, 740, 120 + p.r() * 80, -Math.PI / 2 + (j - 1.5) * 0.45, 26);
    });
  }
  for (let k = 0; k < 4; k++) {
    const x = 100 + k * 450 + p.r() * 150;
    enBoucle(p, x, (xx) => {
      liane(p, xx, -10, 90 + p.r() * 70, 7);
      for (let j = 0; j < 4; j++) feuille(p, xx + (p.r() - 0.5) * 30, 20 + j * 22, 40, Math.PI / 2 + (p.r() - 0.5) * 1.6, 11);
    });
  }
  return { facteur: 1.6, bande, lumieres: [], yHaut: 0, couleur: (v) => [melangerRvb(v.palette.sol, [0, 0, 0], 0.4), v.palette.sol] };
}

// ------------------------------------------------------------------ le décor

interface Etoile {
  x: number;
  y: number;
  r: number;
  phase: number;
}

interface Luciole {
  x: number;
  y: number;
  profondeur: number;
  phase: number;
  vitesse: number;
}

export class Decor {
  private plans: Plan[] = [];
  private teinte = creerCanevas(8, 8);
  private version = -1;
  private etoiles: Etoile[] = [];
  private lucioles: Luciole[] = [];

  constructor(private readonly ecran: Ecran) {
    const r = hasard(7);
    for (let i = 0; i < 160; i++) this.etoiles.push({ x: r(), y: Math.pow(r(), 1.6) * 0.62, r: 0.4 + r() * 1.3, phase: r() * 10 });
    for (let i = 0; i < 70; i++) this.lucioles.push({ x: r(), y: 0.25 + r() * 0.7, profondeur: 0.3 + r() * 1.1, phase: r() * 10, vitesse: 0.5 + r() });
  }

  private preparer() {
    if (this.version === this.ecran.version) return;
    this.version = this.ecran.version;
    const e = this.ecran.echelle;
    this.plans = [planLointain(e * 0.55), planArbres(e * 0.7), planSousBois(e * 0.85), planAvant(e * 0.6)];
    this.teinte = creerCanevas(this.ecran.canvas.width, this.ecran.canvas.height);
  }

  /** Tout ce qui est derrière le coureur, sol compris. */
  dessinerFond(ctx: Ctx, v: Vue) {
    this.preparer();
    this.ciel(ctx, v);
    this.arbreCoeur(ctx, v);
    this.plan(ctx, v, this.plans[0]);
    this.brume(ctx, v, 430, 0.5);
    this.plan(ctx, v, this.plans[1]);
    this.rais(ctx, v);
    this.brume(ctx, v, 510, 0.42);
    this.lucioles_(ctx, v, false);
    this.plan(ctx, v, this.plans[2]);
    this.brume(ctx, v, 560, 0.22);
    this.sol(ctx, v);
  }

  /** Premier plan et lucioles proches, par-dessus le coureur. */
  dessinerAvant(ctx: Ctx, v: Vue) {
    this.lucioles_(ctx, v, true);
    this.plan(ctx, v, this.plans[3]);
  }

  private ciel(ctx: Ctx, v: Vue) {
    const P = v.palette;
    const g = ctx.createLinearGradient(0, 0, 0, 520);
    g.addColorStop(0, rvb(P.cielHaut));
    g.addColorStop(0.65, rvb(melangerRvb(P.cielHaut, P.cielBas, 0.6)));
    g.addColorStop(1, rvb(P.cielBas));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.W, v.H);

    ctx.globalCompositeOperation = "lighter";
    // Une aurore lente, très discrète, qui ondule dans le ciel.
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + v.reel * 0.004) % 1.2) * v.W * 1.1 - v.W * 0.1;
      const y = 120 + Math.sin(v.reel * 0.2 + i * 2) * 40 + i * 18;
      lueur(ctx, x, y, 230, melangerRvb(P.horizon, P.lueurs[i % 3], 0.5), 0.07 + v.mesure * 0.02, 2.4);
    }
    for (const s of this.etoiles) {
      const sc = 0.6 + 0.4 * Math.sin(v.reel * (1 + s.phase * 0.2) + s.phase);
      const x = (((s.x * v.W - v.temps * v.pixelsParTemps * 0.01) % v.W) + v.W) % v.W;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * sc})`;
      ctx.fillRect(x, s.y * v.H, s.r, s.r);
      if (s.r > 1.4) lueur(ctx, x, s.y * v.H, 5 + 3 * v.battement, eclaircir(P.lucioles, 0.5), 0.35 * sc);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** L'Arbre-Cœur, au loin : il grandit à mesure qu'on s'en approche, et son cœur bat avec la grosse caisse. */
  private arbreCoeur(ctx: Ctx, v: Vue) {
    const P = v.palette;
    const { x, y: yCoeur, s } = positionCoeur(v);
    const base = 470;
    const silhouette = melangerRvb(P.cielBas, P.loin, 0.75);

    // Halo et rayons, derrière l'arbre
    ctx.globalCompositeOperation = "lighter";
    lueur(ctx, x, yCoeur, 320 * s, P.horizon, 0.22 + 0.1 * v.pouls, 1.4);
    ctx.save();
    ctx.translate(x, yCoeur);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + v.reel * 0.04;
      const l = (300 + 80 * Math.sin(i * 3.1 + v.reel * 0.7)) * s;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
      g.addColorStop(0, rvb(P.horizon, 0.1 + 0.08 * v.pouls));
      g.addColorStop(1, rvb(P.horizon, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.04) * l, Math.sin(a - 0.04) * l);
      ctx.lineTo(Math.cos(a + 0.04) * l, Math.sin(a + 0.04) * l);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";

    // Tronc, maîtresses branches et frondaison
    const r = hasard(99);
    ctx.fillStyle = rvb(silhouette);
    ctx.strokeStyle = rvb(silhouette);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 46 * s, base);
    ctx.bezierCurveTo(x - 16 * s, base - 40 * s, x - 22 * s, base - 120 * s, x - 10 * s, yCoeur + 40 * s);
    ctx.lineTo(x + 10 * s, yCoeur + 40 * s);
    ctx.bezierCurveTo(x + 22 * s, base - 120 * s, x + 16 * s, base - 40 * s, x + 46 * s, base);
    ctx.fill();
    const bouts: [number, number][] = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42 + (r() - 0.5) * 0.2;
      const l = (110 + r() * 60) * s * (1 - Math.abs(i - 3) * 0.08);
      const ex = x + Math.cos(a) * l * 1.35;
      const ey = yCoeur + 30 * s + Math.sin(a) * l * 0.75;
      ctx.lineWidth = (12 - Math.abs(i - 3) * 2) * s;
      ctx.beginPath();
      ctx.moveTo(x, yCoeur + 50 * s);
      ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.4, yCoeur + 30 * s, ex, ey);
      ctx.stroke();
      bouts.push([ex, ey]);
    }
    for (const [bx, by] of bouts) {
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.ellipse(bx + (r() - 0.5) * 70 * s, by + (r() - 0.6) * 30 * s, (34 + r() * 26) * s, (20 + r() * 14) * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Lianes qui pendent de la frondaison, avec des fruits de lumière
    ctx.lineWidth = 1.5 * s;
    const fruits: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const fx = x + (r() - 0.5) * 300 * s;
      const fy0 = yCoeur + (r() * 30 - 10) * s;
      const fy1 = fy0 + (40 + r() * 90) * s;
      ctx.beginPath();
      ctx.moveTo(fx, fy0);
      ctx.quadraticCurveTo(fx + 6 * s, (fy0 + fy1) / 2, fx, fy1);
      ctx.stroke();
      fruits.push([fx, fy1]);
    }

    // Le cœur brille à travers les feuilles
    ctx.globalCompositeOperation = "lighter";
    for (const [fx, fy] of fruits) lueur(ctx, fx, fy, 9 * s, P.horizon, 0.5 + 0.4 * v.battement);
    const battement = 1 + 0.2 * v.pouls;
    ctx.save();
    ctx.translate(x, yCoeur);
    ctx.scale(s * battement, s * battement);
    lueur(ctx, 0, 0, 110, P.horizon, 0.45 + 0.35 * v.pouls);
    ctx.fillStyle = rvb(eclaircir(P.horizon, 0.25), 0.75);
    tracerCoeur(ctx, 0, -2, 22);
    ctx.fill();
    ctx.fillStyle = rvb(eclaircir(P.horizon, 0.8), 0.8);
    tracerCoeur(ctx, 0, -2, 10);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  private plan(ctx: Ctx, v: Vue, p: Plan) {
    const t = this.teinte;
    const e = this.ecran.echelle;
    const L = LARGEUR_BANDE;
    const decal = (((v.temps * v.pixelsParTemps * p.facteur) % L) + L) % L;
    const tx = t.x;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.globalCompositeOperation = "copy";
    tx.drawImage(p.bande, -decal * e, 0, L * e, 720 * e);
    tx.globalCompositeOperation = "source-over";
    tx.drawImage(p.bande, (L - decal) * e, 0, L * e, 720 * e);
    tx.globalCompositeOperation = "source-in";
    const [haut, bas] = p.couleur(v);
    const g = tx.createLinearGradient(0, p.yHaut * e, 0, 720 * e);
    g.addColorStop(0, rvb(haut));
    g.addColorStop(1, rvb(bas));
    tx.fillStyle = g;
    tx.fillRect(0, 0, t.c.width, t.c.height);
    ctx.drawImage(t.c, 0, 0, v.W, v.H);

    if (!p.lumieres.length) return;
    ctx.globalCompositeOperation = "lighter";
    const P = v.palette;
    for (const l of p.lumieres) {
      let x = l.x - decal;
      if (x < -60) x += L;
      if (x > v.W + 60) continue;
      const vie = 0.65 + 0.35 * Math.sin(v.reel * 1.3 + l.phase);
      const pulse = 1 + 0.35 * v.pouls;
      lueur(ctx, x, l.y, l.r * 2.2 * pulse, P.lueurs[l.c], (0.32 + 0.22 * v.battement) * vie, l.e);
      lueur(ctx, x, l.y, l.r * 0.7, eclaircir(P.lueurs[l.c], 0.4), 0.8 * vie, l.e);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private brume(ctx: Ctx, v: Vue, y: number, force: number) {
    const P = v.palette;
    const g = ctx.createLinearGradient(0, y - 160, 0, y + 60);
    g.addColorStop(0, rvb(P.brume, 0));
    g.addColorStop(0.75, rvb(P.brume, force * 0.4));
    g.addColorStop(1, rvb(P.brume, force * 0.18));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 160, v.W, 220);
    // Volutes lumineuses qui dérivent
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const vit = 0.15 + i * 0.04;
      const x = ((((i * 397 - v.temps * v.pixelsParTemps * vit * force) % (v.W + 600)) + v.W + 600) % (v.W + 600)) - 300;
      lueur(ctx, x, y - 30 + Math.sin(v.reel * 0.3 + i) * 14, 140, P.brume, force * 0.16, 2.6);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private rais(ctx: Ctx, v: Vue) {
    const P = v.palette;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const x = v.W * (0.15 + i * 0.27) + Math.sin(v.reel * 0.15 + i * 1.7) * 60;
      const l = 70 + i * 25;
      const g = ctx.createLinearGradient(x, 0, x - 260, 600);
      const a = 0.025 + 0.015 * Math.sin(v.reel * 0.4 + i) + 0.02 * v.mesure;
      g.addColorStop(0, rvb(eclaircir(P.brume, 0.4), a));
      g.addColorStop(1, rvb(P.brume, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - l / 2, 0);
      ctx.lineTo(x + l / 2, 0);
      ctx.lineTo(x - 240 + l, 600);
      ctx.lineTo(x - 320, 600);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private lucioles_(ctx: Ctx, v: Vue, proches: boolean) {
    const P = v.palette;
    ctx.globalCompositeOperation = "lighter";
    for (const l of this.lucioles) {
      if (proches !== l.profondeur > 1) continue;
      const largeur = v.W + 200;
      const x = ((((l.x * largeur - v.temps * v.pixelsParTemps * l.profondeur * 0.5 + Math.sin(v.reel * l.vitesse + l.phase) * 30) % largeur) + largeur) % largeur) - 100;
      const y = l.y * v.H + Math.sin(v.reel * l.vitesse * 0.7 + l.phase * 2) * 25;
      const clignote = Math.max(0, Math.sin(v.reel * l.vitesse * 1.5 + l.phase));
      const a = (0.25 + 0.75 * clignote) * (0.6 + 0.6 * v.battement);
      const r = 2 + l.profondeur * 3;
      lueur(ctx, x, y, r * 6, P.lucioles, a * 0.5);
      lueur(ctx, x, y, r, eclaircir(P.lucioles, 0.6), a);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private sol(ctx: Ctx, v: Vue) {
    const P = v.palette;
    const y0 = v.ySol;
    const g = ctx.createLinearGradient(0, y0, 0, v.H);
    g.addColorStop(0, rvb(melangerRvb(P.sol, P.brume, 0.18)));
    g.addColorStop(0.15, rvb(P.sol));
    g.addColorStop(1, rvb(melangerRvb(P.sol, [0, 0, 0], 0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, v.W, v.H - y0);

    const debut = Math.floor(v.temps - v.xCoureur / v.pixelsParTemps) - 1;
    const fin = Math.ceil(v.temps + (v.W - v.xCoureur) / v.pixelsParTemps) + 1;

    // Racines lumineuses sous la terre : une veine par demi-temps, qui s'allume au passage du pouls.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let k = debut * 2; k <= fin * 2; k++) {
      const r = hasard(k * 7919 + 13);
      const x = xEcran(v, k / 2);
      const prof = 20 + r() * 110;
      const c = P.lueurs[((k % 3) + 3) % 3];
      ctx.strokeStyle = rvb(c, 0.1 + 0.12 * v.pouls);
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y0 + 4);
      ctx.bezierCurveTo(x + 20, y0 + prof * 0.4, x - 30 + r() * 60, y0 + prof * 0.7, x + r() * 80 - 40, y0 + prof);
      ctx.stroke();
    }

    // Repères de temps sur le sol : on voit la mesure défiler.
    for (let k = debut; k <= fin; k++) {
      const x = xEcran(v, k);
      const premier = k % 4 === 0;
      const d = Math.abs(x - v.xCoureur);
      const proche = Math.max(0, 1 - d / 60);
      const a = (premier ? 0.55 : 0.28) + proche * 0.6;
      const c = premier ? eclaircir(P.lueurs[0], 0.3) : P.lueurs[1];
      lueur(ctx, x, y0 + 6, premier ? 16 : 10, c, a);
      if (premier) lueur(ctx, x, y0 + 6, 46, P.lueurs[0], 0.12 + proche * 0.3, 2.5);
    }
    ctx.globalCompositeOperation = "source-over";

    // Herbes et fleurs posées sur le sol (le décor proche suit le coureur).
    const herbe = rvb(melangerRvb(P.proche, P.sol, 0.3));
    ctx.strokeStyle = herbe;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pas = 7;
    const x0 = Math.floor((v.temps * v.pixelsParTemps - v.xCoureur) / pas) * pas;
    for (let wx = x0; wx < x0 + v.W + pas * 2; wx += pas) {
      const r = hasard(wx * 31 + 5)();
      const x = wx - (v.temps * v.pixelsParTemps - v.xCoureur);
      const h = 6 + r * 16 + Math.sin(wx * 0.013) * 5;
      const vent = Math.sin(v.reel * 2 + wx * 0.02) * 3 + v.pouls * 3;
      ctx.moveTo(x, y0 + 2);
      ctx.quadraticCurveTo(x + vent * 0.5, y0 - h * 0.5, x + vent - 2, y0 - h);
    }
    ctx.stroke();

    // Bord du sol : une mousse qui luit
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rvb(P.lueurs[0], 0.5 + 0.3 * v.pouls);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 1);
    ctx.lineTo(v.W, y0 + 1);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    for (let k = debut * 2; k <= fin * 2; k++) {
      const r = hasard(k * 104729 + 1);
      const quoi = r();
      if (quoi > 0.55) continue;
      const x = xEcran(v, k / 2) + (r() - 0.5) * 80;
      const c = P.lueurs[Math.floor(r() * 3)];
      if (quoi < 0.25) this.fleur(ctx, v, x, y0, 14 + r() * 22, c, r() * 6);
      else this.petitChampignon(ctx, v, x, y0, 8 + r() * 14, c);
    }
  }

  private fleur(ctx: Ctx, v: Vue, x: number, y: number, h: number, c: RVB, phase: number) {
    const ondule = Math.sin(v.reel * 2.2 + phase) * 3;
    ctx.strokeStyle = rvb(v.palette.proche);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 3, y - h * 0.6, x + ondule, y - h);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    const s = 1 + 0.5 * v.pouls;
    lueur(ctx, x + ondule, y - h, 12 * s, c, 0.55);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + phase;
      lueur(ctx, x + ondule + Math.cos(a) * 3.5 * s, y - h + Math.sin(a) * 3.5 * s, 3, eclaircir(c, 0.4), 0.9);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private petitChampignon(ctx: Ctx, v: Vue, x: number, y: number, h: number, c: RVB) {
    ctx.fillStyle = rvb(v.palette.proche);
    ctx.fillRect(x - 1.5, y - h, 3, h);
    const r = h * 0.55;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rvb(c, 0.55 + 0.3 * v.pouls);
    ctx.beginPath();
    ctx.ellipse(x, y - h, r, r * 0.55, 0, Math.PI, 0);
    ctx.fill();
    lueur(ctx, x, y - h, r * 3 * (1 + 0.4 * v.pouls), c, 0.4);
    ctx.globalCompositeOperation = "source-over";
  }
}

/** Où bat le cœur de l'Arbre-Cœur à l'écran, et à quelle échelle. */
export function positionCoeur(v: Vue): { x: number; y: number; s: number } {
  const s = 0.55 + Math.pow(v.progression, 1.5) * 0.85;
  return { x: v.W * 0.7 - v.progression * v.W * 0.1, y: 470 - 250 * s, s };
}

export function tracerCoeur(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}
