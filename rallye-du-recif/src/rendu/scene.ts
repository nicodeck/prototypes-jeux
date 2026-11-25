// Le moteur de rendu : la scène, la caméra et les passes d'après-rendu (cadre d'impact manga,
// lignes de vitesse, vignette, grain de papier).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GLOBAL } from "./toon";

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uImpact: { value: 0 },
    uImpactCentre: { value: new THREE.Vector2(0.5, 0.5) },
    uVitesse: { value: 0 },
    uVitesseCentre: { value: new THREE.Vector2(0.5, 0.5) },
    uTemps: { value: 0 },
    uAspect: { value: 16 / 9 },
    uVignette: { value: 1 },
    uSature: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uImpact;
    uniform vec2 uImpactCentre;
    uniform float uVitesse;
    uniform vec2 uVitesseCentre;
    uniform float uTemps;
    uniform float uAspect;
    uniform float uVignette;
    uniform float uSature;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      vec2 d = (vUv - uVitesseCentre) * vec2(uAspect, 1.0);
      float a = atan(d.y, d.x);
      float r = length(d);

      // Lignes de vitesse : des rayons fins qui partent du centre de l'action.
      if (uVitesse > 0.0) {
        float secteur = floor(a / 6.28318 * 140.0);
        float h = hash(secteur + floor(uTemps * 24.0) * 7.0);
        float fin = 1.0 - smoothstep(0.0, 0.5, abs(fract(a / 6.28318 * 140.0) - 0.5) * 2.0);
        float trait = step(0.55, h) * fin * smoothstep(0.25 + h * 0.3, 0.75 + h * 0.2, r);
        col = mix(col, vec3(1.0), trait * uVitesse * 0.85);
      }

      // Cadre d'impact : l'image passe en noir et blanc inversé, très contrasté, le temps d'un éclair.
      if (uImpact > 0.0) {
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        vec2 di = (vUv - uImpactCentre) * vec2(uAspect, 1.0);
        float ai = atan(di.y, di.x);
        float rayons = step(0.6, hash(floor(ai / 6.28318 * 70.0)));
        float encre = step(0.42, l);
        vec3 inverse = vec3(1.0 - encre);
        inverse = mix(inverse, vec3(1.0), rayons * smoothstep(0.15, 0.6, length(di)) * 0.9);
        inverse = mix(inverse, vec3(0.92, 0.12, 0.16) * (1.0 - encre) + vec3(encre * 0.05), uSature);
        col = mix(col, inverse, uImpact);
      }

      // Vignette et grain de papier
      float v = smoothstep(1.25, 0.35, length((vUv - 0.5) * vec2(uAspect, 1.0)));
      col *= mix(1.0, 0.55 + 0.45 * v, uVignette);
      col += (hash(vUv.x * 913.1 + vUv.y * 517.7 + uTemps) - 0.5) * 0.025;
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export class Rendu {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 1800);
  private readonly composer: EffectComposer;
  readonly final: ShaderPass;

  constructor(readonly toile: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.info.autoReset = false;
    const cible = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  redimensionner() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    GLOBAL.uResolution.value.set(w * ratio, h * ratio);
    // Des traits et une trame proportionnés à la taille de l'écran.
    const echelle = (h * ratio) / 1080;
    GLOBAL.uEpaisseur.value = Math.max(1.2, 3.0 * echelle);
    GLOBAL.uCellule.value = Math.max(3, 7 * echelle);
    this.final.uniforms.uAspect.value = w / h;
  }

  dessiner(temps: number) {
    GLOBAL.uTemps.value = temps;
    this.final.uniforms.uTemps.value = temps;
    this.renderer.info.reset();
    this.composer.render();
  }

  /** Position à l'écran (en pixels CSS) d'un point du monde. */
  versEcran(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, devant: v.z < 1 };
  }

  versUv(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    return new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  }
}
