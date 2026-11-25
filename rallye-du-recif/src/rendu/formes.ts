// Des formes de base, toutes lisses (le contour encré en a besoin).
import * as THREE from "three";

/** Un membre : une capsule effilée qui part de l'origine et descend de `longueur`. */
export function membre(rHaut: number, rBas: number, longueur: number, segments = 14) {
  const pts: THREE.Vector2[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * rBas, -longueur + Math.sin(a) * rBas));
  }
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * rHaut, Math.sin(a) * rHaut));
  }
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, segments);
}

/**
 * Une forme de révolution à partir d'un profil [rayon, hauteur], de bas en haut.
 * Les bouts sont fermés. L'avant (+Z) tombe au milieu de la texture (u = 0,5).
 */
export function revolution(profil: [number, number][], segments = 20, ouverture = 0) {
  const pts = profil.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  // Sans ouverture, l'avant tombe au milieu de la texture ; avec, l'ouverture est devant.
  const debut = ouverture > 0 ? ouverture / 2 : Math.PI;
  return new THREE.LatheGeometry(pts, segments, debut, Math.PI * 2 - ouverture);
}

/** Un profil lissé : interpole des points de contrôle [rayon, hauteur]. */
export function profilLisse(points: [number, number][], pas = 24): [number, number][] {
  const courbe = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return courbe.getPoints(pas).map((p) => [p.x, p.y]);
}

export function ellipsoide(rx: number, ry: number, rz: number, w = 20, h = 14) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

/**
 * Un tube qui s'effile le long d'une courbe : mèches, barbe, écharpe.
 * `aplati` écrase la section (1 = rond) ; `largeur` est l'axe large de la section.
 */
export class Tube {
  readonly geometrie = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly normales: Float32Array;

  constructor(
    readonly anneaux: number,
    readonly cotes: number,
    readonly rayon: (t: number) => number,
    readonly aplati = 1,
  ) {
    const nb = anneaux * cotes + 2;
    this.positions = new Float32Array(nb * 3);
    this.normales = new Float32Array(nb * 3);
    const index: number[] = [];
    for (let i = 0; i < anneaux - 1; i++)
      for (let j = 0; j < cotes; j++) {
        const a = i * cotes + j;
        const b = i * cotes + ((j + 1) % cotes);
        const c = a + cotes;
        const d = b + cotes;
        index.push(a, c, b, b, c, d);
      }
    const debut = anneaux * cotes;
    const fin = debut + 1;
    for (let j = 0; j < cotes; j++) {
      index.push(debut, j, (j + 1) % cotes);
      const k = (anneaux - 1) * cotes;
      index.push(fin, k + ((j + 1) % cotes), k + j);
    }
    this.geometrie.setIndex(index);
    this.geometrie.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometrie.setAttribute("normal", new THREE.BufferAttribute(this.normales, 3));
    this.geometrie.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(nb * 2), 2));
  }

  /** Recalcule le tube sur des points (au moins 2). `travers` oriente l'axe large. */
  suivre(points: THREE.Vector3[], travers = new THREE.Vector3(0, 0, 1)) {
    const courbe = points.length > 2 ? new THREE.CatmullRomCurve3(points) : new THREE.LineCurve3(points[0], points[1]);
    const P = this.positions;
    const N = this.normales;
    const t = new THREE.Vector3();
    const n = new THREE.Vector3();
    const b = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < this.anneaux; i++) {
      const u = i / (this.anneaux - 1);
      courbe.getPointAt(u, p);
      courbe.getTangentAt(u, t);
      b.crossVectors(t, travers);
      if (b.lengthSq() < 1e-6) b.set(1, 0, 0).cross(t);
      b.normalize();
      n.crossVectors(b, t).normalize();
      const r = this.rayon(u);
      for (let j = 0; j < this.cotes; j++) {
        const a = (j / this.cotes) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const k = (i * this.cotes + j) * 3;
        P[k] = p.x + (b.x * ca + n.x * sa * this.aplati) * r;
        P[k + 1] = p.y + (b.y * ca + n.y * sa * this.aplati) * r;
        P[k + 2] = p.z + (b.z * ca + n.z * sa * this.aplati) * r;
        const nx = b.x * ca * this.aplati + n.x * sa;
        const ny = b.y * ca * this.aplati + n.y * sa;
        const nz = b.z * ca * this.aplati + n.z * sa;
        const l = Math.hypot(nx, ny, nz) || 1;
        N[k] = nx / l;
        N[k + 1] = ny / l;
        N[k + 2] = nz / l;
      }
    }
    const debut = this.anneaux * this.cotes * 3;
    courbe.getPointAt(0, p);
    courbe.getTangentAt(0, t);
    P.set([p.x, p.y, p.z], debut);
    N.set([-t.x, -t.y, -t.z], debut);
    courbe.getPointAt(1, p);
    courbe.getTangentAt(1, t);
    P.set([p.x + t.x * 0.001, p.y + t.y * 0.001, p.z + t.z * 0.001], debut + 3);
    N.set([t.x, t.y, t.z], debut + 3);
    this.geometrie.attributes.position.needsUpdate = true;
    this.geometrie.attributes.normal.needsUpdate = true;
    this.geometrie.computeBoundingSphere();
    return this;
  }
}

/** Une mèche ou une pointe fixe : un tube effilé le long de quelques points. */
export function meche(points: [number, number, number][], rayon: number, finesse = 0.05, cotes = 8) {
  const tube = new Tube(10, cotes, (u) => rayon * (1 - u * (1 - finesse)) * (u < 0.15 ? 0.75 + u * 1.6 : 1));
  tube.suivre(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return tube.geometrie;
}

/** Une étoile plate (éclats d'impact, effets). */
export function etoile(branches: number, rExt: number, rInt: number, irregularite = 0, graine = 1) {
  let s = graine;
  const alea = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const forme = new THREE.Shape();
  for (let i = 0; i < branches * 2; i++) {
    const a = (i / (branches * 2)) * Math.PI * 2;
    const r = (i % 2 === 0 ? rExt * (1 + alea() * irregularite) : rInt * (1 + alea() * irregularite * 0.4));
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) forme.moveTo(x, y);
    else forme.lineTo(x, y);
  }
  forme.closePath();
  return new THREE.ShapeGeometry(forme);
}
