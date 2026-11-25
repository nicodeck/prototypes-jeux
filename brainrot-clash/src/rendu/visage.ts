// Les visages, peints sur une toile puis posés sur l'avant de la tête.
import * as THREE from "three";
import type { Expression } from "./pantin";

export const LARGEUR = 512;
export const HAUTEUR = 384;
/** L'étendue du visage sur la sphère de la tête. */
export const ETENDUE = { phi: 1.9, thetaDebut: Math.PI * 0.36, theta: Math.PI * 0.46 };

const ENCRE = "#1b1220";

export interface StyleVisage {
  iris: [string, string];
  /** Taille des yeux (1 = grands yeux de Ballerina). */
  yeux: number;
  ecartYeux: number;
  hauteurYeux: number;
  sourcils: number;
  bouche: number;
  peau: string;
  cicatrice?: boolean;
  joues?: boolean;
}

export function geometrieVisage(rayon: number) {
  return new THREE.SphereGeometry(
    rayon,
    32,
    20,
    Math.PI / 2 - ETENDUE.phi / 2,
    ETENDUE.phi,
    ETENDUE.thetaDebut,
    ETENDUE.theta,
  );
}

export function peindreVisages(style: StyleVisage): Record<Expression, THREE.Texture> {
  const faire = (e: Expression) => {
    const toile = document.createElement("canvas");
    toile.width = LARGEUR;
    toile.height = HAUTEUR;
    const ctx = toile.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    peindre(ctx, style, e);
    const t = new THREE.CanvasTexture(toile);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { neutre: faire("neutre"), cri: faire("cri"), douleur: faire("douleur") };
}

function peindre(ctx: CanvasRenderingContext2D, s: StyleVisage, e: Expression) {
  const W = LARGEUR;
  const H = HAUTEUR;
  const cx = W / 2;
  const yY = H * s.hauteurYeux;
  const ex = W * s.ecartYeux;
  const t = s.yeux;

  for (const cote of [-1, 1]) {
    const x = cx + cote * ex;
    if (e === "douleur") {
      // Yeux plissés en chevrons > <
      ctx.strokeStyle = ENCRE;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x - cote * 26 * t, yY - 18 * t);
      ctx.lineTo(x + cote * 18 * t, yY);
      ctx.lineTo(x - cote * 26 * t, yY + 16 * t);
      ctx.stroke();
    } else {
      oeil(ctx, x, yY, cote, t, s, e === "cri");
    }
    // Sourcils
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = 9 * s.sourcils;
    const fronce = e === "neutre" ? 0.6 : 1;
    const yS = yY - 52 * t - (e === "douleur" ? 6 : 0);
    ctx.beginPath();
    const interieur = x - cote * 30 * t;
    const exterieur = x + cote * 34 * t;
    if (e === "douleur") {
      ctx.moveTo(interieur, yS - 12);
      ctx.quadraticCurveTo(x, yS - 2, exterieur, yS + 6);
    } else {
      ctx.moveTo(interieur, yS + 16 * fronce * s.sourcils);
      ctx.quadraticCurveTo(x, yS - 4, exterieur, yS - 8);
    }
    ctx.stroke();
    if (s.sourcils > 1.4) {
      // Gros sourcils broussailleux : remplissage
      ctx.fillStyle = ENCRE;
      ctx.beginPath();
      ctx.moveTo(interieur, yS + 16 * fronce * s.sourcils + 6);
      ctx.quadraticCurveTo(x, yS + 8, exterieur, yS - 2);
      ctx.lineTo(exterieur + cote * 4, yS - 14);
      ctx.quadraticCurveTo(x, yS - 18, interieur, yS + 16 * fronce * s.sourcils - 12);
      ctx.fill();
    }
  }

  // Joues
  if (s.joues) {
    ctx.strokeStyle = "rgba(230,90,90,0.55)";
    ctx.lineWidth = 4;
    for (const cote of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const x = cx + cote * (ex + 6) + i * 10 - 10;
        ctx.beginPath();
        ctx.moveTo(x + 6, yY + 46 * t);
        ctx.lineTo(x - 2, yY + 58 * t);
        ctx.stroke();
      }
  }

  // Cicatrice en croix sur la joue
  if (s.cicatrice) {
    ctx.strokeStyle = "#8a3b34";
    ctx.lineWidth = 6;
    const x = cx + ex + 8;
    const y = yY + 52;
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 26);
    ctx.lineTo(x + 18, y + 22);
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + 10, y - 10);
    ctx.stroke();
  }

  // Nez : un petit trait d'ombre
  ctx.strokeStyle = "rgba(120,60,50,0.8)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + 4, H * 0.6);
  ctx.lineTo(cx - 6, H * 0.665);
  ctx.lineTo(cx + 4, H * 0.675);
  ctx.stroke();

  // Bouche
  const yB = H * 0.8;
  ctx.strokeStyle = ENCRE;
  ctx.fillStyle = "#5a1622";
  ctx.lineWidth = 7;
  const b = s.bouche;
  if (e === "neutre") {
    ctx.beginPath();
    ctx.moveTo(cx - 24 * b, yB - 2);
    ctx.quadraticCurveTo(cx + 2, yB + 6, cx + 26 * b, yB - 6);
    ctx.stroke();
  } else {
    const ouverture = e === "cri" ? 1 : 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 36 * b, yB - 14 * ouverture);
    ctx.lineTo(cx + 38 * b, yB - 18 * ouverture);
    ctx.quadraticCurveTo(cx + 30 * b, yB + 40 * ouverture, cx, yB + 44 * ouverture);
    ctx.quadraticCurveTo(cx - 30 * b, yB + 40 * ouverture, cx - 36 * b, yB - 14 * ouverture);
    ctx.fill();
    ctx.stroke();
    // Dents du haut
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(cx - 30 * b, yB - 12 * ouverture);
    ctx.lineTo(cx + 32 * b, yB - 15 * ouverture);
    ctx.lineTo(cx + 28 * b, yB - 2 * ouverture);
    ctx.lineTo(cx - 26 * b, yB);
    ctx.fill();
    // Langue
    ctx.fillStyle = "#d4505c";
    ctx.beginPath();
    ctx.ellipse(cx, yB + 32 * ouverture, 18 * b, 8 * ouverture, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e === "douleur") {
    // Goutte de sueur
    ctx.fillStyle = "#bfe6ff";
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = 4;
    const x = cx - ex - 50;
    const y = yY - 60;
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.quadraticCurveTo(x + 18, y + 4, x, y + 12);
    ctx.quadraticCurveTo(x - 18, y + 4, x, y - 26);
    ctx.fill();
    ctx.stroke();
  }
}

function oeil(ctx: CanvasRenderingContext2D, x: number, y: number, cote: number, t: number, s: StyleVisage, cri: boolean) {
  const lw = 34 * t;
  const lh = (cri ? 26 : 34) * t;
  // Blanc de l'œil
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.moveTo(x - lw, y - lh * 0.3);
  ctx.quadraticCurveTo(x, y - lh * 1.15, x + lw, y - lh * 0.45);
  ctx.quadraticCurveTo(x + lw * 0.9, y + lh * 0.95, x, y + lh);
  ctx.quadraticCurveTo(x - lw * 0.95, y + lh * 0.85, x - lw, y - lh * 0.3);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Iris : un dégradé vertical, une pupille, deux reflets.
  const ix = x + cote * -4 * t;
  const g = ctx.createLinearGradient(0, y - lh, 0, y + lh);
  g.addColorStop(0, s.iris[0]);
  g.addColorStop(1, s.iris[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ix, y + 3 * t, 19 * t, (cri ? 22 : 30) * t, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ENCRE;
  ctx.beginPath();
  ctx.ellipse(ix, y + 3 * t, 9 * t, (cri ? 11 : 16) * t, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = ENCRE;
  ctx.beginPath();
  ctx.ellipse(ix, y + 3 * t, 19 * t, (cri ? 22 : 30) * t, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(ix - 7 * t, y - 9 * t, 7 * t, 9 * t, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + 7 * t, y + 15 * t, 3.5 * t, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Paupière du haut : un trait épais, avec une pointe vers l'extérieur.
  ctx.fillStyle = ENCRE;
  ctx.beginPath();
  ctx.moveTo(x - lw - cote * 0, y - lh * 0.25);
  ctx.quadraticCurveTo(x, y - lh * 1.25, x + cote * lw * 1.25 + (cote < 0 ? -2 : 2), y - lh * 0.5 - (cote > 0 ? 6 : 0));
  ctx.quadraticCurveTo(x, y - lh * 0.95, x - lw, y - lh * 0.05);
  ctx.fill();
  // Autre bout de la paupière (le côté intérieur est fin).
  ctx.strokeStyle = ENCRE;
  ctx.lineWidth = 9 * t;
  ctx.beginPath();
  ctx.moveTo(x - lw * 0.98, y - lh * 0.28);
  ctx.quadraticCurveTo(x, y - lh * 1.12, x + lw * 1.02, y - lh * 0.48);
  ctx.stroke();
  // Paupière du bas
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - lw * 0.6, y + lh * 0.92);
  ctx.quadraticCurveTo(x, y + lh * 1.08, x + lw * 0.7, y + lh * 0.8);
  ctx.stroke();
}
