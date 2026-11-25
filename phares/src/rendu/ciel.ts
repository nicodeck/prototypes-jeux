// Le ciel : dôme de nuages de tempête qui défilent avec le vent,
// éclairés de l'intérieur par les éclairs, puis l'aube qui se lève à la fin.

import * as THREE from "three";
import { GLSL_BRUIT, GLSL_CIEL } from "./glsl";

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTemps;
uniform vec2 uVent;
uniform vec3 uSoleil;
varying vec3 vDir;
${GLSL_BRUIT}
${GLSL_CIEL}

void main() {
  vec3 d = normalize(vDir);
  vec3 c = couleurCielSimple(d);
  float h = max(d.y, 0.0);

  // nuages projetés sur un plafond, qui filent avec le vent
  vec2 p = d.xz / (h + 0.09) * 0.9 + uVent * uTemps * 0.035;
  float n = fbm(p);
  float n2 = fbm(p * 2.7 + vec2(5.2, 1.3) - uVent * uTemps * 0.02);
  float masse = n * 0.75 + n2 * 0.45;
  float seuil = mix(0.38, 0.52, uAube);
  float densite = smoothstep(seuil, seuil + 0.32, masse);

  vec3 nuageNuit = vec3(0.008, 0.010, 0.016) + vec3(0.012, 0.014, 0.02) * (1.0 - n2);
  vec3 nuageAube = mix(vec3(0.42, 0.2, 0.22), vec3(1.2, 0.6, 0.3), pow(max(dot(d, uSoleil), 0.0), 3.0)) * mix(1.0, 0.55, h);
  vec3 nuage = mix(nuageNuit, nuageAube * (0.45 + 0.9 * n2 * n2), uAube);

  // la lune perce entre les nuages et en argente les bords
  float lune = halo(d) * (1.0 - uAube);
  nuage += vec3(0.05, 0.058, 0.075) * lune * (0.5 + n2) ;
  // l'éclair illumine les nuages de l'intérieur
  float proche = pow(max(dot(d, uFlashDir), 0.0), 5.0);
  nuage += uFlash * vec3(0.5, 0.55, 0.85) * (0.18 + 1.6 * proche) * (0.4 + n2 * 1.2);

  // aube : lueur du soleil levant
  float soleil = max(dot(d, uSoleil), 0.0);
  c += uAube * (vec3(1.0, 0.45, 0.2) * pow(soleil, 6.0) * 0.8 + vec3(1.0, 0.8, 0.5) * pow(soleil, 400.0) * 6.0);
  c += uAube * vec3(0.5, 0.25, 0.15) * pow(max(1.0 - h, 0.0), 6.0);

  c = mix(c, nuage, densite * smoothstep(0.0, 0.08, d.y) * mix(0.95, 0.8, smoothstep(0.0, 1.0, lune)));
  // sous l'horizon : la brume
  c = mix(uBrume + uFlash * vec3(0.2, 0.22, 0.3), c, smoothstep(-0.02, 0.06, d.y));
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Ciel {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;

  constructor(uniformesPartages: Record<string, THREE.IUniform>) {
    this.uniforms = {
      uTemps: { value: 0 },
      uVent: { value: new THREE.Vector2(0, 1) },
      uSoleil: { value: new THREE.Vector3(0.75, 0.1, -0.65).normalize() },
      uAube: uniformesPartages.uAube,
      uFlash: uniformesPartages.uFlash,
      uFlashDir: uniformesPartages.uFlashDir,
      uBrume: uniformesPartages.uBrume,
    };
    const geo = new THREE.SphereGeometry(4000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  suivre(camera: THREE.Vector3) {
    this.mesh.position.copy(camera);
  }
}
