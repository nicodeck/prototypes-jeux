// Particules simulées sur le CPU : embruns de l'étrave, gerbes des chocs, étincelles des phares.

import * as THREE from "three";

const VERTEX = /* glsl */ `
attribute vec4 aCouleur; // rgb + alpha
attribute float aTaille;
uniform vec3 uLanternePos;
uniform vec3 uLanterneCouleur;
uniform float uLanterneForce;
uniform float uFlash;
uniform float uEchelle;
varying vec4 vCouleur;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aTaille * uEchelle / max(-mv.z, 0.5);
  // les embruns (alpha < 0) sont éclairés par la scène ; les étincelles (alpha > 0) brillent seules
  vec3 c = aCouleur.rgb;
  if (aCouleur.a < 0.0) {
    float d = length(position - uLanternePos);
    vec3 lumiere = vec3(0.03, 0.035, 0.05) + uLanterneCouleur * uLanterneForce * 0.7 / (1.0 + d * d / 20.0) + uFlash * vec3(0.8, 0.85, 1.1);
    c *= lumiere;
  }
  vCouleur = vec4(c, abs(aCouleur.a));
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vCouleur;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.2, r);
  gl_FragColor = vec4(vCouleur.rgb * a * vCouleur.a, 1.0);
}
`;

interface Particule {
  pos: THREE.Vector3;
  vit: THREE.Vector3;
  vie: number;
  duree: number;
  taille: number;
  couleur: THREE.Color;
  emissive: boolean;
  gravite: number;
}

export class Particules {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
  private liste: Particule[] = [];
  private positions: Float32Array;
  private couleurs: Float32Array;
  private tailles: Float32Array;

  constructor(private max: number, partages: Record<string, THREE.IUniform>) {
    this.positions = new Float32Array(max * 3);
    this.couleurs = new Float32Array(max * 4);
    this.tailles = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aCouleur", new THREE.BufferAttribute(this.couleurs, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aTaille", new THREE.BufferAttribute(this.tailles, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = {
      uEchelle: { value: 400 },
      uLanternePos: partages.uLanternePos,
      uLanterneCouleur: partages.uLanterneCouleur,
      uLanterneForce: partages.uLanterneForce,
      uFlash: partages.uFlash,
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
  }

  emettre(
    pos: THREE.Vector3,
    vit: THREE.Vector3,
    options: { duree?: number; taille?: number; couleur?: THREE.Color; emissive?: boolean; gravite?: number } = {},
  ) {
    if (this.liste.length >= this.max) this.liste.shift();
    this.liste.push({
      pos: pos.clone(),
      vit: vit.clone(),
      vie: 0,
      duree: options.duree ?? 1.2,
      taille: options.taille ?? 0.5,
      couleur: options.couleur ?? new THREE.Color(0.8, 0.85, 0.9),
      emissive: options.emissive ?? false,
      gravite: options.gravite ?? 9.8,
    });
  }

  /** Gerbe d'eau : n gouttes autour d'un point. */
  gerbe(pos: THREE.Vector3, direction: THREE.Vector3, n: number, puissance: number) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        direction.x * puissance + (Math.random() - 0.5) * puissance * 0.8,
        puissance * (0.5 + Math.random() * 0.8),
        direction.z * puissance + (Math.random() - 0.5) * puissance * 0.8,
      );
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.3, (Math.random() - 0.5) * 1.2));
      this.emettre(p, v, { duree: 0.7 + Math.random() * 0.8, taille: 0.25 + Math.random() * 0.5 });
    }
  }

  maj(dt: number, vent: THREE.Vector2) {
    let n = 0;
    this.liste = this.liste.filter((p) => (p.vie += dt) < p.duree);
    for (const p of this.liste) {
      p.vit.y -= p.gravite * dt;
      p.vit.x += vent.x * dt * 4;
      p.vit.z += vent.y * dt * 4;
      p.pos.addScaledVector(p.vit, dt);
      const t = p.vie / p.duree;
      this.positions.set([p.pos.x, p.pos.y, p.pos.z], n * 3);
      const alpha = (1 - t) * (p.emissive ? 1 : 0.45);
      this.couleurs.set([p.couleur.r, p.couleur.g, p.couleur.b, p.emissive ? alpha : -alpha], n * 4);
      this.tailles[n] = p.taille * (p.emissive ? 1 - t * 0.5 : 1 + t * 0.8);
      n++;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aCouleur.needsUpdate = true;
    geo.attributes.aTaille.needsUpdate = true;
  }
}
