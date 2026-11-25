// Les bâtiments de la cité, dessinés en instances : une InstancedMesh par modèle (type, niveau,
// variante), réécrite à chaque image (quelques centaines de matrices, c'est peu). On y règle
// aussi le chantier qui monte du sol, la teinte de chaque maison et la surbrillance.
//
// Le module rassemble les émetteurs (cheminées, torches, feux, âne du moulin) en coordonnées du
// monde, pour les fumées, les lumières et la vie.
import * as THREE from "three";
import { emprise, FICHES, type Palier, type TypeBatiment } from "../ville/catalogue";
import { hachage } from "../ville/hasard";
import { hauteur } from "../ville/ile";
import type { Batiment, Ville } from "../ville/ville";
import { creerInstances, materiauBatiment } from "./materiaux";
import { modeleArcheAqueduc, modeleBatiment, modeleCastellum, nombreVariantes, type Emetteur, type SorteEmetteur } from "./modeles";

/** Les teintes d'enduit : blanc de chaux, ocres, roses, terre de Sienne */
const TEINTES: Record<Palier, number[]> = {
  0: [0xfff4e2, 0xf2dcb8, 0xe9cfa6, 0xf6e6c8, 0xe8c9a8],
  1: [0xf7d79a, 0xf2b98a, 0xfbe3b0, 0xeec3a0, 0xf9ecd2, 0xe8a87c],
  2: [0xfff8ec, 0xfbe8c8, 0xf4cfae, 0xfff2dc, 0xf3d9b6],
};

export interface EmetteurMonde {
  sorte: SorteEmetteur;
  pos: THREE.Vector3;
  batiment: number;
  type: TypeBatiment;
}

export interface Selection {
  survol: number | null;
  choisi: number | null;
}

export class Batiments {
  readonly groupe = new THREE.Group();
  private readonly materiau = materiauBatiment();
  private readonly fantomeMat = materiauBatiment({ fantome: true });
  private readonly meshes = new Map<string, { mesh: THREE.InstancedMesh; hauteur: number; emetteurs: Emetteur[] }>();
  private fantome: THREE.InstancedMesh | null = null;
  private cleFantome = "";
  emetteurs: EmetteurMonde[] = [];
  private cleEmetteurs = "";
  private decorPose = false;
  readonly selection: Selection = { survol: null, choisi: null };

  /** Le modèle d'un bâtiment */
  static cle(type: TypeBatiment, palier: Palier, variante: number) {
    const n = nombreVariantes(type, palier);
    return `${type}/${type === "maison" ? palier : 0}/${((variante % n) + n) % n}`;
  }

  private obtenir(type: TypeBatiment, palier: Palier, variante: number) {
    const cle = Batiments.cle(type, palier, variante);
    let m = this.meshes.get(cle);
    if (!m) {
      const modele = modeleBatiment(type, palier, variante);
      const max = type === "maison" ? 400 : type === "temple" || type === "port" || type === "phare" ? 2 : 80;
      const mesh = creerInstances(modele.geometrie, this.materiau, max, modele.hauteur);
      this.groupe.add(mesh);
      m = { mesh, hauteur: modele.hauteur, emetteurs: modele.emetteurs };
      this.meshes.set(cle, m);
    }
    return m;
  }

  static matrice(b: { i: number; j: number; l: number; p: number; rotation: number; sol: number }, cible = new THREE.Matrix4()) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (b.rotation * Math.PI) / 2);
    return cible.compose(new THREE.Vector3(b.i + b.l / 2, b.sol, b.j + b.p / 2), q, new THREE.Vector3(1, 1, 1));
  }

  mettreAJour(_dt: number, v: Ville) {
    if (!this.decorPose) this.poserDecor(v);
    const comptes = new Map<string, number>();
    for (const m of this.meshes.values()) m.mesh.count = 0;
    const mat = new THREE.Matrix4();
    let cleEm = "";
    for (const b of v.batiments.values()) {
      const m = this.obtenir(b.type, b.palier, b.variante);
      const cle = Batiments.cle(b.type, b.palier, b.variante);
      const n = comptes.get(cle) ?? 0;
      if (n >= m.mesh.instanceMatrix.count) continue;
      comptes.set(cle, n + 1);
      m.mesh.setMatrixAt(n, Batiments.matrice(b, mat));
      const teintes = TEINTES[b.palier];
      const t = new THREE.Color(teintes[Math.floor(b.graine * teintes.length)]!);
      (m.mesh.geometry.attributes.aTeinte as THREE.InstancedBufferAttribute).setXYZ(n, t.r, t.g, t.b);
      const etat = this.selection.choisi === b.id ? 1 : this.selection.survol === b.id ? 2 : 0;
      (m.mesh.geometry.attributes.aInst as THREE.InstancedBufferAttribute).setXYZW(n, b.chantier, m.hauteur, etat, b.graine);
      m.mesh.count = n + 1;
      cleEm += `${b.id}:${cle},`;
    }
    for (const m of this.meshes.values()) {
      m.mesh.instanceMatrix.needsUpdate = true;
      (m.mesh.geometry.attributes.aTeinte as THREE.InstancedBufferAttribute).needsUpdate = true;
      (m.mesh.geometry.attributes.aInst as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    if (cleEm !== this.cleEmetteurs) {
      this.cleEmetteurs = cleEm;
      this.recalculerEmetteurs(v);
    }
  }

  /** L'aqueduc et son château d'eau : posés une fois pour toutes */
  private poserDecor(v: Ville) {
    this.decorPose = true;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const a of v.decor.aqueduc) {
      if (a.hauteur < 0.4) continue;
      const modele = modeleArcheAqueduc(a.hauteur);
      const cle = `aqueduc/${modele.hauteur}`;
      let m = this.meshes.get(cle);
      if (!m) {
        const mesh = creerInstances(modele.geometrie, this.materiau, 40, modele.hauteur);
        this.groupe.add(mesh);
        m = { mesh, hauteur: modele.hauteur, emetteurs: [] };
        // Ces maillages-là ne bougent plus : on les sort du compte des bâtiments
        this.meshes.set(cle, m);
        this.decor.push(m.mesh);
      }
      const sol = hauteur(a.i + 0.5, a.j + 0.5);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.axe === "x" ? 0 : Math.PI / 2);
      mat.compose(new THREE.Vector3(a.i + 0.5, sol, a.j + 0.5), q, new THREE.Vector3(1, 1, 1));
      const n = m.mesh.count;
      m.mesh.setMatrixAt(n, mat);
      m.mesh.count = n + 1;
    }
    if (v.decor.castellum) {
      const c = v.decor.castellum;
      const modele = modeleCastellum();
      const mesh = creerInstances(modele.geometrie, this.materiau, 1, modele.hauteur);
      mesh.setMatrixAt(0, mat.compose(new THREE.Vector3(c.i + 0.5, hauteur(c.i + 0.5, c.j + 0.5), c.j + 0.5), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
      mesh.count = 1;
      this.groupe.add(mesh);
      this.decor.push(mesh);
    }
    // Le décor garde son compte : on le retire de la remise à zéro
    for (const m of this.decor) {
      const n = m.count;
      for (const [cle, e] of this.meshes) if (e.mesh === m) this.meshes.delete(cle);
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
  }
  private readonly decor: THREE.InstancedMesh[] = [];

  private recalculerEmetteurs(v: Ville) {
    this.emetteurs = [];
    const mat = new THREE.Matrix4();
    for (const b of v.batiments.values()) {
      const m = this.obtenir(b.type, b.palier, b.variante);
      Batiments.matrice(b, mat);
      for (const e of m.emetteurs) {
        this.emetteurs.push({ sorte: e.sorte, pos: new THREE.Vector3(e.x, e.y, e.z).applyMatrix4(mat), batiment: b.id, type: b.type });
      }
    }
  }

  /** Le fantôme du bâtiment qu'on s'apprête à poser */
  montrerFantome(type: TypeBatiment | null, i: number, j: number, rotation: number, ok: boolean, sol: number) {
    if (!type || type === ("route" as TypeBatiment)) {
      if (this.fantome) this.fantome.visible = false;
      return;
    }
    const variante = Math.floor(hachage(i, j, 3) * 4);
    const cle = Batiments.cle(type, 0, variante);
    if (cle !== this.cleFantome) {
      if (this.fantome) {
        this.groupe.remove(this.fantome);
        this.fantome.geometry.dispose();
      }
      const modele = modeleBatiment(type, 0, variante);
      this.fantome = creerInstances(modele.geometrie.clone(), this.fantomeMat, 1, modele.hauteur);
      this.fantome.castShadow = false;
      this.fantome.count = 1;
      this.fantome.renderOrder = 5;
      this.groupe.add(this.fantome);
      this.cleFantome = cle;
    }
    const f = this.fantome!;
    f.visible = true;
    const { l, p } = emprise(type, rotation);
    f.setMatrixAt(0, Batiments.matrice({ i, j, l, p, rotation, sol }));
    f.instanceMatrix.needsUpdate = true;
    (this.fantomeMat.userData.uFantome as { value: THREE.Color }).value.set(ok ? 0x7dff9a : 0xff5a3c);
  }

  /** Le bâtiment sous un rayon (pour le survol et la sélection) : on teste les emprises */
  static batimentSous(v: Ville, point: THREE.Vector3 | null): Batiment | null {
    if (!point) return null;
    return v.batimentEn(Math.floor(point.x), Math.floor(point.z));
  }

  static rayon(type: TypeBatiment) {
    return FICHES[type].rayon ?? 0;
  }
}
