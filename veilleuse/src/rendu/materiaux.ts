// Les matériaux et textures partagés : un matériau « éclairé » (une image qui reçoit la lumière
// des lanternes), un halo additif, et une petite usine à textures peintes.
import * as THREE from "three";
import { GLSL_LUMIERES, LUMIERES } from "./lumieres";

export function texturePeinte(l: number, h: number, peindre: (c: CanvasRenderingContext2D) => void) {
  const toile = document.createElement("canvas");
  toile.width = l;
  toile.height = h;
  peindre(toile.getContext("2d")!);
  const t = new THREE.CanvasTexture(toile);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let halo: THREE.Texture | null = null;
/** Un disque flou, blanc au centre. */
export function textureHalo() {
  if (halo) return halo;
  halo = texturePeinte(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.12, "rgba(255,255,255,0.55)");
    g.addColorStop(0.35, "rgba(255,255,255,0.16)");
    g.addColorStop(0.7, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  halo.colorSpace = THREE.NoColorSpace;
  return halo;
}

/** Un halo additif : la lueur d'une lumière dans l'air poussiéreux. */
export function creerHalo(taille: number, couleur: THREE.Color, ordre = -44) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(taille, taille),
    new THREE.MeshBasicMaterial({
      map: textureHalo(),
      color: couleur.clone(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  m.renderOrder = ordre;
  return m;
}

const SOMMETS = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vMonde;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xy;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

/** Une image qui reçoit la lumière : sombre dans le noir, chaude près des lanternes. */
export function materiauEclaire(carte: THREE.Texture, teinte = new THREE.Color(1, 1, 1)) {
  return new THREE.ShaderMaterial({
    uniforms: { ...LUMIERES, uCarte: { value: carte }, uTeinte: { value: teinte } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: SOMMETS,
    fragmentShader: /* glsl */ `
      ${GLSL_LUMIERES}
      uniform sampler2D uCarte;
      uniform vec3 uTeinte;
      varying vec2 vUv;
      varying vec2 vMonde;
      void main() {
        vec4 t = texture2D(uCarte, vUv);
        if (t.a < 0.01) discard;
        vec3 L = lumiere(vMonde, normalize(vec3(0.0, 0.25, 1.0)));
        gl_FragColor = vec4(t.rgb * uTeinte * (uAmbiant * 3.5 + uBrume * 0.45 + L * 1.7), t.a);
      }
    `,
  });
}
