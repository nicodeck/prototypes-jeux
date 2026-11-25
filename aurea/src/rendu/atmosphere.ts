// L'atmosphère partagée par tous les matériaux : la lumière du moment, la brume, les nuages et
// leur ombre qui glisse sur l'île, le vent, la pluie.
//
// Les uniformes vivent dans un seul objet, `ATMO`, que chaque matériau référence : on les met à
// jour une fois par image et tout suit. `patcher` greffe ces effets sur un MeshStandardMaterial
// de Three, sans toucher à son éclairage physique ni à ses ombres.
import * as THREE from "three";

// ---------------------------------------------------------------------------------------------
// Une texture de bruit, faite une fois au démarrage et qui se répète sans couture
// ---------------------------------------------------------------------------------------------

/** Quatre bruits fractals dans les quatre canaux, du plus large (r) au plus fin (a). */
export function creerTextureBruit(taille = 256): THREE.DataTexture {
  const data = new Uint8Array(taille * taille * 4);
  const lisse = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grilles = new Map<number, Float32Array>();
  let graine = 1234567;
  const alea = () => {
    graine = (graine * 1664525 + 1013904223) >>> 0;
    return graine / 4294967296;
  };
  const grille = (periode: number) => {
    let g = grilles.get(periode);
    if (!g) {
      g = new Float32Array(periode * periode);
      for (let i = 0; i < g.length; i++) g[i] = alea();
      grilles.set(periode, g);
    }
    return g;
  };
  const valeur = (x: number, y: number, periode: number) => {
    const g = grille(periode);
    const fx = (x / taille) * periode;
    const fy = (y / taille) * periode;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = lisse(fx - x0);
    const ty = lisse(fy - y0);
    const a = (i: number, j: number) => g[((j + periode) % periode) * periode + ((i + periode) % periode)]!;
    const h = a(x0, y0) * (1 - tx) + a(x0 + 1, y0) * tx;
    const b = a(x0, y0 + 1) * (1 - tx) + a(x0 + 1, y0 + 1) * tx;
    return h * (1 - ty) + b * ty;
  };
  const bases = [4, 8, 16, 32];
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      for (let c = 0; c < 4; c++) {
        let somme = 0;
        let poids = 0;
        let amp = 1;
        for (let o = 0, p = bases[c]!; o < 5 && p <= taille; o++, p *= 2) {
          somme += valeur(x, y, p) * amp;
          poids += amp;
          amp *= 0.5;
        }
        // On étale les valeurs pour qu'elles couvrent mieux 0..1
        const v = Math.min(1, Math.max(0, (somme / poids - 0.5) * 1.9 + 0.5));
        data[(y * taille + x) * 4 + c] = Math.round(v * 255);
      }
    }
  }
  const tex = new THREE.DataTexture(data, taille, taille, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function texturePlaceholder() {
  const t = new THREE.DataTexture(new Uint8Array([140, 170, 210, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Les uniformes partagés
// ---------------------------------------------------------------------------------------------

export const ATMO = {
  uTemps: { value: 0 },
  /** L'heure du jour, de 0 à 24 */
  uHeure: { value: 9 },
  /** Vers le soleil (il peut être sous l'horizon) */
  uSoleilDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
  /** Vers la lumière qui éclaire en ce moment : le soleil le jour, la lune la nuit */
  uLumiereDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
  uLumiereCouleur: { value: new THREE.Color(1, 0.95, 0.85) },
  /** 0 en plein jour, 1 en pleine nuit */
  uNuit: { value: 0 },
  /** La part des fenêtres allumées */
  uLampes: { value: 0 },
  /** La brume : densité au niveau de la mer, et hauteur sur laquelle elle s'amincit de e */
  uBrumeDensite: { value: 0.0035 },
  uBrumeHauteur: { value: 22 },
  uBrumeTeinte: { value: new THREE.Color(1, 1, 1) },
  /** Une brume basse, qui stagne au ras de l'eau et dans les creux (l'aube) */
  uBrumeBasse: { value: 0 },
  /** La couverture nuageuse, de 0 (ciel pur) à 1 (couvert) */
  uNuages: { value: 0.3 },
  uNuagesDecalage: { value: new THREE.Vector2(0, 0) },
  /** Le vent : direction et force (0 à 1) */
  uVent: { value: new THREE.Vector2(0.8, 0.35) },
  uPluie: { value: 0 },
  /** Un éclair : l'île entière flashe en blanc bleuté */
  uEclair: { value: 0 },
  uBruit: { value: null as unknown as THREE.Texture },
  /** La couleur du ciel dans chaque direction (calculée par le ciel), qui teinte la brume */
  uCielVue: { value: texturePlaceholder() as THREE.Texture },
};

let bruitPret = false;
export function preparerAtmosphere() {
  if (bruitPret) return;
  ATMO.uBruit.value = creerTextureBruit();
  bruitPret = true;
}

/** Altitude de la couche de nuages, en cases */
export const ALTITUDE_NUAGES = 230;

// ---------------------------------------------------------------------------------------------
// Le GLSL commun
// ---------------------------------------------------------------------------------------------

export const GLSL_COMMUN = /* glsl */ `
  uniform float uTemps;
  uniform float uHeure;
  uniform vec3 uSoleilDir;
  uniform vec3 uLumiereDir;
  uniform vec3 uLumiereCouleur;
  uniform float uNuit;
  uniform float uLampes;
  uniform float uBrumeDensite;
  uniform float uBrumeHauteur;
  uniform vec3 uBrumeTeinte;
  uniform float uBrumeBasse;
  uniform float uNuages;
  uniform vec2 uNuagesDecalage;
  uniform vec2 uVent;
  uniform float uPluie;
  uniform float uEclair;
  uniform sampler2D uBruit;
  uniform sampler2D uCielVue;

  float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

  /** Bruit lissé (canal r de la texture : large, a : fin) */
  vec4 bruitTex(vec2 p) { return texture2D(uBruit, p); }

  /** Densité des nuages au-dessus du point (x, z) du monde, entre 0 et 1 */
  float densiteNuages(vec2 p) {
    vec2 q = p * 0.0016 + uNuagesDecalage;
    float n = texture2D(uBruit, q).r * 0.6 + texture2D(uBruit, q * 2.7 + vec2(0.31, 0.17)).g * 0.28 + texture2D(uBruit, q * 6.3 + vec2(0.71, 0.43)).b * 0.12;
    float seuil = mix(0.78, 0.30, uNuages);
    return smoothstep(seuil, seuil + 0.22, n);
  }

  /** L'ombre des nuages sur un point du monde, vue depuis la lumière */
  float ombreNuages(vec3 p) {
    vec3 L = uLumiereDir;
    float t = (${ALTITUDE_NUAGES.toFixed(1)} - p.y) / max(L.y, 0.08);
    vec2 q = p.xz + L.xz * t;
    float d = densiteNuages(q);
    return 1.0 - d * mix(0.72, 0.9, uNuages);
  }

  /** Coordonnées dans la vue du ciel : longitude, et latitude resserrée près de l'horizon */
  vec2 uvCiel(vec3 d) {
    float u = atan(d.z, d.x) / 6.2831853 + 0.5;
    float lat = asin(clamp(d.y, -1.0, 1.0)) / 1.5707963;
    float v = 0.5 + 0.5 * sign(lat) * sqrt(abs(lat));
    return vec2(u, v);
  }

  vec3 couleurCiel(vec3 d) {
    d.y = max(d.y, 0.0);
    return texture2D(uCielVue, uvCiel(normalize(d))).rgb;
  }

  /** La brume : en hauteur (elle s'amincit en montant) et à distance, teintée par le ciel */
  vec3 brume(vec3 couleur, vec3 posMonde) {
    vec3 v = posMonde - cameraPosition;
    float dist = length(v);
    vec3 dir = v / max(dist, 1e-4);
    float H = uBrumeHauteur;
    float a = uBrumeDensite * exp(-max(cameraPosition.y, 0.0) / H);
    float b = dir.y / H;
    float integrale = abs(b) > 1e-5 ? a * (1.0 - exp(-b * dist)) / b : a * dist;
    // La brume basse, au ras de l'eau
    float hb = 2.2;
    float ab = uBrumeBasse * 0.06 * exp(-max(cameraPosition.y, 0.0) / hb);
    float bb = dir.y / hb;
    integrale += abs(bb) > 1e-5 ? ab * (1.0 - exp(-bb * dist)) / bb : ab * dist;
    float f = 1.0 - exp(-max(integrale, 0.0));
    vec3 ciel = min(couleurCiel(dir), vec3(1.6)) * uBrumeTeinte;
    return mix(couleur, ciel, f);
  }

  /** Le balancement dans le vent d'un point à la hauteur locale h, autour de l'origine o */
  vec3 balancement(vec3 o, float h, float amplitude) {
    float force = length(uVent);
    float phase = uTemps * (1.1 + force * 1.4) + dot(o.xz, vec2(0.21, 0.17));
    float rafale = texture2D(uBruit, o.xz * 0.004 + uTemps * vec2(0.012, 0.007)).r;
    float s = sin(phase) * 0.5 + sin(phase * 2.3 + 1.7) * 0.25;
    float pousse = (0.35 + rafale * 1.3) * force;
    vec2 dir = force > 1e-3 ? uVent / force : vec2(1.0, 0.0);
    vec2 dep = dir * (pousse + s * (0.25 + force * 0.4)) * amplitude * h * h;
    return vec3(dep.x, -dot(dep, dep) * 0.3, dep.y);
  }
`;

// ---------------------------------------------------------------------------------------------
// La greffe sur les matériaux de Three
// ---------------------------------------------------------------------------------------------

export interface Extension {
  /** Nom unique de la variante de shader */
  cle: string;
  vertexDecl?: string;
  /** Après begin_vertex : on peut modifier `transformed` (espace local de l'objet) */
  vertexDebut?: string;
  /** À la fin du vertex shader : vMonde, vNormalMonde et vLocal sont prêts */
  vertexFin?: string;
  fragDecl?: string;
  /** Après color_fragment : on peut modifier diffuseColor */
  fragCouleur?: string;
  /** Après metalnessmap_fragment : roughnessFactor, metalnessFactor */
  fragMatiere?: string;
  /** Après normal_fragment_maps : `normal` est en espace vue */
  fragNormale?: string;
  /** Après emissivemap_fragment : totalEmissiveRadiance */
  fragEmission?: string;
  /** Juste avant la brume : gl_FragColor est prêt */
  fragFin?: string;
  /** Amplitude du balancement dans le vent (0 : immobile), proportionnelle au carré de la hauteur locale */
  vent?: number;
  /** La pluie mouille les surfaces tournées vers le ciel */
  mouille?: boolean;
}

export function patcher<T extends THREE.Material>(materiau: T, ext: Extension): T {
  const vent = ext.vent ?? 0;
  materiau.onBeforeCompile = (shader) => {
    for (const [nom, u] of Object.entries(ATMO)) shader.uniforms[nom] = u;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${GLSL_COMMUN}
        varying vec3 vMonde;
        varying vec3 vNormalMonde;
        varying vec3 vLocal;
        ${ext.vertexDecl ?? ""}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        mat4 matriceMonde = modelMatrix;
        #ifdef USE_BATCHING
          matriceMonde = matriceMonde * batchingMatrix;
        #endif
        #ifdef USE_INSTANCING
          matriceMonde = matriceMonde * instanceMatrix;
        #endif
        vLocal = transformed;
        ${ext.vertexDebut ?? ""}
        ${
          vent > 0
            ? `{
          vec3 origine = (matriceMonde * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 depMonde = balancement(origine, max(transformed.y, 0.0), ${vent.toFixed(4)});
          transformed += inverse(mat3(matriceMonde)) * depMonde;
        }`
            : ""
        }`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vMonde = (matriceMonde * vec4(transformed, 1.0)).xyz;
        vNormalMonde = normalize(mat3(matriceMonde) * objectNormal);`,
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
        ${ext.vertexFin ?? ""}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${GLSL_COMMUN}
        varying vec3 vMonde;
        varying vec3 vNormalMonde;
        varying vec3 vLocal;
        ${ext.fragDecl ?? ""}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        ${ext.fragCouleur ?? ""}`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        ${
          ext.mouille !== false
            ? `{
          float mouille = uPluie * smoothstep(0.25, 0.85, vNormalMonde.y);
          diffuseColor.rgb *= 1.0 - 0.32 * mouille;
          roughnessFactor = mix(roughnessFactor, 0.22, mouille * 0.85);
        }`
            : ""
        }
        ${ext.fragMatiere ?? ""}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        ${ext.fragNormale ?? ""}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        ${ext.fragEmission ?? ""}`,
      )
      .replace("getSunLightInfo( sunLight, directLight );", "getSunLightInfo( sunLight, directLight ); directLight.color *= ombreNuages(vMonde);")
      .replace(
        "getDirectionalLightInfo( directionalLight, directLight );",
        "getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= ombreNuages(vMonde);",
      )
      .replace(
        "#include <fog_fragment>",
        `${ext.fragFin ?? ""}
        gl_FragColor.rgb = brume(gl_FragColor.rgb, vMonde);
        gl_FragColor.rgb += uEclair * vec3(0.55, 0.62, 0.8) * diffuseColor.rgb * max(vNormalMonde.y, 0.2);`,
      );
  };
  materiau.customProgramCacheKey = () => ext.cle;
  return materiau;
}

/** Le même code de brume, pour les ShaderMaterial écrits à la main (la mer, le ciel lointain). */
export function uniformesAtmo(): Record<string, THREE.IUniform> {
  return { ...ATMO };
}
