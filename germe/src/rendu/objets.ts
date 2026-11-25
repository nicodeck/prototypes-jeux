// Les objets posés sur la planète : graines lumineuses (avec leur colonne de lumière visible de loin),
// sources (un cristal qui flotte au-dessus d'une cuvette, terne quand elle dort), pierres à pousser
// et rochers de décor, qui se couvrent de mousse quand la vie les atteint.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { bruit3, hasard } from "../monde/bruit";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;
const HAUT = new THREE.Vector3(0, 1, 0);
const bruit = bruit3(5);

function caillou(detail: number, graine: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = 1 + 0.25 * bruit(p.x * 1.3 + graine, p.y * 1.3, p.z * 1.3) + 0.08 * bruit(p.x * 4 + graine, p.y * 4, p.z * 4);
    p.multiplyScalar(k);
    pos.setXYZ(i, p.x, p.y * 0.8, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function orienter(o: THREE.Object3D, dir: THREE.Vector3) {
  o.quaternion.setFromUnitVectors(HAUT, dir);
}

const MAT_COLONNE = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  uniforms: { uTemps: { value: 0 }, uForce: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTemps;
    uniform float uForce;
    varying vec2 vUv;
    void main() {
      float a = (1.0 - vUv.y) * (1.0 - vUv.y);
      a *= 0.55 + 0.45 * sin(vUv.y * 20.0 - uTemps * 4.0);
      float bord = sin(vUv.x * 3.14159 * 2.0) * 0.5 + 0.5;
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.4) * a * (0.4 + 0.6 * bord) * 0.55 * uForce, 1.0);
    }
  `,
});

export class RenduObjets {
  readonly groupe = new THREE.Group();
  private readonly graines = new Map<number, THREE.Group>();
  private readonly sources: { groupe: THREE.Group; cristal: THREE.Mesh; mat: THREE.MeshStandardMaterial; anneau: THREE.Mesh }[] = [];
  private readonly pierres: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  private readonly rochers: THREE.InstancedMesh;
  private readonly geoGraine: THREE.BufferGeometry;
  private readonly matGraine = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa520, emissiveIntensity: 1.4, roughness: 0.3 });
  private readonly matFeuilleGraine = new THREE.MeshStandardMaterial({ color: 0x7bd04a, emissive: 0x2f6a10, emissiveIntensity: 0.5 });
  private readonly geoColonne = new THREE.CylinderGeometry(0.14, 0.2, 7, 12, 1, true).translate(0, 3.5, 0);
  private compteur = 0;

  constructor(private readonly monde: Monde) {
    this.geoGraine = new THREE.SphereGeometry(0.13, 14, 10);
    this.geoGraine.scale(0.85, 1.25, 0.85);

    // Sources
    const alea = hasard(77);
    for (const s of monde.sources) {
      const g = new THREE.Group();
      const centre = monde.surface(s.dir);
      g.position.copy(centre);
      orienter(g, s.dir);
      g.updateMatrixWorld(true);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, emissive: 0x3ad7ff, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1, flatShading: true });
      const cristal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
      cristal.scale.set(1, 1.7, 1);
      cristal.position.y = 1.3;
      cristal.castShadow = true;
      g.add(cristal);
      // Un anneau de lumière qui pulse sous le cristal quand la source vit
      const anneau = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.025, 6, 40),
        new THREE.MeshBasicMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      anneau.rotation.x = Math.PI / 2;
      anneau.position.y = 0.95;
      g.add(anneau);
      // Pierres levées autour de la cuvette
      const pierreMat = new THREE.MeshStandardMaterial({ color: 0x77736e, roughness: 0.9, flatShading: true });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + alea() * 0.3;
        const geo = caillou(0, k * 3.1);
        const m = new THREE.Mesh(geo, pierreMat);
        const h = 0.45 + alea() * 0.35;
        m.scale.set(0.18, h, 0.16);
        const r = 2.25;
        const dir = s.dir.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(g.quaternion).multiplyScalar(r / R)).normalize();
        // Évite l'échancrure de la première source
        if (monde.sources.indexOf(s) === 0 && dir.angleTo(monde.plan.pierreBouchon) * R < 1.4) continue;
        const p = monde.surface(dir);
        g.worldToLocal(p);
        m.position.copy(p).add(new THREE.Vector3(0, h * 0.5, 0));
        m.rotation.set((alea() - 0.5) * 0.3, alea() * 3, (alea() - 0.5) * 0.3);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
      this.groupe.add(g);
      this.sources.push({ groupe: g, cristal, mat, anneau });
    }

    // Pierres à pousser
    monde.pierres.forEach((p, k) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b8680, roughness: 0.92, flatShading: true });
      const mesh = new THREE.Mesh(caillou(1, k * 7.7), mat);
      mesh.scale.setScalar(p.rayon * 0.95);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.groupe.add(mesh);
      this.pierres.push({ mesh, mat });
    });

    // Rochers de décor
    const geo = caillou(0, 2.2);
    this.rochers = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), monde.plan.rochers.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    monde.plan.rochers.forEach((r, i) => {
      const p = monde.surface(r.dir, new THREE.Vector3(), -r.taille * 0.25);
      q.setFromUnitVectors(HAUT, r.dir).multiply(new THREE.Quaternion().setFromAxisAngle(HAUT, alea() * 6));
      m.compose(p, q, new THREE.Vector3(r.taille * (1 + alea() * 0.6), r.taille, r.taille * (1 + alea() * 0.4)));
      this.rochers.setMatrixAt(i, m);
      this.rochers.setColorAt(i, c.setRGB(0.45, 0.44, 0.43).multiplyScalar(0.8 + alea() * 0.4));
    });
    this.rochers.castShadow = true;
    this.rochers.receiveShadow = true;
    this.groupe.add(this.rochers);
  }

  maj(dt: number, temps: number, nuit: number, orbite = 0) {
    const m = this.monde;
    MAT_COLONNE.uniforms.uTemps.value = temps;
    MAT_COLONNE.uniforms.uForce.value = (0.6 + nuit * 0.8) * (1 - orbite);
    // Graines
    const vues = new Set<number>();
    for (const g of m.graines) {
      vues.add(g.id);
      let o = this.graines.get(g.id);
      if (!o) {
        o = new THREE.Group();
        const corps = new THREE.Mesh(this.geoGraine, this.matGraine);
        corps.castShadow = true;
        corps.name = "corps";
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.matFeuilleGraine);
        f.scale.set(1.4, 0.3, 0.6);
        f.position.set(0.06, 0.17, 0);
        corps.add(f);
        o.add(corps);
        const col = new THREE.Mesh(this.geoColonne, MAT_COLONNE);
        col.renderOrder = 3;
        o.add(col);
        m.surface(g.dir, o.position);
        orienter(o, g.dir);
        this.groupe.add(o);
        this.graines.set(g.id, o);
      }
      const corps = o.getObjectByName("corps")!;
      const apparition = Math.min(1, g.age * 2);
      corps.position.y = 0.35 + Math.sin(temps * 2.2 + g.id) * 0.08;
      corps.rotation.y = temps * 1.5 + g.id;
      corps.scale.setScalar(apparition);
    }
    for (const [id, o] of this.graines) {
      if (!vues.has(id)) {
        this.groupe.remove(o);
        this.graines.delete(id);
      }
    }
    // Sources
    m.sources.forEach((s, k) => {
      const v = this.sources[k];
      const eveil = s.active ? Math.min(1, s.depuis / 2) : 0;
      v.cristal.rotation.y += dt * (0.3 + eveil * 1.2);
      v.cristal.position.y = 1.3 + Math.sin(temps * 1.4 + k) * (0.05 + 0.1 * eveil) + eveil * 0.3;
      v.mat.emissiveIntensity = eveil * (1.6 + Math.sin(temps * 2.5) * 0.4);
      v.mat.color.setRGB(0.54 + 0.2 * eveil, 0.56 + 0.35 * eveil, 0.59 + 0.4 * eveil);
      // Au réveil, le cristal grossit d'un coup
      const choc = s.active && s.depuis < 1.5 ? Math.sin((s.depuis / 1.5) * Math.PI) * 0.6 : 0;
      v.cristal.scale.set(1 + choc, 1.7 + choc * 1.4, 1 + choc);
      const am = v.anneau.material as THREE.MeshBasicMaterial;
      am.opacity = eveil * (0.4 + 0.3 * Math.sin(temps * 3 + k));
      v.anneau.scale.setScalar(1 + ((temps * 0.5 + k * 0.3) % 1) * 0.5);
    });
    // Pierres
    m.pierres.forEach((p, k) => {
      const v = this.pierres[k];
      m.surface(p.dir, v.mesh.position, p.hauteur * 0.18);
      v.mesh.quaternion.copy(p.rotation);
      const mousse = m.vie[p.noeud];
      v.mat.color.setRGB(0.54 - mousse * 0.22, 0.52 + mousse * 0.06, 0.5 - mousse * 0.25);
    });
    // Rochers : un peu de mousse quand l'herbe les entoure
    this.compteur -= dt;
    if (this.compteur <= 0) {
      this.compteur = 1;
      const c = new THREE.Color();
      const gris = new THREE.Color(0.46, 0.45, 0.44);
      const mousse = new THREE.Color(0.32, 0.45, 0.2);
      m.plan.rochers.forEach((r, i) => {
        const v = m.vie[m.noeud(r.dir)];
        c.copy(gris).lerp(mousse, v * 0.7).multiplyScalar(0.85 + ((i * 37) % 10) / 30);
        this.rochers.setColorAt(i, c);
      });
      if (this.rochers.instanceColor) this.rochers.instanceColor.needsUpdate = true;
    }
  }

  /** Position du cristal d'une source (pour les effets). */
  cristal(k: number, cible = new THREE.Vector3()) {
    return this.sources[k].cristal.getWorldPosition(cible);
  }
}
