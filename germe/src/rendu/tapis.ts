// Un « tapis » d'instances posées sur la planète (herbe, fleurs) : les instances sont réparties en
// paquets selon la zone de la planète, pour que la caméra n'en dessine que les paquets visibles.
// Chaque instance connaît sa direction et son sommet ; le shader lit l'état du sommet pour décider
// de sa taille (l'herbe pousse là où la vie arrive).
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { hasard } from "../monde/bruit";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;

/** Centres des 80 faces d'un icosaèdre subdivisé une fois. */
function centresPaquets() {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((p) => new THREE.Vector3(p[0], p[1], p[2]).normalize());
  const f = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  const centres: THREE.Vector3[] = [];
  for (let k = 0; k < f.length; k += 3) {
    const a = v[f[k]], b = v[f[k + 1]], c = v[f[k + 2]];
    const ab = a.clone().add(b).normalize(), bc = b.clone().add(c).normalize(), ca = c.clone().add(a).normalize();
    for (const [x, y, z] of [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]) {
      centres.push(x.clone().add(y).add(z).normalize());
    }
  }
  return centres;
}

export interface OptionsTapis {
  nombre: number;
  graine: number;
  /** Distance (en mètres) au-delà de laquelle un paquet n'est plus dessiné depuis le sol. */
  portee: number;
  /** Filtre : garder une instance à cette direction ? */
  filtre?: (dir: THREE.Vector3, noeud: number) => boolean;
  /** Attributs supplémentaires par instance. */
  extra?: { nom: string; taille: number; valeur: (alea: () => number, dir: THREE.Vector3) => number[] }[];
}

export class Tapis {
  readonly groupe = new THREE.Group();
  private readonly paquets: { mesh: THREE.Mesh; centre: THREE.Vector3; rayon: number }[] = [];

  constructor(monde: Monde, geometrie: THREE.BufferGeometry, materiau: THREE.Material, o: OptionsTapis) {
    const centres = centresPaquets();
    const alea = hasard(o.graine);
    const listes: { dir: number[]; idx: number[]; alea: number[]; extra: number[][] }[] = centres.map(() => ({
      dir: [],
      idx: [],
      alea: [],
      extra: (o.extra ?? []).map(() => []),
    }));
    const dir = new THREE.Vector3();
    let noeud = -1;
    for (let k = 0; k < o.nombre; k++) {
      // Direction uniforme sur la sphère
      const z = alea() * 2 - 1;
      const a = alea() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      dir.set(r * Math.cos(a), z, r * Math.sin(a));
      noeud = monde.noeud(dir, noeud);
      if (o.filtre && !o.filtre(dir, noeud)) continue;
      let meilleur = 0;
      let pm = -2;
      for (let c = 0; c < centres.length; c++) {
        const p = centres[c].dot(dir);
        if (p > pm) {
          pm = p;
          meilleur = c;
        }
      }
      const l = listes[meilleur];
      l.dir.push(dir.x, dir.y, dir.z);
      l.idx.push(noeud);
      l.alea.push(alea(), alea(), alea(), alea());
      (o.extra ?? []).forEach((e, j) => l.extra[j].push(...e.valeur(alea, dir)));
    }
    listes.forEach((l, c) => {
      if (l.idx.length === 0) return;
      const g = new THREE.InstancedBufferGeometry();
      g.index = geometrie.index;
      for (const [nom, attr] of Object.entries(geometrie.attributes)) g.setAttribute(nom, attr);
      g.setAttribute("aDir", new THREE.InstancedBufferAttribute(new Float32Array(l.dir), 3));
      g.setAttribute("aIdx", new THREE.InstancedBufferAttribute(new Float32Array(l.idx), 1));
      g.setAttribute("aAlea", new THREE.InstancedBufferAttribute(new Float32Array(l.alea), 4));
      (o.extra ?? []).forEach((e, j) => g.setAttribute(e.nom, new THREE.InstancedBufferAttribute(new Float32Array(l.extra[j]), e.taille)));
      g.instanceCount = l.idx.length;
      let rayon = 0;
      for (let k = 0; k < l.dir.length; k += 3) {
        dir.set(l.dir[k], l.dir[k + 1], l.dir[k + 2]);
        rayon = Math.max(rayon, dir.distanceTo(centres[c]) * R);
      }
      const centre = centres[c].clone().multiplyScalar(R);
      g.boundingSphere = new THREE.Sphere(centre.clone(), rayon + 2.5);
      const mesh = new THREE.Mesh(g, materiau);
      mesh.receiveShadow = true;
      this.groupe.add(mesh);
      this.paquets.push({ mesh, centre, rayon: rayon + 2.5 });
    });
  }

  /** Ne garde que les paquets du côté de la caméra (et assez proches quand on est au sol). */
  cadrer(camera: THREE.Vector3, auSol: boolean, portee: number) {
    const lc = camera.length();
    const horizon = Math.sqrt(Math.max(0, lc * lc - R * R));
    for (const p of this.paquets) {
      const d = p.centre.distanceTo(camera) - p.rayon;
      p.mesh.visible = d < horizon + 2 && (!auSol || d < portee);
    }
  }
}
