// Le décor autour du circuit : le ciel, les nuages, les mouettes, les îles au loin, et sur l'île
// les palmiers, les rochers, le phare, le village, les fanions, les bouées et les barques.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Circuit } from "../course/circuit";
import { hasard } from "../course/hasard";
import { ellipsoide, meche, revolution } from "./formes";
import { fusionner } from "./fusion";
import type { Ile } from "./ile";
import { texture } from "./persos/commun";
import { matToon, piece } from "./toon";

const CIEL = {
  vertex: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uHaut;
    uniform vec3 uHorizon;
    uniform vec3 uSoleil;
    uniform vec3 uDirSoleil;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y, -0.2, 1.0);
      vec3 col = mix(uHorizon, uHaut, smoothstep(0.0, 0.5, h));
      float s = max(dot(d, normalize(uDirSoleil)), 0.0);
      col = mix(col, uSoleil, smoothstep(0.996, 0.998, s));
      col += uSoleil * pow(s, 24.0) * 0.35;
      col = mix(col, uHorizon * 1.06, step(h, 0.05) * 0.35);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

/** Les matériaux du décor, partagés pour que la fusion regroupe tout. */
function materiaux() {
  return {
    tronc: matToon("#a8744a", { ombre: "#5a3442" }),
    palme: matToon("#4cbf5a", { ombre: "#1f6b4f", rim: 0.8 }),
    palmeClaire: matToon("#7bd94f", { ombre: "#2c7a4a", rim: 0.8 }),
    coco: matToon("#6b4a2e"),
    roche: matToon("#b9987c", { ombre: "#5d3a4a" }),
    rocheClaire: matToon("#d2b79a", { ombre: "#6d4a58" }),
    blanc: matToon("#fffaf0", { ombre: "#a9a3c4" }),
    rouge: matToon("#e8322f", { ombre: "#7c1838" }),
    bleu: matToon("#2f8fe0", { ombre: "#1b3a80" }),
    jaune: matToon("#ffd23a", { ombre: "#b0662a" }),
    toit: matToon("#e0613a", { ombre: "#7c2838" }),
    toitBleu: matToon("#3aa0d8", { ombre: "#1d4a7c" }),
    mur: matToon("#fff1d8", { ombre: "#b59fb8" }),
    bois: matToon("#a86b42", { ombre: "#53293a" }),
    vitre: matToon("#7fd6ff", { ombre: "#3a7ab8", brillance: 1 }),
    sombre: matToon("#2d2836", { ombre: "#141019" }),
  };
}
type Mats = ReturnType<typeof materiaux>;

function palmier(M: Mats, alea: () => number, hauteur = 6) {
  const g = new THREE.Group();
  const points: [number, number, number][] = [];
  const courbe = (alea() - 0.5) * 2.4;
  const n = 6;
  for (let i = 0; i <= n; i++) points.push([Math.sin((i / n) * 1.6) * courbe, (i / n) * hauteur, 0]);
  g.add(piece(meche(points, 0.32, 0.55, 10), M.tronc, 1.1));
  const sommet = new THREE.Vector3(...points[n]);
  const feuilles = 6 + Math.floor(alea() * 3);
  for (let i = 0; i < feuilles; i++) {
    const a = (i / feuilles) * Math.PI * 2 + alea() * 0.4;
    const l = 2.6 + alea() * 0.8;
    const dx = Math.cos(a) * l;
    const dz = Math.sin(a) * l;
    const f = piece(
      meche(
        [
          [sommet.x, sommet.y, sommet.z],
          [sommet.x + dx * 0.45, sommet.y + 0.7, sommet.z + dz * 0.45],
          [sommet.x + dx * 0.9, sommet.y + 0.1, sommet.z + dz * 0.9],
          [sommet.x + dx * 1.1, sommet.y - 1.0, sommet.z + dz * 1.1],
        ],
        0.42,
        0.08,
        8,
      ),
      i % 2 ? M.palme : M.palmeClaire,
      1,
    );
    f.scale.set(1, 0.55, 1);
    f.position.y = sommet.y * 0.45;
    g.add(f);
  }
  for (let i = 0; i < 3; i++) {
    const coco = piece(ellipsoide(0.24, 0.24, 0.24, 10, 8), M.coco, 0.8);
    coco.position.set(sommet.x + Math.cos(i * 2.1) * 0.3, sommet.y - 0.3, sommet.z + Math.sin(i * 2.1) * 0.3);
    g.add(coco);
  }
  return g;
}

function rochers(M: Mats, alea: () => number, taille = 1.6) {
  const g = new THREE.Group();
  const n = 1 + Math.floor(alea() * 3);
  for (let i = 0; i < n; i++) {
    const t = taille * (0.6 + alea() * 0.7);
    const r = piece(new THREE.DodecahedronGeometry(t, 1), alea() < 0.5 ? M.roche : M.rocheClaire, 1.1, { lisser: true });
    r.position.set((alea() - 0.5) * taille * 1.6, t * 0.35, (alea() - 0.5) * taille * 1.6);
    r.scale.set(1 + alea() * 0.4, 0.6 + alea() * 0.4, 1 + alea() * 0.3);
    r.rotation.y = alea() * 6;
    g.add(r);
  }
  return g;
}

function cabane(M: Mats, alea: () => number) {
  const g = new THREE.Group();
  const l = 4 + alea() * 2;
  const p = 3.5 + alea();
  const h = 2.6 + alea() * 0.6;
  const corps = piece(new RoundedBoxGeometry(l, h, p, 2, 0.15), M.mur, 1.1, { lisser: true });
  corps.position.y = h / 2;
  g.add(corps);
  const toit = piece(new THREE.ConeGeometry(Math.max(l, p) * 0.78, 2.2, 4), alea() < 0.5 ? M.toit : M.toitBleu, 1.1, { lisser: true });
  toit.rotation.y = Math.PI / 4;
  toit.scale.set(l / Math.max(l, p), 1, p / Math.max(l, p));
  toit.position.y = h + 1.05;
  g.add(toit);
  const porte = piece(new RoundedBoxGeometry(0.9, 1.7, 0.1, 2, 0.05), M.bois, 0.8, { lisser: true });
  porte.position.set(0, 0.85, p / 2 + 0.02);
  g.add(porte);
  for (const s of [-1, 1]) {
    const fenetre = piece(new RoundedBoxGeometry(0.8, 0.8, 0.1, 2, 0.05), M.vitre, 0.8, { lisser: true });
    fenetre.position.set(s * l * 0.3, h * 0.6, p / 2 + 0.02);
    g.add(fenetre);
  }
  return g;
}

function phare(M: Mats) {
  const g = new THREE.Group();
  const rayures = texture(256, 512, (ctx, w, h) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#fffaf0" : "#e8322f";
      ctx.fillRect(0, (i * h) / 6, w, h / 6);
    }
  });
  const tour = piece(
    revolution(
      [
        [2.4, 0],
        [2.2, 4],
        [1.8, 10],
        [1.5, 14],
        [0, 14],
      ],
      24,
    ),
    matToon("#fffaf0", { ombre: "#a9a3c4", carte: rayures }),
    1.2,
  );
  g.add(tour);
  const balcon = piece(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 24), M.sombre, 1);
  balcon.position.y = 14.2;
  g.add(balcon);
  const lanterne = piece(new THREE.CylinderGeometry(1.1, 1.1, 2, 16), M.vitre, 1);
  lanterne.position.y = 15.4;
  g.add(lanterne);
  const chapeau = piece(new THREE.ConeGeometry(1.6, 1.6, 16), M.rouge, 1);
  chapeau.position.y = 17.2;
  g.add(chapeau);
  const maison = piece(new RoundedBoxGeometry(5, 3, 4, 2, 0.15), M.mur, 1.1, { lisser: true });
  maison.position.set(4, 1.5, 0);
  g.add(maison);
  const toit = piece(new THREE.ConeGeometry(3.8, 2, 4), M.toit, 1.1, { lisser: true });
  toit.rotation.y = Math.PI / 4;
  toit.scale.set(1.3, 1, 1);
  toit.position.set(4, 4, 0);
  g.add(toit);
  return g;
}

function bouee(M: Mats) {
  const g = new THREE.Group();
  g.add(piece(ellipsoide(0.6, 0.5, 0.6, 14, 10), M.rouge, 1));
  const bande = piece(new THREE.TorusGeometry(0.55, 0.12, 6, 16), M.blanc, 0.8);
  bande.rotation.x = Math.PI / 2;
  bande.position.y = 0.15;
  g.add(bande);
  const mat = piece(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), M.sombre, 0.6);
  mat.position.y = 0.9;
  g.add(mat);
  return g;
}

function barque(M: Mats, couleur: THREE.Material) {
  const g = new THREE.Group();
  const coque = piece(ellipsoide(1.1, 0.55, 2.6, 18, 10), couleur, 1.1);
  coque.scale.y = 1;
  coque.position.y = 0.1;
  g.add(coque);
  const interieur = piece(ellipsoide(0.9, 0.3, 2.3, 16, 8), M.bois, 0);
  interieur.position.y = 0.45;
  g.add(interieur);
  const banc = piece(new RoundedBoxGeometry(1.8, 0.12, 0.4, 2, 0.04), M.bois, 0.8, { lisser: true });
  banc.position.set(0, 0.55, 0.3);
  g.add(banc);
  return g;
}

export class Decor {
  readonly groupe = new THREE.Group();
  private readonly nuages: { objet: THREE.Object3D; vitesse: number }[] = [];
  private readonly mouettes: { objet: THREE.Group; ailes: THREE.Object3D[]; phase: number; rayon: number; centre: THREE.Vector3 }[] = [];
  private readonly fanions: THREE.Mesh[] = [];
  private readonly barques: THREE.Object3D[] = [];

  constructor(
    readonly circuit: Circuit,
    readonly ile: Ile,
  ) {
    const g = this.groupe;
    const ciel = new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          uHaut: { value: new THREE.Color("#2f7fd8") },
          uHorizon: { value: new THREE.Color("#c4ebff") },
          uSoleil: { value: new THREE.Color("#fff6d8") },
          uDirSoleil: { value: new THREE.Vector3(-0.4, 0.45, 0.95) },
        },
        vertexShader: CIEL.vertex,
        fragmentShader: CIEL.fragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    ciel.renderOrder = -10;
    g.add(ciel);
    const M = materiaux();
    this.construireIlesLointaines();
    this.construireNuages();
    this.construireMouettes();
    const statique = new THREE.Group();
    this.planter(statique, M);
    fusionner(statique);
    g.add(statique);
  }

  /** Vérifie qu'un objet de décor ne gêne pas : hors de la route, derrière le mur ou dans l'eau. */
  private libre(x: number, z: number, rayon: number, dansEau = false) {
    const l = this.circuit.lieu(x, z);
    const h = this.ile.hauteur(x, z);
    if (dansEau) return l.surface === "eau" && h < -1;
    if (l.surface === "eau" || h < 0.3) return false;
    if (l.mur === null) return false;
    return Math.abs(l.proj.d) > l.mur + rayon;
  }

  private poser(parent: THREE.Group, objet: THREE.Object3D, x: number, z: number, rotation = 0, enfoncer = 0.2) {
    objet.position.set(x, this.ile.hauteur(x, z) - enfoncer, z);
    objet.rotation.y += rotation;
    parent.add(objet);
  }

  private planter(parent: THREE.Group, M: Mats) {
    const C = this.circuit;
    const P = C.principal;
    const alea = hasard(42);
    // ——— Le long des bas-côtés bordés d'un mur : palmiers et rochers.
    P.echantillons.forEach((e, k) => {
      if (k % 7 !== 0 || e.pont) return;
      for (const s of [-1, 1]) {
        const cote = s > 0 ? e.g : e.d;
        if (cote.limite !== "mur") continue;
        const falaise = cote.bord < 6;
        for (let rang = 0; rang < 2; rang++) {
          const d = (e.largeur / 2 + cote.bord + 2.2 + rang * 6 + alea() * 3) * s;
          const x = e.x + e.nx * d + (alea() - 0.5) * 3;
          const z = e.z + e.nz * d + (alea() - 0.5) * 3;
          if (!this.libre(x, z, 1.5)) continue;
          if (rang === 0 && (falaise || alea() < 0.35)) this.poser(parent, rochers(M, alea, falaise ? 1.8 : 1.3), x, z, 0, 0.4);
          else if (alea() < 0.75) this.poser(parent, palmier(M, alea, 5 + alea() * 3), x, z, alea() * 6);
        }
      }
    });
    // ——— Des palmiers et des rochers épars dans les collines
    for (let i = 0; i < 160; i++) {
      const x = -260 + alea() * 450;
      const z = -160 + alea() * 280;
      if (!this.libre(x, z, 6)) continue;
      if (this.ile.hauteur(x, z) < 1) continue;
      if (alea() < 0.65) this.poser(parent, palmier(M, alea, 5 + alea() * 4), x, z, alea() * 6);
      else this.poser(parent, rochers(M, alea, 2 + alea() * 2), x, z, 0, 0.6);
    }
    // ——— Le village, au bord de la ligne droite
    for (let i = 0; i < 7; i++) {
      const s = C.sDeU(0.6 + i * 0.22);
      const q = P.point(s, P.point(s).e.largeur / 2 + 15 + (i % 2) * 7);
      if (!this.libre(q.x, q.z, 4)) continue;
      this.poser(parent, cabane(M, alea), q.x, q.z, -q.cap - Math.PI / 2 + Math.PI, 0.1);
    }
    // ——— Le phare, sur la falaise à l'épingle
    {
      const s = C.sDeU(6.6);
      const e = P.point(s).e;
      const q = P.point(s, -(e.largeur / 2 + e.d.bord + 16));
      this.poser(parent, phare(M), q.x, q.z, 0, 0.3);
    }
    // ——— Les bouées le long des plages et les barques dans la lagune
    P.echantillons.forEach((e, k) => {
      if (k % 23 !== 0 || e.pont) return;
      for (const s of [-1, 1]) {
        const cote = s > 0 ? e.g : e.d;
        if (cote.limite !== "eau") continue;
        const d = (e.largeur / 2 + cote.bord + 9 + alea() * 6) * s;
        const x = e.x + e.nx * d;
        const z = e.z + e.nz * d;
        if (this.libre(x, z, 0, true)) {
          const b = bouee(M);
          b.position.set(x, -0.1, z);
          parent.add(b);
        }
      }
    });
    const couleurs = [M.rouge, M.bleu, M.jaune, M.blanc];
    for (let i = 0, n = 0; i < 80 && n < 7; i++) {
      const x = -190 + alea() * 170;
      const z = -20 + alea() * 70;
      if (!this.libre(x, z, 0, true)) continue;
      const libreAutour = [0, 1, 2, 3].every((a) => this.ile.hauteur(x + Math.cos(a * 1.57) * 4, z + Math.sin(a * 1.57) * 4) < -1);
      if (!libreAutour || Math.abs(C.raccourci.projeter(x, z).d) < 8) continue;
      const b = barque(M, couleurs[n % 4]);
      b.position.set(x, 0, z);
      b.rotation.y = alea() * 6;
      this.groupe.add(b);
      this.barques.push(b);
      n++;
    }
    // ——— Les fanions le long de la ligne de départ, des deux côtés
    const tissus = ["#e8322f", "#ffd23a", "#2f8fe0", "#3fbf6a", "#fffaf0"];
    for (let s = -60; s <= 60; s += 10) {
      for (const cote of [-1, 1]) {
        const e = P.point(s).e;
        const bordure = cote > 0 ? e.g : e.d;
        const q = P.point(s, cote * (e.largeur / 2 + bordure.bord + 1.2));
        const mat = piece(meche([[0, 0, 0], [0, 4.5, 0]], 0.08, 0.6, 6), M.sombre, 0.8);
        this.poser(parent, mat, q.x, q.z, 0, 0.1);
        const fanion = new THREE.Mesh(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(1.4, -0.4, 0)]),
          matToon(tissus[(Math.round(s / 10) + 5 + (cote > 0 ? 2 : 0)) % tissus.length], { cote: THREE.DoubleSide, trame: 0 }),
        );
        fanion.geometry.computeVertexNormals();
        fanion.position.set(q.x, Math.max(q.y, this.ile.hauteur(q.x, q.z)) + 4.4, q.z);
        this.groupe.add(fanion);
        this.fanions.push(fanion);
      }
    }
  }

  private construireIlesLointaines() {
    const iles: [number, number, number, number, string][] = [
      [-420, -380, 120, 40, "#7fb7d6"],
      [-120, -470, 80, 26, "#8cc0dc"],
      [260, -400, 150, 55, "#79b2d3"],
      [480, -120, 90, 30, "#8cc0dc"],
      [-520, 120, 110, 34, "#86bcda"],
      [150, 450, 130, 38, "#86bcda"],
    ];
    for (const [x, z, l, h, c] of iles) {
      const ile = new THREE.Mesh(ellipsoide(l / 2, h, l / 4, 24, 12), matToon(c, { ombre: "#6a9cc4", trame: 0, rim: 0 }));
      ile.position.set(x, -h * 0.3, z);
      this.groupe.add(ile);
    }
  }

  private construireNuages() {
    const blanc = matToon("#ffffff", { ombre: "#a9bfee", trame: 0.5, rim: 0 });
    const alea = hasard(7);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + alea() * 0.3;
      const r = 330 + alea() * 160;
      const taille = 18 + alea() * 22;
      const n = new THREE.Group();
      const boules = 7 + Math.floor(alea() * 5);
      for (let k = 0; k < boules; k++) {
        const rb = taille * (0.45 + alea() * 0.55) * (1 - Math.abs(k / boules - 0.5));
        const b = piece(ellipsoide(rb, rb * 0.85, rb * 0.8, 18, 12), blanc, 0.8, { trait: "#6f86c4" });
        b.position.set((k / boules - 0.5) * taille * 2.6, rb * 0.35 + alea() * taille * 0.3, alea() * taille * 0.4);
        n.add(b);
      }
      n.add(piece(ellipsoide(taille * 1.5, taille * 0.4, taille * 0.6, 20, 10), blanc, 0.8, { trait: "#6f86c4" }));
      n.position.set(Math.cos(a) * r, 60 + alea() * 90, Math.sin(a) * r);
      n.lookAt(0, n.position.y, 0);
      this.groupe.add(n);
      this.nuages.push({ objet: n, vitesse: 0.02 + alea() * 0.02 });
    }
  }

  private construireMouettes() {
    const matM = matToon("#ffffff", { ombre: "#9fb0d0", trame: 0 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Group();
      const corps = piece(ellipsoide(0.5, 0.24, 0.24), matM, 0.7);
      corps.rotation.y = Math.PI / 2;
      m.add(corps);
      const ailes: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        const aile = new THREE.Group();
        aile.add(piece(meche([[0, 0, 0], [0, 0.3, s * 1.0], [0, -0.1, s * 2.0]], 0.18, 0.2), matM, 0.7));
        m.add(aile);
        ailes.push(aile);
      }
      this.groupe.add(m);
      this.mouettes.push({
        objet: m,
        ailes,
        phase: i * 1.7,
        rayon: 20 + i * 6,
        centre: new THREE.Vector3(-120 + i * 45, 22 + i * 3, -30 + (i % 3) * 30),
      });
    }
  }

  animer(temps: number, dt: number) {
    for (const n of this.nuages) n.objet.rotation.y += 0;
    for (const n of this.nuages) {
      const a = Math.atan2(n.objet.position.z, n.objet.position.x) + n.vitesse * dt * 0.05;
      const r = Math.hypot(n.objet.position.x, n.objet.position.z);
      n.objet.position.x = Math.cos(a) * r;
      n.objet.position.z = Math.sin(a) * r;
    }
    for (const m of this.mouettes) {
      const a = temps * 0.18 + m.phase;
      m.objet.position.set(m.centre.x + Math.cos(a) * m.rayon, m.centre.y + Math.sin(a * 2) * 1.5, m.centre.z + Math.sin(a) * m.rayon * 0.6);
      m.objet.rotation.y = -a;
      const battement = Math.sin(temps * 6 + m.phase) * 0.5;
      m.ailes[0].rotation.x = battement;
      m.ailes[1].rotation.x = -battement;
    }
    for (const [i, f] of this.fanions.entries()) f.rotation.y = Math.sin(temps * 3.2 + i * 0.7) * 0.5;
    for (const [i, b] of this.barques.entries()) {
      b.position.y = Math.sin(temps * 1.2 + i) * 0.12 - 0.05;
      b.rotation.z = Math.sin(temps * 0.9 + i * 2) * 0.06;
    }
  }
}
