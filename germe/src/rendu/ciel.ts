// Le ciel : une voûte peinte par shader (bleu le jour, rose au crépuscule, nuit étoilée avec une voie lactée),
// le soleil et la lune qui tournent autour de la planète, et le halo d'atmosphère vu depuis l'espace.
import * as THREE from "three";
import { hasard } from "../monde/bruit";
import { REGLAGES } from "../reglages";
import { GLOBAL } from "./communs";

const R = REGLAGES.planete.rayon;

function textureLune() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9d6cf";
  g.fillRect(0, 0, 256, 128);
  const alea = hasard(4);
  // Mers sombres
  for (let k = 0; k < 9; k++) {
    const x = alea() * 256, y = 20 + alea() * 88, r = 12 + alea() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(120,118,125,0.55)");
    gr.addColorStop(1, "rgba(120,118,125,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Cratères
  for (let k = 0; k < 70; k++) {
    const x = alea() * 256, y = alea() * 128, r = 1 + alea() * alea() * 9;
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(x + 0.6, y + 0.6, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(90,88,95,0.35)";
    g.beginPath();
    g.arc(x, y, r * 0.8, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textureHalo(interieur: string, exterieur: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, interieur);
  gr.addColorStop(0.2, interieur.replace(/[\d.]+\)$/, "0.5)"));
  gr.addColorStop(1, exterieur);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Ciel {
  readonly groupe = new THREE.Group();
  readonly voute: THREE.Mesh;
  readonly etoiles: THREE.Points;
  readonly lune: THREE.Mesh;
  readonly haloSoleil: THREE.Sprite;
  readonly haloLune: THREE.Sprite;
  readonly atmosphere: THREE.Mesh;
  readonly u = {
    uHaut: { value: new THREE.Vector3(0, 1, 0) },
    /** 1 près du sol (on voit un ciel), 0 depuis l'espace (on voit le noir étoilé). */
    uAtmo: { value: 1 },
    /** 0 mort (ciel délavé), 1 vivant (ciel franc). */
    uVie: { value: 0 },
    /** Tempête de cendre autour du joueur. */
    uCendre: { value: 0 },
    /** Abaissement de l'horizon : sur une si petite planète, il est bien sous l'horizontale. */
    uChute: { value: 0 },
  };

  constructor() {
    const u = this.u;
    this.voute = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { ...GLOBAL, ...u },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
            vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSoleil;
          uniform vec3 uLune;
          uniform vec3 uHaut;
          uniform float uAtmo;
          uniform float uVie;
          uniform float uCendre;
          uniform float uChute;
          uniform float uTemps;
          varying vec3 vDir;
          float h3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
          float bv(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
          }
          void main() {
            vec3 v = normalize(vDir);
            float e = (dot(v, uHaut) + uChute) / (1.0 + uChute);
            float s = dot(uSoleil, uHaut);
            float jour = smoothstep(-0.28, 0.22, s);
            float crep = exp(-pow((s + 0.03) / 0.2, 2.0));
            float vs = max(dot(v, uSoleil), 0.0);

            vec3 zenJ = mix(vec3(0.17, 0.22, 0.38), vec3(0.1, 0.3, 0.75), uVie);
            vec3 horJ = mix(vec3(0.62, 0.55, 0.53), vec3(0.6, 0.78, 0.95), uVie);
            vec3 zenN = vec3(0.008, 0.012, 0.04);
            vec3 horN = vec3(0.03, 0.05, 0.12);
            float t = pow(1.0 - clamp(e, 0.0, 1.0), 4.0);
            vec3 col = mix(mix(zenN, zenJ, jour), mix(horN, horJ, jour), t);
            // Crépuscule : l'horizon s'embrase du côté du soleil, rosit de l'autre.
            col = mix(col, vec3(0.95, 0.5, 0.42), crep * t * 0.55);
            col += vec3(1.0, 0.42, 0.12) * crep * pow(vs, 3.0) * (0.35 + 0.9 * t);
            col += vec3(0.35, 0.2, 0.45) * crep * (1.0 - t) * 0.25;
            // Sous l'horizon, plus sombre
            col *= mix(1.0, 0.55, smoothstep(0.0, -0.5, e));
            // Soleil : disque et halo
            col += vec3(1.0, 0.85, 0.6) * pow(vs, 18.0) * (0.25 + crep * 0.6) * mix(1.0, 0.6, jour);
            col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, vs) * 8.0;
            // Lune : un halo doux (le disque est un objet à part)
            float vl = max(dot(v, uLune), 0.0);
            col += vec3(0.5, 0.6, 0.85) * pow(vl, 60.0) * 0.4 * (1.0 - jour);

            // Espace : noir bleuté, nébuleuses, voie lactée
            float bande = exp(-pow(dot(v, normalize(vec3(0.3, 0.5, -0.8))) / 0.22, 2.0));
            float nb = bv(v * 4.0) * 0.6 + bv(v * 9.0) * 0.4;
            vec3 espace = vec3(0.006, 0.008, 0.022);
            espace += vec3(0.16, 0.12, 0.28) * bande * nb * 0.55;
            espace += vec3(0.05, 0.12, 0.2) * smoothstep(0.55, 0.9, bv(v * 2.5 + 3.0)) * 0.35;
            espace += vec3(1.0, 0.8, 0.55) * pow(vs, 12.0) * 0.5;
            espace += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, vs) * 8.0;
            // La nuit, le ciel laisse voir l'espace ; depuis l'orbite, on ne voit plus que lui.
            col += espace * (1.0 - jour) * 0.9;
            col = mix(espace, col, uAtmo);
            // Tempête de cendre : un voile brun gris
            col = mix(col, vec3(0.28, 0.25, 0.24) * (0.3 + 0.7 * jour), uCendre * 0.75);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    this.voute.renderOrder = -10;
    this.voute.frustumCulled = false;
    this.groupe.add(this.voute);

    // Étoiles : des points nets qui scintillent
    const alea = hasard(12);
    const n = 3000;
    const pos = new Float32Array(n * 3);
    const tail = new Float32Array(n);
    const teinte = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const z = alea() * 2 - 1, a = alea() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      pos[i * 3] = r * Math.cos(a) * 850;
      pos[i * 3 + 1] = z * 850;
      pos[i * 3 + 2] = r * Math.sin(a) * 850;
      tail[i] = 0.6 + alea() ** 6 * 3.2;
      teinte[i] = alea();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aTaille", new THREE.BufferAttribute(tail, 1));
    geo.setAttribute("aTeinte", new THREE.BufferAttribute(teinte, 1));
    this.etoiles = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { ...GLOBAL, ...u, uVisible: { value: 1 }, uPixel: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aTaille;
          attribute float aTeinte;
          uniform float uTemps;
          uniform float uPixel;
          uniform vec3 uHaut;
          varying float vA;
          varying vec3 vC;
          void main() {
            vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
            float sc = 0.75 + 0.25 * sin(uTemps * (1.0 + aTeinte * 3.0) + aTeinte * 50.0);
            gl_PointSize = aTaille * uPixel * 1.6;
            vA = sc * smoothstep(-0.15, 0.1, dot(normalize(position), uHaut));
            vC = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), aTeinte);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uVisible;
          varying float vA;
          varying vec3 vC;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(d));
            gl_FragColor = vec4(vC * a * vA * uVisible * 1.6, 1.0);
          }
        `,
      }),
    );
    this.etoiles.frustumCulled = false;
    this.etoiles.renderOrder = -9;
    this.groupe.add(this.etoiles);

    // La lune : une vraie sphère, éclairée par le soleil (elle a donc des phases).
    this.lune = new THREE.Mesh(
      new THREE.SphereGeometry(9, 32, 16),
      new THREE.MeshStandardMaterial({ map: textureLune(), roughness: 1, emissive: 0x223355, emissiveIntensity: 0.25, fog: false }),
    );
    this.haloLune = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textureHalo("rgba(170,190,255,0.5)", "rgba(170,190,255,0)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.haloLune.scale.setScalar(70);
    this.haloSoleil = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textureHalo("rgba(255,240,200,1)", "rgba(255,180,100,0)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.haloSoleil.scale.setScalar(70);
    this.groupe.add(this.lune, this.haloLune, this.haloSoleil);

    // Le halo de l'atmosphère, vu de loin : il dépend de la distance entre le rayon de vue et le
    // centre de la planète (fort juste au bord de la planète, nul au bord de la coquille).
    const RA = R * 1.28;
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(RA, 64, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { ...GLOBAL, ...u, uCam: GLOBAL.uCamera },
        vertexShader: /* glsl */ `
          varying vec3 vP;
          void main() {
            vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSoleil;
          uniform vec3 uCam;
          uniform float uAtmo;
          uniform float uVie;
          varying vec3 vP;
          void main() {
            vec3 v = normalize(vP - uCam);
            // Point du rayon le plus proche du centre
            vec3 q = uCam - v * dot(uCam, v);
            float b = length(q);
            float x = (b - ${R.toFixed(1)}) / ${(RA - R).toFixed(2)};
            float glow = b > ${R.toFixed(1)} ? pow(max(0.0, 1.0 - x), 3.0) : 0.35 * pow(b / ${R.toFixed(1)}, 8.0);
            float sol = dot(normalize(q), uSoleil);
            vec3 c = mix(vec3(0.55, 0.6, 0.75), vec3(0.3, 0.62, 1.0), uVie);
            c = mix(c, vec3(1.0, 0.55, 0.3), exp(-pow(sol / 0.3, 2.0)) * 0.6);
            float a = glow * smoothstep(-0.5, 0.35, sol) * (1.0 - uAtmo);
            gl_FragColor = vec4(c * a * 0.9, 1.0);
          }
        `,
      }),
    );
    this.atmosphere.renderOrder = 5;
    this.groupe.add(this.atmosphere);
  }

  maj(camera: THREE.Camera, haut: THREE.Vector3, atmo: number, vie: number, cendre: number, pixel: number) {
    this.voute.position.copy(camera.position);
    this.etoiles.position.copy(camera.position);
    this.u.uHaut.value.copy(haut);
    this.u.uAtmo.value = atmo;
    this.u.uVie.value = vie;
    this.u.uCendre.value = cendre;
    const l0 = camera.position.length();
    this.u.uChute.value = Math.sqrt(Math.max(0, 1 - (R / Math.max(l0, R)) ** 2)) * atmo;
    const s = GLOBAL.uSoleil.value;
    const l = GLOBAL.uLune.value;
    const jour = THREE.MathUtils.smoothstep(s.dot(haut), -0.25, 0.2);
    const em = this.etoiles.material as THREE.ShaderMaterial;
    em.uniforms.uVisible.value = (1 - jour * atmo) * (1 - cendre * 0.8);
    em.uniforms.uPixel.value = pixel;
    this.lune.position.copy(l).multiplyScalar(320);
    this.haloLune.position.copy(this.lune.position);
    (this.haloLune.material as THREE.SpriteMaterial).opacity = 0.6 * (1 - jour * atmo * 0.8);
    this.haloSoleil.position.copy(s).multiplyScalar(600);
    (this.haloSoleil.material as THREE.SpriteMaterial).opacity = 0.45 + 0.4 * (1 - atmo);
  }
}
