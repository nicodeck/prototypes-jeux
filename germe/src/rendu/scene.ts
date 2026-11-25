// Le moteur de rendu : la scène, la caméra, les lumières (soleil, lune, ciel) et les passes
// d'après-rendu (halo lumineux, étalonnage des couleurs, vignette, grain).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GLOBAL } from "./communs";

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uTemps: { value: 0 },
    uAspect: { value: 16 / 9 },
    /** 0 : planète morte (image désaturée), 1 : planète vivante. */
    uVie: { value: 0 },
    uCendre: { value: 0 },
    uFondu: { value: 0 },
    uNuit: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTemps;
    uniform float uAspect;
    uniform float uVie;
    uniform float uCendre;
    uniform float uFondu;
    uniform float uNuit;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
      // Légère aberration chromatique sur les bords
      float r2 = dot(d, d);
      vec2 off = d * r2 * 0.0015;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // Étalonnage : un monde mort un peu désaturé et froid, un monde vivant chaud et franc.
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float sat = mix(0.78, 1.12, uVie);
      col = mix(vec3(l), col, sat);
      col *= mix(vec3(0.97, 0.99, 1.03), vec3(1.03, 1.0, 0.96), uVie);
      col = mix(col, col * vec3(0.85, 0.92, 1.12), uNuit * 0.35);
      // Cendre : brun gris, contrasté
      col = mix(col, vec3(l) * vec3(1.0, 0.92, 0.85), uCendre * 0.55);
      // Vignette
      float v = smoothstep(1.15, 0.3, length(d));
      col *= mix(0.62, 1.0, v);
      // Grain
      col += (hash(vUv * 937.0 + fract(uTemps) * 17.0) - 0.5) * 0.018;
      col = mix(col, vec3(0.0), uFondu);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Rendu {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 2000);
  readonly soleil = new THREE.DirectionalLight(0xfff0d8, 2.6);
  readonly lune = new THREE.DirectionalLight(0x8fa8ff, 0.5);
  readonly ciel = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a3a, 0.9);
  readonly brouillard = new THREE.FogExp2(0xaabbcc, 0.0);
  private readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly final: ShaderPass;
  /** Échelle de la résolution de rendu (baisse si la machine peine). */
  qualite = 1;

  constructor(readonly toile: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.fog = this.brouillard;
    this.scene.add(this.soleil, this.soleil.target, this.lune, this.lune.target, this.ciel);
    this.soleil.castShadow = true;
    const ombre = this.soleil.shadow;
    ombre.mapSize.set(2048, 2048);
    ombre.camera.left = -16;
    ombre.camera.right = 16;
    ombre.camera.top = 16;
    ombre.camera.bottom = -16;
    ombre.camera.near = 1;
    ombre.camera.far = 90;
    ombre.bias = -0.0005;
    ombre.normalBias = 0.03;
    ombre.radius = 3;

    const cible = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.88);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  redimensionner() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio, 2) * this.qualite;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.final.uniforms.uAspect.value = w / h;
  }

  /** Place les lumières : le soleil projette ses ombres autour du point suivi. */
  eclairer(centre: THREE.Vector3, haut: THREE.Vector3) {
    const s = GLOBAL.uSoleil.value;
    const l = GLOBAL.uLune.value;
    this.soleil.position.copy(centre).addScaledVector(s, 40);
    this.soleil.target.position.copy(centre);
    this.lune.position.copy(centre).addScaledVector(l, 40);
    this.lune.target.position.copy(centre);
    // La lumière du ciel vient d'« en haut », c'est-à-dire de la verticale locale.
    this.ciel.position.copy(haut);
  }

  dessiner(temps: number) {
    GLOBAL.uTemps.value = temps;
    this.final.uniforms.uTemps.value = temps;
    GLOBAL.uCamera.value.copy(this.camera.position);
    this.composer.render();
  }

  /** Position à l'écran (en pixels CSS) d'un point du monde. */
  versEcran(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, devant: v.z < 1 && v.z > -1 };
  }
}
