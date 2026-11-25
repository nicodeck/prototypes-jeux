// Les effets : poussière, étincelles de dérapage, gerbes d'eau, éclats, anneaux de turbo.
// Les particules sont des points ronds, cernés d'encre, dessinés en un seul appel.
import * as THREE from "three";
import { etoile } from "./formes";

const MAX = 2500;

const VERTEX = /* glsl */ `
  attribute vec3 couleur;
  attribute float taille;
  attribute float alpha;
  uniform float uEchelle;
  varying vec3 vCouleur;
  varying float vAlpha;
  void main() {
    vCouleur = couleur;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(taille * uEchelle / max(0.5, -mv.z), uEchelle * 0.09);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uEncre;
  varying vec3 vCouleur;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0 || vAlpha <= 0.0) discard;
    vec3 col = vCouleur;
    // Un liseré d'encre autour des bouffées (pas autour des étincelles).
    col = mix(col, vec3(0.11, 0.07, 0.13), step(0.8, d) * uEncre);
    // Un reflet clair en haut à gauche
    col = mix(col, vec3(1.0), step(length(gl_PointCoord - vec2(0.35, 0.32)), 0.16) * 0.35 * uEncre);
    gl_FragColor = vec4(col, vAlpha);
    #include <colorspace_fragment>
  }
`;

class Nuee {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vit = new Float32Array(MAX * 3);
  private readonly coul = new Float32Array(MAX * 3);
  private readonly taille = new Float32Array(MAX);
  private readonly taille0 = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private readonly vie = new Float32Array(MAX);
  private readonly duree = new Float32Array(MAX);
  private readonly gravite = new Float32Array(MAX);
  private readonly croit = new Float32Array(MAX);
  private suivant = 0;
  readonly materiau: THREE.ShaderMaterial;

  constructor(additif: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("couleur", new THREE.BufferAttribute(this.coul, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("taille", new THREE.BufferAttribute(this.taille, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.materiau = new THREE.ShaderMaterial({
      uniforms: { uEchelle: { value: 400 }, uEncre: { value: additif ? 0 : 1 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.materiau);
    this.points.frustumCulled = false;
  }

  emettre(x: number, y: number, z: number, vx: number, vy: number, vz: number, couleur: THREE.Color, taille: number, duree: number, gravite = 0, croit = 0) {
    const i = this.suivant;
    this.suivant = (this.suivant + 1) % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vit.set([vx, vy, vz], i * 3);
    this.coul.set([couleur.r, couleur.g, couleur.b], i * 3);
    this.taille0[i] = taille;
    this.taille[i] = taille;
    this.alpha[i] = 1;
    this.vie[i] = 0;
    this.duree[i] = duree;
    this.gravite[i] = gravite;
    this.croit[i] = croit;
  }

  avancer(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.duree[i] <= 0) continue;
      this.vie[i] += dt;
      const t = this.vie[i] / this.duree[i];
      if (t >= 1) {
        this.duree[i] = 0;
        this.alpha[i] = 0;
        this.taille[i] = 0;
        continue;
      }
      const k = i * 3;
      this.vit[k + 1] -= this.gravite[i] * dt;
      const frein = Math.exp(-dt * 2.2);
      this.vit[k] *= frein;
      this.vit[k + 2] *= frein;
      this.pos[k] += this.vit[k] * dt;
      this.pos[k + 1] += this.vit[k + 1] * dt;
      this.pos[k + 2] += this.vit[k + 2] * dt;
      this.taille[i] = this.taille0[i] * (1 + this.croit[i] * t) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      this.alpha[i] = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    }
    const g = this.points.geometry;
    for (const nom of ["position", "couleur", "taille", "alpha"]) g.getAttribute(nom).needsUpdate = true;
  }
}

interface Anneau {
  mesh: THREE.Mesh;
  vie: number;
  duree: number;
  taille: number;
}

const COULEURS = {
  blanc: new THREE.Color("#ffffff"),
  fumee: new THREE.Color("#f2eef8"),
  sable: new THREE.Color("#f3dca0"),
  herbe: new THREE.Color("#8fd860"),
  eau: new THREE.Color("#e6fbff"),
  eauBleue: new THREE.Color("#7fd3f5"),
  bleu: new THREE.Color("#5ad2ff"),
  orange: new THREE.Color("#ffa22e"),
  or: new THREE.Color("#ffe066"),
  rouge: new THREE.Color("#ff4b3a"),
  violet: new THREE.Color("#b46bff"),
  rose: new THREE.Color("#ff8fd0"),
};
export type CouleurEffet = keyof typeof COULEURS;

const ETOILE = etoile(12, 1, 0.45, 0.3, 9);

export class Effets {
  readonly groupe = new THREE.Group();
  private readonly bouffees = new Nuee(false);
  private readonly etincelles = new Nuee(true);
  private readonly anneaux: Anneau[] = [];
  private readonly etoiles: Anneau[] = [];

  constructor() {
    this.groupe.add(this.bouffees.points, this.etincelles.points);
  }

  echelle(hauteurEcran: number) {
    this.bouffees.materiau.uniforms.uEchelle.value = hauteurEcran * 0.9;
    this.etincelles.materiau.uniforms.uEchelle.value = hauteurEcran * 0.9;
  }

  bouffee(x: number, y: number, z: number, couleur: CouleurEffet, taille = 0.6, vx = 0, vz = 0) {
    this.bouffees.emettre(x, y, z, vx + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.2, vz + (Math.random() - 0.5) * 1.5, COULEURS[couleur], taille, 0.5 + Math.random() * 0.4, -0.5, 1.2);
  }

  etincelle(x: number, y: number, z: number, couleur: CouleurEffet, force = 4) {
    this.etincelles.emettre(
      x,
      y,
      z,
      (Math.random() - 0.5) * force,
      1 + Math.random() * force,
      (Math.random() - 0.5) * force,
      COULEURS[couleur],
      0.1 + Math.random() * 0.08,
      0.25 + Math.random() * 0.25,
      14,
    );
  }

  gerbe(x: number, y: number, z: number, force = 1) {
    for (let i = 0; i < 70 * force; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 4;
      this.bouffees.emettre(x, y, z, Math.cos(a) * r, 5 + Math.random() * 8 * force, Math.sin(a) * r, i % 3 ? COULEURS.eau : COULEURS.eauBleue, 0.35 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 22);
    }
    this.anneau(x, y + 0.05, z, "eau", 4, 0.6, true);
  }

  eclat(x: number, y: number, z: number, couleur: CouleurEffet, n = 24) {
    for (let i = 0; i < n; i++) this.etincelle(x, y, z, couleur, 10);
    for (let i = 0; i < 8; i++) this.bouffee(x, y, z, "fumee", 0.9);
    this.etoile(x, y, z, couleur);
  }

  /** Un anneau qui s'élargit (mini-turbo, palier de dérapage, gerbe). */
  anneau(x: number, y: number, z: number, couleur: CouleurEffet, taille: number, duree: number, aPlat = false) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color: COULEURS[couleur], transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    if (aPlat) m.rotation.x = -Math.PI / 2;
    m.userData.face = !aPlat;
    this.groupe.add(m);
    this.anneaux.push({ mesh: m, vie: 0, duree, taille });
  }

  /** Une étoile d'impact, encre noire derrière, face à la caméra. */
  etoile(x: number, y: number, z: number, couleur: CouleurEffet) {
    const g = new THREE.Group();
    for (const [c, s] of [
      ["#1b1220", 1.18],
      ["#ffffff", 1],
      [COULEURS[couleur].getStyle(), 0.55],
    ] as const) {
      const m = new THREE.Mesh(ETOILE, new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, depthTest: false }));
      m.scale.setScalar(s);
      m.position.z = s === 1 ? 0.01 : s < 1 ? 0.02 : 0;
      m.renderOrder = 10;
      g.add(m);
    }
    g.position.set(x, y, z);
    g.rotation.z = Math.random() * Math.PI;
    g.userData.face = true;
    this.groupe.add(g);
    this.etoiles.push({ mesh: g as unknown as THREE.Mesh, vie: 0, duree: 0.25, taille: 0.9 });
  }

  avancer(dt: number, camera: THREE.Camera) {
    this.bouffees.avancer(dt);
    this.etincelles.avancer(dt);
    for (const liste of [this.anneaux, this.etoiles])
      for (let i = liste.length - 1; i >= 0; i--) {
        const a = liste[i];
        a.vie += dt;
        const t = a.vie / a.duree;
        if (t >= 1) {
          this.groupe.remove(a.mesh);
          a.mesh.traverse((o) => {
            if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
          });
          liste.splice(i, 1);
          continue;
        }
        const s = a.taille * (liste === this.etoiles ? 0.6 + Math.sin(t * Math.PI) * 0.6 : 0.3 + t);
        a.mesh.scale.setScalar(s);
        if (a.mesh.userData.face) a.mesh.quaternion.copy(camera.quaternion);
        a.mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).opacity = 1 - t * t;
        });
      }
  }
}
