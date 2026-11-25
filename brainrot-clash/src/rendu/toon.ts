// Le style manga : ombres franches, trame de points dans les ombres, liseré de lumière
// et contours encrés (une coque retournée, un peu plus grosse que l'objet, dessinée en noir).
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Uniforms partagés par tous les matériaux : réglés une fois par image. */
export const GLOBAL = {
  uLumiere: { value: new THREE.Vector3(-0.4, 0.75, 0.95).normalize() },
  uResolution: { value: new THREE.Vector2(1280, 720) },
  uCellule: { value: 5 },
  uEpaisseur: { value: 2.2 },
  uTemps: { value: 0 },
};

const TOON_VERTEX = /* glsl */ `
  varying vec3 vN;
  varying vec3 vVue;
  varying vec2 vUv;
  varying float vHauteur;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vVue = -mv.xyz;
    vHauteur = (modelMatrix * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * mv;
  }
`;

const TOON_FRAGMENT = /* glsl */ `
  uniform vec3 uCouleur;
  uniform vec3 uOmbre;
  uniform vec3 uLumiere;
  uniform float uRim;
  uniform float uBrillance;
  uniform float uTrame;
  uniform float uCellule;
  uniform float uEclat;
  uniform vec3 uEclatCouleur;
  uniform float uDetail;
  uniform sampler2D uCarte;
  uniform float uDegrade;
  varying vec3 vN;
  varying vec3 vVue;
  varying vec2 vUv;
  varying float vHauteur;

  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 L = normalize((viewMatrix * vec4(uLumiere, 0.0)).xyz);
    vec3 V = normalize(vVue);
    float ndl = dot(N, L);
    float w = max(fwidth(ndl), 0.004);
    float eclaire = smoothstep(-w, w, ndl - 0.08);

    vec3 base = uCouleur;
    if (uDegrade > 0.0) base *= mix(1.0 - uDegrade, 1.0, clamp(vHauteur * 0.25 + 0.5, 0.0, 1.0));
    vec3 ombre = uOmbre * (base / max(uCouleur, vec3(0.001)));
    vec3 col = mix(ombre, base, eclaire);

    // Trame : des points en diagonale dans les ombres profondes, comme un manga imprimé.
    float c = 0.7071;
    vec2 q = mat2(c, -c, c, c) * gl_FragCoord.xy / uCellule;
    float d = length(fract(q) - 0.5);
    float profondeur = smoothstep(-0.05, -0.75, ndl);
    float r = 0.48 * profondeur;
    float point = 1.0 - smoothstep(r - 0.06, r + 0.06, d);
    col = mix(col, ombre * 0.62, point * uTrame * (1.0 - eclaire));

    // Reflet franc (cheveux, métal).
    if (uBrillance > 0.0) {
      vec3 H = normalize(L + V);
      float s = dot(N, H);
      col = mix(col, vec3(1.0, 0.98, 0.94), smoothstep(0.93, 0.94, s) * uBrillance);
    }

    // Liseré de lumière sur les bords.
    float fres = 1.0 - max(dot(N, V), 0.0);
    float rim = smoothstep(0.62, 0.68, fres) * uRim * smoothstep(-0.4, 0.3, ndl);
    col = mix(col, base * 1.35 + 0.08, rim * 0.55);

    // Détails peints (coutures, muscles, motifs) : une texture dont l'alpha dit où peindre.
    if (uDetail > 0.0) {
      vec4 t = texture2D(uCarte, vUv);
      col = mix(col, t.rgb * mix(0.7, 1.0, eclaire), t.a * uDetail);
    }

    col = mix(col, uEclatCouleur, uEclat);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CONTOUR_VERTEX = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uEpaisseur;
  uniform float uFacteur;
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec2 dir = normalize(n.xy + vec2(1e-5));
    clip.xy += dir * uEpaisseur * uFacteur * 2.0 / uResolution * clip.w;
    gl_Position = clip;
  }
`;

const CONTOUR_FRAGMENT = /* glsl */ `
  uniform vec3 uTrait;
  uniform float uEclat;
  uniform vec3 uEclatCouleur;
  void main() {
    gl_FragColor = vec4(mix(uTrait, uEclatCouleur * 0.4, uEclat * 0.5), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface OptionsToon {
  ombre?: THREE.ColorRepresentation;
  rim?: number;
  brillance?: number;
  trame?: number;
  carte?: THREE.Texture;
  degrade?: number;
  cote?: THREE.Side;
  /** Un uniform d'éclat partagé (le perso blanchit quand il est touché). */
  eclat?: { value: number };
  eclatCouleur?: { value: THREE.Color };
}

/** L'ombre par défaut : plus sombre, plus saturée et tirée vers le violet. */
export function ombreDe(couleur: THREE.ColorRepresentation) {
  const c = new THREE.Color(couleur);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const violet = 0.72;
  let dh = violet - hsl.h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const o = new THREE.Color();
  o.setHSL((hsl.h + dh * 0.18 + 1) % 1, Math.min(1, hsl.s * 1.1 + 0.05), hsl.l * 0.6);
  return o;
}

export function matToon(couleur: THREE.ColorRepresentation, o: OptionsToon = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCouleur: { value: new THREE.Color(couleur) },
      uOmbre: { value: o.ombre !== undefined ? new THREE.Color(o.ombre) : ombreDe(couleur) },
      uLumiere: GLOBAL.uLumiere,
      uCellule: GLOBAL.uCellule,
      uRim: { value: o.rim ?? 1 },
      uBrillance: { value: o.brillance ?? 0 },
      uTrame: { value: o.trame ?? 1 },
      uEclat: o.eclat ?? { value: 0 },
      uEclatCouleur: o.eclatCouleur ?? { value: new THREE.Color("#ffffff") },
      uDetail: { value: o.carte ? 1 : 0 },
      uCarte: { value: o.carte ?? null },
      uDegrade: { value: o.degrade ?? 0 },
    },
    vertexShader: TOON_VERTEX,
    fragmentShader: TOON_FRAGMENT,
    side: o.cote ?? THREE.FrontSide,
  });
}

export function matContour(facteur = 1, trait: THREE.ColorRepresentation = "#1b1220", eclat?: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uResolution: GLOBAL.uResolution,
      uEpaisseur: GLOBAL.uEpaisseur,
      uFacteur: { value: facteur },
      uTrait: { value: new THREE.Color(trait) },
      uEclat: eclat ?? { value: 0 },
      uEclatCouleur: { value: new THREE.Color("#ffffff") },
    },
    vertexShader: CONTOUR_VERTEX,
    fragmentShader: CONTOUR_FRAGMENT,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
}

const lisses = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Une géométrie aux normales lissées, pour que le contour d'un objet à arêtes vives reste fermé. */
export function geometrieLissee(g: THREE.BufferGeometry) {
  const deja = lisses.get(g);
  if (deja) return deja;
  const copie = new THREE.BufferGeometry();
  copie.setAttribute("position", g.getAttribute("position"));
  if (g.index) copie.setIndex(g.index);
  const fusion = mergeVertices(copie, 1e-4);
  fusion.computeVertexNormals();
  lisses.set(g, fusion);
  return fusion;
}

/** Ajoute un contour encré à un objet (et à ses enfants si demandé). */
export function encrer(
  mesh: THREE.Mesh,
  facteur = 1,
  options: { lisser?: boolean; trait?: THREE.ColorRepresentation; eclat?: { value: number } } = {},
) {
  const g = options.lisser ? geometrieLissee(mesh.geometry) : mesh.geometry;
  const coque = new THREE.Mesh(g, matContour(facteur, options.trait, options.eclat));
  coque.name = "contour";
  coque.renderOrder = mesh.renderOrder;
  mesh.add(coque);
  return mesh;
}

/** Un objet cel-shadé et encré en une ligne. */
export function piece(
  geometrie: THREE.BufferGeometry,
  materiau: THREE.Material,
  contour = 1,
  options: { lisser?: boolean; trait?: THREE.ColorRepresentation; eclat?: { value: number } } = {},
) {
  const m = new THREE.Mesh(geometrie, materiau);
  if (contour > 0) encrer(m, contour, options);
  return m;
}
