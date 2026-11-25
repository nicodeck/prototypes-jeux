// Les lumières de la mine : la lanterne de Veilleuse, les lanternes rallumées, les cristaux, le
// Cœur. Les plus proches de la caméra sont envoyées aux shaders, qui les partagent tous.
import * as THREE from "three";

export const MAX_LUMIERES = 24;

export type Lumiere = {
  x: number;
  y: number;
  /** Portée, en cases */
  rayon: number;
  couleur: THREE.Color;
  intensite: number;
};

/** Les uniforms partagés : un même objet est branché sur tous les matériaux. */
export const LUMIERES = {
  uLumPos: { value: Array.from({ length: MAX_LUMIERES }, () => new THREE.Vector3()) },
  uLumCoul: { value: Array.from({ length: MAX_LUMIERES }, () => new THREE.Vector3()) },
  uNbLum: { value: 0 },
  uAmbiant: { value: new THREE.Color() },
  uBrume: { value: new THREE.Color() },
  uTemps: { value: 0 },
};

export const GLSL_LUMIERES = /* glsl */ `
  uniform vec3 uLumPos[${MAX_LUMIERES}];
  uniform vec3 uLumCoul[${MAX_LUMIERES}];
  uniform int uNbLum;
  uniform vec3 uAmbiant;
  uniform vec3 uBrume;
  uniform float uTemps;

  // La lumière reçue en p, pour une surface tournée vers n (z : vers le spectateur).
  vec3 lumiere(vec2 p, vec3 n) {
    vec3 total = vec3(0.0);
    for (int i = 0; i < ${MAX_LUMIERES}; i++) {
      if (i >= uNbLum) break;
      vec2 d = uLumPos[i].xy - p;
      float r = uLumPos[i].z;
      float dist = length(d);
      float a = clamp(1.0 - dist / r, 0.0, 1.0);
      a = a * a * (0.6 + 0.4 * a);
      vec3 L = normalize(vec3(d, r * 0.18 + 0.3));
      total += uLumCoul[i] * a * max(dot(n, L), 0.0);
    }
    return total;
  }
`;

/** Envoie aux shaders les lumières les plus proches du point (cx, cy). */
export function envoyerLumieres(liste: Lumiere[], cx: number, cy: number) {
  const triees = liste
    .filter((l) => l.intensite > 0.001)
    .map((l) => ({ l, d: Math.max(0, Math.hypot(l.x - cx, l.y - cy) - l.rayon) }))
    .filter((e) => e.d < 26)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_LUMIERES);
  triees.forEach(({ l }, i) => {
    LUMIERES.uLumPos.value[i].set(l.x, l.y, l.rayon);
    LUMIERES.uLumCoul.value[i].set(l.couleur.r * l.intensite, l.couleur.g * l.intensite, l.couleur.b * l.intensite);
  });
  LUMIERES.uNbLum.value = triees.length;
}

/** La lumière reçue en un point, calculée en JS (pour les particules). */
export function lumiereEn(liste: Lumiere[], x: number, y: number) {
  let total = 0;
  for (const l of liste) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d >= l.rayon) continue;
    const a = 1 - d / l.rayon;
    total += a * a * l.intensite;
  }
  return total;
}
