// La mer : une grande nappe dont tout le relief est dans le shader.
//
// - Les vagues : plusieurs couches de bruit qui glissent avec le vent, plus fortes au large et
//   par gros temps, adoucies au loin pour ne pas scintiller.
// - La couleur : le shader connaît la profondeur partout (la hauteur du fond, en texture). Les
//   hauts-fonds sont transparents et turquoise, on voit le sable, les herbiers et les reflets ;
//   le large est d'un bleu profond.
// - Les reflets : le ciel (la même vue du ciel que la brume), les nuages, et le soleil qui pose
//   sur l'eau un chemin de paillettes, doré le soir. La lune fait de même la nuit.
// - L'écume : le long des plages, des vagues qui déferlent et reculent ; au pied des falaises et
//   autour des îlots, un ressac permanent.
// - La pluie dessine des ronds dans l'eau.
import * as THREE from "three";
import { ALTITUDE_NUAGES, ATMO, GLSL_COMMUN } from "./atmosphere";

export class Mer {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(texFond: THREE.Texture) {
    this.uniforms = { ...ATMO, uFond: { value: texFond } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: /* glsl */ `
        varying vec3 vMonde;
        void main() {
          vec4 m = modelMatrix * vec4(position, 1.0);
          vMonde = m.xyz;
          gl_Position = projectionMatrix * viewMatrix * m;
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMUN}
        uniform sampler2D uFond;
        varying vec3 vMonde;

        float fondEn(vec2 p) {
          vec2 uv = (p + 64.0) / 256.0;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -40.0;
          return texture2D(uFond, uv).r;
        }

        /** Une houle faite de vagues sinusoïdales de longueurs et directions variées, autour du vent */
        vec3 normaleVagues(vec2 p, float t, float dist, float calme, out float crete) {
          vec2 d0 = length(uVent) > 0.01 ? normalize(uVent) : vec2(1.0, 0.0);
          float vent = 0.35 + length(uVent) * 1.1;
          vec2 grad = vec2(0.0);
          crete = 0.0;
          for (int i = 0; i < 9; i++) {
            float fi = float(i);
            float ang = (hash11(fi * 7.31 + 1.7) - 0.5) * 1.9;
            vec2 d = vec2(d0.x * cos(ang) - d0.y * sin(ang), d0.x * sin(ang) + d0.y * cos(ang));
            float lambda = 26.0 * pow(0.7, fi);
            float k = 6.2831853 / lambda;
            float w = sqrt(9.8 * k) * 0.5;
            float A = lambda * 0.0085 * vent;
            float phase = k * dot(d, p) - w * t + hash11(fi * 3.7) * 6.2831;
            float fondu = 1.0 - smoothstep(lambda * 6.0, lambda * 30.0, dist);
            float s = sin(phase);
            // Des crêtes un peu pointues, des creux plats
            float c = cos(phase) * (1.0 + 0.6 * s);
            grad += d * (A * k * c) * fondu;
            crete += max(s, 0.0) * A * fondu;
          }
          // Le détail : des ridules de vent
          vec2 q = p * 0.9 + d0 * t * 0.35;
          float r0 = bruitTex(q * 0.11).a;
          float rx = bruitTex((q + vec2(0.15, 0.0)) * 0.11).a;
          float rz = bruitTex((q + vec2(0.0, 0.15)) * 0.11).a;
          grad += vec2(r0 - rx, r0 - rz) * 0.45 * (1.0 - smoothstep(10.0, 60.0, dist)) * vent;
          grad *= calme;
          return normalize(vec3(-grad.x, 1.0, -grad.y));
        }

        void main() {
          vec3 versOeil = cameraPosition - vMonde;
          float dist = length(versOeil);
          vec3 V = versOeil / dist;
          float t = uTemps;
          vec2 p = vMonde.xz;
          float vent = length(uVent);

          float fond = fondEn(p);
          float prof = max(-fond, 0.0);

          // Les vagues, qui s'apaisent sur les hauts-fonds
          float crete;
          vec3 N = normaleVagues(p, t, dist, 0.35 + 0.65 * smoothstep(0.0, 2.5, prof), crete);
          float h0 = crete;
          // La pluie : des ronds qui s'élargissent
          if (uPluie > 0.01 && dist < 120.0) {
            vec2 q = p * 2.2;
            vec2 i = floor(q);
            vec2 f = fract(q) - 0.5;
            float h = hash21(i);
            float age = fract(t * 1.3 + h);
            float r = length(f - (hash22(i) - 0.5) * 0.5);
            float rond = sin((r - age * 0.5) * 60.0) * (1.0 - age) * smoothstep(0.5 * age + 0.06, 0.5 * age, r);
            N.xz += normalize(f + 1e-4) * rond * 0.25 * uPluie;
            N = normalize(N);
          }

          // Le reflet du ciel et des nuages
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          R.y = abs(R.y) + 0.01;
          vec3 reflet = min(couleurCiel(R), vec3(1.4));
          float tn = (${ALTITUDE_NUAGES.toFixed(1)} - vMonde.y) / R.y;
          float nuage = densiteNuages(p + R.xz * tn) * exp(-tn * 0.0004);
          vec3 couleurNuage = couleurCiel(vec3(0.0, 1.0, 0.0)) * 0.7 + uLumiereCouleur * 0.12;
          reflet = mix(reflet, couleurNuage * (1.0 - 0.4 * uPluie), nuage * 0.85);

          // Le chemin de lumière du soleil (ou de la lune)
          float ombre = ombreNuages(vMonde);
          float rl = max(dot(R, uLumiereDir), 0.0);
          float paillettes = pow(rl, 900.0) * 30.0 + pow(rl, 120.0) * 1.2 + pow(rl, 12.0) * 0.03;
          vec3 soleil = uLumiereCouleur * paillettes * ombre;

          // Le corps de l'eau
          vec3 claire = vec3(0.025, 0.36, 0.34);
          vec3 profonde = vec3(0.003, 0.03, 0.065);
          float d = 1.0 - exp(-prof * 0.28);
          vec3 corps = mix(claire, profonde, d);
          vec3 ambiance = couleurCiel(vec3(0.0, 1.0, 0.0));
          float lum = max(uLumiereDir.y, 0.0);
          corps *= ambiance * 0.8 + uLumiereCouleur * 0.22 * lum * ombre;
          // La lumière qui traverse la crête des vagues, à contre-jour
          float sss = pow(max(dot(-V, uLumiereDir) * 0.5 + 0.5, 0.0), 6.0) * clamp(h0 * 2.5, 0.0, 1.0);
          corps += vec3(0.05, 0.4, 0.3) * uLumiereCouleur * sss * 0.15 * (1.0 - uNuit);

          // L'écume du rivage : des vagues qui viennent mourir, et le ressac sous les falaises
          float rivage = 1.0 - smoothstep(0.0, 1.1, prof);
          float n1 = bruitTex(p * 0.35 + t * 0.03).a;
          float n2 = bruitTex(p * 1.1 - t * 0.05).b;
          // Une dentelle : les crêtes d'un bruit, fines et ramifiées
          float lacis = 1.0 - abs(bruitTex(p * 0.42 + vec2(t * 0.02, -t * 0.015)).a * 2.0 - 1.0);
          lacis = smoothstep(0.78, 0.97, lacis) * (0.6 + 0.4 * n2);
          float bandes = sin(prof * 9.0 - t * 1.6 + n1 * 6.0);
          float deferle = smoothstep(0.62, 1.0, bandes) * smoothstep(1.3, 0.1, prof);
          float bord = 1.0 - smoothstep(0.0, 0.22 + 0.1 * n1, prof);
          float ecume = bord * (0.55 + 0.45 * n2) + deferle * (0.35 + 0.65 * lacis) * (0.7 + vent) + rivage * lacis * 0.55;
          // Au large, quelques moutons quand le vent forcit
          ecume += smoothstep(0.75, 0.95, h0 * 2.2 + n2 * 0.3) * smoothstep(0.45, 0.9, vent) * 0.5;
          ecume = clamp(ecume, 0.0, 1.0);

          vec3 col = corps * (1.0 - fres) + reflet * fres + soleil;
          vec3 blanc = (ambiance * 1.1 + uLumiereCouleur * 0.55 * lum * ombre);
          col = mix(col, blanc, ecume * 0.85);
          col += uEclair * vec3(0.5, 0.55, 0.7) * 0.3;

          // La transparence des hauts-fonds
          float alpha = 1.0 - exp(-prof * 0.85);
          alpha = max(alpha, fres * 0.9);
          alpha = max(alpha, ecume * 0.9);
          alpha = mix(alpha, 1.0, smoothstep(60.0, 300.0, dist));
          alpha *= smoothstep(-0.02, 0.06, prof + 0.04);

          col = brume(col, vMonde);
          gl_FragColor = vec4(min(col, vec3(40.0)), alpha);
        }
      `,
    });
    const geo = new THREE.PlaneGeometry(7000, 7000, 1, 1).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(64, 0, 64);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }
}
