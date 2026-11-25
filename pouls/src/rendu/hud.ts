// L'interface pendant la partie : score, combo, jauge de pouls (un électrocardiogramme), progression,
// titres de section et panneaux d'aide posés dans le décor.

import type { Jeu } from "../jeu";
import { eclaircir, melangerRvb, rvb, type RVB } from "../outils";
import type { Partition } from "../partition";
import { REGLAGES } from "../reglages";
import { tracerCoeur } from "./decor";
import { lueur, type Ctx } from "./ecran";
import type { Vue } from "./vue";
import { xEcran } from "./vue";

const BLANC: RVB = [240, 244, 255];
const ROMAINS = ["I", "II", "III", "IV"];

export class Hud {
  private scoreAffiche = 0;
  private dernierCombo = 0;
  private tCombo = -9;

  reinitialiser() {
    this.scoreAffiche = 0;
    this.dernierCombo = 0;
  }

  dessiner(ctx: Ctx, v: Vue, jeu: Jeu, p: Partition) {
    this.scoreAffiche += (jeu.score - this.scoreAffiche) * 0.2;
    if (jeu.combo !== this.dernierCombo) {
      if (jeu.combo > this.dernierCombo) this.tCombo = v.reel;
      this.dernierCombo = jeu.combo;
    }
    const P = v.palette;
    ctx.textBaseline = "alphabetic";

    // Score
    ctx.textAlign = "left";
    ctx.font = "600 13px Outfit, sans-serif";
    ctx.fillStyle = "rgba(220,230,255,0.6)";
    ctx.fillText("SCORE", 34, 42);
    ctx.font = "800 34px Outfit, sans-serif";
    ctx.fillStyle = rvb(BLANC);
    ctx.fillText(Math.round(this.scoreAffiche).toLocaleString("fr-FR"), 32, 78);
    const m = jeu.multiplicateur;
    if (m > 1) {
      ctx.font = "900 20px Unbounded, sans-serif";
      ctx.fillStyle = rvb([255, 220, 130]);
      ctx.fillText(`×${m}`, 34, 106);
    }

    this.pouls(ctx, v, jeu, p, 34, m > 1 ? 128 : 104);

    // Combo
    if (jeu.combo >= 2) {
      const k = Math.max(0, 1 - (v.reel - this.tCombo) / 0.18);
      const t = 1 + 0.25 * k;
      ctx.save();
      ctx.translate(v.W - 34, 78);
      ctx.scale(t, t);
      ctx.textAlign = "right";
      ctx.globalCompositeOperation = "lighter";
      lueur(ctx, -40, -14, 70, P.trainee, 0.18 + 0.25 * k, 1.8);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = "900 44px Unbounded, sans-serif";
      ctx.fillStyle = rvb(eclaircir(P.trainee, 0.55 + 0.4 * k));
      ctx.fillText(String(jeu.combo), 0, 0);
      ctx.restore();
      ctx.textAlign = "right";
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.fillStyle = "rgba(220,230,255,0.6)";
      ctx.fillText("COMBO", v.W - 34, 100);
    }

    this.progression(ctx, v, p);
    this.titreSection(ctx, v, p);
  }

  /** La jauge de vie est un tracé de pouls : chaque battement suit la grosse caisse, son amplitude suit la vie. */
  private pouls(ctx: Ctx, v: Vue, jeu: Jeu, p: Partition, x: number, y: number) {
    const w = 190;
    const h = 34;
    const vie = jeu.vie / REGLAGES.vie.max;
    const c: RVB = vie > 0.5 ? melangerRvb([255, 190, 80], [90, 255, 190], (vie - 0.5) * 2) : melangerRvb([255, 50, 70], [255, 190, 80], vie * 2);
    ctx.fillStyle = "rgba(4,6,14,0.45)";
    arrondi(ctx, x - 6, y - 4, w + 40, h + 8, 8);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rvb(c, 0.95);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const fenetre = 2.2;
    for (let i = 0; i <= w; i += 2) {
      const t = v.t - (1 - i / w) * fenetre;
      const temps = p.secondesVersTemps(Math.max(0, t));
      const tb = p.tempsVersSecondes(Math.floor(temps / 2) * 2);
      const d = t - tb;
      const amp = (0.25 + 0.75 * vie) * h * 0.5;
      const yy = y + h / 2 - ecg(d) * amp;
      if (i === 0) ctx.moveTo(x + i, yy);
      else ctx.lineTo(x + i, yy);
    }
    ctx.stroke();
    lueur(ctx, x + w, y + h / 2, 18, c, 0.8);
    ctx.globalCompositeOperation = "source-over";
    const b = 1 + 0.3 * v.pouls;
    ctx.fillStyle = rvb(c);
    tracerCoeur(ctx, x + w + 20, y + h / 2 + 1, 8 * b);
    ctx.fill();
  }

  private progression(ctx: Ctx, v: Vue, p: Partition) {
    const w = 320;
    const x0 = v.W / 2 - w / 2;
    const y = 34;
    const k = Math.max(0, Math.min(1, v.t / (p.duree - 2.5)));
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x0, y - 1, w, 2);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rvb(v.palette.trainee, 0.8);
    ctx.fillRect(x0, y - 1, w * k, 2);
    for (const d of p.debutsSections.slice(1)) {
      const sx = x0 + (d.t / (p.duree - 2.5)) * w;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(sx - 1, y - 5, 2, 10);
    }
    lueur(ctx, x0 + w * k, y, 16, v.palette.trainee, 0.9);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rvb(v.palette.horizon);
    tracerCoeur(ctx, x0 + w + 14, y + 1, 7 * (1 + 0.3 * v.pouls));
    ctx.fill();
  }

  private titreSection(ctx: Ctx, v: Vue, p: Partition) {
    p.debutsSections.forEach((d, i) => {
      const t0 = i === 0 ? 0.6 : d.t;
      const k = (v.t - t0) / 3.6;
      if (k < 0 || k > 1) return;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const s = p.sections[i];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalCompositeOperation = "lighter";
      lueur(ctx, v.W / 2, 190, 260, v.palette.horizon, 0.22 * a, 2.5);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = "400 22px Unbounded, sans-serif";
      ctx.fillStyle = rvb(eclaircir(v.palette.horizon, 0.5), a * 0.9);
      ctx.fillText(ROMAINS[i], v.W / 2, 150);
      const espace = 1 + (1 - a) * 0.1;
      ctx.font = `700 ${Math.round(46 * espace)}px Unbounded, sans-serif`;
      ctx.fillStyle = rvb(BLANC, a);
      ctx.fillText(s.nom, v.W / 2, 198);
      ctx.font = "600 16px Outfit, sans-serif";
      ctx.fillStyle = rvb(eclaircir(v.palette.horizon, 0.4), a * 0.8);
      ctx.fillText(`${s.bpm} battements par minute`, v.W / 2, 240);
      const l = 160 * Math.min(1, k * 4);
      ctx.fillStyle = rvb(v.palette.horizon, a * 0.7);
      ctx.fillRect(v.W / 2 - l, 268, l * 2, 1.5);
    });
  }
}

/** Forme d'un battement de cœur sur un électrocardiogramme (d en secondes après le battement). */
export function ecg(d: number): number {
  const bosse = (c: number, l: number, a: number) => a * Math.exp(-((d - c) * (d - c)) / (l * l));
  return bosse(-0.06, 0.02, 0.12) + bosse(0, 0.008, -0.25) + bosse(0.015, 0.009, 1) + bosse(0.035, 0.01, -0.45) + bosse(0.2, 0.045, 0.22);
}

export function arrondi(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Les panneaux d'aide flottent dans le décor et défilent avec lui. */
export function dessinerPanneaux(ctx: Ctx, v: Vue, p: Partition) {
  for (const pn of p.panneaux) {
    const x = xEcran(v, pn.temps + 2);
    if (x < -300 || x > v.W + 300) continue;
    const y = v.ySol - 250;
    const a = Math.min(1, Math.max(0, (v.W + 100 - x) / 300)) * Math.min(1, Math.max(0, (x + 200) / 300));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalCompositeOperation = "lighter";
    lueur(ctx, x, y, 170, v.palette.lueurs[0], 0.22 * a, 2.4);
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "800 30px Outfit, sans-serif";
    ctx.fillStyle = rvb(BLANC, a);
    ctx.fillText(pn.texte, x, y);
  }
}
