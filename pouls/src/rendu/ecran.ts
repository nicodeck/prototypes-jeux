// Le canevas : taille adaptée à la fenêtre (720 de haut, largeur variable), lueur diffuse (bloom) et vignette.

import { REGLAGES } from "../reglages";
import { eclaircir, rvb, type RVB } from "../outils";

export type Ctx = CanvasRenderingContext2D;

export function creerCanevas(l: number, h: number): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(l));
  c.height = Math.max(1, Math.round(h));
  const x = c.getContext("2d")!;
  return { c, x };
}

export class Ecran {
  readonly ctx: Ctx;
  W = 1280;
  readonly H = REGLAGES.ecran.hauteur;
  /** Pixels réels par unité logique. */
  echelle = 1;
  private petit1 = creerCanevas(8, 8);
  private petit2 = creerCanevas(8, 8);
  private vignette = creerCanevas(8, 8);
  /** Incrémenté à chaque changement de taille : les décors se refont. */
  version = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  redimensionner() {
    const E = REGLAGES.ecran;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.W = Math.round(Math.max(E.largeurMin, Math.min(E.largeurMax, (vw / vh) * this.H)));
    const css = Math.min(vw / this.W, vh / this.H);
    const densite = Math.min(window.devicePixelRatio || 1, E.densiteMax);
    this.echelle = css * densite;
    this.canvas.width = Math.round(this.W * this.echelle);
    this.canvas.height = Math.round(this.H * this.echelle);
    this.canvas.style.width = `${Math.round(this.W * css)}px`;
    this.canvas.style.height = `${Math.round(this.H * css)}px`;

    this.petit1 = creerCanevas(this.W / 4, this.H / 4);
    this.petit2 = creerCanevas(this.W / 10, this.H / 10);
    this.vignette = creerCanevas(this.W / 2, this.H / 2);
    const v = this.vignette.x;
    const g = v.createRadialGradient(this.W / 4, this.H / 4.4, this.H * 0.15, this.W / 4, this.H / 4, this.W * 0.34);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.6, "rgba(0,0,0,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    v.fillStyle = g;
    v.fillRect(0, 0, this.W / 2, this.H / 2);
    this.version++;
  }

  /** Repère logique : on dessine en unités de 720 de haut. */
  repereLogique() {
    this.ctx.setTransform(this.echelle, 0, 0, this.echelle, 0, 0);
  }

  /**
   * Lueur diffuse : l'image réduite deux fois (donc floutée) est rajoutée en mode additif.
   * Les zones sombres n'ajoutent presque rien, les zones lumineuses débordent.
   */
  bloom(force: number) {
    const ctx = this.ctx;
    const p1 = this.petit1;
    const p2 = this.petit2;
    p1.x.globalCompositeOperation = "copy";
    p1.x.imageSmoothingQuality = "medium";
    p1.x.drawImage(this.canvas, 0, 0, p1.c.width, p1.c.height);
    p2.x.globalCompositeOperation = "copy";
    p2.x.drawImage(p1.c, 0, 0, p2.c.width, p2.c.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.26 * force;
    ctx.drawImage(p1.c, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 0.42 * force;
    ctx.drawImage(p2.c, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  dessinerVignette() {
    this.ctx.drawImage(this.vignette.c, 0, 0, this.W, this.H);
  }
}

// ------------------------------------------------------------------ lueurs (sprites colorés, en cache)

const cacheLueurs = new Map<number, HTMLCanvasElement>();
const TAILLE = 64;

function spriteLueur(c: RVB): HTMLCanvasElement {
  const cle = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3);
  let s = cacheLueurs.get(cle);
  if (s) return s;
  const { c: cv, x } = creerCanevas(TAILLE, TAILLE);
  const g = x.createRadialGradient(TAILLE / 2, TAILLE / 2, 0, TAILLE / 2, TAILLE / 2, TAILLE / 2);
  g.addColorStop(0, rvb(eclaircir(c, 0.6), 1));
  g.addColorStop(0.12, rvb(eclaircir(c, 0.2), 0.85));
  g.addColorStop(0.35, rvb(c, 0.32));
  g.addColorStop(0.7, rvb(c, 0.08));
  g.addColorStop(1, rvb(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, TAILLE, TAILLE);
  if (cacheLueurs.size > 600) cacheLueurs.clear();
  cacheLueurs.set(cle, cv);
  return cv;
}

/** Dessine une lueur colorée (à appeler en mode « lighter » pour qu'elle s'additionne). */
export function lueur(ctx: Ctx, x: number, y: number, rayon: number, c: RVB, alpha = 1, etirement = 1) {
  if (alpha <= 0.003 || rayon <= 0.5) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(spriteLueur(c), x - rayon * etirement, y - rayon, rayon * 2 * etirement, rayon * 2);
  ctx.globalAlpha = 1;
}
