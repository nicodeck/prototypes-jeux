// L'île en 3D : le relief, la mer, la route, le pont, le ponton, le tremplin, les bandes
// d'accélération, la ligne de départ et les perles. Tout est tiré du circuit de la simulation
// (src/course/circuit.ts) : si on déplace un point clé, l'île suit.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Circuit } from "../course/circuit";
import type { Echantillon, Piste } from "../course/piste";
import { ellipsoide, Tube } from "./formes";
import { texture } from "./persos/commun";
import { GLOBAL, matToon, piece } from "./toon";

/** Les limites du relief calculé (le reste est la mer). */
const ZONE = { x0: -290, x1: 210, z0: -175, z1: 135, pas: 2.5 };

// ——— Petits outils ———
const lisse = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
function bruit2(x: number, z: number) {
  // Un bruit de valeur lissé, assez pour des collines.
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = lisse(x - xi);
  const fz = lisse(z - zi);
  const a = h(xi, zi);
  const b = h(xi + 1, zi);
  const c = h(xi, zi + 1);
  const d = h(xi + 1, zi + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

const COMMUN_VERTEX = /* glsl */ `
  attribute vec3 couleur;
  varying vec3 vCouleur;
  varying vec3 vN;
  varying vec3 vMonde;
  void main() {
    vCouleur = couleur;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

/** Le sol (relief et bas-côtés) : couleurs par sommet, ombre franche, trame dans l'ombre, mouchetures. */
const SOL_FRAGMENT = /* glsl */ `
  uniform vec3 uLumiere;
  uniform float uCellule;
  varying vec3 vCouleur;
  varying vec3 vN;
  varying vec3 vMonde;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 N = normalize(vN);
    float ndl = dot(N, uLumiere);
    float eclaire = smoothstep(0.05, 0.12, ndl);
    vec3 base = vCouleur;
    // Des mouchetures : touffes d'herbe, grains de sable.
    vec2 cellule = floor(vMonde.xz * 1.3);
    float h = hash(cellule);
    float tache = step(0.82, h) * (1.0 - smoothstep(0.2, 0.35, length(fract(vMonde.xz * 1.3) - 0.5)));
    base *= 1.0 - tache * 0.12;
    base *= 0.94 + 0.06 * hash(floor(vMonde.xz * 0.25));
    vec3 ombre = base * vec3(0.62, 0.6, 0.78);
    vec3 col = mix(ombre, base, eclaire);
    float c = 0.7071;
    vec2 q = mat2(c, -c, c, c) * gl_FragCoord.xy / uCellule;
    float d = length(fract(q) - 0.5);
    float point = 1.0 - smoothstep(0.2, 0.3, d);
    col = mix(col, ombre * 0.75, point * (1.0 - eclaire) * 0.6);
    // La brume au loin
    float dist = length(vMonde - cameraPosition);
    col = mix(col, vec3(0.75, 0.9, 1.0), smoothstep(160.0, 420.0, dist) * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const ROUTE_VERTEX = /* glsl */ `
  attribute vec3 infos;
  varying vec3 vInfos;
  varying vec3 vMonde;
  void main() {
    vInfos = infos;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

/** La route : asphalte, lignes, bordures rouges et blanches, damier du départ ; ou des planches. */
const ROUTE_FRAGMENT = /* glsl */ `
  uniform float uTemps;
  varying vec3 vInfos; // x : écart au milieu (m), y : distance (m), z : demi-largeur ; bois si négative
  varying vec3 vMonde;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float d = vInfos.x;
    float s = vInfos.y;
    float demi = abs(vInfos.z);
    float ad = abs(d);
    vec3 col;
    if (vInfos.z < 0.0) {
      // Des planches en travers, avec leurs joints et leurs clous.
      float k = s / 0.55;
      float planche = floor(k);
      float f = fract(k);
      vec3 bois = mix(vec3(0.71, 0.49, 0.31), vec3(0.8, 0.59, 0.38), hash(vec2(planche, 3.0)));
      bois *= 0.93 + 0.07 * sin(d * 3.0 + planche * 1.7);
      col = mix(vec3(0.36, 0.22, 0.2), bois, smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f));
      float clou = step(length(vec2((fract(d / 1.6) - 0.5) * 1.6, (f - 0.5) * 0.55)), 0.045);
      col = mix(col, vec3(0.25, 0.2, 0.25), clou);
      // Le liseré des bords
      col = mix(col, vec3(0.42, 0.26, 0.22), step(demi - 0.25, ad));
    } else {
      vec3 asphalte = vec3(0.43, 0.42, 0.5);
      asphalte *= 0.95 + 0.07 * hash(floor(vMonde.xz * 0.6));
      asphalte *= 0.97 + 0.03 * hash(floor(vMonde.xz * 4.0));
      col = asphalte;
      // Les lignes : bandes blanches sur les bords, pointillés au milieu.
      float bordLigne = step(demi - 1.15, ad) * step(ad, demi - 0.85);
      float milieu = step(ad, 0.13) * step(fract(s / 7.0), 0.5);
      col = mix(col, vec3(0.95, 0.94, 0.88), max(bordLigne, milieu) * 0.92);
      // Les bordures rouges et blanches
      float bordure = step(demi - 0.7, ad);
      vec3 rb = mix(vec3(0.93, 0.2, 0.2), vec3(0.97, 0.96, 0.92), step(0.5, fract(s / 3.0)));
      col = mix(col, rb, bordure);
      // Le damier de la ligne de départ
      if (s < 2.6 && s >= 0.0) {
        float damier = mod(floor(d / 0.65) + floor(s / 0.65), 2.0);
        col = mix(vec3(0.97), vec3(0.12, 0.1, 0.15), damier);
      }
    }
    float dist = length(vMonde - cameraPosition);
    col = mix(col, vec3(0.75, 0.9, 1.0), smoothstep(160.0, 420.0, dist) * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const MER_VERTEX = /* glsl */ `
  varying vec3 vMonde;
  void main() {
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

/** La mer : turquoise au-dessus des hauts-fonds, de l'écume le long des plages, des vaguelettes. */
const MER_FRAGMENT = /* glsl */ `
  uniform float uTemps;
  uniform sampler2D uFond;
  uniform vec4 uZone; // x0, z0, largeur, profondeur
  varying vec3 vMonde;
  float vague(vec2 p, float t) {
    return sin(p.x * 0.35 + t * 1.1 + sin(p.y * 0.21 + t * 0.4) * 2.0)
         + sin(p.y * 0.52 - t * 0.8 + sin(p.x * 0.17) * 1.5) * 0.7;
  }
  void main() {
    vec2 uv = (vMonde.xz - uZone.xy) / uZone.zw;
    float fond = -8.0;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) fond = texture2D(uFond, uv).r * 20.0 - 10.0;
    float dist = length(vMonde.xz - cameraPosition.xz);
    float loin = smoothstep(30.0, 300.0, dist);
    vec3 profond = mix(vec3(0.1, 0.5, 0.76), vec3(0.37, 0.72, 0.89), loin);
    vec3 lagon = vec3(0.25, 0.85, 0.83);
    float hautFond = smoothstep(-4.5, -0.6, fond);
    vec3 col = mix(profond, lagon, hautFond);
    float v = vague(vMonde.xz, uTemps);
    float largeur = mix(0.12, 0.03, loin);
    float ecume = smoothstep(1.35 - largeur, 1.35, v) * (1.0 - smoothstep(1.35, 1.35 + largeur, v));
    col = mix(col, vec3(0.9, 0.99, 1.0), ecume * (1.0 - loin * 0.6) * 0.8);
    // L'écume du rivage, qui va et vient.
    float rivage = fond + 0.35 + sin(uTemps * 1.3 + vMonde.x * 0.08 + vMonde.z * 0.05) * 0.18;
    col = mix(col, vec3(0.96, 1.0, 1.0), smoothstep(-0.25, -0.05, rivage));
    col = mix(col, vec3(0.75, 0.9, 1.0), smoothstep(200.0, 520.0, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const BANDE_FRAGMENT = /* glsl */ `
  uniform float uTemps;
  varying vec2 vUv;
  void main() {
    // Des chevrons qui défilent vers l'avant (v croissant).
    float x = abs(vUv.x - 0.5) * 2.0;
    float k = fract(vUv.y * 3.0 + x * 0.45 - uTemps * 2.5);
    float chevron = step(0.45, k);
    vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.86, 0.2), chevron);
    float bord = step(0.9, x) + step(vUv.y, 0.04) + step(0.96, vUv.y);
    col = mix(col, vec3(0.12, 0.08, 0.14), min(bord, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const PERLE_FRAGMENT = /* glsl */ `
  uniform float uTemps;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vV);
    float f = 1.0 - max(dot(N, V), 0.0);
    // La nacre : des reflets irisés qui tournent.
    vec3 iris = 0.5 + 0.5 * cos(6.2831 * (f * 1.3 + uTemps * 0.25 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(vec3(1.0, 0.95, 0.88), iris, 0.25 + smoothstep(0.2, 0.85, f) * 0.6);
    float reflet = smoothstep(0.9, 0.92, dot(N, normalize(vec3(-0.3, 0.7, 0.6))));
    col = mix(col, vec3(1.0), reflet);
    float bord = smoothstep(0.82, 0.86, f);
    col = mix(col, vec3(0.11, 0.07, 0.13), bord);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Ile {
  readonly groupe = new THREE.Group();
  private readonly perles: THREE.Group[] = [];
  private readonly drapeaux: THREE.Mesh[] = [];
  private readonly ballons: THREE.Object3D[] = [];
  /** Le relief, pour placer des choses et pour la caméra. */
  readonly hauteurs: Float32Array;
  readonly nx: number;
  readonly nz: number;
  private readonly polygone: [number, number][];

  constructor(readonly circuit: Circuit) {
    const P = circuit.principal;
    this.polygone = P.echantillons.filter((_, i) => i % 3 === 0).map((e) => [e.x, e.z]);
    this.nx = Math.round((ZONE.x1 - ZONE.x0) / ZONE.pas) + 1;
    this.nz = Math.round((ZONE.z1 - ZONE.z0) / ZONE.pas) + 1;
    this.hauteurs = new Float32Array(this.nx * this.nz);
    this.construireRelief();
    this.construireMer();
    this.construireRoute(P, true);
    this.construireRoute(circuit.raccourci, false);
    this.construireBasCotes(P);
    this.construirePont(P);
    this.construirePonton(circuit.raccourci);
    this.construireTremplins();
    this.construireBandes();
    this.construireDepart();
    this.construirePerles();
  }

  private dedans(x: number, z: number) {
    let c = false;
    const p = this.polygone;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, zi] = p[i];
      const [xj, zj] = p[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  }

  /** La hauteur du relief et sa nature, à partir du bout de route le plus proche. */
  private terrain(x: number, z: number) {
    const C = this.circuit;
    const pP = C.principal.projeter(x, z);
    const e = C.principal.echantillons[pP.i];
    const cote = pP.d > 0 ? e.g : e.d;
    const ad = Math.abs(pP.d);
    const exces = ad - (e.largeur / 2 + cote.bord);
    const y = pP.y;
    let h: number;
    let nature: "sable" | "herbe" | "roche" = cote.limite === "eau" ? "sable" : "herbe";
    const dedans = this.dedans(x, z);
    if (e.pont) {
      h = -3.2 + lisse((ad - 30) / 40) * 2;
      nature = "sable";
    } else if (cote.limite === "eau") {
      h = exces < 0 ? y - 0.5 : Math.max(-4.5, y - 0.5 - exces * 0.55 - exces * exces * 0.02);
    } else {
      const colline = 2.2 * lisse(exces / 3) + Math.max(0, exces) * 0.18 + bruit2(x * 0.045, z * 0.045) * 3.5 * lisse(exces / 8);
      h = exces < 0 ? y - 0.5 : y - 0.5 + colline;
      if (!dedans) h = h + (-5 - h) * lisse((exces - 12) / 7);
      if (exces > 1.5 && (h > y + 3.5 || (!dedans && exces > 11))) nature = "roche";
    }
    // Le ponton passe au-dessus de l'eau.
    const pR = C.raccourci.projeter(x, z);
    if (pR.s > 0 && pR.s < C.raccourci.longueur && Math.abs(pR.d) < 7 && h > -1) h = Math.min(h, -1.8 + Math.abs(pR.d) * 0.1);
    return { h, nature };
  }

  hauteur(x: number, z: number) {
    const fx = (x - ZONE.x0) / ZONE.pas;
    const fz = (z - ZONE.z0) / ZONE.pas;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return -6;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const H = this.hauteurs;
    const a = H[j * this.nx + i];
    const b = H[j * this.nx + i + 1];
    const c = H[(j + 1) * this.nx + i];
    const d = H[(j + 1) * this.nx + i + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }

  private construireRelief() {
    const { nx, nz } = this;
    const pos = new Float32Array(nx * nz * 3);
    const couleurs = new Float32Array(nx * nz * 3);
    const natures: string[] = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = ZONE.x0 + i * ZONE.pas;
        const z = ZONE.z0 + j * ZONE.pas;
        const t = this.terrain(x, z);
        const k = j * nx + i;
        this.hauteurs[k] = t.h;
        natures.push(t.nature);
        pos.set([x, t.h, z], k * 3);
      }
    const sable = new THREE.Color("#f0d89a");
    const sableMouille = new THREE.Color("#d4b47a");
    const herbe = new THREE.Color("#7fcf55");
    const herbeHaute = new THREE.Color("#5fb84a");
    const roche = new THREE.Color("#c4a284");
    const c = new THREE.Color();
    for (let k = 0; k < nx * nz; k++) {
      const h = this.hauteurs[k];
      const n = natures[k];
      if (n === "sable") c.copy(h < 0.4 ? sableMouille : sable);
      else if (n === "roche") c.copy(roche);
      else c.copy(herbe).lerp(herbeHaute, lisse((h - 4) / 8));
      if (h < 0.5 && n !== "roche") c.lerp(sable, 0.8);
      couleurs.set([c.r, c.g, c.b], k * 3);
    }
    const index: number[] = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const d = a + nx;
        const e = d + 1;
        // Les cases entièrement sous l'eau ne servent à rien.
        if (Math.max(this.hauteurs[a], this.hauteurs[b], this.hauteurs[d], this.hauteurs[e]) < -1.2) continue;
        index.push(a, d, b, b, d, e);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("couleur", new THREE.BufferAttribute(couleurs, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const relief = new THREE.Mesh(g, this.matSol());
    this.groupe.add(relief);
  }

  private matSol() {
    return new THREE.ShaderMaterial({
      uniforms: { uLumiere: GLOBAL.uLumiere, uCellule: GLOBAL.uCellule },
      vertexShader: COMMUN_VERTEX,
      fragmentShader: SOL_FRAGMENT,
    });
  }

  private construireMer() {
    // La carte des fonds, pour l'écume et le lagon turquoise.
    const { nx, nz } = this;
    const data = new Uint8Array(nx * nz * 4);
    for (let k = 0; k < nx * nz; k++) {
      const v = Math.max(0, Math.min(255, Math.round(((this.hauteurs[k] + 10) / 20) * 255)));
      data.set([v, v, v, 255], k * 4);
    }
    const fond = new THREE.DataTexture(data, nx, nz);
    fond.magFilter = THREE.LinearFilter;
    fond.minFilter = THREE.LinearFilter;
    fond.needsUpdate = true;
    const mer = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uTemps: GLOBAL.uTemps,
          uFond: { value: fond },
          uZone: { value: new THREE.Vector4(ZONE.x0, ZONE.z0, ZONE.x1 - ZONE.x0, ZONE.z1 - ZONE.z0) },
        },
        vertexShader: MER_VERTEX,
        fragmentShader: MER_FRAGMENT,
      }),
    );
    mer.rotation.x = -Math.PI / 2;
    this.groupe.add(mer);
  }

  /** La route (ou le ponton) : un ruban le long de la piste. */
  private construireRoute(piste: Piste, fermee: boolean) {
    const E = fermee ? [...piste.echantillons, { ...piste.echantillons[0], s: piste.longueur }] : piste.echantillons;
    const pos: number[] = [];
    const infos: number[] = [];
    const index: number[] = [];
    E.forEach((e, k) => {
      const bois = !fermee || e.pont;
      // Sur le pont et le ponton, les planches couvrent aussi le bas-côté.
      const demi = e.largeur / 2 + (bois ? Math.max(0, e.g.bord) : 0);
      const y = e.y + this.bonusTremplin(e, fermee) + 0.02;
      for (const s of [-1, 1]) {
        pos.push(e.x + e.nx * demi * s, y, e.z + e.nz * demi * s);
        infos.push(demi * s, e.s, bois ? -demi : demi);
      }
      if (k > 0) {
        const a = (k - 1) * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("infos", new THREE.Float32BufferAttribute(infos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({ uniforms: { uTemps: GLOBAL.uTemps }, vertexShader: ROUTE_VERTEX, fragmentShader: ROUTE_FRAGMENT, side: THREE.DoubleSide }),
    );
    this.groupe.add(m);
  }

  private bonusTremplin(e: Echantillon, principal: boolean) {
    if (!principal) return 0;
    let y = 0;
    for (const t of this.circuit.tremplins) {
      const k = (e.s - t.s) / t.longueur;
      if (k >= 0 && k <= 1) y += t.hauteur * k;
    }
    return y;
  }

  /** Les bas-côtés : sable ou herbe, de la route jusqu'à la limite. */
  private construireBasCotes(P: Piste) {
    const E = [...P.echantillons, { ...P.echantillons[0], s: P.longueur }];
    const pos: number[] = [];
    const couleurs: number[] = [];
    const index: number[] = [];
    const teintes = { sable: new THREE.Color("#efd595"), herbe: new THREE.Color("#86d45a"), planches: new THREE.Color("#b27a4c") };
    for (const s of [-1, 1]) {
      const depart = pos.length / 3;
      E.forEach((e, k) => {
        const cote = s > 0 ? e.g : e.d;
        const demi = e.largeur / 2;
        const bord = e.pont ? 0 : cote.bord + (cote.limite === "mur" ? 1.5 : 0.25);
        const y = e.y + 0.01;
        const c = teintes[cote.sol];
        pos.push(e.x + e.nx * demi * s, y, e.z + e.nz * demi * s);
        pos.push(e.x + e.nx * (demi + bord) * s, y - (cote.limite === "eau" ? 0.12 : 0), e.z + e.nz * (demi + bord) * s);
        couleurs.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (k > 0) {
          const a = depart + (k - 1) * 2;
          index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("couleur", new THREE.Float32BufferAttribute(couleurs, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(index);
    const m = this.matSol();
    m.side = THREE.DoubleSide;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    this.groupe.add(new THREE.Mesh(g, m));
  }

  /** Le pont : le tablier, les rambardes et les piles plantées dans l'eau. */
  private construirePont(P: Piste) {
    const E = P.echantillons.filter((e) => e.pont);
    if (!E.length) return;
    const groupe = new THREE.Group();
    const bois = matToon("#9b6340", { ombre: "#4f2b33", rim: 1 });
    const blanc = matToon("#f4efe4", { ombre: "#a9a3c4" });
    const pierre = matToon("#cdb79a", { ombre: "#6d5560" });
    // Le flanc du tablier
    for (const s of [-1, 1]) {
      const pos: number[] = [];
      const index: number[] = [];
      E.forEach((e, k) => {
        const d = (e.largeur / 2 + e.g.bord) * s;
        pos.push(e.x + e.nx * d, e.y + 0.02, e.z + e.nz * d, e.x + e.nx * d, e.y - 0.7, e.z + e.nz * d);
        if (k > 0) index.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      const flanc = new THREE.Mesh(g, matToon("#7a4a34", { ombre: "#3e2230", cote: THREE.DoubleSide }));
      groupe.add(flanc);
      // Les rambardes : deux lisses blanches sur des poteaux.
      for (const h of [0.55, 1.0]) {
        const tube = new Tube(E.length, 6, () => 0.07);
        tube.suivre(E.filter((_, i) => i % 3 === 0 || i === E.length - 1).map((e) => new THREE.Vector3(e.x + e.nx * (e.largeur / 2 + e.g.bord) * s, e.y + h, e.z + e.nz * (e.largeur / 2 + e.g.bord) * s)));
        groupe.add(piece(tube.geometrie, blanc, 0.8));
      }
      E.forEach((e, k) => {
        if (k % 3 !== 0) return;
        const d = (e.largeur / 2 + e.g.bord) * s;
        const poteau = piece(new THREE.CylinderGeometry(0.09, 0.1, 1.1, 8), blanc, 0.8);
        poteau.position.set(e.x + e.nx * d, e.y + 0.55, e.z + e.nz * d);
        groupe.add(poteau);
      });
    }
    // Les piles
    E.forEach((e, k) => {
      if (k % 12 !== 6) return;
      for (const s of [-1, 1]) {
        const d = (e.largeur / 2 - 1.5) * s;
        const pile = piece(new THREE.CylinderGeometry(0.6, 0.8, e.y + 3.5, 12), pierre, 1);
        pile.position.set(e.x + e.nx * d, (e.y - 3.5) / 2 - 0.3, e.z + e.nz * d);
        groupe.add(pile);
      }
      const poutre = piece(new RoundedBoxGeometry(e.largeur, 0.5, 0.8, 2, 0.1), bois, 1, { lisser: true });
      poutre.position.set(e.x, e.y - 0.8, e.z);
      poutre.rotation.y = -Math.atan2(e.tz, e.tx) + Math.PI / 2;
      groupe.add(poutre);
    });
    this.groupe.add(groupe);
  }

  /** Le ponton : des planches sur pilotis, sans rambarde. */
  private construirePonton(R: Piste) {
    const groupe = new THREE.Group();
    const bois = matToon("#8a5638", { ombre: "#45263a" });
    const corde = matToon("#e8d39a", { ombre: "#8b6a5a" });
    for (const s of [-1, 1]) {
      const pos: number[] = [];
      const index: number[] = [];
      R.echantillons.forEach((e, k) => {
        const d = (e.largeur / 2 + e.g.bord) * s;
        pos.push(e.x + e.nx * d, e.y + 0.02, e.z + e.nz * d, e.x + e.nx * d, e.y - 0.35, e.z + e.nz * d);
        if (k > 0) index.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      groupe.add(new THREE.Mesh(g, matToon("#6f4330", { ombre: "#3a2030", cote: THREE.DoubleSide })));
    }
    R.echantillons.forEach((e, k) => {
      if (k % 4 !== 2 || k < 4 || k > R.echantillons.length - 5) return;
      for (const s of [-1, 1]) {
        const d = (e.largeur / 2 + e.g.bord + 0.1) * s;
        const pieu = piece(new THREE.CylinderGeometry(0.16, 0.18, e.y + 2.6 + (k % 8 === 2 ? 0.6 : 0), 8), bois, 0.9);
        pieu.position.set(e.x + e.nx * d, (e.y + 2.6) / 2 - 2.6 + (k % 8 === 2 ? 0.3 : 0), e.z + e.nz * d);
        groupe.add(pieu);
        if (k % 8 === 2) {
          const anneau = piece(new THREE.TorusGeometry(0.2, 0.05, 6, 12), corde, 0.6);
          anneau.rotation.x = Math.PI / 2;
          anneau.position.set(e.x + e.nx * d, e.y + 0.45, e.z + e.nz * d);
          groupe.add(anneau);
        }
      }
    });
    this.groupe.add(groupe);
  }

  private construireTremplins() {
    const P = this.circuit.principal;
    const rayures = texture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#ffd23a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#1b1220";
      for (let i = -4; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 64, 0);
        ctx.lineTo(i * 64 + 32, 0);
        ctx.lineTo(i * 64 + 32 + 128, h);
        ctx.lineTo(i * 64 + 128, h);
        ctx.fill();
      }
    });
    rayures.wrapT = THREE.RepeatWrapping;
    for (const t of this.circuit.tremplins) {
      const pos: number[] = [];
      const uv: number[] = [];
      const index: number[] = [];
      const n = Math.ceil(t.longueur) + 1;
      const rangs: { e: ReturnType<Piste["point"]>; h: number }[] = [];
      for (let i = 0; i < n; i++) {
        const s = t.s + (i / (n - 1)) * t.longueur;
        rangs.push({ e: P.point(s), h: (i / (n - 1)) * t.hauteur });
      }
      // Le dessus en pente
      rangs.forEach(({ e, h }, i) => {
        const demi = e.e.largeur / 2;
        for (const s of [-1, 1]) {
          pos.push(e.x + e.e.nx * demi * s, e.y + h + 0.03, e.z + e.e.nz * demi * s);
          uv.push(s > 0 ? 1 : 0, i / (n - 1));
        }
        if (i > 0) index.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
      });
      // Le front vertical, au bout
      const fin = rangs[rangs.length - 1];
      const b = pos.length / 3;
      for (const s of [-1, 1]) {
        const demi = fin.e.e.largeur / 2;
        pos.push(fin.e.x + fin.e.e.nx * demi * s, fin.e.y + fin.h + 0.03, fin.e.z + fin.e.e.nz * demi * s);
        uv.push(s > 0 ? 1 : 0, 0);
        pos.push(fin.e.x + fin.e.e.nx * demi * s, fin.e.y, fin.e.z + fin.e.e.nz * demi * s);
        uv.push(s > 0 ? 1 : 0, 0.2);
      }
      index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matToon("#ffd23a", { carte: rayures, cote: THREE.DoubleSide, trame: 0.3 }));
      this.groupe.add(m);
    }
  }

  private construireBandes() {
    const P = this.circuit.principal;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTemps: GLOBAL.uTemps },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: BANDE_FRAGMENT,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const b of this.circuit.bandes) {
      const q = P.point(b.s, b.d);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.largeur, b.longueur), mat);
      m.rotation.order = "YXZ";
      m.rotation.y = -q.cap + Math.PI / 2;
      m.rotation.x = -Math.PI / 2;
      m.position.set(q.x, q.y + 0.05, q.z);
      // La texture défile vers l'avant de la piste : v croissant = vers l'avant.
      m.rotation.z = Math.PI;
      this.groupe.add(m);
    }
  }

  /** Le portique de départ, au-dessus de la ligne. */
  private construireDepart() {
    const P = this.circuit.principal;
    const e = P.point(0.8);
    const groupe = new THREE.Group();
    const largeur = e.e.largeur + 4;
    const rouge = matToon("#e8322f", { ombre: "#7c1838" });
    const blanc = matToon("#fffaf0", { ombre: "#a9a3c4" });
    for (const s of [-1, 1]) {
      const pilier = piece(new RoundedBoxGeometry(0.8, 7, 0.8, 3, 0.15), s > 0 ? rouge : blanc, 1.1, { lisser: true });
      pilier.position.set((s * largeur) / 2, 3.5, 0);
      groupe.add(pilier);
      const boule = piece(ellipsoide(0.6, 0.6, 0.6), matToon("#ffd23a"), 1);
      boule.position.set((s * largeur) / 2, 7.4, 0);
      groupe.add(boule);
    }
    const banniere = texture(1024, 160, (ctx, w, h) => {
      ctx.fillStyle = "#1b1220";
      ctx.fillRect(0, 0, w, h);
      const c = 20;
      for (let i = 0; i < w / c; i++) {
        ctx.fillStyle = i % 2 ? "#fffaf0" : "#1b1220";
        ctx.fillRect(i * c, 0, c, c);
        ctx.fillStyle = i % 2 ? "#1b1220" : "#fffaf0";
        ctx.fillRect(i * c, h - c, c, c);
      }
      ctx.font = `400 ${h * 0.5}px Bangers, Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#1b1220";
      ctx.strokeText("RALLYE DU RÉCIF", w / 2, h * 0.53);
      ctx.fillStyle = "#ffd23a";
      ctx.fillText("RALLYE DU RÉCIF", w / 2, h * 0.53);
    });
    const panneau = piece(new RoundedBoxGeometry(largeur, 1.6, 0.3, 2, 0.08), matToon("#1b1220", { carte: banniere, trame: 0 }), 1, { lisser: true });
    // La texture sur la face avant et la face arrière.
    const uv = panneau.geometry.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
    panneau.position.y = 6.3;
    groupe.add(panneau);
    groupe.position.set(e.x, e.y, e.z);
    groupe.rotation.y = -e.cap + Math.PI / 2;
    this.groupe.add(groupe);
  }

  private construirePerles() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTemps: GLOBAL.uTemps },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: PERLE_FRAGMENT,
    });
    const halo = new THREE.MeshBasicMaterial({ color: "#fff3b0", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.SphereGeometry(0.55, 24, 16);
    const anneau = new THREE.RingGeometry(0.85, 1.0, 32);
    const or = matToon("#ffd23a", { ombre: "#c0662a", brillance: 1, rim: 1.3 });
    const cerceau = new THREE.TorusGeometry(0.82, 0.07, 8, 32);
    for (const p of this.circuit.perles) {
      const g = new THREE.Group();
      const perle = new THREE.Mesh(geo, mat);
      g.add(perle);
      // Deux cerceaux dorés qui tournent autour de la perle.
      for (let i = 0; i < 2; i++) {
        const c = piece(cerceau, or, 0.8);
        c.name = "cerceau";
        c.rotation.set(i ? 1.1 : -0.4, i * 1.4, 0);
        g.add(c);
      }
      const h = new THREE.Mesh(anneau, halo);
      h.name = "halo";
      g.add(h);
      g.position.set(p.x, p.y + 1.0, p.z);
      this.groupe.add(g);
      this.perles.push(g);
    }
  }

  /** Les perles ramassées disparaissent puis regonflent. `retours` : images avant le retour, par perle. */
  animer(temps: number, retours: number[], camera: THREE.Camera) {
    this.perles.forEach((g, i) => {
      const r = retours[i] ?? 0;
      const echelle = r > 0 ? 0 : 1;
      const cible = g.userData.echelle ?? 1;
      const e = cible + (echelle - cible) * (echelle > cible ? 0.12 : 1);
      g.userData.echelle = e;
      g.scale.setScalar(Math.max(0.001, e));
      g.position.y = this.circuit.perles[i].y + 1.0 + Math.sin(temps * 2.4 + i) * 0.15;
      g.children.forEach((c, k) => {
        if (c.name === "cerceau") c.rotation.y = temps * (k % 2 ? 1.6 : -1.3) + k;
      });
      const halo = g.getObjectByName("halo")!;
      halo.quaternion.copy(camera.quaternion);
      halo.scale.setScalar(1 + Math.sin(temps * 5 + i) * 0.08);
    });
    for (const [i, d] of this.drapeaux.entries()) d.rotation.y = Math.sin(temps * 3 + i) * 0.25;
    for (const [i, b] of this.ballons.entries()) b.position.y = (b.userData.y as number) + Math.sin(temps * 1.5 + i) * 0.12;
  }
}
