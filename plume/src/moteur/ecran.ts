// L'écran : on dessine sur une petite toile de 320 × 180 pixels, agrandie sans flou d'un facteur entier.
import { PALETTE } from "../rendu/palette";
import { GLYPHES } from "../rendu/police";
import type { Dessin } from "../rendu/dessins";

export const LARGEUR = 320;
export const HAUTEUR = 180;

export function creerEcran(affichage: HTMLCanvasElement) {
  const toile = document.createElement("canvas");
  toile.width = LARGEUR;
  toile.height = HAUTEUR;
  const ctx = toile.getContext("2d")!;
  const sortie = affichage.getContext("2d")!;

  const redimensionner = () => {
    const echelle = Math.max(1, Math.floor(Math.min(innerWidth / LARGEUR, innerHeight / HAUTEUR)));
    affichage.width = LARGEUR * echelle;
    affichage.height = HAUTEUR * echelle;
  };
  redimensionner();
  window.addEventListener("resize", redimensionner);

  return {
    ctx,
    presenter() {
      sortie.imageSmoothingEnabled = false;
      sortie.drawImage(toile, 0, 0, affichage.width, affichage.height);
    },
  };
}

// ——— Les dessins, transformés une fois pour toutes en petites images ———

const cache = new WeakMap<Dessin, HTMLCanvasElement>();
const cacheRetourne = new WeakMap<Dessin, HTMLCanvasElement>();

export function image(dessin: Dessin): HTMLCanvasElement {
  let c = cache.get(dessin);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = dessin[0].length;
  c.height = dessin.length;
  const ctx = c.getContext("2d")!;
  dessin.forEach((ligne, y) =>
    [...ligne].forEach((lettre, x) => {
      if (lettre === ".") return;
      ctx.fillStyle = PALETTE[lettre] ?? "#ff00ff";
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  cache.set(dessin, c);
  return c;
}

function imageRetournee(dessin: Dessin): HTMLCanvasElement {
  let c = cacheRetourne.get(dessin);
  if (c) return c;
  const source = image(dessin);
  c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d")!;
  ctx.scale(-1, 1);
  ctx.drawImage(source, -source.width, 0);
  cacheRetourne.set(dessin, c);
  return c;
}

export function dessiner(ctx: CanvasRenderingContext2D, dessin: Dessin, x: number, y: number, retourne = false) {
  ctx.drawImage(retourne ? imageRetournee(dessin) : image(dessin), Math.round(x), Math.round(y));
}

// ——— Le texte ———

export function largeurTexte(texte: string, echelle = 1) {
  let l = 0;
  for (const c of texte.toUpperCase()) l += ((GLYPHES.get(c)?.largeur ?? 3) + 1) * echelle;
  return l - echelle;
}

export function ecrire(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  couleur: string,
  options: { echelle?: number; aligner?: "gauche" | "centre" | "droite"; ombre?: string } = {},
) {
  const echelle = options.echelle ?? 1;
  if (options.ombre) {
    const decalage = Math.max(1, Math.floor(echelle / 2));
    ecrire(ctx, texte, x + decalage, y + decalage, options.ombre, { ...options, ombre: undefined });
  }
  const lignes = texte.split("\n");
  lignes.forEach((ligne, n) => {
    const l = largeurTexte(ligne, echelle);
    let cx = Math.round(options.aligner === "centre" ? x - l / 2 : options.aligner === "droite" ? x - l : x);
    const cy = Math.round(y + n * 9 * echelle);
    for (const c of ligne.toUpperCase()) {
      const g = GLYPHES.get(c) ?? GLYPHES.get("?")!;
      for (const [px, py] of g.pixels) {
        ctx.fillStyle = couleur;
        ctx.fillRect(cx + px * echelle, cy + py * echelle, echelle, echelle);
      }
      cx += (g.largeur + 1) * echelle;
    }
  });
}
