// La roche. Plutôt que des cases carrées, on calcule pour chaque point la distance à la roche la
// plus proche (un « champ de distance »). Le shader en tire des contours organiques, déformés par
// du bruit, un intérieur qui s'assombrit en profondeur et des arêtes qui accrochent la lumière.
//
// Le même champ, décalé et gonflé, dessine aussi deux plans de roche juste derrière le jeu :
// la caverne semble continuer dans l'obscurité.
import * as THREE from "three";
import { ROCHE, type Mine } from "../monde/mine";
import { GLSL_BRUIT } from "./bruit";
import { GLSL_LUMIERES, LUMIERES } from "./lumieres";

/** Texels par case */
const RES = 8;
const MIN = -4;
const MAX = 8;
const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance au carré (en texels) de chaque texel au plus proche texel marqué. */
function distances(marque: Uint8Array, w: number, h: number) {
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = marque[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

/** Floute le masque (trois flous en boîte ≈ un flou gaussien) puis le reseuille à moitié. */
function adoucir(masque: Uint8Array, w: number, h: number, r: number) {
  let a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = masque[i];
  let b = new Float32Array(w * h);
  const passe = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const n = horizontal ? w : h;
    const m = horizontal ? h : w;
    for (let j = 0; j < m; j++) {
      const at = (i: number) => {
        const k = Math.min(n - 1, Math.max(0, i));
        return horizontal ? src[j * w + k] : src[k * w + j];
      };
      let somme = 0;
      for (let i = -r; i <= r; i++) somme += at(i);
      for (let i = 0; i < n; i++) {
        const idx = horizontal ? j * w + i : i * w + j;
        dst[idx] = somme / (2 * r + 1);
        somme += at(i + r + 1) - at(i - r);
      }
    }
  };
  for (let k = 0; k < 2; k++) {
    passe(a, b, true);
    [a, b] = [b, a];
    passe(a, b, false);
    [a, b] = [b, a];
  }
  for (let i = 0; i < w * h; i++) masque[i] = a[i] > 0.5 ? 1 : 0;
}

/** Le champ de distance signé, en cases : positif dans le vide, négatif dans la roche. */
export function champDeDistance(mine: Mine) {
  const w = mine.largeur * RES;
  const h = mine.hauteur * RES;
  const roche = new Uint8Array(w * h);
  const vide = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = mine.cases[Math.floor(y / RES) * mine.largeur + Math.floor(x / RES)] === ROCHE;
      roche[y * w + x] = r ? 1 : 0;
      vide[y * w + x] = r ? 0 : 1;
    }
  }
  // On adoucit la forme avant de mesurer : les marches d'escalier deviennent des pentes,
  // les angles s'arrondissent, les parois droites ne bougent pas.
  adoucir(roche, w, h, 5);
  for (let i = 0; i < w * h; i++) vide[i] = roche[i] ? 0 : 1;
  const versRoche = distances(roche, w, h);
  const versVide = distances(vide, w, h);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = roche[i] ? -(Math.sqrt(versVide[i]) - 0.5) / RES : (Math.sqrt(versRoche[i]) - 0.5) / RES;
      // Ligne y de la carte (du haut) → ligne h - 1 - y de la texture (du bas)
      data[(h - 1 - y) * w + x] = Math.round(((Math.min(MAX, Math.max(MIN, s)) - MIN) / (MAX - MIN)) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const SOMMETS = /* glsl */ `
  varying vec2 vMonde;
  void main() {
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xy;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

const GLSL_SDF = /* glsl */ `
  uniform sampler2D uSdf;
  uniform vec2 uTaille;
  float sdf(vec2 p) {
    vec2 uv = vec2(p.x / uTaille.x, 1.0 + p.y / uTaille.y);
    return texture2D(uSdf, uv).r * ${(MAX - MIN).toFixed(1)} + ${MIN.toFixed(1)};
  }
`;

export type Terrain = {
  roche: THREE.Mesh;
  arriere: THREE.Mesh[];
  /** Décalage de parallaxe des plans arrière, recalculé à chaque image */
  regler(camX: number, camY: number, refX: number, refY: number, lointains: THREE.Color[], brume: THREE.Color): void;
  uniforms: { uRoche: { value: THREE.Color }; uMousse: { value: THREE.Color }; uEclat: { value: number } };
};

export function creerTerrain(mine: Mine): Terrain {
  const sdf = champDeDistance(mine);
  const taille = new THREE.Vector2(mine.largeur, mine.hauteur);
  const geo = new THREE.PlaneGeometry(mine.largeur, mine.hauteur);
  geo.translate(mine.largeur / 2, -mine.hauteur / 2, 0);

  const uniforms = {
    ...LUMIERES,
    uSdf: { value: sdf },
    uTaille: { value: taille },
    uRoche: { value: new THREE.Color() },
    uMousse: { value: new THREE.Color() },
    uEclat: { value: 0 },
  };
  const roche = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: SOMMETS,
      fragmentShader: /* glsl */ `
        ${GLSL_BRUIT}
        ${GLSL_LUMIERES}
        ${GLSL_SDF}
        uniform vec3 uRoche;
        uniform vec3 uMousse;
        uniform float uEclat;
        varying vec2 vMonde;

        void main() {
          vec2 p = vMonde;
          float s = sdf(p);
          if (s > 0.45) discard;
          float e = 0.09;
          vec2 g = vec2(sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)), sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e)));
          vec2 n = g / max(length(g), 1e-4);
          float sol = smoothstep(0.6, 0.9, n.y);
          float plafond = smoothstep(0.5, 0.9, -n.y);

          // Le contour : déformé par du bruit sur les parois et les plafonds, presque droit sur les sols
          float grand = fbm(p * 0.5 + 3.1);
          float fin = bruit(p * 4.5);
          float dep = (grand - 0.45) * 0.75 + (fin - 0.5) * 0.14 + plafond * 0.08;
          dep = mix(dep, (fin - 0.5) * 0.05 + 0.01, sol);
          dep = clamp(dep, -0.1, 0.42);
          float d = s + dep;
          float aa = fwidth(d) * 0.75 + 0.002;
          float alpha = 1.0 - smoothstep(-aa, aa, d);
          if (alpha < 0.01) discard;
          float prof = max(-d, 0.0);

          // La matière : strates, grain, veines claires
          float strate = sin(p.y * 2.6 + fbm(p * vec2(0.35, 1.1)) * 6.0);
          float grain = fbm(p * 2.1);
          float veine = smoothstep(0.03, 0.0, abs(fbm(p * 0.8 + 11.0) - 0.5)) * 0.5;
          vec3 alb = uRoche * (0.65 + 0.55 * grain + veine) * (0.88 + 0.12 * strate);
          float bord = exp(-prof * 3.0);
          alb *= 0.3 + 0.7 * bord;

          // La lumière accroche les arêtes tournées vers elle
          vec3 n3 = normalize(vec3(n * bord * 1.3, 0.42));
          vec3 L = lumiere(p, n3);
          float lumL = dot(L, vec3(0.33));
          vec3 col = alb * (uAmbiant * 1.6 + L * (0.45 + 2.2 * bord));

          // Le liseré clair du dessus des roches, et un fil très fin le long des parois
          float lisere = sol * smoothstep(0.15, 0.015, prof) * (0.55 + 0.45 * bruit(p * vec2(8.0, 1.5)));
          col += uMousse * lisere * (0.07 + 0.05 * uEclat + lumL * 0.75);
          col += uMousse * smoothstep(0.035, 0.0, prof) * (1.0 - sol) * (0.02 + lumL * 0.35);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );
  roche.renderOrder = -10;
  roche.frustumCulled = false;

  // Deux plans de roche derrière le jeu, décalés par la parallaxe
  const plans = [
    { facteur: 0.88, seuil: 1.1, ordre: -58 },
    { facteur: 0.74, seuil: 2.6, ordre: -62 },
  ];
  const arriere = plans.map((pl) => {
    const u = {
      ...LUMIERES,
      uSdf: { value: sdf },
      uTaille: { value: taille },
      uDecalage: { value: new THREE.Vector2() },
      uSeuil: { value: pl.seuil },
      uCouleur: { value: new THREE.Color() },
      uBrumeCouche: { value: new THREE.Color() },
    };
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(mine.largeur + 60, mine.hauteur + 60).translate(mine.largeur / 2, -mine.hauteur / 2, 0),
      new THREE.ShaderMaterial({
        uniforms: u,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: SOMMETS,
        fragmentShader: /* glsl */ `
          ${GLSL_BRUIT}
          ${GLSL_LUMIERES}
          ${GLSL_SDF}
          uniform vec2 uDecalage;
          uniform float uSeuil;
          uniform vec3 uCouleur;
          uniform vec3 uBrumeCouche;
          varying vec2 vMonde;
          void main() {
            vec2 q = vMonde - uDecalage;
            float s = sdf(q) - uSeuil + (fbm(q * 0.33 + uSeuil) - 0.5) * 2.2;
            float aa = fwidth(s) + 0.01;
            float alpha = 1.0 - smoothstep(-aa, aa, s);
            if (alpha < 0.01) discard;
            float prof = max(-s, 0.0);
            float tex = 0.75 + 0.5 * fbm(q * vec2(0.9, 1.6));
            vec3 col = mix(uCouleur * tex, uBrumeCouche, exp(-prof * 1.4) * 0.45);
            vec3 L = lumiere(vMonde, vec3(0.0, 0.0, 1.0));
            col += uCouleur * L * 1.4 * exp(-prof * 0.8);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    );
    m.renderOrder = pl.ordre;
    m.frustumCulled = false;
    return { m, u, facteur: pl.facteur };
  });

  return {
    roche,
    arriere: arriere.map((a) => a.m),
    uniforms,
    regler(camX, camY, refX, refY, lointains, brume) {
      arriere.forEach((a, i) => {
        a.u.uDecalage.value.set((camX - refX) * (1 - a.facteur), (camY - refY) * (1 - a.facteur));
        a.u.uCouleur.value.copy(lointains[2 - i]);
        a.u.uBrumeCouche.value.copy(brume).multiplyScalar(0.5 - i * 0.12);
      });
    },
  };
}
