// Le ciel : une vraie diffusion atmosphérique (Rayleigh pour le bleu, Mie pour le halo du soleil),
// calculée pour chaque direction dans une petite texture, la « vue du ciel ». Le dôme la lit, et
// la brume de tous les matériaux aussi : l'horizon et le lointain ont toujours la couleur exacte
// du ciel à cet endroit, rose à l'aube, doré au couchant.
//
// Par-dessus : le disque du soleil, la lune, les étoiles et la Voie lactée la nuit, les nuages
// (la même couche que celle qui fait de l'ombre sur l'île), l'arc-en-ciel après la pluie et
// l'éclair de l'orage. Le ciel sert aussi de lumière d'ambiance et de reflet à tous les
// matériaux (environment map), recalculée quand le soleil a bougé.
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ALTITUDE_NUAGES, ATMO, GLSL_COMMUN } from "./atmosphere";

const GLSL_DIFFUSION = /* glsl */ `
  const float RT = 6360e3;
  const float RA = 6420e3;
  const vec3 BR = vec3(5.5e-6, 13.0e-6, 22.4e-6);
  const vec3 BM = vec3(13e-6);
  const float HR = 7994.0;
  const float HM = 1200.0;
  const float PI_ = 3.14159265;

  vec2 sphere(vec3 o, vec3 d, float r) {
    float b = dot(o, d);
    float c = dot(o, o) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  vec3 diffusion(vec3 dir, vec3 L, float intensite, float g) {
    vec3 o = vec3(0.0, RT + 60.0, 0.0);
    float t = sphere(o, dir, RA).y;
    const int N = 14;
    const int NL = 5;
    float ds = t / float(N);
    vec3 sR = vec3(0.0);
    vec3 sM = vec3(0.0);
    float odR = 0.0;
    float odM = 0.0;
    float mu = dot(dir, L);
    float pR = 3.0 / (16.0 * PI_) * (1.0 + mu * mu);
    float pM = 3.0 / (8.0 * PI_) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(max(1.0 + g * g - 2.0 * g * mu, 1e-4), 1.5));
    for (int i = 0; i < N; i++) {
      vec3 p = o + dir * (ds * (float(i) + 0.5));
      float h = length(p) - RT;
      float hr = exp(-h / HR) * ds;
      float hm = exp(-h / HM) * ds;
      odR += hr;
      odM += hm;
      float tl = sphere(p, L, RA).y;
      float dl = tl / float(NL);
      float lR = 0.0;
      float lM = 0.0;
      bool ombre = false;
      for (int j = 0; j < NL; j++) {
        vec3 q = p + L * (dl * (float(j) + 0.5));
        float hl = length(q) - RT;
        if (hl < 0.0) { ombre = true; break; }
        lR += exp(-hl / HR) * dl;
        lM += exp(-hl / HM) * dl;
      }
      if (!ombre) {
        vec3 tau = BR * (odR + lR) + BM * 1.1 * (odM + lM);
        vec3 att = exp(-tau);
        sR += att * hr;
        sM += att * hm;
      }
    }
    return intensite * (sR * BR * pR + sM * BM * pM);
  }
`;

const VUE = {
  uniforms: {
    uSoleil: { value: new THREE.Vector3(0, 1, 0) },
    uLune: { value: new THREE.Vector3(0, -1, 0) },
    uNuages: { value: 0 },
    uOrage: { value: 0 },
    uBrumeHorizon: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uSoleil;
    uniform vec3 uLune;
    uniform float uNuages;
    uniform float uOrage;
    uniform float uBrumeHorizon;
    varying vec2 vUv;
    ${GLSL_DIFFUSION}

    vec3 dirDepuisUV(vec2 uv) {
      float az = (uv.x - 0.5) * 6.2831853;
      float s = (uv.y - 0.5) * 2.0;
      float lat = sign(s) * s * s * 1.5707963;
      return vec3(cos(lat) * cos(az), sin(lat), cos(lat) * sin(az));
    }

    void main() {
      vec3 d = dirDepuisUV(vUv);
      // Sous 2°, on garde la couleur de l'horizon (sinon le long trajet dans la brume l'assombrit)
      d.y = max(d.y, 0.035);
      d = normalize(d);
      vec3 c = diffusion(d, uSoleil, 22.0, 0.72);
      // La nuit, un ciel bleu profond éclairé par la lune
      float nuit = smoothstep(0.05, -0.2, uSoleil.y);
      if (nuit > 0.0) {
        c += diffusion(d, normalize(uLune + vec3(0.0, 0.05, 0.0)), 22.0 * 0.0045, 0.6) * nuit * smoothstep(-0.2, 0.15, uLune.y);
        c += vec3(0.0018, 0.003, 0.0075) * nuit * (1.2 - d.y * 0.6);
      }
      // Le temps couvert grise et assombrit tout
      float l = dot(c, vec3(0.3, 0.55, 0.15));
      vec3 gris = vec3(l) * vec3(0.92, 0.96, 1.05);
      c = mix(c, gris * mix(0.85, 0.4, uOrage), uNuages * 0.75);
      // La brume chaude de l'été, près de l'horizon
      c = mix(c, vec3(l) * vec3(1.05, 1.0, 0.92) * 1.1, uBrumeHorizon * exp(-d.y * 7.0) * 0.35);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const DOME = {
  uniforms: {
    uSoleilDisque: { value: new THREE.Color(1, 1, 1) },
    uLuneDir: { value: new THREE.Vector3(0, -1, 0) },
    uEtoiles: { value: 0 },
    uArcEnCiel: { value: 0 },
    uPluieCiel: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }
  `,
  fragmentShader: /* glsl */ `
    ${GLSL_COMMUN}
    uniform vec3 uSoleilDisque;
    uniform vec3 uLuneDir;
    uniform float uEtoiles;
    uniform float uArcEnCiel;
    uniform float uPluieCiel;
    varying vec3 vDir;

    vec3 etoiles(vec3 d) {
      vec3 p = d * 260.0;
      vec3 cellule = floor(p);
      float h = hash21(cellule.xy + cellule.z * 17.13);
      if (h < 0.9965) return vec3(0.0);
      vec3 centre = cellule + 0.5 + (vec3(hash21(cellule.yz), hash21(cellule.zx), hash21(cellule.xy + 3.1)) - 0.5) * 0.6;
      float dist = length(p - centre);
      float eclat = pow(fract(h * 731.7), 3.0) * 3.0 + 0.3;
      float scintille = 0.65 + 0.35 * sin(uTemps * (2.0 + h * 9.0) + h * 100.0);
      vec3 teinte = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), fract(h * 91.3));
      return teinte * eclat * scintille * smoothstep(0.45, 0.0, dist) * 0.08;
    }

    float nuagesDetail(vec2 p) {
      float d = densiteNuages(p);
      vec2 q = p * 0.011 + uNuagesDecalage * 3.0;
      float detail = texture2D(uBruit, q).a;
      return clamp(d * (0.75 + 0.5 * detail) - 0.08 * (1.0 - d), 0.0, 1.0);
    }

    void main() {
      vec3 d = normalize(vDir);
      vec3 dCiel = vec3(d.x, max(d.y, 0.0), d.z);
      vec3 col = couleurCiel(dCiel);

      // Le soleil
      float cs = dot(d, uSoleilDir);
      float disque = smoothstep(0.99985, 0.99992, cs);
      col += uSoleilDisque * disque * 60.0;
      col += uSoleilDisque * pow(max(cs, 0.0), 900.0) * 3.0;

      // La nuit : étoiles, Voie lactée, lune
      if (uEtoiles > 0.01 && d.y > 0.0) {
        vec3 axe = normalize(vec3(0.35, 0.42, -0.84));
        float bande = dot(d, axe);
        float voie = exp(-bande * bande * 14.0) * (0.35 + 0.65 * texture2D(uBruit, vec2(atan(d.z, d.x) * 0.6, bande * 1.6)).g);
        voie *= 0.6 + 0.4 * texture2D(uBruit, d.xz * 2.3).b;
        col += vec3(0.55, 0.6, 0.8) * voie * 0.012 * uEtoiles;
        col += etoiles(d) * uEtoiles * smoothstep(0.0, 0.15, d.y);
      }
      float cl = dot(d, uLuneDir);
      if (cl > 0.999) {
        // Un croissant épais : la lumière vient d'un côté du disque
        vec3 droite = normalize(cross(uLuneDir, vec3(0.0, 1.0, 0.0)));
        vec3 haut = cross(droite, uLuneDir);
        vec2 q = vec2(dot(d - uLuneDir, droite), dot(d - uLuneDir, haut)) / 0.0105;
        float r = length(q);
        if (r < 1.0) {
          float z = sqrt(1.0 - r * r);
          vec3 n = vec3(q, z);
          float phase = max(dot(n, normalize(vec3(0.85, 0.2, 0.5))), 0.0);
          float mers = 0.75 + 0.25 * texture2D(uBruit, q * 0.2 + 0.3).g;
          col += vec3(1.0, 0.97, 0.9) * (phase * mers * 1.4 + 0.015) * smoothstep(1.0, 0.96, r) * uEtoiles;
        }
      }
      col += vec3(0.6, 0.65, 0.8) * pow(max(cl, 0.0), 600.0) * 0.12 * uEtoiles;

      // L'arc-en-ciel, à 42° du point opposé au soleil
      if (uArcEnCiel > 0.01) {
        float a = degrees(acos(clamp(dot(d, -uSoleilDir), -1.0, 1.0)));
        float x = (a - 40.6) / 2.2;
        if (x > -0.2 && x < 1.2) {
          vec3 arc = clamp(vec3(1.0 - abs(x - 1.0) * 2.0, 1.0 - abs(x - 0.55) * 2.2, 1.0 - abs(x - 0.1) * 2.2), 0.0, 1.0);
          col += arc * uArcEnCiel * 0.35 * smoothstep(0.0, 0.25, d.y) * length(couleurCiel(vec3(0.0, 1.0, 0.0)));
        }
      }

      // Les nuages : la même couche que celle qui ombre l'île
      if (d.y > 0.0) {
        float t = (${ALTITUDE_NUAGES.toFixed(1)} - cameraPosition.y) / d.y;
        vec2 p = cameraPosition.xz + d.xz * t;
        float dens = nuagesDetail(p);
        if (dens > 0.001) {
          vec3 L = uSoleilDir;
          vec2 versSoleil = normalize(L.xz + vec2(1e-4)) * 28.0;
          float dl = nuagesDetail(p + versSoleil) * 0.6 + nuagesDetail(p + versSoleil * 2.2) * 0.4;
          float lumiere = exp(-dl * 2.6);
          float argent = pow(max(cs, 0.0), 10.0) * (1.0 - dens) * 3.0;
          vec3 haut = couleurCiel(vec3(0.0, 1.0, 0.0));
          vec3 horizon = couleurCiel(normalize(vec3(d.x, 0.05, d.z)));
          vec3 soleil = uLumiereCouleur * (1.0 - uNuit);
          vec3 cn = haut * 0.55 + horizon * 0.35 + soleil * (0.28 + 0.9 * lumiere + argent) * 0.32;
          // Le dessous des gros nuages est sombre ; plus sombre encore sous l'orage
          cn *= mix(1.0, 0.55 - 0.3 * uPluieCiel, smoothstep(0.35, 0.95, dens));
          cn += vec3(0.9, 0.92, 1.0) * uEclair * dens * 3.0;
          float fondu = exp(-t * 0.00042) * smoothstep(0.0, 0.07, d.y);
          col = mix(col, cn, clamp(dens * 1.25, 0.0, 1.0) * fondu);
        }
      }
      col += vec3(0.7, 0.75, 0.95) * uEclair * 0.4 * smoothstep(0.0, 0.3, d.y);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const RT = 6360e3;
const RA = 6420e3;
const BR = [5.5e-6, 13.0e-6, 22.4e-6];
const BM = 13e-6;

/** La couleur de la lumière du soleil au sol, après sa traversée de l'atmosphère (en linéaire). */
export function transmittanceSoleil(dir: THREE.Vector3): THREE.Color {
  const oy = RT + 60;
  // Intersection avec le haut de l'atmosphère
  const b = oy * dir.y;
  const c = oy * oy - RA * RA;
  const t = -b + Math.sqrt(b * b - c);
  const N = 24;
  const ds = t / N;
  let odR = 0;
  let odM = 0;
  for (let i = 0; i < N; i++) {
    const s = ds * (i + 0.5);
    const px = dir.x * s;
    const py = oy + dir.y * s;
    const pz = dir.z * s;
    const h = Math.hypot(px, py, pz) - RT;
    if (h < 0) return new THREE.Color(0, 0, 0);
    odR += Math.exp(-h / 7994) * ds;
    odM += Math.exp(-h / 1200) * ds;
  }
  return new THREE.Color(Math.exp(-(BR[0]! * odR + BM * 1.1 * odM)), Math.exp(-(BR[1]! * odR + BM * 1.1 * odM)), Math.exp(-(BR[2]! * odR + BM * 1.1 * odM)));
}

export class Ciel {
  readonly dome: THREE.Mesh;
  readonly cible: THREE.WebGLRenderTarget;
  private readonly quad: FullScreenQuad;
  readonly vue: typeof VUE.uniforms;
  readonly uDome: typeof DOME.uniforms;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly sceneCiel = new THREE.Scene();
  private envActuel: THREE.WebGLRenderTarget | null = null;
  private dernierSoleil = new THREE.Vector3(0, -2, 0);
  private dernierNuages = -1;
  private attenteEnv = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.cible = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping });
    const matVue = new THREE.ShaderMaterial({ ...VUE, uniforms: THREE.UniformsUtils.clone(VUE.uniforms), depthTest: false, depthWrite: false });
    this.vue = matVue.uniforms as typeof VUE.uniforms;
    this.quad = new FullScreenQuad(matVue);
    ATMO.uCielVue.value = this.cible.texture;

    const uniforms = { ...ATMO, ...THREE.UniformsUtils.clone(DOME.uniforms) };
    const matDome = new THREE.ShaderMaterial({ uniforms, vertexShader: DOME.vertexShader, fragmentShader: DOME.fragmentShader, side: THREE.BackSide, depthWrite: false });
    this.uDome = uniforms as unknown as typeof DOME.uniforms;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), matDome);
    this.dome.scale.setScalar(3000);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    const domeEnv = new THREE.Mesh(this.dome.geometry, matDome);
    domeEnv.scale.setScalar(500);
    this.sceneCiel.add(domeEnv);
  }

  /** Recalcule la vue du ciel ; et, si le soleil a assez bougé, la lumière d'ambiance. */
  mettreAJour(dt: number, camera: THREE.Camera, scene: THREE.Scene) {
    this.dome.position.copy(camera.position);
    const r = this.renderer;
    const avant = r.getRenderTarget();
    r.setRenderTarget(this.cible);
    this.quad.render(r);
    r.setRenderTarget(avant);

    this.attenteEnv -= dt;
    const soleil = ATMO.uSoleilDir.value;
    const bouge = soleil.angleTo(this.dernierSoleil) > 0.012 || Math.abs(ATMO.uNuages.value - this.dernierNuages) > 0.04;
    if ((bouge && this.attenteEnv <= 0) || !this.envActuel) {
      this.attenteEnv = 0.6;
      this.dernierSoleil.copy(soleil);
      this.dernierNuages = ATMO.uNuages.value;
      const etoiles = this.uDome.uEtoiles.value;
      this.uDome.uEtoiles.value = 0;
      const ancien = this.envActuel;
      this.envActuel = this.pmrem.fromScene(this.sceneCiel, 0.03, 0.1, 2000);
      this.uDome.uEtoiles.value = etoiles;
      scene.environment = this.envActuel.texture;
      ancien?.dispose();
    }
  }
}
