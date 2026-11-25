// La pluie : des milliers de traits fins dans une boîte qui suit la caméra,
// inclinés par le vent, rougis par la lanterne et blanchis par les éclairs.

import * as THREE from "three";

const VERTEX = /* glsl */ `
attribute vec4 aGraine;
uniform vec3 uCentre;
uniform vec3 uDecalage;
uniform vec3 uVitesse;
uniform float uTaille;
uniform vec3 uLanternePos;
varying float vAlpha;
varying vec2 vUv;
varying float vLanterne;

void main() {
  vec3 p = aGraine.xyz * uTaille;
  p += uDecalage * (0.85 + 0.3 * aGraine.w);
  p = mod(p - uCentre + uTaille * 0.5, uTaille) + uCentre - uTaille * 0.5;
  vec3 dir = normalize(uVitesse);
  vec3 versCam = normalize(cameraPosition - p);
  vec3 cote = normalize(cross(dir, versCam));
  float longueur = 1.1 + aGraine.w * 0.9;
  vec3 monde = p + dir * position.y * longueur + cote * position.x * 0.022;
  vUv = position.xy;
  float d = length(p - cameraPosition);
  vAlpha = smoothstep(1.2, 5.0, d) * (1.0 - smoothstep(uTaille * 0.3, uTaille * 0.5, d));
  vLanterne = 1.0 / (1.0 + dot(p - uLanternePos, p - uLanternePos) / 18.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(monde, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uFlash;
uniform float uIntensite;
uniform vec3 uLanterneCouleur;
uniform float uLanterneForce;
varying float vAlpha;
varying vec2 vUv;
varying float vLanterne;
void main() {
  float bord = 1.0 - abs(vUv.x) * 2.0;
  float lg = smoothstep(0.0, 0.3, vUv.y + 0.5) * smoothstep(1.0, 0.6, vUv.y + 0.5);
  vec3 c = vec3(0.035, 0.042, 0.055) + uFlash * vec3(0.4, 0.43, 0.55) + uLanterneCouleur * vLanterne * uLanterneForce * 0.7;
  gl_FragColor = vec4(c * bord * lg * vAlpha * uIntensite, 1.0);
}
`;

export class Pluie {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;

  constructor(nombre: number, partages: Record<string, THREE.IUniform>) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    const graines = new Float32Array(nombre * 4);
    for (let i = 0; i < graines.length; i++) graines[i] = Math.random();
    geo.setAttribute("aGraine", new THREE.InstancedBufferAttribute(graines, 4));
    geo.instanceCount = nombre;
    this.uniforms = {
      uCentre: { value: new THREE.Vector3() },
      uDecalage: { value: new THREE.Vector3() },
      uVitesse: { value: new THREE.Vector3(4, -22, 2) },
      uTaille: { value: 46 },
      uIntensite: { value: 1 },
      uFlash: partages.uFlash,
      uLanternePos: partages.uLanternePos,
      uLanterneCouleur: partages.uLanterneCouleur,
      uLanterneForce: partages.uLanterneForce,
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  maj(dt: number, camera: THREE.Vector3, vent: THREE.Vector2, force: number, intensite: number) {
    (this.uniforms.uCentre.value as THREE.Vector3).copy(camera);
    const v = (this.uniforms.uVitesse.value as THREE.Vector3).set(vent.x * 9 * force, -24, vent.y * 9 * force);
    const d = this.uniforms.uDecalage.value as THREE.Vector3;
    d.addScaledVector(v, dt);
    // garde le décalage borné (précision des flottants) sans saut visible : multiple de la boîte
    const T = this.uniforms.uTaille.value as number;
    const borne = T * 50;
    if (Math.abs(d.y) > borne) d.y = d.y % (T * 10);
    this.uniforms.uIntensite.value = intensite;
    this.mesh.visible = intensite > 0.01;
  }
}
