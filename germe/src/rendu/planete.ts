// Le sol de la planète et son eau. Le sol passe du gris (roche morte) au brun (terre humide),
// au vert (herbe), selon l'état de chaque sommet ; un liseré doré marque le front de la vie qui avance.
// L'eau est un second maillage, posé au-dessus du sol là où il y a de l'eau, enfoncé ailleurs.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";
import { GLOBAL, GLSL_COMMUN } from "./communs";

const R = REGLAGES.planete.rayon;

export class RenduPlanete {
  readonly sol: THREE.Mesh;
  readonly eau: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly normales: Float32Array;
  private readonly geo: THREE.BufferGeometry;

  constructor(private readonly monde: Monde) {
    const s = monde.sphere;
    const n = s.n;
    this.positions = new Float32Array(n * 3);
    this.normales = new Float32Array(n * 3);
    const idx = new Float32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    const geo = (this.geo = new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(this.normales, 3));
    geo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));
    geo.setIndex(new THREE.BufferAttribute(s.triangles, 1));
    for (let i = 0; i < n; i++) this.placer(i);
    this.normalesTout();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 3);

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, GLOBAL);
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          ${GLSL_COMMUN}
          attribute float aIdx;
          varying vec4 vE;
          varying vec4 vE2;
          varying vec3 vPosO;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vE = etat(aIdx);
          vE2 = etat2(aIdx);
          vPosO = position;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          ${GLSL_COMMUN}
          uniform float uPart;
          varying vec4 vE;
          varying vec4 vE2;
          varying vec3 vPosO;
          float gFront;
          float gGivre;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec3 up = normalize(vPosO);
            float vie = vE.z;
            float hum = vE.w;
            float eau = vE.y;
            float cendre = vE2.x;
            float creuse = vE2.y;
            float n1 = fbm3(vPosO * 0.55);
            float n2 = fbm3(vPosO * 2.3);
            float n3 = bruitV(vPosO * 9.0);
            // Roche morte : des gris un peu chauds, avec des taches et du grain.
            vec3 roche = mix(vec3(0.27, 0.26, 0.27), vec3(0.6, 0.57, 0.53), smoothstep(0.2, 0.8, n1));
            roche = mix(roche, vec3(0.52, 0.47, 0.42), smoothstep(0.55, 0.75, n2) * 0.5);
            roche *= 0.78 + 0.36 * n2 + 0.16 * (n3 - 0.5);
            // Sol craquelé : la terre morte est fendue en plaques
            vec3 pw = vPosO * 1.9 + (vec3(n1, n2, n3) - 0.5) * 0.7;
            float fis = fissures(pw);
            float fis2 = fissures(pw * 2.7 + 3.0);
            float craque = (1.0 - smoothstep(0.01, 0.06 + 0.04 * n3, fis)) + (1.0 - smoothstep(0.005, 0.04, fis2)) * 0.45 * n2;
            roche *= 1.0 - craque * 0.34;
            roche *= 0.92 + 0.16 * smoothstep(0.05, 0.5, fis);
            // Terre humide, terre creusée
            vec3 humide = mix(vec3(0.27, 0.22, 0.18), vec3(0.36, 0.29, 0.22), n2);
            vec3 terre = mix(vec3(0.32, 0.21, 0.13), vec3(0.42, 0.29, 0.18), n3);
            // Herbe : du vert tendre au vert profond, avec des plaques jaunies
            vec3 herbe = mix(vec3(0.07, 0.2, 0.05), vec3(0.18, 0.33, 0.07), smoothstep(0.3, 0.7, n1));
            herbe = mix(herbe, vec3(0.06, 0.2, 0.08), smoothstep(0.55, 0.8, n2) * 0.7);
            herbe *= 0.9 + 0.2 * n3;
            vec3 sable = mix(vec3(0.70, 0.62, 0.46), vec3(0.80, 0.72, 0.55), n3);
            vec3 col = mix(roche, humide, smoothstep(0.12, 0.55, hum));
            col = mix(col, terre, smoothstep(0.04, 0.25, creuse));
            float seuil = 0.5 + 0.3 * (n2 - 0.5);
            float g = smoothstep(seuil - 0.1, seuil + 0.1, vie);
            col = mix(col, herbe, g);
            // Berges : du sable clair là où l'eau affleure
            float berge = smoothstep(0.004, 0.03, eau) ;
            col = mix(col, sable * 0.8, berge * 0.85);
            // Cendre
            col = mix(col, vec3(0.17, 0.16, 0.16) + 0.06 * n3, smoothstep(0.05, 0.6, cendre) * 0.85);
            // Front de la vie : un liseré doré là où l'herbe gagne
            gFront = smoothstep(0.04, 0.2, vie) * (1.0 - smoothstep(0.35, 0.75, vie)) * smoothstep(0.2, 0.4, hum);
            // Givre des nuits froides sur le sol mort
            float nuit = smoothstep(0.0, -0.35, dot(up, uSoleil));
            gGivre = nuit * (1.0 - g) * (1.0 - smoothstep(0.2, 0.5, hum)) * (1.0 - cendre);
            col = mix(col, vec3(0.62, 0.70, 0.82), gGivre * 0.35);
            diffuseColor.rgb = col;
          }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            vec3 cg = floor(vPosO * 22.0);
            float hg = hash13(cg);
            float paillette = step(0.993, hg) * smoothstep(0.22, 0.05, length(fract(vPosO * 22.0) - 0.5)) * (0.5 + 0.5 * sin(uTemps * 3.0 + hg * 40.0));
            totalEmissiveRadiance += vec3(0.75, 0.7, 0.2) * gFront * (0.12 + 0.06 * sin(uTemps * 2.0 + vPosO.x * 2.0));
            totalEmissiveRadiance += vec3(0.5, 0.65, 0.9) * gGivre * paillette * 0.8;
          }`,
        );
    };
    this.sol = new THREE.Mesh(geo, mat);
    this.sol.receiveShadow = true;
    this.sol.castShadow = false;

    // L'eau : même maillage, positions calculées dans le shader à partir de l'état.
    const geoEau = new THREE.BufferGeometry();
    geoEau.setAttribute("position", new THREE.BufferAttribute(new Float32Array(s.dir), 3));
    geoEau.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));
    geoEau.setIndex(new THREE.BufferAttribute(s.triangles, 1));
    geoEau.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 3);
    const matEau = new THREE.ShaderMaterial({
      uniforms: { ...GLOBAL, uCielJour: { value: new THREE.Color() }, uCielHaut: { value: new THREE.Color() } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        ${GLSL_COMMUN}
        attribute float aIdx;
        varying float vProf;
        varying vec3 vPos;
        varying vec3 vUp;
        void main() {
          vec4 e = etat(aIdx);
          vec4 e2 = etat2(aIdx);
          float w = e.y;
          float mouille = smoothstep(0.004, 0.02, w);
          // Au sec, la surface s'enfonce sous le sol : la berge se dessine toute seule.
          float r = uRayon + e.x + e2.w + mix(-0.12, w + 0.025, mouille);
          vec3 p = position * r;
          vProf = w;
          vPos = p;
          vUp = position;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMUN}
        uniform vec3 uCamera;
        uniform vec3 uCielJour;
        uniform vec3 uCielHaut;
        varying float vProf;
        varying vec3 vPos;
        varying vec3 vUp;
        void main() {
          vec3 up = normalize(vUp);
          vec3 t, b;
          repere(up, t, b);
          // Vaguelettes : deux bruits qui glissent, et des scintillements.
          vec3 q = vPos * 2.2;
          float h1 = bruitV(q + vec3(uTemps * 0.6, 0.0, uTemps * 0.4));
          float h2 = bruitV(q * 2.3 - vec3(uTemps * 0.5, uTemps * 0.7, 0.0));
          float dx = bruitV(q + vec3(0.15, 0.0, 0.0) + vec3(uTemps * 0.6, 0.0, uTemps * 0.4)) - h1;
          float dz = bruitV(q + vec3(0.0, 0.0, 0.15) + vec3(uTemps * 0.6, 0.0, uTemps * 0.4)) - h1;
          vec3 n = normalize(up + (t * dx + b * dz) * 1.6 + (t * (h2 - 0.5)) * 0.15);
          vec3 v = normalize(uCamera - vPos);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
          float jour = smoothstep(-0.25, 0.25, dot(up, uSoleil));
          float lumiere = max(dot(up, uSoleil), 0.0);
          vec3 peu = vec3(0.12, 0.62, 0.68);
          vec3 fond = vec3(0.02, 0.17, 0.36);
          float prof = smoothstep(0.0, 0.5, vProf);
          vec3 col = mix(peu, fond, prof) * (0.2 + 0.8 * jour);
          // Reflet du ciel
          col = mix(col, mix(vec3(0.3, 0.5, 0.8), uCielHaut, 0.3) * (0.15 + 0.85 * jour), fres * 0.55);
          // Éclats de soleil
          vec3 hv = normalize(uSoleil + v);
          float spec = pow(max(dot(n, hv), 0.0), 220.0) * 6.0 * lumiere;
          float scint = step(0.93, bruitV(vPos * 9.0 + uTemps * 1.5)) * pow(max(dot(n, hv), 0.0), 20.0) * 2.5 * lumiere;
          col += vec3(1.0, 0.95, 0.8) * (spec + scint);
          // Lune
          vec3 hl = normalize(uLune + v);
          col += vec3(0.55, 0.65, 0.9) * pow(max(dot(n, hl), 0.0), 120.0) * 1.5 * smoothstep(0.0, 0.3, dot(up, uLune));
          // Écume sur les bords peu profonds
          float ecume = (1.0 - smoothstep(0.0, 0.07, vProf)) * smoothstep(0.35, 0.6, bruitV(vPos * 6.0 + uTemps));
          col = mix(col, vec3(0.9, 0.95, 1.0) * (0.3 + 0.7 * jour), ecume * 0.6);
          float a = smoothstep(0.004, 0.03, vProf) * mix(0.78, 0.95, prof);
          a = max(a, fres * smoothstep(0.004, 0.02, vProf));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.eau = new THREE.Mesh(geoEau, matEau);
    this.eau.renderOrder = 2;
    this.eau.frustumCulled = false;
  }

  private placer(i: number) {
    const d = this.monde.sphere.dir;
    const r = R + this.monde.sol[i];
    this.positions[i * 3] = d[i * 3] * r;
    this.positions[i * 3 + 1] = d[i * 3 + 1] * r;
    this.positions[i * 3 + 2] = d[i * 3 + 2] * r;
  }

  private normalesTout() {
    const s = this.monde.sphere;
    this.normales.fill(0);
    const t = s.triangles;
    for (let f = 0; f < t.length; f += 3) this.ajouterFace(t[f], t[f + 1], t[f + 2]);
    for (let i = 0; i < s.n; i++) this.normaliser(i);
  }

  private ajouterFace(a: number, b: number, c: number) {
    const p = this.positions;
    const e1x = p[b * 3] - p[a * 3], e1y = p[b * 3 + 1] - p[a * 3 + 1], e1z = p[b * 3 + 2] - p[a * 3 + 2];
    const e2x = p[c * 3] - p[a * 3], e2y = p[c * 3 + 1] - p[a * 3 + 1], e2z = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nn = this.normales;
    for (const k of [a, b, c]) {
      nn[k * 3] += nx;
      nn[k * 3 + 1] += ny;
      nn[k * 3 + 2] += nz;
    }
  }

  private normaliser(i: number) {
    const nn = this.normales;
    const l = Math.hypot(nn[i * 3], nn[i * 3 + 1], nn[i * 3 + 2]) || 1;
    nn[i * 3] /= l;
    nn[i * 3 + 1] /= l;
    nn[i * 3 + 2] /= l;
  }

  /** Reporte dans le maillage les sommets dont le sol a changé (coups de pelle). */
  majSol() {
    const m = this.monde;
    if (m.solModifie.size === 0) return;
    const s = m.sphere;
    const touches = new Set<number>();
    for (const i of m.solModifie) {
      this.placer(i);
      touches.add(i);
      for (let k = s.voisinsDebut[i]; k < s.voisinsDebut[i + 1]; k++) touches.add(s.voisins[k]);
    }
    m.solModifie.clear();
    for (const i of touches) {
      this.normales[i * 3] = this.normales[i * 3 + 1] = this.normales[i * 3 + 2] = 0;
    }
    const faites = new Set<number>();
    for (const i of touches) {
      for (let k = s.trisDebut[i]; k < s.trisDebut[i + 1]; k++) {
        const f = s.tris[k];
        if (faites.has(f)) continue;
        faites.add(f);
        const t = s.triangles;
        // Ne cumule que sur les sommets remis à zéro
        const a = t[f * 3], b = t[f * 3 + 1], c = t[f * 3 + 2];
        const p = this.positions;
        const e1x = p[b * 3] - p[a * 3], e1y = p[b * 3 + 1] - p[a * 3 + 1], e1z = p[b * 3 + 2] - p[a * 3 + 2];
        const e2x = p[c * 3] - p[a * 3], e2y = p[c * 3 + 1] - p[a * 3 + 1], e2z = p[c * 3 + 2] - p[a * 3 + 2];
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        for (const v of [a, b, c]) {
          if (!touches.has(v)) continue;
          this.normales[v * 3] += nx;
          this.normales[v * 3 + 1] += ny;
          this.normales[v * 3 + 2] += nz;
        }
      }
    }
    for (const i of touches) this.normaliser(i);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
  }

  majCiel(haut: THREE.Color) {
    const u = (this.eau.material as THREE.ShaderMaterial).uniforms;
    u.uCielHaut.value.copy(haut);
  }
}
