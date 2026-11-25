// Ce qui suit la souris : l'aperçu des routes qu'on trace, case par case, et la case visée.
import * as THREE from "three";
import { hauteur } from "../ville/ile";
import type { Case } from "../ville/routes";

export class Curseur {
  readonly groupe = new THREE.Group();
  private readonly cases: THREE.InstancedMesh;
  private readonly couleurs: Float32Array;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.92, 0.92, 2, 2).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.cases = new THREE.InstancedMesh(geo, mat, 400);
    this.couleurs = new Float32Array(400 * 3);
    this.cases.instanceColor = new THREE.InstancedBufferAttribute(this.couleurs, 3);
    this.cases.count = 0;
    this.cases.frustumCulled = false;
    this.cases.renderOrder = 6;
    this.groupe.add(this.cases);
  }

  /** Montre des cases (vertes si on peut y bâtir, rouges sinon) */
  montrer(liste: { c: Case; ok: boolean }[]) {
    const m = new THREE.Matrix4();
    const n = Math.min(liste.length, 400);
    for (let k = 0; k < n; k++) {
      const { c, ok } = liste[k]!;
      m.makeTranslation(c.i + 0.5, Math.max(0, hauteur(c.i + 0.5, c.j + 0.5)) + 0.08, c.j + 0.5);
      this.cases.setMatrixAt(k, m);
      const col = ok ? [0.55, 1.0, 0.6] : [1.0, 0.35, 0.25];
      this.couleurs.set(col, k * 3);
    }
    this.cases.count = n;
    this.cases.instanceMatrix.needsUpdate = true;
    this.cases.instanceColor!.needsUpdate = true;
  }

  cacher() {
    this.cases.count = 0;
  }
}
