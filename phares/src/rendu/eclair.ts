// La foudre : un trait zigzagant avec ses branches, construit à chaque coup
// comme un ruban tourné vers la caméra, très lumineux pour que le bloom l'auréole.

import * as THREE from "three";

interface Segment {
  a: THREE.Vector3;
  b: THREE.Vector3;
  largeur: number;
}

function zigzag(depart: THREE.Vector3, arrivee: THREE.Vector3, profondeur: number, ecart: number, largeur: number, sortie: Segment[]) {
  if (profondeur === 0) {
    sortie.push({ a: depart.clone(), b: arrivee.clone(), largeur });
    return;
  }
  const milieu = depart.clone().lerp(arrivee, 0.5);
  milieu.x += (Math.random() - 0.5) * ecart;
  milieu.z += (Math.random() - 0.5) * ecart;
  milieu.y += (Math.random() - 0.5) * ecart * 0.3;
  zigzag(depart, milieu, profondeur - 1, ecart * 0.55, largeur, sortie);
  zigzag(milieu, arrivee, profondeur - 1, ecart * 0.55, largeur, sortie);
  // une branche part parfois du milieu
  if (profondeur >= 3 && Math.random() < 0.45 && largeur > 0.8) {
    const dir = arrivee.clone().sub(depart);
    const fin = milieu.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * dir.length() * 0.9, dir.y * (0.3 + Math.random() * 0.4), (Math.random() - 0.5) * dir.length() * 0.9),
    );
    zigzag(milieu, fin, profondeur - 2, ecart * 0.5, largeur * 0.45, sortie);
  }
}

export class Foudre {
  mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private debut = -10;
  private force = 0;

  constructor() {
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(6, 6.5, 9),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  /** Fait tomber la foudre au point (x, z) vu depuis la caméra. */
  frapper(x: number, z: number, camera: THREE.Vector3, temps: number, force: number) {
    const haut = new THREE.Vector3(x + (Math.random() - 0.5) * 120, 420, z + (Math.random() - 0.5) * 120);
    const bas = new THREE.Vector3(x, -2, z);
    const segments: Segment[] = [];
    zigzag(haut, bas, 7, 170, 4.5 * (0.6 + force * 0.6), segments);
    const pos: number[] = [];
    const versCam = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const cote = new THREE.Vector3();
    for (const s of segments) {
      dir.subVectors(s.b, s.a);
      versCam.subVectors(camera, s.a).normalize();
      cote.crossVectors(dir, versCam).normalize().multiplyScalar(s.largeur * 0.5);
      const a1 = s.a.clone().add(cote);
      const a2 = s.a.clone().sub(cote);
      const b1 = s.b.clone().add(cote);
      const b2 = s.b.clone().sub(cote);
      pos.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z);
      pos.push(b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z);
    }
    this.mesh.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.mesh.geometry = geo;
    this.debut = temps;
    this.force = force;
  }

  maj(temps: number) {
    const t = temps - this.debut;
    const clignote = t < 0.06 ? 1 : t < 0.12 ? 0.2 : t < 0.2 ? 0.9 : t < 0.26 ? 0.1 : Math.max(0, 0.7 - (t - 0.26) * 3);
    this.mat.opacity = clignote * this.force;
    this.mesh.visible = this.mat.opacity > 0.01;
  }
}
