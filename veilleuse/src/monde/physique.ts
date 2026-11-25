// Les déplacements, au pixel près.
//
// Un corps avance d'un pixel à la fois et s'arrête dès que le pixel suivant est occupé.
// Il n'y a aucun « rattrapage » : si les pieds ne passent pas au-dessus d'un bord, on ne monte pas dessus.
// Les positions sont des entiers ; les fractions de pixel s'accumulent dans un reste.

export type Corps = {
  x: number;
  y: number;
  l: number;
  h: number;
  /** Les fractions de pixel pas encore parcourues. */
  restX: number;
  restY: number;
};

export interface Terrain {
  /** La zone est-elle bloquée par du décor solide ? */
  solide(x: number, y: number, l: number, h: number): boolean;
  /** Le dessus d'une plateforme traversable est-il exactement sur la ligne y, entre x et x + l ? */
  dessusTraversable(x: number, y: number, l: number): boolean;
}

/** Avance horizontalement. Renvoie vrai si on a été arrêté. */
export function deplacerX(c: Corps, dx: number, t: Terrain): boolean {
  c.restX += dx;
  let n = Math.round(c.restX);
  if (n === 0) return false;
  c.restX -= n;
  const sens = Math.sign(n);
  while (n !== 0) {
    if (t.solide(c.x + sens, c.y, c.l, c.h)) {
      c.restX = 0;
      return true;
    }
    c.x += sens;
    n -= sens;
  }
  return false;
}

/**
 * Avance verticalement. Renvoie vrai si on a été arrêté.
 * En descendant, on s'arrête aussi sur le dessus d'une plateforme traversable, sauf si `traverser`.
 */
export function deplacerY(c: Corps, dy: number, t: Terrain, traverser = false): boolean {
  c.restY += dy;
  let n = Math.round(c.restY);
  if (n === 0) return false;
  c.restY -= n;
  const sens = Math.sign(n);
  while (n !== 0) {
    const bloque =
      t.solide(c.x, c.y + sens, c.l, c.h) || (sens > 0 && !traverser && t.dessusTraversable(c.x, c.y + c.h, c.l));
    if (bloque) {
      c.restY = 0;
      return true;
    }
    c.y += sens;
    n -= sens;
  }
  return false;
}

/** Est-on posé sur quelque chose ? */
export function estPose(c: Corps, t: Terrain, traverser = false): boolean {
  return t.solide(c.x, c.y + 1, c.l, c.h) || (!traverser && t.dessusTraversable(c.x, c.y + c.h, c.l));
}

export function chevauche(a: { x: number; y: number; l: number; h: number }, b: { x: number; y: number; l: number; h: number }) {
  return a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
