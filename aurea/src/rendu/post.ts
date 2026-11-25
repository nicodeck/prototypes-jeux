// L'après-rendu : la scène est dessinée en couleurs « physiques » (HDR) dans une texture, avec sa
// profondeur. On y ajoute ensuite, dans l'ordre :
// - les rayons de soleil qui percent entre les nuages, les arbres et les colonnes ;
// - le halo des lumières vives (bloom) ;
// - le flou de maquette : net autour du point regardé, flou au loin et tout près ;
// - l'étalonnage (balance des blancs, contraste, saturation, teinte des ombres), le passage en
//   couleurs d'écran (ACES), la vignette et un grain très fin.
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { REGLAGES } from "../reglages";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const GLSL_PROFONDEUR = /* glsl */ `
  uniform sampler2D tProfondeur;
  uniform float uPres;
  uniform float uLoin;
  float profondeurLineaire(vec2 uv) {
    float z = texture2D(tProfondeur, uv).x * 2.0 - 1.0;
    return (2.0 * uPres * uLoin) / (uLoin + uPres - z * (uLoin - uPres));
  }
`;

/** Les rayons : on garde le ciel lumineux, puis on l'étire vers le soleil */
const RAYONS = {
  uniforms: {
    tCouleur: { value: null as THREE.Texture | null },
    tProfondeur: { value: null as THREE.Texture | null },
    uPres: { value: 0.5 },
    uLoin: { value: 4000 },
    uSoleilEcran: { value: new THREE.Vector2(0.5, 0.5) },
    uVisible: { value: 0 },
    uAspect: { value: 1.6 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tCouleur;
    uniform vec2 uSoleilEcran;
    uniform float uVisible;
    uniform float uAspect;
    varying vec2 vUv;
    ${GLSL_PROFONDEUR}

    float masque(vec2 uv) {
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
      float d = profondeurLineaire(uv);
      float ciel = smoothstep(uLoin * 0.6, uLoin * 0.9, d);
      vec3 c = texture2D(tCouleur, uv).rgb;
      float lum = dot(c, vec3(0.3, 0.5, 0.2));
      vec2 dd = (uv - uSoleilEcran) * vec2(uAspect, 1.0);
      float pres = exp(-dot(dd, dd) * 7.0);
      return ciel * min(lum, 6.0) * pres;
    }

    void main() {
      if (uVisible <= 0.001) { gl_FragColor = vec4(0.0); return; }
      const int N = 40;
      vec2 pas = (uSoleilEcran - vUv) / float(N) * 0.92;
      vec2 uv = vUv;
      float somme = 0.0;
      float poids = 1.0;
      float bruit = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      uv += pas * bruit;
      for (int i = 0; i < N; i++) {
        somme += masque(uv) * poids;
        poids *= 0.965;
        uv += pas;
      }
      gl_FragColor = vec4(vec3(somme / float(N)) * uVisible, 1.0);
    }
  `,
};

const FINAL = {
  uniforms: {
    tCouleur: { value: null as THREE.Texture | null },
    tProfondeur: { value: null as THREE.Texture | null },
    tRayons: { value: null as THREE.Texture | null },
    uPres: { value: 0.5 },
    uLoin: { value: 4000 },
    uTemps: { value: 0 },
    uAspect: { value: 1.6 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMiseAuPoint: { value: 40 },
    uFlou: { value: 1 },
    uFlouProche: { value: 0.4 },
    uExposition: { value: 1 },
    uBlanc: { value: new THREE.Color(1, 1, 1) },
    uOmbres: { value: new THREE.Color(0, 0, 0) },
    uContraste: { value: 1.05 },
    uSaturation: { value: 1.08 },
    uCouleurRayons: { value: new THREE.Color(1, 0.8, 0.55) },
    uFondu: { value: 0 },
    uVignette: { value: 1 },
    uEclair: { value: 0 },
    uPause: { value: 0 },
    uProjInverse: { value: new THREE.Matrix4() },
    uMondeCamera: { value: new THREE.Matrix4() },
    uLumieres: { value: Array.from({ length: 48 }, () => new THREE.Vector4()) },
    uForces: { value: new Float32Array(48) },
    uNbLumieres: { value: 0 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tCouleur;
    uniform sampler2D tRayons;
    uniform mat4 uProjInverse;
    uniform mat4 uMondeCamera;
    uniform vec4 uLumieres[48];
    uniform float uForces[48];
    uniform int uNbLumieres;
    uniform float uTemps;
    uniform float uAspect;
    uniform vec2 uResolution;
    uniform float uMiseAuPoint;
    uniform float uFlou;
    uniform float uFlouProche;
    uniform float uExposition;
    uniform vec3 uBlanc;
    uniform vec3 uOmbres;
    uniform float uContraste;
    uniform float uSaturation;
    uniform vec3 uCouleurRayons;
    uniform float uFondu;
    uniform float uVignette;
    uniform float uEclair;
    uniform float uPause;
    varying vec2 vUv;
    ${GLSL_PROFONDEUR}

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    // Le rayon du cercle de confusion, en pixels
    float flouEn(vec2 uv) {
      float d = profondeurLineaire(uv);
      float loin = max(0.0, d - uMiseAuPoint) / (uMiseAuPoint * 1.6);
      float pres = max(0.0, uMiseAuPoint - d) / (uMiseAuPoint * 0.7);
      return clamp(loin * uFlou, 0.0, 1.0) * 7.0 + clamp(pres * uFlouProche, 0.0, 1.0) * 6.0;
    }

    vec3 aces(vec3 x) {
      // ACES (approximation de Narkowicz), un peu adoucie dans les hautes lumières
      const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 versEcran(vec3 c) {
      return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      // Le flou de maquette : un disque de Vogel, dont le rayon suit la profondeur
      vec2 px = 1.0 / uResolution;
      float rayon = flouEn(vUv);
      vec3 col = texture2D(tCouleur, vUv).rgb;
      if (rayon > 0.6) {
        vec3 somme = col;
        float poids = 1.0;
        float angle = hash(vUv * uResolution) * 6.283;
        for (int i = 0; i < 20; i++) {
          float r = sqrt((float(i) + 0.5) / 20.0) * rayon;
          float a = float(i) * 2.39996 + angle;
          vec2 o = vec2(cos(a), sin(a)) * r * px;
          vec3 s = texture2D(tCouleur, vUv + o).rgb;
          // On n'aspire pas le net dans le flou : un échantillon plus net que nous pèse moins
          float rs = flouEn(vUv + o);
          float w = smoothstep(r - 1.0, r + 1.0, rs + 0.5);
          somme += s * w;
          poids += w;
        }
        col = somme / poids;
      }

      // La nuit, les torches et les feux éclairent les murs et le sol alentour. On retrouve la
      // position et l'orientation de chaque pixel à partir de la profondeur.
      if (uNbLumieres > 0) {
        float z = texture2D(tProfondeur, vUv).x;
        if (z < 0.9999) {
          vec4 vue = uProjInverse * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
          vec3 p = (uMondeCamera * vec4(vue.xyz / vue.w, 1.0)).xyz;
          vec3 n = normalize(cross(dFdx(p), dFdy(p)));
          vec3 versCam = cameraPosition - p;
          if (dot(n, versCam) < 0.0) n = -n;
          vec3 recu = vec3(0.0);
          for (int i = 0; i < 48; i++) {
            if (i >= uNbLumieres) break;
            vec4 L = uLumieres[i];
            vec3 d = L.xyz - p;
            float dist = length(d);
            if (dist > L.w) continue;
            float att = pow(1.0 - dist / L.w, 2.0) / (1.0 + dist * dist * 0.6);
            float lambert = max(dot(n, d / dist), 0.0) * 0.8 + 0.2;
            recu += vec3(1.0, 0.52, 0.2) * uForces[i] * att * lambert;
          }
          float l = dot(col, vec3(0.3, 0.55, 0.15));
          // Plusieurs torches qui se recouvrent ne doivent pas tout brûler
          recu = recu / (1.0 + recu * 0.6);
          vec3 teinte = clamp(col / max(l, 1e-4), 0.2, 2.5);
          col += recu * mix(vec3(0.5), teinte * 0.45, 0.5);
        }
      }

      col += texture2D(tRayons, vUv).rgb * uCouleurRayons;
      col *= uExposition;
      col *= uBlanc;
      col += uEclair * vec3(0.8, 0.85, 1.0) * 0.35;

      // Étalonnage, en espace logarithmique doux
      col = aces(col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation * (1.0 - uPause * 0.65));
      col = (col - 0.5) * uContraste + 0.5;
      col += uOmbres * (1.0 - smoothstep(0.0, 0.45, l)) * 0.6;
      col = clamp(col, 0.0, 1.0);

      // Vignette, grain
      vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(1.25, 0.25, length(c));
      col *= mix(1.0, 0.45 + 0.55 * v, uVignette);
      col *= 1.0 - uPause * 0.25;
      col = versEcran(col);
      col += (hash(vUv * uResolution + fract(uTemps * 13.1) * 91.0) - 0.5) * 0.018;
      col *= 1.0 - uFondu;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  readonly scene: THREE.WebGLRenderTarget;
  private readonly rayons: THREE.WebGLRenderTarget;
  private readonly quadRayons: FullScreenQuad;
  private readonly quadFinal: FullScreenQuad;
  readonly bloom: UnrealBloomPass;
  readonly final: typeof FINAL.uniforms;
  readonly uRayons: typeof RAYONS.uniforms;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    const profondeur = new THREE.DepthTexture(16, 16);
    profondeur.type = THREE.FloatType;
    this.scene = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4, depthTexture: profondeur });
    this.rayons = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    const matRayons = new THREE.ShaderMaterial({ ...RAYONS, uniforms: THREE.UniformsUtils.clone(RAYONS.uniforms), depthTest: false, depthWrite: false });
    this.uRayons = matRayons.uniforms as typeof RAYONS.uniforms;
    this.uRayons.tCouleur.value = this.scene.texture;
    this.uRayons.tProfondeur.value = profondeur;
    this.quadRayons = new FullScreenQuad(matRayons);
    const matFinal = new THREE.ShaderMaterial({ ...FINAL, uniforms: THREE.UniformsUtils.clone(FINAL.uniforms), depthTest: false, depthWrite: false });
    matFinal.extensions = { ...matFinal.extensions };
    this.final = matFinal.uniforms as typeof FINAL.uniforms;
    this.final.tCouleur.value = this.scene.texture;
    this.final.tProfondeur.value = profondeur;
    this.final.tRayons.value = this.rayons.texture;
    this.quadFinal = new FullScreenQuad(matFinal);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), REGLAGES.halo, 0.45, 1.4);
    // On écrête ce qui entre dans le halo : un reflet de soleil très vif suffirait à tout blanchir
    const filtre = this.bloom.materialHighPassFilter;
    filtre.fragmentShader = filtre.fragmentShader.replace(
      "gl_FragColor = mix( outputColor, texel, alpha );",
      "texel.rgb = (texel.rgb == texel.rgb) ? min(texel.rgb, vec3(3.0)) : vec3(0.0); gl_FragColor = mix( outputColor, texel, alpha );",
    );
    filtre.needsUpdate = true;
  }

  redimensionner(l: number, h: number, ratio: number) {
    const L = Math.floor(l * ratio);
    const H = Math.floor(h * ratio);
    this.scene.setSize(L, H);
    this.rayons.setSize(Math.max(1, Math.floor(L / 2)), Math.max(1, Math.floor(H / 2)));
    this.bloom.setSize(L, H);
    this.final.uResolution.value.set(L, H);
    this.final.uAspect.value = l / h;
    this.uRayons.uAspect.value = l / h;
  }

  rendre(scene: THREE.Scene, camera: THREE.PerspectiveCamera, temps: number) {
    const r = this.renderer;
    this.final.uProjInverse.value.copy(camera.projectionMatrixInverse);
    this.final.uMondeCamera.value.copy(camera.matrixWorld);
    this.final.uPres.value = this.uRayons.uPres.value = camera.near;
    this.final.uLoin.value = this.uRayons.uLoin.value = camera.far;
    this.final.uTemps.value = temps;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    // Les rayons de soleil
    if (this.uRayons.uVisible.value > 0.001 && REGLAGES.rayons > 0) {
      r.setRenderTarget(this.rayons);
      this.quadRayons.render(r);
    } else {
      r.setRenderTarget(this.rayons);
      r.setClearColor(0x000000, 1);
      r.clear(true, false, false);
    }
    // Le halo s'ajoute dans la texture de la scène
    if (this.bloom.strength > 0.001) this.bloom.render(r, null as unknown as THREE.WebGLRenderTarget, this.scene, 0, false);
    r.setRenderTarget(null);
    this.quadFinal.render(r);
  }
}
