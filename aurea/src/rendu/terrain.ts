// Le terrain : un seul maillage modelé par la fonction de hauteur de l'île, peint en code.
//
// Le shader mélange les sols selon la hauteur, la pente et du bruit : herbe sèche et dorée de
// l'été, taches plus vertes dans les creux, terre rouge, sable des plages (plus sombre là où la
// vague vient de passer), calcaire strié sur les pentes raides, fonds marins avec herbiers et
// reflets de vagues (caustiques). Deux petites textures, refaites quand la cité change, y ajoutent
// les voies romaines dallées, les sols des champs, la terre battue autour des bâtiments et leur
// ombre portée douce. En mode construction, la grille et les cases constructibles apparaissent
// autour du curseur.
import * as THREE from "three";
import { FICHES } from "../ville/catalogue";
import { hauteur, indice, TAILLE } from "../ville/ile";
import type { Ville } from "../ville/ville";
import { patcher } from "./atmosphere";

const MIN = -26;
const MAX = 154;
const PAS = 0.5;

const GLSL_TERRAIN = /* glsl */ `
  uniform sampler2D uCarte;
  uniform sampler2D uRoutes;
  uniform sampler2D uBatissable;
  uniform float uGrille;
  uniform vec2 uCurseur;
  uniform vec4 uPortee;

  float routeEn(vec2 c) {
    if (c.x < 0.0 || c.y < 0.0 || c.x > 127.0 || c.y > 127.0) return 0.0;
    return texture2D(uRoutes, (c + 0.5) / 128.0).r;
  }

  /** Distance signée au bord de la route dans la case (négative dedans) */
  float distanceRoute(vec2 p) {
    vec2 cel = floor(p);
    if (routeEn(cel) < 0.5) return 1.0;
    vec2 q = p - cel - 0.5;
    float w = 0.36;
    float d = max(abs(q.x), abs(q.y)) - w;
    if (routeEn(cel + vec2(-1.0, 0.0)) > 0.5) d = min(d, max(abs(q.y) - w, q.x));
    if (routeEn(cel + vec2(1.0, 0.0)) > 0.5) d = min(d, max(abs(q.y) - w, -q.x));
    if (routeEn(cel + vec2(0.0, -1.0)) > 0.5) d = min(d, max(abs(q.x) - w, q.y));
    if (routeEn(cel + vec2(0.0, 1.0)) > 0.5) d = min(d, max(abs(q.x) - w, -q.y));
    return d;
  }

  /** Les dalles polygonales de basalte des voies romaines */
  vec3 dalles(vec2 p, out float joint) {
    vec2 s = p * 3.6;
    vec2 i = floor(s);
    vec2 f = fract(s);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash22(i + g) * 0.8 + 0.1;
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; id = i + g; }
        else if (d < d2) d2 = d;
      }
    }
    joint = 1.0 - smoothstep(0.02, 0.09, d2 - d1);
    float h = hash21(id);
    return vec3(0.25, 0.235, 0.22) * (0.75 + 0.5 * h) + vec3(0.03, 0.02, 0.0) * step(0.8, h);
  }

  float caustiques(vec2 p, float t) {
    vec2 s = p * 1.3;
    float c = 0.0;
    for (int k = 0; k < 2; k++) {
      vec2 i = floor(s);
      vec2 f = fract(s);
      float d1 = 8.0;
      float d2 = 8.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = 0.5 + 0.45 * sin(t * (0.9 + float(k) * 0.3) + 6.2831 * hash22(i + g));
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      c += pow(1.0 - smoothstep(0.0, 0.22, d2 - d1), 2.0);
      s = s * 1.7 + 3.1;
    }
    return c * 0.5;
  }
`;

export class Terrain {
  readonly mesh: THREE.Mesh;
  readonly fondMarin: THREE.Mesh;
  readonly uniforms = {
    uCarte: { value: null as unknown as THREE.DataTexture },
    uRoutes: { value: null as unknown as THREE.DataTexture },
    uBatissable: { value: null as unknown as THREE.DataTexture },
    uGrille: { value: 0 },
    uCurseur: { value: new THREE.Vector2(-100, -100) },
    uPortee: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  private readonly carte = new Uint8Array(TAILLE * TAILLE * 4);
  private readonly routes = new Uint8Array(TAILLE * TAILLE * 4);
  private readonly batissable = new Uint8Array(TAILLE * TAILLE * 4);
  /** La hauteur du terrain sur une grande zone, pour la mer (profondeur, écume) */
  readonly texFond: THREE.DataTexture;

  constructor() {
    // Le maillage
    const n = Math.round((MAX - MIN) / PAS);
    const geo = new THREE.PlaneGeometry(MAX - MIN, MAX - MIN, n, n);
    geo.rotateX(-Math.PI / 2);
    geo.translate((MAX + MIN) / 2, 0, (MAX + MIN) / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const H = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k++) {
      const h = hauteur(pos.getX(k), pos.getZ(k));
      H[k] = h;
      pos.setY(k, h);
    }
    // Les normales, par différences centrées sur la grille
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const k = j * (n + 1) + i;
        const hg = H[j * (n + 1) + Math.max(0, i - 1)]!;
        const hd = H[j * (n + 1) + Math.min(n, i + 1)]!;
        const hh = H[Math.max(0, j - 1) * (n + 1) + i]!;
        const hb = H[Math.min(n, j + 1) * (n + 1) + i]!;
        v.set(hg - hd, 2 * PAS, hh - hb).normalize();
        nor.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeBoundingSphere();

    const fabrique = (data: Uint8Array, filtre: THREE.MagnificationTextureFilter) => {
      const t = new THREE.DataTexture(data, TAILLE, TAILLE, THREE.RGBAFormat);
      t.magFilter = filtre;
      t.minFilter = filtre === THREE.NearestFilter ? THREE.NearestFilter : THREE.LinearFilter;
      t.needsUpdate = true;
      return t;
    };
    this.uniforms.uCarte.value = fabrique(this.carte, THREE.LinearFilter);
    this.uniforms.uRoutes.value = fabrique(this.routes, THREE.NearestFilter);
    this.uniforms.uBatissable.value = fabrique(this.batissable, THREE.NearestFilter);

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    patcher(mat, {
      cle: "terrain",
      fragDecl: GLSL_TERRAIN,
      fragCouleur: /* glsl */ `
        vec3 n = normalize(vNormalMonde);
        float pente = 1.0 - n.y;
        float h = vMonde.y;
        vec2 p = vMonde.xz;
        vec4 b1 = bruitTex(p * 0.011);
        vec4 b2 = bruitTex(p * 0.07);
        vec4 b3 = bruitTex(p * 0.55);
        vec4 b4 = bruitTex(p * 2.3);

        // L'herbe d'été : dorée, plus verte dans les creux et sous les collines
        vec3 seche = vec3(0.40, 0.32, 0.14);
        vec3 paille = vec3(0.55, 0.44, 0.22);
        vec3 verte = vec3(0.13, 0.18, 0.055);
        vec3 maquis = vec3(0.07, 0.10, 0.04);
        vec3 terreRouge = vec3(0.36, 0.17, 0.08);
        float humide = b1.r * 0.55 + b2.g * 0.3 + b3.r * 0.15 + smoothstep(5.0, 14.0, h) * 0.2;
        vec3 c = mix(seche, verte, smoothstep(0.45, 0.7, humide));
        c = mix(c, paille, smoothstep(0.5, 0.75, b3.b) * (1.0 - smoothstep(0.45, 0.65, humide)) * 0.8);
        c = mix(c, terreRouge, smoothstep(0.62, 0.8, b2.r) * 0.4);
        // Des touffes de maquis, plus nombreuses sur les pentes
        c = mix(c, maquis, smoothstep(0.62, 0.72, b4.g * 0.6 + b3.g * 0.4 + pente * 0.4) * 0.75);
        c *= 0.8 + 0.32 * b3.a + 0.16 * (b4.a - 0.5);

        // Le sable, mouillé près de l'eau
        float plage = 1.0 - smoothstep(0.3, 0.75, h + (b2.r - 0.5) * 0.35);
        vec3 sable = vec3(0.70, 0.60, 0.43) * (0.92 + 0.14 * b3.g + 0.08 * b4.b);
        c = mix(c, sable, plage);
        float mouille = 1.0 - smoothstep(0.02, 0.22 + 0.06 * sin(uTemps * 0.6 + p.x * 0.3), h);
        c = mix(c, sable * vec3(0.55, 0.52, 0.48), mouille * plage);

        // Le calcaire, en strates, sur les pentes raides
        float roc = smoothstep(0.32, 0.55, pente + (b2.a - 0.5) * 0.35) + smoothstep(13.0, 19.0, h + b2.r * 4.0) * 0.6;
        vec3 roche = vec3(0.60, 0.56, 0.48) * (0.78 + 0.32 * b3.g);
        roche *= 0.86 + 0.14 * sin(h * 5.0 + b2.r * 5.0) + 0.06 * sin(h * 17.0 + b3.r * 3.0);
        roche = mix(roche, vec3(0.42, 0.40, 0.33), smoothstep(0.6, 0.8, b3.b) * 0.5);
        c = mix(c, roche, clamp(roc, 0.0, 1.0));

        // Les fonds marins : sable clair, herbiers de posidonie, rochers
        if (h < 0.05) {
          float prof = -h;
          vec3 fond = vec3(0.74, 0.70, 0.56) * (0.85 + 0.25 * b3.r);
          float herbier = smoothstep(0.52, 0.66, b2.r + b3.b * 0.2) * smoothstep(0.6, 2.2, prof);
          fond = mix(fond, vec3(0.07, 0.13, 0.07), herbier);
          fond = mix(fond, roche * 0.7, clamp(roc, 0.0, 1.0));
          c = mix(c, fond, smoothstep(0.0, 0.25, prof));
          float caus = caustiques(p, uTemps * 1.4);
          c *= 1.0 + caus * 0.9 * exp(-prof * 0.35) * (1.0 - uNuit) * (1.0 - herbier * 0.6);
        }

        // La cité : terre battue, ombre douce, champs
        vec2 uvc = p / 128.0;
        vec4 carte = texture2D(uCarte, uvc);
        float dansCarte = step(0.0, p.x) * step(0.0, p.y) * step(p.x, 128.0) * step(p.y, 128.0);
        carte *= dansCarte;
        float champ = carte.g;
        if (champ > 0.1) {
          vec3 sol;
          if (champ < 0.37) {
            // Le blé : de la paille et des sillons
            sol = vec3(0.56, 0.44, 0.2) * (0.85 + 0.25 * b4.r);
            sol *= 0.8 + 0.2 * sin(p.y * 18.0 + b3.r);
          } else if (champ < 0.62) {
            // L'oliveraie : herbe rase et terre rouge
            sol = mix(vec3(0.46, 0.38, 0.2), terreRouge, 0.45 + 0.3 * b3.r);
          } else {
            // La vigne : terre labourée en rangs
            sol = vec3(0.40, 0.28, 0.17) * (0.8 + 0.3 * b4.g);
            sol *= 0.75 + 0.25 * smoothstep(0.2, 0.5, abs(fract(p.x * 1.25) - 0.5));
          }
          c = mix(c, sol, smoothstep(0.15, 0.45, champ > 0.1 ? 1.0 : 0.0));
        }
        c = mix(c, vec3(0.45, 0.39, 0.30) * (0.85 + 0.3 * b4.r), carte.b * 0.85);
        c *= 1.0 - carte.a * 0.5;

        // Les voies dallées, avec leurs bas-côtés de terre
        float dr = distanceRoute(p) + (b4.r - 0.5) * 0.05;
        float route = 1.0 - smoothstep(-0.03, 0.03, dr);
        float bord = 1.0 - smoothstep(0.0, 0.2, dr);
        c = mix(c, vec3(0.5, 0.43, 0.33) * (0.85 + 0.3 * b4.g), bord * 0.75);
        if (route > 0.0) {
          float joint;
          vec3 pave = dalles(p, joint);
          pave *= 1.0 - joint * 0.55;
          // Les ornières des charrettes, et la poussière
          pave = mix(pave, vec3(0.5, 0.45, 0.37), smoothstep(0.55, 0.85, b3.a) * 0.35);
          c = mix(c, pave, route);
        }

        // La grille de construction, autour du curseur
        if (uGrille > 0.01) {
          float dCur = length(p - uCurseur);
          float autour = (1.0 - smoothstep(9.0, 16.0, dCur)) * uGrille * dansCarte;
          vec2 f = fract(p);
          float l = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          float trait = 1.0 - smoothstep(0.0, 0.035, l);
          float ok = texture2D(uBatissable, (floor(p) + 0.5) / 128.0).r;
          c = mix(c, mix(vec3(0.9, 0.25, 0.15), vec3(0.45, 0.85, 0.35), ok), autour * 0.18);
          c = mix(c, vec3(1.0, 0.95, 0.8), trait * autour * 0.45);
        }
        // La portée d'un service
        if (uPortee.w > 0.01) {
          float d = length(p - uPortee.xy);
          float anneau = 1.0 - smoothstep(0.0, 0.25, abs(d - uPortee.z));
          float dedans = 1.0 - smoothstep(uPortee.z - 0.3, uPortee.z, d);
          c = mix(c, vec3(1.0, 0.85, 0.45), (dedans * 0.12 + anneau * 0.7) * uPortee.w);
        }
        diffuseColor.rgb = c;
      `,
      fragMatiere: /* glsl */ `
        {
          float dr2 = distanceRoute(vMonde.xz);
          if (dr2 < 0.0) roughnessFactor = 0.78;
          if (vMonde.y < 0.25 && vMonde.y > -0.1) roughnessFactor = 0.45;
        }
      `,
      fragNormale: /* glsl */ `
        {
          // Un relief fin : mottes, cailloux, rides du sable
          vec2 pp = vMonde.xz * 1.1;
          float e = 0.05;
          float a0 = bruitTex(pp * 0.5).a;
          float ax = bruitTex((pp + vec2(e, 0.0)) * 0.5).a;
          float az = bruitTex((pp + vec2(0.0, e)) * 0.5).a;
          vec3 nM = normalize(vNormalMonde);
          float force = 0.35 + 0.9 * smoothstep(0.3, 0.6, 1.0 - nM.y);
          vec3 pert = vec3(a0 - ax, 0.0, a0 - az) * force * 1.6;
          normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz);
        }
      `,
    });
    mat.onBeforeCompile = ((avant) => (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => {
      avant(shader, renderer);
      Object.assign(shader.uniforms, this.uniforms);
    })(mat.onBeforeCompile);

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    // Au-delà : le grand fond, invisible sous l'eau profonde
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a2a3a }));
    fond.position.y = -30;
    this.fondMarin = fond;

    // La hauteur sur une grande zone, pour la mer : 512 × 512 de -64 à 192
    const N = 512;
    // En demi-flottants : le filtrage linéaire des flottants entiers n'est pas garanti partout
    const data = new Uint16Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) data[j * N + i] = THREE.DataUtils.toHalfFloat(hauteur(-64 + ((i + 0.5) * 256) / N, -64 + ((j + 0.5) * 256) / N));
    this.texFond = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.texFond.magFilter = THREE.LinearFilter;
    this.texFond.minFilter = THREE.LinearFilter;
    this.texFond.needsUpdate = true;
  }

  /** Repeint les routes, les champs et la terre battue d'après la cité */
  mettreAJour(v: Ville) {
    const c = this.carte;
    const emprise = new Float32Array(TAILLE * TAILLE);
    c.fill(0);
    for (let k = 0; k < TAILLE * TAILLE; k++) {
      this.routes[k * 4] = v.routes[k] ? 255 : 0;
    }
    for (const b of v.batiments.values()) {
      const champ = b.type === "ferme" ? 0.25 : b.type === "oliveraie" ? 0.5 : b.type === "vigne" ? 0.8 : 0;
      for (let z = b.j; z < b.j + b.p; z++)
        for (let x = b.i; x < b.i + b.l; x++) {
          const k = indice(x, z);
          if (champ > 0) c[k * 4 + 1] = Math.round(champ * 255);
          else if (b.type !== "phare") c[k * 4 + 2] = 255;
          if (!champ) emprise[k] = 1;
        }
    }
    // Les sols des grands bâtiments débordent un peu, et leur ombre douce aussi
    for (let j = 0; j < TAILLE; j++)
      for (let i = 0; i < TAILLE; i++) {
        let s = 0;
        let poids = 0;
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const x = i + di;
            const z = j + dj;
            if (x < 0 || z < 0 || x >= TAILLE || z >= TAILLE) continue;
            const w = 1 / (1 + di * di + dj * dj);
            s += emprise[indice(x, z)]! * w;
            poids += w;
          }
        const k = indice(i, j);
        const ao = s / poids;
        c[k * 4 + 3] = Math.round(Math.min(1, ao * (emprise[k] ? 0.5 : 1.2)) * 255);
        if (!emprise[k] && !v.routes[k]) c[k * 4 + 2] = Math.max(c[k * 4 + 2]!, Math.round(Math.min(1, ao * 1.1) * 200));
      }
    this.uniforms.uCarte.value.needsUpdate = true;
    this.uniforms.uRoutes.value.needsUpdate = true;
    this.majBatissable(v);
  }

  majBatissable(v: Ville) {
    for (let j = 0; j < TAILLE; j++) for (let i = 0; i < TAILLE; i++) this.batissable[indice(i, j) * 4] = v.caseLibre(i, j) ? 255 : 0;
    this.uniforms.uBatissable.value.needsUpdate = true;
  }
}

/** La portée d'un service, en cases (pour l'anneau autour du curseur) */
export function rayonDe(type: string) {
  return (FICHES as Record<string, { rayon?: number }>)[type]?.rayon ?? 0;
}
