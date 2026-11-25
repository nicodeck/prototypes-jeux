// Écran titre, calibration, pause et écran de fin, dessinés par-dessus la jungle.

import type { Jeu } from "../jeu";
import { lettre, precision } from "../jugement";
import { eclaircir, hexVersRvb, rvb, type RVB } from "../outils";
import { REGLAGES } from "../reglages";
import { lueur, type Ctx } from "./ecran";
import { arrondi, ecg } from "./hud";
import type { Vue } from "./vue";

const BLANC: RVB = [240, 244, 255];

function voile(ctx: Ctx, v: Vue, a: number) {
  const g = ctx.createLinearGradient(0, 0, 0, v.H);
  g.addColorStop(0, `rgba(2,3,10,${a})`);
  g.addColorStop(0.5, `rgba(2,3,10,${a * 0.55})`);
  g.addColorStop(1, `rgba(2,3,10,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.W, v.H);
}

function texte(ctx: Ctx, t: string, x: number, y: number, police: string, c: RVB, a = 1, align: CanvasTextAlign = "center") {
  ctx.font = police;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = rvb(c, a);
  ctx.fillText(t, x, y);
}

/** Une ligne de pouls qui traverse l'écran : la signature du jeu. */
function lignePouls(ctx: Ctx, v: Vue, y: number, amp: number, c: RVB, periode: number, a: number) {
  ctx.globalCompositeOperation = "lighter";
  for (const [l, al] of [
    [6, 0.15],
    [2, 0.9],
  ] as const) {
    ctx.strokeStyle = rvb(c, al * a);
    ctx.lineWidth = l;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let x = 0; x <= v.W; x += 3) {
      const t = v.reel - (v.W - x) / 520;
      const d = ((t % periode) + periode) % periode;
      const yy = y - ecg(d - 0.1) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

export function dessinerTitre(ctx: Ctx, v: Vue, latenceMs: number, pret: boolean) {
  voile(ctx, v, 0.55);
  const P = v.palette;
  const cx = v.W / 2;
  const periode = 60 / 80;
  const d = ((v.reel % periode) + periode) % periode;
  const bat = Math.exp(-d * 7) + 0.6 * Math.exp(-Math.max(0, d - 0.18) * 9) * (d > 0.18 ? 1 : 0);

  lignePouls(ctx, v, 232, 70, P.horizon, periode, 0.55);

  ctx.globalCompositeOperation = "lighter";
  lueur(ctx, cx, 220, 380, P.horizon, 0.22 + 0.15 * bat, 2.2);
  ctx.globalCompositeOperation = "source-over";
  const s = 1 + 0.03 * bat;
  ctx.save();
  ctx.translate(cx, 222);
  ctx.scale(s, s);
  ctx.font = "900 150px Unbounded, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "18px";
  ctx.lineWidth = 3;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rvb(P.horizon, 0.55 + 0.4 * bat);
  ctx.strokeText("POULS", 9, 0);
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createLinearGradient(0, -70, 0, 70);
  g.addColorStop(0, rvb(eclaircir(P.lueurs[1], 0.85)));
  g.addColorStop(1, rvb(eclaircir(P.horizon, 0.35)));
  ctx.fillStyle = g;
  ctx.fillText("POULS", 9, 0);
  ctx.letterSpacing = "0px";
  ctx.restore();

  texte(ctx, "Cours au rythme de la jungle qui bat.", cx, 330, "400 22px Outfit, sans-serif", eclaircir(P.lueurs[1], 0.6), 0.85);

  if (pret) {
    const clignote = 0.6 + 0.4 * Math.sin(v.reel * 4);
    texte(ctx, "ESPACE  ·  commencer", cx, 410, "800 28px Outfit, sans-serif", BLANC, clignote);
  } else {
    texte(ctx, "chargement…", cx, 410, "600 20px Outfit, sans-serif", BLANC, 0.6);
  }
  const signe = latenceMs > 0 ? "+" : "";
  texte(ctx, `C  ·  calibrer la latence      ← →  ·  latence ${signe}${latenceMs} ms`, cx, 452, "600 16px Outfit, sans-serif", BLANC, 0.6);

  const touches: [string, string, string][] = [
    ["ESPACE / ↑", "saute les ronces", REGLAGES.couleursActions.saut],
    ["X / →", "frappe les rôdeurs", REGLAGES.couleursActions.frappe],
    ["↓ / S", "glisse sous les lianes", REGLAGES.couleursActions.glisse],
  ];
  const l = 270;
  touches.forEach(([t, d2], i) => {
    const c = hexVersRvb(touches[i][2]);
    const x = cx + (i - 1) * l;
    ctx.fillStyle = "rgba(4,6,14,0.55)";
    arrondi(ctx, x - l / 2 + 12, 610, l - 24, 62, 12);
    ctx.fill();
    ctx.strokeStyle = rvb(c, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    texte(ctx, t, x, 630, "800 18px Outfit, sans-serif", eclaircir(c, 0.3));
    texte(ctx, d2, x, 654, "400 15px Outfit, sans-serif", BLANC, 0.75);
  });
  texte(ctx, "Appuie sur le temps : les obstacles arrivent avec la musique.", cx, 586, "400 15px Outfit, sans-serif", BLANC, 0.55);
}

export interface EtatCalibration {
  ecarts: number[];
  ignores: number;
  resultat: number | null;
  /** Instant (horloge de calibration) du dernier clic. */
  temps: number;
  periode: number;
}

export function dessinerCalibration(ctx: Ctx, v: Vue, c: EtatCalibration, latenceMs: number) {
  voile(ctx, v, 0.78);
  const cx = v.W / 2;
  const P = v.palette;
  texte(ctx, "Calibration", cx, 120, "700 40px Unbounded, sans-serif", BLANC);
  texte(ctx, "Tape ESPACE en même temps que chaque clic.", cx, 172, "400 20px Outfit, sans-serif", BLANC, 0.8);
  texte(ctx, "Fie-toi à l'oreille, pas à l'image.", cx, 200, "400 16px Outfit, sans-serif", BLANC, 0.55);

  const d = ((c.temps % c.periode) + c.periode) % c.periode;
  const bat = Math.exp(-d * 10);
  ctx.globalCompositeOperation = "lighter";
  lueur(ctx, cx, 330, 90 + 50 * bat, P.horizon, 0.3 + 0.6 * bat);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = rvb(BLANC, 0.4 + 0.6 * bat);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 330, 40 + 12 * bat, 0, Math.PI * 2);
  ctx.stroke();

  // Frise des écarts : à gauche trop tôt, à droite trop tard.
  const w = 500;
  const y = 470;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(cx - w / 2, y, w, 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(cx - 1, y - 12, 2, 26);
  texte(ctx, "tôt", cx - w / 2 - 30, y + 1, "400 15px Outfit, sans-serif", BLANC, 0.5);
  texte(ctx, "tard", cx + w / 2 + 32, y + 1, "400 15px Outfit, sans-serif", BLANC, 0.5);
  ctx.globalCompositeOperation = "lighter";
  c.ecarts.forEach((e, i) => {
    const x = cx + Math.max(-1, Math.min(1, e / 0.2)) * (w / 2);
    lueur(ctx, x, y + 1, 10, i < c.ignores ? [120, 120, 140] : P.lueurs[0], 0.9);
  });
  ctx.globalCompositeOperation = "source-over";
  const total = REGLAGES.latence.tapesIgnorees + REGLAGES.latence.tapesMesurees;
  if (c.resultat === null) {
    texte(ctx, `${Math.min(c.ecarts.length, total)} / ${total}`, cx, 520, "600 18px Outfit, sans-serif", BLANC, 0.7);
    texte(ctx, `latence actuelle : ${latenceMs} ms      ÉCHAP · annuler`, cx, 620, "400 15px Outfit, sans-serif", BLANC, 0.5);
  } else {
    const ms = Math.round(c.resultat * 1000);
    texte(ctx, `Tu tapes en moyenne ${Math.abs(ms)} ms ${ms >= 0 ? "après" : "avant"} le clic.`, cx, 530, "600 22px Outfit, sans-serif", BLANC);
    texte(ctx, "ENTRÉE · garder ce réglage      ÉCHAP · annuler", cx, 600, "800 18px Outfit, sans-serif", BLANC, 0.85);
  }
}

export function dessinerPause(ctx: Ctx, v: Vue) {
  voile(ctx, v, 0.6);
  texte(ctx, "Pause", v.W / 2, v.H / 2 - 30, "700 56px Unbounded, sans-serif", BLANC);
  texte(ctx, "ÉCHAP · reprendre      ENTRÉE · revenir au titre", v.W / 2, v.H / 2 + 40, "600 18px Outfit, sans-serif", BLANC, 0.75);
}

const COULEURS_NOTES: Record<string, RVB> = {
  S: [255, 226, 120],
  A: [120, 255, 210],
  B: [130, 200, 255],
  C: [220, 160, 255],
  D: [255, 120, 140],
};

export function dessinerFin(ctx: Ctx, v: Vue, jeu: Jeu, depuis: number) {
  const k = Math.min(1, depuis / 0.8);
  voile(ctx, v, 0.72 * k);
  if (depuis < 0.3) return;
  const cx = v.W / 2;
  const a = Math.min(1, (depuis - 0.3) / 0.6);
  const prec = precision(jeu.compte.parfait, jeu.compte.bien, jeu.compte.rate);
  const note = jeu.echec ? "—" : lettre(prec);
  const c = COULEURS_NOTES[note] ?? [200, 200, 220];

  texte(ctx, jeu.echec ? "Le pouls s'est éteint" : "Tu as atteint le Cœur", cx, 110, "700 34px Unbounded, sans-serif", BLANC, a);

  const pop = depuis < 1.1 ? 0 : Math.min(1, (depuis - 1.1) / 0.25);
  if (pop > 0) {
    const s = 1.6 - 0.6 * pop;
    ctx.save();
    ctx.translate(cx - 170, 300);
    ctx.scale(s, s);
    ctx.globalCompositeOperation = "lighter";
    lueur(ctx, 0, 0, 170, c, 0.5 * pop + 0.12 * v.pouls);
    ctx.globalCompositeOperation = "source-over";
    texte(ctx, note, 0, 6, "900 160px Unbounded, sans-serif", eclaircir(c, 0.4), pop);
    ctx.restore();
    texte(ctx, "NOTE", cx - 170, 410, "600 15px Outfit, sans-serif", BLANC, 0.6 * pop);
  }

  const compte = Math.min(1, Math.max(0, (depuis - 0.5) / 1.2));
  const lignes: [string, string][] = [
    ["Score", Math.round(jeu.score * compte).toLocaleString("fr-FR")],
    ["Précision", `${Math.round(prec * 100 * compte)} %`],
    ["Combo max", String(Math.round(jeu.comboMax * compte))],
    ["Parfait", String(jeu.compte.parfait)],
    ["Bien", String(jeu.compte.bien)],
    ["Raté", String(jeu.compte.rate)],
  ];
  lignes.forEach(([l, val], i) => {
    const y = 210 + i * 40;
    const aa = Math.min(1, Math.max(0, (depuis - 0.4 - i * 0.08) / 0.3));
    texte(ctx, l, cx + 10, y, "400 20px Outfit, sans-serif", BLANC, 0.65 * aa, "left");
    texte(ctx, val, cx + 330, y, i === 0 ? "800 26px Outfit, sans-serif" : "700 20px Outfit, sans-serif", BLANC, aa, "right");
    if (i < lignes.length - 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 * aa})`;
      ctx.fillRect(cx + 10, y + 20, 320, 1);
    }
  });
  if (!jeu.echec && jeu.compte.rate === 0 && jeu.total > 0) {
    texte(ctx, "Pouls parfait : aucun raté !", cx + 170, 470, "800 18px Outfit, sans-serif", [255, 226, 120], a);
  }
  if (depuis > 1.6) {
    const cl = 0.6 + 0.4 * Math.sin(v.reel * 4);
    texte(ctx, "ESPACE · rejouer      ÉCHAP · titre", cx, 600, "800 22px Outfit, sans-serif", BLANC, cl);
  }
}
