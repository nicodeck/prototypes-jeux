// Les obstacles : la ronce (à sauter), le rôdeur (à frapper), la liane-gousse (à éviter en glissant).
// Chacun porte un repère au sol et un anneau d'approche qui se referme exactement sur le temps.

import type { EtatObstacle } from "../jeu";
import { eclaircir, hasard, hexVersRvb, melangerRvb, rvb, type RVB } from "../outils";
import { REGLAGES, type Action } from "../reglages";
import { lueur, type Ctx } from "./ecran";
import type { Vue } from "./vue";
import { xEcran } from "./vue";

const COULEURS: Record<Action, RVB> = {
  saut: hexVersRvb(REGLAGES.couleursActions.saut),
  frappe: hexVersRvb(REGLAGES.couleursActions.frappe),
  glisse: hexVersRvb(REGLAGES.couleursActions.glisse),
};
const GRIS: RVB = [110, 90, 100];
const SOMBRE = "#07060c";

const GLYPHES: Record<Action, string> = { saut: "ESPACE", frappe: "X", glisse: "↓" };

/** Hauteur du centre de chaque obstacle au-dessus du sol. */
export const HAUTEUR: Record<Action, number> = { saut: 24, frappe: 62, glisse: 74 };

export function dessinerObstacles(ctx: Ctx, v: Vue, obstacles: EtatObstacle[], aide: boolean) {
  const vus: EtatObstacle[] = [];
  for (const e of obstacles) {
    const x = xEcran(v, e.o.temps);
    if (x < -150) continue;
    if (x > v.W + 150) break;
    if (e.jugement && e.jugement !== "rate" && v.t - e.tJugement > 0.5) continue;
    vus.push(e);
  }
  // Repères au sol d'abord, pour qu'ils passent sous tous les obstacles.
  for (const e of vus) repere(ctx, v, e);
  for (const e of vus) {
    if (e.o.action === "saut") ronce(ctx, v, e);
    else if (e.o.action === "frappe") rodeur(ctx, v, e);
    else liane(ctx, v, e);
  }
  for (const e of vus) anneau(ctx, v, e, aide);
}

function couleur(e: EtatObstacle): RVB {
  return e.jugement === "rate" ? GRIS : COULEURS[e.o.action];
}

function repere(ctx: Ctx, v: Vue, e: EtatObstacle) {
  if (e.jugement && e.jugement !== "rate") return;
  const x = xEcran(v, e.o.temps);
  const c = couleur(e);
  ctx.globalCompositeOperation = "lighter";
  lueur(ctx, x, v.ySol + 6, 40, c, 0.55, 2);
  ctx.fillStyle = rvb(eclaircir(c, 0.4), 0.9);
  ctx.beginPath();
  ctx.moveTo(x - 9, v.ySol + 6);
  ctx.lineTo(x, v.ySol + 1);
  ctx.lineTo(x + 9, v.ySol + 6);
  ctx.lineTo(x, v.ySol + 11);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/** Anneau d'approche : il se referme sur l'obstacle à l'instant exact du temps. */
function anneau(ctx: Ctx, v: Vue, e: EtatObstacle, aide: boolean) {
  if (e.jugement) return;
  const d = e.o.temps - v.temps;
  if (d < -0.1 || d > 2) return;
  const x = xEcran(v, e.o.temps);
  const y = v.ySol - HAUTEUR[e.o.action];
  const c = COULEURS[e.o.action];
  const r = 30 + Math.max(0, d) * 46;
  const a = Math.min(1, (2 - d) / 1.2);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rvb(c, 0.75 * a);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (d < 0.25) lueur(ctx, x, y, 50, c, (0.25 - Math.max(0, d)) * 3);
  ctx.globalCompositeOperation = "source-over";
  if (aide && d < 3) {
    ctx.font = "700 15px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = rvb(eclaircir(c, 0.5), Math.min(1, a * 1.3));
    ctx.fillText(GLYPHES[e.o.action], x, y - r - 10);
  }
}

function ronce(ctx: Ctx, v: Vue, e: EtatObstacle) {
  const x = xEcran(v, e.o.temps);
  const c = couleur(e);
  const reussi = e.jugement && e.jugement !== "rate";
  const k = reussi ? Math.min(1, (v.t - e.tJugement) / 0.25) : 0;
  const h = (1 - k * k) * 1;
  if (h <= 0.01) return;
  const r = hasard(e.o.id * 31 + 7);
  ctx.save();
  ctx.translate(x, v.ySol);
  ctx.scale(1, h);
  // Monticule
  ctx.fillStyle = SOMBRE;
  ctx.beginPath();
  ctx.ellipse(0, 2, 30, 14, 0, Math.PI, 0);
  ctx.fill();
  const bouts: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const bx = -22 + i * 7.5 + (r() - 0.5) * 4;
    const ang = -Math.PI / 2 + (i - 3) * 0.28 + Math.sin(v.reel * 3 + i) * 0.05;
    const l = 30 + r() * 24 - Math.abs(i - 3) * 3;
    const ex = bx + Math.cos(ang) * l;
    const ey = Math.sin(ang) * l - 4 * v.pouls;
    ctx.strokeStyle = SOMBRE;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + (ex - bx) * 0.2 + (i - 3) * 3, ey * 0.6, ex, ey);
    ctx.stroke();
    // épines
    ctx.lineWidth = 2;
    for (let j = 1; j < 4; j++) {
      const px = bx + (ex - bx) * (j / 4);
      const py = ey * (j / 4);
      const s = j % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + s * 7, py - 4);
      ctx.stroke();
    }
    bouts.push([ex, ey]);
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rvb(c, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 2, 30, 14, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  for (const [bx, by] of bouts) {
    lueur(ctx, bx, by, 16 + 8 * v.pouls, c, 0.8);
    lueur(ctx, bx, by, 4.5, eclaircir(c, 0.7), 1);
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

function rodeur(ctx: Ctx, v: Vue, e: EtatObstacle) {
  const x = xEcran(v, e.o.temps);
  const c = couleur(e);
  const reussi = e.jugement && e.jugement !== "rate";
  if (reussi && v.t - e.tJugement > 0.12) return;
  const gonfle = reussi ? 1 + (v.t - e.tJugement) * 5 : 1;
  const bat = Math.sin(v.temps * Math.PI * 2);
  const y = v.ySol - HAUTEUR.frappe + bat * 4;
  const r = hasard(e.o.id * 17 + 3);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(gonfle, gonfle);
  if (reussi) ctx.globalAlpha = Math.max(0, 1 - (v.t - e.tJugement) / 0.12);

  // Halo inquiétant
  ctx.globalCompositeOperation = "lighter";
  lueur(ctx, 0, 0, 70, melangerRvb(c, [60, 0, 80], 0.5), 0.35 + 0.2 * v.pouls);
  ctx.globalCompositeOperation = "source-over";

  // Ailes membraneuses
  const aile = 0.5 + 0.5 * Math.sin(v.reel * 18);
  ctx.fillStyle = SOMBRE;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, -6);
    ctx.quadraticCurveTo(s * 40, -40 - aile * 16, s * 52, -14 + aile * 10);
    ctx.quadraticCurveTo(s * 34, -10, s * 30, 4);
    ctx.quadraticCurveTo(s * 20, -2, s * 8, 6);
    ctx.fill();
  }
  // Tentacules
  ctx.strokeStyle = SOMBRE;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const bx = -9 + i * 6;
    ctx.beginPath();
    ctx.moveTo(bx, 14);
    ctx.quadraticCurveTo(bx + Math.sin(v.reel * 5 + i) * 6, 30, bx + Math.sin(v.reel * 4 + i * 2) * 8, 40);
    ctx.stroke();
  }
  // Corps hérissé
  ctx.beginPath();
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 2 ? 19 : 24 + r() * 7 + v.pouls * 4;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr * 0.92;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fill();
  // Yeux
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rvb(c, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 23, -2.6, -0.5);
  ctx.stroke();
  for (const s of [-1, 1]) {
    lueur(ctx, -6 + s * 7, -3, 14, c, 0.9);
    ctx.fillStyle = rvb(eclaircir(c, 0.6));
    ctx.beginPath();
    ctx.ellipse(-6 + s * 7, -3, 3.5, 2.2, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bouche en croissant
  ctx.strokeStyle = rvb(c, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-6, 4, 7, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

function liane(ctx: Ctx, v: Vue, e: EtatObstacle) {
  const x = xEcran(v, e.o.temps);
  const c = couleur(e);
  const reussi = e.jugement && e.jugement !== "rate";
  const k = reussi ? Math.min(1, (v.t - e.tJugement) / 0.35) : 0;
  const remonte = k * k * 420;
  const balance = Math.sin(v.reel * 1.8 + e.o.id) * 4;
  const yGousse = v.ySol - HAUTEUR.glisse - remonte;
  const gx = x + balance;

  ctx.strokeStyle = SOMBRE;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 10, -20);
  ctx.bezierCurveTo(x + 18, yGousse * 0.35, x - 16, yGousse * 0.7, gx, yGousse - 16);
  ctx.stroke();
  // feuilles le long de la liane
  ctx.fillStyle = SOMBRE;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const ly = -20 + (yGousse + 4) * t;
    const lx = x + Math.sin(t * 5 + e.o.id) * 10;
    const s = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + s * 18, ly - 12, lx + s * 26, ly + 2);
    ctx.quadraticCurveTo(lx + s * 12, ly + 6, lx, ly);
    ctx.fill();
  }
  // La gousse épineuse
  ctx.save();
  ctx.translate(gx, yGousse);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? 16 : 25;
    const px = Math.cos(a) * rr * 0.85;
    const py = Math.sin(a) * rr * 1.1;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  lueur(ctx, 0, 2, 44 + 10 * v.pouls, c, 0.7);
  ctx.fillStyle = rvb(eclaircir(c, 0.3), 0.9);
  ctx.beginPath();
  ctx.ellipse(0, 2, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  lueur(ctx, 0, 2, 7, [255, 255, 255], 0.9);
  // Barre d'ombre : la hauteur à ne pas toucher
  ctx.restore();
  if (!reussi) {
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
    g.addColorStop(0, rvb(c, 0));
    g.addColorStop(0.5, rvb(c, 0.5));
    g.addColorStop(1, rvb(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, yGousse + 28, 80, 2);
  }
  ctx.globalCompositeOperation = "source-over";
}
