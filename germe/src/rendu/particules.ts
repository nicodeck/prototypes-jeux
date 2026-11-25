// Un réservoir de particules dessinées comme des points ronds et doux. Deux réservoirs : un lumineux
// (additif : pollen, étincelles, lucioles, gouttes) et un mat (poussière, terre, cendre).
// La « gravité » tire vers le centre de la planète.
import * as THREE from "three";

export interface Emission {
  pos: THREE.Vector3;
  vel?: THREE.Vector3;
  couleur: THREE.Color | number;
  taille?: number;
  vie?: number;
  gravite?: number;
  frein?: number;
  /** Clignote (lucioles). */
  clignote?: boolean;
  /** Ondule (pétales, flocons). */
  flotte?: number;
}

export class Particules {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly col: Float32Array;
  private readonly taille: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vie: Float32Array;
  private readonly vieMax: Float32Array;
  private readonly grav: Float32Array;
  private readonly frein: Float32Array;
  private readonly cligne: Float32Array;
  private readonly flotte: Float32Array;
  private readonly taille0: Float32Array;
  private suivant = 0;
  readonly mat: THREE.ShaderMaterial;

  constructor(n: number, additif: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.taille = new Float32Array(n);
    this.taille0 = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vie = new Float32Array(n);
    this.vieMax = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.frein = new Float32Array(n);
    this.cligne = new Float32Array(n);
    this.flotte = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aCouleur", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aTaille", new THREE.BufferAttribute(this.taille, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uEchelle: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 aCouleur;
        attribute float aTaille;
        attribute float aAlpha;
        uniform float uEchelle;
        varying vec3 vC;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aTaille * uEchelle / max(-mv.z, 0.1), 40.0);
          vC = aCouleur;
          vA = aAlpha * smoothstep(0.6, 1.8, -mv.z);
        }
      `,
      fragmentShader: additif
        ? /* glsl */ `
          varying vec3 vC;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.9, 1.0, d));
            gl_FragColor = vec4(vC * a * vA, 1.0);
          }`
        : /* glsl */ `
          varying vec3 vC;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.6, d);
            if (a * vA < 0.01) discard;
            gl_FragColor = vec4(vC, a * vA);
          }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  emettre(e: Emission) {
    const i = this.suivant;
    this.suivant = (this.suivant + 1) % this.n;
    this.pos[i * 3] = e.pos.x;
    this.pos[i * 3 + 1] = e.pos.y;
    this.pos[i * 3 + 2] = e.pos.z;
    const v = e.vel;
    this.vel[i * 3] = v ? v.x : 0;
    this.vel[i * 3 + 1] = v ? v.y : 0;
    this.vel[i * 3 + 2] = v ? v.z : 0;
    const c = typeof e.couleur === "number" ? new THREE.Color(e.couleur) : e.couleur;
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
    this.taille0[i] = e.taille ?? 0.1;
    this.vie[i] = this.vieMax[i] = e.vie ?? 1;
    this.grav[i] = e.gravite ?? 0;
    this.frein[i] = e.frein ?? 0;
    this.cligne[i] = e.clignote ? Math.random() * 10 + 1 : 0;
    this.flotte[i] = e.flotte ?? 0;
  }

  maj(dt: number, temps: number) {
    const { pos, vel } = this;
    for (let i = 0; i < this.n; i++) {
      if (this.vie[i] <= 0) {
        this.alpha[i] = 0;
        this.taille[i] = 0;
        continue;
      }
      this.vie[i] -= dt;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      const g = this.grav[i] * dt;
      vel[i * 3] -= (x / l) * g;
      vel[i * 3 + 1] -= (y / l) * g;
      vel[i * 3 + 2] -= (z / l) * g;
      const f = Math.exp(-this.frein[i] * dt);
      vel[i * 3] *= f;
      vel[i * 3 + 1] *= f;
      vel[i * 3 + 2] *= f;
      let fx = 0, fy = 0, fz = 0;
      if (this.flotte[i] > 0) {
        const k = this.flotte[i];
        fx = Math.sin(temps * 2.1 + i) * k;
        fy = Math.sin(temps * 1.7 + i * 1.3) * k;
        fz = Math.cos(temps * 1.9 + i * 0.7) * k;
      }
      pos[i * 3] += (vel[i * 3] + fx) * dt;
      pos[i * 3 + 1] += (vel[i * 3 + 1] + fy) * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + fz) * dt;
      const t = this.vie[i] / this.vieMax[i];
      // Apparition rapide, disparition douce
      let a = Math.min(1, (1 - t) * 8) * Math.min(1, t * 3);
      if (this.cligne[i] > 0) a *= 0.25 + 0.75 * Math.max(0, Math.sin(temps * 2.2 + this.cligne[i] * 7)) ** 2;
      this.alpha[i] = a;
      this.taille[i] = this.taille0[i] * (0.6 + 0.4 * Math.min(1, t * 4));
    }
    const geo = this.points.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aCouleur as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aTaille as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  echelle(hauteurPixels: number, fov: number) {
    this.mat.uniforms.uEchelle.value = hauteurPixels / (2 * Math.tan((fov * Math.PI) / 360));
  }
}
