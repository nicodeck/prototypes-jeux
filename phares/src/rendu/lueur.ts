// Halos lumineux : une texture de lueur dessinée en code, et des sprites additifs.

import * as THREE from "three";

let texture: THREE.Texture | null = null;

/** Lueur radiale avec quatre rayons fins (effet d'étoile dans la pluie). */
export function textureLueur() {
  if (texture) return texture;
  const taille = 256;
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const g = c.getContext("2d")!;
  const m = taille / 2;
  const grad = g.createRadialGradient(m, m, 0, m, m, m);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.08, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.18)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, taille, taille);
  // rayons
  g.globalCompositeOperation = "lighter";
  for (const [angle, longueur] of [
    [0, 1],
    [Math.PI / 2, 0.7],
  ] as [number, number][]) {
    g.save();
    g.translate(m, m);
    g.rotate(angle);
    const r = g.createLinearGradient(-m * longueur, 0, m * longueur, 0);
    r.addColorStop(0, "rgba(255,255,255,0)");
    r.addColorStop(0.5, "rgba(255,255,255,0.35)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(-m * longueur, -1.5, m * 2 * longueur, 3);
    g.restore();
  }
  texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function creerLueur(couleur: THREE.Color, taille: number) {
  const mat = new THREE.SpriteMaterial({
    map: textureLueur(),
    color: couleur.clone(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(taille);
  s.renderOrder = 10;
  return s;
}

/** Reflet allongé d'une lumière sur l'eau : un trait vertical posé sous la source. */
export function creerRefletEau(couleur: THREE.Color, largeur: number, longueur: number) {
  const mat = new THREE.SpriteMaterial({
    map: textureLueur(),
    color: couleur.clone(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(largeur, longueur, 1);
  s.center.set(0.5, 1);
  s.renderOrder = 9;
  return s;
}
