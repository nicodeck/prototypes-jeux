// Ce que partagent tous les shaders : le temps, le soleil, la lune, et l'état de chaque sommet de la planète
// rangé dans deux textures (une case par sommet). Les shaders y lisent la hauteur du sol, l'eau, la vie…
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";

export const LARGEUR_ETAT = 256;

export const GLOBAL = {
  uTemps: { value: 0 },
  uSoleil: { value: new THREE.Vector3(0, 1, 0) },
  uLune: { value: new THREE.Vector3(0, -1, 0) },
  uJoueur: { value: new THREE.Vector3(0, 100, 0) },
  /** Direction du vent (dans le monde), pour faire onduler l'herbe. */
  uVent: { value: new THREE.Vector3(1, 0, 0) },
  /** Force du vent (0 calme, 1 tempête). */
  uForceVent: { value: 0.3 },
  /** Part de la planète vivante (0 à 1). */
  uPart: { value: 0 },
  /** Floraison générale (augmente avec la vie, monte à 1 à la fin). */
  uFloraison: { value: 0 },
  uRayon: { value: REGLAGES.planete.rayon },
  /** Hauteur du sol, eau, vie, humidité. */
  uEtat: { value: null as THREE.DataTexture | null },
  /** Cendre, creusé, champ des arbres, rien. */
  uEtat2: { value: null as THREE.DataTexture | null },
  uCamera: { value: new THREE.Vector3() },
};

/** Fonctions GLSL communes : lecture de l'état d'un sommet et bruit. */
export const GLSL_COMMUN = /* glsl */ `
  uniform sampler2D uEtat;
  uniform sampler2D uEtat2;
  uniform float uTemps;
  uniform vec3 uSoleil;
  uniform vec3 uLune;
  uniform float uRayon;
  ivec2 caseEtat(float i) {
    int k = int(i + 0.5);
    return ivec2(k % ${LARGEUR_ETAT}, k / ${LARGEUR_ETAT});
  }
  vec4 etat(float i) { return texelFetch(uEtat, caseEtat(i), 0); }
  vec4 etat2(float i) { return texelFetch(uEtat2, caseEtat(i), 0); }
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float bruitV(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm3(vec3 p) {
    return bruitV(p) * 0.5 + bruitV(p * 2.03 + 7.1) * 0.3 + bruitV(p * 4.1 + 3.7) * 0.2;
  }
  // Fissures : distance au bord des cellules de Voronoï (0 sur une fissure)
  float fissures(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(hash13(i + g), hash13(i + g + 17.1), hash13(i + g + 31.7));
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return sqrt(d2) - sqrt(d1);
  }
  // Repère tangent à la sphère en un point (u : vers le haut local)
  void repere(vec3 u, out vec3 t, out vec3 b) {
    vec3 a = abs(u.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    t = normalize(cross(a, u));
    b = cross(u, t);
  }
`;

/** Les textures d'état, remplies depuis la simulation. */
export class TexturesEtat {
  readonly a: THREE.DataTexture;
  readonly b: THREE.DataTexture;
  private readonly da: Float32Array;
  private readonly db: Float32Array;
  /** La vie, adoucie d'un sommet à l'autre : le bord de l'herbe devient un dégradé, pas une falaise. */
  private readonly lisse1: Float32Array;
  private readonly lisse2: Float32Array;

  constructor(private readonly monde: Monde) {
    const h = Math.ceil(monde.n / LARGEUR_ETAT);
    this.da = new Float32Array(LARGEUR_ETAT * h * 4);
    this.db = new Float32Array(LARGEUR_ETAT * h * 4);
    this.lisse1 = new Float32Array(monde.n);
    this.lisse2 = new Float32Array(monde.n);
    this.a = new THREE.DataTexture(this.da, LARGEUR_ETAT, h, THREE.RGBAFormat, THREE.FloatType);
    this.b = new THREE.DataTexture(this.db, LARGEUR_ETAT, h, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [this.a, this.b]) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    GLOBAL.uEtat.value = this.a;
    GLOBAL.uEtat2.value = this.b;
    this.maj();
  }

  maj() {
    const m = this.monde;
    const { da, db } = this;
    const vd = m.sphere.voisinsDebut;
    const vs = m.sphere.voisins;
    let src = m.vie;
    for (const dst of [this.lisse1, this.lisse2]) {
      for (let i = 0; i < m.n; i++) {
        let s = src[i] * 2;
        for (let k = vd[i]; k < vd[i + 1]; k++) s += src[vs[k]];
        dst[i] = s / (2 + vd[i + 1] - vd[i]);
      }
      src = dst;
    }
    for (let i = 0, k = 0; i < m.n; i++, k += 4) {
      da[k] = m.sol[i];
      da[k + 1] = m.eau[i];
      da[k + 2] = this.lisse2[i];
      da[k + 3] = m.humid[i];
      db[k] = m.cendre[i];
      db[k + 1] = m.solOrigine[i] - m.sol[i];
      db[k + 2] = m.champ[i];
      db[k + 3] = m.bloc[i];
    }
    this.a.needsUpdate = true;
    this.b.needsUpdate = true;
  }
}
