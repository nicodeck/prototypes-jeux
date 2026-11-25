// Outils communs pour fabriquer les persos.
import * as THREE from "three";
import { Pantin } from "../pantin";
import { matToon, piece, type OptionsToon } from "../toon";
import { geometrieVisage, peindreVisages, type StyleVisage } from "../visage";

/** Forme une tête d'anime à partir d'une sphère : menton affiné, mâchoire plus ou moins carrée. */
export function deformerTete(g: THREE.BufferGeometry, r: number, carre: number) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    if (y < 0) {
      const t = Math.min(1, -y / r);
      x *= 1 - (0.42 - carre * 0.3) * Math.pow(t, 1.4);
      y *= 1 + 0.18 * t;
      if (z > 0) z *= 1 + 0.08 * t - (0.25 - carre * 0.15) * Math.pow(t, 2);
      else z *= 1 - 0.15 * t;
    } else {
      z *= 1 + 0.04 * (y / r);
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Une texture de détails peinte : `dessin` reçoit le contexte et la taille. */
export function texture(largeur: number, hauteur: number, dessin: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d")!;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  dessin(ctx, largeur, hauteur);
  const t = new THREE.CanvasTexture(toile);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Fabrique de pièces cel-shadées qui blanchissent ensemble quand le perso est touché. */
export function atelier(pantin: Pantin) {
  const eclat = pantin.eclat;
  const eclatCouleur = pantin.eclatCouleur;
  const mat = (couleur: THREE.ColorRepresentation, o: OptionsToon = {}) => matToon(couleur, { ...o, eclat, eclatCouleur });
  const faire = (g: THREE.BufferGeometry, m: THREE.Material, contour = 1, lisser = false) =>
    piece(g, m, contour, { eclat, lisser });
  return { mat, faire };
}

/** La tête : le crâne, le visage peint et ses expressions. */
export function tete(pantin: Pantin, r: number, carre: number, peau: THREE.Material, style: StyleVisage, y: number) {
  const { faire } = atelier(pantin);
  const crane = faire(deformerTete(new THREE.SphereGeometry(r, 36, 28), r, carre), peau, 1);
  pantin.attacher("tete", crane, 0, y, 0);
  const visages = peindreVisages(style);
  const matVisage = new THREE.MeshBasicMaterial({
    map: visages.neutre,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const visage = new THREE.Mesh(deformerTete(geometrieVisage(r * 1.004), r * 1.004, carre), matVisage);
  visage.renderOrder = 1;
  crane.add(visage);
  pantin.ajouterVisages(matVisage, visages);
  return crane;
}
