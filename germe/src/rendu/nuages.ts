// Des nuages bouffis qui tournent lentement autour de la planète et promènent leur ombre sur le sol.
// Gris de poussière quand la planète est morte, blancs quand elle revit, roses au crépuscule.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hasard } from "../monde/bruit";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;

interface Nuage {
  mesh: THREE.Mesh;
  axe: THREE.Vector3;
  depart: THREE.Vector3;
  angle: number;
  vitesse: number;
  altitude: number;
}

export class Nuages {
  readonly groupe = new THREE.Group();
  private readonly nuages: Nuage[] = [];
  private readonly mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
    transparent: true,
    opacity: 0.94,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
  });

  constructor() {
    const alea = hasard(321);
    for (let k = 0; k < 16; k++) {
      const boules: THREE.BufferGeometry[] = [];
      const n = 7 + Math.floor(alea() * 5);
      const long = 1.2 + alea() * 1.2;
      for (let b = 0; b < n; b++) {
        // Des boules serrées dans une ellipse, plus grosses et plus hautes au centre
        const a = alea() * Math.PI * 2;
        const d = Math.sqrt(alea());
        const x = Math.cos(a) * d * long;
        const z = Math.sin(a) * d * long * 0.55;
        const centre = 1 - d;
        const r = 0.45 + 0.5 * centre + alea() * 0.2;
        const g = new THREE.IcosahedronGeometry(r, 1);
        g.scale(1, 0.75, 1);
        g.translate(x, centre * 0.35 + (alea() - 0.5) * 0.1, z);
        boules.push(g);
      }
      const geo = mergeGeometries(boules)!;
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.castShadow = true;
      const axe = new THREE.Vector3(alea() - 0.5, alea() - 0.5, alea() - 0.5).normalize();
      const depart = new THREE.Vector3(alea() - 0.5, alea() - 0.5, alea() - 0.5);
      depart.addScaledVector(axe, -depart.dot(axe)).normalize();
      const nuage: Nuage = { mesh, axe, depart, angle: alea() * Math.PI * 2, vitesse: 0.012 + alea() * 0.015, altitude: 6.5 + alea() * 3 };
      mesh.scale.setScalar(0.8 + alea() * 0.6);
      this.groupe.add(mesh);
      this.nuages.push(nuage);
    }
  }

  maj(dt: number, vie: number, crepuscule: number, nuit: number, orbite: number) {
    for (const n of this.nuages) {
      n.angle += n.vitesse * dt;
      const dir = n.depart.clone().applyAxisAngle(n.axe, n.angle);
      n.mesh.position.copy(dir).multiplyScalar(R + n.altitude);
      const avance = new THREE.Vector3().crossVectors(n.axe, dir).normalize();
      const droite = new THREE.Vector3().crossVectors(dir, avance);
      n.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(avance, dir, droite.negate()));
    }
    const c = new THREE.Color(0.8, 0.77, 0.75).lerp(new THREE.Color(0.92, 0.93, 0.95), vie);
    c.lerp(new THREE.Color(1, 0.72, 0.7), crepuscule * 0.5);
    this.mat.color.copy(c);
    // Le dessous des nuages ne doit pas paraître de pierre : un peu de lumière propre
    this.mat.emissive.copy(c).lerp(new THREE.Color(0.35, 0.42, 0.65), nuit);
    this.mat.emissiveIntensity = (0.3 - nuit * 0.2) * (1 - orbite * 0.8);
  }
}
