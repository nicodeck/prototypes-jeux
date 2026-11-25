// Les pinceaux : de petites fonctions Canvas 2D qui peignent des silhouettes de mine (parois,
// piliers, chevalements, étais, cristaux, racines…). Les coordonnées sont en cases, l'axe y
// descend, comme sur le canvas.
import type { Hasard } from "./bruit";

export type Pinceau = CanvasRenderingContext2D;

/** Un bruit 1D lisse, pour des contours qui ondulent. */
export function onde(h: Hasard) {
  const n = 64;
  const valeurs = Array.from({ length: n }, () => h.suivant());
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = valeurs[((i % n) + n) % n];
    const b = valeurs[(((i + 1) % n) + n) % n];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

/** Une paroi qui pend du haut (sens 1) ou monte du bas (sens -1), avec des pointes. */
export function paroi(c: Pinceau, h: Hasard, largeur: number, base: number, amplitude: number, sens: 1 | -1, pointes: number, hauteurTotale: number) {
  const o1 = onde(h);
  const o2 = onde(h);
  c.beginPath();
  const bord = sens === 1 ? -1 : hauteurTotale + 1;
  c.moveTo(-1, bord);
  const pas = 0.5;
  for (let x = -1; x <= largeur + 1; x += pas) {
    const y = base + (o1(x * 0.12) - 0.5) * amplitude * 2 + (o2(x * 0.5) - 0.5) * amplitude * 0.5;
    c.lineTo(x, sens === 1 ? y : hauteurTotale - y);
  }
  c.lineTo(largeur + 1, bord);
  c.closePath();
  c.fill();
  for (let i = 0; i < pointes; i++) {
    const x = h.entre(0, largeur);
    const y0 = base + (o1(x * 0.12) - 0.5) * amplitude * 2 - 0.3;
    const long = h.entre(0.6, 3.2) * (h.suivant() < 0.15 ? 2 : 1);
    const larg = long * h.entre(0.18, 0.32);
    c.beginPath();
    if (sens === 1) {
      c.moveTo(x - larg, y0);
      c.quadraticCurveTo(x - larg * 0.2, y0 + long * 0.6, x, y0 + long);
      c.quadraticCurveTo(x + larg * 0.2, y0 + long * 0.6, x + larg, y0);
    } else {
      const yb = hauteurTotale - y0;
      c.moveTo(x - larg, yb);
      c.quadraticCurveTo(x - larg * 0.2, yb - long * 0.6, x, yb - long);
      c.quadraticCurveTo(x + larg * 0.2, yb - long * 0.6, x + larg, yb);
    }
    c.fill();
  }
}

/** Un pilier de roche du haut en bas, plus étroit au milieu. */
export function pilier(c: Pinceau, h: Hasard, x: number, largeur: number, hauteur: number) {
  const o = onde(h);
  const o2 = onde(h);
  c.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const y = (i / n) * (hauteur + 2) - 1;
    const t = i / n;
    const taille = 0.8 + 0.2 * Math.pow(Math.abs(t - 0.5) * 2, 2.5);
    c.lineTo(x - (largeur / 2) * taille - (o(y * 0.3) - 0.5) * largeur * 0.5, y);
  }
  for (let i = n; i >= 0; i--) {
    const y = (i / n) * (hauteur + 2) - 1;
    const t = i / n;
    const taille = 0.8 + 0.2 * Math.pow(Math.abs(t - 0.5) * 2, 2.5);
    c.lineTo(x + (largeur / 2) * taille + (o2(y * 0.3) - 0.5) * largeur * 0.5, y);
  }
  c.closePath();
  c.fill();
}

/** Une poutre (rectangle tourné) entre deux points. */
export function poutre(c: Pinceau, x0: number, y0: number, x1: number, y1: number, ep: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (ep / 2);
  const ny = (dx / l) * (ep / 2);
  c.beginPath();
  c.moveTo(x0 + nx, y0 + ny);
  c.lineTo(x1 + nx, y1 + ny);
  c.lineTo(x1 - nx, y1 - ny);
  c.lineTo(x0 - nx, y0 - ny);
  c.closePath();
  c.fill();
}

/** Un câble qui pend entre deux points. */
export function cable(c: Pinceau, x0: number, y0: number, x1: number, y1: number, creux: number, ep: number) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + creux, x1, y1);
  c.lineWidth = ep;
  c.stroke();
}

/** Un chevalement : la tour de bois au-dessus d'un puits, avec sa grande roue. */
export function chevalement(c: Pinceau, x: number, yBas: number, haut: number, larg: number) {
  const ep = haut * 0.035;
  const yHaut = yBas - haut;
  // Les deux jambes, et la jambe de force
  poutre(c, x - larg / 2, yBas, x - larg * 0.12, yHaut, ep);
  poutre(c, x + larg / 2, yBas, x + larg * 0.12, yHaut, ep);
  poutre(c, x + larg * 1.1, yBas, x + larg * 0.1, yHaut + haut * 0.1, ep * 0.9);
  // Les croisillons
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const xa = (t: number) => x - larg / 2 + (larg / 2 - larg * 0.12) * t;
    const xb = (t: number) => x + larg / 2 - (larg / 2 - larg * 0.12) * t;
    poutre(c, xa(t0), yBas - haut * t0, xb(t1), yBas - haut * t1, ep * 0.5);
    poutre(c, xb(t0), yBas - haut * t0, xa(t1), yBas - haut * t1, ep * 0.5);
    poutre(c, xa(t1), yBas - haut * t1, xb(t1), yBas - haut * t1, ep * 0.6);
  }
  // La roue
  const r = larg * 0.32;
  const cx = x;
  const cy = yHaut - r * 0.4;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.lineWidth = ep * 0.9;
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    poutre(c, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, ep * 0.3);
  }
  // Le câble qui descend dans le noir
  poutre(c, cx + r, cy, cx + r, yBas + haut, ep * 0.2);
}

/** Un cadre de soutènement : deux montants et un chapeau. */
export function cadre(c: Pinceau, x: number, yBas: number, larg: number, haut: number, ep: number) {
  poutre(c, x - larg / 2, yBas, x - larg / 2 + ep * 0.6, yBas - haut, ep);
  poutre(c, x + larg / 2, yBas, x + larg / 2 - ep * 0.6, yBas - haut, ep);
  poutre(c, x - larg / 2 - ep, yBas - haut + ep / 2, x + larg / 2 + ep, yBas - haut + ep / 2, ep * 1.1);
  poutre(c, x - larg / 2 + ep * 0.4, yBas - haut + ep * 2.2, x - larg / 2 + ep * 2.4, yBas - haut + ep * 0.6, ep * 0.5);
  poutre(c, x + larg / 2 - ep * 0.4, yBas - haut + ep * 2.2, x + larg / 2 - ep * 2.4, yBas - haut + ep * 0.6, ep * 0.5);
}

export function echelle(c: Pinceau, x: number, y0: number, y1: number, larg: number, ep: number) {
  poutre(c, x - larg / 2, y0, x - larg / 2, y1, ep);
  poutre(c, x + larg / 2, y0, x + larg / 2, y1, ep);
  for (let y = y0 + 0.6; y < y1; y += 0.9) poutre(c, x - larg / 2, y, x + larg / 2, y, ep * 0.6);
}

/** Une grappe de cristaux qui pousse dans la direction `angle` (0 : vers le haut). */
export function cristaux(c: Pinceau, h: Hasard, x: number, y: number, taille: number, angle: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = angle + h.entre(-0.7, 0.7);
    const long = taille * h.entre(0.4, 1);
    const larg = long * h.entre(0.14, 0.24);
    const ox = x + h.entre(-taille * 0.3, taille * 0.3);
    c.save();
    c.translate(ox, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(-larg, 0);
    c.lineTo(-larg, -long * 0.75);
    c.lineTo(0, -long);
    c.lineTo(larg, -long * 0.75);
    c.lineTo(larg, 0);
    c.closePath();
    c.fill();
    c.restore();
  }
}

/** Une racine qui pend et ondule. */
export function racine(c: Pinceau, h: Hasard, x: number, y: number, longueur: number, ep: number) {
  c.beginPath();
  c.moveTo(x, y);
  let px = x;
  let py = y;
  const n = 12;
  const phase = h.entre(0, 6);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    px = x + Math.sin(t * 3 + phase) * longueur * 0.08;
    py = y + t * longueur;
    c.lineTo(px, py);
  }
  c.lineWidth = ep;
  c.lineCap = "round";
  c.stroke();
  // Quelques radicelles
  for (let i = 0; i < 3; i++) {
    const t = h.entre(0.2, 0.8);
    const rx = x + Math.sin(t * 3 + phase) * longueur * 0.08;
    const ry = y + t * longueur;
    c.beginPath();
    c.moveTo(rx, ry);
    c.quadraticCurveTo(rx + h.entre(-1, 1), ry + longueur * 0.1, rx + h.entre(-1.5, 1.5), ry + longueur * h.entre(0.15, 0.3));
    c.lineWidth = ep * 0.4;
    c.stroke();
  }
}

/** Une arche de pierre (deux piles et une voûte). */
export function arche(c: Pinceau, x: number, yBas: number, larg: number, haut: number, ep: number) {
  c.beginPath();
  c.moveTo(x - larg / 2 - ep, yBas);
  c.lineTo(x - larg / 2 - ep, yBas - haut + larg / 2);
  c.arc(x, yBas - haut + larg / 2, larg / 2 + ep, Math.PI, 0);
  c.lineTo(x + larg / 2 + ep, yBas);
  c.lineTo(x + larg / 2, yBas);
  c.lineTo(x + larg / 2, yBas - haut + larg / 2);
  c.arc(x, yBas - haut + larg / 2, larg / 2, 0, Math.PI, true);
  c.lineTo(x - larg / 2, yBas);
  c.closePath();
  c.fill();
}

/** Une lueur douce (à peindre en mode « lighter »). */
export function lueur(c: Pinceau, x: number, y: number, r: number, couleur: string, force: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, couleur.replace("ALPHA", String(force)));
  g.addColorStop(0.35, couleur.replace("ALPHA", String(force * 0.35)));
  g.addColorStop(1, couleur.replace("ALPHA", "0"));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export function rgba(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},ALPHA)`;
}
