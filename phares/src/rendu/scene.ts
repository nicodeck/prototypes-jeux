// Moteur de rendu : renderer, caméra, lumières d'ambiance et chaîne de post-traitement
// (bloom pour les lumières dans la pluie, puis finition : vignette, grain, aberration).

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const FINITION = {
  uniforms: {
    tDiffuse: { value: null },
    uTemps: { value: 0 },
    uVignette: { value: 1 },
    uFlash: { value: 0 },
    uNoir: { value: 0 },
    uDegats: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTemps;
    uniform float uVignette;
    uniform float uFlash;
    uniform float uNoir;
    uniform float uDegats;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      // légère aberration chromatique sur les bords
      vec2 decal = c * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + decal).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - decal).b;
      // vignette
      float v = smoothstep(0.95, 0.15, r2 * 1.6) ;
      col *= mix(1.0, v, uVignette * 0.85);
      // rouge sur les bords quand la coque souffre
      col += vec3(0.35, 0.02, 0.0) * uDegats * smoothstep(0.12, 0.5, r2);
      // grain de pellicule
      float g = hash(vUv * uResolution + fract(uTemps * 13.7) * 100.0) - 0.5;
      col += g * (0.035 + uFlash * 0.02);
      col *= 1.0 - uNoir;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// Filet de sécurité : un NaN ou un infini dans l'image HDR serait étalé par le bloom
// sur tout l'écran. On les remplace (en magenta avec ?nan pour les repérer).
const ASSAINIR = {
  uniforms: { tDiffuse: { value: null }, uMontrer: { value: 0 } },
  vertexShader: FINITION.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMontrer;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool mauvais = any(isnan(c.rgb)) || any(isinf(c.rgb)) || max(c.r, max(c.g, c.b)) > 60000.0;
      gl_FragColor = mauvais ? vec4(uMontrer * 2.0, 0.0, uMontrer * 2.0, 1.0) : vec4(min(c.rgb, vec3(200.0)), c.a);
    }
  `,
};

export class Rendu {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  finition: ShaderPass;
  hemi: THREE.HemisphereLight;
  eclairLumiere: THREE.DirectionalLight;
  soleil: THREE.DirectionalLight;
  qualite: number;

  constructor(canvas: HTMLCanvasElement, qualite: number) {
    this.qualite = qualite;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25) * qualite);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0028);

    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.18, 0.24, 0.36), new THREE.Color(0.01, 0.012, 0.015), 0.35);
    this.scene.add(this.hemi);
    this.eclairLumiere = new THREE.DirectionalLight(new THREE.Color(0.7, 0.78, 1.0), 0);
    this.scene.add(this.eclairLumiere, this.eclairLumiere.target);
    this.soleil = new THREE.DirectionalLight(new THREE.Color(1.0, 0.7, 0.45), 0);
    this.soleil.position.set(750, 100, -650);
    this.scene.add(this.soleil);

    const cible = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const assainir = new ShaderPass(ASSAINIR);
    assainir.uniforms.uMontrer.value = new URLSearchParams(location.search).has("nan") ? 1 : 0;
    this.composer.addPass(assainir);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finition = new ShaderPass(FINITION);
    this.composer.addPass(this.finition);

    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  redimensionner() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    (this.finition.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  /** Multiplie la résolution de rendu (bornée), pour garder un jeu fluide. */
  ajusterQualite(facteur: number) {
    const max = Math.min(window.devicePixelRatio, 1.5) * this.qualite;
    const actuel = this.renderer.getPixelRatio();
    const nouveau = Math.max(0.5, Math.min(max, actuel * facteur));
    if (Math.abs(nouveau - actuel) < 0.02) return;
    this.renderer.setPixelRatio(nouveau);
    this.redimensionner();
  }

  rendre() {
    this.composer.render();
  }
}
