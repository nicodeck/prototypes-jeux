// Le lointain : ce qu'on voit à l'horizon. Au nord, la côte du continent et ses montagnes, bleues
// de distance ; à l'est, une île volcanique dont le cratère fume ; çà et là, des îlots rocheux.
// La brume s'occupe de la perspective atmosphérique : plus c'est loin, plus ça prend la couleur
// du ciel.
import * as THREE from "three";
import { fbm } from "../ville/ile";
import { patcher } from "./atmosphere";

interface Relief {
  x: number;
  z: number;
  /** Demi-largeur et demi-profondeur */
  rx: number;
  rz: number;
  hauteur: number;
  /** Forme : "chaine" (crêtes), "volcan" (cône à cratère), "ilot" */
  forme: "chaine" | "volcan" | "ilot";
  graine: number;
}

const RELIEFS: Relief[] = [
  // Le continent, au nord, sur toute la largeur
  { x: -300, z: -900, rx: 700, rz: 260, hauteur: 210, forme: "chaine", graine: 1 },
  { x: 500, z: -1050, rx: 650, rz: 280, hauteur: 260, forme: "chaine", graine: 2 },
  { x: -1100, z: -500, rx: 400, rz: 500, hauteur: 160, forme: "chaine", graine: 3 },
  // Le volcan, à l'est
  { x: 760, z: 160, rx: 170, rz: 170, hauteur: 175, forme: "volcan", graine: 4 },
  // Des îles plus petites
  { x: -520, z: 380, rx: 90, rz: 60, hauteur: 38, forme: "ilot", graine: 5 },
  { x: 380, z: 620, rx: 70, rz: 50, hauteur: 26, forme: "ilot", graine: 6 },
  { x: 1050, z: -300, rx: 140, rz: 90, hauteur: 70, forme: "ilot", graine: 7 },
];

/** Le sommet du volcan, d'où monte le panache */
export const CRATERE = new THREE.Vector3(760, 168, 160);

function relief(r: Relief) {
  const n = r.forme === "chaine" ? 160 : 90;
  const geo = new THREE.PlaneGeometry(r.rx * 2.4, r.rz * 2.4, n, n).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const herbe = new THREE.Color(0x3b4a24);
  const maquis = new THREE.Color(0x26331a);
  const roche = new THREE.Color(0x8a8070);
  const cendre = new THREE.Color(0x4a4038);
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    const u = x / r.rx;
    const v = z / r.rz;
    const d = Math.sqrt(u * u + v * v);
    let h = 0;
    if (r.forme === "chaine") {
      const crete = fbm(x * 0.004 + r.graine * 10, z * 0.004, 5, r.graine) ;
      const ride = 1 - Math.abs(fbm(x * 0.006 + r.graine, z * 0.009, 4, r.graine + 3) - 0.5) * 2;
      const masse = Math.max(0, 1 - Math.pow(Math.max(Math.abs(u) * 0.85, Math.abs(v)), 2.2));
      h = r.hauteur * masse * (0.35 + 0.65 * crete) * (0.6 + 0.6 * ride * ride);
    } else if (r.forme === "volcan") {
      const cone = Math.max(0, 1 - d);
      const cratere = Math.exp(-(d * d) / 0.012) * 0.22;
      const ravines = 1 - 0.12 * Math.abs(Math.sin(Math.atan2(v, u) * 9 + fbm(u * 3, v * 3, 2, 9) * 4));
      h = r.hauteur * (Math.pow(cone, 1.35) * ravines - cratere) + fbm(x * 0.03, z * 0.03, 3, 11) * 6 * cone;
    } else {
      const masse = Math.max(0, 1 - d);
      h = r.hauteur * Math.pow(masse, 0.8) * (0.6 + 0.6 * fbm(x * 0.03 + r.graine, z * 0.03, 4, r.graine));
    }
    h -= 4;
    pos.setY(k, h);
    const t = THREE.MathUtils.clamp(h / r.hauteur, 0, 1);
    const varie = fbm(x * 0.02, z * 0.02, 3, r.graine + 20);
    if (r.forme === "volcan") c.copy(herbe).lerp(cendre, THREE.MathUtils.smoothstep(t, 0.25, 0.6));
    else c.copy(herbe).lerp(maquis, varie).lerp(roche, THREE.MathUtils.smoothstep(t + varie * 0.2, 0.45, 0.85));
    col.set([c.r, c.g, c.b], k * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.translate(r.x, 0, r.z);
  return geo;
}

export class Lointain {
  readonly groupe = new THREE.Group();

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    patcher(mat, { cle: "lointain", mouille: false });
    for (const r of RELIEFS) {
      const m = new THREE.Mesh(relief(r), mat);
      m.castShadow = false;
      m.receiveShadow = false;
      this.groupe.add(m);
    }
  }
}
