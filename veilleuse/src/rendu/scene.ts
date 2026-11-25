// Le moteur de rendu : la scène, la caméra orthographique et les passes d'après-rendu (halo des
// lumières, aberration au bord de l'image, vignette, grain, fondus).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/** Hauteur de l'image, en cases */
export const HAUTEUR_VUE = 15;

/** Avant le halo : un seul pixel invalide (NaN) suffirait à noircir toute l'image en se diffusant. */
const ASSAINIR = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float propre(float v) { return (v >= 0.0 && v < 1e4) ? v : 0.0; }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(min(vec3(propre(c.r), propre(c.g), propre(c.b)), vec3(40.0)), 1.0);
    }
  `,
};

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uTemps: { value: 0 },
    uAspect: { value: 16 / 9 },
    uFondu: { value: 1 },
    uFlash: { value: 0 },
    uTeinte: { value: new THREE.Color(0, 0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTemps;
    uniform float uAspect;
    uniform float uFondu;
    uniform float uFlash;
    uniform vec3 uTeinte;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      // Une légère aberration chromatique vers les bords, comme à travers une vieille vitre
      vec2 dec = c * r2 * 0.006;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + dec).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - dec).b;

      // Les ombres prennent un peu la couleur de la zone
      col += uTeinte * 0.035 * (1.0 - smoothstep(0.0, 0.25, dot(col, vec3(0.33))));

      // Vignette
      float v = smoothstep(1.15, 0.2, sqrt(r2));
      col *= 0.38 + 0.62 * v;

      // Grain
      float g = hash(vUv * 1000.0 + fract(uTemps * 7.13) * 100.0) - 0.5;
      col += g * 0.028 * (0.4 + dot(col, vec3(0.33)));

      col = mix(col, vec3(1.0, 0.92, 0.86) * 3.0, uFlash);
      col *= 1.0 - uFondu;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** Le zoom : 1 = normal, plus grand = on voit plus loin */
  recul = 1;
  private readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly final: ShaderPass;

  constructor(readonly toile: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x000000, 1);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 50;
    const cible = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(ASSAINIR));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.75, 0.62);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  get aspect() {
    return window.innerWidth / window.innerHeight;
  }

  /** Demi-largeur et demi-hauteur de la vue, en cases */
  get demiVue() {
    const h = (HAUTEUR_VUE * this.recul) / 2;
    return { l: h * this.aspect, h };
  }

  redimensionner() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.final.uniforms.uAspect.value = w / h;
    this.cadrer();
  }

  cadrer() {
    const { l, h } = this.demiVue;
    this.camera.left = -l;
    this.camera.right = l;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  dessiner(temps: number) {
    this.final.uniforms.uTemps.value = temps;
    this.composer.render();
  }
}
