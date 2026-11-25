// Brin, le coureur : un petit esprit-graine au cœur lumineux, une pousse sur la tête et une écharpe de lumière.
// Sa foulée est calée sur le tempo (un pas par croche) et son cœur bat avec la grosse caisse.

import type { Coureur } from "../jeu";
import { eclaircir, melangerRvb, rvb, type RVB } from "../outils";
import { REGLAGES } from "../reglages";
import { lueur, type Ctx } from "./ecran";
import { tracerCoeur } from "./decor";
import type { Vue } from "./vue";

const COEUR: RVB = [255, 92, 140];
const CORPS = "#0a0c16";
/** Taille du coureur (le dessin est fait pour une hauteur d'environ 60). */
const E = 1.3;

interface Point {
  wx: number;
  y: number;
  t: number;
}

export interface Pose {
  /** Hauteur des pieds au-dessus du sol. */
  h: number;
  rotation: number;
  echX: number;
  echY: number;
  glisse: boolean;
  frappe: number;
  blessure: number;
  enLair: boolean;
}

export function poseCoureur(c: Coureur, t: number): Pose {
  const pose: Pose = { h: 0, rotation: 0.1, echX: 1, echY: 1, glisse: false, frappe: -1, blessure: -1, enLair: false };
  const ts = t - c.saut;
  if (ts >= 0 && ts < c.dureeSaut) {
    const p = ts / c.dureeSaut;
    pose.h = REGLAGES.coureur.hauteurSaut * Math.pow(1 - (1 - 2 * p) * (1 - 2 * p), 0.7);
    pose.enLair = true;
    pose.rotation = c.vrille ? -p * Math.PI * 2 : -0.15 + p * 0.4;
    const etire = p < 0.25 ? 1 - p * 4 : 0;
    pose.echX = 1 - 0.18 * etire;
    pose.echY = 1 + 0.25 * etire;
  } else if (ts >= c.dureeSaut && ts < c.dureeSaut + 0.12) {
    const k = 1 - (ts - c.dureeSaut) / 0.12;
    pose.echX = 1 + 0.25 * k;
    pose.echY = 1 - 0.22 * k;
  }
  const tg = t - c.glisse;
  if (tg >= 0 && tg < c.dureeGlisse) {
    pose.glisse = true;
    const entree = Math.min(1, tg / 0.05);
    pose.echX = 1 + 0.35 * entree;
    pose.echY = 1 - 0.45 * entree;
    pose.rotation = -0.35 * entree;
  }
  const tf = t - c.frappe;
  if (tf >= 0 && tf < REGLAGES.coureur.frappeSecondes) pose.frappe = tf / REGLAGES.coureur.frappeSecondes;
  const tb = t - c.blessure;
  if (tb >= 0 && tb < 0.5) pose.blessure = tb / 0.5;
  return pose;
}

export class DessinCoureur {
  private ruban: Point[] = [];

  /** Remet l'écharpe à zéro (nouvelle partie). */
  reinitialiser() {
    this.ruban = [];
  }

  dessiner(ctx: Ctx, v: Vue, c: Coureur, horsJeu = false) {
    const pose = horsJeu ? poseCoureur({ ...c, saut: -99, glisse: -99, frappe: -99, blessure: -99 }, v.t) : poseCoureur(c, v.t);
    const P = v.palette;
    const recul = pose.blessure >= 0 ? -14 * Math.sin(pose.blessure * Math.PI) : 0;
    const x = v.xCoureur + recul;
    const phase = v.temps * Math.PI * 2;
    const rebond = pose.enLair || pose.glisse ? 0 : Math.abs(Math.sin(phase)) * 4;
    const yPieds = v.ySol - pose.h - rebond;
    const yCorps = yPieds - (pose.glisse ? 16 : 34) * E;

    // Ombre et halo au sol
    const loin = Math.min(1, pose.h / 150);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - loin * 0.7)})`;
    ctx.beginPath();
    ctx.ellipse(x, v.ySol + 3, 30 * (1 - loin * 0.4), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    lueur(ctx, x, v.ySol + 2, 60, P.trainee, 0.25 * (1 - loin), 2.2);
    ctx.globalCompositeOperation = "source-over";

    this.dessinerRuban(ctx, v, x, yCorps - 8 * E, pose);

    ctx.save();
    ctx.translate(x, yCorps);
    ctx.scale(E, E);
    ctx.rotate(pose.rotation);
    ctx.scale(pose.echX, pose.echY);

    const rouge = pose.blessure >= 0 && Math.floor(pose.blessure * 10) % 2 === 0;
    const bord: RVB = rouge ? [255, 70, 70] : eclaircir(P.trainee, 0.3);

    // Jambes
    if (!pose.glisse) this.jambes(ctx, pose, phase);
    else {
      ctx.strokeStyle = CORPS;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-4, 14);
      ctx.lineTo(18, 18);
      ctx.moveTo(-6, 14);
      ctx.lineTo(10, 20);
      ctx.stroke();
    }

    // Bras arrière
    const balancier = pose.enLair ? -0.8 : Math.sin(phase) * 0.9;
    this.bras(ctx, -2, 2, Math.PI / 2 + balancier + 0.3, 14);

    // Corps : une graine ronde, penchée vers l'avant
    ctx.fillStyle = CORPS;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.bezierCurveTo(16, -24, 20, -4, 17, 8);
    ctx.bezierCurveTo(14, 20, -14, 22, -17, 8);
    ctx.bezierCurveTo(-20, -6, -14, -24, 0, -24);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rvb(bord, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.bezierCurveTo(8, -26, 18, -12, 17, 6);
    ctx.stroke();
    ctx.strokeStyle = rvb(bord, 0.3);
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.bezierCurveTo(-18, 6, -12, 18, 0, 18);
    ctx.stroke();

    // Le cœur, qui bat avec la musique
    const b = 1 + 0.45 * v.pouls;
    lueur(ctx, -2, 5, 26 * b, COEUR, 0.6 + 0.4 * v.pouls);
    ctx.fillStyle = rvb(eclaircir(COEUR, 0.3 + 0.3 * v.pouls));
    tracerCoeur(ctx, -2, 5, 5.5 * b);
    ctx.fill();

    // L'œil
    if (pose.blessure >= 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -14);
      ctx.lineTo(10, -8);
      ctx.moveTo(10, -14);
      ctx.lineTo(4, -8);
      ctx.stroke();
    } else {
      const cligne = (v.reel % 3.7) < 0.12 ? 0.15 : 1;
      lueur(ctx, 8, -11, 14, eclaircir(P.trainee, 0.5), 0.6);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(8, -11, 3.6, 5 * cligne, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // La pousse sur la tête, qui fouette quand on saute
    const fouet = pose.enLair ? -0.6 : Math.sin(phase * 2) * 0.12 - 0.25 - v.pouls * 0.15;
    ctx.save();
    ctx.translate(-2, -23);
    ctx.rotate(fouet);
    ctx.strokeStyle = CORPS;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -10, -10, -16);
    ctx.stroke();
    ctx.fillStyle = CORPS;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-10, -16);
      ctx.quadraticCurveTo(-10 + s * 10, -28, -10 - 14 + s * 4, -24);
      ctx.quadraticCurveTo(-16 + s * 2, -14, -10, -16);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    lueur(ctx, -22, -24, 12, P.trainee, 0.8);
    lueur(ctx, -22, -24, 4, eclaircir(P.trainee, 0.7), 1);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // Bras avant, et le coup
    if (pose.frappe >= 0) {
      const a = -1.2 + pose.frappe * 2.4;
      this.bras(ctx, 4, 2, a, 20);
    } else {
      this.bras(ctx, 4, 2, Math.PI / 2 - balancier - 0.2, 14);
    }
    ctx.restore();

    if (pose.frappe >= 0) this.arcDeFrappe(ctx, x + 14, yCorps - 4, pose.frappe);
  }

  private jambes(ctx: Ctx, pose: Pose, phase: number) {
    ctx.strokeStyle = CORPS;
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const k of [0, 1]) {
      const p = phase + k * Math.PI;
      let fx: number;
      let fy: number;
      if (pose.enLair) {
        fx = k ? -8 : 10;
        fy = k ? 26 : 22;
      } else {
        fx = Math.sin(p) * 13;
        fy = 34 - Math.max(0, Math.cos(p)) * 9;
      }
      const hx = k ? -4 : 3;
      const kx = (hx + fx) / 2 + 5;
      const ky = (16 + fy) / 2;
      ctx.beginPath();
      ctx.moveTo(hx, 14);
      ctx.quadraticCurveTo(kx, ky, fx, fy);
      ctx.stroke();
    }
  }

  private bras(ctx: Ctx, x: number, y: number, angle: number, longueur: number) {
    ctx.strokeStyle = CORPS;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * longueur, y + Math.sin(angle) * longueur);
    ctx.stroke();
  }

  private arcDeFrappe(ctx: Ctx, x: number, y: number, p: number) {
    const coul: RVB = [255, 110, 160];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const a0 = -1.3;
    const a1 = -1.3 + Math.min(1, p * 1.6) * 2.6;
    const fade = 1 - Math.max(0, (p - 0.5) * 2);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rvb(eclaircir(coul, i * 0.35), (0.35 + i * 0.25) * fade);
      ctx.lineWidth = 14 - i * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, y, 46 + i * 2, a0 + (a1 - a0) * 0.3, a1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** L'écharpe de lumière : les positions passées du cou, qui glissent en arrière avec le monde. */
  private dessinerRuban(ctx: Ctx, v: Vue, x: number, y: number, pose: Pose) {
    const wx = v.temps * v.pixelsParTemps + (x - v.xCoureur);
    const r = this.ruban;
    if (r.length && (v.t < r[r.length - 1].t || Math.abs(wx - r[r.length - 1].wx) > 400)) r.length = 0;
    r.push({ wx, y, t: v.t });
    while (r.length > 2 && v.t - r[0].t > 0.32) r.shift();
    if (r.length < 3) return;
    const P = v.palette;
    const pts = r.map((p, i) => {
      const age = (v.t - p.t) / 0.32;
      return {
        x: v.xCoureur + (p.wx - wx) + (x - v.xCoureur) - age * 26,
        y: p.y + Math.sin(v.reel * 9 - i * 0.6) * 3 * age,
        l: (1 - age) * (pose.glisse ? 5 : 7),
        a: 1 - age,
      };
    });
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = melangerRvb(P.trainee, COEUR, 1 - b.a);
      ctx.strokeStyle = rvb(c, 0.55 * b.a);
      ctx.lineWidth = b.l * 2 + 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = rvb(eclaircir(c, 0.6), 0.8 * b.a);
      ctx.lineWidth = Math.max(1, b.l * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
}
