// L'océan : une grille dense près de la caméra, déformée par la houle de Gerstner,
// éclairée par la lanterne, les phares et les éclairs. Écume des crêtes, du rivage et du sillage.

import * as THREE from "three";
import { NB_VAGUES, uniformesVagues } from "../monde/vagues";
import { GLSL_BRUIT, GLSL_CIEL } from "./glsl";
import { REGLAGES } from "../reglages";

export const NB_PHARES_MAX = 6;
export const NB_SILLAGE = 40;

const VERTEX = /* glsl */ `
#define NB_VAGUES ${NB_VAGUES}
#define NB_PHARES ${NB_PHARES_MAX}
uniform float uTemps;
uniform float uAmpli;
uniform vec4 uVagueDir[NB_VAGUES];
uniform vec3 uVagueAmp[NB_VAGUES];
uniform vec3 uCalmes[NB_PHARES];
uniform float uRayonCalme;
uniform float uForceCalme;
uniform float uApaisement;
uniform vec3 uCamPos;

varying vec3 vMonde;
varying vec3 vNormale;
varying float vCrete;
varying float vHauteur;

float calme(vec2 p) {
  float c = 0.0;
  for (int i = 0; i < NB_PHARES; i++) {
    if (uCalmes[i].z < 0.5) continue;
    float d = length(p - uCalmes[i].xy);
    c = max(c, smoothstep(uRayonCalme * 1.25, uRayonCalme * 0.45, d) * uForceCalme);
  }
  return max(c, uApaisement * 0.75);
}

void main() {
  vec4 monde = modelMatrix * vec4(position, 1.0);
  vec2 p = monde.xz;
  float dist = length(p - uCamPos.xz);
  float ampli = uAmpli * (1.0 - calme(p));
  vec3 deplacement = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crete = 0.0;
  for (int i = 0; i < NB_VAGUES; i++) {
    vec4 dv = uVagueDir[i];
    vec3 av = uVagueAmp[i];
    float longueur = 6.2831 / dv.z;
    // les petites vagues s'effacent au loin (pas d'aliasing)
    float fondu = 1.0 - smoothstep(longueur * 18.0, longueur * 40.0, dist);
    float a = av.x * ampli * fondu;
    float f = dv.z * dot(dv.xy, p) - dv.w * uTemps + av.z;
    float s = sin(f);
    float c = cos(f);
    deplacement.xz += av.y * a * dv.xy * c;
    deplacement.y += a * s;
    n.xz -= dv.xy * dv.z * a * c;
    n.y -= av.y * dv.z * a * s;
    crete += av.y * dv.z * a * s;
  }
  monde.xyz += deplacement;
  vMonde = monde.xyz;
  vNormale = normalize(n);
  vCrete = crete;
  vHauteur = deplacement.y / max(uAmpli, 0.01);
  gl_Position = projectionMatrix * viewMatrix * monde;
}
`;

const FRAGMENT = /* glsl */ `
#define NB_PHARES ${NB_PHARES_MAX}
#define NB_SILLAGE ${NB_SILLAGE}
uniform float uTemps;
uniform vec3 uCamPos;
uniform sampler2D uTerrain;
uniform vec3 uTerrainZone; // xmin, zmin, taille
uniform vec3 uLanternePos;
uniform vec3 uLanterneCouleur;
uniform float uLanterneForce;
uniform vec4 uPhares[NB_PHARES]; // position de la lampe, w = allumé
uniform float uPharesAngle[NB_PHARES];
uniform vec4 uSillage[NB_SILLAGE]; // x, z, âge (0..1), force
uniform vec3 uBateau;
uniform float uDensiteBrume;
uniform float uPluie;
uniform vec4 uOnde; // onde de lumière d'un phare qu'on rallume : x, z, rayon, force

varying vec3 vMonde;
varying vec3 vNormale;
varying float vCrete;
varying float vHauteur;

${GLSL_BRUIT}
${GLSL_CIEL}

float terrain(vec2 p) {
  vec2 uv = (p - uTerrainZone.xy) / uTerrainZone.z;
  return texture2D(uTerrain, uv).r * 24.0 - 12.0;
}

// petites rides de vent : bruit qui défile dans deux directions, dérivé par différences finies
float hRides(vec2 p, float t) {
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
  return fbm3(p * 0.42 + vec2(t * 0.32, t * 0.11)) * 0.6
       + fbm3(q * 1.25 - vec2(t * 0.22, -t * 0.38)) * 0.28
       + bruit(p * 3.6 + vec2(t * 0.9, t * 0.4)) * 0.07;
}
vec2 rides(vec2 p, float t) {
  float e = 0.07;
  float h = hRides(p, t);
  return vec2(hRides(p + vec2(e, 0.0), t) - h, hRides(p + vec2(0.0, e), t) - h) / e * 0.85;
}

// impacts de pluie : anneaux qui s'élargissent sur une grille
vec2 gouttes(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int couche = 0; couche < 2; couche++) {
    vec2 q = p * (1.3 + float(couche) * 0.7) + float(couche) * 17.3;
    vec2 cellule = floor(q);
    vec2 r = hash22(cellule);
    vec2 centre = cellule + 0.2 + 0.6 * r;
    float phase = fract(t * 1.4 + r.x * 7.0);
    vec2 v = q - centre;
    float d = length(v);
    float rayon = phase * 0.55;
    float e = (d - rayon) * 9.0;
    float onde = sin((d - rayon) * 40.0) * exp(-e * e) * (1.0 - phase);
    g += (v / max(d, 1e-3)) * onde * 0.9;
  }
  return g;
}

float occlusionPhare(vec3 lampe, vec2 cible) {
  float visible = 1.0;
  for (int i = 1; i < 10; i++) {
    float s = float(i) / 10.0;
    vec2 p = mix(lampe.xz, cible, s);
    float hauteurRayon = mix(lampe.y, 0.5, s);
    visible *= smoothstep(1.5, -1.5, terrain(p) - hauteurRayon);
  }
  return visible;
}

void main() {
  vec3 P = vMonde;
  vec3 versCam = uCamPos - P;
  float dist = length(versCam);
  vec3 V = versCam / dist;

  // normale : houle + rides + gouttes, atténuées avec la distance
  vec3 N = normalize(vNormale);
  float proximite = 1.0 - smoothstep(20.0, 160.0, dist);
  vec2 g = rides(P.xz, uTemps) * (0.35 + 0.65 * proximite);
  g += gouttes(P.xz, uTemps) * uPluie * (1.0 - smoothstep(6.0, 35.0, dist)) * 0.5;
  N = normalize(N + vec3(-g.x, 0.0, -g.y));

  float fond = terrain(P.xz);
  float hautFond = smoothstep(-9.0, -0.5, fond);

  // écume
  float motif = fbm(P.xz * 0.35 + vec2(uTemps * 0.15, -uTemps * 0.1));
  float motifFin = fbm(P.xz * 1.3 - vec2(uTemps * 0.3, 0.0));
  float ecumeCrete = smoothstep(0.42, 0.95, vCrete + vHauteur * 0.25) * smoothstep(0.35, 0.75, motif);
  float vagueRivage = 0.5 + 0.5 * sin(fond * 2.2 + uTemps * 1.8 + motif * 4.0);
  float ecumeRivage = smoothstep(-2.2, -0.4, fond) * (0.35 + 0.65 * vagueRivage);
  ecumeRivage *= smoothstep(0.3, 0.6, motifFin + 0.3 * smoothstep(-1.0, 0.0, fond));
  float ecumeSillage = 0.0;
  if (length(P.xz - uBateau.xz) < 140.0) {
    for (int i = 0; i < NB_SILLAGE; i++) {
      vec4 s = uSillage[i];
      if (s.w <= 0.0) continue;
      float r = 0.9 + s.z * 5.0;
      float d = length(P.xz - s.xy);
      ecumeSillage += exp(-d * d / (r * r)) * s.w * (1.0 - s.z);
    }
    ecumeSillage = clamp(ecumeSillage * 1.6, 0.0, 1.0) * smoothstep(0.2, 0.5, motifFin + 0.2);
  }
  float ecume = clamp(ecumeCrete + ecumeRivage + ecumeSillage, 0.0, 1.0);

  // couleurs de l'eau
  vec3 profond = mix(vec3(0.0025, 0.007, 0.011), vec3(0.01, 0.035, 0.05), uAube);
  vec3 diffusion = vec3(0.03, 0.16, 0.15);
  vec3 eau = mix(profond, diffusion * 0.25, hautFond * 0.6);

  // lumière reçue (diffuse) : ambiance, éclair, lanterne, faisceaux
  vec3 lumiere = vec3(0.012, 0.016, 0.024) + vec3(0.25, 0.3, 0.4) * uAube;
  lumiere += uFlash * vec3(0.28, 0.31, 0.45) * (0.4 + 0.6 * max(N.y, 0.0));
  vec3 speculaire = vec3(0.0);

  // lanterne du bateau
  vec3 L = uLanternePos - P;
  float dL = length(L);
  L /= dL;
  float attL = uLanterneForce / (1.0 + dL * dL / 55.0);
  lumiere += uLanterneCouleur * attL * (0.2 + 0.4 * max(dot(N, L), 0.0));
  vec3 H = normalize(L + V);
  speculaire += uLanterneCouleur * pow(max(dot(N, H), 0.0), 220.0) * attL * 4.0;

  // phares
  for (int i = 0; i < NB_PHARES; i++) {
    vec4 ph = uPhares[i];
    if (ph.w <= 0.001) continue;
    vec3 Lp = ph.xyz - P;
    float d = length(Lp);
    Lp /= d;
    vec3 couleur = vec3(1.0, 0.8, 0.52) * ph.w;
    // reflet scintillant de la lampe elle-même
    vec3 Hp = normalize(Lp + V);
    float nh = max(dot(N, Hp), 0.0);
    speculaire += couleur * (pow(nh, 900.0) * 9.0 + pow(nh, 90.0) * 0.22) / (1.0 + d * d / 90000.0);
    // le faisceau tournant qui balaie la mer (deux pinceaux opposés)
    vec2 dir = P.xz - ph.xz;
    float a = atan(dir.y, dir.x) - uPharesAngle[i];
    float ecart = abs(mod(a + 1.5708, 3.14159) - 1.5708);
    float largeur = 0.07 + 6.0 / max(d, 10.0);
    float pinceau = exp(-ecart * ecart / (largeur * largeur));
    if (pinceau > 0.01) {
      float portee = smoothstep(30.0, 90.0, d) * (1.0 - smoothstep(180.0, 520.0, d));
      float force = pinceau * portee * occlusionPhare(ph.xyz, P.xz);
      lumiere += couleur * force * 0.7;
      speculaire += couleur * force * pow(max(dot(N, normalize(Lp + V)), 0.0), 40.0) * 3.0;
    }
    // halo de la zone sûre
    lumiere += couleur * 0.025 / (1.0 + d * d / 900.0);
  }

  // l'onde dorée qui part d'un phare rallumé
  if (uOnde.w > 0.0) {
    float dOnde = length(P.xz - uOnde.xy);
    float e = (dOnde - uOnde.z) / (6.0 + uOnde.z * 0.06);
    float anneau = exp(-e * e) * uOnde.w;
    lumiere += vec3(1.0, 0.72, 0.4) * anneau * (0.6 + 0.8 * motif);
    speculaire += vec3(1.0, 0.75, 0.45) * anneau * pow(max(dot(N, V), 0.0), 2.0) * 0.6;
  }

  // reflet du ciel
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fresnel = 0.02 + 0.98 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 5.0);
  vec3 ciel = couleurCielSimple(R);
  // l'éclair se reflète
  speculaire += uFlash * vec3(0.7, 0.75, 1.0) * pow(max(dot(R, uFlashDir), 0.0), 60.0) * 1.0;

  // diffusion sous la surface sur les crêtes éclairées
  float sss = clamp(vHauteur * 0.6 + 0.4, 0.0, 1.0) * sqrt(clamp(1.0 - N.y, 0.0, 1.0));
  vec3 couleur = eau * (0.3 + lumiere * 3.0) + diffusion * sss * lumiere * 0.6;
  couleur = mix(couleur, ciel, fresnel * 0.75);
  couleur += speculaire;
  vec3 blancEcume = vec3(0.75, 0.82, 0.85);
  couleur = mix(couleur, blancEcume * (lumiere * 1.4 + 0.004), ecume * 0.92);

  // brume
  float fb = dist * uDensiteBrume;
  float f = 1.0 - exp(-fb * fb);
  vec3 brume = uBrume + uFlash * vec3(0.2, 0.22, 0.3);
  couleur = mix(couleur, brume, f);
  gl_FragColor = vec4(couleur, 1.0);
}
`;

/** Grille plus dense au centre qu'aux bords. */
function grilleOcean(segments: number, etendue: number) {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  const f = (u: number) => Math.sign(u) * (Math.abs(u) * 0.08 + Math.pow(Math.abs(u), 2.6) * 0.92) * etendue;
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * 2 - 1;
      const v = (j / segments) * 2 - 1;
      pos.push(f(u), 0, f(v));
    }
  }
  const l = segments + 1;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * l + i;
      idx.push(a, a + l, a + 1, a + 1, a + l, a + l + 1);
    }
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), etendue * 2);
  return geo;
}

export class Ocean {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  private sillage: THREE.Vector4[];

  constructor(terrain: THREE.Texture, zone: THREE.Vector3, segments = 300) {
    this.sillage = Array.from({ length: NB_SILLAGE }, () => new THREE.Vector4(0, 0, 1, 0));
    this.uniforms = {
      uTemps: { value: 0 },
      uAmpli: { value: 1 },
      ...uniformesVagues(),
      uCalmes: { value: Array.from({ length: NB_PHARES_MAX }, () => new THREE.Vector3()) },
      uRayonCalme: { value: REGLAGES.phares.rayonZoneSure },
      uForceCalme: { value: REGLAGES.phares.calmeZoneSure },
      uApaisement: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uTerrain: { value: terrain },
      uTerrainZone: { value: zone },
      uLanternePos: { value: new THREE.Vector3() },
      uLanterneCouleur: { value: new THREE.Color(1.0, 0.55, 0.22) },
      uLanterneForce: { value: 1 },
      uPhares: { value: Array.from({ length: NB_PHARES_MAX }, () => new THREE.Vector4()) },
      uPharesAngle: { value: new Array(NB_PHARES_MAX).fill(0) },
      uSillage: { value: this.sillage },
      uBateau: { value: new THREE.Vector3() },
      uDensiteBrume: { value: 0.0028 },
      uPluie: { value: 1 },
      uOnde: { value: new THREE.Vector4(0, 0, 0, 0) },
      uAube: { value: 0 },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
      uBrume: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
    });
    this.mesh = new THREE.Mesh(grilleOcean(segments, 1500), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** La grille suit la caméra (la houle est calculée en coordonnées monde). */
  suivre(camera: THREE.Vector3) {
    this.mesh.position.set(camera.x, 0, camera.z);
    (this.uniforms.uCamPos.value as THREE.Vector3).copy(camera);
  }

  /** Points de sillage : [x, z, âge 0..1, force]. */
  majSillage(points: { x: number; z: number; age: number; force: number }[]) {
    for (let i = 0; i < NB_SILLAGE; i++) {
      const p = points[i];
      if (p) this.sillage[i].set(p.x, p.z, p.age, p.force);
      else this.sillage[i].set(0, 0, 1, 0);
    }
  }
}
